const db = require('./db');

async function updateDb() {
  try {
    console.log('[Migration] Connected to PostgreSQL via db pool...');

    // 1. Add sender_account_id column to campaigns table if not exists
    await db.query(`
      ALTER TABLE campaigns 
      ADD COLUMN IF NOT EXISTS sender_account_id INTEGER REFERENCES email_accounts(id) ON DELETE SET NULL;
    `);
    console.log('[Migration] Verified sender_account_id column in campaigns table.');

    // 2. Add performance index
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_campaigns_sender_account ON campaigns(sender_account_id);
    `);
    console.log('[Migration] Verified index idx_campaigns_sender_account.');

    // 3. Clean up stale PENDING queue items from campaigns that are NOT in RUNNING status
    // Safe cancellation: records are NOT deleted, status set to CANCELLED for audit trail
    const cancelRes = await db.query(`
      UPDATE email_queue 
      SET status = 'CANCELLED', 
          error_msg = 'Cancelled prior to campaign engine update' 
      WHERE status = 'PENDING' 
        AND campaign_id IN (SELECT id FROM campaigns WHERE status != 'RUNNING');
    `);
    console.log(`[Migration] Safely marked ${cancelRes.rowCount} stale PENDING queue items as CANCELLED.`);

    // 4. Backfill sender_account_id for older campaigns using their user's first email account if available
    const backfillRes = await db.query(`
      UPDATE campaigns c
      SET sender_account_id = (
        SELECT ea.id 
        FROM email_accounts ea 
        WHERE ea.user_id = c.user_id 
        ORDER BY ea.id ASC 
        LIMIT 1
      )
      WHERE c.sender_account_id IS NULL;
    `);
    console.log(`[Migration] Backfilled sender_account_id for ${backfillRes.rowCount} existing campaigns.`);

    console.log('[Migration] Database migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('[Migration Error]:', err.message);
    process.exit(1);
  }
}

updateDb();
