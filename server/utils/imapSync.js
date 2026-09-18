const { ImapFlow } = require('imapflow');
const simpleParser = require('mailparser').simpleParser;
const db = require('../db');

async function syncAccountInbox(account) {
  console.log(`Starting sync for ${account.email}`);
  
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: account.email,
      pass: account.app_password
    },
    logger: false 
  });

  try {
    await client.connect();
    
    // Select INBOX
    let lock = await client.getMailboxLock('INBOX');
    try {
      const exists = client.mailbox.exists;
      if (exists === 0) {
        console.log(`Inbox is empty for ${account.email}`);
        return { success: true, count: 0 };
      }
      
      const startSeq = Math.max(1, exists - 50);
      const seqStr = `${startSeq}:*`;
      
      let syncedCount = 0;
      
      for await (let msg of client.fetch(seqStr, { envelope: true, source: true }, { uid: true })) {
        if (!msg.source) continue;
        
        const parsed = await simpleParser(msg.source);
        if (!parsed.from || !parsed.from.value || parsed.from.value.length === 0) continue;
        
        const sender = parsed.from.value[0];
        const senderEmail = sender.address;
        const senderName = sender.name || senderEmail;
        const messageId = parsed.messageId || `${msg.uid}-${account.email}`;
        
        // Check if message already exists
        const msgExists = await db.query('SELECT id FROM inbox_messages WHERE message_id = $1', [messageId]);
        if (msgExists.rowCount > 0) continue;
        
        // Check if this sender is a known lead or just any email
        // We will thread by senderEmail
        let threadRes = await db.query('SELECT id FROM inbox_threads WHERE account_id = $1 AND lead_email = $2', [account.id, senderEmail]);
        let threadId;
        
        if (threadRes.rowCount === 0) {
          const newThread = await db.query(
            `INSERT INTO inbox_threads (account_id, lead_email, lead_name, last_message_date, is_unread) 
             VALUES ($1, $2, $3, $4, true) RETURNING id`,
            [account.id, senderEmail, senderName, parsed.date || new Date()]
          );
          threadId = newThread.rows[0].id;
        } else {
          threadId = threadRes.rows[0].id;
          await db.query(`UPDATE inbox_threads SET last_message_date = $1, is_unread = true WHERE id = $2`, [parsed.date || new Date(), threadId]);
        }
        
        // Insert message
        await db.query(
          `INSERT INTO inbox_messages (thread_id, message_id, direction, sender_email, sender_name, recipient_email, subject, body_text, body_html, date, is_read) 
           VALUES ($1, $2, 'INBOUND', $3, $4, $5, $6, $7, $8, $9, false)`,
          [
            threadId, 
            messageId, 
            senderEmail, 
            senderName, 
            account.email, 
            parsed.subject || '', 
            parsed.text || '', 
            parsed.html || parsed.textAsHtml || parsed.text || '', 
            parsed.date || new Date()
          ]
        );
        syncedCount++;
      }
      console.log(`Synced ${syncedCount} new messages for ${account.email}`);
      return { success: true, count: syncedCount };
    } finally {
      lock.release();
    }
  } catch (err) {
    console.error(`Error syncing ${account.email}:`, err);
    return { success: false, error: err.message };
  } finally {
    try {
      await client.logout();
    } catch(e) {}
  }
}

async function syncAllAccounts() {
  const accountsRes = await db.query("SELECT * FROM email_accounts");
  let total = 0;
  for (let account of accountsRes.rows) {
    const res = await syncAccountInbox(account);
    if (res.success) total += res.count;
  }
  return total;
}

module.exports = {
  syncAccountInbox,
  syncAllAccounts
};
