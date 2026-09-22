// ==============================================================================
// CONTAQUES SUBSCRIPTION PLAN PAYMENT & UPGRADE ROUTES
// Strict server-side price authority, signature validation & atomic activation
// ==============================================================================

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const db = require('../db');
const { getPlanConfig, normalizePlanId, activateUserPlan } = require('../utils/plans');

// Helper to extract JWT token from request
function extractToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    return auth.substring(7);
  }
  return req.query.token || req.headers['x-access-token'] || null;
}

// Helper to resolve the authenticated user
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
      console.error('[resolveUser error]:', err.message);
      return null;
    }
  }
  return null;
}

// ------------------------------------------------------------------------------
// 1. POST /api/plans/create-order - Server-Side Razorpay Order Creation
// Strictly determines amount from server plan config; client input is ignored
// ------------------------------------------------------------------------------
router.post('/create-order', async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required to initiate plan upgrade' });
    }

    const requestedPlan = req.body.planId || req.body.plan;
    const planConfig = getPlanConfig(requestedPlan);

    if (!planConfig) {
      return res.status(400).json({ 
        error: `Invalid plan specified: "${requestedPlan}". Valid options are 'pack' (Value Pack) or 'plus' (Value Plus).` 
      });
    }

    const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

    if (!keyId || !keySecret) {
      return res.status(503).json({ 
        error: 'Razorpay payment gateway is not configured on the server. Please check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.' 
      });
    }

    // Authoritative Server-Side Amount (NEVER trust frontend amount)
    const amountInPaise = planConfig.pricePaise;
    const receiptId = `rcpt_p_${user.id}_${Date.now()}`;
    const billingDetails = req.body.billingDetails || {};

    const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const orderResponse = await axios.post(
      'https://api.razorpay.com/v1/orders',
      {
        amount: amountInPaise,
        currency: 'INR',
        receipt: receiptId,
        notes: {
          purpose: 'PLAN_UPGRADE',
          planId: planConfig.id,
          userId: String(user.id),
          email: user.email
        }
      },
      {
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const razorpayOrder = orderResponse.data;

    // Persist Razorpay Order in Database for Verification & Auditing
    await db.query(`
      INSERT INTO payment_orders (
        order_id, user_id, purpose, plan_id, amount_paise, currency, 
        receipt, status, billing_details, metadata
      )
      VALUES ($1, $2, 'PLAN_UPGRADE', $3, $4, 'INR', $5, 'CREATED', $6, $7)
      ON CONFLICT (order_id) DO NOTHING
    `, [
      razorpayOrder.id,
      user.id,
      planConfig.id,
      amountInPaise,
      receiptId,
      JSON.stringify(billingDetails),
      JSON.stringify({ notes: razorpayOrder.notes })
    ]);

    return res.json({
      success: true,
      orderId: razorpayOrder.id,
      planId: planConfig.id,
      planName: planConfig.name,
      amountPaise: amountInPaise,
      amountINR: planConfig.priceINR,
      currency: 'INR',
      keyId,
      user: {
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Razorpay Plan Upgrade Order Creation Error:', err.response?.data || err.message);
    return res.status(500).json({ 
      error: err.response?.data?.error?.description || err.message || 'Failed to create Razorpay plan order' 
    });
  }
});

// ------------------------------------------------------------------------------
// 2. POST /api/plans/verify - Cryptographic Signature & Razorpay Capture Verification
// Verifies order belongs to user, paid status, amount match, and activates plan
// ------------------------------------------------------------------------------
router.post('/verify', async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, billingDetails } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ 
        error: 'Missing required parameters: razorpay_order_id, razorpay_payment_id, and razorpay_signature are required' 
      });
    }

    const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

    if (!keySecret) {
      return res.status(503).json({ error: 'Payment gateway configuration error' });
    }

    // 1. Cryptographic HMAC-SHA256 Signature Verification
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ 
        error: 'Payment verification failed: Invalid cryptographic signature' 
      });
    }

    // 2. Verify Order in payment_orders Table (Multi-User & Purpose Security)
    const orderRes = await db.query(
      'SELECT * FROM payment_orders WHERE order_id = $1',
      [razorpay_order_id]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Order reference not found in system records' });
    }

    const storedOrder = orderRes.rows[0];

    // Multi-User Isolation Check: Verify order belongs to the authenticated user
    if (storedOrder.user_id !== user.id) {
      return res.status(403).json({ error: 'Security violation: Order does not belong to authenticated user' });
    }

    // Purpose Check: Ensure this is a plan upgrade order, not a wallet order
    if (storedOrder.purpose !== 'PLAN_UPGRADE') {
      return res.status(400).json({ error: 'Invalid order purpose: expected PLAN_UPGRADE' });
    }

    // 3. Check for Idempotency (Already Paid/Activated)
    if (storedOrder.status === 'PAID') {
      const planConfig = getPlanConfig(storedOrder.plan_id);
      return res.json({
        success: true,
        alreadyProcessed: true,
        message: 'Plan Activated',
        plan: storedOrder.plan_id,
        planName: planConfig ? planConfig.name : storedOrder.plan_id,
        activePlan: storedOrder.plan_id
      });
    }

    // 4. Retrieve & Check Razorpay Payment Status via API
    let paymentData = null;
    const isTestSimulation = (razorpay_payment_id.startsWith('pay_test_sim_') || razorpay_payment_id.includes('_sim_')) && 
      (process.env.NODE_ENV === 'test' || process.env.ALLOW_PAYMENT_SIMULATION === 'true');

    if (isTestSimulation) {
      paymentData = {
        id: razorpay_payment_id,
        order_id: razorpay_order_id,
        status: 'captured',
        amount: storedOrder.amount_paise
      };
    } else {
      try {
        const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const rzpPaymentRes = await axios.get(
          `https://api.razorpay.com/v1/payments/${razorpay_payment_id}`,
          {
            headers: { 'Authorization': `Basic ${basicAuth}` }
          }
        );
        paymentData = rzpPaymentRes.data;
      } catch (apiErr) {
        console.error('Razorpay payment fetch error:', apiErr.response?.data || apiErr.message);
        return res.status(502).json({ 
          error: 'Failed to verify payment status with Razorpay gateway' 
        });
      }
    }

    // Verify payment is captured/authorized
    if (paymentData.status !== 'captured' && paymentData.status !== 'authorized') {
      return res.status(400).json({ 
        error: `Payment is in state "${paymentData.status}", expected captured` 
      });
    }

    // Verify order ID matches
    if (paymentData.order_id !== razorpay_order_id) {
      return res.status(400).json({ 
        error: 'Payment order ID does not match the submitted order ID' 
      });
    }

    // Verify paid amount matches expected plan amount in paise
    if (paymentData.amount !== storedOrder.amount_paise) {
      return res.status(400).json({ 
        error: `Paid amount (₹${paymentData.amount / 100}) does not match expected plan price (₹${storedOrder.amount_paise / 100})` 
      });
    }

    // 5. Authoritatively Activate the Plan (Zero Wallet Alteration)
    const effectiveBilling = billingDetails || storedOrder.billing_details || {};
    const activationResult = await activateUserPlan({
      userId: user.id,
      planId: storedOrder.plan_id,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      billingDetails: effectiveBilling,
      amountPaid: storedOrder.amount_paise / 100
    });

    // Update payment_order with signature
    await db.query(
      'UPDATE payment_orders SET signature = $1 WHERE order_id = $2',
      [razorpay_signature, razorpay_order_id]
    );

    return res.json({
      success: true,
      message: 'Plan Activated',
      plan: activationResult.plan,
      planName: activationResult.planName,
      activePlan: activationResult.plan,
      transactionId: activationResult.transaction?.id,
      expiresAt: activationResult.user?.plan_expires_at
    });
  } catch (err) {
    console.error('Plan payment verification error:', err);
    return res.status(500).json({ error: err.message || 'Failed to verify plan payment' });
  }
});

// ------------------------------------------------------------------------------
// 3. GET /api/plans/status - Retrieve current user subscription status & history
// ------------------------------------------------------------------------------
router.get('/status', async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ error: 'User not authenticated' });

    const userRes = await db.query(
      'SELECT id, name, email, plan, plan_started_at, plan_expires_at, wallet_balance FROM users WHERE id = $1',
      [user.id]
    );

    const txRes = await db.query(
      'SELECT * FROM plan_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
      [user.id]
    );

    const activeUser = userRes.rows[0];
    const planConfig = getPlanConfig(activeUser.plan);

    return res.json({
      success: true,
      user: {
        id: activeUser.id,
        name: activeUser.name,
        email: activeUser.email,
        plan: activeUser.plan,
        planStartedAt: activeUser.plan_started_at,
        planExpiresAt: activeUser.plan_expires_at,
        walletBalance: activeUser.wallet_balance
      },
      planConfig: planConfig || null,
      transactions: txRes.rows
    });
  } catch (err) {
    console.error('Plan status fetch error:', err);
    return res.status(500).json({ error: 'Failed to retrieve subscription status' });
  }
});

module.exports = router;
