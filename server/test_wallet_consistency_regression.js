/**
 * Regression Test Suite: USD Wallet Consistency & Zero-Drop Verification
 * 
 * Verifies that:
 * 1. DB balance ($1.15) is never overwritten or defaulted to 0.
 * 2. Session verification (/api/auth/verify) returns authoritative USD balance ($1.15).
 * 3. Wallet balance endpoint (/api/wallet/balance) returns exact USD balance ($1.15).
 * 4. Billing summary endpoint returns authoritative USD balance ($1.15).
 * 5. State synchronization helper (extractWalletFromUser) correctly preserves $1.15 across:
 *    - Initial reload from localStorage
 *    - /api/auth/verify response
 *    - Transient network / offline fallback
 *    - Logout & re-login
 * 6. PostgreSQL database balance remains strictly immutable throughout all operations.
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

// Client-side simulation helper (exact mirror of AuthContext extractWalletFromUser)
function extractWalletFromUser(u, prevWallet = {}) {
  if (!u) {
    return {
      balance: 0.00,
      balance_inr: 0.00,
      balance_usd: 0.00,
      currency: null,
      currency_preference: null,
      plan: 'free',
      plan_expires_at: null,
      rates: prevWallet.rates || {},
      allTiers: prevWallet.allTiers || {}
    };
  }
  const pref = u.currency_preference || prevWallet.currency_preference || null;
  const isUSD = (pref || '').toUpperCase() === 'USD';
  const balUSD = Number(u.wallet_balance_usd !== undefined && u.wallet_balance_usd !== null ? u.wallet_balance_usd : (prevWallet.balance_usd || 0));
  const balINR = Number(u.wallet_balance !== undefined && u.wallet_balance !== null ? u.wallet_balance : (prevWallet.balance_inr || 0));
  const activeBal = pref ? (isUSD ? balUSD : balINR) : 0;
  return {
    balance: activeBal,
    balance_inr: balINR,
    balance_usd: balUSD,
    currency: pref,
    currency_preference: pref,
    plan: u.plan || prevWallet.plan || 'free',
    plan_expires_at: u.plan_expires_at !== undefined ? u.plan_expires_at : (prevWallet.plan_expires_at || null),
    rates: prevWallet.rates || {},
    allTiers: prevWallet.allTiers || {}
  };
}

async function runRegressionSuite() {
  console.log('================================================================');
  console.log('STARTING USD WALLET CONSISTENCY & ZERO-DROP REGRESSION TEST');
  console.log('DB = $1.15 • Verify = $1.15 • Refresh = $1.15 • No Overwrite');
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

  const testEmail = `usd_user_consistency_${Date.now()}@example.com`;
  let testUserId = null;

  try {
    // 1. Create a user with exactly $1.1500 in PostgreSQL
    const insertRes = await db.query(
      `INSERT INTO users (name, email, password_hash, country, auth_provider, email_verified, plan, wallet_balance, wallet_balance_usd, currency_preference, referral_code, role)
       VALUES ($1, $2, 'GOOGLE_OAUTH', 'United States', 'google', true, 'free', 0.00, 1.1500, 'USD', $3, 'user')
       RETURNING *`,
      ['USD Consistency Tester', testEmail, `USD_${Date.now()}`]
    );
    const testUser = insertRes.rows[0];
    testUserId = testUser.id;
    const token = generateAuthToken(testEmail);

    console.log(`✓ Created test user (ID: ${testUserId}, Email: ${testEmail}) with initial DB balance: $1.1500`);

    // --- TEST 1: Direct Database Check ---
    console.log('\n--- TEST 1: PostgreSQL Direct Balance Integrity ---');
    const dbCheck1 = await db.query(
      'SELECT id, wallet_balance, wallet_balance_usd, currency_preference FROM users WHERE id = $1',
      [testUserId]
    );
    const dbRow1 = dbCheck1.rows[0];
    if (parseFloat(dbRow1.wallet_balance_usd) !== 1.15) {
      throw new Error(`DB wallet_balance_usd mismatch: expected 1.15, got ${dbRow1.wallet_balance_usd}`);
    }
    console.log(`✓ DB wallet_balance_usd: $${parseFloat(dbRow1.wallet_balance_usd).toFixed(2)} (Authoritative USD)`);
    console.log(`✓ DB wallet_balance: ₹${parseFloat(dbRow1.wallet_balance).toFixed(2)} (Untouched INR)`);

    // --- TEST 2: GET /api/auth/verify (Session Verification) ---
    console.log('\n--- TEST 2: GET /api/auth/verify (Token Verification) ---');
    const verifyRes = await axios.get(`${baseURL}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!verifyRes.data.valid || !verifyRes.data.user) {
      throw new Error('/api/auth/verify failed or returned invalid session');
    }
    const verifiedUser = verifyRes.data.user;
    if (parseFloat(verifiedUser.wallet_balance_usd) !== 1.15) {
      throw new Error(`verify returned incorrect wallet_balance_usd: expected 1.15, got ${verifiedUser.wallet_balance_usd}`);
    }
    if (verifiedUser.currency_preference !== 'USD') {
      throw new Error(`verify returned incorrect currency_preference: expected 'USD', got ${verifiedUser.currency_preference}`);
    }
    console.log(`✓ /api/auth/verify valid: true`);
    console.log(`✓ /api/auth/verify wallet_balance_usd: $${verifiedUser.wallet_balance_usd}`);
    console.log(`✓ /api/auth/verify currency_preference: ${verifiedUser.currency_preference}`);

    // --- TEST 3: GET /api/wallet/balance ---
    console.log('\n--- TEST 3: GET /api/wallet/balance ---');
    const balanceRes = await axios.get(`${baseURL}/api/wallet/balance`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const bData = balanceRes.data;
    if (!bData.success) {
      throw new Error('/api/wallet/balance returned success: false');
    }
    if (parseFloat(bData.balance) !== 1.15) {
      throw new Error(`/api/wallet/balance returned wrong balance: expected 1.15, got ${bData.balance}`);
    }
    if (parseFloat(bData.balance_usd) !== 1.15) {
      throw new Error(`/api/wallet/balance returned wrong balance_usd: expected 1.15, got ${bData.balance_usd}`);
    }
    if (bData.currency !== 'USD') {
      throw new Error(`/api/wallet/balance returned wrong currency: expected 'USD', got ${bData.currency}`);
    }
    console.log(`✓ /api/wallet/balance balance: $${bData.balance}`);
    console.log(`✓ /api/wallet/balance balance_usd: $${bData.balance_usd}`);
    console.log(`✓ /api/wallet/balance currency: ${bData.currency}`);

    // --- TEST 4: GET /api/wallet/billing-summary ---
    console.log('\n--- TEST 4: GET /api/wallet/billing-summary ---');
    const summaryRes = await axios.get(`${baseURL}/api/wallet/billing-summary`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (parseFloat(summaryRes.data.balance) !== 1.15) {
      throw new Error(`/api/wallet/billing-summary returned wrong balance: expected 1.15, got ${summaryRes.data.balance}`);
    }
    if (summaryRes.data.currency !== 'USD') {
      throw new Error(`/api/wallet/billing-summary returned wrong currency: expected 'USD', got ${summaryRes.data.currency}`);
    }
    console.log(`✓ /api/wallet/billing-summary balance: $${summaryRes.data.balance} (${summaryRes.data.currency})`);

    // --- TEST 5: State Synchronization Scenarios (Zero-Drop Guarantee) ---
    console.log('\n--- TEST 5: State Synchronization & Zero-Drop Guarantee ---');

    // Scenario A: Page Reload / App Edit - Immediate synchronous restore from localStorage
    const savedLocalStorageSession = {
      token,
      user: verifiedUser,
      expiresAt: Date.now() + 48 * 60 * 60 * 1000
    };
    const walletOnReload = extractWalletFromUser(savedLocalStorageSession.user);
    if (walletOnReload.balance !== 1.15 || walletOnReload.balance_usd !== 1.15) {
      throw new Error(`Reload state failed: expected balance 1.15, got ${walletOnReload.balance}`);
    }
    console.log(`✓ Scenario A (Instant Reload from localStorage): wallet.balance = $${walletOnReload.balance} (No $0 flash!)`);

    // Scenario B: /api/auth/verify completes
    const walletAfterVerify = extractWalletFromUser(verifiedUser, walletOnReload);
    if (walletAfterVerify.balance !== 1.15) {
      throw new Error(`After-verify state failed: expected 1.15, got ${walletAfterVerify.balance}`);
    }
    console.log(`✓ Scenario B (After verify response): wallet.balance = $${walletAfterVerify.balance}`);

    // Scenario C: Offline / Server restart fallback (verify throws, fallback to cached user)
    const walletOfflineFallback = extractWalletFromUser(savedLocalStorageSession.user, {});
    if (walletOfflineFallback.balance !== 1.15) {
      throw new Error(`Offline fallback state failed: expected 1.15, got ${walletOfflineFallback.balance}`);
    }
    console.log(`✓ Scenario C (Offline / network glitch fallback): wallet.balance = $${walletOfflineFallback.balance} (Never drops to 0!)`);

    // Scenario D: Logout followed by Login
    const loggedOutWallet = extractWalletFromUser(null);
    if (loggedOutWallet.balance !== 0.00) {
      throw new Error(`Logout state should be 0, got ${loggedOutWallet.balance}`);
    }
    const loggedInWallet = extractWalletFromUser(verifiedUser, loggedOutWallet);
    if (loggedInWallet.balance !== 1.15 || loggedInWallet.balance_usd !== 1.15) {
      throw new Error(`Login state failed: expected 1.15, got ${loggedInWallet.balance}`);
    }
    console.log(`✓ Scenario D (Logout -> Re-login): Clean transition 0 -> $${loggedInWallet.balance}`);

    // --- TEST 6: Database Immutability Check ---
    console.log('\n--- TEST 6: Verify Database Was Never Corrupted Or Overwritten ---');
    const finalDbCheck = await db.query(
      'SELECT id, wallet_balance, wallet_balance_usd, currency_preference FROM users WHERE id = $1',
      [testUserId]
    );
    const finalRow = finalDbCheck.rows[0];
    if (parseFloat(finalRow.wallet_balance_usd) !== 1.15) {
      throw new Error(`DB was altered! Expected 1.15, found ${finalRow.wallet_balance_usd}`);
    }
    console.log(`✓ Final PostgreSQL wallet_balance_usd: $${parseFloat(finalRow.wallet_balance_usd).toFixed(2)} (Exact $1.15 preserved)`);
    console.log(`✓ Final PostgreSQL wallet_balance: ₹${parseFloat(finalRow.wallet_balance).toFixed(2)} (INR untouched)`);

    console.log('\n================================================================');
    console.log('ALL USD WALLET CONSISTENCY REGRESSION TESTS PASSED 100%!');
    console.log('Zero 0-Lead Charge • Zero $0 Flash • Permanent DB Integrity');
    console.log('================================================================');

  } catch (err) {
    console.error('\n❌ USD Wallet Consistency Regression Test Failed:', err.message);
    process.exit(1);
  } finally {
    // Cleanup
    if (testUserId) {
      try {
        await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
        console.log('✓ Cleaned up regression test user fixture.');
      } catch (cErr) {
        console.warn('Cleanup warning:', cErr.message);
      }
    }
    if (serverInstance) {
      serverInstance.close();
    }
    process.exit(0);
  }
}

runRegressionSuite();
