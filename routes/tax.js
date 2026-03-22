const express = require('express');
const router = express.Router();

/**
 * VAT number format validation patterns per EU country
 */
const vatPatterns = {
  'CZ': /^CZ\d{8,10}$/,
  'SK': /^SK\d{10}$/,
  'DE': /^DE\d{9}$/,
  'AT': /^ATU\d{8}$/,
  'PL': /^PL\d{10}$/,
  'HU': /^HU\d{8}$/,
  'FR': /^FR[A-Z0-9]{2}\d{9}$/,
  'IT': /^IT\d{11}$/,
  'ES': /^ES[A-Z0-9]\d{7}[A-Z0-9]$/,
  'NL': /^NL\d{9}B\d{2}$/,
  'BE': /^BE[01]\d{9}$/,
  'PT': /^PT\d{9}$/,
  'SE': /^SE\d{12}$/,
  'DK': /^DK\d{8}$/,
  'FI': /^FI\d{8}$/,
  'IE': /^IE\d{7}[A-Z]{1,2}$|^IE\d[A-Z]\d{5}[A-Z]$/,
  'RO': /^RO\d{2,10}$/,
  'BG': /^BG\d{9,10}$/,
  'HR': /^HR\d{11}$/,
  'SI': /^SI\d{8}$/,
  'LT': /^LT(\d{9}|\d{12})$/,
  'LV': /^LV\d{11}$/,
  'EE': /^EE\d{9}$/,
  'LU': /^LU\d{8}$/,
  'MT': /^MT\d{8}$/,
  'CY': /^CY\d{8}[A-Z]$/,
  'EL': /^EL\d{9}$/,
};

module.exports = function({ db, logger, authenticateUser, requireAdmin }) {
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

  /**
   * Format and validate a VAT number
   * @param {string} vatNumber - Raw VAT number input
   * @param {string} countryCode - Two-letter country code
   * @returns {{ valid: boolean, formatted_number: string }}
   */
  function validateVatFormat(vatNumber, countryCode) {
    if (!vatNumber || !countryCode) {
      return { valid: false, formatted_number: '' };
    }

    // Strip spaces, dashes, dots
    let formatted = vatNumber.replace(/[\s\-\.]/g, '').toUpperCase();

    // If user didn't include country prefix, add it
    const cc = countryCode.toUpperCase();
    if (!formatted.startsWith(cc)) {
      formatted = cc + formatted;
    }

    const pattern = vatPatterns[cc];
    if (!pattern) {
      // Unknown country — accept any format but flag as unvalidated
      return { valid: formatted.length >= 4, formatted_number: formatted };
    }

    return {
      valid: pattern.test(formatted),
      formatted_number: formatted,
    };
  }

  /**
   * Core tax calculation logic (used by both the endpoint and orders)
   * Rules:
   *   1. Domestic (CZ) → apply 21% VAT
   *   2. EU B2B with valid VAT number → reverse charge (0% VAT)
   *   3. EU B2C (no valid VAT number) → destination country VAT rate
   *   4. Non-EU → no VAT (0%)
   */
  async function calculateTaxForOrder(amount, countryCode, vatNumber) {
    const cc = (countryCode || 'CZ').toUpperCase();

    // Look up the tax rate for the country
    const taxRate = await db.queryOne(
      `SELECT * FROM tax_rates
       WHERE country_code = ? AND tax_type = 'vat'
         AND effective_from <= CURDATE()
         AND (effective_until IS NULL OR effective_until >= CURDATE())
       ORDER BY effective_from DESC
       LIMIT 1`,
      [cc]
    );

    // Non-EU country — no VAT
    if (!taxRate || !taxRate.is_eu) {
      return {
        price_without_tax: amount,
        tax_rate: 0,
        tax_amount: 0,
        total_price: amount,
        reverse_charge: false,
      };
    }

    // EU B2B with valid VAT number → reverse charge (0% VAT)
    if (vatNumber) {
      const validation = validateVatFormat(vatNumber, cc);
      if (validation.valid) {
        return {
          price_without_tax: amount,
          tax_rate: 0,
          tax_amount: 0,
          total_price: amount,
          reverse_charge: true,
        };
      }
    }

    // Domestic (CZ) or EU B2C → apply VAT
    const rate = Number(taxRate.tax_rate);
    const taxAmount = Math.round(amount * (rate / 100) * 100) / 100;

    return {
      price_without_tax: amount,
      tax_rate: rate,
      tax_amount: taxAmount,
      total_price: Math.round((amount + taxAmount) * 100) / 100,
      reverse_charge: false,
    };
  }

  // ============================================
  // PUBLIC ENDPOINTS
  // ============================================

  /**
   * GET /api/tax/rates — get all active tax rates (public, for checkout display)
   */
  router.get('/tax/rates',
    asyncHandler(async (req, res) => {
      const rates = await db.query(
        `SELECT id, country_code, country_name, tax_rate, tax_type, is_eu
         FROM tax_rates
         WHERE effective_from <= CURDATE()
           AND (effective_until IS NULL OR effective_until >= CURDATE())
         ORDER BY country_name ASC`
      );

      res.json({
        success: true,
        rates: rates || [],
      });
    })
  );

  // ============================================
  // AUTHENTICATED ENDPOINTS
  // ============================================

  /**
   * POST /api/tax/calculate — calculate tax for an order
   * Body: { amount, country_code, vat_number? }
   */
  router.post('/tax/calculate',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const { amount, country_code, vat_number } = req.body || {};

      if (typeof amount !== 'number' || amount < 0) {
        throw new AppError('amount must be a non-negative number', 400);
      }
      if (!country_code || typeof country_code !== 'string' || country_code.length !== 2) {
        throw new AppError('country_code must be a 2-letter code', 400);
      }

      const result = await calculateTaxForOrder(amount, country_code, vat_number);

      res.json({
        success: true,
        ...result,
      });
    })
  );

  /**
   * POST /api/tax/validate-vat — validate EU VAT number format
   * Body: { vat_number, country_code }
   */
  router.post('/tax/validate-vat',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const { vat_number, country_code } = req.body || {};

      if (!vat_number || typeof vat_number !== 'string') {
        throw new AppError('vat_number is required', 400);
      }
      if (!country_code || typeof country_code !== 'string' || country_code.length !== 2) {
        throw new AppError('country_code must be a 2-letter code', 400);
      }

      const result = validateVatFormat(vat_number, country_code);

      res.json({
        success: true,
        valid: result.valid,
        formatted_number: result.formatted_number,
      });
    })
  );

  // ============================================
  // ADMIN ENDPOINTS
  // ============================================

  /**
   * GET /api/admin/tax/rates — list all tax rates (admin)
   */
  router.get('/admin/tax/rates',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const rates = await db.query(
        `SELECT * FROM tax_rates ORDER BY country_name ASC`
      );

      res.json({
        success: true,
        rates: rates || [],
      });
    })
  );

  /**
   * POST /api/admin/tax/rates — add a new tax rate (admin)
   * Body: { country_code, country_name, tax_rate, tax_type?, is_eu?, is_default?, effective_from?, effective_until? }
   */
  router.post('/admin/tax/rates',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const {
        country_code,
        country_name,
        tax_rate,
        tax_type = 'vat',
        is_eu = false,
        is_default = false,
        effective_from = '2024-01-01',
        effective_until = null,
      } = req.body || {};

      if (!country_code || country_code.length !== 2) {
        throw new AppError('country_code must be a 2-letter code', 400);
      }
      if (!country_name) {
        throw new AppError('country_name is required', 400);
      }
      if (typeof tax_rate !== 'number' || tax_rate < 0 || tax_rate > 100) {
        throw new AppError('tax_rate must be a number between 0 and 100', 400);
      }
      if (!['vat', 'sales_tax', 'gst'].includes(tax_type)) {
        throw new AppError('tax_type must be vat, sales_tax, or gst', 400);
      }

      const result = await db.execute(
        `INSERT INTO tax_rates (country_code, country_name, tax_rate, tax_type, is_eu, is_default, effective_from, effective_until)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          country_code.toUpperCase(),
          country_name,
          tax_rate,
          tax_type,
          is_eu ? 1 : 0,
          is_default ? 1 : 0,
          effective_from,
          effective_until,
        ]
      );

      const newRate = await db.queryOne('SELECT * FROM tax_rates WHERE id = ?', [result.insertId]);

      logger.info('Admin created tax rate', { id: result.insertId, country_code });

      res.status(201).json({
        success: true,
        rate: newRate,
      });
    })
  );

  /**
   * PUT /api/admin/tax/rates/:id — update a tax rate (admin)
   * Body: { country_name?, tax_rate?, tax_type?, is_eu?, is_default?, effective_from?, effective_until? }
   */
  router.put('/admin/tax/rates/:id',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const rateId = validateNumericId(req.params.id);

      const existing = await db.queryOne('SELECT * FROM tax_rates WHERE id = ?', [rateId]);
      if (!existing) {
        throw new AppError('Tax rate not found', 404);
      }

      const {
        country_name,
        tax_rate,
        tax_type,
        is_eu,
        is_default,
        effective_from,
        effective_until,
      } = req.body || {};

      const updates = [];
      const values = [];

      if (country_name !== undefined) {
        updates.push('country_name = ?');
        values.push(country_name);
      }
      if (tax_rate !== undefined) {
        if (typeof tax_rate !== 'number' || tax_rate < 0 || tax_rate > 100) {
          throw new AppError('tax_rate must be a number between 0 and 100', 400);
        }
        updates.push('tax_rate = ?');
        values.push(tax_rate);
      }
      if (tax_type !== undefined) {
        if (!['vat', 'sales_tax', 'gst'].includes(tax_type)) {
          throw new AppError('tax_type must be vat, sales_tax, or gst', 400);
        }
        updates.push('tax_type = ?');
        values.push(tax_type);
      }
      if (is_eu !== undefined) {
        updates.push('is_eu = ?');
        values.push(is_eu ? 1 : 0);
      }
      if (is_default !== undefined) {
        updates.push('is_default = ?');
        values.push(is_default ? 1 : 0);
      }
      if (effective_from !== undefined) {
        updates.push('effective_from = ?');
        values.push(effective_from);
      }
      if (effective_until !== undefined) {
        updates.push('effective_until = ?');
        values.push(effective_until);
      }

      if (updates.length === 0) {
        throw new AppError('No valid fields to update', 400);
      }

      values.push(rateId);
      await db.execute(
        `UPDATE tax_rates SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      const updated = await db.queryOne('SELECT * FROM tax_rates WHERE id = ?', [rateId]);

      logger.info('Admin updated tax rate', { id: rateId });

      res.json({
        success: true,
        rate: updated,
      });
    })
  );

  // Export the calculation function so orders.js can use it
  router._calculateTaxForOrder = calculateTaxForOrder;
  router._validateVatFormat = validateVatFormat;

  return router;
};
