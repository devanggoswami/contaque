const nodemailer = require('nodemailer');
const db = require('../db');
const path = require('path');
const fs = require('fs');

// ============================================================
// BREVO HTTP API EMAIL SENDER (Works on ALL cloud platforms)
// Uses HTTPS port 443 - never blocked by Render/Railway/Fly.io
// ============================================================

// Send email via Brevo HTTP API (port 443 HTTPS - cloud safe)
const sendViaBrevo = async (fromEmail, fromName, toEmail, subject, htmlBody, attachments = []) => {
  const brevoKey = (process.env.BREVO_API_KEY || '').trim();
  if (!brevoKey) {
    throw new Error('BREVO_API_KEY not configured in environment variables');
  }
  
  // Brevo API requires non-empty htmlContent
  const safeHtmlBody = (htmlBody && htmlBody.trim()) ? htmlBody : `<p>${subject || 'No Content'}</p>`;

  const payload = {
    sender: { name: fromName, email: fromEmail },
    to: [{ email: toEmail.trim() }],
    subject: subject || 'No Subject',
    htmlContent: safeHtmlBody
  };

  // Handle attachments for Brevo (base64 encoded)
  if (attachments.length > 0) {
    payload.attachment = [];
    for (const att of attachments) {
      if (att.path && fs.existsSync(att.path)) {
        const content = fs.readFileSync(att.path).toString('base64');
        payload.attachment.push({
          name: att.filename || 'attachment',
          content: content
        });
      }
    }
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': brevoKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Brevo API error: ${data.message || JSON.stringify(data)}`);
  }

  console.log(`[Mailer:Brevo] Email sent to ${toEmail} via HTTPS API | MessageId: ${data.messageId || 'OK'}`);
  return { messageId: data.messageId || `brevo-${Date.now()}`, response: 'Sent via Brevo' };
};

// Send email via Gmail SMTP directly (only works on local dev / paid hosting)
const sendViaGmailSMTP = async (account, toEmail, subject, htmlBody, mailAttachments = []) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: account.email.trim(),
      pass: account.app_password.replace(/\s+/g, '')
    }
  });

  const mailOptions = {
    from: `"${account.email.split('@')[0]}" <${account.email.trim()}>`,
    to: toEmail.trim(),
    subject: subject,
    html: htmlBody
  };

  if (mailAttachments.length > 0) {
    mailOptions.attachments = mailAttachments;
  }

  return await transporter.sendMail(mailOptions);
};

// ============================================================
// MAIN SEND EMAIL FUNCTION
// Auto-detects: Brevo API (cloud) -> Gmail SMTP (local fallback)
// ============================================================
const sendEmail = async (account, toEmail, subject, htmlBody, attachmentConfig = {}) => {
  const cleanEmail = account.email.trim();
  const senderName = cleanEmail.split('@')[0];

  // Build attachment list
  let nodemailerAttachments = [];
  let finalHtmlBody = htmlBody;

  if (attachmentConfig.attachment_path) {
    const fullPath = path.join(__dirname, '../uploads/', attachmentConfig.attachment_path);

    if (attachmentConfig.attachment_type === 'image') {
      const cid = 'image_' + Date.now() + '@leados';

      nodemailerAttachments = [{
        filename: attachmentConfig.attachment_path,
        path: fullPath,
        cid: cid
      }];

      let imgTag = `<img src="cid:${cid}" style="max-width:100%; height:auto; margin-top:20px;" />`;
      if (attachmentConfig.image_link) {
        imgTag = `<a href="${attachmentConfig.image_link}">${imgTag}</a>`;
      }
      finalHtmlBody = htmlBody + '<br/>' + imgTag;
    } else {
      nodemailerAttachments = [{
        filename: attachmentConfig.attachment_path,
        path: fullPath
      }];
    }
  }

  // Direct Gmail SMTP (Works 100% locally with Gmail App Password)
  try {
    console.log(`[Mailer] Sending via Gmail SMTP to ${toEmail}...`);
    return await sendViaGmailSMTP(account, toEmail, subject, finalHtmlBody, nodemailerAttachments);
  } catch (smtpErr) {
    console.error(`[Mailer] Gmail SMTP failed: ${smtpErr.message}`);
    throw smtpErr;
  }
};

// Replace variables like {{Name}} with lead data
const parseTemplate = (template, lead) => {
  let parsed = template;
  parsed = parsed.replace(/{{Business Name}}/gi, lead.name || 'there');
  parsed = parsed.replace(/{{Category}}/gi, lead.category || '');
  parsed = parsed.replace(/{{Website}}/gi, lead.website && lead.website !== '-' ? lead.website : '');
  parsed = parsed.replace(/{{Address}}/gi, lead.address || '');
  return parsed;
};

// Get the next available account that hasn't hit the daily limit
const getAvailableAccount = async () => {
  // First, reset counts if the day has rolled over
  await db.query(`
    UPDATE email_accounts 
    SET daily_sent_count = 0, last_reset_date = CURRENT_DATE 
    WHERE last_reset_date < CURRENT_DATE
  `);

  // Max 400 per account just to be safe (Gmail limit is 500)
  const res = await db.query(`
    SELECT * FROM email_accounts 
    WHERE status = 'ACTIVE' AND daily_sent_count < 400 
    ORDER BY daily_sent_count ASC 
    LIMIT 1
  `);
  
  if (res.rows.length === 0) return null;
  return res.rows[0];
};

module.exports = {
  sendEmail,
  parseTemplate,
  getAvailableAccount
};
