const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');

module.exports = function({ db, logger, hestiacp, authenticateUser }) {
  const { asyncHandler, AppError } = require('../middleware/errorHandler');

  /**
   * SECURITY: Validace že ID parametr je kladné celé číslo
   */
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
  // ORDERS ENDPOINTS
  // ============================================

  /**
   * Create generic order (admin / internal)
   * POST /api/orders
   */
  router.post('/orders',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const {
        plan_id,
        plan_name,
        price,
        currency,
        billing_email,
        billing_name,
        billing_company,
        billing_address,
        billing_phone,
        customer_email,
        customer_name,
        status,
        payment_status,
        domain_name,
        notes
      } = req.body || {};

      if (!plan_id || !plan_name || typeof price !== 'number') {
        throw new AppError('plan_id, plan_name and price are required', 400);
      }

      const insertResult = await db.execute(
        `INSERT INTO user_orders (
           user_id, plan_id, plan_name, price, currency,
           billing_email, billing_name, billing_company, billing_address, billing_phone,
           customer_email, customer_name,
           status, payment_status,
           domain_name, notes
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          plan_id,
          plan_name,
          price,
          currency || 'CZK',
          billing_email || null,
          billing_name || null,
          billing_company || null,
          billing_address || null,
          billing_phone || null,
          customer_email || billing_email || null,
          customer_name || billing_name || null,
          // SECURITY: Non-admin users always get pending/unpaid — prevents free service activation
          (req.user.is_admin && status) ? status : 'pending',
          (req.user.is_admin && payment_status) ? payment_status : 'unpaid',
          domain_name || null,
          notes || null
        ]
      );

      const orderId = insertResult.insertId;

      const order = await db.queryOne(
        'SELECT * FROM user_orders WHERE id = ?',
        [orderId]
      );

      res.status(201).json({
        success: true,
        order
      });
    })
  );

  /**
   * Create hosting order (used by frontend)
   * POST /api/orders/hosting
   * Supports optional promo_code field for discount
   */
  router.post('/orders/hosting',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const {
        planId,
        planName,
        price,
        currency,
        billingEmail,
        billingName,
        billingCompany,
        billingAddress,
        billingPhone,
        domainName,
        promo_code,
        country_code,
        vat_number
      } = req.body || {};

      if (!planId || !planName || typeof price !== 'number') {
        throw new AppError('planId, planName and price are required', 400);
      }

      let finalPrice = price;
      let discountAmount = 0;
      let promoCodeId = null;
      let originalPrice = null;

      // Validate and apply promo code if provided
      if (promo_code && typeof promo_code === 'string' && promo_code.trim().length > 0) {
        const promo = await db.queryOne(
          'SELECT * FROM promo_codes WHERE LOWER(code) = LOWER(?) LIMIT 1',
          [promo_code.trim()]
        );

        if (!promo) {
          throw new AppError('Neplatný promo kód', 400);
        }
        if (!promo.is_active) {
          throw new AppError('Tento promo kód již není aktivní', 400);
        }

        const now = new Date();
        if (promo.valid_from && new Date(promo.valid_from) > now) {
          throw new AppError('Tento promo kód ještě není platný', 400);
        }
        if (promo.valid_until && new Date(promo.valid_until) < now) {
          throw new AppError('Platnost tohoto promo kódu vypršela', 400);
        }
        if (promo.max_uses !== null && promo.current_uses >= promo.max_uses) {
          throw new AppError('Tento promo kód byl již plně využit', 400);
        }

        // Per-user limit check
        if (promo.per_user_limit !== null) {
          const usageResult = await db.queryOne(
            'SELECT COUNT(*) as cnt FROM promo_code_usage WHERE promo_code_id = ? AND user_id = ?',
            [promo.id, userId]
          );
          if (usageResult && usageResult.cnt >= promo.per_user_limit) {
            throw new AppError('Již jste tento promo kód využil/a maximální počet krát', 400);
          }
        }

        // Check applicable_plans
        if (promo.applicable_plans) {
          let plans;
          try {
            plans = typeof promo.applicable_plans === 'string'
              ? JSON.parse(promo.applicable_plans)
              : promo.applicable_plans;
          } catch { plans = null; }
          if (Array.isArray(plans) && plans.length > 0 && !plans.includes(planId)) {
            throw new AppError('Tento promo kód nelze použít pro zvolený plán', 400);
          }
        }

        // Check min_order_amount
        if (promo.min_order_amount && price < Number(promo.min_order_amount)) {
          throw new AppError(`Minimální částka objednávky pro tento kód je ${promo.min_order_amount} Kč`, 400);
        }

        // Calculate discount
        if (promo.discount_type === 'percent') {
          discountAmount = Math.round(price * (Number(promo.discount_value) / 100) * 100) / 100;
        } else {
          discountAmount = Math.min(Number(promo.discount_value), price);
        }

        originalPrice = price;
        finalPrice = Math.max(0, Math.round((price - discountAmount) * 100) / 100);
        promoCodeId = promo.id;
      }

      // ========================================
      // Tax / VAT calculation
      // ========================================
      let taxRate = 0;
      let taxAmount = 0;
      let priceWithoutTax = finalPrice;
      let orderCountryCode = null;
      let orderVatNumber = null;

      if (country_code && typeof country_code === 'string' && country_code.length === 2) {
        orderCountryCode = country_code.toUpperCase();
        orderVatNumber = vat_number && typeof vat_number === 'string' ? vat_number.trim() : null;

        try {
          // Look up tax rate for the country
          const taxRateRow = await db.queryOne(
            `SELECT * FROM tax_rates
             WHERE country_code = ? AND tax_type = 'vat'
               AND effective_from <= CURDATE()
               AND (effective_until IS NULL OR effective_until >= CURDATE())
             ORDER BY effective_from DESC
             LIMIT 1`,
            [orderCountryCode]
          );

          if (taxRateRow && taxRateRow.is_eu) {
            // EU B2B with VAT number → reverse charge (0%)
            let isReverseCharge = false;
            if (orderVatNumber) {
              // Simple format check — strip spaces/dashes, check prefix
              const formatted = orderVatNumber.replace(/[\s\-\.]/g, '').toUpperCase();
              if (formatted.startsWith(orderCountryCode) && formatted.length >= 4) {
                isReverseCharge = true;
              }
            }

            if (!isReverseCharge) {
              // EU B2C or domestic → apply VAT
              taxRate = Number(taxRateRow.tax_rate);
              taxAmount = Math.round(finalPrice * (taxRate / 100) * 100) / 100;
              priceWithoutTax = finalPrice;
              finalPrice = Math.round((finalPrice + taxAmount) * 100) / 100;
            }
          }
          // Non-EU → 0% tax (defaults already set)
        } catch (taxErr) {
          logger.warn('Tax calculation failed, proceeding without tax', { error: taxErr.message });
          // Proceed without tax on error — don't block the order
        }
      }

      // ========================================
      // Credit application
      // ========================================
      let creditsApplied = 0;
      let orderStatus = 'pending';
      let paymentStatus = 'unpaid';

      // Check user's credit balance
      const userRow = await db.queryOne(
        'SELECT credit_balance FROM users WHERE id = ?',
        [userId]
      );
      const creditBalance = Number(userRow?.credit_balance) || 0;

      if (creditBalance > 0 && finalPrice > 0) {
        creditsApplied = Math.min(creditBalance, finalPrice);
        creditsApplied = Math.round(creditsApplied * 100) / 100;

        // If credits cover full amount, mark as paid immediately
        if (creditsApplied >= finalPrice) {
          orderStatus = 'active';
          paymentStatus = 'paid';
        }
      }

      const insertResult = await db.execute(
        `INSERT INTO user_orders (
           user_id, plan_id, plan_name, price, currency,
           billing_email, billing_name, billing_company, billing_address, billing_phone,
           customer_email, customer_name,
           status, payment_status,
           domain_name,
           promo_code_id, discount_amount, original_price, credits_applied,
           tax_rate, tax_amount, country_code, vat_number, price_without_tax
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          planId,
          planName,
          finalPrice,
          currency || 'CZK',
          billingEmail || null,
          billingName || null,
          billingCompany || null,
          billingAddress || null,
          billingPhone || null,
          billingEmail || null,
          billingName || null,
          orderStatus,
          paymentStatus,
          domainName || null,
          promoCodeId,
          discountAmount,
          originalPrice,
          creditsApplied,
          taxRate,
          taxAmount,
          orderCountryCode,
          orderVatNumber,
          priceWithoutTax
        ]
      );

      const orderId = insertResult.insertId;

      // If promo code was applied, increment usage and record it
      if (promoCodeId) {
        await db.execute(
          'UPDATE promo_codes SET current_uses = current_uses + 1 WHERE id = ?',
          [promoCodeId]
        );
        await db.execute(
          'INSERT INTO promo_code_usage (promo_code_id, user_id, order_id, discount_amount) VALUES (?, ?, ?, ?)',
          [promoCodeId, userId, orderId, discountAmount]
        );
      }

      // Deduct credits atomically if any were applied
      if (creditsApplied > 0) {
        const creditUpdate = await db.execute(
          'UPDATE users SET credit_balance = ROUND(credit_balance - ?, 2) WHERE id = ? AND credit_balance >= ?',
          [creditsApplied, userId, creditsApplied]
        );

        if (creditUpdate.affectedRows === 0) {
          // Race condition — credits were spent elsewhere; revert order to unpaid
          await db.execute(
            'UPDATE user_orders SET status = ?, payment_status = ?, credits_applied = 0 WHERE id = ?',
            ['pending', 'unpaid', orderId]
          );
          creditsApplied = 0;
        } else {
          // Record credit transaction
          const updatedUser = await db.queryOne('SELECT credit_balance FROM users WHERE id = ?', [userId]);
          const balanceAfter = Number(updatedUser?.credit_balance) || 0;

          await db.execute(
            `INSERT INTO account_credits (user_id, amount, balance_after, transaction_type, description, order_id)
             VALUES (?, ?, ?, 'payment', ?, ?)`,
            [userId, -creditsApplied, balanceAfter, `Platba za objednávku #${orderId}`, orderId]
          );
        }
      }

      const order = await db.queryOne(
        'SELECT * FROM user_orders WHERE id = ?',
        [orderId]
      );

      // ========================================
      // Affiliate commission tracking
      // ========================================
      if (order && order.payment_status === 'paid') {
        try {
          // Check if the ordering user was referred
          const orderingUser = await db.queryOne(
            'SELECT referred_by FROM users WHERE id = ?',
            [userId]
          );

          if (orderingUser?.referred_by) {
            const affiliate = await db.queryOne(
              'SELECT id, commission_rate FROM affiliate_accounts WHERE referral_code = ? AND is_active = 1',
              [orderingUser.referred_by]
            );

            if (affiliate) {
              const referral = await db.queryOne(
                'SELECT id, converted FROM affiliate_referrals WHERE affiliate_id = ? AND referred_user_id = ?',
                [affiliate.id, userId]
              );

              if (referral) {
                // Mark referral as converted if not already
                if (!referral.converted) {
                  await db.execute(
                    'UPDATE affiliate_referrals SET converted = TRUE, converted_at = NOW() WHERE id = ?',
                    [referral.id]
                  );
                  await db.execute(
                    'UPDATE affiliate_accounts SET total_conversions = total_conversions + 1 WHERE id = ?',
                    [affiliate.id]
                  );
                }

                // Calculate commission on the order amount (before tax)
                const commissionableAmount = Number(order.price_without_tax || order.price) || 0;
                const commissionRate = Number(affiliate.commission_rate);
                const commissionAmount = Math.round(commissionableAmount * (commissionRate / 100) * 100) / 100;

                if (commissionAmount > 0) {
                  // Create commission record (pending admin approval)
                  await db.execute(
                    `INSERT INTO affiliate_commissions (affiliate_id, referral_id, order_id, order_amount, commission_rate, commission_amount, status)
                     VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
                    [affiliate.id, referral.id, orderId, commissionableAmount, commissionRate, commissionAmount]
                  );

                  // Update affiliate account balances
                  await db.execute(
                    `UPDATE affiliate_accounts
                     SET pending_balance = ROUND(pending_balance + ?, 2),
                         total_earnings = ROUND(total_earnings + ?, 2)
                     WHERE id = ?`,
                    [commissionAmount, commissionAmount, affiliate.id]
                  );

                  logger.info('Affiliate commission created', {
                    affiliateId: affiliate.id,
                    orderId,
                    commissionAmount,
                    commissionRate
                  });
                }
              }
            }
          }
        } catch (affErr) {
          // Don't block order response if affiliate tracking fails
          logger.warn('Affiliate commission tracking failed', { error: affErr.message, orderId });
        }
      }

      res.status(201).json({
        success: true,
        order,
        credits_applied: creditsApplied
      });
    })
  );

  /**
   * Get orders (admin: všechny, user: vlastní). Query: ?payment_id= pro vyhledání podle payment_id.
   * GET /api/orders
   */
  router.get('/orders',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const { payment_id: paymentId } = req.query || {};
      const isAdmin = !!req.user.is_admin;
      const { page, limit, offset } = parsePagination(req.query);

      let countQuery, dataQuery, params, countParams;

      if (isAdmin) {
        if (paymentId && typeof paymentId === 'string') {
          countQuery = 'SELECT COUNT(*) as total FROM user_orders WHERE payment_id = ?';
          dataQuery = 'SELECT * FROM user_orders WHERE payment_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
          countParams = [paymentId.trim()];
          params = [paymentId.trim(), limit, offset];
        } else {
          countQuery = 'SELECT COUNT(*) as total FROM user_orders';
          dataQuery = 'SELECT * FROM user_orders ORDER BY created_at DESC LIMIT ? OFFSET ?';
          countParams = [];
          params = [limit, offset];
        }
      } else {
        if (paymentId && typeof paymentId === 'string') {
          countQuery = 'SELECT COUNT(*) as total FROM user_orders WHERE user_id = ? AND payment_id = ?';
          dataQuery = 'SELECT * FROM user_orders WHERE user_id = ? AND payment_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
          countParams = [req.user.id, paymentId.trim()];
          params = [req.user.id, paymentId.trim(), limit, offset];
        } else {
          countQuery = 'SELECT COUNT(*) as total FROM user_orders WHERE user_id = ?';
          dataQuery = 'SELECT * FROM user_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
          countParams = [req.user.id];
          params = [req.user.id, limit, offset];
        }
      }

      const countResult = await db.query(countQuery, countParams);
      const total = countResult[0]?.total || 0;
      const orders = await db.query(dataQuery, params);

      res.json({
        success: true,
        orders: orders || [],
        pagination: paginationMeta(page, limit, total)
      });
    })
  );

  /**
   * Get orders for specific user
   * GET /api/orders/user/:userId
   */
  router.get('/orders/user/:userId',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const targetUserId = req.params.userId;

      if (targetUserId !== req.user.id && !req.user.is_admin) {
        throw new AppError('Forbidden', 403);
      }

      const orders = await db.query(
        'SELECT * FROM user_orders WHERE user_id = ? ORDER BY created_at DESC',
        [targetUserId]
      );

      res.json({
        success: true,
        orders: orders || []
      });
    })
  );

  /**
   * Get single order by ID (used by HestiaCP integration)
   * GET /api/orders/:id
   */
  router.get('/orders/:id',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const orderId = validateNumericId(req.params.id);

      const order = await db.queryOne(
        `SELECT
           o.*,
           p.email AS profile_email,
           p.first_name,
           p.last_name
         FROM user_orders o
         LEFT JOIN profiles p ON p.id = o.user_id
         WHERE o.id = ?`,
        [orderId]
      );

      if (!order) {
        throw new AppError('Order not found', 404);
      }

      // Only owner or admin can see order
      if (order.user_id !== req.user.id && !req.user.is_admin) {
        throw new AppError('Forbidden', 403);
      }

      res.json({
        success: true,
        order: {
          ...order,
          profiles: {
            email: order.profile_email,
            first_name: order.first_name,
            last_name: order.last_name
          }
        }
      });
    })
  );

  /**
   * Generate simple HTML invoice for an order
   * GET /api/orders/:id/invoice
   */
  router.get('/orders/:id/invoice',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const orderId = validateNumericId(req.params.id);

      const order = await db.queryOne('SELECT * FROM user_orders WHERE id = ?', [orderId]);
      if (!order) {
        throw new AppError('Order not found', 404);
      }

      // Only owner or admin can view invoice
      if (order.user_id !== req.user.id && !req.user.is_admin) {
        throw new AppError('Forbidden', 403);
      }

      // PDF invoice generation
      if (req.query.format === 'pdf') {
        const profile = await db.queryOne(
          `SELECT first_name, last_name, company, address, email, ico, dic
           FROM profiles WHERE id = ?`,
          [order.user_id]
        );

        const customerName = profile
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || ''
          : order.billing_name || order.customer_name || '';
        const billingCompany = order.billing_company || profile?.company || customerName;
        const billingAddress = order.billing_address || profile?.address || '';
        const invoiceNumber = order.invoice_number || `INV-${order.id}`;
        const issuedAt = order.invoice_issued_at || order.payment_date || order.created_at;

        const doc = new PDFDocument({ size: 'A4', margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="faktura-${order.id}.pdf"`);
        doc.pipe(res);

        // Header
        doc.fontSize(20).text('Alatyr Hosting', { align: 'center' });
        doc.fontSize(10).text('https://alatyrhosting.eu | info@alatyrhosting.eu', { align: 'center' });
        doc.moveDown(2);

        // Invoice title
        doc.fontSize(16).text(`Faktura ${invoiceNumber}`, { align: 'left' });
        doc.fontSize(10);
        doc.text(`Datum vystaveni: ${issuedAt ? new Date(issuedAt).toLocaleDateString('cs-CZ') : ''}`);
        if (order.payment_date) {
          doc.text(`Datum uhrady: ${new Date(order.payment_date).toLocaleDateString('cs-CZ')}`);
        }
        doc.text(`Stav: ${order.payment_status === 'paid' ? 'Zaplaceno' : 'Nezaplaceno'}`);
        doc.moveDown();

        // Supplier info
        doc.fontSize(12).text('Dodavatel:', { underline: true });
        doc.fontSize(10);
        doc.text('Alatyr Hosting');
        doc.text('Naves 73, 664 08 Blazovice');
        doc.text('Ceska republika');
        doc.text('ICO: 09992961');
        doc.text('Neplatce DPH');
        doc.moveDown();

        // Customer info
        doc.fontSize(12).text('Odberatel:', { underline: true });
        doc.fontSize(10);
        doc.text(billingCompany || customerName || '-');
        if (billingAddress) doc.text(billingAddress);
        if (order.billing_ico || profile?.ico) doc.text(`ICO: ${order.billing_ico || profile?.ico}`);
        if (order.billing_dic || profile?.dic) doc.text(`DIC: ${order.billing_dic || profile?.dic}`);
        if (profile?.email) doc.text(profile.email);
        doc.moveDown();

        // Line separator
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown();

        // Items table header
        doc.fontSize(10).font('Helvetica-Bold');
        const tableTop = doc.y;
        doc.text('Polozka', 50, tableTop, { width: 250 });
        doc.text('Mnozstvi', 300, tableTop, { width: 100 });
        doc.text('Cena', 450, tableTop, { width: 95, align: 'right' });
        doc.moveDown();

        // Line separator
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);

        // Item row
        doc.font('Helvetica');
        const itemY = doc.y;
        const planName = order.plan_name || order.description || 'Hostingova sluzba';
        const domainSuffix = order.domain_name ? ` (${order.domain_name})` : '';
        const amount = Number(order.price) || 0;
        const currency = order.currency || 'CZK';
        const originalPrice = Number(order.original_price) || amount;

        doc.text(`${planName}${domainSuffix}`, 50, itemY, { width: 250 });
        doc.text('1', 300, itemY, { width: 100 });
        doc.text(`${originalPrice} ${currency}`, 450, itemY, { width: 95, align: 'right' });

        // Discount row (if applicable)
        const discountAmount = Number(order.discount_amount) || 0;
        if (discountAmount > 0) {
          doc.moveDown();
          const discY = doc.y;
          doc.text('Sleva (promo kod)', 50, discY, { width: 250 });
          doc.text(`-${discountAmount} ${currency}`, 450, discY, { width: 95, align: 'right' });
        }

        doc.moveDown(2);

        // Total
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').fontSize(12);
        doc.text(`Celkem k uhrade: ${amount} ${currency}`, { align: 'right' });

        // Payment info
        doc.moveDown(2);
        doc.font('Helvetica').fontSize(9);
        if (order.payment_provider) {
          doc.text('Platebni metoda: ' + order.payment_provider);
        }
        if (order.payment_id) {
          doc.text('ID platby: ' + order.payment_id);
        }

        // Footer
        doc.moveDown(3);
        doc.fontSize(8).fillColor('#666');
        doc.text('Alatyr Hosting | info@alatyrhosting.eu | https://alatyrhosting.eu', { align: 'center' });
        doc.text('Tento doklad je generovan automaticky.', { align: 'center' });

        doc.end();
        return;
      }

      const profile = await db.queryOne(
        `SELECT first_name, last_name, company, address, email, ico, dic
         FROM profiles
         WHERE id = ?`,
        [order.user_id]
      );

      const invoiceNumber = order.invoice_number || `INV-${order.id}`;
      const issuedAt = order.invoice_issued_at || order.payment_date || order.created_at;

      const customerName = profile
        ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || ''
        : order.billing_name || order.customer_name || '';

      const billingCompany = order.billing_company || profile?.company || customerName;
      const billingAddress = order.billing_address || profile?.address || '';
      const billingIco = order.billing_ico || profile?.ico || '';
      const billingDic = order.billing_dic || profile?.dic || '';

      const amount = Number(order.price) || 0;
      const currency = order.currency || 'CZK';
      const paymentDate = order.payment_date ? new Date(order.payment_date).toLocaleDateString('cs-CZ') : '';

      // SECURITY: Escape HTML entities to prevent XSS in invoice
      const esc = (str) => {
        if (typeof str !== 'string') return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      };

      const html = `<!DOCTYPE html>
<html lang="cs">
  <head>
    <meta charset="utf-8" />
    <title>Faktura ${esc(invoiceNumber)}</title>
    <style>
      body { font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; margin: 40px; color: #111827; font-size: 14px; }
      .invoice-header { display: flex; justify-content: space-between; margin-bottom: 32px; border-bottom: 2px solid #111827; padding-bottom: 16px; }
      .invoice-title { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
      .muted { color: #6b7280; font-size: 13px; }
      .section { margin-bottom: 24px; }
      .section-title { font-weight: 600; margin-bottom: 8px; font-size: 15px; }
      .parties { display: flex; gap: 40px; margin-bottom: 32px; }
      .party { flex: 1; }
      .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 18px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { padding: 10px 8px; text-align: left; font-size: 14px; }
      th { border-bottom: 2px solid #d1d5db; font-weight: 600; background: #f9fafb; }
      td { border-bottom: 1px solid #f3f4f6; }
      tfoot td { border-top: 2px solid #111827; font-weight: 700; font-size: 16px; border-bottom: none; }
      .text-right { text-align: right; }
      .print-btn { display: inline-block; padding: 8px 20px; background: #111827; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; margin-top: 24px; }
      .print-btn:hover { background: #374151; }
      @media print { .no-print { display: none !important; } body { margin: 20px; } }
    </style>
  </head>
  <body>
    <div class="invoice-header">
      <div>
        <div class="invoice-title">Faktura</div>
        <div class="muted">Číslo: ${esc(invoiceNumber)}</div>
        <div class="muted">Datum vystavení: ${issuedAt ? esc(new Date(issuedAt).toLocaleDateString('cs-CZ')) : ''}</div>
        ${paymentDate ? `<div class="muted">Datum úhrady: ${esc(paymentDate)}</div>` : ''}
      </div>
      <div style="text-align:right">
        <div><strong>Alatyr Hosting</strong></div>
        <div class="muted">Dodavatel</div>
        <div class="muted">Náves 73</div>
        <div class="muted">664 08 Blažovice</div>
        <div class="muted">Česká republika</div>
        <div class="muted">ID: 09992961</div>
        <div class="muted">info@alatyrhosting.eu</div>
        <div class="muted">Non-VAT payer</div>
      </div>
    </div>

    <div class="parties">
      <div class="party">
        <div class="section-title">Dodavatel</div>
        <div class="box">
          <div><strong>Alatyr Hosting</strong></div>
          <div>Náves 73</div>
          <div>664 08 Blažovice</div>
          <div>Česká republika</div>
          <div class="muted">ID: 09992961</div>
          <div class="muted">info@alatyrhosting.eu</div>
          <div class="muted">Non-VAT payer</div>
        </div>
      </div>
      <div class="party">
        <div class="section-title">Odběratel</div>
        <div class="box">
          <div><strong>${esc(billingCompany || customerName || '-')}</strong></div>
          ${billingAddress ? `<div>${esc(billingAddress)}</div>` : ''}
          ${billingIco ? `<div class="muted">IČO: ${esc(billingIco)}</div>` : ''}
          ${billingDic ? `<div class="muted">DIČ: ${esc(billingDic)}</div>` : ''}
          ${profile?.email ? `<div class="muted">${esc(profile.email)}</div>` : ''}
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Položky</div>
      <table>
        <thead>
          <tr>
            <th>Položka</th>
            <th class="text-right">Množství</th>
            <th class="text-right">Cena</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${esc(order.plan_name || 'Hostingová služba')}${order.domain_name ? ` (${esc(order.domain_name)})` : ''}</td>
            <td class="text-right">1</td>
            <td class="text-right">${esc(amount.toLocaleString('cs-CZ', { style: 'currency', currency }))}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td>Celkem k úhradě</td>
            <td></td>
            <td class="text-right">${esc(amount.toLocaleString('cs-CZ', { style: 'currency', currency }))}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <p class="muted">
      Tato faktura byla vygenerována automaticky systémem Alatyr Hosting.
    </p>

    <div class="no-print" style="text-align:center">
      <button class="print-btn" onclick="window.print()">Vytisknout / Uložit jako PDF</button>
    </div>
  </body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    })
  );

  /**
   * Update order (status, payment_status)
   * PUT /api/orders/:id
   * body: { status?, payment_status? }
   */
  router.put('/orders/:id',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const orderId = validateNumericId(req.params.id);
      const { status, payment_status, gopay_status } = req.body || {};

      const order = await db.queryOne('SELECT id, user_id FROM user_orders WHERE id = ?', [orderId]);
      if (!order) throw new AppError('Order not found', 404);

      const isAdmin = !!req.user.is_admin;

      if (order.user_id !== req.user.id && !isAdmin) {
        throw new AppError('Forbidden', 403);
      }

      const updates = [];
      const values = [];
      const validStatus = ['pending', 'processing', 'active', 'cancelled', 'expired'];
      const validPaymentStatus = ['unpaid', 'paid', 'refunded', 'failed'];

      // SECURITY: status, payment_status a gopay_status může měnit POUZE admin
      if (status && validStatus.includes(status)) {
        if (!isAdmin) throw new AppError('Only admins can update order status', 403);
        updates.push('status = ?');
        values.push(status);
      }
      if (payment_status !== undefined && validPaymentStatus.includes(payment_status)) {
        if (!isAdmin) throw new AppError('Only admins can update payment status', 403);
        updates.push('payment_status = ?');
        values.push(payment_status);
      }
      if (gopay_status !== undefined && typeof gopay_status === 'string') {
        if (!isAdmin) throw new AppError('Only admins can update GoPay status', 403);
        updates.push('gopay_status = ?');
        values.push(gopay_status.trim());
      }
      // SECURITY: payment_id a payment_url může nastavit jen admin
      const { payment_id, payment_url } = req.body || {};
      if (payment_id !== undefined && typeof payment_id === 'string') {
        if (!isAdmin) throw new AppError('Only admins can update payment ID', 403);
        updates.push('payment_id = ?');
        values.push(payment_id.trim());
      }
      if (payment_url !== undefined && typeof payment_url === 'string') {
        if (!isAdmin) throw new AppError('Only admins can update payment URL', 403);
        if (payment_url.trim() && !/^https?:\/\//i.test(payment_url.trim())) {
          throw new AppError('Invalid payment URL', 400);
        }
        updates.push('payment_url = ?');
        values.push(payment_url.trim());
      }
      if (updates.length === 0) throw new AppError('No valid fields to update', 400);
      values.push(orderId);
      await db.execute(
        `UPDATE user_orders SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        values
      );

      const updated = await db.queryOne('SELECT * FROM user_orders WHERE id = ?', [orderId]);
      res.json({ success: true, order: updated });
    })
  );

  return router;
};
