// ==============================================================================
// REGRESSION TEST SUITE: WELCOME CREDIT INITIALIZATION & CURRENCY SELECTION FLOW
// Proves strictly that:
// 1. New user before currency selection → no INR/USD welcome credit (balance 0, pending).
// 2. Select INR → exactly ₹50 once.
// 3. Select USD → exactly $2 once.
// 4. Repeated currency-selection API call → no duplicate credit.
// 5. Refresh after selection → same balance, no duplicate credit.
// 6. Existing INR user with ₹50 → remains ₹50.
// 7. Existing USD user with $2 → remains $2.
// ==============================================================================

const http = require('http');
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

async function runWelcomeCreditTestSuite() {
  console.log('================================================================');
  console.log('STARTING WELCOME CREDIT INITIALIZATION & CURRENCY FLOW TEST SUITE');
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
  const createdUserIds = [];

  try {
    // --------------------------------------------------------------------------
    // TEST 1: New user before currency selection → NO INR/USD welcome credit
    // --------------------------------------------------------------------------
    console.log('--- TEST 1: NEW USER BEFORE CURRENCY SELECTION (NO WELCOME CREDIT) ---');
    const user1Email = `user1_pending_${timestamp}@example.com`;
    const user1Res = await db.query(
      `INSERT INTO users (name, email, password_hash, country, auth_provider, email_verified, plan, wallet_balance, wallet_balance_usd, currency_preference, referral_code, role)
       VALUES ('Pending User', $1, 'GOOGLE_OAUTH', 'India', 'google', true, 'free', 0.00, 0.00, NULL, 'CQPEN1', 'user')
       RETURNING *`,
      [user1Email]
    );
    const user1 = user1Res.rows[0];
    createdUserIds.push(user1.id);
    const user1Token = generateTestToken(user1Email);

    // Call GET /api/wallet/balance before selection
    const balRes1 = await axios.get(`${baseURL}/api/wallet/balance`, {
      headers: { Authorization: `Bearer ${user1Token}` }
    });

    if (balRes1.data.currency_preference !== null) {
      throw new Error(`Expected currency_preference=null before selection, got: ${balRes1.data.currency_preference}`);
    }
    if (Number(balRes1.data.balance) !== 0) {
      throw new Error(`Expected wallet balance=0 before selection, got: ${balRes1.data.balance}`);
    }
    if (Number(balRes1.data.balance_inr) !== 0 || Number(balRes1.data.balance_usd) !== 0) {
      throw new Error(`Expected balance_inr=0 and balance_usd=0, got inr=${balRes1.data.balance_inr}, usd=${balRes1.data.balance_usd}`);
    }

    // Check database ledgers
    const ledgerINR1 = await db.query("SELECT * FROM wallet_ledger WHERE user_id = $1", [user1.id]);
    const ledgerUSD1 = await db.query("SELECT * FROM wallet_ledger_usd WHERE user_id = $1", [user1.id]);
    if (ledgerINR1.rows.length > 0 || ledgerUSD1.rows.length > 0) {
      throw new Error('Ledger entries found before currency selection!');
    }
    console.log('✓ New user has 0.00 INR and 0.0000 USD balance, currency_preference=null, 0 ledger entries');

    // --------------------------------------------------------------------------
    // TEST 2: Select INR → exactly ₹50 once
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 2: SELECT INR → EXACTLY ₹50 ONCE ---');
    const inrSelectRes = await axios.post(
      `${baseURL}/api/user/currency-preference`,
      { currency: 'INR' },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );

    if (inrSelectRes.data.currency_preference !== 'INR') {
      throw new Error(`Expected currency_preference=INR, got ${inrSelectRes.data.currency_preference}`);
    }
    if (Number(inrSelectRes.data.wallet_balance) !== 50 || Number(inrSelectRes.data.balance) !== 50) {
      throw new Error(`Expected wallet_balance=50, got ${inrSelectRes.data.wallet_balance}`);
    }
    if (Number(inrSelectRes.data.wallet_balance_usd) !== 0) {
      throw new Error(`Expected wallet_balance_usd=0, got ${inrSelectRes.data.wallet_balance_usd}`);
    }

    // Verify in database
    const dbUser1 = await db.query('SELECT wallet_balance, wallet_balance_usd, currency_preference FROM users WHERE id = $1', [user1.id]);
    if (Number(dbUser1.rows[0].wallet_balance) !== 50) {
      throw new Error(`DB wallet_balance is not 50: ${dbUser1.rows[0].wallet_balance}`);
    }
    if (Number(dbUser1.rows[0].wallet_balance_usd) !== 0) {
      throw new Error(`DB wallet_balance_usd is not 0: ${dbUser1.rows[0].wallet_balance_usd}`);
    }
    const dbLedgerINR1 = await db.query("SELECT * FROM wallet_ledger WHERE user_id = $1 AND reference_id = 'WELCOME_BONUS'", [user1.id]);
    if (dbLedgerINR1.rows.length !== 1) {
      throw new Error(`Expected exactly 1 INR welcome bonus ledger, found: ${dbLedgerINR1.rows.length}`);
    }
    console.log('✓ INR selection granted exactly ₹50 welcome credit once, USD balance untouched at 0.00');

    // --------------------------------------------------------------------------
    // TEST 3: Select USD → exactly $2 once (for a fresh user)
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 3: SELECT USD → EXACTLY $2 ONCE ---');
    const user2Email = `user2_usd_${timestamp}@example.com`;
    const user2Res = await db.query(
      `INSERT INTO users (name, email, password_hash, country, auth_provider, email_verified, plan, wallet_balance, wallet_balance_usd, currency_preference, referral_code, role)
       VALUES ('USD User', $1, 'GOOGLE_OAUTH', 'United States', 'google', true, 'free', 0.00, 0.00, NULL, 'CQUSD2', 'user')
       RETURNING *`,
      [user2Email]
    );
    const user2 = user2Res.rows[0];
    createdUserIds.push(user2.id);
    const user2Token = generateTestToken(user2Email);

    const usdSelectRes = await axios.post(
      `${baseURL}/api/user/currency-preference`,
      { currency: 'USD' },
      { headers: { Authorization: `Bearer ${user2Token}` } }
    );

    if (usdSelectRes.data.currency_preference !== 'USD') {
      throw new Error(`Expected currency_preference=USD, got ${usdSelectRes.data.currency_preference}`);
    }
    if (Number(usdSelectRes.data.wallet_balance_usd) !== 2 || Number(usdSelectRes.data.balance) !== 2) {
      throw new Error(`Expected wallet_balance_usd=2, got ${usdSelectRes.data.wallet_balance_usd}`);
    }
    if (Number(usdSelectRes.data.wallet_balance) !== 0) {
      throw new Error(`Expected INR wallet_balance=0 (no temporary ₹50 created), got ${usdSelectRes.data.wallet_balance}`);
    }

    // Verify in database
    const dbUser2 = await db.query('SELECT wallet_balance, wallet_balance_usd, currency_preference FROM users WHERE id = $1', [user2.id]);
    if (Number(dbUser2.rows[0].wallet_balance_usd) !== 2) {
      throw new Error(`DB wallet_balance_usd is not 2: ${dbUser2.rows[0].wallet_balance_usd}`);
    }
    if (Number(dbUser2.rows[0].wallet_balance) !== 0) {
      throw new Error(`DB wallet_balance is not 0: ${dbUser2.rows[0].wallet_balance}`);
    }
    const dbLedgerUSD2 = await db.query("SELECT * FROM wallet_ledger_usd WHERE user_id = $1 AND reference_id = 'WELCOME_BONUS'", [user2.id]);
    const dbLedgerINR2 = await db.query("SELECT * FROM wallet_ledger WHERE user_id = $1", [user2.id]);
    if (dbLedgerUSD2.rows.length !== 1) {
      throw new Error(`Expected exactly 1 USD welcome bonus ledger, found: ${dbLedgerUSD2.rows.length}`);
    }
    if (dbLedgerINR2.rows.length !== 0) {
      throw new Error(`Found unexpected INR ledger for USD user: ${dbLedgerINR2.rows.length}`);
    }
    console.log('✓ USD selection granted exactly $2 welcome credit once, INR balance untouched at 0.00 (no temp ₹50)');

    // --------------------------------------------------------------------------
    // TEST 4: Repeated currency-selection API call → NO duplicate credit
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 4: REPEATED CURRENCY-SELECTION API CALL (NO DUPLICATE) ---');
    // Call USD selection again on user2
    const repeatRes1 = await axios.post(
      `${baseURL}/api/user/currency-preference`,
      { currency: 'USD' },
      { headers: { Authorization: `Bearer ${user2Token}` } }
    );
    if (Number(repeatRes1.data.wallet_balance_usd) !== 2) {
      throw new Error(`Repeated call changed balance: ${repeatRes1.data.wallet_balance_usd}`);
    }

    // Call INR selection on user1 again
    const repeatRes2 = await axios.post(
      `${baseURL}/api/user/currency-preference`,
      { currency: 'INR' },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    if (Number(repeatRes2.data.wallet_balance) !== 50) {
      throw new Error(`Repeated call changed balance: ${repeatRes2.data.wallet_balance}`);
    }

    // Check ledgers still have exactly 1 record each
    const repeatLedgerUSD = await db.query("SELECT * FROM wallet_ledger_usd WHERE user_id = $1 AND reference_id = 'WELCOME_BONUS'", [user2.id]);
    const repeatLedgerINR = await db.query("SELECT * FROM wallet_ledger WHERE user_id = $1 AND reference_id = 'WELCOME_BONUS'", [user1.id]);
    if (repeatLedgerUSD.rows.length !== 1 || repeatLedgerINR.rows.length !== 1) {
      throw new Error('Duplicate ledger entries found after repeated calls!');
    }
    console.log('✓ Repeated currency selection requests preserve exact single bonus without duplicate credits');

    // --------------------------------------------------------------------------
    // TEST 5: Refresh after selection → same balance, no duplicate credit
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 5: REFRESH AFTER SELECTION (GET /api/wallet/balance) ---');
    const refreshUSD = await axios.get(`${baseURL}/api/wallet/balance`, {
      headers: { Authorization: `Bearer ${user2Token}` }
    });
    if (Number(refreshUSD.data.balance) !== 2 || refreshUSD.data.currency !== 'USD') {
      throw new Error(`USD refresh returned invalid balance: ${refreshUSD.data.balance}`);
    }

    const refreshINR = await axios.get(`${baseURL}/api/wallet/balance`, {
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    if (Number(refreshINR.data.balance) !== 50 || refreshINR.data.currency !== 'INR') {
      throw new Error(`INR refresh returned invalid balance: ${refreshINR.data.balance}`);
    }
    console.log('✓ Refresh (GET /api/wallet/balance) returns identical balance without altering state');

    // --------------------------------------------------------------------------
    // TEST 6: Existing INR user with ₹50 → remains ₹50
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 6: EXISTING INR USER WITH ₹50 REMAINS ₹50 ---');
    const existINREmail = `exist_inr_${timestamp}@example.com`;
    const existINRRes = await db.query(
      `INSERT INTO users (name, email, password_hash, country, auth_provider, email_verified, plan, wallet_balance, wallet_balance_usd, currency_preference, referral_code, role)
       VALUES ('Existing INR User', $1, 'GOOGLE_OAUTH', 'India', 'google', true, 'plus', 50.00, 0.00, 'INR', 'CQEXINR', 'user')
       RETURNING *`,
      [existINREmail]
    );
    const existINRUser = existINRRes.rows[0];
    createdUserIds.push(existINRUser.id);
    const existINRToken = generateTestToken(existINREmail);

    const existINRBal = await axios.get(`${baseURL}/api/wallet/balance`, {
      headers: { Authorization: `Bearer ${existINRToken}` }
    });
    if (Number(existINRBal.data.balance) !== 50 || existINRBal.data.currency !== 'INR') {
      throw new Error(`Existing INR user balance altered: ${existINRBal.data.balance}`);
    }
    console.log('✓ Existing INR user balance untouched at ₹50.00');

    // --------------------------------------------------------------------------
    // TEST 7: Existing USD user with $2 → remains $2
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 7: EXISTING USD USER WITH $2 REMAINS $2 ---');
    const existUSDEmail = `exist_usd_${timestamp}@example.com`;
    const existUSDRes = await db.query(
      `INSERT INTO users (name, email, password_hash, country, auth_provider, email_verified, plan, wallet_balance, wallet_balance_usd, currency_preference, referral_code, role)
       VALUES ('Existing USD User', $1, 'GOOGLE_OAUTH', 'United States', 'google', true, 'pack', 0.00, 2.0000, 'USD', 'CQEXUSD', 'user')
       RETURNING *`,
      [existUSDEmail]
    );
    const existUSDUser = existUSDRes.rows[0];
    createdUserIds.push(existUSDUser.id);
    const existUSDToken = generateTestToken(existUSDEmail);

    const existUSDBal = await axios.get(`${baseURL}/api/wallet/balance`, {
      headers: { Authorization: `Bearer ${existUSDToken}` }
    });
    if (Number(existUSDBal.data.balance) !== 2 || existUSDBal.data.currency !== 'USD') {
      throw new Error(`Existing USD user balance altered: ${existUSDBal.data.balance}`);
    }
    console.log('✓ Existing USD user balance untouched at $2.00');

    console.log('\n================================================================');
    console.log('ALL 7/7 WELCOME CREDIT INITIALIZATION TESTS PASSED PERFECTLY!');
    console.log('================================================================');

  } finally {
    if (createdUserIds.length > 0) {
      try {
        await db.query('DELETE FROM users WHERE id = ANY($1::int[])', [createdUserIds]);
      } catch {}
    }
    if (serverInstance) {
      serverInstance.close();
    }
  }
}

runWelcomeCreditTestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ WELCOME CREDIT TEST SUITE FAILED:', err.message);
    if (err.response) {
      console.error('Response Status:', err.response.status);
      console.error('Response Data:', err.response.data);
    }
    process.exit(1);
  });
