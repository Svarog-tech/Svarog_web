const express = require('express');
const router = express.Router();
const crypto = require('crypto');

module.exports = function({ db, logger, authenticateUser, requireAdmin, auditLog }) {
  const { asyncHandler, AppError } = require('../middleware/errorHandler');

  // ============================================
  // HELPERS
  // ============================================

  function validateNumericId(id, paramName = 'id') {
    const num = parseInt(id, 10);
    if (isNaN(num) || num <= 0 || String(num) !== String(id)) {
      throw new AppError(`Invalid ${paramName}: must be a positive integer`, 400);
    }
    return num;
  }

  function parsePagination(query, defaultLimit = 20, maxLimit = 100) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
    const offset = (page - 1) * limit;
    return { page, limit, offset };
  }

  function paginationMeta(page, limit, total) {
    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total
    };
  }

  /**
   * Generate a unique 8-character alphanumeric referral code
   */
  function generateReferralCode() {
    return crypto.randomBytes(6).toString('base64url').slice(0, 8).toUpperCase();
  }

  // ============================================
  // USER ROUTES
  // ============================================

  /**
   * Join affiliate program
   * POST /api/affiliate/join
   */
  router.post('/affiliate/join',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;

      // Check if user already has an affiliate account
      const existing = await db.queryOne(
        'SELECT id, referral_code FROM affiliate_accounts WHERE user_id = ?',
        [userId]
      );

      if (existing) {
        throw new AppError('Již jste součástí affiliate programu', 400);
      }

      // Generate unique referral code with retry
      let referralCode;
      let attempts = 0;
      while (attempts < 10) {
        referralCode = generateReferralCode();
        const dup = await db.queryOne(
          'SELECT id FROM affiliate_accounts WHERE referral_code = ?',
          [referralCode]
        );
        if (!dup) break;
        attempts++;
      }
      if (attempts >= 10) {
        throw new AppError('Nepodařilo se vygenerovat unikátní kód, zkuste to znovu', 500);
      }

      await db.execute(
        `INSERT INTO affiliate_accounts (user_id, referral_code, commission_rate, tier)
         VALUES (?, ?, 10.00, 'bronze')`,
        [userId, referralCode]
      );

      const account = await db.queryOne(
        'SELECT * FROM affiliate_accounts WHERE user_id = ?',
        [userId]
      );

      if (auditLog) {
        await auditLog(userId, 'affiliate.join', 'affiliate_account', String(account.id), {}, req);
      }

      logger.info('User joined affiliate program', { userId, referralCode });

      res.status(201).json({
        success: true,
        referral_code: account.referral_code,
        commission_rate: Number(account.commission_rate),
        referral_link: `/ref/${account.referral_code}`
      });
    })
  );

  /**
   * Get affiliate dashboard
   * GET /api/affiliate/dashboard
   */
  router.get('/affiliate/dashboard',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;

      const account = await db.queryOne(
        'SELECT * FROM affiliate_accounts WHERE user_id = ?',
        [userId]
      );

      if (!account) {
        throw new AppError('Nemáte affiliate účet. Nejprve se připojte k programu.', 404);
      }

      const conversionRate = account.total_referrals > 0
        ? Math.round((account.total_conversions / account.total_referrals) * 100 * 100) / 100
        : 0;

      // Recent commissions (last 10)
      const recentCommissions = await db.query(
        `SELECT id, order_amount, commission_rate, commission_amount, status, created_at
         FROM affiliate_commissions
         WHERE affiliate_id = ?
         ORDER BY created_at DESC
         LIMIT 10`,
        [account.id]
      );

      // Recent referrals (last 10)
      const recentReferrals = await db.query(
        `SELECT id, referred_at, converted, converted_at
         FROM affiliate_referrals
         WHERE affiliate_id = ?
         ORDER BY referred_at DESC
         LIMIT 10`,
        [account.id]
      );

      res.json({
        success: true,
        account: {
          id: account.id,
          referral_code: account.referral_code,
          commission_rate: Number(account.commission_rate),
          tier: account.tier,
          total_earnings: Number(account.total_earnings),
          total_paid_out: Number(account.total_paid_out),
          pending_balance: Number(account.pending_balance),
          total_referrals: account.total_referrals,
          total_conversions: account.total_conversions,
          is_active: !!account.is_active,
          created_at: account.created_at
        },
        conversion_rate: conversionRate,
        recent_commissions: recentCommissions || [],
        recent_referrals: recentReferrals || []
      });
    })
  );

  /**
   * List commissions with pagination
   * GET /api/affiliate/commissions
   */
  router.get('/affiliate/commissions',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;

      const account = await db.queryOne(
        'SELECT id FROM affiliate_accounts WHERE user_id = ?',
        [userId]
      );

      if (!account) {
        throw new AppError('Nemáte affiliate účet', 404);
      }

      const { page, limit, offset } = parsePagination(req.query);

      const countResult = await db.query(
        'SELECT COUNT(*) as total FROM affiliate_commissions WHERE affiliate_id = ?',
        [account.id]
      );
      const total = countResult[0]?.total || 0;

      const commissions = await db.query(
        `SELECT id, order_amount, commission_rate, commission_amount, status, created_at
         FROM affiliate_commissions
         WHERE affiliate_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [account.id, limit, offset]
      );

      res.json({
        success: true,
        commissions: commissions || [],
        pagination: paginationMeta(page, limit, total)
      });
    })
  );

  /**
   * List referred users with pagination
   * GET /api/affiliate/referrals
   */
  router.get('/affiliate/referrals',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;

      const account = await db.queryOne(
        'SELECT id FROM affiliate_accounts WHERE user_id = ?',
        [userId]
      );

      if (!account) {
        throw new AppError('Nemáte affiliate účet', 404);
      }

      const { page, limit, offset } = parsePagination(req.query);

      const countResult = await db.query(
        'SELECT COUNT(*) as total FROM affiliate_referrals WHERE affiliate_id = ?',
        [account.id]
      );
      const total = countResult[0]?.total || 0;

      // No PII of referred user — only id, dates, conversion status
      const referrals = await db.query(
        `SELECT id, referred_at, converted, converted_at
         FROM affiliate_referrals
         WHERE affiliate_id = ?
         ORDER BY referred_at DESC
         LIMIT ? OFFSET ?`,
        [account.id, limit, offset]
      );

      res.json({
        success: true,
        referrals: referrals || [],
        pagination: paginationMeta(page, limit, total)
      });
    })
  );

  /**
   * Request payout (to account credit)
   * POST /api/affiliate/payout
   */
  router.post('/affiliate/payout',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const { amount, method } = req.body || {};

      if (!amount || typeof amount !== 'number' || amount <= 0) {
        throw new AppError('Neplatná částka', 400);
      }

      const payoutMethod = method || 'credit';
      if (!['credit', 'bank_transfer'].includes(payoutMethod)) {
        throw new AppError('Neplatná metoda výplaty', 400);
      }

      const account = await db.queryOne(
        'SELECT * FROM affiliate_accounts WHERE user_id = ?',
        [userId]
      );

      if (!account) {
        throw new AppError('Nemáte affiliate účet', 404);
      }

      if (!account.is_active) {
        throw new AppError('Váš affiliate účet není aktivní', 403);
      }

      const pendingBalance = Number(account.pending_balance);

      if (amount > pendingBalance) {
        throw new AppError('Nedostatečný zůstatek pro výplatu', 400);
      }

      if (amount < 50) {
        throw new AppError('Minimální částka pro výplatu je 50 Kč', 400);
      }

      const roundedAmount = Math.round(amount * 100) / 100;

      if (payoutMethod === 'credit') {
        // Instant credit payout
        await db.execute(
          `INSERT INTO affiliate_payouts (affiliate_id, amount, payout_method, status, processed_at)
           VALUES (?, ?, 'credit', 'completed', NOW())`,
          [account.id, roundedAmount]
        );

        // Update affiliate account balances atomically
        const updateResult = await db.execute(
          `UPDATE affiliate_accounts
           SET pending_balance = ROUND(pending_balance - ?, 2),
               total_paid_out = ROUND(total_paid_out + ?, 2)
           WHERE id = ? AND pending_balance >= ?`,
          [roundedAmount, roundedAmount, account.id, roundedAmount]
        );

        if (updateResult.affectedRows === 0) {
          throw new AppError('Výplata se nezdařila — nedostatečný zůstatek', 400);
        }

        // Add to user's credit balance
        await db.execute(
          'UPDATE users SET credit_balance = ROUND(credit_balance + ?, 2) WHERE id = ?',
          [roundedAmount, userId]
        );

        // Record credit transaction
        const updatedUser = await db.queryOne('SELECT credit_balance FROM users WHERE id = ?', [userId]);
        const balanceAfter = Number(updatedUser?.credit_balance) || 0;

        await db.execute(
          `INSERT INTO account_credits (user_id, amount, balance_after, transaction_type, description)
           VALUES (?, ?, ?, 'deposit', ?)`,
          [userId, roundedAmount, balanceAfter, `Affiliate výplata`]
        );

        if (auditLog) {
          await auditLog(userId, 'affiliate.payout.credit', 'affiliate_account', String(account.id), { amount: roundedAmount }, req);
        }

        const payout = await db.queryOne(
          'SELECT * FROM affiliate_payouts WHERE affiliate_id = ? ORDER BY created_at DESC LIMIT 1',
          [account.id]
        );

        res.json({
          success: true,
          payout: {
            id: payout.id,
            amount: Number(payout.amount),
            payout_method: payout.payout_method,
            status: payout.status,
            created_at: payout.created_at
          }
        });
      } else {
        // Bank transfer — create pending payout request for admin processing
        await db.execute(
          `INSERT INTO affiliate_payouts (affiliate_id, amount, payout_method, status)
           VALUES (?, ?, 'bank_transfer', 'pending')`,
          [account.id, roundedAmount]
        );

        // Reserve the amount (deduct from pending_balance)
        await db.execute(
          `UPDATE affiliate_accounts
           SET pending_balance = ROUND(pending_balance - ?, 2)
           WHERE id = ? AND pending_balance >= ?`,
          [roundedAmount, account.id, roundedAmount]
        );

        const payout = await db.queryOne(
          'SELECT * FROM affiliate_payouts WHERE affiliate_id = ? ORDER BY created_at DESC LIMIT 1',
          [account.id]
        );

        if (auditLog) {
          await auditLog(userId, 'affiliate.payout.request', 'affiliate_account', String(account.id), { amount: roundedAmount, method: 'bank_transfer' }, req);
        }

        res.json({
          success: true,
          payout: {
            id: payout.id,
            amount: Number(payout.amount),
            payout_method: payout.payout_method,
            status: payout.status,
            created_at: payout.created_at
          }
        });
      }
    })
  );

  /**
   * List payout history
   * GET /api/affiliate/payouts
   */
  router.get('/affiliate/payouts',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;

      const account = await db.queryOne(
        'SELECT id FROM affiliate_accounts WHERE user_id = ?',
        [userId]
      );

      if (!account) {
        throw new AppError('Nemáte affiliate účet', 404);
      }

      const { page, limit, offset } = parsePagination(req.query);

      const countResult = await db.query(
        'SELECT COUNT(*) as total FROM affiliate_payouts WHERE affiliate_id = ?',
        [account.id]
      );
      const total = countResult[0]?.total || 0;

      const payouts = await db.query(
        `SELECT id, amount, payout_method, status, notes, processed_at, created_at
         FROM affiliate_payouts
         WHERE affiliate_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [account.id, limit, offset]
      );

      res.json({
        success: true,
        payouts: payouts || [],
        pagination: paginationMeta(page, limit, total)
      });
    })
  );

  // ============================================
  // ADMIN ROUTES
  // ============================================

  /**
   * List all affiliate accounts with stats
   * GET /api/admin/affiliate/accounts
   */
  router.get('/admin/affiliate/accounts',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { page, limit, offset } = parsePagination(req.query);

      const countResult = await db.query('SELECT COUNT(*) as total FROM affiliate_accounts');
      const total = countResult[0]?.total || 0;

      const accounts = await db.query(
        `SELECT a.*, p.email, p.first_name, p.last_name
         FROM affiliate_accounts a
         LEFT JOIN profiles p ON p.id = a.user_id
         ORDER BY a.created_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );

      res.json({
        success: true,
        accounts: accounts || [],
        pagination: paginationMeta(page, limit, total)
      });
    })
  );

  /**
   * List all commissions (filterable by status)
   * GET /api/admin/affiliate/commissions
   */
  router.get('/admin/affiliate/commissions',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { page, limit, offset } = parsePagination(req.query);
      const { status } = req.query;

      const validStatuses = ['pending', 'approved', 'paid', 'rejected'];
      let whereClause = '';
      const params = [];

      if (status && validStatuses.includes(status)) {
        whereClause = 'WHERE c.status = ?';
        params.push(status);
      }

      const countResult = await db.query(
        `SELECT COUNT(*) as total FROM affiliate_commissions c ${whereClause}`,
        params
      );
      const total = countResult[0]?.total || 0;

      const commissions = await db.query(
        `SELECT c.*, p.email AS affiliate_email, p.first_name, p.last_name,
                a.referral_code
         FROM affiliate_commissions c
         LEFT JOIN affiliate_accounts a ON a.id = c.affiliate_id
         LEFT JOIN profiles p ON p.id = a.user_id
         ${whereClause}
         ORDER BY c.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      res.json({
        success: true,
        commissions: commissions || [],
        pagination: paginationMeta(page, limit, total)
      });
    })
  );

  /**
   * Approve/reject commission
   * PUT /api/admin/affiliate/commissions/:id
   */
  router.put('/admin/affiliate/commissions/:id',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const commissionId = validateNumericId(req.params.id);
      const { status } = req.body || {};

      if (!status || !['approved', 'rejected'].includes(status)) {
        throw new AppError('Status musí být "approved" nebo "rejected"', 400);
      }

      const commission = await db.queryOne(
        'SELECT * FROM affiliate_commissions WHERE id = ?',
        [commissionId]
      );

      if (!commission) {
        throw new AppError('Provize nenalezena', 404);
      }

      if (commission.status !== 'pending') {
        throw new AppError('Pouze čekající provize mohou být schváleny/zamítnuty', 400);
      }

      if (status === 'approved') {
        await db.execute(
          'UPDATE affiliate_commissions SET status = ?, approved_at = NOW() WHERE id = ?',
          [status, commissionId]
        );
      } else {
        // Rejected — return commission to pending_balance deduction
        await db.execute(
          'UPDATE affiliate_commissions SET status = ? WHERE id = ?',
          [status, commissionId]
        );

        // Deduct from pending_balance and total_earnings
        await db.execute(
          `UPDATE affiliate_accounts
           SET pending_balance = ROUND(GREATEST(0, pending_balance - ?), 2),
               total_earnings = ROUND(GREATEST(0, total_earnings - ?), 2)
           WHERE id = ?`,
          [Number(commission.commission_amount), Number(commission.commission_amount), commission.affiliate_id]
        );
      }

      if (auditLog) {
        await auditLog(req.user.id, `affiliate.commission.${status}`, 'affiliate_commission', String(commissionId), { commission_amount: commission.commission_amount }, req);
      }

      res.json({ success: true, message: `Provize ${status === 'approved' ? 'schválena' : 'zamítnuta'}` });
    })
  );

  /**
   * Update affiliate account (commission rate, tier, active status)
   * PUT /api/admin/affiliate/accounts/:id
   */
  router.put('/admin/affiliate/accounts/:id',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const accountId = validateNumericId(req.params.id);
      const { commission_rate, tier, is_active } = req.body || {};

      const account = await db.queryOne(
        'SELECT id FROM affiliate_accounts WHERE id = ?',
        [accountId]
      );

      if (!account) {
        throw new AppError('Affiliate účet nenalezen', 404);
      }

      const updates = [];
      const values = [];

      if (commission_rate !== undefined) {
        const rate = Number(commission_rate);
        if (isNaN(rate) || rate < 0 || rate > 100) {
          throw new AppError('Provizní sazba musí být mezi 0 a 100', 400);
        }
        updates.push('commission_rate = ?');
        values.push(rate);
      }

      if (tier !== undefined) {
        if (!['bronze', 'silver', 'gold'].includes(tier)) {
          throw new AppError('Neplatný tier', 400);
        }
        updates.push('tier = ?');
        values.push(tier);
      }

      if (is_active !== undefined) {
        updates.push('is_active = ?');
        values.push(!!is_active);
      }

      if (updates.length === 0) {
        throw new AppError('Žádná pole k aktualizaci', 400);
      }

      values.push(accountId);
      await db.execute(
        `UPDATE affiliate_accounts SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      if (auditLog) {
        await auditLog(req.user.id, 'affiliate.account.update', 'affiliate_account', String(accountId), req.body, req);
      }

      const updated = await db.queryOne('SELECT * FROM affiliate_accounts WHERE id = ?', [accountId]);

      res.json({ success: true, account: updated });
    })
  );

  /**
   * List all payout requests
   * GET /api/admin/affiliate/payouts
   */
  router.get('/admin/affiliate/payouts',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { page, limit, offset } = parsePagination(req.query);

      const countResult = await db.query('SELECT COUNT(*) as total FROM affiliate_payouts');
      const total = countResult[0]?.total || 0;

      const payouts = await db.query(
        `SELECT ap.*, p.email AS affiliate_email, p.first_name, p.last_name,
                a.referral_code
         FROM affiliate_payouts ap
         LEFT JOIN affiliate_accounts a ON a.id = ap.affiliate_id
         LEFT JOIN profiles p ON p.id = a.user_id
         ORDER BY ap.created_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );

      res.json({
        success: true,
        payouts: payouts || [],
        pagination: paginationMeta(page, limit, total)
      });
    })
  );

  /**
   * Process payout (mark completed/failed)
   * PUT /api/admin/affiliate/payouts/:id
   */
  router.put('/admin/affiliate/payouts/:id',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const payoutId = validateNumericId(req.params.id);
      const { status, notes } = req.body || {};

      if (!status || !['completed', 'failed'].includes(status)) {
        throw new AppError('Status musí být "completed" nebo "failed"', 400);
      }

      const payout = await db.queryOne(
        'SELECT * FROM affiliate_payouts WHERE id = ?',
        [payoutId]
      );

      if (!payout) {
        throw new AppError('Výplata nenalezena', 404);
      }

      if (payout.status !== 'pending') {
        throw new AppError('Pouze čekající výplaty mohou být zpracovány', 400);
      }

      await db.execute(
        `UPDATE affiliate_payouts
         SET status = ?, notes = ?, processed_by = ?, processed_at = NOW()
         WHERE id = ?`,
        [status, notes || null, req.user.id, payoutId]
      );

      if (status === 'completed') {
        // Mark total_paid_out on affiliate account
        await db.execute(
          `UPDATE affiliate_accounts
           SET total_paid_out = ROUND(total_paid_out + ?, 2)
           WHERE id = ?`,
          [Number(payout.amount), payout.affiliate_id]
        );
      } else {
        // Failed — return amount to pending_balance
        await db.execute(
          `UPDATE affiliate_accounts
           SET pending_balance = ROUND(pending_balance + ?, 2)
           WHERE id = ?`,
          [Number(payout.amount), payout.affiliate_id]
        );
      }

      if (auditLog) {
        await auditLog(req.user.id, `affiliate.payout.${status}`, 'affiliate_payout', String(payoutId), { amount: payout.amount }, req);
      }

      res.json({ success: true, message: `Výplata ${status === 'completed' ? 'dokončena' : 'zamítnuta'}` });
    })
  );

  /**
   * Overall affiliate program stats
   * GET /api/admin/affiliate/stats
   */
  router.get('/admin/affiliate/stats',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const totalAccounts = await db.queryOne('SELECT COUNT(*) as cnt FROM affiliate_accounts');
      const activeAccounts = await db.queryOne('SELECT COUNT(*) as cnt FROM affiliate_accounts WHERE is_active = 1');
      const totalReferrals = await db.queryOne('SELECT SUM(total_referrals) as cnt FROM affiliate_accounts');
      const totalConversions = await db.queryOne('SELECT SUM(total_conversions) as cnt FROM affiliate_accounts');
      const totalEarnings = await db.queryOne('SELECT SUM(total_earnings) as amount FROM affiliate_accounts');
      const totalPaidOut = await db.queryOne('SELECT SUM(total_paid_out) as amount FROM affiliate_accounts');
      const pendingCommissions = await db.queryOne(
        "SELECT COUNT(*) as cnt, COALESCE(SUM(commission_amount), 0) as amount FROM affiliate_commissions WHERE status = 'pending'"
      );
      const pendingPayouts = await db.queryOne(
        "SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as amount FROM affiliate_payouts WHERE status = 'pending'"
      );

      res.json({
        success: true,
        stats: {
          total_accounts: totalAccounts?.cnt || 0,
          active_accounts: activeAccounts?.cnt || 0,
          total_referrals: Number(totalReferrals?.cnt) || 0,
          total_conversions: Number(totalConversions?.cnt) || 0,
          total_earnings: Number(totalEarnings?.amount) || 0,
          total_paid_out: Number(totalPaidOut?.amount) || 0,
          pending_commissions_count: pendingCommissions?.cnt || 0,
          pending_commissions_amount: Number(pendingCommissions?.amount) || 0,
          pending_payouts_count: pendingPayouts?.cnt || 0,
          pending_payouts_amount: Number(pendingPayouts?.amount) || 0
        }
      });
    })
  );

  return router;
};
