const db = require('../db');
const mailer = require('./mailer');
const { isValidEmailAddress } = require('./email_extractor');

let isProcessing = false;

// Random delay between 45 to 90 seconds (human-like sending)
const getRandomDelay = () => Math.floor(Math.random() * (90000 - 45000 + 1) + 45000);

const processQueue = async () => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    // 1. Get next pending email from a RUNNING campaign
    const res = await db.query(`
      SELECT eq.id as queue_id, eq.target_email, eq.campaign_id, eq.lead_id, 
             c.subject, c.body_html, c.status as camp_status,
             c.attachment_path, c.attachment_type, c.image_link, c.user_id,
             c.sender_account_id
      FROM email_queue eq
      JOIN campaigns c ON eq.campaign_id = c.id
      WHERE eq.status = 'PENDING' AND c.status = 'RUNNING'
      ORDER BY eq.created_at ASC
      LIMIT 1
    `);

    if (res.rows.length === 0) {
      isProcessing = false;
      setTimeout(processQueue, 10000); // Poll again in 10s if empty
      return;
    }

    const job = res.rows[0];

    // 2. Filter out dummy or invalid emails safely without sending
    if (!isValidEmailAddress(job.target_email)) {
      console.warn(`[Queue] Skipping invalid/dummy email: ${job.target_email}`);
      await db.query(`UPDATE email_queue SET status = 'CANCELLED', error_msg = 'Invalid or dummy email skipped' WHERE id = $1`, [job.queue_id]);
      isProcessing = false;
      setTimeout(processQueue, 1000);
      return;
    }

    // 3. Strict Sender Account Binding
    if (!job.sender_account_id) {
      console.warn(`[Queue] Campaign #${job.campaign_id} has no sender_account_id. Pausing campaign to avoid unauthorized send.`);
      await db.query(`UPDATE campaigns SET status = 'PAUSED' WHERE id = $1`, [job.campaign_id]);
      isProcessing = false;
      setTimeout(processQueue, 5000);
      return;
    }

    // Fetch the exact bound account for this campaign & user
    const accRes = await db.query(
      `SELECT * FROM email_accounts WHERE id = $1 AND user_id = $2`,
      [job.sender_account_id, job.user_id]
    );

    if (accRes.rows.length === 0) {
      console.warn(`[Queue] Sender account ID ${job.sender_account_id} not found for user ${job.user_id}. Pausing campaign #${job.campaign_id}.`);
      await db.query(`UPDATE campaigns SET status = 'PAUSED' WHERE id = $1`, [job.campaign_id]);
      isProcessing = false;
      setTimeout(processQueue, 10000);
      return;
    }

    const account = accRes.rows[0];

    // Account status check - must be ACTIVE
    if (account.status !== 'ACTIVE') {
      console.warn(`[Queue] Sender account ${account.email} is in status ${account.status}. Pausing campaign #${job.campaign_id}.`);
      await db.query(`UPDATE campaigns SET status = 'PAUSED' WHERE id = $1`, [job.campaign_id]);
      isProcessing = false;
      setTimeout(processQueue, 10000);
      return;
    }

    // Daily rollover check
    const todayStr = new Date().toISOString().split('T')[0];
    const lastReset = account.last_reset_date ? new Date(account.last_reset_date).toISOString().split('T')[0] : null;
    if (!lastReset || lastReset < todayStr) {
      await db.query(`UPDATE email_accounts SET daily_sent_count = 0, last_reset_date = CURRENT_DATE WHERE id = $1`, [account.id]);
      account.daily_sent_count = 0;
    }

    // Check account daily safe limit (400 emails/day per Gmail account)
    if (account.daily_sent_count >= 400) {
      console.warn(`[Queue] Sender account ${account.email} reached daily safe limit (400). Pausing campaign #${job.campaign_id}.`);
      await db.query(`UPDATE campaigns SET status = 'PAUSED' WHERE id = $1`, [job.campaign_id]);
      isProcessing = false;
      setTimeout(processQueue, 10000);
      return;
    }

    // Check user plan entitlement & overall daily quota
    const { getUserPlanEntitlement } = require('./plans');
    const entitlement = await getUserPlanEntitlement(job.user_id, db);

    if (!entitlement.emailCampaignsEnabled || entitlement.dailyEmailLimit <= 0) {
      console.warn(`[Queue] User ${job.user_id} plan (${entitlement.planName}) does not permit campaign sending. Pausing campaign #${job.campaign_id}.`);
      await db.query(`UPDATE campaigns SET status = 'PAUSED' WHERE id = $1`, [job.campaign_id]);
      isProcessing = false;
      setTimeout(processQueue, 10000);
      return;
    }

    const totalSentRes = await db.query(
      `WITH allowed_accounts AS (
        SELECT daily_sent_count
        FROM email_accounts
        WHERE user_id = $1 AND status = 'ACTIVE'
        ORDER BY id ASC
        LIMIT $2
      )
      SELECT COALESCE(SUM(daily_sent_count), 0)::int as total_sent FROM allowed_accounts`,
      [job.user_id, entitlement.maxAccounts]
    );
    const totalSentToday = parseInt(totalSentRes.rows[0]?.total_sent || 0, 10);

    if (totalSentToday >= entitlement.dailyEmailLimit) {
      console.warn(`[Queue] User ${job.user_id} reached daily plan limit (${totalSentToday}/${entitlement.dailyEmailLimit}). Pausing campaign #${job.campaign_id}.`);
      await db.query(`UPDATE campaigns SET status = 'PAUSED' WHERE id = $1`, [job.campaign_id]);
      isProcessing = false;
      setTimeout(processQueue, 10000);
      return;
    }

    // 4. Fetch lead details for template parsing
    let leadData = {};
    if (job.lead_id) {
      const leadRes = await db.query(`SELECT * FROM leads WHERE id = $1`, [job.lead_id]);
      if (leadRes.rows.length > 0) leadData = leadRes.rows[0];
    }

    const parsedSubject = mailer.parseTemplate(job.subject, leadData);
    const parsedBody = mailer.parseTemplate(job.body_html, leadData);

    // 5. CRITICAL: Pre-send status re-verification
    // Re-verify that the campaign is STILL 'RUNNING' right before invoking SMTP
    const preCheck = await db.query(
      `SELECT status FROM campaigns WHERE id = $1`,
      [job.campaign_id]
    );
    if (preCheck.rows.length === 0 || preCheck.rows[0].status !== 'RUNNING') {
      console.log(`[Queue] Campaign #${job.campaign_id} status changed to ${preCheck.rows[0]?.status || 'UNKNOWN'}. Aborting dispatch.`);
      isProcessing = false;
      setTimeout(processQueue, 5000);
      return;
    }

    // 6. Send Email using the strictly bound account
    try {
      await mailer.sendEmail(account, job.target_email, parsedSubject, parsedBody, {
        attachment_path: job.attachment_path,
        attachment_type: job.attachment_type,
        image_link: job.image_link
      });
      
      // Update Queue
      await db.query(`UPDATE email_queue SET status = 'SENT', sent_at = CURRENT_TIMESTAMP WHERE id = $1`, [job.queue_id]);
      
      // Update Account Limit
      await db.query(`UPDATE email_accounts SET daily_sent_count = daily_sent_count + 1 WHERE id = $1`, [account.id]);
      
      // Update Campaign Stats
      await db.query(`UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = $1`, [job.campaign_id]);
      
      console.log(`[Queue] Sent email to ${job.target_email} strictly via ${account.email} (Campaign #${job.campaign_id})`);
    } catch (sendErr) {
      console.error(`[Queue] Error sending to ${job.target_email} via ${account.email}:`, sendErr.message);
      
      // If Gmail credentials or quota error, update account and PAUSE campaign (do not silently switch)
      if (sendErr.message.includes('Invalid login') || sendErr.message.includes('Username and Password not accepted') || sendErr.message.includes('BadCredentials')) {
        await db.query(`UPDATE email_accounts SET status = 'AUTH_ERROR' WHERE id = $1`, [account.id]);
        await db.query(`UPDATE campaigns SET status = 'PAUSED' WHERE id = $1`, [job.campaign_id]);
        console.warn(`[Queue] Account ${account.email} marked as AUTH_ERROR. Campaign #${job.campaign_id} paused.`);
      } else if (sendErr.message.includes('quota') || sendErr.message.includes('limit exceeded') || sendErr.message.includes('Daily user sending quota')) {
        await db.query(`UPDATE email_accounts SET daily_sent_count = 400 WHERE id = $1`, [account.id]);
        await db.query(`UPDATE campaigns SET status = 'PAUSED' WHERE id = $1`, [job.campaign_id]);
        console.warn(`[Queue] Account ${account.email} reached Gmail quota. Campaign #${job.campaign_id} paused.`);
      }

      // Update Queue as FAILED
      await db.query(`UPDATE email_queue SET status = 'FAILED', error_msg = $1 WHERE id = $2`, [sendErr.message, job.queue_id]);
      
      // Update Campaign Stats
      await db.query(`UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = $1`, [job.campaign_id]);
    }

    // Check if campaign is finished
    const remainingRes = await db.query(`SELECT count(*) FROM email_queue WHERE campaign_id = $1 AND status = 'PENDING'`, [job.campaign_id]);
    if (parseInt(remainingRes.rows[0].count) === 0) {
      await db.query(`UPDATE campaigns SET status = 'COMPLETED', completed_at = NOW() WHERE id = $1`, [job.campaign_id]);
      console.log(`Campaign #${job.campaign_id} Completed!`);
    }

  } catch (err) {
    console.error('[Queue Engine Error]', err);
  }

  isProcessing = false;

  // Re-trigger loop with human-like delay to avoid spam flags
  setTimeout(processQueue, getRandomDelay());
};

// Start the loop (called from index.js)
const startQueueEngine = () => {
  console.log("Starting Smart Queue Engine...");
  // Initial delay
  setTimeout(processQueue, 5000);
};

module.exports = { startQueueEngine };

