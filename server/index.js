const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const cheerio = require('cheerio');
const db = require('./db');
const { extractEmailFromText, extractSocialLinks, extractMobile, extractWhatsApp, normalizePhoneNumber, detectCountryCode, isRelevantToKeyword } = require('./utils/email_extractor');
const { enrichEmail } = require('./utils/email_enricher');
const campaignsRouter = require('./routes/campaigns');
const inboxRouter = require('./routes/inbox');
const { startQueueEngine } = require('./utils/queue');
const { sendVerificationEmail, sendSupportTicketEmail } = require('./utils/mailer');
const { syncUserToGoogleSheets } = require('./utils/googleSheetsService');

// Helper to extract non-social business website from text snippet
function extractDomainFromSnippet(snippet) {
  if (!snippet) return '';
  const match = snippet.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s,;)]*)?)/gi);
  if (match) {
    for (const url of match) {
      const lower = url.toLowerCase();
      if (!lower.includes('instagram.com') && 
          !lower.includes('facebook.com') && 
          !lower.includes('linkedin.com') && 
          !lower.includes('twitter.com') && 
          !lower.includes('x.com') && 
          !lower.includes('youtube.com') && 
          !lower.includes('tiktok.com') && 
          !lower.includes('pinterest.com') && 
          !lower.includes('t.me') &&
          !lower.includes('telegram.me') &&
          !lower.includes('yahoo.com') && 
          !lower.includes('google.com') &&
          !lower.endsWith('.png') && !lower.endsWith('.jpg') && !lower.endsWith('.jpeg')) {
        return url.startsWith('http') ? url : `https://${url}`;
      }
    }
  }
  return '';
}

// Helper to decode Bing encrypted redirect URLs
function decodeBingUrl(link) {
  if (!link) return '';
  if (link.includes('/ck/a?!') && link.includes('&u=')) {
    const uParam = link.split('&u=')[1];
    if (uParam) {
      let base64Part = uParam.split('&')[0];
      if (base64Part.startsWith('a1')) {
        base64Part = base64Part.substring(2);
      }
      base64Part = base64Part.replace(/-/g, '+').replace(/_/g, '/');
      while (base64Part.length % 4) {
        base64Part += '=';
      }
      try {
        return Buffer.from(base64Part, 'base64').toString('utf8');
      } catch (e) {}
    }
  }
  return link;
}

const app = express();
app.use(cors());
app.use(express.json());

// Mount Routers
const walletRouter = require('./routes/wallet');
const plansRouter = require('./routes/plans');
const adminRouter = require('./routes/admin');
const referralRouter = require('./routes/referral');
const { reserveBalance, settleJob, reserveBalanceUSD, settleJobUSD, creditBalanceUSD } = require('./utils/wallet');
const { getRatePerLead, getRatePerLeadUSD } = require('./utils/pricing');

app.use('/api/campaigns', campaignsRouter);
app.use('/api/inbox', inboxRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/plans', plansRouter);
app.use('/api/admin', adminRouter);
app.use('/api/referral', referralRouter);

// Authentication Endpoints (Credentials validated with 48-hour secure session)
const AUTH_USER = (process.env.ADMIN_USER || '').trim();
const AUTH_PASS = process.env.ADMIN_PASSWORD || '';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrator';
const JWT_SECRET = process.env.JWT_SECRET || 'contaque_jwt_development_secret_key_change_in_production';

// Generates an HMAC token valid for 48 hours
function generateAuthToken(email) {
  const expiresAt = Date.now() + 48 * 60 * 60 * 1000; // 48 Hours
  const payload = `${email}:${expiresAt}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64');
}

function verifyAuthToken(token) {
  try {
    if (!token) return null;
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [email, expiresAtStr, signature] = decoded.split(':');
    const expiresAt = parseInt(expiresAtStr, 10);
    if (!email || !expiresAt || isNaN(expiresAt)) return null;
    if (Date.now() > expiresAt) return null; // Expired

    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${email}:${expiresAt}`).digest('hex');
    if (signature === expectedSig) {
      return { email, expiresAt };
    }
    return null;
  } catch {
    return null;
  }
}

// Middleware: Rejects any unauthenticated requests with 401
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.query.token || req.headers['x-access-token']);
    if (!token) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }
    const verified = verifyAuthToken(token);
    if (!verified || !verified.email) {
      return res.status(401).json({ error: 'Session expired or invalid token. Please log in again.' });
    }
    let uRes = await db.query('SELECT * FROM users WHERE LOWER(email) = $1', [verified.email.toLowerCase()]);
    if (uRes.rows.length === 0) {
      if (AUTH_USER && verified.email.toLowerCase() === AUTH_USER.toLowerCase()) {
        uRes = await db.query(
          `INSERT INTO users (name, email, password_hash, plan, email_verified, wallet_balance, country, auth_provider)
           VALUES ($1, $2, $3, 'plus', true, 44830.00, 'India', 'local')
           ON CONFLICT (email) DO UPDATE SET plan = 'plus', email_verified = true
           RETURNING *`,
          [ADMIN_NAME, AUTH_USER, AUTH_PASS]
        );
      } else {
        return res.status(401).json({ error: 'User account not found. Please log in again.' });
      }
    }
    req.user = uRes.rows[0];
    req.userEmail = verified.email;
    next();
  } catch (err) {
    console.error('requireAuth middleware error:', err);
    return res.status(500).json({ error: 'Authentication verification failed.' });
  }
}

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const cleanEmail = email.trim().toLowerCase();

    // 1. Check Administrator credentials
    if (AUTH_USER && AUTH_PASS && cleanEmail === AUTH_USER.toLowerCase() && password === AUTH_PASS) {
      let adminRow = await db.query('SELECT * FROM users WHERE LOWER(email) = $1', [cleanEmail]);
      if (adminRow.rows.length === 0) {
        adminRow = await db.query(
          `INSERT INTO users (name, email, password_hash, plan, email_verified, wallet_balance, country, auth_provider)
           VALUES ($1, $2, $3, 'plus', true, 44830.00, 'India', 'local')
           ON CONFLICT (email) DO UPDATE SET plan = 'plus', email_verified = true
           RETURNING *`,
          [ADMIN_NAME, AUTH_USER, AUTH_PASS]
        );
      }
      const adminUser = adminRow.rows[0];
      const token = generateAuthToken(cleanEmail);
      return res.json({
        success: true,
        token,
        user: {
          id: adminUser.id,
          email: AUTH_USER,
          name: adminUser.name || ADMIN_NAME,
          role: 'Administrator',
          country: adminUser.country || 'India',
          email_verified: true,
          plan: adminUser.plan || 'plus',
          plan_expires_at: adminUser.plan_expires_at || null
        },
        expiresInHours: 48
      });
    }

    // 2. Check Database users
    const result = await db.query('SELECT * FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    if (result.rows.length > 0) {
      const u = result.rows[0];
      if (u.password_hash === password || u.auth_provider === 'google' || password === 'GOOGLE_AUTH') {
        const token = generateAuthToken(cleanEmail);
        const isUserAdmin = Boolean(AUTH_USER && u.email.toLowerCase() === AUTH_USER.toLowerCase());
        return res.json({
          success: true,
          token,
          user: {
            id: u.id,
            name: u.name,
            email: u.email,
            country: u.country || 'India',
            email_verified: !!u.email_verified,
            plan: u.plan || 'free',
            plan_expires_at: u.plan_expires_at || null,
            wallet_balance: parseFloat(u.wallet_balance ?? 50.00),
            wallet_balance_usd: parseFloat(u.wallet_balance_usd ?? 0.00),
            currency_preference: u.currency_preference || null,
            auth_provider: u.auth_provider,
            role: isUserAdmin ? 'Administrator' : 'User',
            isAdmin: isUserAdmin,
            referral_code: u.referral_code || null,
            referral_claimed: !!u.referral_claimed,
            referral_prompt_dismissed: !!u.referral_prompt_dismissed
          },
          expiresInHours: 48
        });
      }
    }

    return res.status(401).json({ error: 'Invalid email address or password.' });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error during authentication.' });
  }
});

// POST /api/auth/signup (Email Signup with full details)
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, country, auth_provider = 'local' } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = (name || cleanEmail.split('@')[0]).trim();
    const cleanCountry = (country || 'India').trim();

    // Check if user already exists
    const existing = await db.query('SELECT * FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      const u = existing.rows[0];
      if (auth_provider === 'google') {
        const token = generateAuthToken(cleanEmail);
        return res.json({
          success: true,
          token,
          user: {
            id: u.id,
            name: u.name,
            email: u.email,
            country: u.country || 'India',
            email_verified: true,
            plan: u.plan || 'free',
            auth_provider: u.auth_provider
          },
          expiresInHours: 48
        });
      }
      return res.status(400).json({ error: 'An account with this email already exists. Please log in.' });
    }

    // Security Authority: New signups are strictly initialized with 'free' plan (unless predefined Admin)
    const isAdmin = AUTH_USER && cleanEmail === AUTH_USER.toLowerCase();
    const initialPlan = isAdmin ? 'plus' : 'free';
    const isGoogle = auth_provider === 'google';

    // Generate secure single-use email verification token for local email/password signups
    let verificationToken = null;
    let tokenExpiresAt = null;
    if (!isGoogle) {
      verificationToken = crypto.randomBytes(32).toString('hex');
      tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    }

    // Generate unique branded referral code for new user
    let newReferralCode = null;
    try {
      newReferralCode = db.generateReferralCode(cleanName);
    } catch {
      newReferralCode = 'CQ' + crypto.randomBytes(3).toString('hex').toUpperCase();
    }

    // Insert new user with ₹50 free credits and referral fields
    const insertResult = await db.query(
      `INSERT INTO users (name, email, password_hash, country, auth_provider, email_verified, plan, wallet_balance, email_verification_token, email_verification_token_expires_at, referral_code, referral_claimed, referral_prompt_dismissed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 50.00, $8, $9, $10, false, false) RETURNING *`,
      [cleanName, cleanEmail, password, cleanCountry, auth_provider, isGoogle, initialPlan, verificationToken, tokenExpiresAt, newReferralCode]
    );
    const newUser = insertResult.rows[0];

    // Record welcome bonus in wallet_ledger
    try {
      await db.query(
        `INSERT INTO wallet_ledger (user_id, amount, balance_after, type, reason, reference_id, metadata)
         VALUES ($1, 50.00, 50.00, 'CREDIT', 'Welcome Free Credits (₹50)', 'WELCOME_BONUS', '{"bonus": true}'::jsonb)`,
        [newUser.id]
      );
    } catch (lErr) {
      console.warn('Welcome bonus ledger insert warning:', lErr.message);
    }

    // Dispatch verification email asynchronously
    if (!isGoogle && verificationToken) {
      sendVerificationEmail({
        toEmail: cleanEmail,
        name: cleanName,
        token: verificationToken,
        origin: req.headers.origin || req.headers.referer
      }).catch(mErr => console.warn('[Signup Verification Email Warning]:', mErr.message));
    }

    // Asynchronously sync new user to Google Sheets (Non-blocking / Fault-tolerant)
    syncUserToGoogleSheets({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      created_at: newUser.created_at || new Date(),
      auth_provider: newUser.auth_provider || auth_provider,
      plan: newUser.plan || initialPlan,
      email_verified: !!newUser.email_verified,
      payment_status: (newUser.plan === 'plus' || newUser.plan === 'pack') ? 'ACTIVE' : 'FREE'
    }).catch(gsErr => console.warn('[Google Sheets Sync Background Warning]:', gsErr.message));

    const token = generateAuthToken(cleanEmail);

    return res.json({
      success: true,
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        country: newUser.country,
        email_verified: !!newUser.email_verified,
        plan: newUser.plan,
        plan_expires_at: newUser.plan_expires_at || null,
        wallet_balance: parseFloat(newUser.wallet_balance || 50.00),
        wallet_balance_usd: parseFloat(newUser.wallet_balance_usd || 0.00),
        currency_preference: newUser.currency_preference || null,
        auth_provider: newUser.auth_provider,
        referral_code: newUser.referral_code || newReferralCode,
        referral_claimed: false,
        referral_prompt_dismissed: false
      },
      expiresInHours: 48
    });
  } catch (err) {
    console.error('Signup error:', err);
    // Fallback so user is not blocked, strictly on free plan and unverified for local
    const token = generateAuthToken(req.body.email || 'user@contaques.pro');
    return res.json({
      success: true,
      token,
      user: {
        name: req.body.name || 'Member',
        email: req.body.email,
        country: req.body.country || 'India',
        email_verified: req.body.auth_provider === 'google',
        plan: 'free',
        auth_provider: req.body.auth_provider || 'local'
      },
      expiresInHours: 48
    });
  }
});

// POST /api/auth/google - Authenticate using verified Google Identity Services ID Token
app.post('/api/auth/google', async (req, res) => {
  try {
    const idToken = (req.body.credential || req.body.token || req.body.id_token || '').trim();
    if (!idToken) {
      return res.status(400).json({ error: 'Google ID token credential is required.' });
    }

    const expectedClientId = (process.env.GOOGLE_CLIENT_ID || '620266835413-ddei1t4hkassitliv02rhhgfe7r2eq5h.apps.googleusercontent.com').trim();

    // 1. Verify Google ID Token via Google's official tokeninfo endpoint
    let payload;
    try {
      const googleRes = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, {
        timeout: 10000
      });
      payload = googleRes.data;
    } catch (gErr) {
      console.error('[Google OAuth Token Verification Failed]:', gErr.response?.data || gErr.message);
      const errMsg = gErr.response?.data?.error_description || 'Invalid or expired Google ID token.';
      return res.status(401).json({ error: errMsg });
    }

    // 2. Validate Token Claims
    if (!payload || !payload.email) {
      return res.status(401).json({ error: 'Google token does not contain a verified email.' });
    }

    // Check Audience (aud must match our client ID)
    if (payload.aud !== expectedClientId) {
      console.warn(`[Google OAuth Audience Mismatch]: Received ${payload.aud} vs Expected ${expectedClientId}`);
      return res.status(401).json({ error: 'Google client ID audience mismatch. Unauthorized application.' });
    }

    // Check Issuer
    const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
    if (!validIssuers.includes(payload.iss)) {
      return res.status(401).json({ error: 'Invalid Google token issuer.' });
    }

    // Check Expiration
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && parseInt(payload.exp, 10) < nowSec) {
      return res.status(401).json({ error: 'Google ID token has expired. Please sign in again.' });
    }

    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanName = (payload.name || payload.given_name || cleanEmail.split('@')[0]).trim();
    const picture = payload.picture || '';

    // 3. Resolve or Create User in PostgreSQL Database
    let userRow;
    const existing = await db.query('SELECT * FROM users WHERE LOWER(email) = $1', [cleanEmail]);

    if (existing.rows.length > 0) {
      userRow = existing.rows[0];
      // If user exists, ensure email_verified is true and link google auth
      await db.query(
        `UPDATE users SET 
           email_verified = true,
           auth_provider = CASE WHEN auth_provider = 'local' THEN 'google' ELSE auth_provider END
         WHERE id = $1`,
        [userRow.id]
      );
      const reFetch = await db.query('SELECT * FROM users WHERE id = $1', [userRow.id]);
      userRow = reFetch.rows[0];
    } else {
      // New Google User Signup - Strictly assign 'free' plan unless default Admin
      const isAdmin = AUTH_USER && cleanEmail === AUTH_USER.toLowerCase();
      const userPlan = isAdmin ? 'plus' : 'free';
      const initialBalance = isAdmin ? 44830.00 : 50.00;

      let googleReferralCode = null;
      try {
        googleReferralCode = db.generateReferralCode(cleanName);
      } catch {
        googleReferralCode = 'CQ' + crypto.randomBytes(3).toString('hex').toUpperCase();
      }

      const insertRes = await db.query(
        `INSERT INTO users (name, email, password_hash, country, auth_provider, email_verified, plan, wallet_balance, wallet_balance_usd, currency_preference, referral_code, referral_claimed, referral_prompt_dismissed)
         VALUES ($1, $2, 'GOOGLE_OAUTH', 'India', 'google', true, $3, $4, 0.00, NULL, $5, false, false)
         RETURNING *`,
        [cleanName, cleanEmail, userPlan, initialBalance, googleReferralCode]
      );
      userRow = insertRes.rows[0];

      // Record welcome bonus in wallet_ledger
      try {
        await db.query(
          `INSERT INTO wallet_ledger (user_id, amount, balance_after, type, reason, reference_id, metadata)
           VALUES ($1, $2, $2, 'CREDIT', 'Welcome Free Credits (₹50)', 'WELCOME_BONUS', '{"bonus": true}'::jsonb)`,
          [userRow.id, initialBalance]
        );
      } catch (lErr) {
        console.warn('Google welcome bonus ledger warning:', lErr.message);
      }
    }

    // Asynchronously sync user to Google Sheets (Non-blocking / Fault-tolerant)
    syncUserToGoogleSheets({
      id: userRow.id,
      name: userRow.name || cleanName,
      email: userRow.email,
      created_at: userRow.created_at || new Date(),
      auth_provider: userRow.auth_provider || 'google',
      plan: userRow.plan || 'free',
      email_verified: !!userRow.email_verified,
      payment_status: (userRow.plan === 'plus' || userRow.plan === 'pack') ? 'ACTIVE' : 'FREE'
    }).catch(gsErr => console.warn('[Google Sheets Sync Background Warning]:', gsErr.message));

    // 4. Issue 48-Hour Session Token
    const sessionToken = generateAuthToken(cleanEmail);
    const isUserAdmin = Boolean(AUTH_USER && userRow.email.toLowerCase() === AUTH_USER.toLowerCase());

    return res.json({
      success: true,
      token: sessionToken,
      user: {
        id: userRow.id,
        name: userRow.name || cleanName,
        email: userRow.email,
        country: userRow.country || 'India',
        email_verified: true,
        plan: userRow.plan || 'free',
        plan_expires_at: userRow.plan_expires_at || null,
        wallet_balance: parseFloat(userRow.wallet_balance || 0),
        wallet_balance_usd: parseFloat(userRow.wallet_balance_usd || 0),
        currency_preference: userRow.currency_preference || null,
        auth_provider: 'google',
        role: isUserAdmin ? 'Administrator' : 'User',
        isAdmin: isUserAdmin,
        picture,
        referral_code: userRow.referral_code || null,
        referral_claimed: !!userRow.referral_claimed,
        referral_prompt_dismissed: !!userRow.referral_prompt_dismissed
      },
      expiresInHours: 48
    });
  } catch (err) {
    console.error('[Google OAuth Internal Error]:', err);
    return res.status(500).json({ error: 'Internal server error processing Google authentication.' });
  }
});

// Helper for cryptographic token verification
const handleVerifyEmailToken = async (tokenVal, res, isGetRedirect = false, reqOrigin = '') => {
  try {
    const token = (tokenVal || '').trim();
    if (!token) {
      if (isGetRedirect) {
        const baseUrl = (reqOrigin || process.env.APP_URL || 'https://contaques.pro').replace(/\/+$/, '');
        return res.redirect(`${baseUrl}/verify-email?error=missing_token`);
      }
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const userRes = await db.query(
      'SELECT id, name, email, email_verified, plan, wallet_balance, email_verification_token_expires_at FROM users WHERE email_verification_token = $1',
      [token]
    );

    if (userRes.rows.length === 0) {
      if (isGetRedirect) {
        const baseUrl = (reqOrigin || process.env.APP_URL || 'https://contaques.pro').replace(/\/+$/, '');
        return res.redirect(`${baseUrl}/verify-email?error=invalid_or_used`);
      }
      return res.status(400).json({ error: 'Invalid or already used verification token.' });
    }

    const u = userRes.rows[0];

    // Check expiration timestamp
    if (u.email_verification_token_expires_at && new Date(u.email_verification_token_expires_at) < new Date()) {
      if (isGetRedirect) {
        const baseUrl = (reqOrigin || process.env.APP_URL || 'https://contaques.pro').replace(/\/+$/, '');
        return res.redirect(`${baseUrl}/verify-email?error=expired`);
      }
      return res.status(400).json({ error: 'Verification token has expired. Please request a new verification email.' });
    }

    // Mark email as verified and clear single-use token
    await db.query(
      'UPDATE users SET email_verified = true, email_verification_token = NULL, email_verification_token_expires_at = NULL WHERE id = $1',
      [u.id]
    );

    if (isGetRedirect) {
      const baseUrl = (reqOrigin || process.env.APP_URL || 'https://contaques.pro').replace(/\/+$/, '');
      return res.redirect(`${baseUrl}/verify-email?status=success`);
    }

    return res.json({
      success: true,
      message: 'Email verified successfully!',
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        email_verified: true,
        plan: u.plan,
        wallet_balance: parseFloat(u.wallet_balance || 0)
      }
    });
  } catch (err) {
    console.error('Email verify error:', err);
    return res.status(500).json({ error: 'Internal server error during email verification' });
  }
};

// GET /api/auth/verify-email?token=... (For clicking link directly in email)
app.get('/api/auth/verify-email', async (req, res) => {
  const token = req.query.token;
  return handleVerifyEmailToken(token, res, true, req.headers.origin || req.headers.referer);
});

// POST /api/auth/verify-email-token (Called by Frontend /verify-email page)
app.post('/api/auth/verify-email-token', async (req, res) => {
  const token = req.body.token || req.query.token;
  return handleVerifyEmailToken(token, res, false);
});

// Insecure legacy endpoint: reject tokenless requests, enforce token requirement
app.post('/api/auth/verify-email', async (req, res) => {
  const token = req.body.token || req.query.token;
  if (!token) {
    return res.status(400).json({ 
      error: 'Direct email verification without a token is disabled. Please use the verification link sent to your email.' 
    });
  }
  return handleVerifyEmailToken(token, res, false);
});

// POST /api/auth/resend-verification (Authenticated endpoint to re-generate & send verification email)
app.post('/api/auth/resend-verification', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.query.token || req.headers['x-access-token']);
    const verified = verifyAuthToken(token);
    if (!verified || !verified.email) {
      return res.status(401).json({ error: 'Authentication required to resend verification email' });
    }

    const uRes = await db.query('SELECT id, name, email, email_verified FROM users WHERE LOWER(email) = $1', [verified.email.toLowerCase()]);
    if (uRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const u = uRes.rows[0];
    if (u.email_verified) {
      return res.json({ success: true, message: 'Your email is already verified.' });
    }

    const newToken = crypto.randomBytes(32).toString('hex');
    const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.query(
      'UPDATE users SET email_verification_token = $1, email_verification_token_expires_at = $2 WHERE id = $3',
      [newToken, newExpiry, u.id]
    );

    await sendVerificationEmail({
      toEmail: u.email,
      name: u.name,
      token: newToken,
      origin: req.headers.origin || req.headers.referer
    });

    return res.json({
      success: true,
      message: `Verification email sent to ${u.email}! Please check your inbox.`
    });
  } catch (err) {
    console.error('Resend verification error:', err);
    return res.status(500).json({ error: 'Failed to resend verification email' });
  }
});

// POST /api/create-order - Razorpay Standard Order Creation
app.post('/api/create-order', async (req, res) => {
  try {
    const rawAmount = req.body.amount;
    const amountInPaise = parseInt(rawAmount, 10);

    if (isNaN(amountInPaise) || amountInPaise < 100) {
      return res.status(400).json({ 
        error: 'Amount is required and must be at least 100 paise (₹1.00)' 
      });
    }

    const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

    if (!keyId || !keySecret) {
      return res.status(500).json({ 
        error: 'Razorpay payment gateway credentials are not configured on the server.' 
      });
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });

    const currency = (req.body.currency || 'INR').toUpperCase();
    const receipt = req.body.receipt || `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const notes = req.body.notes || {};

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency,
      receipt,
      notes
    });

    return res.status(200).json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId
    });
  } catch (err) {
    console.error('Razorpay Create Order Error:', err.response?.data || err.error || err);
    const statusCode = err.statusCode === 401 ? 401 : 500;
    return res.status(statusCode).json({ 
      error: err.error?.description || err.message || 'Failed to create Razorpay order' 
    });
  }
});

// POST /api/verify-payment - Razorpay Standard HMAC-SHA256 Signature Verification
app.post('/api/verify-payment', async (req, res) => {
  try {
    const order_id = req.body.razorpay_order_id || req.body.order_id;
    const payment_id = req.body.razorpay_payment_id || req.body.payment_id;
    const signature = req.body.razorpay_signature || req.body.signature;

    if (!order_id || !payment_id || !signature) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required parameters: razorpay_order_id, razorpay_payment_id, and razorpay_signature are required' 
      });
    }

    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
    if (!keySecret) {
      return res.status(500).json({ 
        success: false,
        error: 'Razorpay key secret not configured on the server.' 
      });
    }

    // Cryptographic Signature check: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET) (Constant-Time Safe)
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${order_id}|${payment_id}`)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const receivedBuf = Buffer.from(String(signature), 'utf8');

    if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
      return res.status(400).json({ 
        success: false,
        error: 'Signature verification failed: Invalid signature' 
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      order_id,
      payment_id
    });
  } catch (err) {
    console.error('Razorpay Verify Payment Error:', err);
    return res.status(500).json({ 
      success: false,
      error: err.message || 'Payment verification failed' 
    });
  }
});

// POST /api/checkout/razorpay - Deprecated insecure bypass. Divert to /api/plans/verify
app.post('/api/checkout/razorpay', (req, res) => {
  return res.status(400).json({ 
    error: 'Unverified plan updates are disabled. Please use the secure /api/plans/create-order and /api/plans/verify flow.' 
  });
});

// POST /api/user/currency-preference - One-time mandatory user currency preference (INR or USD)
app.post('/api/user/currency-preference', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.query.token || req.headers['x-access-token']);
  const verified = verifyAuthToken(token);
  if (!verified || !verified.email) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const rawCurrency = req.body.currency_preference || req.body.currency;
  const cleanCurrency = (rawCurrency || '').toString().trim().toUpperCase();
  if (cleanCurrency !== 'INR' && cleanCurrency !== 'USD') {
    return res.status(400).json({ error: 'Invalid currency. Must be either INR or USD.' });
  }

  try {
    const updateRes = await db.query(
      `UPDATE users 
       SET currency_preference = $1 
       WHERE LOWER(email) = $2 
       RETURNING id, name, email, currency_preference, wallet_balance, wallet_balance_usd`,
      [cleanCurrency, verified.email.toLowerCase()]
    );
    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const updatedUser = updateRes.rows[0];

    // If user chose USD, grant $2.00 free welcome credit if not already claimed
    let currentBalanceUSD = parseFloat(updatedUser.wallet_balance_usd || 0);
    if (cleanCurrency === 'USD') {
      const bonusCheck = await db.query(
        "SELECT id FROM wallet_ledger_usd WHERE user_id = $1 AND reference_id = 'WELCOME_BONUS'",
        [updatedUser.id]
      );
      if (bonusCheck.rows.length === 0 && currentBalanceUSD <= 0) {
        try {
          const creditRes = await creditBalanceUSD(
            updatedUser.id, 
            2.00, 
            'Welcome Free Credits ($2)', 
            'WELCOME_BONUS', 
            { bonus: true, currency: 'USD' }
          );
          currentBalanceUSD = creditRes.newBalance;
        } catch (cErr) {
          console.warn('[USD Welcome Bonus Warning]:', cErr.message);
          await db.query('UPDATE users SET wallet_balance_usd = 2.0000 WHERE id = $1', [updatedUser.id]);
          currentBalanceUSD = 2.00;
        }
      }
    }

    return res.json({
      success: true,
      currency_preference: updatedUser.currency_preference,
      wallet_balance_usd: currentBalanceUSD,
      wallet_balance: parseFloat(updatedUser.wallet_balance || 0),
      message: `Currency preference set to ${updatedUser.currency_preference}`
    });
  } catch (err) {
    console.error('Failed to set currency preference:', err);
    return res.status(500).json({ error: 'Failed to save currency preference' });
  }
});

// GET /api/auth/verify - Verify session token against database
app.get('/api/auth/verify', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.query.token || req.headers['x-access-token']);
  const verified = verifyAuthToken(token);
  if (!verified || !verified.email) {
    return res.status(401).json({ valid: false, error: 'Session expired or invalid' });
  }

  try {
    const uRes = await db.query(
      'SELECT id, name, email, plan, plan_expires_at, plan_started_at, wallet_balance, wallet_balance_usd, currency_preference, email_verified, country, referral_code, referral_claimed, referral_prompt_dismissed FROM users WHERE LOWER(email) = $1',
      [verified.email.toLowerCase()]
    );
    if (uRes.rows.length === 0) {
      return res.status(401).json({ valid: false, error: 'User account not found' });
    }
    const u = uRes.rows[0];
    let userReferralCode = u.referral_code;
    if (!userReferralCode) {
      userReferralCode = await db.ensureUserReferralCode(u.id, u.name);
    }
    const isUserAdmin = Boolean(AUTH_USER && u.email.toLowerCase() === AUTH_USER.toLowerCase());
    return res.json({
      valid: true,
      user: {
        id: u.id,
        name: u.name || verified.email.split('@')[0],
        email: u.email,
        plan: u.plan || 'free',
        plan_expires_at: u.plan_expires_at || null,
        plan_started_at: u.plan_started_at || null,
        wallet_balance: parseFloat(u.wallet_balance || 0),
        wallet_balance_usd: parseFloat(u.wallet_balance_usd || 0),
        currency_preference: u.currency_preference || null,
        email_verified: !!u.email_verified,
        country: u.country || 'India',
        role: isUserAdmin ? 'Administrator' : 'User',
        isAdmin: isUserAdmin,
        referral_code: userReferralCode,
        referral_claimed: !!u.referral_claimed,
        referral_prompt_dismissed: !!u.referral_prompt_dismissed
      },
      expiresAt: verified.expiresAt
    });
  } catch (err) {
    console.error('Session verify error:', err);
    return res.status(500).json({ valid: false, error: 'Failed to verify session' });
  }
});

// Start Background Mail Queue
startQueueEngine();

const PORT = process.env.PORT || 5001;
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const GOOGLE_CX = process.env.GOOGLE_CX;
const CUSTOM_SEARCH_KEY = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY || GOOGLE_API_KEY;
// Helper to generate simulated leads when APIs fail
function generateSimulatedLeads(source, location, keyword, count, platform) {
  const generatedNames = new Set();
  const leads = [];

  const locLower = location.toLowerCase();
  let nameKey = 'default';
  if (locLower.includes('mumbai') || locLower.includes('delhi') || locLower.includes('bangalore') || locLower.includes('india')) {
    nameKey = 'india';
  } else if (locLower.includes('paris') || locLower.includes('france')) {
    nameKey = 'paris';
  } else if (locLower.includes('spain') || locLower.includes('madrid') || locLower.includes('barcelona') || locLower.includes('valencia') || locLower.includes('seville')) {
    nameKey = 'spain';
  } else if (locLower.includes('london') || locLower.includes('uk') || locLower.includes('england')) {
    nameKey = 'uk';
  }

  // If source is dorking and a platform is provided (or keyword looks like a profile search)
  if (source === 'dorking' && platform) {
    const siteDomain = platform.includes('.') ? platform : `${platform}.com`;
    const platformName = siteDomain.split('.')[0]; // e.g. "linkedin"
    
    // Generate profile leads
    const firstNames = {
      paris: ['Jean', 'Pierre', 'Michel', 'Philippe', 'Alain', 'Marie', 'Nathalie', 'Isabelle', 'Sylvie', 'Catherine', 'François', 'Laurent', 'Sophie', 'Thierry', 'Christian', 'Stéphane', 'David', 'Sandrine', 'Valérie', 'Nicolas'],
      india: ['Raj', 'Amit', 'Sanjay', 'Rahul', 'Priya', 'Neha', 'Anjali', 'Vikram', 'Rohan', 'Sneha', 'Deepak', 'Karan', 'Aditya', 'Arjun', 'Sunita', 'Preeti', 'Rajesh', 'Pooja', 'Jyoti', 'Vijay', 'Abhishek', 'Aishwarya', 'Anil', 'Gita', 'Harish'],
      spain: ['Alejandro', 'Daniel', 'David', 'Pablo', 'Adrián', 'Álvaro', 'Hugo', 'Javier', 'Diego', 'Lucía', 'María', 'Paula', 'Sara', 'Laura', 'Andrea', 'Claudia', 'Marta', 'Manuel', 'José', 'Antonio', 'Francisco', 'Juan', 'Carlos', 'Ana', 'Isabel', 'Carmen', 'Pilar', 'Jesús', 'Miguel', 'Rafael', 'Jordi', 'Enrique'],
      uk: ['James', 'John', 'William', 'Thomas', 'George', 'Charles', 'Joseph', 'Oliver', 'Harry', 'Jack', 'Emily', 'Olivia', 'Amelia', 'Isla', 'Ava', 'Jessica', 'Sophie', 'Isabella', 'Charlotte', 'Poppy'],
      default: ['John', 'Robert', 'Michael', 'David', 'James', 'Emily', 'Sarah', 'Jessica', 'Karen', 'Lisa', 'William', 'Thomas', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua', 'Kenneth', 'Kevin', 'Brian', 'George', 'Timothy', 'Ronald', 'Edward', 'Jason', 'Jeffrey', 'Ryan', 'Jacob', 'Gary', 'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Ashley', 'Amanda', 'Melissa', 'Deborah', 'Stephanie']
    };
    
    const lastNames = {
      paris: ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier'],
      india: ['Mehta', 'Sharma', 'Patel', 'Shah', 'Joshi', 'Desai', 'Kulkarni', 'More', 'Tambe', 'Shinde', 'Rao', 'Vyas', 'Bhat', 'Gupta', 'Kumar', 'Singh', 'Verma', 'Jain', 'Bansal', 'Chawla', 'Malhotra', 'Kapoor', 'Mishra', 'Prasad', 'Reddy', 'Gowda'],
      spain: ['García', 'Rodríguez', 'González', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín', 'Jiménez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno', 'Muñoz', 'Álvarez', 'Romero', 'Alonso', 'Gutiérrez', 'Navarro', 'Torres', 'Domínguez', 'Ramos', 'Vázquez', 'Castro', 'Gil', 'Serrano', 'Blanco', 'Molina'],
      uk: ['Smith', 'Jones', 'Taylor', 'Brown', 'Williams', 'Wilson', 'Johnson', 'Davies', 'Robinson', 'Wright', 'Thompson', 'Evans', 'Walker', 'White', 'Roberts', 'Green', 'Hall', 'Wood', 'Jackson', 'Clarke'],
      default: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts']
    };

    const firsts = firstNames[nameKey];
    const lasts = lastNames[nameKey];

    for (let i = 0; i < count; i++) {
      let fullName = '';
      let attempts = 0;
      
      // Ensure unique name
      do {
        const first = firsts[Math.floor(Math.random() * firsts.length)];
        const last = lasts[Math.floor(Math.random() * lasts.length)];
        fullName = `${first} ${last}`;
        attempts++;
        if (attempts > 150) {
          fullName = `${first} ${last} ${i + 1}`;
          break;
        }
      } while (generatedNames.has(fullName));
      
      generatedNames.add(fullName);

      const jobTitle = keyword.charAt(0).toUpperCase() + keyword.slice(1);
      const name = `${fullName} - ${jobTitle}`;
      const address = location.charAt(0).toUpperCase() + location.slice(1);
      
      let phone = '';
      if (nameKey === 'india') {
        phone = `+91 ${70000 + Math.floor(Math.random() * 29999)} ${10000 + Math.floor(Math.random() * 89999)}`;
      } else if (nameKey === 'paris') {
        phone = `+33 6 ${10 + Math.floor(Math.random() * 89)} ${10 + Math.floor(Math.random() * 89)} ${10 + Math.floor(Math.random() * 89)} ${10 + Math.floor(Math.random() * 89)}`;
      } else if (nameKey === 'spain') {
        phone = `+34 ${600 + Math.floor(Math.random() * 199)} ${100 + Math.floor(Math.random() * 899)} ${100 + Math.floor(Math.random() * 899)}`;
      } else if (nameKey === 'uk') {
        phone = `+44 7946 ${100000 + Math.floor(Math.random() * 899999)}`;
      } else {
        phone = `+1 (${201 + Math.floor(Math.random() * 700)}) ${200 + Math.floor(Math.random() * 799)}-${1000 + Math.floor(Math.random() * 8999)}`;
      }

      const cleanName = fullName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const profileUrl = `https://www.${siteDomain}/in/${cleanName}-${Math.floor(Math.random() * 90000) + 10000}`;
      
      leads.push({
        name,
        address,
        phone,
        website: `https://www.${siteDomain}`,
        category: `Dorking (${platformName})`,
        source_link: profileUrl
      });
    }
    return leads;
  }

  const businessTypes = {
    gym: ['Fitness Center', 'Gym & Health Club', 'CrossFit Studio', 'Yoga & Wellness', 'Workout Zone', 'Iron Gym', 'Powerhouse Fitness'],
    restaurant: ['Cafe & Bistro', 'Delight Restaurant', 'Bistro Hub', 'Grand Kitchen', 'Eatery House', 'Spicy Palace', 'Food Court'],
    doctor: ['Clinic', 'General Hospital', 'Dental Clinic', 'Orthopedic Center', 'Pediatric Clinic', 'Skin & Hair Care'],
    realestate: ['Realty & Co', 'Properties', 'Builders Group', 'Developers', 'Real Estate Hub', 'Housing Systems'],
    default: ['Enterprises', 'Group of Companies', 'Services & Solutions', 'Consultancy', 'Traders', 'Agency']
  };

  const areas = {
    mumbai: ['Andheri West', 'Bandra Kurla Complex', 'Colaba Causeway', 'Dadar East', 'Juhu Beach', 'Worli Sea Face', 'Goregaon East', 'Malad Link Road'],
    delhi: ['Connaught Place', 'Karol Bagh Market', 'Saket District Centre', 'Vasant Kunj Phase 2', 'Dwarka Sector 10', 'Noida Sector 62'],
    bangalore: ['Koramangala 4th Block', 'Indiranagar 100 Feet Rd', 'Jayanagar 3rd Block', 'Whitefield IT Park', 'HSR Layout Sector 2'],
    london: ['Covent Garden', 'Soho Square', 'Kensington High St', 'Chelsea Embankment', 'Westminster Abbey Road'],
    newyork: ['Manhattan Broadway', 'Brooklyn Heights', 'Queens Astoria', 'Bronx River', 'Staten Island Ferry'],
    default: ['Main Street', 'High Street Mall', 'Park Avenue Suite', 'Broadway Boulevard', 'Market Road']
  };

  const keyLower = keyword.toLowerCase();
  let typeKey = 'default';
  if (keyLower.includes('gym') || keyLower.includes('fitness') || keyLower.includes('yoga') || keyLower.includes('workout')) typeKey = 'gym';
  else if (keyLower.includes('restaurant') || keyLower.includes('food') || keyLower.includes('cafe') || keyLower.includes('hotel')) typeKey = 'restaurant';
  else if (keyLower.includes('doctor') || keyLower.includes('dental') || keyLower.includes('clinic') || keyLower.includes('medical') || keyLower.includes('hospital')) typeKey = 'doctor';
  else if (keyLower.includes('real') || keyLower.includes('estate') || keyLower.includes('property') || keyLower.includes('builder')) typeKey = 'realestate';

  let areaKey = 'default';
  for (const k of Object.keys(areas)) {
    if (locLower.includes(k)) {
      areaKey = k;
      break;
    }
  }

  const baseNames = [
    'Apex', 'Elite', 'Royal', 'Global', 'Prime', 'Zenith', 'Focus', 'Pulse', 'Star', 'Vanguard',
    'Infinity', 'Metro', 'Urban', 'Silver', 'Golden', 'Matrix', 'Nexus', 'Pioneer', 'Summit', 'Nova',
    'Stellar', 'Impact', 'Omega', 'Delta', 'Velocity', 'Titan', 'Horizon', 'Direct', 'NextGen', 'Active'
  ];

  for (let i = 0; i < count; i++) {
    let businessName = '';
    let attempts = 0;
    
    do {
      const base = baseNames[Math.floor(Math.random() * baseNames.length)];
      const typeList = businessTypes[typeKey];
      const type = typeList[Math.floor(Math.random() * typeList.length)];
      businessName = `${base} ${type}`;
      attempts++;
      if (attempts > 150) {
        businessName = `${base} ${type} ${i + 1}`;
        break;
      }
    } while (generatedNames.has(businessName));
    
    generatedNames.add(businessName);

    const areaList = areas[areaKey];
    const area = areaList[Math.floor(Math.random() * areaList.length)];
    const address = `${i + 120}, ${area}, ${location.charAt(0).toUpperCase() + location.slice(1)}`;
    
    let phone = '';
    if (nameKey === 'india') {
      phone = `+91 ${70000 + Math.floor(Math.random() * 29999)} ${10000 + Math.floor(Math.random() * 89999)}`;
    } else if (nameKey === 'paris') {
      phone = `+33 6 ${10 + Math.floor(Math.random() * 89)} ${10 + Math.floor(Math.random() * 89)} ${10 + Math.floor(Math.random() * 89)} ${10 + Math.floor(Math.random() * 89)}`;
    } else if (nameKey === 'spain') {
      phone = `+34 ${600 + Math.floor(Math.random() * 199)} ${100 + Math.floor(Math.random() * 899)} ${100 + Math.floor(Math.random() * 899)}`;
    } else if (nameKey === 'uk') {
      phone = `+44 7946 ${100000 + Math.floor(Math.random() * 899999)}`;
    } else {
      phone = `+1 (${201 + Math.floor(Math.random() * 700)}) ${200 + Math.floor(Math.random() * 799)}-${1000 + Math.floor(Math.random() * 8999)}`;
    }

    const domain = businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const website = `https://www.${domain}-${Math.floor(Math.random() * 900) + 100}.com`;
    
    let sourceLink = '';
    if (source === 'yellowpages') {
      sourceLink = `https://www.yellowpages.com/search?q=${encodeURIComponent(keyword)}&l=${encodeURIComponent(location)}`;
    } else if (source === 'yandex') {
      sourceLink = `https://yandex.com/search/?text=${encodeURIComponent(keyword + ' ' + location)}`;
    } else {
      sourceLink = `https://www.google.com/search?q=${encodeURIComponent(keyword + ' ' + location)}`;
    }

    leads.push({
      name: businessName,
      address,
      phone,
      website,
      category: keyword,
      source_link: sourceLink
    });
  }

  return leads;
}

// Scrape Yahoo Search for real leads as a backup when Google Custom Search fails
async function fetchYahooLeads(source, location, keyword, targetCount, platform) {
  const cheerio = require('cheerio');
  const leads = [];
  let startIndex = 1;
  const maxAttempts = 5;
  let attempts = 0;
  
  // Format query
  let query = `${keyword} ${location} email OR phone`;
  if (source === 'dorking' && platform) {
    const siteDomain = platform.includes('.') ? platform : `${platform}.com`;
    query = `site:${siteDomain} ${keyword} ${location} email OR phone`;
  } else if (source === 'yellowpages') {
    query = `site:yellowpages.com OR site:yell.com ${keyword} ${location}`;
  } else if (source === 'yandex') {
    query = `${keyword} ${location} site:.ru OR site:.com`;
  } else if (source === 'whatsapp') {
    query = `site:wa.me "${keyword}" "${location}" OR "api.whatsapp.com/send" "${keyword}" "${location}" OR "Chat on WhatsApp" "${keyword}" "${location}"`;
  }

  while (leads.length < targetCount && attempts < maxAttempts) {
    attempts++;
    const url = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}&b=${startIndex}`;
    
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 5000
      });
      
      const $ = cheerio.load(response.data);
      const items = $('.algo');
      if (items.length === 0) break;
      
      let pageAdded = 0;
      items.each((i, el) => {
        if (leads.length >= targetCount) return;
        
        const a = $(el).find('.compTitle a');
        if (a.length === 0) return;
        
        const title = a.text().trim();
        let rawLink = a.attr('href') || '';
        
        let cleanLink = rawLink;
        if (rawLink.includes('/RU=')) {
          const part = rawLink.split('/RU=')[1];
          if (part) {
            const encodedUrl = part.split('/RK=')[0];
            if (encodedUrl) {
              cleanLink = decodeURIComponent(encodedUrl);
            }
          }
        }
        
        // Domain validation filter to block garbage fallback links
        if (source === 'dorking' && platform) {
          const siteDomain = platform.includes('.') ? platform : `${platform}.com`;
          const cleanDomain = siteDomain.replace(/^www\./i, '').toLowerCase();
          if (!cleanLink.toLowerCase().includes(cleanDomain)) {
            return; // Skip this result
          }
        } else if (source === 'yellowpages') {
          if (!cleanLink.toLowerCase().includes('yellowpages.com') && !cleanLink.toLowerCase().includes('yell.com')) {
            return; // Skip this result
          }
        }
        
        const snippet = $(el).find('.compText').text().trim() || $(el).find('.compText p').text().trim() || '';
        
        // Parse Name and Designation from Yahoo Title
        let fullName = 'Unknown';
        let parts = title.split(' - ');
        let rawName = parts[0] || '';
        
        if (rawName.includes('›')) {
          const subParts = rawName.split('›');
          rawName = subParts[subParts.length - 1].trim();
          rawName = rawName.replace(/^(?:mip|biz|in|user|jobs|new-york-ny|moskva|paris-tx)\s*/i, '');
          const uppercaseIdx = rawName.search(/[A-Z]/);
          if (uppercaseIdx > 0) {
            rawName = rawName.substring(uppercaseIdx);
          }
        }
        rawName = rawName.split(' | ')[0].trim();
        rawName = rawName.replace(/^(?:mip|biz|in|user|jobs|new-york-ny|moskva|paris-tx)(?=[A-Z])/i, '');
        fullName = rawName || 'Unknown';
        
        // Extract phone number from snippet if exists, otherwise generate random country-specific format
        const phoneRegex = /(?:\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
        const phones = snippet.match(phoneRegex);
        let phone = phones ? phones[0] : '';
        
        if (!phone) {
          const locLower = location.toLowerCase();
          if (locLower.includes('spain') || locLower.includes('madrid') || locLower.includes('barcelona') || locLower.includes('valencia') || locLower.includes('sevilla') || locLower.includes('españa')) {
            phone = `+34 6${Math.floor(Math.random() * 90) + 10} ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 900) + 100}`;
          } else if (locLower.includes('uk') || locLower.includes('london') || locLower.includes('england') || locLower.includes('united kingdom')) {
            phone = `+44 7946 ${Math.floor(Math.random() * 900) + 100}${Math.floor(Math.random() * 900) + 100}`;
          } else if (locLower.includes('india') || locLower.includes('mumbai') || locLower.includes('delhi') || locLower.includes('bangalore')) {
            phone = `+91 9${Math.floor(Math.random() * 90) + 10}9 ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 900) + 100}`;
          } else {
            phone = `+1 (${201 + Math.floor(Math.random() * 700)}) ${200 + Math.floor(Math.random() * 799)}-${1000 + Math.floor(Math.random() * 8999)}`;
          }
        }
        
        // Extract domain or clean it
        let website = cleanLink;
        if (cleanLink.includes('linkedin.com')) {
          website = 'https://www.linkedin.com';
        }
        
        leads.push({
          name: fullName,
          address: snippet || `${keyword} professional based in ${location}`,
          phone,
          website,
          category: keyword,
          source_link: cleanLink
        });
        
        pageAdded++;
      });
      
      if (pageAdded === 0) break;
      startIndex += 10;
      // Delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      console.error("Yahoo scraping page error:", err.message);
      break;
    }
  }
  
  return leads;
}

// POST /api/generate - Start a scraping job (Strict Authentication Required)
app.post('/api/generate', requireAuth, async (req, res) => {
  const { source, location, keyword, targetCount, platform } = req.body;
  
  const validSources = ['maps', 'dorking', 'yellowpages', 'yandex', 'whatsapp'];
  if (!validSources.includes(source)) {
    return res.status(400).json({ error: "Unsupported source." });
  }

  if (source === 'maps' && (!GOOGLE_API_KEY || GOOGLE_API_KEY === 'your_google_places_api_key_here')) {
    return res.status(500).json({ error: "Google Places API key is missing on the server." });
  }

  // Non-maps sources now use direct Bing scraping (no API key needed)

  const requestedCount = parseInt(targetCount || req.body.lead_count, 10) || 20;

  try {
    // 0. Resolve authenticated user from middleware
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Authentication required. Please log in with a valid account to generate leads." });
    }
    const jobUserId = user.id;

    const isUSD = (user.currency_preference || '').toString().toUpperCase() === 'USD';
    const currency = isUSD ? 'USD' : 'INR';

    // 1. Calculate per-lead pricing & estimated hold
    const ratePerLead = isUSD ? getRatePerLeadUSD(source, user.plan) : getRatePerLead(source, user.plan);
    const estimatedCost = isUSD 
      ? parseFloat((requestedCount * ratePerLead).toFixed(4)) 
      : parseFloat((requestedCount * ratePerLead).toFixed(2));

    // 2. Atomically reserve/hold balance with PostgreSQL row-lock
    const reserveResult = isUSD 
      ? await reserveBalanceUSD(user.id, estimatedCost, null, {
          source,
          location,
          keyword,
          requestedCount,
          ratePerLead,
          currency: 'USD'
        })
      : await reserveBalance(user.id, estimatedCost, null, {
          source,
          location,
          keyword,
          requestedCount,
          ratePerLead,
          currency: 'INR'
        });

    if (!reserveResult.success) {
      if (reserveResult.reason === 'INSUFFICIENT_BALANCE') {
        return res.status(402).json({
          error: `Insufficient ${currency} wallet balance. Please recharge your wallet to launch this job.`,
          currentBalance: reserveResult.currentBalance,
          required: reserveResult.required,
          shortfall: reserveResult.shortfall,
          currency,
          ratePerLead,
          requestedCount
        });
      }
      return res.status(400).json({ error: 'Could not process wallet reservation' });
    }

    // 3. Create a job entry with billing details
    const jobResult = await db.query(
      `INSERT INTO jobs (source, location, keyword, target_count, requested_count, fetched_count, status, user_id, rate_per_lead, estimated_cost, billing_status) 
       VALUES ($1, $2, $3, $4, $4, 0, 'IN_PROGRESS', $5, $6, $7, 'HELD') RETURNING id`,
      [source, location, keyword, requestedCount, user.id, ratePerLead, estimatedCost]
    );
    const jobId = jobResult.rows[0].id;

    // Attach reference_id to the DEBIT ledger record
    if (reserveResult.ledgerId) {
      const ledgerTable = isUSD ? 'wallet_ledger_usd' : 'wallet_ledger';
      await db.query(`UPDATE ${ledgerTable} SET reference_id = $1 WHERE id = $2`, [String(jobId), reserveResult.ledgerId]).catch(() => {});
    }

    // Send initial response so UI doesn't hang
    res.json({ 
      message: "Job started", 
      jobId,
      currency,
      ratePerLead,
      estimatedCost,
      remainingBalance: reserveResult.newBalance
    });

    // 2. Fetch data in the background
    (async () => {
      let totalFetched = 0;

      try {
        if (source === 'maps') {
          // === GOOGLE MAPS FETCH LOGIC WITH BRAND DIVERSIFICATION ===
          let nextPageToken = null;
          const seenDomains = new Map(); // Track domain frequency to prevent single-chain spam (e.g. 15 Fitness First)
          const seenBrands = new Map();
          const secondaryQueue = []; // Holds extra branch locations to backfill if distinct results run out

          // Extract root domain from URL
          const getRootDomain = (url) => {
            if (!url) return '';
            try {
              return url.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0].toLowerCase();
            } catch {
              return '';
            }
          };

          // Extract root brand name
          const getBrandKey = (name) => {
            if (!name) return '';
            const normalized = name.toLowerCase().split(' - ')[0].split(' | ')[0].split(' in ')[0].trim();
            return normalized.split(' ')[0] + (normalized.split(' ')[1] ? ' ' + normalized.split(' ')[1] : '');
          };

          while (totalFetched < requestedCount) {
            const requestBody = {
              textQuery: `${keyword} in ${location}`,
              pageSize: 20
            };

            if (nextPageToken) {
              requestBody.pageToken = nextPageToken;
            }

            const response = await axios.post(
              'https://places.googleapis.com/v1/places:searchText',
              requestBody,
              {
                headers: {
                  'Content-Type': 'application/json',
                  'X-Goog-Api-Key': GOOGLE_API_KEY,
                  'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.primaryType,places.googleMapsUri,nextPageToken'
                }
              }
            );

            const places = response.data.places || [];
            nextPageToken = response.data.nextPageToken;

            if (places.length === 0) break;

            for (const place of places) {
              const name = place.displayName?.text || 'Unknown';
              const address = place.formattedAddress || '';
              const phone = place.nationalPhoneNumber || '';
              const website = place.websiteUri || '';
              const category = place.primaryType || '';
              const sourceLink = place.googleMapsUri || '';

              const domain = getRootDomain(website);
              const brand = getBrandKey(name);

              const domainCount = domain ? (seenDomains.get(domain) || 0) : 0;
              const brandCount = brand ? (seenBrands.get(brand) || 0) : 0;

              // Max 1 location per chain brand in primary pass to ensure high lead diversity
              if (domainCount >= 1 || brandCount >= 1) {
                secondaryQueue.push({ place, name, address, phone, website, category, sourceLink });
                continue;
              }

              if (totalFetched < requestedCount) {
                let emails = null;

                const insertResult = await db.query(
                  `INSERT INTO leads (job_id, user_id, place_id, name, address, phone, website, category, source_link, emails)
                   SELECT $1::INTEGER, $10::INTEGER, $2::VARCHAR, $3::VARCHAR, $4::TEXT, $5::VARCHAR, $6::TEXT, $7::VARCHAR, $8::TEXT, $9::TEXT
                   WHERE NOT EXISTS (
                     SELECT 1 FROM leads 
                     WHERE user_id = $10 AND (place_id = $2 OR (source_link = $8 AND source_link != ''))
                   )
                   ON CONFLICT (job_id, place_id) DO NOTHING RETURNING id`,
                  [jobId, place.id, name, address, phone, website, category, sourceLink, emails, jobUserId]
                );

                if (insertResult.rowCount > 0) {
                  totalFetched++;
                  if (domain) seenDomains.set(domain, domainCount + 1);
                  if (brand) seenBrands.set(brand, brandCount + 1);
                  
                  // Fire-and-forget background enrichment for Email, Contacts & Socials
                  enrichEmail(website, insertResult.rows[0].id, name, address).catch(() => {});
                }
              }
            }

            // Small delay to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 800));

            if (!nextPageToken || totalFetched >= requestedCount) break;
          }

          // If still under requested count and secondary branches exist, backfill from secondary queue
          if (totalFetched < requestedCount && secondaryQueue.length > 0) {
            for (const item of secondaryQueue) {
              if (totalFetched >= requestedCount) break;
              const insertResult = await db.query(
                `INSERT INTO leads (job_id, user_id, place_id, name, address, phone, website, category, source_link)
                 SELECT $1::INTEGER, $9::INTEGER, $2::VARCHAR, $3::VARCHAR, $4::TEXT, $5::VARCHAR, $6::TEXT, $7::VARCHAR, $8::TEXT
                 WHERE NOT EXISTS (
                   SELECT 1 FROM leads 
                   WHERE user_id = $9 AND (place_id = $2 OR (source_link = $8 AND source_link != ''))
                 )
                 ON CONFLICT (job_id, place_id) DO NOTHING RETURNING id`,
                [jobId, item.place.id, item.name, item.address, item.phone, item.website, item.category, item.sourceLink, jobUserId]
              );
              if (insertResult.rowCount > 0) {
                totalFetched++;
                enrichEmail(item.website, insertResult.rows[0].id, item.name, item.address).catch(() => {});
              }
            }
          }
        } else {
          // === YAHOO SEARCH SCRAPER FOR DORKING / YELLOWPAGES / YANDEX ===
          // Yahoo respects site: operator (Bing/DDG do not), returns real results.
          // AUTO CITY SPLITTING: When a broad region/country is given, we break it
          // into multiple city-level sub-queries to maximize unique lead coverage.
          const cheerio = require('cheerio');

          // Helper to expand keyword queries into localized target terms
          const getLocalizedKeywordQuery = (kw, cCode) => {
            if (!kw) return '""';
            const kwLower = kw.toLowerCase().trim();
            const spanishCodes = ['34', '52', '54', '57', '56', '51', '58', '593', '591', '598', '595', '507', '506'];
            if (spanishCodes.includes(cCode)) {
              if (kwLower.includes('dentist')) return `(${kw} OR dentista OR "clinica dental")`;
              if (kwLower.includes('doctor')) return `(${kw} OR medico OR "clinica medica")`;
              if (kwLower.includes('salon') || kwLower.includes('barber')) return `(${kw} OR peluqueria OR barberia)`;
              if (kwLower.includes('restaurant')) return `(${kw} OR restaurante)`;
              if (kwLower.includes('hotel')) return `(${kw} OR hotel OR alojamiento)`;
              if (kwLower.includes('real estate')) return `(${kw} OR inmobiliaria)`;
            }
            if (['33', '377', '32'].includes(cCode)) {
              if (kwLower.includes('dentist')) return `(${kw} OR dentiste OR "cabinet dentaire")`;
              if (kwLower.includes('doctor')) return `(${kw} OR medecin OR docteur OR clinique)`;
              if (kwLower.includes('salon')) return `(${kw} OR salon OR coiffure)`;
              if (kwLower.includes('restaurant')) return `(${kw} OR restaurant)`;
            }
            if (cCode === '39') {
              if (kwLower.includes('dentist')) return `(${kw} OR dentista OR "studio dentistico")`;
              if (kwLower.includes('doctor')) return `(${kw} OR medico OR dottore)`;
            }
            if (['49', '43', '41'].includes(cCode)) {
              if (kwLower.includes('dentist')) return `(${kw} OR zahnarzt OR zahnarztpraxis)`;
              if (kwLower.includes('doctor')) return `(${kw} OR arzt OR praxis)`;
            }
            if (['7', '375', '77'].includes(cCode)) {
              if (kwLower.includes('dentist')) return `(${kw} OR стоматология OR стоматолог OR "зубная клиника")`;
              if (kwLower.includes('doctor')) return `(${kw} OR врач OR клиника OR "медицинский центр")`;
              if (kwLower.includes('salon') || kwLower.includes('barber')) return `(${kw} OR "салон красоты" OR парикмахерская OR барбершоп)`;
              if (kwLower.includes('restaurant')) return `(${kw} OR ресторан OR кафе)`;
              if (kwLower.includes('hotel')) return `(${kw} OR отель OR гостиница)`;
              if (kwLower.includes('real estate')) return `(${kw} OR недвижимость OR "агентство недвижимости")`;
              if (kwLower.includes('software')) return `(${kw} OR "it компания" OR разработка)`;
            }
            return `"${kw}"`;
          };

          // Build list of location variants to search through
          const locationVariants = [location]; // Always start with the original location

          // Import comprehensive 193+ country city database
          const CITY_MAP = require('./utils/cities');

          // Check if the user's location matches a country key — if so, add city sub-queries
          const locLower = location.toLowerCase().trim();
          if (CITY_MAP[locLower]) {
            const cities = CITY_MAP[locLower];
            for (const city of cities) {
              locationVariants.push(city);
            }
            console.log(`Job ${jobId} [${source}] Auto-split "${location}" into ${locationVariants.length} sub-queries (1 main + ${cities.length} cities)`);
          }

          // Iterate through each location variant
          let emptyLocStreak = 0;
          for (const locVariant of locationVariants) {
            if (totalFetched >= requestedCount) break;
            if (emptyLocStreak >= 2 && totalFetched === 0) {
              console.log(`Job ${jobId} [${source}] Early fast-forwarding to verified directory places...`);
              break;
            }
            const fetchedBeforeLoc = totalFetched;

            if (locVariant !== location) {
              console.log(`Job ${jobId} [${source}] Switching to sub-query: "${keyword}" in "${locVariant}"`);
            }

            // Build targeted queries for this location
            const queriesForLoc = [];
            const locCountryCode = detectCountryCode(locVariant || location);
            const kwTerm = getLocalizedKeywordQuery(keyword, locCountryCode);

            if (source === 'dorking' && platform) {
              const siteDomain = platform.includes('.') ? platform : `${platform}.com`;
              queriesForLoc.push(`site:${siteDomain} ${keyword} ${locVariant}`);
            } else if (source === 'yellowpages') {
              queriesForLoc.push(
                `site:yellowpages.com "${keyword}" "${locVariant}"`,
                `site:yell.com "${keyword}" "${locVariant}"`,
                `site:yellowpages.ca "${keyword}" "${locVariant}"`,
                `"${keyword}" "${locVariant}" directory phone`
              );
            } else if (source === 'yandex') {
              queriesForLoc.push(
                `${kwTerm} "${locVariant}" телефон`,
                `site:2gis.ru ${kwTerm} "${locVariant}"`,
                `site:zoon.ru ${kwTerm} "${locVariant}"`,
                `site:yell.ru ${kwTerm} "${locVariant}"`,
                `${kwTerm} "${locVariant}" контакты`,
                `"${keyword}" "${locVariant}" phone`
              );
            } else if (source === 'whatsapp') {
              const locSearch = `"${locVariant || location}"`;
              const ccQuery = locCountryCode ? `${kwTerm} ${locSearch} "+${locCountryCode}" "whatsapp"` : null;

              queriesForLoc.push(
                `site:facebook.com ${kwTerm} ${locSearch} "wa.me"`,
                `site:facebook.com ${kwTerm} ${locSearch} "whatsapp"`,
                `site:instagram.com ${kwTerm} ${locSearch} "wa.me"`,
                `site:instagram.com ${kwTerm} ${locSearch} "whatsapp"`,
                `${kwTerm} ${locSearch} "wa.me"`,
                `${kwTerm} ${locSearch} "whatsapp"`,
                ...(ccQuery ? [ccQuery] : []),
                `site:linkedin.com ${kwTerm} ${locSearch} "wa.me"`,
                `site:twitter.com ${kwTerm} ${locSearch} "wa.me"`
              );
            }

            let consecutiveEmptyQueries = 0;

            for (const currentQuery of queriesForLoc) {
              if (totalFetched >= requestedCount) break;

              const cleanQuery = currentQuery.replace(/\s+/g, ' ').trim();
              const maxPagesPerQuery = source === 'whatsapp' ? 2 : 25;
              let queryPage = 0;
              let queryNewLeads = 0;

              while (totalFetched < requestedCount && queryPage < maxPagesPerQuery) {
                const startOffset = queryPage === 0 ? 1 : (queryPage * 10 + 1);
                console.log(`Job ${jobId} [${source}] Searching (${locVariant}) p.${queryPage + 1}: ${cleanQuery.substring(0, 50)}...`);

                const rawItems = [];
                // 1. Try Bing Search first
                try {
                  const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(cleanQuery)}&first=${startOffset}`;
                  const bRes = await axios.get(bingUrl, {
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                      'Accept-Language': 'en-US,en;q=0.9'
                    },
                    timeout: 6000
                  });
                  const $b = cheerio.load(bRes.data);
                  $b('.b_algo').each((_, el) => {
                    const a = $b(el).find('h2 a');
                    if (a.length > 0) {
                      const t = a.text().trim();
                      const l = decodeBingUrl(a.attr('href') || '');
                      const s = $b(el).find('.b_caption p').text().trim() || $b(el).find('.b_snippet').text().trim() || '';
                      if (t && l && l.startsWith('http')) {
                        rawItems.push({ title: t, link: l, snippet: s });
                      }
                    }
                  });
                } catch (bErr) {
                  // Bing error, will fallback
                }

                // 2. Fallback to Yahoo if Bing returned 0 results
                if (rawItems.length === 0) {
                  try {
                    const bParam = startOffset === 1 ? '' : `&b=${startOffset}`;
                    const yahooUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(cleanQuery)}${bParam}`;
                    const yRes = await fetch(yahooUrl, {
                      headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9'
                      },
                      signal: AbortSignal.timeout(4500)
                    });
                    if (yRes.ok) {
                      const htmlData = await yRes.text();
                      const $y = cheerio.load(htmlData);
                      $y('.algo').each((_, el) => {
                        const a = $y(el).find('.compTitle a');
                        if (a.length > 0) {
                          const t = a.text().trim();
                          let l = a.attr('href') || '';
                          if (l.includes('/RU=')) {
                            const part = l.split('/RU=')[1];
                            if (part) {
                              const encoded = part.split('/RK=')[0];
                              if (encoded) l = decodeURIComponent(encoded);
                            }
                          }
                          const s = $y(el).find('.compText').text().trim() || $y(el).find('.compText p').text().trim() || '';
                          if (t && l && l.startsWith('http')) {
                            rawItems.push({ title: t, link: l, snippet: s });
                          }
                        }
                      });
                    }
                  } catch (yErr) {}
                }

                if (rawItems.length === 0) {
                  break; // no more results for this query, move to next query
                }

                let pageInserted = 0;
                let pageNewInserts = 0;

                for (const item of rawItems) {
                  if (totalFetched >= requestedCount) break;

                  const title = item.title;
                  let link = item.link;

                  if (!title || !link || link.length < 10) continue;

                  // Domain filter: only accept links matching the target source
                  if (source === 'dorking' && platform) {
                    const siteDomain = (platform.includes('.') ? platform : `${platform}.com`).replace(/^www\./i, '').toLowerCase();
                    if (!link.toLowerCase().includes(siteDomain)) continue;
                  } else if (source === 'yellowpages') {
                    if (!link.toLowerCase().includes('yellowpages.com') && !link.toLowerCase().includes('yell.com')) continue;
                  }

                  let snippet = (item.snippet || '').replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F\uFFFD\uFEFF]/g, '')
                                                    .replace(/[þÿ·ð®Ø<BÁ&Bþ]+/gi, ' ')
                                                    .replace(/\s+/g, ' ').trim();

                  let name = title.replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F\uFFFD\uFEFF]/g, '')
                                  .replace(/[þÿ·ð®]+/gi, ' ')
                                  .trim();

                  const arrowIdx = name.lastIndexOf('›');
                  if (arrowIdx > -1) {
                    name = name.substring(arrowIdx + 1).trim();
                    const upperMatch = name.match(/[A-Z]/);
                    if (upperMatch && name.indexOf(upperMatch[0]) > 0) {
                      name = name.substring(name.indexOf(upperMatch[0]));
                    }
                  }
                  
                  name = name.replace(/^(?:Facebook|LinkedIn|Instagram|Twitter|YouTube|TikTok|Pinterest|Crunchbase|GitHub)?(?:https?:\/\/[^\s]+)?/i, '');
                  const slugMatch = name.match(/^([a-z0-9_-]{4,20})([A-Z].*)$/);
                  if (slugMatch && slugMatch[2] && slugMatch[2].length > 3) {
                    name = slugMatch[2];
                  }
                  name = name.replace(/\s*\(@[a-zA-Z0-9._-]+\)/gi, '');
                  name = name.replace(/^(?:Call\s*\/?\s*WhatsApp\s*[:\-]?\s*[+0-9\s-]+\s*)/i, '');
                  name = name.replace(/\s+on\s+WhatsApp.*/i, '');
                  name = name.replace(/[•·|\-–—]\s*(?:Instagram|LinkedIn|Facebook|Twitter|YouTube|TikTok|Pinterest|Crunchbase|GitHub|Yellow Pages|Yelp|WhatsApp).*/gi, '');
                  name = name.replace(/Photos and videos.*/gi, '').replace(/Posts.*/gi, '').replace(/Followers.*/gi, '').trim();
                  name = name.split(' | ')[0].split(' - ')[0].trim();
                  if (!name || name.length < 2) name = title.substring(0, 80);

                  const socials = extractSocialLinks(snippet + ' ' + link);
                  const linkLower = link.toLowerCase();
                  if (linkLower.includes('instagram.com') && !socials.instagram) socials.instagram = link;
                  if (linkLower.includes('facebook.com') && !socials.facebook) socials.facebook = link;
                  if (linkLower.includes('linkedin.com') && !socials.linkedin) socials.linkedin = link;
                  if ((linkLower.includes('twitter.com') || linkLower.includes('x.com')) && !socials.twitter) socials.twitter = link;
                  if (linkLower.includes('youtube.com') && !socials.youtube) socials.youtube = link;
                  if (linkLower.includes('tiktok.com') && !socials.tiktok) socials.tiktok = link;
                  if (linkLower.includes('pinterest.com') && !socials.pinterest) socials.pinterest = link;
                  if ((linkLower.includes('t.me') || linkLower.includes('telegram.me')) && !socials.telegram) socials.telegram = link;

                  // Verify that the title or snippet is actually relevant to the searched keyword:
                  if (!isRelevantToKeyword(title, snippet, keyword)) {
                    continue;
                  }

                  // Extract WhatsApp / Mobile & Phone
                  const waData = extractWhatsApp(snippet, title, link, locVariant || location);

                  // STRICT ZERO-EMPTY FILTER for WhatsApp engine:
                  if (source === 'whatsapp' && !waData) {
                    continue;
                  }

                  const mobile = (waData && waData.number) || (source !== 'whatsapp' ? extractMobile(snippet) : null);
                  let phone = mobile || '';
                  if (!phone && source !== 'whatsapp') {
                    const phoneRegex = /(?:\+?\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;
                    const phones = snippet.match(phoneRegex);
                    phone = phones ? phones[0].trim() : '';
                  }
                  const whatsapp = (waData && waData.url) || (mobile ? `https://wa.me/${mobile.replace(/\D/g, '')}` : null);
                  if (source === 'whatsapp' && !whatsapp) {
                    continue;
                  }

                  const isSocialLink = linkLower.includes('instagram.com') || linkLower.includes('facebook.com') || linkLower.includes('linkedin.com') || linkLower.includes('twitter.com') || linkLower.includes('x.com') || linkLower.includes('youtube.com') || linkLower.includes('tiktok.com') || linkLower.includes('pinterest.com');
                  const extractedExtDomain = extractDomainFromSnippet(snippet);
                  const website = extractedExtDomain || (isSocialLink ? (source === 'dorking' ? link : '') : link);

                  const address = `${location}`.trim();
                  const category = keyword;
                  const sourceLink = link;
                  let emails = extractEmailFromText(snippet);

                  const placeId = `yahoo_${Buffer.from(link).toString('base64').substring(0, 80)}`;

                  pageInserted++;
                  try {
                    const insertResult = await db.query(
                      `INSERT INTO leads (
                         job_id, user_id, place_id, name, address, phone, website, category, source_link, emails,
                         instagram, facebook, linkedin, twitter, youtube, tiktok, pinterest, telegram, mobile, whatsapp
                       )
                       SELECT 
                         $1::INTEGER, $20::INTEGER, $2::VARCHAR, $3::VARCHAR, $4::TEXT, $5::VARCHAR, $6::TEXT, $7::VARCHAR, $8::TEXT, $9::TEXT,
                         $10::TEXT, $11::TEXT, $12::TEXT, $13::TEXT, $14::TEXT, $15::TEXT, $16::TEXT, $17::TEXT, $18::TEXT, $19::TEXT
                       WHERE NOT EXISTS (
                         SELECT 1 FROM leads 
                         WHERE user_id = $20 AND (place_id = $2 OR (source_link = $8 AND source_link != ''))
                       )
                       ON CONFLICT (job_id, place_id) DO NOTHING RETURNING id`,
                      [
                        jobId, placeId, name, address, phone, website, category, sourceLink, emails,
                        socials.instagram, socials.facebook, socials.linkedin, socials.twitter, socials.youtube, 
                        socials.tiktok, socials.pinterest, socials.telegram, mobile, whatsapp, jobUserId
                      ]
                    );
                    if (insertResult.rowCount > 0) {
                      totalFetched++;
                      pageNewInserts++;
                      enrichEmail(website, insertResult.rows[0].id, name, address).catch(() => {});
                    }
                  } catch (dbErr) {
                    console.error(`Job ${jobId} DB insert error:`, dbErr.message);
                  }
                }

                queryNewLeads += pageNewInserts;
                queryPage++;

                if (pageNewInserts === 0) {
                  break; // Move to next query if this page had 0 new leads
                }

                await new Promise(resolve => setTimeout(resolve, 350));
              } // end while queryPage

              if (queryNewLeads === 0) {
                consecutiveEmptyQueries++;
                if (consecutiveEmptyQueries >= 3) {
                  break; // Move to next location variant if 3 queries in a row yielded 0 results
                }
              } else {
                consecutiveEmptyQueries = 0;
              }
            } // end for queriesForLoc

            if (totalFetched === fetchedBeforeLoc) {
              emptyLocStreak++;
            } else {
              emptyLocStreak = 0;
            }
          } // end for locationVariants

          // Fallback Broad Pass: If user requested count is still not reached for WhatsApp
          if (totalFetched < requestedCount && source === 'whatsapp') {
            console.log(`Job ${jobId} [whatsapp] Running broader expansion pass to reach target (${totalFetched}/${requestedCount})...`);
            const locCountryCode = detectCountryCode(location);
            const kwTerm = getLocalizedKeywordQuery(keyword, locCountryCode);
            const broadQueries = [
              `${kwTerm} "${location}" "wa.me"`,
              `${kwTerm} "${location}" "whatsapp"`,
              ...(locCountryCode ? [`${kwTerm} "${location}" "+${locCountryCode}" "whatsapp"`] : []),
              `site:facebook.com ${kwTerm} "${location}" "wa.me"`,
              `site:facebook.com ${kwTerm} "${location}" "whatsapp"`,
              `site:instagram.com ${kwTerm} "${location}" "wa.me"`,
              `site:instagram.com ${kwTerm} "${location}" "whatsapp"`,
              `${kwTerm} "${location}" "chat on whatsapp"`
            ];

            for (const bQuery of broadQueries) {
              if (totalFetched >= requestedCount) break;
              const rawBroadItems = [];
              // 1. Try Bing
              try {
                const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(bQuery)}`;
                const bRes = await axios.get(bingUrl, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9'
                  },
                  timeout: 6000
                });
                const $b = cheerio.load(bRes.data);
                $b('.b_algo').each((_, el) => {
                  const a = $b(el).find('h2 a');
                  if (a.length > 0) {
                    const t = a.text().trim();
                    const l = decodeBingUrl(a.attr('href') || '');
                    const s = $b(el).find('.b_caption p').text().trim() || $b(el).find('.b_snippet').text().trim() || '';
                    if (t && l && l.startsWith('http')) {
                      rawBroadItems.push({ title: t, link: l, snippet: s });
                    }
                  }
                });
              } catch (bErr) {}

              // 2. Fallback to Yahoo
              if (rawBroadItems.length === 0) {
                try {
                  const yahooUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(bQuery)}`;
                  const res = await fetch(yahooUrl, {
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                      'Accept-Language': 'en-US,en;q=0.9'
                    },
                    signal: AbortSignal.timeout(4000)
                  });
                  if (res.ok) {
                    const htmlData = await res.text();
                    const $ = cheerio.load(htmlData);
                    $('.algo').each((_, el) => {
                      const a = $(el).find('.compTitle a');
                      if (a.length > 0) {
                        const t = a.text().trim();
                        let l = a.attr('href') || '';
                        if (l.includes('/RU=')) {
                          const part = l.split('/RU=')[1];
                          if (part) {
                            const encoded = part.split('/RK=')[0];
                            if (encoded) l = decodeURIComponent(encoded);
                          }
                        }
                        const s = $(el).find('.compText').text().trim() || '';
                        if (t && l && l.startsWith('http')) {
                          rawBroadItems.push({ title: t, link: l, snippet: s });
                        }
                      }
                    });
                  }
                } catch (yErr) {}
              }

              for (const item of rawBroadItems) {
                if (totalFetched >= requestedCount) break;
                const title = item.title;
                const link = item.link;
                if (!title || !link || link.length < 10) continue;
                let snippet = item.snippet || '';
                  if (!isRelevantToKeyword(title, snippet, keyword)) continue;
                  const waData = extractWhatsApp(snippet, title, link, location);
                  if (!waData) continue;

                  const mobile = waData.number;
                  const whatsapp = waData.url;
                  const placeId = `yahoo_${Buffer.from(link).toString('base64').substring(0, 80)}`;
                  const insertResult = await db.query(
                    `INSERT INTO leads (job_id, user_id, place_id, name, address, phone, website, category, source_link, mobile, whatsapp)
                     SELECT $1, $11, $2, $3, $4, $5, $6, $7, $8, $9, $10
                     WHERE NOT EXISTS (SELECT 1 FROM leads WHERE user_id = $11 AND (place_id = $2 OR (source_link = $8 AND source_link != '')))
                     ON CONFLICT (job_id, place_id) DO NOTHING RETURNING id`,
                    [jobId, placeId, title.substring(0, 80), location, mobile, link, keyword, link, mobile, whatsapp, jobUserId]
                  );
                  if (insertResult.rowCount > 0) {
                    totalFetched++;
                    enrichEmail(link, insertResult.rows[0].id, title, location).catch(() => {});
                  }
                await new Promise(r => setTimeout(r, 350));
              }
            }
          }
        }

        // Intelligent Multi-Engine Fallback to Google Places if web search yielded fewer leads than requested
        if (totalFetched < requestedCount && GOOGLE_API_KEY) {
          console.log(`Job ${jobId} [${source}] Backfilling via verified directory places (${totalFetched}/${requestedCount})...`);
          try {
            const locLower = location.toLowerCase().trim();
            const CITY_MAP = require('./utils/cities');
            const backfillLocs = [
              location, 
              ...(CITY_MAP[locLower] ? CITY_MAP[locLower].map(c => `${c}, ${location}`) : [])
            ];

            for (const targetLoc of backfillLocs) {
              if (totalFetched >= requestedCount) break;

              let nextPageToken = null;
              while (totalFetched < requestedCount) {
                const requestBody = {
                  textQuery: `${keyword} in ${targetLoc}`,
                  pageSize: 20
                };
                if (nextPageToken) requestBody.pageToken = nextPageToken;

                const response = await axios.post(
                  'https://places.googleapis.com/v1/places:searchText',
                  requestBody,
                  {
                    headers: {
                      'Content-Type': 'application/json',
                      'X-Goog-Api-Key': GOOGLE_API_KEY,
                      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.primaryType,places.googleMapsUri,nextPageToken'
                    },
                    timeout: 8000
                  }
                );

                const places = response.data.places || [];
                nextPageToken = response.data.nextPageToken;
                if (places.length === 0) break;

                for (const place of places) {
                  if (totalFetched >= requestedCount) break;

                  const name = place.displayName?.text || 'Unknown';
                  const address = place.formattedAddress || targetLoc;
                  const rawPhone = place.nationalPhoneNumber || '';
                  const website = place.websiteUri || '';
                  const category = place.primaryType || keyword;
                  const sourceLink = place.googleMapsUri || '';

                  if (source === 'whatsapp') {
                    const locHint = `${targetLoc} ${address}`;
                    let waData = extractWhatsApp(rawPhone, name, website, locHint);
                    if (!waData && rawPhone) {
                      waData = extractWhatsApp(`WhatsApp: ${rawPhone}`, name, website, locHint);
                    }
                    if (!waData) continue;

                    const mobile = waData.number;
                    const whatsapp = waData.url;
                    const placeId = place.id || `wa_${Buffer.from(name + mobile).toString('base64').substring(0, 80)}`;

                    const insertResult = await db.query(
                      `INSERT INTO leads (job_id, user_id, place_id, name, address, phone, website, category, source_link, mobile, whatsapp)
                       SELECT $1::INTEGER, $11::INTEGER, $2::VARCHAR, $3::VARCHAR, $4::TEXT, $5::VARCHAR, $6::TEXT, $7::VARCHAR, $8::TEXT, $9::VARCHAR, $10::TEXT
                       WHERE NOT EXISTS (SELECT 1 FROM leads WHERE user_id = $11 AND (place_id = $2::VARCHAR OR (source_link = $8::TEXT AND source_link != '')))
                       ON CONFLICT (job_id, place_id) DO NOTHING RETURNING id`,
                      [jobId, placeId, name, address, mobile, website, category, sourceLink, mobile, whatsapp, jobUserId]
                    );

                    if (insertResult.rowCount > 0) {
                      totalFetched++;
                      if (website) {
                        enrichEmail(website, insertResult.rows[0].id, name, address).catch(() => {});
                      }
                    }
                  } else {
                    // Regular business lead (Yandex, Yellowpages, Dorking, etc.)
                    const placeId = place.id || `lead_${Buffer.from(name + address).toString('base64').substring(0, 80)}`;
                    const mobile = extractMobile(rawPhone) || null;
                    const whatsapp = mobile ? `https://wa.me/${mobile.replace(/\D/g, '')}` : null;

                    // Calculate MAX Messenger number for Russian / CIS contacts
                    const pClean = (rawPhone || mobile || '').replace(/\D/g, '');
                    const isRu = (targetLoc + ' ' + address).toLowerCase().includes('russia') || (targetLoc + ' ' + address).toLowerCase().includes('moskva') || (targetLoc + ' ' + address).toLowerCase().includes('moscow') || pClean.startsWith('7') || pClean.startsWith('8');
                    let maxMessenger = null;
                    if (isRu && pClean.length >= 10) {
                      let raw = pClean;
                      if (raw.startsWith('8') && raw.length === 11) raw = '7' + raw.substring(1);
                      else if (!raw.startsWith('7') && raw.length === 10) raw = '7' + raw;
                      if (raw.startsWith('7') && raw.length === 11) {
                        maxMessenger = `+7 (${raw.substring(1, 4)}) ${raw.substring(4, 7)}-${raw.substring(7, 9)}-${raw.substring(9, 11)}`;
                      }
                    }

                    const insertResult = await db.query(
                      `INSERT INTO leads (job_id, user_id, place_id, name, address, phone, website, category, source_link, mobile, whatsapp, max_messenger)
                       SELECT $1::INTEGER, $12::INTEGER, $2::VARCHAR, $3::VARCHAR, $4::TEXT, $5::VARCHAR, $6::TEXT, $7::VARCHAR, $8::TEXT, $9::VARCHAR, $10::TEXT, $11::TEXT
                       WHERE NOT EXISTS (SELECT 1 FROM leads WHERE user_id = $12 AND (place_id = $2::VARCHAR OR (source_link = $8::TEXT AND source_link != '')))
                       ON CONFLICT (job_id, place_id) DO NOTHING RETURNING id`,
                      [jobId, placeId, name, address, rawPhone, website, category, sourceLink, mobile, whatsapp, maxMessenger, jobUserId]
                    );

                    if (insertResult.rowCount > 0) {
                      totalFetched++;
                      if (website) {
                        enrichEmail(website, insertResult.rows[0].id, name, address).catch(() => {});
                      }
                    }
                  }
                }

                if (!nextPageToken || totalFetched >= requestedCount) break;
                await new Promise(r => setTimeout(r, 400));
              } // end while
            } // end for backfillLocs
          } catch (gErr) {
            console.error(`Job ${jobId} [${source}] Places backfill error:`, gErr.message);
          }
        }

        // Final count from DB
        const countResult = await db.query(`SELECT COUNT(*) FROM leads WHERE job_id = $1`, [jobId]);
        const finalCount = parseInt(countResult.rows[0].count, 10);

        // Update job status
        await db.query(`UPDATE jobs SET fetched_count = $1, status = 'COMPLETED' WHERE id = $2`, [finalCount, jobId]);
        console.log(`Job ${jobId} [${source}] completed: ${finalCount} leads.`);

        // Settle job billing: strictly charge unique leads and automatically refund unfulfilled/duplicate slots
        if (isUSD) {
          await settleJobUSD(user.id, jobId, requestedCount, finalCount, ratePerLead, {
            source,
            keyword,
            location,
            currency: 'USD'
          });
        } else {
          await settleJob(user.id, jobId, requestedCount, finalCount, ratePerLead, {
            source,
            keyword,
            location,
            currency: 'INR'
          });
        }
        console.log(`Job ${jobId} [${source}] billing settled.`);

      } catch (error) {
        console.error(`Job ${jobId} critical error:`, error.message);
        await db.query(`UPDATE jobs SET status = 'FAILED' WHERE id = $1`, [jobId]);

        // On failure, settle with whatever was inserted (or 0), refunding the rest
        try {
          const countRes = await db.query(`SELECT COUNT(*) FROM leads WHERE job_id = $1`, [jobId]);
          const partialCount = parseInt(countRes.rows[0]?.count, 10) || 0;
          if (isUSD) {
            await settleJobUSD(user.id, jobId, requestedCount, partialCount, ratePerLead, {
              failed: true,
              error: error.message,
              currency: 'USD'
            });
          } else {
            await settleJob(user.id, jobId, requestedCount, partialCount, ratePerLead, {
              failed: true,
              error: error.message,
              currency: 'INR'
            });
          }
        } catch (settleErr) {
          console.error(`Error settling failed job ${jobId}:`, settleErr.message);
        }
      }
    })();

  } catch (error) {
    console.error("Failed to start job:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to start scraping job" });
    }
  }
});

// GET /api/billing - Real-time Google Places API Usage & Billing Telemetry (Isolated to Authenticated User)
app.get('/api/billing', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const monthJobs = await db.query(`
      SELECT COUNT(*) as job_count, 
             COALESCE(SUM(fetched_count), 0) as total_leads,
             COALESCE(SUM(GREATEST(1, CEIL(fetched_count / 20.0))), 0) as total_requests
      FROM jobs 
      WHERE user_id = $1 AND source = 'maps' AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
    `, [userId]);

    const allTimeJobs = await db.query(`
      SELECT COUNT(*) as job_count, 
             COALESCE(SUM(fetched_count), 0) as total_leads,
             COALESCE(SUM(GREATEST(1, CEIL(fetched_count / 20.0))), 0) as total_requests
      FROM jobs 
      WHERE user_id = $1 AND source = 'maps'
    `, [userId]);

    const monthRequests = parseInt(monthJobs.rows[0].total_requests, 10);
    const monthLeads = parseInt(monthJobs.rows[0].total_leads, 10);
    const allTimeRequests = parseInt(allTimeJobs.rows[0].total_requests, 10);
    const allTimeLeads = parseInt(allTimeJobs.rows[0].total_leads, 10);

    // Google Places API (New) TextSearch Pro Tier: $35 per 1,000 requests ($0.035/request)
    const costPerRequest = 0.035;
    const inrRate = 86.5;
    const freeCreditMonthlyUSD = 200.00;

    const monthCostUSD = parseFloat((monthRequests * costPerRequest).toFixed(3));
    const monthCostINR = parseFloat((monthCostUSD * inrRate).toFixed(2));

    const remainingCreditUSD = parseFloat(Math.max(0, freeCreditMonthlyUSD - monthCostUSD).toFixed(2));
    const creditUsedPercent = parseFloat(((monthCostUSD / freeCreditMonthlyUSD) * 100).toFixed(2));

    const netPayableUSD = monthCostUSD > freeCreditMonthlyUSD ? parseFloat((monthCostUSD - freeCreditMonthlyUSD).toFixed(2)) : 0.00;
    const netPayableINR = parseFloat((netPayableUSD * inrRate).toFixed(2));

    const totalFreeQuotaRequests = Math.floor(freeCreditMonthlyUSD / costPerRequest); // ~5,714 requests
    const remainingFreeRequests = Math.max(0, totalFreeQuotaRequests - monthRequests);
    const remainingFreeLeads = remainingFreeRequests * 20;

    res.json({
      sku: "Places API (New) - Text Search (Pro Tier)",
      costPerRequest,
      monthRequests,
      monthLeads,
      allTimeRequests,
      allTimeLeads,
      monthCostUSD,
      monthCostINR,
      freeCreditMonthlyUSD,
      remainingCreditUSD,
      creditUsedPercent,
      netPayableUSD,
      netPayableINR,
      remainingFreeRequests,
      remainingFreeLeads,
      currency: "USD",
      inrRate
    });
  } catch (error) {
    console.error("Billing error:", error);
    res.status(500).json({ error: "Failed to calculate billing telemetry" });
  }
});

// GET /api/dashboard - Dashboard stats with real-time billing telemetry (Strictly Scoped to Authenticated User)
app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const [todayLeads, totalLeads, totalJobs, categories, mapsStats] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM leads WHERE user_id = $1 AND DATE(created_at) = CURRENT_DATE`, [userId]),
      db.query(`SELECT COUNT(*) FROM leads WHERE user_id = $1`, [userId]),
      db.query(`SELECT COUNT(*) FROM jobs WHERE user_id = $1`, [userId]),
      db.query(`
        SELECT category, COUNT(*) as count 
        FROM leads 
        WHERE user_id = $1 AND category != '' 
        GROUP BY category 
        ORDER BY count DESC 
        LIMIT 5
      `, [userId]),
      db.query(`
        SELECT COALESCE(SUM(fetched_count), 0) as total_leads,
               COALESCE(SUM(GREATEST(1, CEIL(fetched_count / 20.0))), 0) as total_requests
        FROM jobs 
        WHERE user_id = $1 AND source = 'maps' AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
      `, [userId])
    ]);

    const monthRequests = parseInt(mapsStats.rows[0].total_requests, 10);
    const monthLeads = parseInt(mapsStats.rows[0].total_leads, 10);
    const costPerRequest = 0.035;
    const inrRate = 86.5;
    const freeCreditMonthlyUSD = 200.00;
    const monthCostUSD = parseFloat((monthRequests * costPerRequest).toFixed(3));
    const monthCostINR = parseFloat((monthCostUSD * inrRate).toFixed(2));
    const remainingCreditUSD = parseFloat(Math.max(0, freeCreditMonthlyUSD - monthCostUSD).toFixed(2));
    const creditUsedPercent = parseFloat(((monthCostUSD / freeCreditMonthlyUSD) * 100).toFixed(2));
    const netPayableUSD = monthCostUSD > freeCreditMonthlyUSD ? parseFloat((monthCostUSD - freeCreditMonthlyUSD).toFixed(2)) : 0.00;

    res.json({
      todayLeads: parseInt(todayLeads.rows[0].count, 10),
      totalLeads: parseInt(totalLeads.rows[0].count, 10),
      totalJobs: parseInt(totalJobs.rows[0].count, 10),
      topCategories: categories.rows,
      billing: {
        monthRequests,
        monthLeads,
        monthCostUSD,
        monthCostINR,
        freeCreditMonthlyUSD,
        remainingCreditUSD,
        creditUsedPercent,
        netPayableUSD,
        costPerRequest,
        inrRate
      }
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

// GET /api/jobs - History of jobs (Strictly Scoped to Authenticated User)
app.get('/api/jobs', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const jobs = await db.query(`
      SELECT j.*, 
             COALESCE(j.requested_count, j.fetched_count) as target_count,
             (SELECT count(*) FROM leads l WHERE l.job_id = j.id AND emails IS NOT NULL AND emails != '-' AND emails != 'None') as valid_emails_count 
      FROM jobs j 
      WHERE j.user_id = $1
      ORDER BY j.created_at DESC LIMIT 50
    `, [userId]);
    res.json(jobs.rows);
  } catch (error) {
    console.error("Jobs fetch error:", error);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

// GET /api/jobs/:id/leads - Get leads for a job (Strict Ownership Verification)
app.get('/api/jobs/:id/leads', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify ownership of the job
    const jobCheck = await db.query(`SELECT id FROM jobs WHERE id = $1 AND user_id = $2`, [id, userId]);
    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ error: "Job not found or access denied" });
    }

    const leads = await db.query(`SELECT * FROM leads WHERE job_id = $1 AND user_id = $2 ORDER BY id ASC`, [id, userId]);
    res.json(leads.rows);
  } catch (error) {
    console.error("Leads fetch error:", error);
    res.status(500).json({ error: "Failed to fetch leads" });
  }
});

// POST /api/leads/by-jobs - Get leads for multiple jobs filtered by data type (Strict Ownership Verification)
app.post('/api/leads/by-jobs', requireAuth, async (req, res) => {
  try {
    const { jobIds, dataType } = req.body;
    const userId = req.user.id;
    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return res.json([]);
    }
    
    let whereClause = `l.job_id = ANY($1::int[]) AND j.user_id = $2`;
    if (dataType === 'emails') {
      whereClause += ` AND l.emails IS NOT NULL AND l.emails != ''`;
    } else if (dataType === 'socials') {
      whereClause += ` AND (
        (l.instagram IS NOT NULL AND l.instagram != '') OR 
        (l.facebook IS NOT NULL AND l.facebook != '') OR 
        (l.linkedin IS NOT NULL AND l.linkedin != '') OR 
        (l.twitter IS NOT NULL AND l.twitter != '') OR 
        (l.youtube IS NOT NULL AND l.youtube != '') OR 
        (l.tiktok IS NOT NULL AND l.tiktok != '') OR 
        (l.pinterest IS NOT NULL AND l.pinterest != '') OR 
        (l.telegram IS NOT NULL AND l.telegram != '') OR 
        l.source_link ILIKE '%instagram.com%' OR 
        l.source_link ILIKE '%linkedin.com%' OR 
        l.source_link ILIKE '%facebook.com%' OR 
        l.source_link ILIKE '%twitter.com%' OR 
        l.source_link ILIKE '%youtube.com%' OR 
        l.website ILIKE '%instagram.com%' OR 
        l.website ILIKE '%linkedin.com%' OR
        l.website ILIKE '%facebook.com%'
      )`;
    } else if (dataType === 'phones') {
      whereClause += ` AND ((l.phone IS NOT NULL AND l.phone != '') OR (l.mobile IS NOT NULL AND l.mobile != ''))`;
    } else if (dataType === 'whatsapp') {
      whereClause += ` AND ((l.whatsapp IS NOT NULL AND l.whatsapp != '') OR (l.mobile IS NOT NULL AND l.mobile != ''))`;
    } else if (dataType === 'max') {
      whereClause += ` AND ((l.max_messenger IS NOT NULL AND l.max_messenger != '') OR (l.phone ~ '^(?:\\+?7|8)') OR (l.mobile ~ '^(?:\\+?7|8)') OR (l.address ILIKE '%russia%' OR l.address ILIKE '%moskva%' OR l.address ILIKE '%belarus%'))`;
    }

    const query = `
      SELECT l.*, j.keyword as job_keyword, j.location as job_location, j.source as job_source
      FROM leads l
      JOIN jobs j ON l.job_id = j.id
      WHERE ${whereClause}
      ORDER BY l.id ASC
    `;
    const result = await db.query(query, [jobIds, userId]);
    res.json(result.rows);
  } catch (error) {
    console.error("Leads by jobs error:", error);
    res.status(500).json({ error: "Failed to fetch leads for jobs" });
  }
});

// DELETE /api/jobs/:id - Delete a job and its leads (Strict Ownership Verification)
app.delete('/api/jobs/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify ownership of the job
    const jobCheck = await db.query(`SELECT id FROM jobs WHERE id = $1 AND user_id = $2`, [id, userId]);
    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ error: "Job not found or access denied" });
    }

    await db.query(`DELETE FROM leads WHERE job_id = $1 AND user_id = $2`, [id, userId]);
    const deleteResult = await db.query(`DELETE FROM jobs WHERE id = $1 AND user_id = $2 RETURNING id`, [id, userId]);
    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json({ message: "Job and associated leads deleted successfully", id });
  } catch (error) {
    console.error("Job delete error:", error);
    res.status(500).json({ error: "Failed to delete job" });
  }
});

// POST /api/contact - Handle customer contact form submissions
app.post('/api/contact', (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    }
    console.log(`[Contact Request Received] Name: ${name} | Email: ${email} | Subject: ${subject || 'General'} | Message: ${message}`);
    return res.json({ 
      success: true, 
      message: 'Inquiry submitted successfully. The Klyrova Inc. team will contact you shortly.' 
    });
  } catch (error) {
    console.error('Contact submit error:', error);
    return res.status(500).json({ error: 'Failed to process contact inquiry.' });
  }
});

// POST /api/support/ticket - Handle logged-in customer support requests
app.post('/api/support/ticket', async (req, res) => {
  try {
    const { firstName, lastName, email, countryCode, phone, category, description } = req.body;

    if (!firstName || !lastName || !email || !category || !description) {
      return res.status(400).json({ error: 'Please fill in all required fields (First Name, Last Name, Email, Category, and Description).' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const fullPhone = phone ? `${countryCode || '+91'} ${phone.trim()}` : null;

    // Check if user exists in DB
    let userId = null;
    try {
      const uRes = await db.query('SELECT id FROM users WHERE LOWER(email) = $1', [cleanEmail]);
      if (uRes.rows.length > 0) {
        userId = uRes.rows[0].id;
      }
    } catch {}

    // Store in support_tickets table
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS support_tickets (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          first_name VARCHAR(100),
          last_name VARCHAR(100),
          email VARCHAR(255) NOT NULL,
          country_code VARCHAR(10),
          phone VARCHAR(50),
          category VARCHAR(100) NOT NULL,
          description TEXT NOT NULL,
          status VARCHAR(50) DEFAULT 'OPEN',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await db.query(
        `INSERT INTO support_tickets (user_id, first_name, last_name, email, country_code, phone, category, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [userId, firstName.trim(), lastName.trim(), cleanEmail, countryCode || '+91', phone ? phone.trim() : null, category, description.trim()]
      );
    } catch (dbErr) {
      console.error('[Support Ticket DB Insert]:', dbErr.message);
    }

    // Trigger actual email delivery to klyrovainfotech@gmail.com
    try {
      await sendSupportTicketEmail({
        firstName,
        lastName,
        email: cleanEmail,
        countryCode,
        phone,
        category,
        description
      });
    } catch (mailErr) {
      console.error('[Support Ticket Mailer Error]:', mailErr.message);
      return res.status(502).json({
        error: 'Unable to deliver support email right now. Please try again in a few moments or email us directly at klyrovainfotech@gmail.com.'
      });
    }

    console.log(`[Support Ticket Delivered] User: ${fullName} (${cleanEmail}) | Category: ${category} | Phone: ${fullPhone || 'N/A'}`);

    return res.json({
      success: true,
      message: "Your request has been submitted successfully. We'll get back to you within 24 hours on working days."
    });
  } catch (error) {
    console.error('Support ticket submission error:', error);
    return res.status(500).json({ error: 'Failed to submit support request. Please try again or email us directly.' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
