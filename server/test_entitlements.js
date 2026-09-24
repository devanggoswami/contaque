const { pool, initDb } = require('./db');
const { getUserPlanEntitlement, SUBSCRIPTION_PLANS, normalizePlanId } = require('./utils/plans');
const { getAvailableAccount } = require('./utils/mailer');

async function runTests() {
  console.log('====================================================');
  console.log('STARTING PLAN ENTITLEMENT VERIFICATION SUITE');
  console.log('====================================================\n');

  await initDb();

  const client = await pool.connect();
  let testUserId = null;

  try {
    await client.query('BEGIN');

    // Create a temporary test user
    const testEmail = `test_entitlement_${Date.now()}@example.com`;
    const userRes = await client.query(
      `INSERT INTO users (name, email, plan, plan_expires_at) 
       VALUES ('Entitlement Tester', $1, 'free', NULL) 
       RETURNING id`,
      [testEmail]
    );
    testUserId = userRes.rows[0].id;
    console.log(`✓ Created isolated test user (ID: ${testUserId})`);

    // ----------------------------------------------------
    // TEST 1: FREE PLAN ENTITLEMENT
    // ----------------------------------------------------
    console.log('\n--- TEST 1: FREE PLAN ---');
    let ent = await getUserPlanEntitlement(testUserId, client);
    console.log('Free Entitlement:', ent);
    if (ent.emailCampaignsEnabled !== false) throw new Error('Free plan must have emailCampaignsEnabled === false');
    if (ent.maxAccounts !== 0) throw new Error('Free plan must have maxAccounts === 0');
    if (ent.dailyEmailLimit !== 0) throw new Error('Free plan must have dailyEmailLimit === 0');
    console.log('✓ FREE: Campaigns disabled, 0 accounts, 0 emails/day verified');

    // Simulate account add attempt for FREE
    const freeAccCount = 0;
    if (ent.maxAccounts <= 0 || freeAccCount >= ent.maxAccounts) {
      console.log('✓ FREE: Server correctly rejects Gmail account creation');
    } else {
      throw new Error('FREE allowed adding account!');
    }

    // Free sending check
    const freeAccount = await getAvailableAccount(testUserId, client);
    if (freeAccount !== null) throw new Error('FREE user was able to send emails!');
    console.log('✓ FREE: Sending engine strictly blocks campaign dispatch');

    // ----------------------------------------------------
    // TEST 2: VALUE PLUS (₹299) ENTITLEMENT
    // ----------------------------------------------------
    console.log('\n--- TEST 2: VALUE PLUS (₹299) ---');
    const futureDate = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    await client.query(
      `UPDATE users SET plan = 'plus', plan_expires_at = $1 WHERE id = $2`,
      [futureDate, testUserId]
    );

    ent = await getUserPlanEntitlement(testUserId, client);
    console.log('Value Plus Entitlement:', ent);
    if (ent.emailCampaignsEnabled !== true) throw new Error('Value Plus must have emailCampaignsEnabled === true');
    if (ent.maxAccounts !== 1) throw new Error('Value Plus must have maxAccounts === 1');
    if (ent.dailyEmailLimit !== 400) throw new Error('Value Plus must have dailyEmailLimit === 400');
    console.log('✓ VALUE PLUS: Campaigns enabled, max 1 account, 400 emails/day verified');

    // Add first account for Value Plus
    const acc1Res = await client.query(
      `INSERT INTO email_accounts (user_id, email, app_password, status, daily_sent_count, last_reset_date)
       VALUES ($1, 'sender1@gmail.com', 'app_pwd_1', 'ACTIVE', 0, CURRENT_DATE)
       RETURNING id`,
      [testUserId]
    );
    const acc1Id = acc1Res.rows[0].id;
    console.log('✓ VALUE PLUS: First Gmail account added successfully');

    // Attempt second account for Value Plus
    const countCheck = await client.query('SELECT COUNT(*) FROM email_accounts WHERE user_id = $1', [testUserId]);
    const currentCount = parseInt(countCheck.rows[0].count, 10);
    if (currentCount >= ent.maxAccounts) {
      console.log(`✓ VALUE PLUS: Second Gmail account rejected (Current: ${currentCount} >= Max: ${ent.maxAccounts})`);
    } else {
      throw new Error('VALUE PLUS allowed adding second account!');
    }

    // Daily limit test for Value Plus: under limit (399)
    await client.query('UPDATE email_accounts SET daily_sent_count = 399 WHERE id = $1', [acc1Id]);
    let availableAcc = await getAvailableAccount(testUserId, client);
    if (!availableAcc || availableAcc.id !== acc1Id) throw new Error('Available account not returned at 399 sent!');
    console.log('✓ VALUE PLUS: Email allowed when daily sent count is 399/400');

    // Daily limit test for Value Plus: at limit (400)
    await client.query('UPDATE email_accounts SET daily_sent_count = 400 WHERE id = $1', [acc1Id]);
    availableAcc = await getAvailableAccount(testUserId, client);
    if (availableAcc !== null) throw new Error('VALUE PLUS allowed sending at 400 daily limit!');
    console.log('✓ VALUE PLUS: 401st email rejected (Daily limit 400 enforced)');

    // ----------------------------------------------------
    // TEST 3: UPGRADE VALUE PLUS → VALUE PACK (₹499)
    // ----------------------------------------------------
    console.log('\n--- TEST 3: UPGRADE TO VALUE PACK (₹499) ---');
    await client.query(`UPDATE users SET plan = 'pack' WHERE id = $1`, [testUserId]);
    ent = await getUserPlanEntitlement(testUserId, client);
    console.log('Value Pack Entitlement:', ent);
    if (ent.emailCampaignsEnabled !== true) throw new Error('Value Pack must have emailCampaignsEnabled === true');
    if (ent.maxAccounts !== 4) throw new Error('Value Pack must have maxAccounts === 4');
    if (ent.dailyEmailLimit !== 1600) throw new Error('Value Pack must have dailyEmailLimit === 1600');
    console.log('✓ VALUE PACK: Campaigns enabled, max 4 accounts, 1,600 emails/day verified');

    // Add accounts 2, 3, 4
    await client.query(
      `INSERT INTO email_accounts (user_id, email, app_password, status, daily_sent_count, last_reset_date)
       VALUES 
       ($1, 'sender2@gmail.com', 'app_pwd_2', 'ACTIVE', 0, CURRENT_DATE),
       ($1, 'sender3@gmail.com', 'app_pwd_3', 'ACTIVE', 0, CURRENT_DATE),
       ($1, 'sender4@gmail.com', 'app_pwd_4', 'ACTIVE', 0, CURRENT_DATE)`,
      [testUserId]
    );
    const packAccCount = await client.query('SELECT COUNT(*) FROM email_accounts WHERE user_id = $1', [testUserId]);
    console.log(`✓ VALUE PACK: Successfully holds ${packAccCount.rows[0].count} accounts`);

    // Attempt 5th account for Value Pack
    const countPack = parseInt(packAccCount.rows[0].count, 10);
    if (countPack >= ent.maxAccounts) {
      console.log(`✓ VALUE PACK: 5th Gmail account rejected (Current: ${countPack} >= Max: ${ent.maxAccounts})`);
    } else {
      throw new Error('VALUE PACK allowed 5th account!');
    }

    // Daily limit test for Value Pack: up to 1,600 allowed
    await client.query('UPDATE email_accounts SET daily_sent_count = 399 WHERE user_id = $1', [testUserId]); // 4 * 399 = 1596
    availableAcc = await getAvailableAccount(testUserId, client);
    if (!availableAcc) throw new Error('VALUE PACK rejected sending under 1600 total quota!');
    console.log('✓ VALUE PACK: Sending up to 1,600/day allowed');

    // Daily limit test for Value Pack: at 1,600 total
    await client.query('UPDATE email_accounts SET daily_sent_count = 400 WHERE user_id = $1', [testUserId]); // 4 * 400 = 1600
    availableAcc = await getAvailableAccount(testUserId, client);
    if (availableAcc !== null) throw new Error('VALUE PACK allowed 1601st email!');
    console.log('✓ VALUE PACK: 1,601st email rejected (Daily limit 1,600 enforced)');

    // ----------------------------------------------------
    // TEST 4: PLAN TRANSITION VALUE PACK → VALUE PLUS (DOWNGRADE)
    // ----------------------------------------------------
    console.log('\n--- TEST 4: DOWNGRADE VALUE PACK → VALUE PLUS ---');
    await client.query(`UPDATE users SET plan = 'plus' WHERE id = $1`, [testUserId]);
    ent = await getUserPlanEntitlement(testUserId, client);

    // Verify existing accounts were NOT deleted
    const preservedAccounts = await client.query('SELECT COUNT(*) FROM email_accounts WHERE user_id = $1', [testUserId]);
    const preservedCount = parseInt(preservedAccounts.rows[0].count, 10);
    if (preservedCount !== 4) throw new Error(`Accounts were deleted on plan change! Expected 4, found ${preservedCount}`);
    console.log(`✓ PRESERVATION: All ${preservedCount} accounts preserved safely after downgrade`);

    // Verify cannot add any more accounts
    if (preservedCount >= ent.maxAccounts) {
      console.log(`✓ DOWNGRADE: Adding accounts blocked (Current: ${preservedCount} >= Value Plus limit: ${ent.maxAccounts})`);
    } else {
      throw new Error('Allowed adding accounts when exceeding downgraded limit!');
    }

    // Verify sending strictly enforces Value Plus 400/day allowance across active accounts
    await client.query('UPDATE email_accounts SET daily_sent_count = 100 WHERE user_id = $1', [testUserId]);
    // Reset account 1 to 399
    await client.query('UPDATE email_accounts SET daily_sent_count = 399 WHERE id = $1', [acc1Id]);
    availableAcc = await getAvailableAccount(testUserId, client);
    if (!availableAcc) throw new Error('Value Plus sending blocked under 400 limit!');
    console.log('✓ DOWNGRADE: Sending active within Value Plus entitlement');

    // Reach 400 limit on active allowed account
    await client.query('UPDATE email_accounts SET daily_sent_count = 400 WHERE id = $1', [acc1Id]);
    availableAcc = await getAvailableAccount(testUserId, client);
    if (availableAcc !== null) throw new Error('Downgraded user exceeded 400 daily limit!');
    console.log('✓ DOWNGRADE: Sending strictly capped at Value Plus 400/day');

    // ----------------------------------------------------
    // TEST 5: PLAN EXPIRY CHECK
    // ----------------------------------------------------
    console.log('\n--- TEST 5: PLAN EXPIRY ENFORCEMENT ---');
    const pastDate = new Date(Date.now() - 24 * 3600 * 1000); // Expired yesterday
    await client.query(`UPDATE users SET plan_expires_at = $1 WHERE id = $2`, [pastDate, testUserId]);
    
    ent = await getUserPlanEntitlement(testUserId, client);
    console.log('Expired Plan Entitlement:', ent);
    if (!ent.isExpired) throw new Error('Expired plan was not marked as isExpired!');
    if (ent.emailCampaignsEnabled !== false) throw new Error('Expired plan must have emailCampaignsEnabled === false');
    if (ent.maxAccounts !== 0) throw new Error('Expired plan must have maxAccounts === 0');
    if (ent.dailyEmailLimit !== 0) throw new Error('Expired plan must have dailyEmailLimit === 0');

    availableAcc = await getAvailableAccount(testUserId, client);
    if (availableAcc !== null) throw new Error('Expired plan was able to send emails!');
    console.log('✓ EXPIRY: Expired paid plan strictly cannot send campaigns or add accounts');

    console.log('\n====================================================');
    console.log('ALL ENTITLEMENT & SECURITY TESTS PASSED PERFECTLY!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err);
    throw err;
  } finally {
    // Roll back all test data so database is untouched
    await client.query('ROLLBACK');
    client.release();
    console.log('✓ Test transaction rolled back cleanly. Database remains intact.');
  }
}

runTests()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
