const express = require('express');
const router = express.Router();
const db = require('../db');
const { syncAllAccounts } = require('../utils/imapSync');
const { requireAuth } = require('../utils/auth');

// Enforce strict authentication on all inbox endpoints
router.use(requireAuth);

const sendReplyEmail = async (fromEmail, appPassword, toEmail, subject, text, html, inReplyTo) => {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: fromEmail.trim(), pass: appPassword.replace(/\s+/g, '') }
  });

  const mailOptions = {
    from: `"${fromEmail.split('@')[0]}" <${fromEmail.trim()}>`,
    to: toEmail,
    subject: subject,
    text: text,
    html: html || text,
  };
  if (inReplyTo) {
    mailOptions.inReplyTo = inReplyTo;
    mailOptions.references = inReplyTo;
  }

  return await transporter.sendMail(mailOptions);
};

// GET /api/inbox/threads - Isolated to user
router.get('/threads', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT t.*, e.email as account_email,
        (SELECT subject FROM inbox_messages m WHERE m.thread_id = t.id ORDER BY date DESC LIMIT 1) as latest_subject,
        (SELECT LEFT(body_text, 100) FROM inbox_messages m WHERE m.thread_id = t.id ORDER BY date DESC LIMIT 1) as snippet
      FROM inbox_threads t
      JOIN email_accounts e ON t.account_id = e.id
      WHERE (t.user_id = $1 OR e.user_id = $1)
      ORDER BY t.last_message_date DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inbox/threads/:id - Isolated thread messages
router.get('/threads/:id', async (req, res) => {
  try {
    const threadId = req.params.id;

    // Verify ownership
    const threadCheck = await db.query(`
      SELECT t.id FROM inbox_threads t 
      JOIN email_accounts e ON t.account_id = e.id 
      WHERE t.id = $1 AND (t.user_id = $2 OR e.user_id = $2)
    `, [threadId, req.user.id]);

    if (threadCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Thread not found or access denied' });
    }

    await db.query(`UPDATE inbox_threads SET is_unread = false WHERE id = $1`, [threadId]);
    await db.query(`UPDATE inbox_messages SET is_read = true WHERE thread_id = $1`, [threadId]);

    const result = await db.query(`
      SELECT * FROM inbox_messages 
      WHERE thread_id = $1 
      ORDER BY date ASC
    `, [threadId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inbox/sync - Sync only authenticated user's email accounts
router.post('/sync', async (req, res) => {
  try {
    const count = await syncAllAccounts(req.user.id);
    res.json({ message: `Synced ${count} new emails.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inbox/reply - Reply from authenticated user's account
router.post('/reply', async (req, res) => {
  const { thread_id, text, html } = req.body;
  try {
    const threadRes = await db.query(`
      SELECT t.*, e.email as account_email, e.app_password 
      FROM inbox_threads t 
      JOIN email_accounts e ON t.account_id = e.id 
      WHERE t.id = $1 AND (t.user_id = $2 OR e.user_id = $2)`, 
      [thread_id, req.user.id]
    );
      
    if (threadRes.rowCount === 0) return res.status(404).json({ error: 'Thread not found or access denied' });
    
    const thread = threadRes.rows[0];
    
    const lastMsgRes = await db.query(
      `SELECT message_id, subject FROM inbox_messages WHERE thread_id = $1 AND direction = 'INBOUND' ORDER BY date DESC LIMIT 1`, 
      [thread_id]
    );
    
    let subject = "Reply";
    let inReplyTo = null;
    if (lastMsgRes.rowCount > 0) {
      const lastMsg = lastMsgRes.rows[0];
      subject = lastMsg.subject.startsWith('Re:') ? lastMsg.subject : `Re: ${lastMsg.subject}`;
      inReplyTo = lastMsg.message_id;
    }
    
    const info = await sendReplyEmail(
      thread.account_email.trim(), 
      thread.app_password, 
      thread.lead_email.trim(), 
      subject, text, html, inReplyTo
    );
    
    // Save outbound message
    await db.query(
      `INSERT INTO inbox_messages (thread_id, message_id, direction, sender_email, sender_name, recipient_email, subject, body_text, body_html, date, is_read) 
       VALUES ($1, $2, 'OUTBOUND', $3, $4, $5, $6, $7, $8, NOW(), true)`,
      [
        thread.id, 
        info.messageId || Date.now().toString(), 
        thread.account_email, 
        'Me', 
        thread.lead_email, 
        subject, 
        text, 
        html || text
      ]
    );
    
    await db.query(`UPDATE inbox_threads SET last_message_date = NOW() WHERE id = $1`, [thread.id]);
    
    res.json({ message: 'Reply sent successfully', messageId: info.messageId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
