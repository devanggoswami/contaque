// ==============================================================================
// CONTAQUES ADMIN SUPPORT & ACCOUNT OVERRIDE ROUTES
// Strict server-side authorization, immutable audit logging & atomic transactions
// ==============================================================================

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { syncUserToGoogleSheets } = require('../utils/googleSheetsService');
const { getPlanConfig, normalizePlanId, calculateCalendarExpiry } = require('../utils/plans');

const AUTH_USER = (process.env.ADMIN_USER || process.env.AUTH_USER || '').trim();
const JWT_SECRET = process.env.JWT_SECRET || 'contaque_jwt_development_secret_key_change_in_production';

// Helper to extract JWT token from request
function extractToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    return auth.substring(7);
  }
  return req.query.token || req.headers['x-access-token'] || null;
}

// Helper to verify HMAC token
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

/**
 * Strict Admin Authorization Middleware
 * Verifies valid session and verifies email matches configured administrator
 */
async function requireAdmin(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }

    const verified = verifyAuthToken(token);
    if (!verified || !verified.email) {
      return res.status(401).json({ error: 'Session expired or invalid token. Please log in again.' });
    }

    const adminEmail = (AUTH_USER || '').trim().toLowerCase();
    const requestEmail = verified.email.trim().toLowerCase();

    if (!adminEmail || requestEmail !== adminEmail) {
      console.warn(`[Security Alert] Non-admin attempt on admin route by: ${requestEmail}`);
      return res.status(403).json({ error: 'Access denied: Administrator privileges required.' });
    }

    // Resolve Admin user record
    const adminRes = await db.query('SELECT id, name, email, plan FROM users WHERE LOWER(email) = $1', [requestEmail]);
    const adminUser = adminRes.rows[0] || { id: null, email: requestEmail, name: 'Administrator' };

    req.admin = {
      id: adminUser.id,
      email: requestEmail,
      name: adminUser.name || 'Administrator'
    };

    next();
  } catch (err) {
    console.error('Admin authorization middleware error:', err);
    return res.status(500).json({ error: 'Internal server authorization error.' });
  }
}

// ------------------------------------------------------------------------------
// 1. GET /api/admin/users/search - Search Users by Email, Name or ID
// ------------------------------------------------------------------------------
router.get('/users/search', requireAdmin, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    let queryText = '';
    let queryParams = [];

    if (q) {
      queryText = `
        SELECT 
          id, name, email, country, auth_provider, email_verified, plan, 
          wallet_balance, plan_started_at, plan_expires_at, created_at
        FROM users
        WHERE LOWER(email) ILIKE $1 OR LOWER(name) ILIKE $1 OR CAST(id AS TEXT) = $2
        ORDER BY id DESC
        LIMIT 25
      `;
      queryParams = [`%${q.toLowerCase()}%`, q];
    } else {
      queryText = `
        SELECT 
          id, name, email, country, auth_provider, email_verified, plan, 
          wallet_balance, plan_started_at, plan_expires_at, created_at
        FROM users
        ORDER BY id DESC
        LIMIT 25
      `;
    }

    const usersRes = await db.query(queryText, queryParams);

    return res.json({
      success: true,
      count: usersRes.rows.length,
      users: usersRes.rows.map(u => ({
        id: u.id,
        name: u.name || 'User',
        email: u.email,
        country: u.country || 'India',
        auth_provider: u.auth_provider || 'local',
        email_verified: !!u.email_verified,
        plan: u.plan || 'free',
        wallet_balance: parseFloat(u.wallet_balance || 0),
        plan_started_at: u.plan_started_at,
        plan_expires_at: u.plan_expires_at,
        created_at: u.created_at
      }))
    });
  } catch (err) {
    console.error('Admin user search error:', err);
    return res.status(500).json({ error: 'Failed to search users.' });
  }
});

// ------------------------------------------------------------------------------
// 2. GET /api/admin/users/:id - Get Comprehensive User Profile & Diagnostic History
// ------------------------------------------------------------------------------
router.get('/users/:id', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ error: 'Valid user ID is required.' });
    }

    const userRes = await db.query(`
      SELECT 
        id, name, email, country, auth_provider, email_verified, plan, 
        wallet_balance, billing_details, plan_started_at, plan_expires_at, created_at
      FROM users 
      WHERE id = $1
    `, [userId]);

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const targetUser = userRes.rows[0];

    // Fetch recent ledger transactions
    const ledgerRes = await db.query(`
      SELECT id, amount, balance_after, type, reason, reference_id, metadata, created_at
      FROM wallet_ledger
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 15
    `, [userId]);

    // Fetch recent plan transactions
    const planTxRes = await db.query(`
      SELECT id, plan_id, amount_paid, payment_id, order_id, billing_details, started_at, expires_at, created_at
      FROM plan_transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [userId]);

    // Fetch recent payment orders
    const ordersRes = await db.query(`
      SELECT id, order_id, purpose, plan_id, amount_paise, status, payment_id, paid_at, created_at
      FROM payment_orders
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [userId]);

    // Fetch admin audit logs for this user
    const auditRes = await db.query(`
      SELECT id, admin_email, action, previous_value, new_value, amount, reason, created_at
      FROM admin_audit_logs
      WHERE target_user_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `, [userId]);

    return res.json({
      success: true,
      user: {
        id: targetUser.id,
        name: targetUser.name || 'User',
        email: targetUser.email,
        country: targetUser.country || 'India',
        auth_provider: targetUser.auth_provider || 'local',
        email_verified: !!targetUser.email_verified,
        plan: targetUser.plan || 'free',
        wallet_balance: parseFloat(targetUser.wallet_balance || 0),
        billing_details: targetUser.billing_details || {},
        plan_started_at: targetUser.plan_started_at,
        plan_expires_at: targetUser.plan_expires_at,
        created_at: targetUser.created_at
      },
      ledger: ledgerRes.rows,
      planTransactions: planTxRes.rows,
      paymentOrders: ordersRes.rows,
      auditLogs: auditRes.rows
    });
  } catch (err) {
    console.error('Admin get user profile error:', err);
    return res.status(500).json({ error: 'Failed to retrieve user details.' });
  }
});

// ------------------------------------------------------------------------------
// 3. POST /api/admin/override/plan - Manually Activate, Change, or Reset a User's Plan
// Atomic transaction with row lock, plan_transactions record, audit logging & Sheets sync
// ------------------------------------------------------------------------------
router.post('/override/plan', requireAdmin, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { userId, plan, reason, extendDays } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Target user ID is required.' });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return res.status(400).json({ error: 'A valid mandatory reason (min 3 characters) is required for audit logging.' });
    }

    const cleanPlan = (plan || 'free').trim().toLowerCase();
    const validPlans = ['free', 'pack', 'plus', 'pro', 'starter'];
    if (!validPlans.includes(cleanPlan)) {
      return res.status(400).json({ 
        error: `Invalid plan specified: "${cleanPlan}". Valid options are: ${validPlans.join(', ')}` 
      });
    }

    await client.query('BEGIN');

    // 1. Lock Target User Row
    const userRes = await client.query(
      'SELECT id, name, email, plan, wallet_balance, email_verified, auth_provider, plan_expires_at FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );

    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `User ID ${userId} not found.` });
    }

    const targetUser = userRes.rows[0];
    const previousPlan = targetUser.plan || 'free';
    const previousExpiresAt = targetUser.plan_expires_at;

    const days = parseInt(extendDays, 10) || 1; // months (default 1 month)
    const planExpiresAt = cleanPlan === 'free' ? null : calculateCalendarExpiry(days);

    const isFree = cleanPlan === 'free';
    const planStartedAt = isFree ? null : new Date();

    // 2. Update User Plan
    const updateRes = await client.query(`
      UPDATE users 
      SET plan = $1,
          plan_started_at = $2,
          plan_expires_at = $3
      WHERE id = $4
      RETURNING id, name, email, plan, plan_started_at, plan_expires_at, wallet_balance
    `, [cleanPlan, planStartedAt, planExpiresAt, targetUser.id]);

    const updatedUser = updateRes.rows[0];

    // 3. Insert into plan_transactions to prevent automated cleanup scripts from resetting
    const manualPaymentId = `MANUAL_ADMIN_OVERRIDE_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await client.query(`
      INSERT INTO plan_transactions (
        user_id, payment_id, plan_id, amount_paid, currency, billing_details, started_at, expires_at
      )
      VALUES ($1, $2, $3, $4, 'INR', $5, NOW(), $6)
    `, [
      targetUser.id,
      manualPaymentId,
      cleanPlan,
      0.00,
      JSON.stringify({ 
        manual_override: true, 
        admin_email: req.admin.email, 
        reason: reason.trim(),
        previous_plan: previousPlan 
      }),
      planExpiresAt
    ]);

    // 4. Record Immutable Admin Audit Log
    const auditRes = await client.query(`
      INSERT INTO admin_audit_logs (
        admin_id, admin_email, target_user_id, target_user_email, action,
        previous_value, new_value, amount, reason, metadata
      )
      VALUES ($1, $2, $3, $4, 'PLAN_OVERRIDE', $5, $6, 0.00, $7, $8)
      RETURNING *
    `, [
      req.admin.id,
      req.admin.email,
      targetUser.id,
      targetUser.email,
      JSON.stringify({ plan: previousPlan, plan_expires_at: previousExpiresAt }),
      JSON.stringify({ plan: cleanPlan, plan_expires_at: planExpiresAt }),
      reason.trim(),
      JSON.stringify({ manual_payment_id: manualPaymentId, days_granted: days })
    ]);

    await client.query('COMMIT');

    console.log(`[Admin Override: Plan] Admin ${req.admin.email} changed plan for user ${targetUser.email} (ID: ${targetUser.id}) from "${previousPlan}" to "${cleanPlan}". Reason: ${reason}`);

    // 5. Asynchronously Sync to Google Sheets
    syncUserToGoogleSheets({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      created_at: targetUser.created_at || new Date(),
      auth_provider: targetUser.auth_provider || 'local',
      plan: cleanPlan,
      email_verified: !!targetUser.email_verified,
      payment_status: (cleanPlan === 'plus' || cleanPlan === 'pack') ? 'ACTIVE' : 'FREE'
    }).catch(gsErr => console.warn('[Google Sheets Sync Admin Plan Override Warning]:', gsErr.message));

    return res.json({
      success: true,
      message: `User plan successfully overridden to "${cleanPlan.toUpperCase()}".`,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        plan: updatedUser.plan,
        plan_expires_at: updatedUser.plan_expires_at,
        wallet_balance: parseFloat(updatedUser.wallet_balance || 0)
      },
      auditLog: auditRes.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Admin plan override error:', err);
    return res.status(500).json({ error: err.message || 'Failed to override user plan.' });
  } finally {
    client.release();
  }
});

// ------------------------------------------------------------------------------
// 4. POST /api/admin/override/wallet - Manually Credit or Debit a User's Wallet
// Atomic transaction with row lock, wallet_ledger record, audit logging & Sheets sync
// ------------------------------------------------------------------------------
router.post('/override/wallet', requireAdmin, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { userId, type, amount, reason } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Target user ID is required.' });
    }

    const actionType = (type || '').trim().toUpperCase();
    if (actionType !== 'CREDIT' && actionType !== 'DEBIT') {
      return res.status(400).json({ error: 'Invalid wallet adjustment type: must be "CREDIT" or "DEBIT".' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number greater than 0.' });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return res.status(400).json({ error: 'A valid mandatory reason (min 3 characters) is required for audit logging.' });
    }

    await client.query('BEGIN');

    // 1. Lock Target User Row
    const userRes = await client.query(
      'SELECT id, name, email, plan, wallet_balance, email_verified, auth_provider FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );

    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `User ID ${userId} not found.` });
    }

    const targetUser = userRes.rows[0];
    const previousBalance = parseFloat(targetUser.wallet_balance || 0);

    if (actionType === 'DEBIT' && previousBalance < numAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: `Cannot debit ₹${numAmount.toFixed(2)}: user only has ₹${previousBalance.toFixed(2)} in balance.` 
      });
    }

    const newBalance = actionType === 'CREDIT' 
      ? previousBalance + numAmount 
      : previousBalance - numAmount;

    // 2. Update User Wallet Balance
    await client.query(
      'UPDATE users SET wallet_balance = $1 WHERE id = $2',
      [newBalance, targetUser.id]
    );

    // 3. Record in wallet_ledger with MANUAL_ADMIN_* Reference
    const refId = `MANUAL_ADMIN_${actionType}_${Date.now()}`;
    const ledgerRes = await client.query(`
      INSERT INTO wallet_ledger (
        user_id, amount, balance_after, type, reason, reference_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      targetUser.id,
      numAmount,
      newBalance,
      actionType,
      `[Admin Support Override] ${reason.trim()}`,
      refId,
      JSON.stringify({ 
        manual_admin: true, 
        admin_email: req.admin.email, 
        admin_id: req.admin.id,
        reason: reason.trim() 
      })
    ]);

    // 4. Record in admin_audit_logs
    const auditRes = await client.query(`
      INSERT INTO admin_audit_logs (
        admin_id, admin_email, target_user_id, target_user_email, action,
        previous_value, new_value, amount, reason, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      req.admin.id,
      req.admin.email,
      targetUser.id,
      targetUser.email,
      actionType === 'CREDIT' ? 'WALLET_CREDIT' : 'WALLET_DEBIT',
      JSON.stringify({ wallet_balance: previousBalance }),
      JSON.stringify({ wallet_balance: newBalance }),
      numAmount,
      reason.trim(),
      JSON.stringify({ reference_id: refId, ledger_id: ledgerRes.rows[0]?.id })
    ]);

    await client.query('COMMIT');

    console.log(`[Admin Override: Wallet] Admin ${req.admin.email} performed ${actionType} of ₹${numAmount.toFixed(2)} on user ${targetUser.email} (ID: ${targetUser.id}). New balance: ₹${newBalance.toFixed(2)}. Reason: ${reason}`);

    // 5. Asynchronously Sync to Google Sheets
    syncUserToGoogleSheets({
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      created_at: targetUser.created_at || new Date(),
      auth_provider: targetUser.auth_provider || 'local',
      plan: targetUser.plan || 'free',
      email_verified: !!targetUser.email_verified,
      payment_status: (targetUser.plan === 'plus' || targetUser.plan === 'pack') ? 'ACTIVE' : 'FREE'
    }).catch(gsErr => console.warn('[Google Sheets Sync Admin Wallet Override Warning]:', gsErr.message));

    return res.json({
      success: true,
      message: `Successfully ${actionType === 'CREDIT' ? 'credited' : 'debited'} ₹${numAmount.toFixed(2)}. New balance is ₹${newBalance.toFixed(2)}.`,
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        wallet_balance: newBalance,
        plan: targetUser.plan
      },
      ledger: ledgerRes.rows[0],
      auditLog: auditRes.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Admin wallet override error:', err);
    return res.status(500).json({ error: err.message || 'Failed to adjust user wallet.' });
  } finally {
    client.release();
  }
});

// ------------------------------------------------------------------------------
// 5. GET /api/admin/audit-logs - Retrieve System-wide Admin Action Audit History
// ------------------------------------------------------------------------------
router.get('/audit-logs', requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const userId = req.query.userId ? parseInt(req.query.userId, 10) : null;

    let queryText = `
      SELECT 
        a.id, a.admin_id, a.admin_email, a.target_user_id, a.target_user_email,
        a.action, a.previous_value, a.new_value, a.amount, a.reason, a.metadata, a.created_at
      FROM admin_audit_logs a
    `;
    let queryParams = [];

    if (userId) {
      queryText += ` WHERE a.target_user_id = $1 ORDER BY a.created_at DESC LIMIT $2`;
      queryParams = [userId, limit];
    } else {
      queryText += ` ORDER BY a.created_at DESC LIMIT $1`;
      queryParams = [limit];
    }

    const auditRes = await db.query(queryText, queryParams);

    return res.json({
      success: true,
      count: auditRes.rows.length,
      logs: auditRes.rows
    });
  } catch (err) {
    console.error('Admin get audit logs error:', err);
    return res.status(500).json({ error: 'Failed to retrieve audit logs.' });
  }
});

module.exports = router;
