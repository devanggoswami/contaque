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

// Helper to generate a unique branded referral code (e.g., CQ8X9M2P)
function generateReferralCode(name) {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `CQ${rand}`;
}

async function ensureUserReferralCode(userId, name, dbRunner = pool) {
  let code;
  let isUnique = false;
  let attempts = 0;
  while (!isUnique && attempts < 25) {
    attempts++;
    code = generateReferralCode(name);
    const check = await dbRunner.query('SELECT id FROM users WHERE UPPER(referral_code) = $1', [code]);
    if (check.rows.length === 0) isUnique = true;
  }
  if (code) {
    await dbRunner.query('UPDATE users SET referral_code = $1 WHERE id = $2', [code, userId]);
  }
  return code;
}

let isDbInitialized = false;
let initDbPromise = null;

// Auto-initialize schema on Postgres database
const initDb = async () => {
  if (isDbInitialized) return;
  if (initDbPromise) return initDbPromise;

  initDbPromise = (async () => {
    let client;
    try {
      client = await pool.connect();
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

      -- Prepaid Wallet & Billing Schema (Uninitialized/0.00 until user selects INR or USD)
      ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(12, 2) DEFAULT 0.00;
      ALTER TABLE users ALTER COLUMN wallet_balance SET DEFAULT 0.00;
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

      -- USD Parallel Wallet & Ledger Schema (Additive & Non-Breaking)
      ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_balance_usd NUMERIC(12, 4) DEFAULT 0.0000;
      ALTER TABLE users ALTER COLUMN wallet_balance_usd TYPE NUMERIC(12, 4);
      ALTER TABLE users ALTER COLUMN wallet_balance_usd SET DEFAULT 0.0000;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_wallet_balance_usd_positive') THEN
          ALTER TABLE users ADD CONSTRAINT chk_wallet_balance_usd_positive CHECK (wallet_balance_usd >= 0);
        END IF;
      END $$;

      ALTER TABLE users ADD COLUMN IF NOT EXISTS currency_preference VARCHAR(10) DEFAULT NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';
      ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';

      CREATE TABLE IF NOT EXISTS wallet_ledger_usd (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount NUMERIC(12, 4) NOT NULL,
        balance_after NUMERIC(12, 4) NOT NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('CREDIT', 'DEBIT', 'REFUND')),
        reason VARCHAR(255) NOT NULL,
        reference_id VARCHAR(255),
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE wallet_ledger_usd ALTER COLUMN amount TYPE NUMERIC(12, 4);
      ALTER TABLE wallet_ledger_usd ALTER COLUMN balance_after TYPE NUMERIC(12, 4);

      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key VARCHAR(255) PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        action VARCHAR(50) NOT NULL,
        response_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rate_per_lead NUMERIC(12, 4);
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(12, 4) DEFAULT 0.0000;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_cost NUMERIC(12, 4) DEFAULT 0.0000;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(12, 4) DEFAULT 0.0000;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS billing_status VARCHAR(50) DEFAULT 'SETTLED';

      ALTER TABLE jobs ALTER COLUMN rate_per_lead TYPE NUMERIC(12, 4);
      ALTER TABLE jobs ALTER COLUMN estimated_cost TYPE NUMERIC(12, 4);
      ALTER TABLE jobs ALTER COLUMN actual_cost TYPE NUMERIC(12, 4);
      ALTER TABLE jobs ALTER COLUMN refunded_amount TYPE NUMERIC(12, 4);

      -- Multi-User Data Isolation: User FK columns & indices
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE inbox_threads ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

      -- Allow same email account on different users if necessary
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_accounts_email_key') THEN
          ALTER TABLE email_accounts DROP CONSTRAINT email_accounts_email_key;
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_leads_job_id ON leads(job_id);
      CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
      CREATE INDEX IF NOT EXISTS idx_leads_place_id ON leads(place_id);
      CREATE INDEX IF NOT EXISTS idx_leads_source_link ON leads(source_link);
      CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_leads_category ON leads(category);
      CREATE INDEX IF NOT EXISTS idx_leads_whatsapp ON leads(whatsapp);
      CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
      CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
      CREATE INDEX IF NOT EXISTS idx_email_accounts_user_id ON email_accounts(user_id);
      CREATE INDEX IF NOT EXISTS idx_inbox_threads_user_id ON inbox_threads(user_id);
      CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user ON wallet_ledger(user_id);
      CREATE INDEX IF NOT EXISTS idx_wallet_ledger_created ON wallet_ledger(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_wallet_ledger_type ON wallet_ledger(type);
      CREATE INDEX IF NOT EXISTS idx_wallet_ledger_ref ON wallet_ledger(reference_id);
      CREATE INDEX IF NOT EXISTS idx_wallet_ledger_usd_user ON wallet_ledger_usd(user_id);
      CREATE INDEX IF NOT EXISTS idx_wallet_ledger_usd_created ON wallet_ledger_usd(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_wallet_ledger_usd_type ON wallet_ledger_usd(type);
      CREATE INDEX IF NOT EXISTS idx_wallet_ledger_usd_ref ON wallet_ledger_usd(reference_id);
      CREATE INDEX IF NOT EXISTS idx_users_currency_preference ON users(currency_preference);
      CREATE INDEX IF NOT EXISTS idx_queue_status ON email_queue(status);
      CREATE INDEX IF NOT EXISTS idx_email_queue_campaign_status ON email_queue(campaign_id, status);
      CREATE INDEX IF NOT EXISTS idx_inbox_threads_account ON inbox_threads(account_id);

      -- Email Verification Tokens
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token_expires_at TIMESTAMP;
      CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);

      -- Subscription & Payment Order Architecture
      ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP;

      CREATE TABLE IF NOT EXISTS payment_orders (
        id SERIAL PRIMARY KEY,
        order_id VARCHAR(255) UNIQUE NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        purpose VARCHAR(50) NOT NULL, -- 'PLAN_UPGRADE' | 'WALLET_TOPUP'
        plan_id VARCHAR(50),          -- 'pack' | 'plus' (NULL for wallet topup)
        amount_paise INTEGER NOT NULL,
        currency VARCHAR(10) DEFAULT 'INR',
        receipt VARCHAR(255),
        status VARCHAR(50) DEFAULT 'CREATED', -- 'CREATED' | 'PAID' | 'FAILED'
        payment_id VARCHAR(255),
        signature VARCHAR(255),
        billing_details JSONB DEFAULT '{}'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        paid_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS plan_transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        order_id VARCHAR(255) REFERENCES payment_orders(order_id),
        payment_id VARCHAR(255) UNIQUE NOT NULL,
        plan_id VARCHAR(50) NOT NULL,
        amount_paid NUMERIC(12, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'INR',
        billing_details JSONB DEFAULT '{}'::jsonb,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_payment_orders_order_id ON payment_orders(order_id);
      CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON payment_orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);
      CREATE INDEX IF NOT EXISTS idx_payment_orders_purpose ON payment_orders(purpose);
      CREATE INDEX IF NOT EXISTS idx_plan_transactions_user_id ON plan_transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_plan_transactions_payment_id ON plan_transactions(payment_id);

      -- Admin Support & Override Audit Logs
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER,
        admin_email VARCHAR(255) NOT NULL,
        target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_user_email VARCHAR(255) NOT NULL,
        action VARCHAR(100) NOT NULL, -- 'PLAN_OVERRIDE', 'WALLET_CREDIT', 'WALLET_DEBIT', 'PLAN_REMOVE'
        previous_value JSONB,
        new_value JSONB,
        amount NUMERIC(12, 2),
        reason TEXT NOT NULL,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_admin_audit_target_user ON admin_audit_logs(target_user_id);
      CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_email ON admin_audit_logs(admin_email);
      CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at ON admin_audit_logs(created_at DESC);

      -- Referral System Schema
      ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(50) UNIQUE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_claimed BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_prompt_dismissed BOOLEAN DEFAULT FALSE;

      CREATE TABLE IF NOT EXISTS referrals (
        id SERIAL PRIMARY KEY,
        referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        referred_user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        referral_code VARCHAR(50) NOT NULL,
        reward_amount NUMERIC(10, 2) DEFAULT 100.00,
        status VARCHAR(50) DEFAULT 'COMPLETED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
      CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id ON referrals(referred_user_id);
      CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
    `);

    // Backfill unique referral codes for existing users who don't have one
    // Mark existing users with referral_prompt_dismissed = TRUE so existing users don't see the popup
    const usersWithoutCode = await client.query('SELECT id, name FROM users WHERE referral_code IS NULL');
    for (const u of usersWithoutCode.rows) {
      let code;
      let isUnique = false;
      let attempts = 0;
      while (!isUnique && attempts < 25) {
        attempts++;
        code = generateReferralCode(u.name);
        const check = await client.query('SELECT id FROM users WHERE UPPER(referral_code) = $1', [code]);
        if (check.rows.length === 0) isUnique = true;
      }
      if (code) {
        await client.query(
          'UPDATE users SET referral_code = $1, referral_prompt_dismissed = TRUE WHERE id = $2',
          [code, u.id]
        );
      }
    }

    // Ensure Administrator / Default Admin exists in users table with plus plan & wallet balance
    const adminEmail = (process.env.ADMIN_USER || process.env.AUTH_USER || '').trim().toLowerCase();
    if (adminEmail) {
      const adminName = process.env.ADMIN_NAME || 'Devang Goswami';
      const adminPass = process.env.ADMIN_PASSWORD || process.env.AUTH_PASS || '2112@Dev';
      const adminUpsert = await client.query(`
        INSERT INTO users (name, email, password_hash, plan, email_verified, wallet_balance, country, auth_provider, role)
        VALUES ($1, $2, $3, 'plus', true, 44830.00, 'India', 'local', 'admin')
        ON CONFLICT (email) DO UPDATE 
        SET name = EXCLUDED.name,
            password_hash = EXCLUDED.password_hash,
            plan = 'plus',
            role = 'admin',
            email_verified = true,
            wallet_balance = CASE WHEN users.wallet_balance = 0 THEN 44830.00 ELSE users.wallet_balance END
        RETURNING id;
      `, [adminName, adminEmail, adminPass]);

      // Ensure admin email is always explicitly tagged role = 'admin'
      await client.query('UPDATE users SET role = \'admin\' WHERE LOWER(email) = LOWER($1)', [adminEmail]);

      const adminId = adminUpsert.rows[0]?.id;
      if (adminId) {
        // Multi-User Isolation: Migrate all existing production/test data strictly to admin account
        await client.query('UPDATE jobs SET user_id = $1 WHERE user_id IS NULL', [adminId]);
        await client.query('UPDATE leads SET user_id = jobs.user_id FROM jobs WHERE leads.job_id = jobs.id AND leads.user_id IS NULL');
        await client.query('UPDATE leads SET user_id = $1 WHERE user_id IS NULL', [adminId]);
        await client.query('UPDATE email_accounts SET user_id = $1 WHERE user_id IS NULL', [adminId]);
        await client.query('UPDATE campaigns SET user_id = $1 WHERE user_id IS NULL', [adminId]);
        await client.query('UPDATE inbox_threads SET user_id = email_accounts.user_id FROM email_accounts WHERE inbox_threads.account_id = email_accounts.id AND inbox_threads.user_id IS NULL');
        await client.query('UPDATE inbox_threads SET user_id = $1 WHERE user_id IS NULL', [adminId]);
      }
    }

    // Ensure all non-admin users strictly have role = 'user'
    await client.query(`
      UPDATE users 
      SET role = 'user' 
      WHERE (role IS NULL OR role != 'user')
        AND ($1 = '' OR LOWER(email) != LOWER($1))
    `, [adminEmail || '']);

    // Ensure all registered users (non-admin) with 0 or null balance receive ₹50 welcome credit
    await client.query(`
      UPDATE users 
      SET wallet_balance = 50.00 
      WHERE (wallet_balance IS NULL OR wallet_balance = 0)
        AND ($1 = '' OR LOWER(email) != LOWER($1))
    `, [adminEmail || '']);

    // Audit & Remediation: Reset any non-admin users with 'plus' or 'pack' who have NO verified transactions in plan_transactions
    const unverifiedPlanReset = await client.query(`
      UPDATE users 
      SET plan = 'free' 
      WHERE plan IN ('plus', 'pack')
        AND ($1 = '' OR LOWER(email) != LOWER($1))
        AND id NOT IN (SELECT user_id FROM plan_transactions WHERE plan_id IN ('plus', 'pack'))
      RETURNING id, email, plan
    `, [adminEmail || '']);
    if (unverifiedPlanReset.rowCount > 0) {
      console.log(`[Security Audit]: Reset ${unverifiedPlanReset.rowCount} unverified user(s) with unverified paid plans back to 'free'.`);
    }

    isDbInitialized = true;
    console.log(`[PostgreSQL ${isNeon ? 'Neon Cloud' : 'Localhost'}] Schema verified & all tables ready.`);
  } catch (err) {
    console.error(`[PostgreSQL ${isNeon ? 'Neon Cloud' : 'Localhost'}] Database initialization error:`, err.message);
  } finally {
    if (client) {
      client.release();
    }
  }
  })();

  return initDbPromise;
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
  initDb,
  generateReferralCode,
  ensureUserReferralCode
};
