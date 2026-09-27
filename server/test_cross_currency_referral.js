/**
 * Comprehensive Cross-Currency Referral Reward Test Suite
 * 
 * Verifies strict business rules:
 * 1. Fixed Rewards: INR reward = ₹100, USD reward = $2.
 * 2. Signup alone triggers reward; NO plan purchase required.
 * 3. NO FX CONVERSION: Referrer and Referee rewards are determined independently
 *    for each user's own wallet currency.
 * 4. Four Cross-Currency Combinations:
 *    - Case 1: Referrer USD, Referee INR -> Referrer +$2.00 USD, Referee +₹100.00 INR
 *    - Case 2: Referrer INR, Referee USD -> Referrer +₹100.00 INR, Referee +$2.00 USD
 *    - Case 3: Referrer INR, Referee INR -> Referrer +₹100.00 INR, Referee +₹100.00 INR
 *    - Case 4: Referrer USD, Referee USD -> Referrer +$2.00 USD, Referee +$2.00 USD
 * 5. Exactly-once crediting & Idempotency: Duplicate submissions rejected, balances untouched.
 * 6. Self-referral & invalid code safety.
 * 7. Full ledger auditability (wallet_ledger for INR, wallet_ledger_usd for USD).
 * 8. GET /api/referral/info returns correct metrics without FX rate conversion.
 */

const http = require('http');
const axios = require('axios');
const crypto = require('crypto');
const db = require('./db');
const { app } = require('./index');

let serverInstance;
let baseURL;
const JWT_SECRET = process.env.JWT_SECRET || 'contaque_jwt_development_secret_key_change_in_production';

function generateAuthToken(email) {
  const expiresAt = Date.now() + 48 * 60 * 60 * 1000;
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${email}:${expiresAt}`).digest('hex');
  return Buffer.from(`${email}:${expiresAt}:${signature}`).toString('base64');
}

async function createTestUser({ name, email, country, currency_preference, wallet_balance = 0.00, wallet_balance_usd = 0.00, plan = 'free' }) {
  const code = 'REF' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const res = await db.query(
    `INSERT INTO users (
       name, email, password_hash, country, auth_provider, email_verified, 
       plan, wallet_balance, wallet_balance_usd, currency_preference, 
       referral_code, referral_claimed, referral_prompt_dismissed, role
     )
     VALUES ($1, $2, 'TEST_HASH', $3, 'local', true, $4, $5, $6, $7, $8, false, false, 'user')
     RETURNING *`,
    [name, email.toLowerCase(), country, plan, wallet_balance, wallet_balance_usd, currency_preference, code]
  );
  return res.rows[0];
}

async function runTests() {
  console.log('================================================================');
  console.log('STARTING REFERRAL REWARD — CROSS-CURRENCY RULE TEST SUITE');
  console.log('================================================================\n');

  await db.initDb();

  await new Promise((resolve) => {
    serverInstance = http.createServer(app);
    serverInstance.listen(0, () => {
      const port = serverInstance.address().port;
      baseURL = `http://127.0.0.1:${port}`;
      console.log(`✓ Test HTTP server listening on ${baseURL}`);
      resolve();
    });
  });

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    } else {
      passedTests++;
      console.log(`  ✓ ${message}`);
    }
  }

  try {
    const timestamp = Date.now();

    // --------------------------------------------------------------------------
    // CASE 1: Referrer USD ($2) -> Referee INR (₹100)
    // --------------------------------------------------------------------------
    console.log('\n--- CASE 1: Referrer = USD, Referee = INR ---');
    const u1Referrer = await createTestUser({
      name: 'Referrer USD',
      email: `ref_usd_case1_${timestamp}@example.com`,
      country: 'United States',
      currency_preference: 'USD',
      wallet_balance: 0.00,
      wallet_balance_usd: 10.00,
      plan: 'free'
    });
    const u1Referee = await createTestUser({
      name: 'Referee INR',
      email: `ref_inr_case1_${timestamp}@example.com`,
      country: 'India',
      currency_preference: 'INR',
      wallet_balance: 50.00,
      wallet_balance_usd: 0.00,
      plan: 'free'
    });

    const tokenCase1 = generateAuthToken(u1Referee.email);
    const resCase1 = await axios.post(
      `${baseURL}/api/referral/claim`,
      { referral_code: u1Referrer.referral_code },
      { headers: { Authorization: `Bearer ${tokenCase1}` } }
    );

    assert(resCase1.status === 200, 'Claim endpoint returned 200 OK');
    assert(resCase1.data.success === true, 'Claim response returned success: true');
    assert(resCase1.data.reward === 100, 'Referee reward returned as ₹100');
    assert(resCase1.data.currency === 'INR', 'Referee currency returned as INR');
    assert(resCase1.data.referrerReward === 2, 'Referrer reward returned as $2');
    assert(resCase1.data.referrerCurrency === 'USD', 'Referrer currency returned as USD');

    // Verify Referrer DB balance: wallet_balance_usd increased by $2.00, INR balance untouched
    const ref1Check = (await db.query('SELECT wallet_balance, wallet_balance_usd FROM users WHERE id = $1', [u1Referrer.id])).rows[0];
    assert(parseFloat(ref1Check.wallet_balance_usd) === 12.00, 'Referrer USD balance is exactly $12.00 ($10 + $2)');
    assert(parseFloat(ref1Check.wallet_balance) === 0.00, 'Referrer INR balance untouched (0.00)');

    // Verify Referee DB balance: wallet_balance increased by ₹100.00, USD balance untouched
    const rfe1Check = (await db.query('SELECT wallet_balance, wallet_balance_usd, referral_claimed, referred_by FROM users WHERE id = $1', [u1Referee.id])).rows[0];
    assert(parseFloat(rfe1Check.wallet_balance) === 150.00, 'Referee INR balance is exactly ₹150.00 (₹50 + ₹100)');
    assert(parseFloat(rfe1Check.wallet_balance_usd) === 0.00, 'Referee USD balance untouched (0.00)');
    assert(rfe1Check.referral_claimed === true, 'Referee referral_claimed set to true');
    assert(rfe1Check.referred_by === u1Referrer.id, 'Referee referred_by correctly set');

    // Verify Ledgers
    const ledgerRef1 = (await db.query('SELECT * FROM wallet_ledger_usd WHERE user_id = $1', [u1Referrer.id])).rows;
    assert(ledgerRef1.length === 1, 'Referrer has exactly 1 entry in wallet_ledger_usd');
    assert(parseFloat(ledgerRef1[0].amount) === 2.00, 'Referrer ledger USD amount is $2.00');
    assert(ledgerRef1[0].reference_id === 'REFERRAL_SIGNUP_REWARD', 'Referrer ledger reference_id is REFERRAL_SIGNUP_REWARD');

    const ledgerRfe1 = (await db.query('SELECT * FROM wallet_ledger WHERE user_id = $1', [u1Referee.id])).rows;
    assert(ledgerRfe1.length === 1, 'Referee has exactly 1 entry in wallet_ledger');
    assert(parseFloat(ledgerRfe1[0].amount) === 100.00, 'Referee ledger INR amount is ₹100.00');

    // Verify Referrals row
    const referralRow1 = (await db.query('SELECT * FROM referrals WHERE referred_user_id = $1', [u1Referee.id])).rows[0];
    assert(referralRow1.referrer_reward_amount == 2.00, 'Referrals table recorded referrer_reward_amount = 2.00');
    assert(referralRow1.referrer_reward_currency === 'USD', 'Referrals table recorded referrer_reward_currency = USD');
    assert(referralRow1.referee_reward_amount == 100.00, 'Referrals table recorded referee_reward_amount = 100.00');
    assert(referralRow1.referee_reward_currency === 'INR', 'Referrals table recorded referee_reward_currency = INR');

    // --------------------------------------------------------------------------
    // CASE 2: Referrer INR (₹100) -> Referee USD ($2)
    // --------------------------------------------------------------------------
    console.log('\n--- CASE 2: Referrer = INR, Referee = USD ---');
    const u2Referrer = await createTestUser({
      name: 'Referrer INR',
      email: `ref_inr_case2_${timestamp}@example.com`,
      country: 'India',
      currency_preference: 'INR',
      wallet_balance: 200.00,
      wallet_balance_usd: 0.00,
      plan: 'free'
    });
    const u2Referee = await createTestUser({
      name: 'Referee USD',
      email: `ref_usd_case2_${timestamp}@example.com`,
      country: 'United Kingdom',
      currency_preference: 'USD',
      wallet_balance: 0.00,
      wallet_balance_usd: 1.50,
      plan: 'free'
    });

    const tokenCase2 = generateAuthToken(u2Referee.email);
    const resCase2 = await axios.post(
      `${baseURL}/api/referral/claim`,
      { referral_code: u2Referrer.referral_code },
      { headers: { Authorization: `Bearer ${tokenCase2}` } }
    );

    assert(resCase2.status === 200, 'Claim endpoint returned 200 OK');
    assert(resCase2.data.reward === 2, 'Referee reward returned as $2');
    assert(resCase2.data.currency === 'USD', 'Referee currency returned as USD');
    assert(resCase2.data.referrerReward === 100, 'Referrer reward returned as ₹100');
    assert(resCase2.data.referrerCurrency === 'INR', 'Referrer currency returned as INR');

    // Verify Referrer DB balance: wallet_balance increased by ₹100.00, USD balance untouched
    const ref2Check = (await db.query('SELECT wallet_balance, wallet_balance_usd FROM users WHERE id = $1', [u2Referrer.id])).rows[0];
    assert(parseFloat(ref2Check.wallet_balance) === 300.00, 'Referrer INR balance is exactly ₹300.00 (₹200 + ₹100)');
    assert(parseFloat(ref2Check.wallet_balance_usd) === 0.00, 'Referrer USD balance untouched (0.00)');

    // Verify Referee DB balance: wallet_balance_usd increased by $2.00, INR balance untouched
    const rfe2Check = (await db.query('SELECT wallet_balance, wallet_balance_usd FROM users WHERE id = $1', [u2Referee.id])).rows[0];
    assert(parseFloat(rfe2Check.wallet_balance_usd) === 3.50, 'Referee USD balance is exactly $3.50 ($1.50 + $2.00)');
    assert(parseFloat(rfe2Check.wallet_balance) === 0.00, 'Referee INR balance untouched (0.00)');

    // Verify Ledgers
    const ledgerRef2 = (await db.query('SELECT * FROM wallet_ledger WHERE user_id = $1', [u2Referrer.id])).rows;
    assert(ledgerRef2.length === 1, 'Referrer has entry in wallet_ledger (INR)');
    assert(parseFloat(ledgerRef2[0].amount) === 100.00, 'Referrer ledger amount is ₹100.00');

    const ledgerRfe2 = (await db.query('SELECT * FROM wallet_ledger_usd WHERE user_id = $1', [u2Referee.id])).rows;
    assert(ledgerRfe2.length === 1, 'Referee has entry in wallet_ledger_usd');
    assert(parseFloat(ledgerRfe2[0].amount) === 2.00, 'Referee ledger amount is $2.00');

    // --------------------------------------------------------------------------
    // CASE 3: Both INR (₹100 + ₹100)
    // --------------------------------------------------------------------------
    console.log('\n--- CASE 3: Referrer = INR, Referee = INR ---');
    const u3Referrer = await createTestUser({
      name: 'Referrer Both INR',
      email: `ref_inr_case3_${timestamp}@example.com`,
      country: 'India',
      currency_preference: 'INR',
      wallet_balance: 100.00,
      wallet_balance_usd: 0.00
    });
    const u3Referee = await createTestUser({
      name: 'Referee Both INR',
      email: `ref_inr_rfe3_${timestamp}@example.com`,
      country: 'India',
      currency_preference: 'INR',
      wallet_balance: 0.00,
      wallet_balance_usd: 0.00
    });

    const tokenCase3 = generateAuthToken(u3Referee.email);
    const resCase3 = await axios.post(
      `${baseURL}/api/referral/claim`,
      { referral_code: u3Referrer.referral_code },
      { headers: { Authorization: `Bearer ${tokenCase3}` } }
    );

    assert(resCase3.status === 200, 'Claim endpoint returned 200 OK');
    assert(resCase3.data.reward === 100, 'Referee reward returned as ₹100');
    assert(resCase3.data.referrerReward === 100, 'Referrer reward returned as ₹100');

    const ref3Check = (await db.query('SELECT wallet_balance, wallet_balance_usd FROM users WHERE id = $1', [u3Referrer.id])).rows[0];
    const rfe3Check = (await db.query('SELECT wallet_balance, wallet_balance_usd FROM users WHERE id = $1', [u3Referee.id])).rows[0];
    assert(parseFloat(ref3Check.wallet_balance) === 200.00, 'Referrer INR balance is ₹200.00 (₹100 + ₹100)');
    assert(parseFloat(rfe3Check.wallet_balance) === 100.00, 'Referee INR balance is ₹100.00 (₹0 + ₹100)');
    assert(parseFloat(ref3Check.wallet_balance_usd) === 0.00, 'Referrer USD balance untouched');
    assert(parseFloat(rfe3Check.wallet_balance_usd) === 0.00, 'Referee USD balance untouched');

    // --------------------------------------------------------------------------
    // CASE 4: Both USD ($2 + $2)
    // --------------------------------------------------------------------------
    console.log('\n--- CASE 4: Referrer = USD, Referee = USD ---');
    const u4Referrer = await createTestUser({
      name: 'Referrer Both USD',
      email: `ref_usd_case4_${timestamp}@example.com`,
      country: 'Canada',
      currency_preference: 'USD',
      wallet_balance: 0.00,
      wallet_balance_usd: 4.00
    });
    const u4Referee = await createTestUser({
      name: 'Referee Both USD',
      email: `ref_usd_rfe4_${timestamp}@example.com`,
      country: 'United States',
      currency_preference: 'USD',
      wallet_balance: 0.00,
      wallet_balance_usd: 1.00
    });

    const tokenCase4 = generateAuthToken(u4Referee.email);
    const resCase4 = await axios.post(
      `${baseURL}/api/referral/claim`,
      { referral_code: u4Referrer.referral_code },
      { headers: { Authorization: `Bearer ${tokenCase4}` } }
    );

    assert(resCase4.status === 200, 'Claim endpoint returned 200 OK');
    assert(resCase4.data.reward === 2, 'Referee reward returned as $2');
    assert(resCase4.data.referrerReward === 2, 'Referrer reward returned as $2');

    const ref4Check = (await db.query('SELECT wallet_balance, wallet_balance_usd FROM users WHERE id = $1', [u4Referrer.id])).rows[0];
    const rfe4Check = (await db.query('SELECT wallet_balance, wallet_balance_usd FROM users WHERE id = $1', [u4Referee.id])).rows[0];
    assert(parseFloat(ref4Check.wallet_balance_usd) === 6.00, 'Referrer USD balance is $6.00 ($4 + $2)');
    assert(parseFloat(rfe4Check.wallet_balance_usd) === 3.00, 'Referee USD balance is $3.00 ($1 + $2)');
    assert(parseFloat(ref4Check.wallet_balance) === 0.00, 'Referrer INR balance untouched');
    assert(parseFloat(rfe4Check.wallet_balance) === 0.00, 'Referee INR balance untouched');

    // --------------------------------------------------------------------------
    // CASE 5: Duplicate Referral Protection (Idempotency)
    // --------------------------------------------------------------------------
    console.log('\n--- CASE 5: Duplicate Referral Claim Safety ---');
    try {
      await axios.post(
        `${baseURL}/api/referral/claim`,
        { referral_code: u4Referrer.referral_code },
        { headers: { Authorization: `Bearer ${tokenCase4}` } }
      );
      assert(false, 'Duplicate claim should have thrown HTTP 400');
    } catch (dupErr) {
      assert(dupErr.response && dupErr.response.status === 400, 'Duplicate claim rejected with HTTP 400');
      assert(dupErr.response.data.error.includes('already claimed'), 'Error states referral already claimed');
    }

    // Verify balances did NOT change after duplicate attempt
    const rfe4CheckAgain = (await db.query('SELECT wallet_balance_usd FROM users WHERE id = $1', [u4Referee.id])).rows[0];
    assert(parseFloat(rfe4CheckAgain.wallet_balance_usd) === 3.00, 'Referee balance remained strictly $3.00 (no duplicate credit)');

    // --------------------------------------------------------------------------
    // CASE 6: Self-Referral Prevention
    // --------------------------------------------------------------------------
    console.log('\n--- CASE 6: Self-Referral Prevention ---');
    const tokenSelf = generateAuthToken(u4Referrer.email);
    try {
      await axios.post(
        `${baseURL}/api/referral/claim`,
        { referral_code: u4Referrer.referral_code },
        { headers: { Authorization: `Bearer ${tokenSelf}` } }
      );
      assert(false, 'Self-referral should have thrown HTTP 400');
    } catch (selfErr) {
      assert(selfErr.response && selfErr.response.status === 400, 'Self-referral rejected with HTTP 400');
      assert(selfErr.response.data.error.includes('own referral code'), 'Error states cannot use own referral code');
    }

    // --------------------------------------------------------------------------
    // CASE 7: Invalid Code Prevention
    // --------------------------------------------------------------------------
    console.log('\n--- CASE 7: Invalid Referral Code Safety ---');
    const uFresh = await createTestUser({
      name: 'Fresh User',
      email: `fresh_${timestamp}@example.com`,
      country: 'India',
      currency_preference: 'INR'
    });
    const tokenFresh = generateAuthToken(uFresh.email);
    try {
      await axios.post(
        `${baseURL}/api/referral/claim`,
        { referral_code: 'NON_EXISTENT_CODE_XYZ' },
        { headers: { Authorization: `Bearer ${tokenFresh}` } }
      );
      assert(false, 'Invalid code should have thrown HTTP 400');
    } catch (invErr) {
      assert(invErr.response && invErr.response.status === 400, 'Invalid code rejected with HTTP 400');
      assert(invErr.response.data.error.includes('Invalid referral code'), 'Error mentions Invalid referral code');
    }

    // --------------------------------------------------------------------------
    // CASE 8: GET /api/referral/info Telemetry & Accurate Sum (NO FX CONVERSION)
    // --------------------------------------------------------------------------
    console.log('\n--- CASE 8: GET /api/referral/info Verification ---');
    // Let's create an INR user who refers two users: one INR user and one USD user
    const masterReferrerINR = await createTestUser({
      name: 'Master Referrer INR',
      email: `master_inr_${timestamp}@example.com`,
      country: 'India',
      currency_preference: 'INR',
      wallet_balance: 0.00
    });

    const friend1INR = await createTestUser({
      name: 'Friend 1 INR',
      email: `friend1_inr_${timestamp}@example.com`,
      country: 'India',
      currency_preference: 'INR'
    });
    const friend2USD = await createTestUser({
      name: 'Friend 2 USD',
      email: `friend2_usd_${timestamp}@example.com`,
      country: 'United States',
      currency_preference: 'USD'
    });

    // Friend 1 claims
    await axios.post(
      `${baseURL}/api/referral/claim`,
      { referral_code: masterReferrerINR.referral_code },
      { headers: { Authorization: `Bearer ${generateAuthToken(friend1INR.email)}` } }
    );
    // Friend 2 claims
    await axios.post(
      `${baseURL}/api/referral/claim`,
      { referral_code: masterReferrerINR.referral_code },
      { headers: { Authorization: `Bearer ${generateAuthToken(friend2USD.email)}` } }
    );

    // Fetch masterReferrerINR info
    const infoRes = await axios.get(
      `${baseURL}/api/referral/info`,
      { headers: { Authorization: `Bearer ${generateAuthToken(masterReferrerINR.email)}` } }
    );

    assert(infoRes.status === 200, 'GET /api/referral/info returned 200');
    assert(infoRes.data.total_referrals === 2, 'Total referrals reported is exactly 2');
    assert(infoRes.data.total_earned === 200, 'Total earned is exactly ₹200 (₹100 + ₹100, NO FX conversion)');
    assert(infoRes.data.currency === 'INR', 'Currency reported as INR');
    assert(infoRes.data.referral_history.length === 2, 'Referral history contains 2 entries');
    assert(infoRes.data.referral_history[0].reward_amount === 100, 'History item 1 reward_amount is 100');
    assert(infoRes.data.referral_history[1].reward_amount === 100, 'History item 2 reward_amount is 100');

    // Also test a USD Referrer who refers an INR user: should earn $2.00 total
    const masterReferrerUSD = await createTestUser({
      name: 'Master Referrer USD',
      email: `master_usd_${timestamp}@example.com`,
      country: 'United States',
      currency_preference: 'USD',
      wallet_balance_usd: 0.00
    });
    const friend3INR = await createTestUser({
      name: 'Friend 3 INR',
      email: `friend3_inr_${timestamp}@example.com`,
      country: 'India',
      currency_preference: 'INR'
    });

    await axios.post(
      `${baseURL}/api/referral/claim`,
      { referral_code: masterReferrerUSD.referral_code },
      { headers: { Authorization: `Bearer ${generateAuthToken(friend3INR.email)}` } }
    );

    const infoUSDRes = await axios.get(
      `${baseURL}/api/referral/info`,
      { headers: { Authorization: `Bearer ${generateAuthToken(masterReferrerUSD.email)}` } }
    );
    assert(infoUSDRes.data.total_referrals === 1, 'USD Referrer total_referrals is 1');
    assert(infoUSDRes.data.total_earned === 2, 'USD Referrer total_earned is exactly $2 (NO FX conversion)');
    assert(infoUSDRes.data.currency === 'USD', 'USD Referrer currency is USD');
    assert(infoUSDRes.data.referral_history[0].reward_currency === 'USD', 'History reward_currency is USD');

    console.log('\n================================================================');
    console.log(`ALL TESTS PASSED! (${passedTests}/${totalTests} assertions passed)`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n❌ TEST SUITE ENCOUNTERED AN ERROR:', err.message);
    if (err.response && err.response.data) {
      console.error('Response Data:', err.response.data);
    }
    process.exitCode = 1;
  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
    // Allow process to finish cleanly
    setTimeout(() => {
      process.exit(process.exitCode || 0);
    }, 500);
  }
}

runTests();
