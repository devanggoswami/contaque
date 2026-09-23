require('dotenv').config();
const { Client } = require('pg');

async function alterDb() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // 1. Email Accounts (SMTP configs)
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_accounts (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        app_password VARCHAR(255) NOT NULL,
        daily_sent_count INTEGER DEFAULT 0,
        last_reset_date DATE DEFAULT CURRENT_DATE,
        status VARCHAR(50) DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Created email_accounts table.");

    // 2. Campaigns
    await client.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        body_html TEXT NOT NULL,
        target_job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'DRAFT', -- DRAFT, RUNNING, PAUSED, COMPLETED
        total_leads INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sender_account_id INTEGER REFERENCES email_accounts(id) ON DELETE SET NULL
      );
    `);
    console.log("Created campaigns table.");

    // 3. Email Queue
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_queue (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
        lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
        target_email VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, SENT, FAILED
        error_msg TEXT,
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_campaign_lead UNIQUE (campaign_id, lead_id)
      );
    `);
    console.log("Created email_queue table.");

    // Create indexes for performance
    await client.query(`CREATE INDEX IF NOT EXISTS idx_queue_status ON email_queue(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_queue_campaign ON email_queue(campaign_id);`);

  } catch (err) {
    console.error("Error setting up campaign DB:", err.message);
  } finally {
    await client.end();
  }
}

alterDb();
