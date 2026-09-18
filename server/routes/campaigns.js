const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const mailer = require('../utils/mailer');
const { isValidEmailAddress } = require('../utils/email_extractor');

// Test direct sending with full diagnostics
router.post('/test-send', async (req, res) => {
  try {
    const { to_email } = req.body;
    const account = await mailer.getAvailableAccount();
    if (!account) return res.status(400).json({ error: 'No active email account found' });
    
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

// Reset failed campaigns and queue
router.post('/reset-failed', async (req, res) => {
  try {
    const qRes = await db.query(`UPDATE email_queue SET status = 'PENDING', error_msg = NULL WHERE status = 'FAILED'`);
    const cRes = await db.query(`UPDATE campaigns SET status = 'RUNNING', sent_count = 0, failed_count = 0 WHERE status = 'COMPLETED' AND sent_count = 0`);
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

// Auto ensure completed_at column exists in campaigns table
db.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;`).catch(() => {});

// --- EMAIL ACCOUNTS ---

router.get('/accounts', async (req, res) => {
  try {
    const result = await db.query('SELECT id, email, daily_sent_count, status, created_at FROM email_accounts ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/accounts', async (req, res) => {
  const { email, app_password } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO email_accounts (email, app_password) VALUES ($1, $2) RETURNING id, email`,
      [email, app_password]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/accounts/:id', async (req, res) => {
  try {
    await db.query(`DELETE FROM email_accounts WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- CAMPAIGNS ---

router.get('/list', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT * 
      FROM campaigns 
      ORDER BY created_at DESC
    `);
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
      // 1. Find leads with valid emails for this job
      let leadsQuery = `SELECT id, emails FROM leads WHERE emails IS NOT NULL AND emails != '-' AND emails != 'None'`;
      let queryParams = [];
      
      if (target_mode === 'SPECIFIC' && Array.isArray(target_job_ids) && target_job_ids.length > 0) {
        leadsQuery += ` AND job_id = ANY($1::int[])`;
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

    // 2. Create Campaign
    const campRes = await db.query(
      `INSERT INTO campaigns (name, subject, body_html, target_job_id, total_leads, status, attachment_path, attachment_type, image_link, is_manual) 
       VALUES ($1, $2, $3, $4, $5, 'DRAFT', $6, $7, $8, $9) RETURNING id`,
      [name, subject, body_html || '', finalTargetJobId, validLeads.length, attachment_filename || null, attachment_type || null, image_link || null, isManual]
    );
    const campaignId = campRes.rows[0].id;

    // 3. Queue Emails (Valid business emails only)
    for (const lead of validLeads) {
      // Split if multiple emails comma separated, take first
      const primaryEmail = lead.emails.split(',')[0].trim();
      if (primaryEmail && isValidEmailAddress(primaryEmail)) {
        if (isManual) {
          // No lead_id, insert directly
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
    await db.query(`UPDATE campaigns SET status = $1 WHERE id = $2`, [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    // Delete queue items first (foreign key)
    await db.query(`DELETE FROM email_queue WHERE campaign_id = $1`, [req.params.id]);
    // Then delete the campaign
    await db.query(`DELETE FROM campaigns WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
