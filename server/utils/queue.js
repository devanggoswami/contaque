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
             c.attachment_path, c.attachment_type, c.image_link
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

    // 3. Get an available Gmail account
    const account = await mailer.getAvailableAccount();
    if (!account) {
      console.log('No available email accounts. Queue paused.');
      await db.query(`UPDATE campaigns SET status = 'PAUSED' WHERE status = 'RUNNING'`);
      isProcessing = false;
      setTimeout(processQueue, 10000); // Poll again in 10s
      return;
    }

    // 3. Fetch lead details for template parsing
    let leadData = {};
    if (job.lead_id) {
      const leadRes = await db.query(`SELECT * FROM leads WHERE id = $1`, [job.lead_id]);
      if (leadRes.rows.length > 0) leadData = leadRes.rows[0];
    }

    const parsedSubject = mailer.parseTemplate(job.subject, leadData);
    const parsedBody = mailer.parseTemplate(job.body_html, leadData);

    // 4. Send Email
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
      
      console.log(`[Queue] Sent email to ${job.target_email} via ${account.email}`);
    } catch (sendErr) {
      console.error(`[Queue] Error sending to ${job.target_email} via ${account.email}:`, sendErr.message);
      
      // If Gmail credentials or quota error, mark account so other accounts take over immediately
      if (sendErr.message.includes('Invalid login') || sendErr.message.includes('Username and Password not accepted') || sendErr.message.includes('BadCredentials')) {
        await db.query(`UPDATE email_accounts SET status = 'AUTH_ERROR' WHERE id = $1`, [account.id]);
        console.warn(`[Queue] Account ${account.email} marked as AUTH_ERROR. Switching to next account.`);
      } else if (sendErr.message.includes('quota') || sendErr.message.includes('limit exceeded') || sendErr.message.includes('Daily user sending quota')) {
        await db.query(`UPDATE email_accounts SET daily_sent_count = 400 WHERE id = $1`, [account.id]);
        console.warn(`[Queue] Account ${account.email} reached Gmail limit. Switched to next account.`);
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
      console.log(`Campaign ${job.campaign_id} Completed!`);
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
