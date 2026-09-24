// ==============================================================================
// REGRESSION TEST SUITE: AUTHENTICATION, DATABASE ROLES & ACCESS AUTHORIZATION
// Proves strictly that normal users NEVER receive administrator access.
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

async function runAuthSecurityTestSuite() {
  console.log('================================================================');
  console.log('STARTING CRITICAL AUTH & ROLE SECURITY VERIFICATION TEST SUITE');
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
  const testUserEmail = `sec_user_${timestamp}@example.com`;
  const testUserPassword = 'SecurePassword123!';
  let normalUserId = null;
  let normalUserToken = null;
  let verificationToken = null;

  try {
    // --------------------------------------------------------------------------
    // TEST 1: New Email/Password Signup → Verification → Normal USER Access
    // --------------------------------------------------------------------------
    console.log('--- TEST 1: NEW EMAIL/PASSWORD SIGNUP & VERIFICATION ---');
    const signupRes = await axios.post(`${baseURL}/api/auth/signup`, {
      name: 'Security Test User',
      email: testUserEmail,
      password: testUserPassword,
      country: 'India'
    });

    if (signupRes.status !== 200 || !signupRes.data.success) {
      throw new Error(`Signup failed: ${JSON.stringify(signupRes.data)}`);
    }

    const signupUser = signupRes.data.user;
    normalUserId = signupUser.id;
    normalUserToken = signupRes.data.token;

    console.log(`✓ Signup successful: ID=${signupUser.id}, Email=${signupUser.email}`);
    if (signupUser.role !== 'User') {
      throw new Error(`CRITICAL SECURITY FAILURE: Signup returned role="${signupUser.role}", expected "User"`);
    }
    if (signupUser.isAdmin !== false) {
      throw new Error(`CRITICAL SECURITY FAILURE: Signup returned isAdmin=${signupUser.isAdmin}, expected false`);
    }
    if (signupUser.email_verified !== false) {
      throw new Error(`Expected email_verified=false prior to email confirmation, got ${signupUser.email_verified}`);
    }
    console.log('✓ Signup response strictly enforces role="User" and isAdmin=false');

    // Retrieve single-use email verification token from database
    const dbTokenRes = await db.query('SELECT email_verification_token, role FROM users WHERE id = $1', [normalUserId]);
    verificationToken = dbTokenRes.rows[0].email_verification_token;
    const dbRoleInitial = dbTokenRes.rows[0].role;

    if (!verificationToken) {
      throw new Error('Verification token was not generated in the database');
    }
    if (dbRoleInitial !== 'user') {
      throw new Error(`Database role mismatch: expected "user", got "${dbRoleInitial}"`);
    }
    console.log(`✓ Database record created with explicit role="${dbRoleInitial}"`);

    // Verify email using server endpoint
    const verifyRes = await axios.post(`${baseURL}/api/auth/verify-email-token`, {
      token: verificationToken
    });

    if (verifyRes.status !== 200 || !verifyRes.data.success) {
      throw new Error(`Verification endpoint failed: ${JSON.stringify(verifyRes.data)}`);
    }

    const verifiedUser = verifyRes.data.user;
    const verifiedToken = verifyRes.data.token;

    if (!verifiedToken) {
      throw new Error('Verification endpoint failed to return authentic session token for verified user');
    }
    if (verifiedUser.role !== 'User') {
      throw new Error(`CRITICAL SECURITY FAILURE: Verification endpoint returned role="${verifiedUser.role}", expected "User"`);
    }
    if (verifiedUser.isAdmin !== false) {
      throw new Error(`CRITICAL SECURITY FAILURE: Verification endpoint returned isAdmin=${verifiedUser.isAdmin}, expected false`);
    }
    if (verifiedUser.email_verified !== true) {
      throw new Error('Verification endpoint failed to set email_verified=true');
    }
    console.log('✓ Verification returns authentic JWT and strictly maintains role="User" and isAdmin=false');

    // Update normalUserToken to the verified token
    normalUserToken = verifiedToken;

    // Verify session with GET /api/auth/verify
    const authVerifyRes = await axios.get(`${baseURL}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${normalUserToken}` }
    });
    if (authVerifyRes.data.user.role !== 'User' || authVerifyRes.data.user.isAdmin !== false) {
      throw new Error('GET /api/auth/verify returned admin claims for normal user');
    }
    console.log('✓ GET /api/auth/verify confirms database role is "User" and isAdmin=false');

    // --------------------------------------------------------------------------
    // TEST 2: New Google Signup → Normal USER Access
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 2: NEW GOOGLE USER SIGNUP ---');
    const googleEmail = `google_user_${timestamp}@example.com`;
    const googleRefCode = 'CQ' + crypto.randomBytes(3).toString('hex').toUpperCase();
    // Simulate internal creation for Google user with 'user' role
    const googleUserRes = await db.query(
      `INSERT INTO users (name, email, password_hash, country, auth_provider, email_verified, plan, wallet_balance, wallet_balance_usd, currency_preference, referral_code, referral_claimed, referral_prompt_dismissed, role)
       VALUES ('Google Test User', $1, 'GOOGLE_OAUTH', 'India', 'google', true, 'free', 50.00, 0.00, NULL, $2, false, false, 'user')
       RETURNING *`,
      [googleEmail, googleRefCode]
    );
    const googleUser = googleUserRes.rows[0];
    const googleToken = generateTestToken(googleEmail);

    const googleVerifyRes = await axios.get(`${baseURL}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${googleToken}` }
    });

    if (googleVerifyRes.data.user.role !== 'User' || googleVerifyRes.data.user.isAdmin !== false) {
      throw new Error(`CRITICAL SECURITY FAILURE: Google user resolved to role="${googleVerifyRes.data.user.role}"`);
    }
    console.log(`✓ Google signup user (ID: ${googleUser.id}) has database role="${googleUser.role}" and resolves to role="User", isAdmin=false`);

    // --------------------------------------------------------------------------
    // TEST 3: Currency Selection After Verification → Still USER
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 3: CURRENCY SELECTION AFTER VERIFICATION ---');
    const currSelectRes = await axios.post(
      `${baseURL}/api/user/currency-preference`,
      { currency: 'USD', currency_preference: 'USD' },
      { headers: { Authorization: `Bearer ${normalUserToken}` } }
    );

    if (currSelectRes.status !== 200 || !currSelectRes.data.success) {
      throw new Error(`Currency preference update failed: ${JSON.stringify(currSelectRes.data)}`);
    }
    console.log(`✓ Currency preference successfully set to USD with $2 trial credit (USD balance: ${currSelectRes.data.wallet_balance_usd})`);

    // Verify session after currency preference update
    const verifyAfterCurrRes = await axios.get(`${baseURL}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${normalUserToken}` }
    });

    const userAfterCurr = verifyAfterCurrRes.data.user;
    if (userAfterCurr.role !== 'User') {
      throw new Error(`CRITICAL SECURITY FAILURE: Currency update altered role to "${userAfterCurr.role}"`);
    }
    if (userAfterCurr.isAdmin !== false) {
      throw new Error(`CRITICAL SECURITY FAILURE: Currency update altered isAdmin to ${userAfterCurr.isAdmin}`);
    }
    if (userAfterCurr.id !== normalUserId) {
      throw new Error(`CRITICAL SECURITY FAILURE: User ID shifted from ${normalUserId} to ${userAfterCurr.id}`);
    }
    console.log(`✓ Post-currency selection check: ID=${userAfterCurr.id}, role="${userAfterCurr.role}", isAdmin=${userAfterCurr.isAdmin} (STILL USER)`);

    // --------------------------------------------------------------------------
    // TEST 4: Administrator Login → ADMIN Access
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 4: ADMINISTRATOR LOGIN & PERMISSIONS ---');
    const adminEmail = (process.env.ADMIN_USER || 'gdevang950@gmail.com').trim().toLowerCase();
    const adminPass = process.env.ADMIN_PASSWORD || '2112@Dev';

    const adminLoginRes = await axios.post(`${baseURL}/api/auth/login`, {
      email: adminEmail,
      password: adminPass
    });

    if (adminLoginRes.status !== 200 || !adminLoginRes.data.success) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLoginRes.data)}`);
    }

    const adminUser = adminLoginRes.data.user;
    const adminToken = adminLoginRes.data.token;

    if (adminUser.role !== 'Administrator') {
      throw new Error(`Expected Admin role="Administrator", got "${adminUser.role}"`);
    }
    if (adminUser.isAdmin !== true && adminUser.email.toLowerCase() !== adminEmail) {
      throw new Error('Admin user was not granted administrator privileges');
    }
    console.log(`✓ Admin login successful: Email=${adminUser.email}, role="${adminUser.role}", isAdmin=true`);

    // Verify admin session with GET /api/auth/verify
    const adminVerifyRes = await axios.get(`${baseURL}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (adminVerifyRes.data.user.role !== 'Administrator' || adminVerifyRes.data.user.isAdmin !== true) {
      throw new Error('Admin session verification failed');
    }
    console.log('✓ Admin session verification confirms Administrator role');

    // --------------------------------------------------------------------------
    // TEST 5: Normal User Cannot Access /api/admin/* (Strict 403 Forbidden)
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 5: NORMAL USER STRICTLY BLOCKED FROM /api/admin/* ---');
    let blockedCount = 0;
    const testAdminEndpoints = [
      '/api/admin/users/search?q=test',
      '/api/admin/users/1'
    ];

    for (const ep of testAdminEndpoints) {
      try {
        await axios.get(`${baseURL}${ep}`, {
          headers: { Authorization: `Bearer ${normalUserToken}` }
        });
        throw new Error(`CRITICAL SECURITY BREACH: Normal user accessed ${ep} with 200 OK!`);
      } catch (err) {
        if (err.response && err.response.status === 403) {
          blockedCount++;
          console.log(`✓ Blocked normal user from ${ep} with HTTP 403 Forbidden`);
        } else {
          throw err;
        }
      }
    }

    // Verify Admin CAN access /api/admin/*
    const adminAccessRes = await axios.get(`${baseURL}/api/admin/users/search?q=test`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (adminAccessRes.status !== 200) {
      throw new Error('Admin failed to access /api/admin/users/search');
    }
    console.log('✓ Legitimate Administrator CAN access /api/admin/users/search (HTTP 200 OK)');

    // --------------------------------------------------------------------------
    // TEST 6: Changing INR/USD Cannot Change Role or User ID
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 6: CURRENCY TOGGLING DOES NOT TAMPER WITH ROLE OR USER ID ---');
    await axios.post(
      `${baseURL}/api/user/currency-preference`,
      { currency: 'INR', currency_preference: 'INR' },
      { headers: { Authorization: `Bearer ${normalUserToken}` } }
    );

    const checkINRRes = await db.query('SELECT id, email, role, currency_preference FROM users WHERE id = $1', [normalUserId]);
    const inrUser = checkINRRes.rows[0];
    if (inrUser.id !== normalUserId || inrUser.role !== 'user' || inrUser.currency_preference !== 'INR') {
      throw new Error(`Tampering detected after INR switch: ${JSON.stringify(inrUser)}`);
    }

    await axios.post(
      `${baseURL}/api/user/currency-preference`,
      { currency: 'USD', currency_preference: 'USD' },
      { headers: { Authorization: `Bearer ${normalUserToken}` } }
    );

    const checkUSDRes = await db.query('SELECT id, email, role, currency_preference FROM users WHERE id = $1', [normalUserId]);
    const usdUser = checkUSDRes.rows[0];
    if (usdUser.id !== normalUserId || usdUser.role !== 'user' || usdUser.currency_preference !== 'USD') {
      throw new Error(`Tampering detected after USD switch: ${JSON.stringify(usdUser)}`);
    }
    console.log('✓ Switching currency between INR and USD preserved user ID and role="user" completely');

    // --------------------------------------------------------------------------
    // TEST 7: Verification Cannot Create or Log In As Another User
    // --------------------------------------------------------------------------
    console.log('\n--- TEST 7: SINGLE-USE & ISOLATION OF VERIFICATION TOKEN ---');
    try {
      // Attempt to reuse already consumed token
      await axios.post(`${baseURL}/api/auth/verify-email-token`, {
        token: verificationToken
      });
      throw new Error('Reusing single-use verification token did not fail!');
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log('✓ Consumed token cannot be reused (HTTP 400 Bad Request)');
      } else {
        throw err;
      }
    }

    // Attempt to verify with invalid random token
    try {
      await axios.post(`${baseURL}/api/auth/verify-email-token`, {
        token: 'invalid_malicious_token_12345'
      });
      throw new Error('Invalid verification token did not fail!');
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log('✓ Malicious/random token rejected (HTTP 400 Bad Request)');
      } else {
        throw err;
      }
    }

    console.log('\n================================================================');
    console.log('ALL 7/7 CRITICAL AUTH & ROLE SECURITY TESTS PASSED PERFECTLY!');
    console.log('================================================================');

  } finally {
    // Cleanup temporary test users
    if (normalUserId) {
      try {
        await db.query('DELETE FROM users WHERE id = $1', [normalUserId]);
      } catch {}
    }
    if (serverInstance) {
      serverInstance.close();
    }
  }
}

runAuthSecurityTestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ AUTH SECURITY TEST SUITE FAILED:', err.message);
    if (err.response) {
      console.error('Response Status:', err.response.status);
      console.error('Response Data:', err.response.data);
    }
    process.exit(1);
  });
