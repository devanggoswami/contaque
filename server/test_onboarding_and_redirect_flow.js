// ==============================================================================
// REGRESSION TEST SUITE: ONBOARDING DETERMINISTIC REDIRECT & REFERRAL BANNER FLOW
// Tests strictly:
// 1. Account 1: Fresh Google Signup → Currency Selection (INR) → Dashboard
//    - Currency popup required initially, disappears after selection
//    - No referral popup anywhere
//    - Referral banner active on Dashboard
//    - Apply valid referral code → ₹100 credited, referral banner marked claimed
// 2. Account 2: Fresh Google Signup → Currency Selection (USD) → Dashboard
//    - Currency popup required initially, disappears after USD selection ($2 credit)
//    - User dismisses referral banner (x) → marked dismissed
//    - Refresh verification: referral banner remains dismissed, currency modal remains closed
// 3. Account 3: Existing User Login → Immediate Dashboard
//    - Currency popup never appears (already chosen)
//    - No referral popup
//    - Direct access to Dashboard without bouncing to landing page
// ==============================================================================

const axios = require('axios');
const crypto = require('crypto');
const db = require('./db');
const { app } = require('./index');

let serverInstance;
let baseURL;

function generateTestToken(email) {
  const jwtSecret = process.env.JWT_SECRET || 'contaque_jwt_development_secret_key_change_in_production';
  const expiresAt = Date.now() + 48 * 60 * 60 * 1000;
  const payload = `${email}:${expiresAt}`;
  const signature = crypto.createHmac('sha256', jwtSecret).update(payload).digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64');
}

async function runOnboardingTestSuite() {
  console.log('================================================================');
  console.log('STARTING DETERMINISTIC ONBOARDING & REFERRAL BANNER TEST SUITE');
  console.log('================================================================\n');

  await db.initDb();

  // Start test server on random free port
  await new Promise((resolve) => {
    serverInstance = app.listen(0, () => {
      const port = serverInstance.address().port;
      baseURL = `http://127.0.0.1:${port}`;
      console.log(`✓ Test server running on ${baseURL}\n`);
      resolve();
    });
  });

  const timestamp = Date.now();
  const referrerEmail = `referrer_${timestamp}@example.com`;
  const account1Email = `fresh_acct_a_${timestamp}@example.com`;
  const account2Email = `fresh_acct_b_${timestamp}@example.com`;
  const account3Email = `existing_acct_c_${timestamp}@example.com`;

  try {
    // 0. Setup Referrer User
    await db.query(
      `INSERT INTO users (name, email, password_hash, country, plan, wallet_balance, currency_preference, referral_code)
       VALUES ($1, $2, 'test_hash', 'India', 'free', 100.00, 'INR', $3)`,
      ['Referrer Host', referrerEmail, `REF_${timestamp.toString().slice(-6)}`]
    );
    const referrerRow = (await db.query('SELECT * FROM users WHERE email = $1', [referrerEmail])).rows[0];
    const validReferralCode = referrerRow.referral_code;
    console.log(`✓ Seeded referrer user (${referrerEmail}) with referral code: ${validReferralCode}`);

    // ==========================================================================
    // ACCOUNT 1: Signup → Currency (INR) → Dashboard → Referral Header Claim
    // ==========================================================================
    console.log('\n--- SCENARIO 1: ACCOUNT 1 (FRESH SIGNUP → INR CURRENCY → DASHBOARD) ---');
    await db.query(
      `INSERT INTO users (name, email, password_hash, country, plan, wallet_balance, wallet_balance_usd, currency_preference, email_verified, auth_provider)
       VALUES ($1, $2, 'test_hash', 'India', 'free', 0.00, 0.00, NULL, TRUE, 'google')`,
      ['Fresh Account A', account1Email]
    );

    const token1 = generateTestToken(account1Email);

    // 1. Initial State Check: Currency selection modal MUST be active
    const verify1 = await axios.get(`${baseURL}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    if (!verify1.data.valid || verify1.data.user.currency_preference !== null) {
      throw new Error(`Expected currency_preference to be null before selection, got: ${verify1.data.user.currency_preference}`);
    }
    const isCurrencyModalOpen1 = Boolean(verify1.data.user && !verify1.data.user.currency_preference);
    console.log(`✓ Account 1 currency modal required: isCurrencyModalOpen = ${isCurrencyModalOpen1}`);

    // 2. Select Currency INR
    const prefRes1 = await axios.post(
      `${baseURL}/api/user/currency-preference`,
      { currency: 'INR' },
      { headers: { Authorization: `Bearer ${token1}` } }
    );
    if (!prefRes1.data.success || prefRes1.data.currency_preference !== 'INR' || prefRes1.data.balance !== 50) {
      throw new Error(`Currency selection failed for Account 1: ${JSON.stringify(prefRes1.data)}`);
    }
    console.log(`✓ Account 1 selected INR: Balance = ₹${prefRes1.data.balance}, Currency = ${prefRes1.data.currency_preference}`);

    // 3. Verify Currency modal unmounts and Dashboard is accessible
    const postPrefVerify1 = await axios.get(`${baseURL}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const isCurrencyModalOpenAfter1 = Boolean(postPrefVerify1.data.user && !postPrefVerify1.data.user.currency_preference);
    if (isCurrencyModalOpenAfter1) {
      throw new Error('Currency modal should be closed after selecting currency preference');
    }
    console.log(`✓ Account 1 currency modal closed: isCurrencyModalOpen = ${isCurrencyModalOpenAfter1}`);

    // Dashboard Telemetry is reachable
    const dash1 = await axios.get(`${baseURL}/api/dashboard`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    if (dash1.status !== 200) throw new Error('Dashboard telemetry endpoint unreachable');
    console.log('✓ Account 1 reaches /dashboard successfully (no bounce to landing page)');

    // 4. Referral Banner Visibility Check
    const refInfo1 = await axios.get(`${baseURL}/api/referral/info`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const showReferralBanner1 = !refInfo1.data.has_claimed && refInfo1.data.should_show_popup;
    if (!showReferralBanner1) throw new Error('Referral header should be visible on dashboard for new user');
    console.log('✓ Account 1 referral header banner is active on dashboard (no automatic modal popup)');

    // 5. Account 1 claims valid referral code
    const claimRes1 = await axios.post(
      `${baseURL}/api/referral/claim`,
      { referral_code: validReferralCode },
      { headers: { Authorization: `Bearer ${token1}` } }
    );
    if (!claimRes1.data.success || claimRes1.data.reward !== 100) {
      throw new Error(`Failed to claim referral reward: ${JSON.stringify(claimRes1.data)}`);
    }
    console.log(`✓ Account 1 referral claimed: ₹${claimRes1.data.reward} credited. New balance = ₹${claimRes1.data.newBalance}`);

    // Check that referral banner is now marked claimed
    const postClaimInfo1 = await axios.get(`${baseURL}/api/referral/info`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    if (!postClaimInfo1.data.has_claimed) throw new Error('Expected has_claimed to be true after claiming');
    console.log('✓ Account 1 referral banner is permanently hidden (has_claimed = true)');


    // ==========================================================================
    // ACCOUNT 2: Signup → Currency (USD) → Dashboard → Close (x) Dismiss
    // ==========================================================================
    console.log('\n--- SCENARIO 2: ACCOUNT 2 (FRESH SIGNUP → USD CURRENCY → DISMISS BANNER → REFRESH) ---');
    await db.query(
      `INSERT INTO users (name, email, password_hash, country, plan, wallet_balance, wallet_balance_usd, currency_preference, email_verified, auth_provider)
       VALUES ($1, $2, 'test_hash', 'United States', 'free', 0.00, 0.00, NULL, TRUE, 'google')`,
      ['Fresh Account B', account2Email]
    );

    const token2 = generateTestToken(account2Email);

    // 1. Initial State Check
    const verify2 = await axios.get(`${baseURL}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${token2}` }
    });
    if (verify2.data.user.currency_preference !== null) {
      throw new Error('Expected currency_preference to be null before selection');
    }
    console.log('✓ Account 2 currency modal required initially');

    // 2. Select USD
    const prefRes2 = await axios.post(
      `${baseURL}/api/user/currency-preference`,
      { currency: 'USD' },
      { headers: { Authorization: `Bearer ${token2}` } }
    );
    if (!prefRes2.data.success || prefRes2.data.currency_preference !== 'USD' || prefRes2.data.balance !== 2) {
      throw new Error(`USD selection failed for Account 2: ${JSON.stringify(prefRes2.data)}`);
    }
    console.log(`✓ Account 2 selected USD: Balance = $${prefRes2.data.balance}, Currency = ${prefRes2.data.currency_preference}`);

    // 3. User closes (x) referral header banner
    const dismissRes2 = await axios.post(
      `${baseURL}/api/referral/dismiss`,
      {},
      { headers: { Authorization: `Bearer ${token2}` } }
    );
    if (!dismissRes2.data.success) throw new Error('Failed to dismiss referral header');
    console.log('✓ Account 2 closed referral header banner: Dismiss API succeeded');

    // 4. Simulated Page Refresh: Verify session and persistent dismiss
    const refreshVerify2 = await axios.get(`${baseURL}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${token2}` }
    });
    if (!refreshVerify2.data.user.referral_prompt_dismissed) {
      throw new Error('Expected referral_prompt_dismissed to be TRUE after refresh');
    }
    const isCurrencyModalOpenAfterRefresh2 = Boolean(refreshVerify2.data.user && !refreshVerify2.data.user.currency_preference);
    if (isCurrencyModalOpenAfterRefresh2) {
      throw new Error('Currency modal should stay closed after refresh');
    }

    const refreshRefInfo2 = await axios.get(`${baseURL}/api/referral/info`, {
      headers: { Authorization: `Bearer ${token2}` }
    });
    if (refreshRefInfo2.data.should_show_popup) {
      throw new Error('Referral header banner should stay hidden after page refresh');
    }
    console.log('✓ Account 2 after refresh: Currency modal remains closed, Referral header remains hidden');


    // ==========================================================================
    // ACCOUNT 3: Existing User (Logout → Google Login → Dashboard)
    // ==========================================================================
    console.log('\n--- SCENARIO 3: ACCOUNT 3 (EXISTING USER RE-LOGIN → DIRECT DASHBOARD) ---');
    await db.query(
      `INSERT INTO users (name, email, password_hash, country, plan, wallet_balance, wallet_balance_usd, currency_preference, email_verified, auth_provider, referral_prompt_dismissed)
       VALUES ($1, $2, 'test_hash', 'India', 'plus', 250.00, 0.00, 'INR', TRUE, 'google', TRUE)`,
      ['Existing Account C', account3Email]
    );

    const token3 = generateTestToken(account3Email);

    // Verify session on re-login
    const verify3 = await axios.get(`${baseURL}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${token3}` }
    });
    if (!verify3.data.valid || verify3.data.user.currency_preference !== 'INR') {
      throw new Error('Existing user re-login verification failed');
    }
    const isCurrencyModalOpen3 = Boolean(verify3.data.user && !verify3.data.user.currency_preference);
    if (isCurrencyModalOpen3) {
      throw new Error('Existing user must NEVER see currency selection modal');
    }

    const refInfo3 = await axios.get(`${baseURL}/api/referral/info`, {
      headers: { Authorization: `Bearer ${token3}` }
    });
    if (refInfo3.data.should_show_popup) {
      throw new Error('Existing user who dismissed referral banner must not see referral prompt');
    }

    const dash3 = await axios.get(`${baseURL}/api/dashboard`, {
      headers: { Authorization: `Bearer ${token3}` }
    });
    if (dash3.status !== 200) throw new Error('Existing user dashboard unreachable');

    console.log('✓ Account 3 re-login: Opens /dashboard directly with 0 popups');

    console.log('\n================================================================');
    console.log('ALL 3 ONBOARDING, DETERMINISTIC REDIRECT & REFERRAL TESTS PASSED!');
    console.log('================================================================\n');

    process.exit(0);
  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
  }
}

runOnboardingTestSuite().catch(err => {
  console.error('\n❌ Test Suite Failed:', err.message);
  process.exit(1);
});
