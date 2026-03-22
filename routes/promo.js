const express = require('express');
const router = express.Router();

module.exports = function({ db, logger, authenticateUser, requireAdmin }) {
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
   * Core promo code validation logic.
   * Returns { promo, discount_amount, final_price } or throws AppError.
   */
  async function validatePromoCode(code, userId, { plan_id, amount }) {
    // 1. Find code (case-insensitive)
    const promo = await db.queryOne(
      'SELECT * FROM promo_codes WHERE LOWER(code) = LOWER(?) LIMIT 1',
      [code.trim()]
    );

    if (!promo) {
      throw new AppError('Neplatný promo kód', 404);
    }

    // 2. Check is_active
    if (!promo.is_active) {
      throw new AppError('Tento promo kód již není aktivní', 400);
    }

    // 3. Check valid dates
    const now = new Date();
    if (promo.valid_from && new Date(promo.valid_from) > now) {
      throw new AppError('Tento promo kód ještě není platný', 400);
    }
    if (promo.valid_until && new Date(promo.valid_until) < now) {
      throw new AppError('Platnost tohoto promo kódu vypršela', 400);
    }

    // 4. Check max_uses
    if (promo.max_uses !== null && promo.current_uses >= promo.max_uses) {
      throw new AppError('Tento promo kód byl již plně využit', 400);
    }

    // 5. Check per-user limit
    if (userId && promo.per_user_limit !== null) {
      const usageResult = await db.queryOne(
        'SELECT COUNT(*) as cnt FROM promo_code_usage WHERE promo_code_id = ? AND user_id = ?',
        [promo.id, userId]
      );
      if (usageResult && usageResult.cnt >= promo.per_user_limit) {
        throw new AppError('Již jste tento promo kód využil/a maximální počet krát', 400);
      }
    }

    // 6. Check applicable_plans
    if (promo.applicable_plans && plan_id) {
      let plans;
      try {
        plans = typeof promo.applicable_plans === 'string'
          ? JSON.parse(promo.applicable_plans)
          : promo.applicable_plans;
      } catch {
        plans = null;
      }
      if (Array.isArray(plans) && plans.length > 0 && !plans.includes(plan_id)) {
        throw new AppError('Tento promo kód nelze použít pro zvolený plán', 400);
      }
    }

    // 7. Check min_order_amount
    const orderAmount = typeof amount === 'number' ? amount : 0;
    if (promo.min_order_amount && orderAmount < Number(promo.min_order_amount)) {
      throw new AppError(`Minimální částka objednávky pro tento kód je ${promo.min_order_amount} Kč`, 400);
    }

    // 8. Calculate discount
    let discount_amount = 0;
    if (promo.discount_type === 'percent') {
      discount_amount = Math.round(orderAmount * (Number(promo.discount_value) / 100) * 100) / 100;
    } else {
      // fixed
      discount_amount = Math.min(Number(promo.discount_value), orderAmount);
    }

    const final_price = Math.max(0, Math.round((orderAmount - discount_amount) * 100) / 100);

    return { promo, discount_amount, final_price };
  }

  // ============================================
  // PUBLIC: Validate promo code (authenticated)
  // POST /api/promo/validate
  // ============================================

  router.post('/promo/validate',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const { code, plan_id, amount } = req.body || {};

      if (!code || typeof code !== 'string' || code.trim().length === 0) {
        throw new AppError('Promo kód je povinný', 400);
      }

      const { promo, discount_amount, final_price } = await validatePromoCode(
        code, req.user.id, { plan_id, amount: typeof amount === 'number' ? amount : 0 }
      );

      res.json({
        valid: true,
        discount_type: promo.discount_type,
        discount_value: Number(promo.discount_value),
        discount_amount,
        final_price,
        code: promo.code,
        description: promo.description
      });
    })
  );

  // ============================================
  // ADMIN: List all promo codes
  // GET /api/admin/promo
  // ============================================

  router.get('/admin/promo',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { page, limit, offset } = parsePagination(req.query);
      const search = req.query.search ? `%${req.query.search.trim()}%` : null;

      let countQuery, dataQuery, countParams, params;

      if (search) {
        countQuery = 'SELECT COUNT(*) as total FROM promo_codes WHERE code LIKE ? OR description LIKE ?';
        dataQuery = 'SELECT * FROM promo_codes WHERE code LIKE ? OR description LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
        countParams = [search, search];
        params = [search, search, limit, offset];
      } else {
        countQuery = 'SELECT COUNT(*) as total FROM promo_codes';
        dataQuery = 'SELECT * FROM promo_codes ORDER BY created_at DESC LIMIT ? OFFSET ?';
        countParams = [];
        params = [limit, offset];
      }

      const countResult = await db.query(countQuery, countParams);
      const total = countResult[0]?.total || 0;
      const promoCodes = await db.query(dataQuery, params);

      res.json({
        success: true,
        promo_codes: promoCodes || [],
        pagination: paginationMeta(page, limit, total)
      });
    })
  );

  // ============================================
  // ADMIN: Create promo code
  // POST /api/admin/promo
  // ============================================

  router.post('/admin/promo',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const {
        code,
        description,
        discount_type,
        discount_value,
        min_order_amount,
        max_uses,
        per_user_limit,
        valid_from,
        valid_until,
        applicable_plans,
        is_active
      } = req.body || {};

      if (!code || typeof code !== 'string' || code.trim().length === 0) {
        throw new AppError('Kód je povinný', 400);
      }

      if (!discount_type || !['percent', 'fixed'].includes(discount_type)) {
        throw new AppError('Typ slevy musí být "percent" nebo "fixed"', 400);
      }

      if (typeof discount_value !== 'number' || discount_value <= 0) {
        throw new AppError('Hodnota slevy musí být kladné číslo', 400);
      }

      if (discount_type === 'percent' && discount_value > 100) {
        throw new AppError('Procentuální sleva nemůže být větší než 100%', 400);
      }

      // Check uniqueness
      const existing = await db.queryOne(
        'SELECT id FROM promo_codes WHERE LOWER(code) = LOWER(?)',
        [code.trim()]
      );
      if (existing) {
        throw new AppError('Promo kód s tímto názvem již existuje', 409);
      }

      const insertResult = await db.execute(
        `INSERT INTO promo_codes (
           code, description, discount_type, discount_value,
           min_order_amount, max_uses, per_user_limit,
           valid_from, valid_until, applicable_plans,
           is_active, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          code.trim().toUpperCase(),
          description || null,
          discount_type,
          discount_value,
          min_order_amount || 0,
          max_uses !== undefined && max_uses !== null ? max_uses : null,
          per_user_limit !== undefined && per_user_limit !== null ? per_user_limit : 1,
          valid_from || null,
          valid_until || null,
          applicable_plans ? JSON.stringify(applicable_plans) : null,
          is_active !== undefined ? is_active : true,
          req.user.id
        ]
      );

      const promoCode = await db.queryOne(
        'SELECT * FROM promo_codes WHERE id = ?',
        [insertResult.insertId]
      );

      logger.info('Promo code created', { code: code.trim().toUpperCase(), admin: req.user.id });

      res.status(201).json({
        success: true,
        promo_code: promoCode
      });
    })
  );

  // ============================================
  // ADMIN: Update promo code
  // PUT /api/admin/promo/:id
  // ============================================

  router.put('/admin/promo/:id',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const promoId = validateNumericId(req.params.id);

      const existing = await db.queryOne('SELECT * FROM promo_codes WHERE id = ?', [promoId]);
      if (!existing) {
        throw new AppError('Promo kód nenalezen', 404);
      }

      const {
        code,
        description,
        discount_type,
        discount_value,
        min_order_amount,
        max_uses,
        per_user_limit,
        valid_from,
        valid_until,
        applicable_plans,
        is_active
      } = req.body || {};

      const updates = [];
      const values = [];

      if (code !== undefined) {
        // Check uniqueness if code changed
        if (code.trim().toUpperCase() !== existing.code) {
          const dup = await db.queryOne(
            'SELECT id FROM promo_codes WHERE LOWER(code) = LOWER(?) AND id != ?',
            [code.trim(), promoId]
          );
          if (dup) {
            throw new AppError('Promo kód s tímto názvem již existuje', 409);
          }
        }
        updates.push('code = ?');
        values.push(code.trim().toUpperCase());
      }
      if (description !== undefined) {
        updates.push('description = ?');
        values.push(description || null);
      }
      if (discount_type !== undefined) {
        if (!['percent', 'fixed'].includes(discount_type)) {
          throw new AppError('Typ slevy musí být "percent" nebo "fixed"', 400);
        }
        updates.push('discount_type = ?');
        values.push(discount_type);
      }
      if (discount_value !== undefined) {
        if (typeof discount_value !== 'number' || discount_value <= 0) {
          throw new AppError('Hodnota slevy musí být kladné číslo', 400);
        }
        updates.push('discount_value = ?');
        values.push(discount_value);
      }
      if (min_order_amount !== undefined) {
        updates.push('min_order_amount = ?');
        values.push(min_order_amount || 0);
      }
      if (max_uses !== undefined) {
        updates.push('max_uses = ?');
        values.push(max_uses);
      }
      if (per_user_limit !== undefined) {
        updates.push('per_user_limit = ?');
        values.push(per_user_limit);
      }
      if (valid_from !== undefined) {
        updates.push('valid_from = ?');
        values.push(valid_from || null);
      }
      if (valid_until !== undefined) {
        updates.push('valid_until = ?');
        values.push(valid_until || null);
      }
      if (applicable_plans !== undefined) {
        updates.push('applicable_plans = ?');
        values.push(applicable_plans ? JSON.stringify(applicable_plans) : null);
      }
      if (is_active !== undefined) {
        updates.push('is_active = ?');
        values.push(is_active ? 1 : 0);
      }

      if (updates.length === 0) {
        throw new AppError('Žádná pole k aktualizaci', 400);
      }

      values.push(promoId);
      await db.execute(
        `UPDATE promo_codes SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      const updated = await db.queryOne('SELECT * FROM promo_codes WHERE id = ?', [promoId]);

      logger.info('Promo code updated', { promoId, admin: req.user.id });

      res.json({
        success: true,
        promo_code: updated
      });
    })
  );

  // ============================================
  // ADMIN: Soft delete (deactivate) promo code
  // DELETE /api/admin/promo/:id
  // ============================================

  router.delete('/admin/promo/:id',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const promoId = validateNumericId(req.params.id);

      const existing = await db.queryOne('SELECT id FROM promo_codes WHERE id = ?', [promoId]);
      if (!existing) {
        throw new AppError('Promo kód nenalezen', 404);
      }

      await db.execute(
        'UPDATE promo_codes SET is_active = 0 WHERE id = ?',
        [promoId]
      );

      logger.info('Promo code deactivated', { promoId, admin: req.user.id });

      res.json({
        success: true,
        message: 'Promo kód deaktivován'
      });
    })
  );

  // ============================================
  // ADMIN: Get usage history for a promo code
  // GET /api/admin/promo/:id/usage
  // ============================================

  router.get('/admin/promo/:id/usage',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const promoId = validateNumericId(req.params.id);
      const { page, limit, offset } = parsePagination(req.query);

      const existing = await db.queryOne('SELECT id, code FROM promo_codes WHERE id = ?', [promoId]);
      if (!existing) {
        throw new AppError('Promo kód nenalezen', 404);
      }

      const countResult = await db.query(
        'SELECT COUNT(*) as total FROM promo_code_usage WHERE promo_code_id = ?',
        [promoId]
      );
      const total = countResult[0]?.total || 0;

      const usage = await db.query(
        `SELECT u.*, p.email, p.first_name, p.last_name
         FROM promo_code_usage u
         LEFT JOIN profiles p ON p.id = u.user_id
         WHERE u.promo_code_id = ?
         ORDER BY u.used_at DESC
         LIMIT ? OFFSET ?`,
        [promoId, limit, offset]
      );

      res.json({
        success: true,
        promo_code: existing.code,
        usage: usage || [],
        pagination: paginationMeta(page, limit, total)
      });
    })
  );

  return router;
};
