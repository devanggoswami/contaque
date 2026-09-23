// ==============================================================================
// CONTAQUES SUBSCRIPTION PLANS & SERVER-SIDE AUTHORITATIVE CONFIGURATION
// Authoritative price, duration, and idempotent activation engine
// ==============================================================================

const db = require('../db');

/**
 * Calculate strict calendar-based plan expiry.
 * Monthly plan: same calendar day next month, 11:59:59 PM IST.
 * Handles month-end edge cases (e.g. 31 Jan → 28/29 Feb).
 * @param {number} months - Number of months to add (default 1)
 * @param {Date} [fromDate] - Activation date (default: now)
 * @returns {Date} Expiry timestamp as a JS Date object (UTC representation of 23:59:59 IST)
 */
function calculateCalendarExpiry(months = 1, fromDate = null) {
  // Get current time in IST
  const now = fromDate || new Date();
  // Convert to IST components
  const istOffset = 5.5 * 60 * 60 * 1000; // +05:30 in ms
  const istTime = new Date(now.getTime() + istOffset);
  const year = istTime.getUTCFullYear();
  const month = istTime.getUTCMonth(); // 0-indexed
  const day = istTime.getUTCDate();

  // Calculate target month/year
  const targetMonth = month + months;
  const targetYear = year + Math.floor(targetMonth / 12);
  const targetMonthNorm = targetMonth % 12;

  // Get last valid day of the target month
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonthNorm + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDayOfTargetMonth);

  // Build expiry as 23:59:59 IST on the target date
  // 23:59:59 IST = 18:29:59 UTC (23:59:59 - 05:30)
  const expiryUTC = new Date(Date.UTC(
    targetYear,
    targetMonthNorm,
    targetDay,
    18, 29, 59, 0  // 23:59:59 IST = 18:29:59 UTC
  ));

  return expiryUTC;
}

const SUBSCRIPTION_PLANS = {
  plus: {
    id: 'plus',
    name: 'Value Plus',
    priceINR: 299.00,
    pricePaise: 29900,
    durationDays: 30,
    maxAccounts: 1,
    dailyEmailLimit: 400,
    features: {
      lowerScrapingRates: true,
      parallelScrapers: true,
      cloudPersistence: true,
      coldEmailSuite: true,
      unifiedInbox: true,
      maxAccounts: 1,
      dailyEmailLimit: 400
    }
  },
  pack: {
    id: 'pack',
    name: 'Value Pack',
    priceINR: 499.00,
    pricePaise: 49900,
    durationDays: 30,
    maxAccounts: 4,
    dailyEmailLimit: 1600,
    features: {
      lowerScrapingRates: true,
      parallelScrapers: true,
      cloudPersistence: true,
      coldEmailSuite: true,
      unifiedInbox: true,
      maxAccounts: 4,
      dailyEmailLimit: 1600
    }
  }
};

/**
 * Standardize plan identifiers from frontend, landing page, or external params
 */
function normalizePlanId(rawId) {
  if (!rawId) return null;
  const p = rawId.toString().toLowerCase().trim();
  if (p === 'plus' || p === 'value plus' || p === '299' || p.includes('plus')) return 'plus';
  if (p === 'pack' || p === 'value pack' || p === '499' || p.includes('pack') || p.includes('value')) return 'pack';
  return null;
}

/**
 * Retrieve server-side authoritative plan configuration
 */
function getPlanConfig(planId) {
  const normalized = normalizePlanId(planId);
  return normalized ? SUBSCRIPTION_PLANS[normalized] : null;
}

/**
 * Authoritative Server-Side User Plan Entitlement Checker
 * Checks plan, validity/expiry and returns allowed accounts and daily email quota
 */
async function getUserPlanEntitlement(userId, client = db) {
  if (!userId) {
    return {
      plan: 'free',
      planName: 'Free Plan',
      isExpired: false,
      emailCampaignsEnabled: false,
      maxAccounts: 0,
      dailyEmailLimit: 0,
      entitlementLabel: '0 Gmail accounts · 0 emails/day'
    };
  }

  const uRes = await client.query(
    'SELECT id, email, plan, plan_expires_at FROM users WHERE id = $1',
    [userId]
  );
  if (uRes.rows.length === 0) {
    return {
      plan: 'free',
      planName: 'Free Plan',
      isExpired: false,
      emailCampaignsEnabled: false,
      maxAccounts: 0,
      dailyEmailLimit: 0,
      entitlementLabel: '0 Gmail accounts · 0 emails/day'
    };
  }

  const u = uRes.rows[0];
  const now = new Date();
  const isExpired = u.plan_expires_at ? new Date(u.plan_expires_at) < now : false;

  // Free or Expired plan -> 0 accounts, 0 emails, Campaigns disabled
  if (isExpired || !u.plan || u.plan === 'free') {
    return {
      plan: 'free',
      planName: 'Free Plan',
      isExpired,
      emailCampaignsEnabled: false,
      maxAccounts: 0,
      dailyEmailLimit: 0,
      entitlementLabel: '0 Gmail accounts · 0 emails/day'
    };
  }

  const normalized = normalizePlanId(u.plan);

  if (normalized === 'pack') {
    return {
      plan: 'pack',
      planName: 'Value Pack',
      isExpired: false,
      emailCampaignsEnabled: true,
      maxAccounts: 4,
      dailyEmailLimit: 1600,
      entitlementLabel: '4 Gmail accounts · 1,600 emails/day'
    };
  }

  if (normalized === 'plus') {
    return {
      plan: 'plus',
      planName: 'Value Plus',
      isExpired: false,
      emailCampaignsEnabled: true,
      maxAccounts: 1,
      dailyEmailLimit: 400,
      entitlementLabel: '1 Gmail account · 400 emails/day'
    };
  }

  return {
    plan: 'free',
    planName: 'Free Plan',
    isExpired: false,
    emailCampaignsEnabled: false,
    maxAccounts: 0,
    dailyEmailLimit: 0,
    entitlementLabel: '0 Gmail accounts · 0 emails/day'
  };
}

/**
 * Idempotently activate a subscription plan for a verified user
 * Strictly isolated: NEVER touches wallet balance or ledger!
 */
async function activateUserPlan({
  userId,
  planId,
  orderId,
  paymentId,
  billingDetails = {},
  amountPaid = null
}) {
  const normalized = normalizePlanId(planId);
  if (!normalized || !SUBSCRIPTION_PLANS[normalized]) {
    throw new Error(`Invalid plan identifier: ${planId}`);
  }

  const planConfig = SUBSCRIPTION_PLANS[normalized];
  const finalAmount = amountPaid !== null ? amountPaid : planConfig.priceINR;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Idempotency Check on payment_id in plan_transactions
    if (paymentId) {
      const existingTx = await client.query(
        'SELECT * FROM plan_transactions WHERE payment_id = $1 FOR UPDATE',
        [paymentId]
      );
      if (existingTx.rows.length > 0) {
        await client.query('COMMIT');
        return {
          success: true,
          alreadyProcessed: true,
          plan: normalized,
          planName: planConfig.name,
          transaction: existingTx.rows[0],
          message: 'Plan upgrade was already activated for this payment.'
        };
      }
    }

    // 2. Fetch User with Row Lock
    const userRes = await client.query(
      'SELECT id, email, plan, wallet_balance FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    if (userRes.rows.length === 0) {
      throw new Error(`User ID ${userId} not found`);
    }

    const previousWalletBalance = userRes.rows[0].wallet_balance;

    // 3. Update User Plan & Expiration (Strict Calendar-Month Expiry)
    const calendarExpiry = calculateCalendarExpiry(1);
    const userUpdateRes = await client.query(`
      UPDATE users 
      SET plan = $1,
          plan_started_at = NOW(),
          plan_expires_at = $2,
          billing_details = $3
      WHERE id = $4
      RETURNING id, name, email, plan, plan_started_at, plan_expires_at, wallet_balance
    `, [normalized, calendarExpiry, JSON.stringify(billingDetails), userId]);

    // 4. Record Immutable Plan Transaction
    const txRes = await client.query(`
      INSERT INTO plan_transactions (
        user_id, order_id, payment_id, plan_id, amount_paid, currency, 
        billing_details, started_at, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, 'INR', $6, NOW(), $7)
      RETURNING *
    `, [
      userId,
      orderId || null,
      paymentId || `manual_act_${Date.now()}`,
      normalized,
      finalAmount,
      JSON.stringify(billingDetails),
      calendarExpiry
    ]);

    // 5. Update payment_orders record if orderId provided
    if (orderId) {
      await client.query(`
        UPDATE payment_orders 
        SET status = 'PAID',
            payment_id = COALESCE($1, payment_id),
            paid_at = NOW()
        WHERE order_id = $2
      `, [paymentId || null, orderId]);
    }

    // 6. Record in idempotency_keys
    if (paymentId) {
      const idempKey = `plan_act_${paymentId}`;
      await client.query(`
        INSERT INTO idempotency_keys (key, user_id, action, response_data)
        VALUES ($1, $2, 'PLAN_UPGRADE', $3)
        ON CONFLICT (key) DO NOTHING
      `, [idempKey, userId, JSON.stringify({ plan: normalized, orderId, paymentId })]);
    }

    // Verify wallet balance is 100% untouched
    const afterWalletBalance = userUpdateRes.rows[0].wallet_balance;
    if (String(previousWalletBalance) !== String(afterWalletBalance)) {
      throw new Error('FATAL SAFETY VIOLATION: Wallet balance was altered during plan upgrade!');
    }

    await client.query('COMMIT');

    return {
      success: true,
      alreadyProcessed: false,
      plan: normalized,
      planName: planConfig.name,
      user: userUpdateRes.rows[0],
      transaction: txRes.rows[0],
      message: `Plan successfully upgraded to ${planConfig.name}`
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[activateUserPlan error]:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  SUBSCRIPTION_PLANS,
  normalizePlanId,
  getPlanConfig,
  getUserPlanEntitlement,
  activateUserPlan,
  calculateCalendarExpiry
};
