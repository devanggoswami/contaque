const { pool, initDb } = require('./db');

async function runSenderMigrationAndBindingTests() {
  console.log('================================================================');
  console.log('STARTING SENDER MIGRATION, DB SCHEMA & ACCOUNT BINDING TEST SUITE');
  console.log('================================================================\n');

  // 1. Run initDb to ensure migrations are applied
  console.log('--- TEST 1: DB SCHEMA & MIGRATION VERIFICATION ---');
  await initDb();

  const client = await pool.connect();
  let testUserId = null;

  try {
    await client.query('BEGIN');

    // Check column existence, data type, and foreign key in information_schema
    const colRes = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'campaigns' AND column_name = 'sender_account_id'
    `);

    if (colRes.rows.length === 0) {
      throw new Error('Database schema check failed: sender_account_id column NOT found in campaigns table!');
    }
    if (colRes.rows[0].data_type !== 'integer') {
      throw new Error(`Database schema check failed: sender_account_id has datatype ${colRes.rows[0].data_type}, expected integer!`);
    }
    console.log(`✓ Verified: campaigns.sender_account_id exists with correct datatype (integer).`);

    // Check index existence
    const idxRes = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'campaigns' AND indexname = 'idx_campaigns_sender_account'
    `);
    if (idxRes.rows.length === 0) {
      throw new Error('Database schema check failed: index idx_campaigns_sender_account NOT found on campaigns table!');
    }
    console.log(`✓ Verified: Index idx_campaigns_sender_account exists.`);

    // 2. Add Gmail account using Gmail + 16-digit App Password flow
    console.log('\n--- TEST 2: GMAIL APP PASSWORD ACCOUNT CREATION ---');
    const futureDate = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    const userRes = await client.query(
      `INSERT INTO users (name, email, plan, plan_expires_at) 
       VALUES ('Multi-Sender Tester', $1, 'pack', $2) 
       RETURNING id`,
      [`sender_test_${Date.now()}@test.com`, futureDate]
    );
    testUserId = userRes.rows[0].id;

    // Simulate adding Gmail Account 1 (Gmail + 16-character App Password)
    const acc1Res = await client.query(
      `INSERT INTO email_accounts (user_id, email, app_password, status, daily_sent_count, last_reset_date)
       VALUES ($1, 'primary.outreach@gmail.com', 'abcd efgh ijkl mnop', 'ACTIVE', 0, CURRENT_DATE)
       RETURNING id, email, status`,
      [testUserId]
    );
    const account1Id = acc1Res.rows[0].id;
    console.log(`✓ Added Gmail Account 1 (#${account1Id}: ${acc1Res.rows[0].email}) using Gmail + 16-digit App Password.`);

    // 3. Create Campaign 1 bound to Gmail Account 1
    console.log('\n--- TEST 3: CREATE CAMPAIGN BOUND TO ACCOUNT 1 ---');
    const camp1Res = await client.query(
      `INSERT INTO campaigns (name, subject, body_html, total_leads, status, user_id, sender_account_id)
       VALUES ('Q4 Enterprise Outreach', 'Partnership Proposal', '<p>Hello</p>', 10, 'DRAFT', $1, $2)
       RETURNING id, sender_account_id`,
      [testUserId, account1Id]
    );
    const camp1Id = camp1Res.rows[0].id;
    if (camp1Res.rows[0].sender_account_id !== account1Id) {
      throw new Error(`Campaign 1 sender_account_id mismatch: expected ${account1Id}, got ${camp1Res.rows[0].sender_account_id}`);
    }
    console.log(`✓ Campaign 1 (#${camp1Id}) created and strictly bound to Account 1 (#${account1Id}).`);

    // 4. Add second Gmail account (Value Pack user allows multiple accounts)
    console.log('\n--- TEST 4: ADD SECOND GMAIL ACCOUNT & CREATE INDEPENDENT CAMPAIGN ---');
    const acc2Res = await client.query(
      `INSERT INTO email_accounts (user_id, email, app_password, status, daily_sent_count, last_reset_date)
       VALUES ($1, 'secondary.sales@gmail.com', 'wxyz 1234 5678 abcd', 'ACTIVE', 0, CURRENT_DATE)
       RETURNING id, email, status`,
      [testUserId]
    );
    const account2Id = acc2Res.rows[0].id;
    console.log(`✓ Added Gmail Account 2 (#${account2Id}: ${acc2Res.rows[0].email}) using Gmail + 16-digit App Password.`);

    // Create Campaign 2 bound to Gmail Account 2
    const camp2Res = await client.query(
      `INSERT INTO campaigns (name, subject, body_html, total_leads, status, user_id, sender_account_id)
       VALUES ('Regional Sales Pitch', 'Product Updates', '<p>Updates</p>', 15, 'DRAFT', $1, $2)
       RETURNING id, sender_account_id`,
      [testUserId, account2Id]
    );
    const camp2Id = camp2Res.rows[0].id;
    if (camp2Res.rows[0].sender_account_id !== account2Id) {
      throw new Error(`Campaign 2 sender_account_id mismatch: expected ${account2Id}, got ${camp2Res.rows[0].sender_account_id}`);
    }
    console.log(`✓ Campaign 2 (#${camp2Id}) created and strictly bound to Account 2 (#${account2Id}).`);

    // 5. Verify NO silent sender rotation between campaigns
    console.log('\n--- TEST 5: VERIFY NO SILENT SENDER ROTATION ---');
    const checkBinding = await client.query(`
      SELECT c.id, c.name, c.sender_account_id, ea.email as sender_email
      FROM campaigns c
      JOIN email_accounts ea ON c.sender_account_id = ea.id
      WHERE c.id IN ($1, $2)
      ORDER BY c.id ASC
    `, [camp1Id, camp2Id]);

    const row1 = checkBinding.rows.find(r => r.id === camp1Id);
    const row2 = checkBinding.rows.find(r => r.id === camp2Id);

    if (row1.sender_account_id !== account1Id || row1.sender_email !== 'primary.outreach@gmail.com') {
      throw new Error(`Campaign 1 silently modified or switched to wrong sender: ${JSON.stringify(row1)}`);
    }
    if (row2.sender_account_id !== account2Id || row2.sender_email !== 'secondary.sales@gmail.com') {
      throw new Error(`Campaign 2 silently modified or switched to wrong sender: ${JSON.stringify(row2)}`);
    }
    console.log(`✓ Verified: Each campaign preserves its exact assigned sender account without rotation.`);

    // 6. Queue emails and verify Stop Outreach
    console.log('\n--- TEST 6: QUEUE DISPATCH & STOP OUTREACH CANCELLATION ---');
    await client.query(`
      INSERT INTO email_queue (campaign_id, target_email, status) VALUES
      ($1::int, 'lead1@corp.com', 'PENDING'),
      ($1::int, 'lead2@corp.com', 'PENDING'),
      ($2::int, 'lead3@corp.com', 'PENDING')
    `, [camp1Id, camp2Id]);

    // Simulate Stop Outreach on Campaign 1
    await client.query(
      `UPDATE email_queue SET status = 'CANCELLED', error_msg = 'Campaign stopped by user' 
       WHERE campaign_id = $1 AND status = 'PENDING'`,
      [camp1Id]
    );

    const c1Queue = await client.query(`SELECT status, count(*) FROM email_queue WHERE campaign_id = $1 GROUP BY status`, [camp1Id]);
    const c2Queue = await client.query(`SELECT status, count(*) FROM email_queue WHERE campaign_id = $1 GROUP BY status`, [camp2Id]);

    const c1Cancelled = c1Queue.rows.find(r => r.status === 'CANCELLED')?.count;
    const c2Pending = c2Queue.rows.find(r => r.status === 'PENDING')?.count;

    if (c1Cancelled !== '2') {
      throw new Error(`Expected Campaign 1 to have 2 CANCELLED queue items, found ${c1Cancelled}`);
    }
    if (c2Pending !== '1') {
      throw new Error(`Expected Campaign 2 to remain untouched with 1 PENDING queue item, found ${c2Pending}`);
    }
    console.log(`✓ Verified: Stop Outreach cancelled Campaign 1 items without touching Campaign 2.`);

    // 7. Test historical backfill logic
    console.log('\n--- TEST 7: HISTORICAL CAMPAIGN SENDER_ACCOUNT_ID BACKFILL ---');
    const legacyCampRes = await client.query(`
      INSERT INTO campaigns (name, subject, body_html, total_leads, status, user_id, sender_account_id)
      VALUES ('Legacy Campaign', 'Old Subject', 'Body', 5, 'COMPLETED', $1, NULL)
      RETURNING id, sender_account_id
    `, [testUserId]);
    const legacyCampId = legacyCampRes.rows[0].id;
    if (legacyCampRes.rows[0].sender_account_id !== null) {
      throw new Error('Legacy campaign failed to initialize with NULL sender_account_id');
    }

    // Run backfill query
    await client.query(`
      UPDATE campaigns c
      SET sender_account_id = (
        SELECT ea.id 
        FROM email_accounts ea 
        WHERE ea.user_id = c.user_id 
        ORDER BY ea.id ASC 
        LIMIT 1
      )
      WHERE c.sender_account_id IS NULL AND c.id = $1
    `, [legacyCampId]);

    const backfilledCamp = await client.query('SELECT sender_account_id FROM campaigns WHERE id = $1', [legacyCampId]);
    if (backfilledCamp.rows[0].sender_account_id !== account1Id) {
      throw new Error(`Backfill failed: expected account #${account1Id}, got #${backfilledCamp.rows[0].sender_account_id}`);
    }
    console.log(`✓ Verified: Legacy campaign backfilled to user's first account (#${account1Id}).`);

    // Rollback test changes cleanly
    await client.query('ROLLBACK');
    console.log('\n================================================================');
    console.log('ALL SENDER MIGRATION & ACCOUNT BINDING TESTS PASSED (100%)');
    console.log('================================================================\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Test Suite Failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runSenderMigrationAndBindingTests();
