const { Pool } = require('pg');
require('dotenv').config({ path: __dirname + '/.env' });

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/leados';
const isNeon = connectionString && (connectionString.includes('neon.tech') || connectionString.includes('sslmode=require'));

const pool = new Pool({
  connectionString,
  ssl: isNeon ? { rejectUnauthorized: false } : false,
  max: 50,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 0, // Never prematurely abort queued queries under load
});

// Auto-initialize schema on Postgres database
const initDb = async () => {
  try {
    const client = await pool.connect();
    console.log(`[PostgreSQL ${isNeon ? 'Neon Cloud' : 'Localhost'}] Connected successfully.`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        country VARCHAR(100),
        auth_provider VARCHAR(50) DEFAULT 'local',
        email_verified BOOLEAN DEFAULT false,
        plan VARCHAR(50) DEFAULT 'free',
        billing_details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS jobs (
        id SERIAL PRIMARY KEY,
        keyword VARCHAR(255),
        location VARCHAR(255),
        requested_count INTEGER,
        fetched_count INTEGER DEFAULT 0,
        source VARCHAR(50),
        status VARCHAR(50) DEFAULT 'IN_PROGRESS',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
        place_id VARCHAR(255),
        name VARCHAR(255),
        address TEXT,
        phone VARCHAR(100),
        website TEXT,
        category VARCHAR(255),
        source_link TEXT,
        emails TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_job_place UNIQUE (job_id, place_id)
      );

      CREATE TABLE IF NOT EXISTS email_accounts (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        app_password VARCHAR(255) NOT NULL,
        daily_sent_count INTEGER DEFAULT 0,
        last_reset_date DATE DEFAULT CURRENT_DATE,
        status VARCHAR(50) DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS campaigns (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        body_html TEXT,
        target_job_id TEXT,
        status VARCHAR(50) DEFAULT 'DRAFT',
        total_leads INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        attachment_path TEXT,
        attachment_type VARCHAR(50),
        image_link TEXT,
        is_manual BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS email_queue (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
        lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
        target_email VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'PENDING',
        error_msg TEXT,
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

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

      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS requested_count INTEGER;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS target_count INTEGER;
      ALTER TABLE jobs ALTER COLUMN target_count DROP NOT NULL;
      ALTER TABLE jobs ALTER COLUMN requested_count DROP NOT NULL;
      ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
      ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS target_job_id TEXT;
      ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT FALSE;
      ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(50);
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_link TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS emails TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS instagram TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS facebook TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS youtube TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS linkedin TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS mobile TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS twitter TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS tiktok TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS pinterest TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS telegram TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS max_messenger TEXT;

      -- Prepaid Wallet & Billing Schema
      ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(12, 2) DEFAULT 0.00;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_wallet_balance_positive') THEN
          ALTER TABLE users ADD CONSTRAINT chk_wallet_balance_positive CHECK (wallet_balance >= 0);
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS wallet_ledger (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount NUMERIC(12, 2) NOT NULL,
        balance_after NUMERIC(12, 2) NOT NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('CREDIT', 'DEBIT', 'REFUND')),
        reason VARCHAR(255) NOT NULL,
        reference_id VARCHAR(255),
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key VARCHAR(255) PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        action VARCHAR(50) NOT NULL,
        response_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rate_per_lead NUMERIC(10, 2);
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(12, 2) DEFAULT 0.00;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_cost NUMERIC(12, 2) DEFAULT 0.00;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(12, 2) DEFAULT 0.00;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS billing_status VARCHAR(50) DEFAULT 'SETTLED';

      CREATE INDEX IF NOT EXISTS idx_leads_job_id ON leads(job_id);
      CREATE INDEX IF NOT EXISTS idx_leads_place_id ON leads(place_id);
      CREATE INDEX IF NOT EXISTS idx_leads_source_link ON leads(source_link);
      CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_leads_category ON leads(category);
      CREATE INDEX IF NOT EXISTS idx_leads_whatsapp ON leads(whatsapp);
      CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
      CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user ON wallet_ledger(user_id);
      CREATE INDEX IF NOT EXISTS idx_wallet_ledger_created ON wallet_ledger(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_wallet_ledger_type ON wallet_ledger(type);
      CREATE INDEX IF NOT EXISTS idx_wallet_ledger_ref ON wallet_ledger(reference_id);
      CREATE INDEX IF NOT EXISTS idx_queue_status ON email_queue(status);
      CREATE INDEX IF NOT EXISTS idx_email_queue_campaign_status ON email_queue(campaign_id, status);
      CREATE INDEX IF NOT EXISTS idx_inbox_threads_account ON inbox_threads(account_id);
    `);

    client.release();
    console.log(`[PostgreSQL ${isNeon ? 'Neon Cloud' : 'Localhost'}] Schema verified & all tables ready.`);
  } catch (err) {
    console.error(`[PostgreSQL ${isNeon ? 'Neon Cloud' : 'Localhost'}] Database initialization error:`, err.message);
  }
};

initDb();

const query = async (text, params, retries = 3) => {
  let attempt = 0;
  while (true) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      attempt++;
      const isTransient = err.message && (
        err.message.includes('timeout') || 
        err.message.includes('Connection terminated') ||
        err.message.includes('ECONNRESET') ||
        err.message.includes('too many clients')
      );
      if (attempt >= retries || !isTransient) {
        throw err;
      }
      console.warn(`[DB Transient Error - Retrying in ${attempt}s]:`, err.message);
      await new Promise(r => setTimeout(r, attempt * 1000));
    }
  }
};

module.exports = {
  query,
  pool,
};
