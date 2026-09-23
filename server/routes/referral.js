// ==============================================================================
// CONTAQUE REFER & EARN ROUTES
// Endpoints for Referral Information, Code Validation & Reward Claiming
// ==============================================================================

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { ensureUserReferralCode } = require('../db');

// Helper to extract JWT token from request
function extractToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    return auth.substring(7);
  }
  return req.query.token || req.headers['x-access-token'] || null;
}

// Helper to resolve authenticated user
async function resolveUser(req) {
  const token = extractToken(req);
  const jwtSecret = process.env.JWT_SECRET || 'contaque_jwt_development_secret_key_change_in_production';

  if (token) {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const [email, expiresAtStr, signature] = decoded.split(':');
      const expiresAt = parseInt(expiresAtStr, 10);
      if (email && expiresAt && Date.now() < expiresAt) {
        const expectedSig = crypto.createHmac('sha256', jwtSecret).update(`${email}:${expiresAt}`).digest('hex');
        if (signature === expectedSig) {
          const cleanEmail = email.trim().toLowerCase();
          const userRes = await db.query('SELECT * FROM users WHERE LOWER(email) = $1', [cleanEmail]);
          if (userRes.rows.length > 0) {
            return userRes.rows[0];
          }
        }
      }
    } catch (err) {
      console.error('[resolveUser error in referral route]:', err.message);
      return null;
    }
  }
  return null;
}

// ------------------------------------------------------------------------------
// 1. GET /api/referral/info - Referral telemetry, user code, stats & popup status
// ------------------------------------------------------------------------------
router.get('/info', async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ error: 'User not authenticated' });

    // Fetch fresh user record
    const userFreshRes = await db.query('SELECT * FROM users WHERE id = $1', [user.id]);
    const freshUser = userFreshRes.rows[0] || user;

    // Ensure user has a referral_code
    let referralCode = freshUser.referral_code;
    if (!referralCode) {
      referralCode = await ensureUserReferralCode(freshUser.id, freshUser.name);
    }

    // Aggregate statistics
    const statsRes = await db.query(
      `SELECT 
         COUNT(*)::int as total_referrals,
         COALESCE(SUM(reward_amount), 0)::float as total_earned
       FROM referrals
       WHERE referrer_id = $1 AND status = 'COMPLETED'`,
      [freshUser.id]
    );

    const stats = statsRes.rows[0] || { total_referrals: 0, total_earned: 0 };

    // Referral list (history of users who used this user's code)
    const historyRes = await db.query(
      `SELECT 
         r.id,
         r.reward_amount,
         r.created_at,
         u.email,
         u.name
       FROM referrals r
       JOIN users u ON r.referred_user_id = u.id
       WHERE r.referrer_id = $1
       ORDER BY r.created_at DESC
       LIMIT 50`,
      [freshUser.id]
    );

    const history = historyRes.rows.map(row => {
      const email = row.email || '';
      const [localPart, domain] = email.split('@');
      let maskedEmail = email;
      if (localPart && domain) {
        const maskedLocal = localPart.length <= 2 
          ? localPart[0] + '***' 
          : localPart[0] + '***' + localPart[localPart.length - 1];
        maskedEmail = `${maskedLocal}@${domain}`;
      }
      return {
        id: row.id,
        reward_amount: parseFloat(row.reward_amount || 100),
        created_at: row.created_at,
        referred_email: maskedEmail
      };
    });

    const shouldShowPopup = !freshUser.referral_claimed && !freshUser.referral_prompt_dismissed;

    return res.json({
      success: true,
      referral_code: referralCode,
      total_referrals: stats.total_referrals || 0,
      total_earned: stats.total_earned || 0,
      referral_history: history,
      has_claimed: !!freshUser.referral_claimed,
      should_show_popup: shouldShowPopup,
      currency: freshUser.country === 'India' ? 'INR' : 'INR'
    });
  } catch (err) {
    console.error('[GET /api/referral/info error]:', err);
    return res.status(500).json({ error: 'Failed to retrieve referral details' });
  }
});

// ------------------------------------------------------------------------------
// 2. POST /api/referral/claim - Validate code, link referrer & award ₹100 atomically
// ------------------------------------------------------------------------------
router.post('/claim', async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ error: 'User not authenticated' });

    const rawCode = (req.body.referral_code || '').trim().toUpperCase();
    if (!rawCode) {
      return res.status(400).json({ error: 'Please enter a referral code.' });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Lock the claiming user row
      const userRes = await client.query(
        'SELECT id, email, referral_code, referral_claimed, referral_prompt_dismissed, wallet_balance FROM users WHERE id = $1 FOR UPDATE',
        [user.id]
      );

      if (userRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'User account not found.' });
      }

      const freshUser = userRes.rows[0];

      // 2. Prevent claiming multiple times
      if (freshUser.referral_claimed) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'You have already claimed a referral code.' });
      }

      // Check referrals table idempotency guard
      const claimCheck = await client.query(
        'SELECT id FROM referrals WHERE referred_user_id = $1',
        [freshUser.id]
      );
      if (claimCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'You have already claimed a referral code.' });
      }

      // 3. Find and lock referrer by uppercase referral_code
      const referrerRes = await client.query(
        'SELECT id, email, referral_code, wallet_balance FROM users WHERE UPPER(referral_code) = $1 FOR UPDATE',
        [rawCode]
      );

      if (referrerRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid referral code. Please check and try again.' });
      }

      const referrer = referrerRes.rows[0];

      // 4. Prevent self-referral
      if (referrer.id === freshUser.id || referrer.email.toLowerCase() === freshUser.email.toLowerCase()) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'You cannot use your own referral code.' });
      }

      // 5. Atomic Reward: ₹100 for referrer and ₹100 for newly referred user
      const rewardAmount = 100.00;

      // Credit Referrer
      const referrerOldBal = parseFloat(referrer.wallet_balance || 0);
      const referrerNewBal = parseFloat((referrerOldBal + rewardAmount).toFixed(2));

      await client.query(
        'UPDATE users SET wallet_balance = $1 WHERE id = $2',
        [referrerNewBal, referrer.id]
      );

      await client.query(
        `INSERT INTO wallet_ledger (user_id, amount, balance_after, type, reason, reference_id, metadata)
         VALUES ($1, $2, $3, 'CREDIT', $4, 'REFERRAL_SIGNUP_REWARD', $5)`,
        [
          referrer.id,
          rewardAmount,
          referrerNewBal,
          `Referral reward: User ${freshUser.email} joined with your code (${referrer.referral_code})`,
          JSON.stringify({
            role: 'referrer',
            referred_user_id: freshUser.id,
            referred_email: freshUser.email,
            code: referrer.referral_code
          })
        ]
      );

      // Credit Referee (Current User)
      const userOldBal = parseFloat(freshUser.wallet_balance || 0);
      const userNewBal = parseFloat((userOldBal + rewardAmount).toFixed(2));

      await client.query(
        `UPDATE users 
         SET wallet_balance = $1, 
             referred_by = $2, 
             referral_claimed = TRUE, 
             referral_prompt_dismissed = TRUE 
         WHERE id = $3`,
        [userNewBal, referrer.id, freshUser.id]
      );

      await client.query(
        `INSERT INTO wallet_ledger (user_id, amount, balance_after, type, reason, reference_id, metadata)
         VALUES ($1, $2, $3, 'CREDIT', $4, 'REFERRAL_SIGNUP_REWARD', $5)`,
        [
          freshUser.id,
          rewardAmount,
          userNewBal,
          `Referral signup bonus: Joined via referral code ${referrer.referral_code}`,
          JSON.stringify({
            role: 'referee',
            referrer_id: referrer.id,
            referrer_code: referrer.referral_code
          })
        ]
      );

      // Record in referrals table
      await client.query(
        `INSERT INTO referrals (referrer_id, referred_user_id, referral_code, reward_amount, status)
         VALUES ($1, $2, $3, $4, 'COMPLETED')`,
        [referrer.id, freshUser.id, referrer.referral_code, rewardAmount]
      );

      await client.query('COMMIT');

      return res.json({
        success: true,
        message: 'Referral code applied! ₹100 has been credited to your wallet.',
        reward: rewardAmount,
        newBalance: userNewBal,
        referrerCode: referrer.referral_code
      });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[POST /api/referral/claim error]:', err);
    return res.status(500).json({ error: 'Failed to claim referral reward. Please try again.' });
  }
});

// ------------------------------------------------------------------------------
// 3. POST /api/referral/dismiss - Mark one-time prompt as dismissed so it never shows again
// ------------------------------------------------------------------------------
router.post('/dismiss', async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ error: 'User not authenticated' });

    await db.query(
      'UPDATE users SET referral_prompt_dismissed = TRUE WHERE id = $1',
      [user.id]
    );

    return res.json({
      success: true,
      message: 'Referral prompt dismissed.'
    });
  } catch (err) {
    console.error('[POST /api/referral/dismiss error]:', err);
    return res.status(500).json({ error: 'Failed to dismiss referral prompt' });
  }
});

module.exports = router;
