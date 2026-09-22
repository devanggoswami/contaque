// ==============================================================================
// CONTAQUES WALLET & BILLING ROUTES
// Endpoints for Balance, Recharge, Transactions, Billing Telemetry & Webhooks
// ==============================================================================

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const db = require('../db');
const { 
  getWalletBalance, 
  creditBalance, 
  getLedgerHistory, 
  getBillingSummary 
} = require('../utils/wallet');
const { getEngineRates, normalizePlanKey } = require('../utils/pricing');

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
          let userRes = await db.query('SELECT * FROM users WHERE LOWER(email) = $1', [cleanEmail]);
          if (userRes.rows.length === 0) {
            const adminEmail = (process.env.ADMIN_USER || process.env.AUTH_USER || '').trim().toLowerCase();
            if (adminEmail && cleanEmail === adminEmail) {
              userRes = await db.query(
                `INSERT INTO users (name, email, password_hash, plan, email_verified, wallet_balance, country, auth_provider)
                 VALUES ($1, $2, $3, 'plus', true, 44830.00, 'India', 'local')
                 ON CONFLICT (email) DO UPDATE SET plan = 'plus', email_verified = true
                 RETURNING *`,
                [process.env.ADMIN_NAME || 'Devang Goswami', adminEmail, process.env.ADMIN_PASSWORD || '2112@Dev']
              );
            }
          }
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

  // Never fall back to an automatic/default admin user without a valid JWT
  return null;
}

// ------------------------------------------------------------------------------
// 1. GET /api/wallet/balance - Live Balance & Per-Lead Engine Rates
// ------------------------------------------------------------------------------
router.get('/balance', async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ error: 'User not authenticated' });

    let wallet = await getWalletBalance(user.id);
    let currentBalance = wallet ? wallet.balance : 0.00;

    // Bulletproof welcome credit: if any non-admin user has 0 or null balance, grant ₹50 welcome credit
    const adminEmail = (process.env.ADMIN_USER || process.env.AUTH_USER || '').trim().toLowerCase();
    const isUserAdmin = adminEmail && user.email.toLowerCase() === adminEmail;

    if (!isUserAdmin && (currentBalance <= 0 || isNaN(currentBalance))) {
      try {
        await creditBalance(user.id, 50.00, 'WELCOME_BONUS', 'Welcome Free Credits (₹50)', { bonus: true });
        currentBalance = 50.00;
      } catch (cErr) {
        console.warn('Auto welcome credit warning:', cErr.message);
        await db.query('UPDATE users SET wallet_balance = 50.00 WHERE id = $1', [user.id]);
        currentBalance = 50.00;
      }
    }

    const engineRates = getEngineRates(user.plan || 'free');

    return res.json({
      success: true,
      balance: currentBalance,
      currency: 'INR',
      plan: normalizePlanKey(user.plan),
      rates: engineRates.rates,
      allTiers: engineRates.allTiers
    });
  } catch (err) {
    console.error('Wallet balance fetch error:', err);
    return res.status(500).json({ error: 'Failed to retrieve wallet balance' });
  }
});

// ------------------------------------------------------------------------------
// 2. GET /api/wallet/transactions - Immutable Ledger History
// ------------------------------------------------------------------------------
router.get('/transactions', async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ error: 'User not authenticated' });

    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;

    const ledger = await getLedgerHistory(user.id, limit, offset);
    return res.json({
      success: true,
      ...ledger
    });
  } catch (err) {
    console.error('Ledger history fetch error:', err);
    return res.status(500).json({ error: 'Failed to retrieve transaction ledger' });
  }
});

// ------------------------------------------------------------------------------
// 3. GET /api/wallet/billing-summary - Aggregate Financial Telemetry
// ------------------------------------------------------------------------------
router.get('/billing-summary', async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ error: 'User not authenticated' });

    const summary = await getBillingSummary(user.id);
    const balanceInfo = await getWalletBalance(user.id);

    return res.json({
      success: true,
      balance: balanceInfo ? balanceInfo.balance : 0.00,
      currency: 'INR',
      plan: normalizePlanKey(user.plan),
      ...summary
    });
  } catch (err) {
    console.error('Billing summary fetch error:', err);
    return res.status(500).json({ error: 'Failed to retrieve billing summary' });
  }
});

// ------------------------------------------------------------------------------
// 4. POST /api/wallet/recharge/create-order - Server-Side Razorpay Order Creation
// ------------------------------------------------------------------------------
router.post('/recharge/create-order', async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ error: 'User not authenticated' });

    const amount = parseFloat(req.body.amount);
    if (isNaN(amount) || amount < 10) {
      return res.status(400).json({ error: 'Minimum recharge amount is ₹10.00' });
    }

    const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

    if (!keyId || !keySecret) {
      return res.status(503).json({ 
        error: 'Razorpay payment gateway is not configured on the server. Please configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.' 
      });
    }

    const amountInPaise = Math.round(amount * 100);
    const receiptId = `rcpt_w_${user.id}_${Date.now()}`;

    const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const orderResponse = await axios.post(
      'https://api.razorpay.com/v1/orders',
      {
        amount: amountInPaise,
        currency: 'INR',
        receipt: receiptId,
        notes: {
          userId: String(user.id),
          email: user.email,
          purpose: 'WALLET_TOPUP'
        }
      },
      {
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Record order in payment_orders
    await db.query(`
      INSERT INTO payment_orders (
        order_id, user_id, purpose, plan_id, amount_paise, currency, 
        receipt, status, metadata
      )
      VALUES ($1, $2, 'WALLET_TOPUP', NULL, $3, 'INR', $4, 'CREATED', $5)
      ON CONFLICT (order_id) DO NOTHING
    `, [
      orderResponse.data.id,
      user.id,
      amountInPaise,
      receiptId,
      JSON.stringify({ notes: { userId: String(user.id), purpose: 'WALLET_TOPUP' } })
    ]);

    return res.json({
      success: true,
      orderId: orderResponse.data.id,
      amount,
      currency: 'INR',
      keyId,
      user: {
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Razorpay Order Creation Error:', err.response?.data || err.message);
    return res.status(500).json({ 
      error: err.response?.data?.error?.description || 'Failed to create Razorpay recharge order' 
    });
  }
});

// ------------------------------------------------------------------------------
// 5. POST /api/wallet/recharge/verify - Server-Side HMAC SHA256 Signature Verification
// ------------------------------------------------------------------------------
router.post('/recharge/verify', async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ error: 'User not authenticated' });

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing Razorpay verification parameters' });
    }

    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
    if (!keySecret) {
      return res.status(503).json({ error: 'Payment gateway configuration error' });
    }

    // Verify order in payment_orders if exists
    const orderCheck = await db.query('SELECT * FROM payment_orders WHERE order_id = $1', [razorpay_order_id]);
    if (orderCheck.rows.length > 0) {
      const ord = orderCheck.rows[0];
      if (ord.user_id !== user.id) {
        return res.status(403).json({ error: 'Security violation: Order does not belong to authenticated user' });
      }
      if (ord.purpose !== 'WALLET_TOPUP') {
        return res.status(400).json({ error: 'Invalid order purpose: expected WALLET_TOPUP' });
      }
    }

    // Cryptographic HMAC SHA256 Verification
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment verification failed: Invalid cryptographic signature' });
    }

    // Idempotency check: Ensure this payment ID was not already credited
    const idempotencyKey = `recharge_${razorpay_payment_id}`;
    const existing = await db.query('SELECT * FROM idempotency_keys WHERE key = $1', [idempotencyKey]);
    if (existing.rows.length > 0) {
      const balance = await getWalletBalance(user.id);
      return res.json({
        success: true,
        alreadyProcessed: true,
        message: 'Payment already processed and credited',
        balance: balance ? balance.balance : 0
      });
    }

    const rechargeAmount = parseFloat(amount);
    if (isNaN(rechargeAmount) || rechargeAmount <= 0) {
      return res.status(400).json({ error: 'Invalid recharge credit amount' });
    }

    // Atomic credit with row lock
    const creditResult = await creditBalance(
      user.id,
      rechargeAmount,
      `Prepaid recharge via Razorpay (Ref: ${razorpay_payment_id})`,
      razorpay_payment_id,
      {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id
      }
    );

    // Save Idempotency record
    await db.query(
      `INSERT INTO idempotency_keys (key, user_id, action, response_data)
       VALUES ($1, $2, 'WALLET_RECHARGE', $3)
       ON CONFLICT (key) DO NOTHING`,
      [idempotencyKey, user.id, JSON.stringify(creditResult)]
    );

    // Update payment_orders status
    await db.query(`
      UPDATE payment_orders 
      SET status = 'PAID', payment_id = $1, signature = $2, paid_at = NOW() 
      WHERE order_id = $3
    `, [razorpay_payment_id, razorpay_signature, razorpay_order_id]);

    return res.json({
      success: true,
      message: `Successfully credited ₹${rechargeAmount.toFixed(2)} to your wallet!`,
      newBalance: creditResult.newBalance,
      transactionId: creditResult.ledgerId
    });
  } catch (err) {
    console.error('Payment verification error:', err);
    return res.status(500).json({ error: 'Failed to verify payment and credit wallet' });
  }
});

// ------------------------------------------------------------------------------
// 6. POST /api/wallet/webhook - Razorpay Webhook with Idempotency, Signature Check
// Decouples PLAN_UPGRADE and WALLET_TOPUP - Never accidentally credit wallet for plans
// ------------------------------------------------------------------------------
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const webhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || '').trim();
    const signature = req.headers['x-razorpay-signature'];

    if (!webhookSecret || !signature) {
      return res.status(400).send('Webhook secret or signature missing');
    }

    const bodyBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(bodyBuffer)
      .digest('hex');

    if (expectedSignature !== signature) {
      return res.status(400).send('Invalid webhook signature');
    }

    const event = JSON.parse(bodyBuffer.toString('utf-8'));
    const eventType = event.event;

    // Handle payment.failed
    if (eventType === 'payment.failed') {
      const payment = event.payload.payment?.entity;
      const orderId = payment?.order_id;
      if (orderId) {
        await db.query("UPDATE payment_orders SET status = 'FAILED' WHERE order_id = $1", [orderId]);
      }
      return res.json({ status: 'ok', handled: 'payment.failed' });
    }

    // Handle payment.captured or order.paid
    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const payment = event.payload.payment?.entity;
      const orderEntity = event.payload.order?.entity;
      const paymentId = payment?.id;
      const orderId = payment?.order_id || orderEntity?.id;
      const amountPaise = payment?.amount || orderEntity?.amount;
      const amountINR = amountPaise ? amountPaise / 100 : 0;

      // Check order in payment_orders
      let storedOrder = null;
      if (orderId) {
        const ordRes = await db.query('SELECT * FROM payment_orders WHERE order_id = $1', [orderId]);
        if (ordRes.rows.length > 0) {
          storedOrder = ordRes.rows[0];
        }
      }

      const purpose = storedOrder?.purpose || payment?.notes?.purpose || orderEntity?.notes?.purpose || 'WALLET_TOPUP';
      const userId = storedOrder?.user_id || payment?.notes?.userId || orderEntity?.notes?.userId;

      if (purpose === 'PLAN_UPGRADE') {
        // ACTIVATE SUBSCRIPTION PLAN - NEVER TOUCH WALLET
        const planId = storedOrder?.plan_id || payment?.notes?.planId || orderEntity?.notes?.planId;
        const { activateUserPlan } = require('../utils/plans');
        if (userId && planId) {
          await activateUserPlan({
            userId: parseInt(userId, 10),
            planId,
            orderId,
            paymentId,
            billingDetails: storedOrder?.billing_details || {},
            amountPaid: amountINR
          });
        }
      } else if (purpose === 'WALLET_TOPUP') {
        // CREDIT PREPAID WALLET
        if (paymentId && userId && amountINR > 0) {
          const idempotencyKey = `recharge_${paymentId}`;
          const existing = await db.query('SELECT * FROM idempotency_keys WHERE key = $1', [idempotencyKey]);
          if (existing.rows.length === 0) {
            const creditRes = await creditBalance(
              parseInt(userId, 10),
              amountINR,
              `Webhook credit for payment ${paymentId}`,
              paymentId,
              { event: eventType, webhook: true }
            );
            await db.query(
              `INSERT INTO idempotency_keys (key, user_id, action, response_data)
               VALUES ($1, $2, 'WALLET_WEBHOOK', $3)
               ON CONFLICT (key) DO NOTHING`,
              [idempotencyKey, parseInt(userId, 10), JSON.stringify(creditRes)]
            );
            if (orderId) {
              await db.query("UPDATE payment_orders SET status = 'PAID', paid_at = NOW() WHERE order_id = $1", [orderId]);
            }
          }
        }
      }
    }

    return res.json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.status(500).json({ error: 'Webhook error' });
  }
});

// ------------------------------------------------------------------------------
// 7. POST /api/wallet/plan/update - Switch or Downgrade User Subscription Plan
// Security Invariant: Paid plan upgrades CANNOT be activated directly here.
// Paid plan activation strictly requires verified Razorpay payment via /api/plans/verify.
// Only switching/downgrading to 'free' is permitted directly.
// ------------------------------------------------------------------------------
router.post('/plan/update', async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ error: 'User not authenticated' });

    const newPlan = normalizePlanKey(req.body.plan);

    if (newPlan !== 'free') {
      return res.status(403).json({
        error: 'Paid plans cannot be activated directly. Paid plan activation requires verified payment via Razorpay checkout.'
      });
    }

    await db.query('UPDATE users SET plan = $1 WHERE id = $2', [newPlan, user.id]);

    const balanceInfo = await getWalletBalance(user.id);
    const pricing = getEngineRates(newPlan);

    return res.json({
      success: true,
      message: `Plan successfully updated to ${pricing.rates.name}`,
      plan: newPlan,
      rates: pricing.rates,
      balance: balanceInfo ? balanceInfo.balance : 0
    });
  } catch (err) {
    console.error('Plan update error:', err);
    return res.status(500).json({ error: 'Failed to update user plan' });
  }
});

module.exports = router;
