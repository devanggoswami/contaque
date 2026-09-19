const crypto = require('crypto');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'contaque_jwt_development_secret_key_change_in_production';
const AUTH_USER = (process.env.ADMIN_USER || '').trim();
const AUTH_PASS = process.env.ADMIN_PASSWORD || '';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrator';

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
    req.userId = uRes.rows[0].id;
    req.userEmail = verified.email;
    next();
  } catch (err) {
    console.error('requireAuth middleware error:', err);
    return res.status(500).json({ error: 'Authentication verification failed.' });
  }
}

// Helper to extract user without throwing if optional
async function resolveUser(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.query.token || req.headers['x-access-token']);
  if (!token) return null;
  const verified = verifyAuthToken(token);
  if (!verified || !verified.email) return null;
  const uRes = await db.query('SELECT * FROM users WHERE LOWER(email) = $1', [verified.email.toLowerCase()]);
  return uRes.rows[0] || null;
}

module.exports = {
  JWT_SECRET,
  AUTH_USER,
  AUTH_PASS,
  ADMIN_NAME,
  generateAuthToken,
  verifyAuthToken,
  requireAuth,
  resolveUser
};
