const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const mailer = require('../utils/mailer');
const { isValidEmailAddress } = require('../utils/email_extractor');
const { requireAuth } = require('../utils/auth');
const { getUserPlanEntitlement } = require('../utils/plans');

// Enforce strict authentication on all campaign endpoints
router.use(requireAuth);

// Test direct sending with full diagnostics (scoped to user's accounts)
router.post('/test-send', async (req, res) => {
  try {
    const { to_email } = req.body;
    const account = await mailer.getAvailableAccount(req.user.id);
    if (!account) return res.status(400).json({ error: 'No active email account found for your user. Please connect an email account first.' });
    
    const info = await mailer.sendEmail(
      account, 
      to_email || 'madmandg17@gmail.com', 
      'Lead OS Direct Verification Test', 
      '<p>Hello! This confirms that your Lead OS Gmail SMTP connection is working perfectly.</p>'
    );
    res.json({ success: true, messageId: info.messageId, sender: account.email });
  } catch (err) {
    console.error('[Diagnostic Test Send Error]', err);
    res.status(500).json({ 
      error: err.message, 
      code: err.code, 
      command: err.command, 
      errno: err.errno,
      syscall: err.syscall,
      address: err.address,
      port: err.port
    });
  }
});

// Reset failed campaigns and queue (scoped to user)
router.post('/reset-failed', async (req, res) => {
  try {
    const qRes = await db.query(`
      UPDATE email_queue 
      SET status = 'PENDING', error_msg = NULL 
      WHERE status = 'FAILED' 
        AND campaign_id IN (SELECT id FROM campaigns WHERE user_id = $1)
    `, [req.user.id]);

    const cRes = await db.query(`
      UPDATE campaigns 
      SET status = 'RUNNING', sent_count = 0, failed_count = 0 
      WHERE status = 'COMPLETED' AND sent_count = 0 AND user_id = $1
    `, [req.user.id]);

    res.json({ reset_queue_count: qRes.rowCount, reset_campaigns_count: cRes.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads/')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});
const upload = multer({ storage });

// --- EMAIL ACCOUNTS & PLAN ENTITLEMENTS (User-Scoped) ---

// Authoritative user entitlement and quota status
router.get('/limits', async (req, res) => {
  try {
    const entitlement = await getUserPlanEntitlement(req.user.id);
    
    // Count existing accounts
    const countRes = await db.query(
      'SELECT COUNT(*)::int as count FROM email_accounts WHERE user_id = $1',
      [req.user.id]
    );
    const accountCount = parseInt(countRes.rows[0]?.count || 0, 10);

    // Sum daily sent today across user's allowed active accounts
    const sentRes = await db.query(
      `WITH allowed_accounts AS (
        SELECT daily_sent_count
        FROM email_accounts
        WHERE user_id = $1 AND status = 'ACTIVE'
        ORDER BY id ASC
        LIMIT $2
      )
      SELECT COALESCE(SUM(daily_sent_count), 0)::int as total_sent FROM allowed_accounts`,
      [req.user.id, entitlement.maxAccounts]
    );
    const dailySentToday = parseInt(sentRes.rows[0]?.total_sent || 0, 10);

    const canAddAccount = entitlement.emailCampaignsEnabled && accountCount < entitlement.maxAccounts;
    const accountLimitReached = accountCount >= entitlement.maxAccounts;
    const dailyLimitReached = dailySentToday >= entitlement.dailyEmailLimit;

    return res.json({
      plan: entitlement.plan,
      planName: entitlement.planName,
      isExpired: entitlement.isExpired,
      emailCampaignsEnabled: entitlement.emailCampaignsEnabled,
      maxAccounts: entitlement.maxAccounts,
      currentAccountCount: accountCount,
      canAddAccount,
      accountLimitReached,
      dailyEmailLimit: entitlement.dailyEmailLimit,
      dailySentToday,
      dailyLimitReached,
      entitlementLabel: entitlement.entitlementLabel,
      usageLabel: `${dailySentToday.toLocaleString()} / ${entitlement.dailyEmailLimit.toLocaleString()} emails used today`
    });
  } catch (err) {
    console.error('[GET /api/campaigns/limits error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/accounts', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, email, daily_sent_count, status, created_at FROM email_accounts WHERE user_id = $1 ORDER BY id DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/accounts', async (req, res) => {
  const { email, app_password } = req.body;
  if (!email || !app_password) {
    return res.status(400).json({ error: 'Email and app password are required' });
  }

  try {
    // 1. Authoritative Server-Side Plan Entitlement Check
    const entitlement = await getUserPlanEntitlement(req.user.id);

    if (!entitlement.emailCampaignsEnabled || entitlement.maxAccounts <= 0) {
      return res.status(403).json({ 
        error: 'Email campaigns and Gmail sending accounts are not included in your current plan. Please upgrade to Value Plus (1 account · 400 emails/day) or Value Pack (4 accounts · 1,600 emails/day).' 
      });
    }

    // 2. Count existing accounts for user
    const countRes = await db.query(
      'SELECT COUNT(*)::int as count FROM email_accounts WHERE user_id = $1',
      [req.user.id]
    );
    const currentCount = parseInt(countRes.rows[0]?.count || 0, 10);

    if (currentCount >= entitlement.maxAccounts) {
      return res.status(403).json({ 
        error: `You've reached the Gmail account limit for your current plan (${entitlement.planName} allows maximum ${entitlement.maxAccounts} account${entitlement.maxAccounts > 1 ? 's' : ''}). Please upgrade to add more accounts.` 
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = app_password.trim();

    // Check duplicate account for this user
    const dupCheck = await db.query(
      'SELECT id FROM email_accounts WHERE LOWER(email) = $1 AND user_id = $2',
      [cleanEmail, req.user.id]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(400).json({ error: 'This Gmail account is already added to your sending accounts.' });
    }

    const result = await db.query(
      `INSERT INTO email_accounts (email, app_password, user_id) VALUES ($1, $2, $3) RETURNING id, email, status, daily_sent_count`,
      [cleanEmail, cleanPass, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /api/campaigns/accounts error]:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/accounts/:id', async (req, res) => {
  try {
    const delRes = await db.query(
      `DELETE FROM email_accounts WHERE id = $1 AND user_id = $2 RETURNING id`, 
      [req.params.id, req.user.id]
    );
    if (delRes.rowCount === 0) {
      return res.status(404).json({ error: 'Email account not found or access denied' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- CAMPAIGNS (User-Scoped) ---

router.get('/list', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT * 
      FROM campaigns 
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/upload', upload.single('attachment'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const isImage = req.file.mimetype.startsWith('image/');
  res.json({ 
    success: true, 
    filename: req.file.filename,
    type: isImage ? 'image' : 'pdf'
  });
});

router.post('/create', async (req, res) => {
  const { name, subject, body_html, target_mode, target_job_ids, manual_emails, attachment_filename, attachment_type, image_link } = req.body;
  
  try {
    // Authoritative Server-Side Plan Check
    const entitlement = await getUserPlanEntitlement(req.user.id);
    if (!entitlement.emailCampaignsEnabled) {
      return res.status(403).json({ 
        error: 'Email campaigns are not included in your current plan. Please upgrade to Value Plus (400 emails/day) or Value Pack (1,600 emails/day) to launch campaigns.' 
      });
    }

    await db.query('BEGIN');
    
    let validLeads = [];
    let isManual = false;
    let finalTargetJobId = null;

    if (target_mode === 'MANUAL' && manual_emails) {
      isManual = true;
      // Parse comma separated manual emails
      const emailsList = manual_emails.split(',').map(e => e.trim()).filter(e => e);
      if (emailsList.length === 0) {
         await db.query('ROLLBACK');
         return res.status(400).json({ error: 'No valid manual emails provided.' });
      }
      // Create mock validLeads objects so the loop below works the same way
      validLeads = emailsList.map(email => ({ id: null, emails: email }));
    } else {
      // 1. Find leads with valid emails, strictly isolated to req.user.id
      let leadsQuery = `
        SELECT l.id, l.emails 
        FROM leads l
        WHERE l.emails IS NOT NULL AND l.emails != '-' AND l.emails != 'None'
          AND l.user_id = $1
      `;
      let queryParams = [req.user.id];
      
      if (target_mode === 'SPECIFIC' && Array.isArray(target_job_ids) && target_job_ids.length > 0) {
        leadsQuery += ` AND l.job_id = ANY($2::int[]) AND l.job_id IN (SELECT id FROM jobs WHERE user_id = $1)`;
        queryParams.push(target_job_ids);
        finalTargetJobId = target_job_ids.join(',');
      }
      
      const leadsRes = await db.query(leadsQuery, queryParams);
      validLeads = leadsRes.rows;
    }

    if (validLeads.length === 0) {
      await db.query('ROLLBACK');
      return res.status(400).json({ error: 'No leads with valid emails found for this selection.' });
    }

    // 2. Create Campaign (strictly assigned to req.user.id)
    const campRes = await db.query(
      `INSERT INTO campaigns (name, subject, body_html, target_job_id, total_leads, status, attachment_path, attachment_type, image_link, is_manual, user_id) 
       VALUES ($1, $2, $3, $4, $5, 'DRAFT', $6, $7, $8, $9, $10) RETURNING id`,
      [name, subject, body_html || '', finalTargetJobId, validLeads.length, attachment_filename || null, attachment_type || null, image_link || null, isManual, req.user.id]
    );
    const campaignId = campRes.rows[0].id;

    // 3. Queue Emails (Valid business emails only)
    for (const lead of validLeads) {
      const primaryEmail = lead.emails.split(',')[0].trim();
      if (primaryEmail && isValidEmailAddress(primaryEmail)) {
        if (isManual) {
          await db.query(
            `INSERT INTO email_queue (campaign_id, target_email) VALUES ($1, $2)`,
            [campaignId, primaryEmail]
          );
        } else {
          await db.query(
            `INSERT INTO email_queue (campaign_id, lead_id, target_email) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [campaignId, lead.id, primaryEmail]
          );
        }
      }
    }

    await db.query('COMMIT');
    res.json({ success: true, campaignId, queuedCount: validLeads.length });
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/status', async (req, res) => {
  const { status } = req.body; // 'RUNNING', 'PAUSED'
  try {
    if (status === 'RUNNING') {
      const entitlement = await getUserPlanEntitlement(req.user.id);
      if (!entitlement.emailCampaignsEnabled) {
        return res.status(403).json({ 
          error: 'Your current plan does not allow running email campaigns. Please upgrade to Value Plus or Value Pack.' 
        });
      }
    }

    const updateRes = await db.query(
      `UPDATE campaigns SET status = $1 WHERE id = $2 AND user_id = $3 RETURNING id`, 
      [status, req.params.id, req.user.id]
    );
    if (updateRes.rowCount === 0) {
      return res.status(404).json({ error: 'Campaign not found or access denied' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    // Verify ownership first
    const campCheck = await db.query(
      `SELECT id FROM campaigns WHERE id = $1 AND user_id = $2`, 
      [req.params.id, req.user.id]
    );
    if (campCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found or access denied' });
    }

    // Delete queue items first (foreign key)
    await db.query(`DELETE FROM email_queue WHERE campaign_id = $1`, [req.params.id]);
    // Then delete the campaign
    await db.query(`DELETE FROM campaigns WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
