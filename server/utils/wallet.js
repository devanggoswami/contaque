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
 * Settle a completed or failed lead job (INR)
 * Deducts strictly for unique leads successfully inserted.
 * REQUIRED BILLING RULE:
 * actual_charge = successfully_generated_unique_leads * exact_per_lead_rate
 * unused_hold = estimated_hold - actual_charge
 * For 0 leads: actual_charge = 0, unused_hold = full estimated hold (100% refunded)
 */
async function settleJob(userId, jobId, requestedCount, actualInsertedCount, ratePerLead, metadata = {}, clientOverride = null) {
  const client = clientOverride || await pool.connect();
  const shouldManageTx = !clientOverride;
  try {
    if (shouldManageTx) await client.query('BEGIN');

    let effectiveJobId = jobId ? parseInt(jobId, 10) : null;
    let jobRow = null;

    if (effectiveJobId) {
      // 1. Lock job row to ensure idempotency and prevent double refunds
      const jobRes = await client.query(
        'SELECT id, user_id, requested_count, fetched_count, rate_per_lead, estimated_cost, actual_cost, refunded_amount, billing_status, status, currency FROM jobs WHERE id = $1 FOR UPDATE',
        [effectiveJobId]
      );
      if (jobRes.rows.length > 0) {
        jobRow = jobRes.rows[0];
        // Idempotency guard: If already settled, do not process again
        if (jobRow.billing_status === 'SETTLED') {
          if (shouldManageTx) await client.query('COMMIT');
          return {
            success: true,
            alreadySettled: true,
            jobId: effectiveJobId,
            currency: 'INR',
            actualCost: parseFloat(jobRow.actual_cost || 0),
            refundAmount: parseFloat(jobRow.refunded_amount || 0),
            fetchedCount: parseInt(jobRow.fetched_count || 0, 10)
          };
        }
      }
    }

    const actualCount = Math.max(0, parseInt(actualInsertedCount, 10) || 0);
    const reqCount = jobRow && jobRow.requested_count != null ? parseInt(jobRow.requested_count, 10) : (parseInt(requestedCount, 10) || 0);
    const rate = jobRow && jobRow.rate_per_lead != null ? parseFloat(jobRow.rate_per_lead) : (parseFloat(ratePerLead) || 1.0);
    const targetUserId = (jobRow && jobRow.user_id) ? jobRow.user_id : userId;

    // Source of truth for estimated hold: read from job row if present
    const estimatedCost = jobRow && jobRow.estimated_cost != null 
      ? parseFloat(parseFloat(jobRow.estimated_cost).toFixed(2))
      : parseFloat((reqCount * rate).toFixed(2));

    // REQUIRED BILLING RULE:
    // actual_charge = successfully_generated_unique_leads * exact_per_lead_rate
    // For 0 leads: actual_charge = 0, unused_hold = full estimated hold
    const actualCost = actualCount === 0 
      ? 0.00 
      : parseFloat((actualCount * rate).toFixed(2));

    const unfulfilledCount = Math.max(0, reqCount - actualCount);
    const refundAmount = actualCount === 0
      ? estimatedCost
      : parseFloat(Math.max(0, estimatedCost - actualCost).toFixed(2));

    // Lock user row exclusively
    const userRes = await client.query(
      'SELECT id, wallet_balance FROM users WHERE id = $1 FOR UPDATE',
      [targetUserId]
    );

    if (userRes.rows.length === 0) {
      if (shouldManageTx) await client.query('ROLLBACK');
      return { success: false, reason: 'USER_NOT_FOUND' };
    }

    const currentBalance = parseFloat(userRes.rows[0].wallet_balance || 0);
    let finalBalance = currentBalance;
    let refundLedgerId = null;

    if (refundAmount > 0) {
      finalBalance = parseFloat((currentBalance + refundAmount).toFixed(2));
      await client.query(
        'UPDATE users SET wallet_balance = $1 WHERE id = $2',
        [finalBalance, targetUserId]
      );

      const refundReason = actualCount === 0
        ? `Full refund for 0 leads generated (Job #${effectiveJobId || ''})`
        : `Refund for ${unfulfilledCount} unfulfilled/duplicate leads (Job #${effectiveJobId || ''})`;

      const refundMeta = {
        ...metadata,
        jobId: effectiveJobId,
        requestedCount: reqCount,
        actualInsertedCount: actualCount,
        unfulfilledCount,
        ratePerLead: rate,
        estimatedCost,
        actualCost,
        refundAmount,
        currency: 'INR'
      };

      const ledgerRes = await client.query(
        `INSERT INTO wallet_ledger (user_id, amount, balance_after, type, reason, reference_id, metadata)
         VALUES ($1, $2, $3, 'REFUND', $4, $5, $6)
         RETURNING id`,
        [targetUserId, refundAmount, finalBalance, refundReason, effectiveJobId ? String(effectiveJobId) : null, JSON.stringify(refundMeta)]
      );
      refundLedgerId = ledgerRes.rows[0].id;
    }

    // Mark job billing SETTLED and update actual_cost, refunded_amount, fetched_count, and status
    if (effectiveJobId) {
      const finalStatus = metadata.status || (actualCount > 0 ? 'COMPLETED' : (metadata.failed ? 'FAILED' : 'COMPLETED'));
      await client.query(
        `UPDATE jobs 
         SET actual_cost = $1, 
             refunded_amount = $2, 
             fetched_count = $3, 
             billing_status = 'SETTLED',
             status = $4
         WHERE id = $5`,
        [actualCost, refundAmount, actualCount, finalStatus, effectiveJobId]
      );
    }

    if (shouldManageTx) await client.query('COMMIT');

    return {
      success: true,
      jobId: effectiveJobId,
      currency: 'INR',
      estimatedCost,
      actualCost,
      refundAmount,
      unfulfilledCount,
      refundLedgerId,
      newBalance: finalBalance
    };
  } catch (err) {
    if (shouldManageTx) await client.query('ROLLBACK');
    console.error(`[Wallet Settle Error] Job #${jobId}, User ${userId}:`, err.message);
    throw err;
  } finally {
    if (shouldManageTx) client.release();
  }
}


/**
 * Atomically credit user's wallet balance (e.g. from Razorpay recharge)
 */
async function creditBalance(userId, amount, reason, referenceId = null, metadata = {}, clientOverride = null) {
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('Invalid credit amount');
  }

  const client = clientOverride || await pool.connect();
  const shouldManageTx = !clientOverride;
  try {
    if (shouldManageTx) await client.query('BEGIN');

    // Lock user row
    const userRes = await client.query(
      'SELECT id, wallet_balance, email FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );

    if (userRes.rows.length === 0) {
      if (shouldManageTx) await client.query('ROLLBACK');
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

    if (shouldManageTx) await client.query('COMMIT');

    return {
      success: true,
      ledgerId: ledgerRes.rows[0].id,
      creditedAmount: numericAmount,
      previousBalance: currentBalance,
      newBalance,
      currency: 'INR',
      timestamp: ledgerRes.rows[0].created_at
    };
  } catch (err) {
    if (shouldManageTx) await client.query('ROLLBACK');
    console.error(`[Wallet Credit Error] User ${userId}, Amount ${numericAmount}:`, err.message);
    throw err;
  } finally {
    if (shouldManageTx) client.release();
  }
}

/**
 * Atomically credit user's USD wallet balance (e.g. from Razorpay USD recharge)
 * Never touches users.wallet_balance (INR)
 */
async function creditBalanceUSD(userId, amount, reason, referenceId = null, metadata = {}, clientOverride = null) {
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('Invalid USD credit amount');
  }

  const client = clientOverride || await pool.connect();
  const shouldManageTx = !clientOverride;
  try {
    if (shouldManageTx) await client.query('BEGIN');

    // Lock user row
    const userRes = await client.query(
      'SELECT id, wallet_balance_usd, email FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );

    if (userRes.rows.length === 0) {
      if (shouldManageTx) await client.query('ROLLBACK');
      return { success: false, reason: 'USER_NOT_FOUND' };
    }

    const currentBalance = parseFloat(userRes.rows[0].wallet_balance_usd || 0);
    const newBalance = parseFloat((currentBalance + numericAmount).toFixed(4));

    await client.query(
      'UPDATE users SET wallet_balance_usd = $1 WHERE id = $2',
      [newBalance, userId]
    );

    // Record Immutable CREDIT in USD Ledger
    const ledgerRes = await client.query(
      `INSERT INTO wallet_ledger_usd (user_id, amount, balance_after, type, reason, reference_id, metadata)
       VALUES ($1, $2, $3, 'CREDIT', $4, $5, $6)
       RETURNING id, created_at`,
      [
        userId,
        numericAmount,
        newBalance,
        reason || 'USD Wallet recharge',
        referenceId ? String(referenceId) : null,
        JSON.stringify({ ...metadata, currency: 'USD' })
      ]
    );

    if (shouldManageTx) await client.query('COMMIT');

    return {
      success: true,
      ledgerId: ledgerRes.rows[0].id,
      creditedAmount: numericAmount,
      previousBalance: currentBalance,
      newBalance,
      currency: 'USD',
      timestamp: ledgerRes.rows[0].created_at
    };
  } catch (err) {
    if (shouldManageTx) await client.query('ROLLBACK');
    console.error(`[Wallet Credit USD Error] User ${userId}, Amount ${numericAmount}:`, err.message);
    throw err;
  } finally {
    if (shouldManageTx) client.release();
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

/**
 * Atomically reserve/hold USD balance for a lead generation job
 */
async function reserveBalanceUSD(userId, amount, jobId = null, metadata = {}, clientOverride = null) {
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('Invalid USD reservation amount');
  }

  const client = clientOverride || await pool.connect();
  const shouldManageTx = !clientOverride;
  try {
    if (shouldManageTx) await client.query('BEGIN');

    const userRes = await client.query(
      'SELECT id, wallet_balance_usd, email, name, plan FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );

    if (userRes.rows.length === 0) {
      if (shouldManageTx) await client.query('ROLLBACK');
      return { success: false, reason: 'USER_NOT_FOUND' };
    }

    const currentBalance = parseFloat(userRes.rows[0].wallet_balance_usd || 0);

    if (currentBalance < numericAmount) {
      if (shouldManageTx) await client.query('ROLLBACK');
      return {
        success: false,
        reason: 'INSUFFICIENT_BALANCE',
        currency: 'USD',
        currentBalance,
        required: numericAmount,
        shortfall: parseFloat((numericAmount - currentBalance).toFixed(4))
      };
    }

    const newBalance = parseFloat((currentBalance - numericAmount).toFixed(4));
    await client.query(
      'UPDATE users SET wallet_balance_usd = $1 WHERE id = $2',
      [newBalance, userId]
    );

    const reason = metadata.reason || `Hold for ${metadata.requestedCount || ''} leads (${metadata.source || 'Scraper'})`;
    const ledgerRes = await client.query(
      `INSERT INTO wallet_ledger_usd (user_id, amount, balance_after, type, reason, reference_id, metadata)
       VALUES ($1, $2, $3, 'DEBIT', $4, $5, $6)
       RETURNING id, created_at`,
      [
        userId,
        numericAmount,
        newBalance,
        reason,
        jobId ? String(jobId) : null,
        JSON.stringify({ ...metadata, currency: 'USD' })
      ]
    );

    if (shouldManageTx) await client.query('COMMIT');

    return {
      success: true,
      ledgerId: ledgerRes.rows[0].id,
      previousBalance: currentBalance,
      newBalance,
      currency: 'USD',
      reservedAmount: numericAmount,
      timestamp: ledgerRes.rows[0].created_at
    };
  } catch (err) {
    if (shouldManageTx) await client.query('ROLLBACK');
    console.error(`[Wallet Reserve USD Error] User ${userId}, Amount ${numericAmount}:`, err.message);
    throw err;
  } finally {
    if (shouldManageTx) client.release();
  }
}

/**
 * Settle a completed or failed lead job for USD
 * Deducts strictly for unique leads successfully inserted.
 * REQUIRED BILLING RULE:
 * actual_charge = successfully_generated_unique_leads * exact_per_lead_rate
 * unused_hold = estimated_hold - actual_charge
 * For 0 leads: actual_charge = 0, unused_hold = full estimated hold (100% refunded)
 */
async function settleJobUSD(userId, jobId, requestedCount, actualInsertedCount, ratePerLead, metadata = {}, clientOverride = null) {
  const client = clientOverride || await pool.connect();
  const shouldManageTx = !clientOverride;
  try {
    if (shouldManageTx) await client.query('BEGIN');

    let effectiveJobId = jobId ? parseInt(jobId, 10) : null;
    let jobRow = null;

    if (effectiveJobId) {
      // 1. Lock job row to ensure idempotency and prevent double refunds
      const jobRes = await client.query(
        'SELECT id, user_id, requested_count, fetched_count, rate_per_lead, estimated_cost, actual_cost, refunded_amount, billing_status, status, currency FROM jobs WHERE id = $1 FOR UPDATE',
        [effectiveJobId]
      );
      if (jobRes.rows.length > 0) {
        jobRow = jobRes.rows[0];
        // Idempotency guard: If already settled, do not process again
        if (jobRow.billing_status === 'SETTLED') {
          if (shouldManageTx) await client.query('COMMIT');
          return {
            success: true,
            alreadySettled: true,
            jobId: effectiveJobId,
            currency: 'USD',
            actualCost: parseFloat(jobRow.actual_cost || 0),
            refundAmount: parseFloat(jobRow.refunded_amount || 0),
            fetchedCount: parseInt(jobRow.fetched_count || 0, 10)
          };
        }
      }
    }

    const actualCount = Math.max(0, parseInt(actualInsertedCount, 10) || 0);
    const reqCount = jobRow && jobRow.requested_count != null ? parseInt(jobRow.requested_count, 10) : (parseInt(requestedCount, 10) || 0);
    const rate = jobRow && jobRow.rate_per_lead != null ? parseFloat(jobRow.rate_per_lead) : (parseFloat(ratePerLead) || 0.014);
    const targetUserId = (jobRow && jobRow.user_id) ? jobRow.user_id : userId;

    // Source of truth for estimated hold: read from job row if present
    const estimatedCost = jobRow && jobRow.estimated_cost != null 
      ? parseFloat(parseFloat(jobRow.estimated_cost).toFixed(4))
      : parseFloat((reqCount * rate).toFixed(4));

    // REQUIRED BILLING RULE:
    // actual_charge = successfully_generated_unique_leads * exact_per_lead_rate
    // For 0 leads: actual_charge = 0, unused_hold = full estimated hold
    const actualCost = actualCount === 0 
      ? 0.0000 
      : parseFloat((actualCount * rate).toFixed(4));

    const unfulfilledCount = Math.max(0, reqCount - actualCount);
    const refundAmount = actualCount === 0
      ? estimatedCost
      : parseFloat(Math.max(0, estimatedCost - actualCost).toFixed(4));

    // Lock user row exclusively
    const userRes = await client.query(
      'SELECT id, wallet_balance_usd FROM users WHERE id = $1 FOR UPDATE',
      [targetUserId]
    );

    if (userRes.rows.length === 0) {
      if (shouldManageTx) await client.query('ROLLBACK');
      return { success: false, reason: 'USER_NOT_FOUND' };
    }

    const currentBalance = parseFloat(userRes.rows[0].wallet_balance_usd || 0);
    let finalBalance = currentBalance;
    let refundLedgerId = null;

    if (refundAmount > 0) {
      finalBalance = parseFloat((currentBalance + refundAmount).toFixed(4));
      await client.query(
        'UPDATE users SET wallet_balance_usd = $1 WHERE id = $2',
        [finalBalance, targetUserId]
      );

      const refundReason = actualCount === 0
        ? `Full refund for 0 leads generated (Job #${effectiveJobId || ''})`
        : `Refund for ${unfulfilledCount} unfulfilled/duplicate leads (Job #${effectiveJobId || ''})`;

      const refundMeta = {
        ...metadata,
        jobId: effectiveJobId,
        requestedCount: reqCount,
        actualInsertedCount: actualCount,
        unfulfilledCount,
        ratePerLead: rate,
        estimatedCost,
        actualCost,
        refundAmount,
        currency: 'USD'
      };

      const ledgerRes = await client.query(
        `INSERT INTO wallet_ledger_usd (user_id, amount, balance_after, type, reason, reference_id, metadata)
         VALUES ($1, $2, $3, 'REFUND', $4, $5, $6)
         RETURNING id`,
        [targetUserId, refundAmount, finalBalance, refundReason, effectiveJobId ? String(effectiveJobId) : null, JSON.stringify(refundMeta)]
      );
      refundLedgerId = ledgerRes.rows[0].id;
    }

    // Mark job billing SETTLED and update actual_cost, refunded_amount, fetched_count, and status
    if (effectiveJobId) {
      const finalStatus = metadata.status || (actualCount > 0 ? 'COMPLETED' : (metadata.failed ? 'FAILED' : 'COMPLETED'));
      await client.query(
        `UPDATE jobs 
         SET actual_cost = $1, 
             refunded_amount = $2, 
             fetched_count = $3, 
             billing_status = 'SETTLED',
             status = $4
         WHERE id = $5`,
        [actualCost, refundAmount, actualCount, finalStatus, effectiveJobId]
      );
    }

    if (shouldManageTx) await client.query('COMMIT');

    return {
      success: true,
      jobId: effectiveJobId,
      currency: 'USD',
      estimatedCost,
      actualCost,
      refundAmount,
      unfulfilledCount,
      refundLedgerId,
      newBalance: finalBalance
    };
  } catch (err) {
    if (shouldManageTx) await client.query('ROLLBACK');
    console.error(`[Wallet Settle USD Error] Job #${jobId}, User ${userId}:`, err.message);
    throw err;
  } finally {
    if (shouldManageTx) client.release();
  }
}

/**
 * Get live USD wallet balance
 */
async function getWalletBalanceUSD(userId, clientOverride = null) {
  const runner = clientOverride || pool;
  const res = await runner.query(
    'SELECT id, name, email, plan, wallet_balance_usd, currency_preference FROM users WHERE id = $1',
    [userId]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    userId: row.id,
    name: row.name,
    email: row.email,
    plan: row.plan || 'free',
    balance: parseFloat(row.wallet_balance_usd || 0),
    currency: 'USD'
  };
}

/**
 * Get immutable transaction ledger history for USD
 */
async function getLedgerHistoryUSD(userId, limit = 50, offset = 0, clientOverride = null) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);
  const runner = clientOverride || pool;

  const [countRes, rowsRes] = await Promise.all([
    runner.query('SELECT COUNT(*) FROM wallet_ledger_usd WHERE user_id = $1', [userId]),
    runner.query(
      `SELECT id, amount, balance_after, type, reason, reference_id, metadata, created_at
       FROM wallet_ledger_usd 
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
    currency: 'USD',
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
 * Aggregate Billing Summary for USD
 */
async function getBillingSummaryUSD(userId, clientOverride = null) {
  const runner = clientOverride || pool;
  const [ledgerAgg, jobsAgg, activeHolds] = await Promise.all([
    runner.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END), 0) as total_credited,
         COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END), 0) as total_debited,
         COALESCE(SUM(CASE WHEN type = 'REFUND' THEN amount ELSE 0 END), 0) as total_refunded,
         COUNT(*) as total_transactions
       FROM wallet_ledger_usd 
       WHERE user_id = $1`,
      [userId]
    ),
    runner.query(
      `SELECT 
         COUNT(*) as total_jobs,
         COALESCE(SUM(fetched_count), 0) as total_unique_leads,
         COALESCE(SUM(actual_cost), 0) as net_spent_on_leads
       FROM jobs 
       WHERE user_id = $1`,
      [userId]
    ),
    runner.query(
      `SELECT COALESCE(SUM(estimated_cost), 0) as active_hold_amount
       FROM jobs 
       WHERE user_id = $1 AND status = 'IN_PROGRESS'`,
      [userId]
    )
  ]);

  const totalCredited = parseFloat(ledgerAgg.rows[0].total_credited);
  const totalDebited = parseFloat(ledgerAgg.rows[0].total_debited);
  const totalRefunded = parseFloat(ledgerAgg.rows[0].total_refunded);
  const netSpent = parseFloat((totalDebited - totalRefunded).toFixed(4));
  const totalUniqueLeads = parseInt(jobsAgg.rows[0].total_unique_leads, 10);

  return {
    currency: 'USD',
    totalCredited,
    totalDebited,
    totalRefunded,
    netSpent,
    totalUniqueLeads,
    totalJobs: parseInt(jobsAgg.rows[0].total_jobs, 10),
    activeHoldAmount: parseFloat(activeHolds.rows[0].active_hold_amount),
    averageCostPerLead: totalUniqueLeads > 0 ? parseFloat((netSpent / totalUniqueLeads).toFixed(4)) : 0.00
  };
}

/**
 * Automatically audit and settle any lingering jobs in 'HELD' status
 * (e.g. from server restarts, aborted requests, or unhandled exceptions)
 */
async function autoSettleHeldJobs(userId = null) {
  try {
    let query = `
      SELECT id, user_id, requested_count, fetched_count, rate_per_lead, estimated_cost, billing_status, status, currency, created_at
      FROM jobs
      WHERE billing_status = 'HELD' 
        AND (status IN ('COMPLETED', 'FAILED') OR created_at < NOW() - INTERVAL '15 minutes')
    `;
    const params = [];
    if (userId) {
      query += ` AND user_id = $1`;
      params.push(userId);
    }
    query += ` ORDER BY id ASC LIMIT 20`;

    const heldJobs = await pool.query(query, params);
    for (const job of heldJobs.rows) {
      const countRes = await pool.query('SELECT COUNT(*) FROM leads WHERE job_id = $1', [job.id]);
      const actualCount = parseInt(countRes.rows[0]?.count, 10) || 0;
      const isUSD = (job.currency || '').toUpperCase() === 'USD';

      if (isUSD) {
        await settleJobUSD(job.user_id, job.id, job.requested_count, actualCount, job.rate_per_lead, {
          autoSettled: true,
          status: actualCount > 0 ? 'COMPLETED' : (job.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED')
        });
      } else {
        await settleJob(job.user_id, job.id, job.requested_count, actualCount, job.rate_per_lead, {
          autoSettled: true,
          status: actualCount > 0 ? 'COMPLETED' : (job.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED')
        });
      }
      console.log(`[AutoSettle] Successfully settled held job #${job.id} for user #${job.user_id}`);
    }
  } catch (err) {
    console.error('[AutoSettle Error]:', err.message);
  }
}

module.exports = {
  reserveBalance,
  settleJob,
  creditBalance,
  getWalletBalance,
  getLedgerHistory,
  getBillingSummary,
  // Parallel USD Wallet Methods
  creditBalanceUSD,
  reserveBalanceUSD,
  settleJobUSD,
  getWalletBalanceUSD,
  getLedgerHistoryUSD,
  getBillingSummaryUSD,
  // Automatic Audit & Recovery
  autoSettleHeldJobs
};

