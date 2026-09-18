const db = require('./db');

async function main() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS inbox_threads (
        id SERIAL PRIMARY KEY,
        account_id INT REFERENCES email_accounts(id) ON DELETE CASCADE,
        lead_email VARCHAR(255),
        lead_name VARCHAR(255),
        last_message_date TIMESTAMP,
        is_unread BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(account_id, lead_email)
      );

      CREATE TABLE IF NOT EXISTS inbox_messages (
        id SERIAL PRIMARY KEY,
        thread_id INT REFERENCES inbox_threads(id) ON DELETE CASCADE,
        message_id VARCHAR(255) UNIQUE,
        direction VARCHAR(50),
        sender_email VARCHAR(255),
        sender_name VARCHAR(255),
        recipient_email VARCHAR(255),
        subject TEXT,
        body_text TEXT,
        body_html TEXT,
        date TIMESTAMP,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Inbox tables verified successfully.");
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();
