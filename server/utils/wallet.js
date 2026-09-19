// ==============================================================================
// CONTAQUES PREPAID WALLET & TRANSACTION LEDGER SERVICE
// Strict PostgreSQL Transactions with Row Locking (FOR UPDATE)
// Zero Race Conditions • Zero Double Spending • Immutable Ledger
// ==============================================================================

const { pool } = require('../db');

/**
 * Atomically reserve/hold balance for a lead generation job
 * Uses SELECT ... FOR UPDATE to prevent race conditions across parallel jobs
 */
async function reserveBalance(userId, amount, jobId = null, metadata = {}) {
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('Invalid reservation amount');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock user row exclusively until transaction completes
    const userRes = await client.query(
      'SELECT id, wallet_balance, email, name, plan FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );

    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, reason: 'USER_NOT_FOUND' };
    }

    const currentBalance = parseFloat(userRes.rows[0].wallet_balance || 0);

    // 2. Strict Balance Verification
    if (currentBalance < numericAmount) {
      await client.query('ROLLBACK');
      return {
        success: false,
        reason: 'INSUFFICIENT_BALANCE',
        currentBalance,
        required: numericAmount,
        shortfall: parseFloat((numericAmount - currentBalance).toFixed(2))
      };
    }

    // 3. Deduct reservation from wallet_balance
    const newBalance = parseFloat((currentBalance - numericAmount).toFixed(2));
    await client.query(
      'UPDATE users SET wallet_balance = $1 WHERE id = $2',
      [newBalance, userId]
    );

    // 4. Record Immutable DEBIT Entry in Ledger
    const reason = metadata.reason || `Hold for ${metadata.requestedCount || ''} leads (${metadata.source || 'Scraper'})`;
    const ledgerRes = await client.query(
      `INSERT INTO wallet_ledger (user_id, amount, balance_after, type, reason, reference_id, metadata)
       VALUES ($1, $2, $3, 'DEBIT', $4, $5, $6)
       RETURNING id, created_at`,
      [
        userId,
        numericAmount,
        newBalance,
        reason,
        jobId ? String(jobId) : null,
        JSON.stringify(metadata)
      ]
    );

    await client.query('COMMIT');

    return {
      success: true,
      ledgerId: ledgerRes.rows[0].id,
      previousBalance: currentBalance,
      newBalance,
      reservedAmount: numericAmount,
      timestamp: ledgerRes.rows[0].created_at
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[Wallet Reserve Error] User ${userId}, Amount ${numericAmount}:`, err.message);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Settle a completed or failed lead job
 * Deducts strictly for unique leads successfully inserted.
 * Refunds difference to wallet for duplicate, invalid, or unfulfilled leads.
 */
async function settleJob(userId, jobId, requestedCount, actualInsertedCount, ratePerLead, metadata = {}) {
  const reqCount = parseInt(requestedCount, 10) || 0;
  const actualCount = parseInt(actualInsertedCount, 10) || 0;
  const rate = parseFloat(ratePerLead) || 1.0;

  const estimatedCost = parseFloat((reqCount * rate).toFixed(2));
  const actualCost = parseFloat((actualCount * rate).toFixed(2));
  const unfulfilledCount = Math.max(0, reqCount - actualCount);
  const refundAmount = parseFloat(Math.max(0, estimatedCost - actualCost).toFixed(2));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock user row
    const userRes = await client.query(
      'SELECT id, wallet_balance FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );

    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, reason: 'USER_NOT_FOUND' };
    }

    const currentBalance = parseFloat(userRes.rows[0].wallet_balance || 0);
    let finalBalance = currentBalance;
    let refundLedgerId = null;

    // 2. If unfulfilled/duplicate leads exist, execute REFUND transaction
    if (refundAmount > 0) {
      finalBalance = parseFloat((currentBalance + refundAmount).toFixed(2));
      await client.query(
        'UPDATE users SET wallet_balance = $1 WHERE id = $2',
        [finalBalance, userId]
      );

      const refundReason = `Refund for ${unfulfilledCount} unfulfilled/duplicate leads (Job #${jobId})`;
      const refundMeta = {
        ...metadata,
        jobId,
        requestedCount: reqCount,
        actualInsertedCount: actualCount,
        unfulfilledCount,
        ratePerLead: rate,
        estimatedCost,
        actualCost,
        refundAmount
      };

      const ledgerRes = await client.query(
        `INSERT INTO wallet_ledger (user_id, amount, balance_after, type, reason, reference_id, metadata)
         VALUES ($1, $2, $3, 'REFUND', $4, $5, $6)
         RETURNING id`,
        [userId, refundAmount, finalBalance, refundReason, String(jobId), JSON.stringify(refundMeta)]
      );
      refundLedgerId = ledgerRes.rows[0].id;
    }

    // 3. Mark job billing settled
    if (jobId) {
      await client.query(
        `UPDATE jobs 
         SET actual_cost = $1, 
             refunded_amount = $2, 
             billing_status = 'SETTLED' 
         WHERE id = $3`,
        [actualCost, refundAmount, jobId]
      );
    }

    await client.query('COMMIT');

    return {
      success: true,
      jobId,
      estimatedCost,
      actualCost,
      refundAmount,
      unfulfilledCount,
      refundLedgerId,
      newBalance: finalBalance
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[Wallet Settle Error] Job #${jobId}, User ${userId}:`, err.message);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Atomically credit user's wallet balance (e.g. from Razorpay recharge)
 */
async function creditBalance(userId, amount, reason, referenceId = null, metadata = {}) {
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('Invalid credit amount');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock user row
    const userRes = await client.query(
      'SELECT id, wallet_balance, email FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );

    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, reason: 'USER_NOT_FOUND' };
    }

    const currentBalance = parseFloat(userRes.rows[0].wallet_balance || 0);
    const newBalance = parseFloat((currentBalance + numericAmount).toFixed(2));

    await client.query(
      'UPDATE users SET wallet_balance = $1 WHERE id = $2',
      [newBalance, userId]
    );

    // Record Immutable CREDIT in Ledger
    const ledgerRes = await client.query(
      `INSERT INTO wallet_ledger (user_id, amount, balance_after, type, reason, reference_id, metadata)
       VALUES ($1, $2, $3, 'CREDIT', $4, $5, $6)
       RETURNING id, created_at`,
      [
        userId,
        numericAmount,
        newBalance,
        reason || 'Wallet recharge',
        referenceId ? String(referenceId) : null,
        JSON.stringify(metadata)
      ]
    );

    await client.query('COMMIT');

    return {
      success: true,
      ledgerId: ledgerRes.rows[0].id,
      creditedAmount: numericAmount,
      previousBalance: currentBalance,
      newBalance,
      timestamp: ledgerRes.rows[0].created_at
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[Wallet Credit Error] User ${userId}, Amount ${numericAmount}:`, err.message);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get live wallet balance & tier info
 */
async function getWalletBalance(userId) {
  const res = await pool.query(
    'SELECT id, name, email, plan, wallet_balance FROM users WHERE id = $1',
    [userId]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    userId: row.id,
    name: row.name,
    email: row.email,
    plan: row.plan || 'free',
    balance: parseFloat(row.wallet_balance || 0),
    currency: 'INR'
  };
}

/**
 * Get immutable transaction ledger history
 */
async function getLedgerHistory(userId, limit = 50, offset = 0) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  const [countRes, rowsRes] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM wallet_ledger WHERE user_id = $1', [userId]),
    pool.query(
      `SELECT id, amount, balance_after, type, reason, reference_id, metadata, created_at
       FROM wallet_ledger 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, safeLimit, safeOffset]
    )
  ]);

  return {
    total: parseInt(countRes.rows[0].count, 10),
    limit: safeLimit,
    offset: safeOffset,
    transactions: rowsRes.rows.map(row => ({
      id: row.id,
      amount: parseFloat(row.amount),
      balanceAfter: parseFloat(row.balance_after),
      type: row.type,
      reason: row.reason,
      referenceId: row.reference_id,
      metadata: row.metadata,
      createdAt: row.created_at
    }))
  };
}

/**
 * Aggregate Billing Summary
 */
async function getBillingSummary(userId) {
  const [ledgerAgg, jobsAgg, activeHolds] = await Promise.all([
    pool.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END), 0) as total_credited,
         COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END), 0) as total_debited,
         COALESCE(SUM(CASE WHEN type = 'REFUND' THEN amount ELSE 0 END), 0) as total_refunded,
         COUNT(*) as total_transactions
       FROM wallet_ledger 
       WHERE user_id = $1`,
      [userId]
    ),
    pool.query(
      `SELECT 
         COUNT(*) as total_jobs,
         COALESCE(SUM(fetched_count), 0) as total_unique_leads,
         COALESCE(SUM(actual_cost), 0) as net_spent_on_leads
       FROM jobs 
       WHERE user_id = $1`,
      [userId]
    ),
    pool.query(
      `SELECT COALESCE(SUM(estimated_cost), 0) as active_hold_amount
       FROM jobs 
       WHERE user_id = $1 AND status = 'IN_PROGRESS'`,
      [userId]
    )
  ]);

  const totalCredited = parseFloat(ledgerAgg.rows[0].total_credited);
  const totalDebited = parseFloat(ledgerAgg.rows[0].total_debited);
  const totalRefunded = parseFloat(ledgerAgg.rows[0].total_refunded);
  const netSpent = parseFloat((totalDebited - totalRefunded).toFixed(2));
  const totalUniqueLeads = parseInt(jobsAgg.rows[0].total_unique_leads, 10);

  return {
    totalCredited,
    totalDebited,
    totalRefunded,
    netSpent,
    totalUniqueLeads,
    totalJobs: parseInt(jobsAgg.rows[0].total_jobs, 10),
    activeHoldAmount: parseFloat(activeHolds.rows[0].active_hold_amount),
    averageCostPerLead: totalUniqueLeads > 0 ? parseFloat((netSpent / totalUniqueLeads).toFixed(2)) : 0.00
  };
}

module.exports = {
  reserveBalance,
  settleJob,
  creditBalance,
  getWalletBalance,
  getLedgerHistory,
  getBillingSummary
};
