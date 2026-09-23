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

// Get the next available account that hasn't hit the daily limit (scoped to userId and plan entitlement)
// Get the next available account that hasn't hit the daily limit (scoped to userId and plan entitlement)
const getAvailableAccount = async (userId = null, dbRunner = db) => {
  // First, reset counts if the day has rolled over
  await dbRunner.query(`
    UPDATE email_accounts 
    SET daily_sent_count = 0, last_reset_date = CURRENT_DATE 
    WHERE last_reset_date < CURRENT_DATE
  `);

  if (!userId) {
    let sql = `SELECT * FROM email_accounts WHERE status = 'ACTIVE' AND daily_sent_count < 400 ORDER BY daily_sent_count ASC LIMIT 1`;
    const res = await dbRunner.query(sql);
    return res.rows.length > 0 ? res.rows[0] : null;
  }

  // Authoritative Server-Side User Entitlement Check
  const { getUserPlanEntitlement } = require('./plans');
  const entitlement = await getUserPlanEntitlement(userId, dbRunner);

  // If plan is Free, expired, or campaigns disabled -> cannot send
  if (!entitlement.emailCampaignsEnabled || entitlement.dailyEmailLimit <= 0 || entitlement.maxAccounts <= 0) {
    console.log(`[Mailer] User ${userId} (${entitlement.planName}) has email campaigns disabled or expired.`);
    return null;
  }

  // Check total emails sent by user across allowed accounts today
  const totalSentRes = await dbRunner.query(
    `WITH allowed_accounts AS (
      SELECT daily_sent_count
      FROM email_accounts
      WHERE user_id = $1 AND status = 'ACTIVE'
      ORDER BY id ASC
      LIMIT $2
    )
    SELECT COALESCE(SUM(daily_sent_count), 0)::int as total_sent FROM allowed_accounts`,
    [userId, entitlement.maxAccounts]
  );
  const totalSentToday = parseInt(totalSentRes.rows[0]?.total_sent || 0, 10);

  if (totalSentToday >= entitlement.dailyEmailLimit) {
    console.log(`[Mailer] User ${userId} reached daily limit (${totalSentToday}/${entitlement.dailyEmailLimit}).`);
    return null;
  }

  // Select only among allowed accounts up to maxAccounts (respecting plan downgrades safely)
  const sql = `
    WITH allowed_accounts AS (
      SELECT id, email, app_password, status, daily_sent_count, user_id
      FROM email_accounts
      WHERE user_id = $1 AND status = 'ACTIVE'
      ORDER BY id ASC
      LIMIT $2
    )
    SELECT * FROM allowed_accounts
    WHERE daily_sent_count < 400
    ORDER BY daily_sent_count ASC
    LIMIT 1
  `;

  const res = await dbRunner.query(sql, [userId, entitlement.maxAccounts]);
  if (res.rows.length === 0) return null;
  return res.rows[0];
};

// Send server-side verification email with unique crypto token
const sendVerificationEmail = async ({ toEmail, name, token, origin }) => {
  const baseUrl = (origin || process.env.APP_URL || 'https://contaques.pro').replace(/\/+$/, '');
  const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;

  const subject = 'Confirm your ContaQue account email';
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; background-color: #0f1117; color: #f3f4f6; border-radius: 12px; border: 1px solid #222632;">
      <div style="text-align: center; margin-bottom: 28px;">
        <h2 style="font-size: 24px; font-weight: 700; color: #ffffff; margin: 0 0 8px 0; letter-spacing: -0.5px;">ContaQue</h2>
        <p style="color: #9ca3af; font-size: 14px; margin: 0;">Multi-Engine B2B Lead Generation & Outreach</p>
      </div>

      <div style="background-color: #181b24; border: 1px solid #282d3d; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
        <h3 style="font-size: 18px; color: #ffffff; margin: 0 0 12px 0;">Verify your email address</h3>
        <p style="font-size: 14px; line-height: 1.6; color: #d1d5db; margin: 0 0 20px 0;">
          Hi ${name || 'there'},<br><br>
          Thank you for signing up for ContaQue. Please click the button below to verify your email address and activate your account.
        </p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${verifyUrl}" style="background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
            Confirm Email Address
          </a>
        </div>

        <p style="font-size: 12px; line-height: 1.5; color: #9ca3af; margin: 20px 0 0 0;">
          This verification link will expire in <strong>24 hours</strong>. If you did not create an account on ContaQue, you can safely ignore this email.
        </p>
      </div>

      <div style="border-top: 1px solid #222632; padding-top: 16px; font-size: 12px; color: #6b7280; text-align: center;">
        <p style="margin: 0 0 8px 0;">Or copy and paste this link in your browser:</p>
        <p style="word-break: break-all; color: #818cf8; margin: 0;"><a href="${verifyUrl}" style="color: #818cf8;">${verifyUrl}</a></p>
      </div>
    </div>
  `;

  // 1. Try Brevo HTTP API
  const brevoKey = (process.env.BREVO_API_KEY || '').trim();
  if (brevoKey) {
    try {
      const fromEmail = process.env.SYSTEM_FROM_EMAIL || 'noreply@contaques.pro';
      const fromName = 'ContaQue Security';
      await sendViaBrevo(fromEmail, fromName, toEmail, subject, htmlBody);
      return { success: true, method: 'brevo', verifyUrl };
    } catch (bErr) {
      console.warn('[Mailer:Brevo] Verification email delivery warning:', bErr.message);
    }
  }

  // 2. Try connected system email account
  try {
    const acctRes = await db.query(`SELECT * FROM email_accounts WHERE status = 'ACTIVE' LIMIT 1`);
    if (acctRes.rows.length > 0) {
      const acct = acctRes.rows[0];
      await sendViaGmailSMTP(acct, toEmail, subject, htmlBody);
      return { success: true, method: 'smtp', verifyUrl };
    }
  } catch (sErr) {
    console.warn('[Mailer:SMTP] Verification email delivery warning:', sErr.message);
  }

  // 3. Fallback / Dev Log
  console.log(`[Verification Email Link Generated] To: ${toEmail} | Link: ${verifyUrl}`);
  return { success: true, method: 'logged', verifyUrl };
};

// Hardcoded support recipient address
const SUPPORT_DESTINATION_EMAIL = 'klyrovainfotech@gmail.com';

// Send Support Request Email to klyrovainfotech@gmail.com
const sendSupportTicketEmail = async ({ firstName, lastName, email, countryCode, phone, category, description }) => {
  const cleanFirstName = (firstName || '').trim();
  const cleanLastName = (lastName || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanCategory = (category || 'General').trim();
  const cleanDescription = (description || '').trim();
  const phoneText = phone && phone.trim() ? `${countryCode ? countryCode.trim() + ' ' : ''}${phone.trim()}` : 'Not provided';

  const subject = `[Support Request] ${cleanCategory} - ${cleanFirstName} ${cleanLastName}`;

  const textBody = [
    'Support Request',
    '',
    `Name: ${cleanFirstName} ${cleanLastName}`,
    `Email: ${cleanEmail}`,
    `Phone: ${phoneText}`,
    `Category: ${cleanCategory}`,
    '',
    'Description:',
    cleanDescription,
    '',
    'Submitted from: Dashboard Help & Support'
  ].join('\n');

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; background: #ffffff; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 12px;">
      <div style="border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px;">
        <h2 style="margin: 0 0 6px 0; color: #10367d; font-size: 22px;">Support Request</h2>
        <span style="display: inline-block; background: #eff6ff; color: #2563eb; font-weight: 600; font-size: 12px; padding: 4px 10px; border-radius: 20px; border: 1px solid #bfdbfe;">
          Category: ${cleanCategory}
        </span>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="padding: 8px 0; width: 110px; font-weight: 600; color: #64748b; font-size: 13px;">Name:</td>
          <td style="padding: 8px 0; font-weight: 600; color: #0f172a; font-size: 14px;">${cleanFirstName} ${cleanLastName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #64748b; font-size: 13px;">Email:</td>
          <td style="padding: 8px 0; font-size: 14px;"><a href="mailto:${cleanEmail}" style="color: #2563eb; text-decoration: none;">${cleanEmail}</a></td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #64748b; font-size: 13px;">Phone:</td>
          <td style="padding: 8px 0; font-size: 14px; color: #0f172a;">${phoneText}</td>
        </tr>
      </table>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
        <h4 style="margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569;">Description:</h4>
        <div style="font-size: 14px; line-height: 1.6; color: #1e293b; white-space: pre-wrap;">${cleanDescription.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      </div>

      <div style="border-top: 1px solid #f1f5f9; padding-top: 14px; font-size: 12px; color: #94a3b8; display: flex; justify-content: space-between;">
        <span>Submitted from: <strong>Dashboard Help & Support</strong></span>
        <span>${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span>
      </div>
    </div>
  `;

  let deliveryError = null;

  // 1. First attempt: Brevo API if available
  const brevoKey = (process.env.BREVO_API_KEY || '').trim();
  if (brevoKey) {
    try {
      const fromEmail = process.env.SYSTEM_FROM_EMAIL || 'klyrovainfotech@gmail.com';
      const fromName = `${cleanFirstName} ${cleanLastName} (ContaQue Support)`;
      const deliveryResult = await sendViaBrevo(fromEmail, fromName, SUPPORT_DESTINATION_EMAIL, subject, htmlBody);
      console.log(`[Support Ticket] Email delivered to ${SUPPORT_DESTINATION_EMAIL} via Brevo`);
      return { success: true, method: 'brevo', messageId: deliveryResult.messageId };
    } catch (bErr) {
      console.warn('[Support Ticket] Brevo delivery failed, attempting SMTP fallback:', bErr.message);
      deliveryError = bErr;
    }
  }

  // 2. Second attempt: Gmail SMTP via connected system email accounts in PostgreSQL
  try {
    const acctRes = await db.query(
      `SELECT * FROM email_accounts 
       WHERE status = 'ACTIVE' 
       ORDER BY (email = 'klyrovainfotech@gmail.com') DESC, id ASC 
       LIMIT 1`
    );

    if (acctRes.rows.length > 0) {
      const acct = acctRes.rows[0];
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: acct.email.trim(),
          pass: acct.app_password.replace(/\s+/g, '')
        }
      });

      const mailOptions = {
        from: `"${cleanFirstName} ${cleanLastName} via ContaQue" <${acct.email.trim()}>`,
        to: SUPPORT_DESTINATION_EMAIL,
        replyTo: cleanEmail,
        subject: subject,
        text: textBody,
        html: htmlBody
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`[Support Ticket] Email delivered to ${SUPPORT_DESTINATION_EMAIL} via Gmail SMTP (${acct.email}) | ID: ${info.messageId}`);
      return { success: true, method: 'smtp', messageId: info.messageId };
    }
  } catch (smtpErr) {
    console.error('[Support Ticket] Gmail SMTP delivery failed:', smtpErr.message);
    deliveryError = smtpErr;
  }

  // If both failed, throw error to avoid pretending delivery succeeded
  throw new Error(deliveryError ? deliveryError.message : 'No email delivery method available.');
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendSupportTicketEmail,
  parseTemplate,
  getAvailableAccount
};


