const express = require('express');
const router = express.Router();

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

  // ============================================
  // USER CREDIT ENDPOINTS
  // ============================================

  /**
   * Get current user's credit balance
   * GET /credits/balance
   */
  router.get('/credits/balance',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;

      const user = await db.queryOne(
        'SELECT credit_balance FROM users WHERE id = ?',
        [userId]
      );

      res.json({
        balance: Number(user?.credit_balance) || 0,
        currency: 'CZK'
      });
    })
  );

  /**
   * Get user's credit transaction history
   * GET /credits/history
   */
  router.get('/credits/history',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const { page, limit, offset } = parsePagination(req.query);

      const countResult = await db.query(
        'SELECT COUNT(*) as total FROM account_credits WHERE user_id = ?',
        [userId]
      );
      const total = countResult[0]?.total || 0;

      const transactions = await db.query(
        `SELECT id, amount, balance_after, transaction_type, description, order_id, created_at
         FROM account_credits
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset]
      );

      res.json({
        transactions: transactions || [],
        pagination: paginationMeta(page, limit, total)
      });
    })
  );

  // ============================================
  // ADMIN CREDIT ENDPOINTS
  // ============================================

  /**
   * Admin: Adjust user's credit balance
   * POST /admin/credits/:userId/adjust
   */
  router.post('/admin/credits/:userId/adjust',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const targetUserId = req.params.userId;
      const { amount, description } = req.body || {};

      if (typeof amount !== 'number' || amount === 0) {
        throw new AppError('amount is required and must be a non-zero number', 400);
      }
      if (!description || typeof description !== 'string' || description.trim().length === 0) {
        throw new AppError('description is required', 400);
      }

      // Verify user exists
      const user = await db.queryOne(
        'SELECT id, credit_balance FROM users WHERE id = ?',
        [targetUserId]
      );
      if (!user) {
        throw new AppError('User not found', 404);
      }

      const currentBalance = Number(user.credit_balance) || 0;
      const newBalance = Math.round((currentBalance + amount) * 100) / 100;

      if (newBalance < 0) {
        throw new AppError(`Insufficient balance. Current: ${currentBalance} CZK, adjustment: ${amount} CZK would result in negative balance`, 400);
      }

      // Atomically update user balance — conditional check prevents race conditions
      const updateResult = await db.execute(
        'UPDATE users SET credit_balance = ROUND(credit_balance + ?, 2) WHERE id = ? AND ROUND(credit_balance + ?, 2) >= 0',
        [amount, targetUserId, amount]
      );

      if (updateResult.affectedRows === 0) {
        throw new AppError('Failed to update balance — concurrent modification or insufficient funds', 409);
      }

      // Fetch actual new balance after update
      const updatedUser = await db.queryOne(
        'SELECT credit_balance FROM users WHERE id = ?',
        [targetUserId]
      );
      const actualNewBalance = Number(updatedUser.credit_balance) || 0;

      // Record the transaction
      await db.execute(
        `INSERT INTO account_credits (user_id, amount, balance_after, transaction_type, description, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [targetUserId, amount, actualNewBalance, 'adjustment', description.trim(), req.user.id]
      );

      // Audit log
      if (auditLog) {
        await auditLog(
          req.user.id,
          'credit_adjustment',
          'user',
          targetUserId,
          { amount, new_balance: actualNewBalance, description: description.trim() },
          req
        );
      }

      logger.info('Admin credit adjustment', {
        admin: req.user.id,
        targetUser: targetUserId,
        amount,
        newBalance: actualNewBalance
      });

      res.json({
        success: true,
        balance: actualNewBalance,
        currency: 'CZK'
      });
    })
  );

  /**
   * Admin: View user's credit history
   * GET /admin/credits/:userId
   */
  router.get('/admin/credits/:userId',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const targetUserId = req.params.userId;
      const { page, limit, offset } = parsePagination(req.query);

      // Verify user exists
      const user = await db.queryOne(
        'SELECT id, credit_balance FROM users WHERE id = ?',
        [targetUserId]
      );
      if (!user) {
        throw new AppError('User not found', 404);
      }

      const countResult = await db.query(
        'SELECT COUNT(*) as total FROM account_credits WHERE user_id = ?',
        [targetUserId]
      );
      const total = countResult[0]?.total || 0;

      const transactions = await db.query(
        `SELECT ac.id, ac.amount, ac.balance_after, ac.transaction_type, ac.description,
                ac.order_id, ac.created_by, ac.created_at,
                p.email AS created_by_email
         FROM account_credits ac
         LEFT JOIN profiles p ON p.id = ac.created_by
         WHERE ac.user_id = ?
         ORDER BY ac.created_at DESC
         LIMIT ? OFFSET ?`,
        [targetUserId, limit, offset]
      );

      res.json({
        balance: Number(user.credit_balance) || 0,
        currency: 'CZK',
        transactions: transactions || [],
        pagination: paginationMeta(page, limit, total)
      });
    })
  );

  return router;
};
