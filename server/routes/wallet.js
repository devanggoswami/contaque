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
  getBillingSummary,
  getWalletBalanceUSD,
  creditBalanceUSD,
  getLedgerHistoryUSD,
  getBillingSummaryUSD
} = require('../utils/wallet');
const { getEngineRates, getEngineRatesUSD, normalizePlanKey } = require('../utils/pricing');
const { syncUserToGoogleSheets } = require('../utils/googleSheetsService');

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

    let walletUSD = await getWalletBalanceUSD(user.id);
    let currentBalanceUSD = walletUSD ? walletUSD.balance : 0.00;

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

    const userPref = (user.currency_preference || '').toUpperCase();
    const isUSD = userPref === 'USD';

    // Bulletproof USD welcome credit: if any non-admin USD user has 0 or null balance, grant $2.00 welcome credit
    if (isUSD && !isUserAdmin && (currentBalanceUSD <= 0 || isNaN(currentBalanceUSD))) {
      try {
        const bonusCheck = await db.query(
          "SELECT id FROM wallet_ledger_usd WHERE user_id = $1 AND reference_id = 'WELCOME_BONUS'",
          [user.id]
        );
        if (bonusCheck.rows.length === 0) {
          await creditBalanceUSD(user.id, 2.00, 'Welcome Free Credits ($2)', 'WELCOME_BONUS', { bonus: true, currency: 'USD' });
          currentBalanceUSD = 2.00;
        }
      } catch (cErr) {
        console.warn('Auto USD welcome credit warning:', cErr.message);
        await db.query('UPDATE users SET wallet_balance_usd = 2.0000 WHERE id = $1', [user.id]);
        currentBalanceUSD = 2.00;
      }
    }

    const engineRates = isUSD ? getEngineRatesUSD(user.plan || 'free') : getEngineRates(user.plan || 'free');

    return res.json({
      success: true,
      balance: isUSD ? currentBalanceUSD : currentBalance,
      balance_inr: currentBalance,
      balance_usd: currentBalanceUSD,
      currency_preference: user.currency_preference || null,
      currency: isUSD ? 'USD' : 'INR',
      plan: normalizePlanKey(user.plan),
      plan_expires_at: user.plan_expires_at || null,
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
    const requestedCurrency = (req.query.currency || user.currency_preference || 'INR').toString().toUpperCase();

    if (requestedCurrency === 'USD') {
      const ledgerUSD = await getLedgerHistoryUSD(user.id, limit, offset);
      return res.json({
        success: true,
        currency: 'USD',
        ...ledgerUSD
      });
    }

    const ledger = await getLedgerHistory(user.id, limit, offset);
    return res.json({
      success: true,
      currency: 'INR',
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

    const requestedCurrency = (req.query.currency || user.currency_preference || 'INR').toString().toUpperCase();

    if (requestedCurrency === 'USD') {
      const summaryUSD = await getBillingSummaryUSD(user.id);
      const balanceInfoUSD = await getWalletBalanceUSD(user.id);
      return res.json({
        success: true,
        balance: balanceInfoUSD ? balanceInfoUSD.balance : 0.00,
        currency: 'USD',
        plan: normalizePlanKey(user.plan),
        ...summaryUSD
      });
    }

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

    const requestedCurrency = (req.body.currency || (user.currency_preference === 'USD' ? 'USD' : 'INR')).toString().toUpperCase().trim();
    const isUSD = requestedCurrency === 'USD';
    const amount = parseFloat(req.body.amount);

    if (isUSD) {
      if (isNaN(amount) || amount < 1.00) {
        return res.status(400).json({ error: 'Minimum recharge amount is $1.00' });
      }
    } else {
      if (isNaN(amount) || amount < 10) {
        return res.status(400).json({ error: 'Minimum recharge amount is ₹10.00' });
      }
    }

    const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

    if (!keyId || !keySecret) {
      return res.status(503).json({ 
        error: 'Razorpay payment gateway is not configured on the server. Please configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.' 
      });
    }

    const amountInSmallestUnit = Math.round(amount * 100);
    const receiptId = isUSD ? `rcpt_w_usd_${user.id}_${Date.now()}` : `rcpt_w_${user.id}_${Date.now()}`;

    const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const orderResponse = await axios.post(
      'https://api.razorpay.com/v1/orders',
      {
        amount: amountInSmallestUnit,
        currency: isUSD ? 'USD' : 'INR',
        receipt: receiptId,
        notes: {
          userId: String(user.id),
          email: user.email,
          purpose: 'WALLET_TOPUP',
          currency: isUSD ? 'USD' : 'INR'
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
      VALUES ($1, $2, 'WALLET_TOPUP', NULL, $3, $4, $5, 'CREATED', $6)
      ON CONFLICT (order_id) DO NOTHING
    `, [
      orderResponse.data.id,
      user.id,
      amountInSmallestUnit,
      isUSD ? 'USD' : 'INR',
      receiptId,
      JSON.stringify({ notes: { userId: String(user.id), purpose: 'WALLET_TOPUP', currency: isUSD ? 'USD' : 'INR' } })
    ]);

    return res.json({
      success: true,
      orderId: orderResponse.data.id,
      amount,
      currency: isUSD ? 'USD' : 'INR',
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
    let orderCurrency = 'INR';
    const orderCheck = await db.query('SELECT * FROM payment_orders WHERE order_id = $1', [razorpay_order_id]);
    if (orderCheck.rows.length > 0) {
      const ord = orderCheck.rows[0];
      if (ord.user_id !== user.id) {
        return res.status(403).json({ error: 'Security violation: Order does not belong to authenticated user' });
      }
      if (ord.purpose !== 'WALLET_TOPUP') {
        return res.status(400).json({ error: 'Invalid order purpose: expected WALLET_TOPUP' });
      }
      if (ord.currency) {
        orderCurrency = ord.currency.toUpperCase();
      }
    }

    const isUSD = orderCurrency === 'USD';

    // Cryptographic HMAC SHA256 Verification (Constant-Time Safe)
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const expectedBuf = Buffer.from(generatedSignature, 'utf8');
    const receivedBuf = Buffer.from(String(razorpay_signature), 'utf8');

    if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
      return res.status(400).json({ error: 'Payment verification failed: Invalid cryptographic signature' });
    }

    // Idempotency check: Ensure this payment ID was not already credited
    const idempotencyKey = isUSD ? `recharge_usd_${razorpay_payment_id}` : `recharge_${razorpay_payment_id}`;
    const existing = await db.query('SELECT * FROM idempotency_keys WHERE key = $1', [idempotencyKey]);
    if (existing.rows.length > 0) {
      const balanceInfo = isUSD ? await getWalletBalanceUSD(user.id) : await getWalletBalance(user.id);
      return res.json({
        success: true,
        alreadyProcessed: true,
        currency: isUSD ? 'USD' : 'INR',
        message: 'Payment already processed and credited',
        balance: balanceInfo ? balanceInfo.balance : 0
      });
    }

    const rechargeAmount = parseFloat(amount);
    if (isNaN(rechargeAmount) || rechargeAmount <= 0) {
      return res.status(400).json({ error: 'Invalid recharge credit amount' });
    }

    // Atomic credit with row lock - STRICT ISOLATION BY CURRENCY
    let creditResult;
    if (isUSD) {
      creditResult = await creditBalanceUSD(
        user.id,
        rechargeAmount,
        `Prepaid recharge via Razorpay USD (Ref: ${razorpay_payment_id})`,
        razorpay_payment_id,
        {
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          currency: 'USD'
        }
      );
    } else {
      creditResult = await creditBalance(
        user.id,
        rechargeAmount,
        `Prepaid recharge via Razorpay (Ref: ${razorpay_payment_id})`,
        razorpay_payment_id,
        {
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          currency: 'INR'
        }
      );
    }

    // Save Idempotency record
    await db.query(
      `INSERT INTO idempotency_keys (key, user_id, action, response_data)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (key) DO NOTHING`,
      [idempotencyKey, user.id, isUSD ? 'WALLET_RECHARGE_USD' : 'WALLET_RECHARGE', JSON.stringify(creditResult)]
    );

    // Update payment_orders status
    await db.query(`
      UPDATE payment_orders 
      SET status = 'PAID', payment_id = $1, signature = $2, paid_at = NOW() 
      WHERE order_id = $3
    `, [razorpay_payment_id, razorpay_signature, razorpay_order_id]);

    // Asynchronously sync updated user status to Google Sheets
    syncUserToGoogleSheets({
      id: user.id,
      name: user.name,
      email: user.email,
      created_at: user.created_at || new Date(),
      auth_provider: user.auth_provider || 'local',
      plan: user.plan || 'free',
      email_verified: !!user.email_verified,
      payment_status: 'ACTIVE'
    }).catch(gsErr => console.warn('[Google Sheets Sync Wallet Recharge Warning]:', gsErr.message));

    const symbol = isUSD ? '$' : '₹';
    return res.json({
      success: true,
      currency: isUSD ? 'USD' : 'INR',
      message: `Successfully credited ${symbol}${rechargeAmount.toFixed(2)} to your ${isUSD ? 'USD ' : ''}wallet!`,
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
      const amountParsed = amountPaise ? amountPaise / 100 : 0;

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
      const orderCurrency = (storedOrder?.currency || payment?.currency || orderEntity?.currency || 'INR').toUpperCase();
      const isUSD = orderCurrency === 'USD';

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
            amountPaid: amountParsed,
            currency: isUSD ? 'USD' : 'INR'
          });
        }
      } else if (purpose === 'WALLET_TOPUP') {
        // CREDIT PREPAID WALLET - ISOLATED BY CURRENCY
        if (paymentId && userId && amountParsed > 0) {
          const idempotencyKey = isUSD ? `recharge_usd_${paymentId}` : `recharge_${paymentId}`;
          const existing = await db.query('SELECT * FROM idempotency_keys WHERE key = $1', [idempotencyKey]);
          if (existing.rows.length === 0) {
            let creditRes;
            if (isUSD) {
              creditRes = await creditBalanceUSD(
                parseInt(userId, 10),
                amountParsed,
                `Webhook credit for payment ${paymentId}`,
                paymentId,
                { event: eventType, webhook: true, currency: 'USD' }
              );
              await db.query(
                `INSERT INTO idempotency_keys (key, user_id, action, response_data)
                 VALUES ($1, $2, 'WALLET_WEBHOOK_USD', $3)
                 ON CONFLICT (key) DO NOTHING`,
                [idempotencyKey, parseInt(userId, 10), JSON.stringify(creditRes)]
              );
            } else {
              creditRes = await creditBalance(
                parseInt(userId, 10),
                amountParsed,
                `Webhook credit for payment ${paymentId}`,
                paymentId,
                { event: eventType, webhook: true, currency: 'INR' }
              );
              await db.query(
                `INSERT INTO idempotency_keys (key, user_id, action, response_data)
                 VALUES ($1, $2, 'WALLET_WEBHOOK', $3)
                 ON CONFLICT (key) DO NOTHING`,
                [idempotencyKey, parseInt(userId, 10), JSON.stringify(creditRes)]
              );
            }
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

    // Asynchronously sync updated user status to Google Sheets
    syncUserToGoogleSheets({
      id: user.id,
      name: user.name,
      email: user.email,
      created_at: user.created_at || new Date(),
      auth_provider: user.auth_provider || 'local',
      plan: newPlan,
      email_verified: !!user.email_verified,
      payment_status: (newPlan === 'plus' || newPlan === 'pack') ? 'ACTIVE' : 'FREE'
    }).catch(gsErr => console.warn('[Google Sheets Sync Wallet Plan Warning]:', gsErr.message));

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
