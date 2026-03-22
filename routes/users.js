const express = require('express');
const router = express.Router();

module.exports = function({ db, logger, auditLog, authenticateUser, requireAdmin, parsePagination, paginationMeta }) {
  const { asyncHandler, AppError } = require('../middleware/errorHandler');

  /**
   * Admin: get list of all users with basic stats
   * GET /admin/users
   */
  router.get('/admin/users',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const { page, limit, offset } = parsePagination(req.query);

      const countResult = await db.query('SELECT COUNT(*) as total FROM users');
      const total = countResult[0]?.total || 0;

      const rows = await db.query(
        `SELECT
           u.id, u.email, u.email_verified, u.created_at, u.last_login,
           u.failed_logins, u.locked_until, p.first_name, p.last_name, p.is_admin
         FROM users u LEFT JOIN profiles p ON p.id = u.id
         ORDER BY u.created_at DESC LIMIT ? OFFSET ?`, [limit, offset]
      );

      const users = (rows || []).map(row => ({
        id: row.id,
        email: row.email,
        first_name: row.first_name || '',
        last_name: row.last_name || '',
        is_admin: !!row.is_admin,
        email_verified: !!row.email_verified,
        created_at: row.created_at,
        last_login: row.last_login,
        failed_logins: typeof row.failed_logins === 'number' ? row.failed_logins : 0,
        locked_until: row.locked_until || null,
      }));

      res.json({
        success: true,
        users,
        pagination: paginationMeta(page, limit, total)
      });
    })
  );

  /**
   * Admin: unlock user account (reset failed_logins and locked_until)
   * POST /admin/users/:userId/unlock
   */
  router.post('/admin/users/:userId/unlock',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const targetUserId = req.params.userId;

      await db.execute(
        'UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?',
        [targetUserId]
      );

      await auditLog(req.user.id, 'admin.unlock_user', 'user', targetUserId, null, req);

      res.json({
        success: true,
        message: 'Uzivatelsky ucet byl odemknut.',
      });
    })
  );

  /**
   * Get profile for specific user
   * GET /profile/:userId
   * - user can load own profile
   * - admin can load any profile
   */
  router.get('/profile/:userId',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const targetUserId = req.params.userId;

      if (req.user.id !== targetUserId && !req.user.is_admin) {
        throw new AppError('Forbidden', 403);
      }

      const profile = await db.queryOne(
        `SELECT
           p.id,
           p.email,
           p.first_name,
           p.last_name,
           p.is_admin,
           p.avatar_url,
           p.phone,
           p.company,
           p.address,
           p.ico,
           p.dic,
           p.created_at,
           p.updated_at,
           p.last_login,
           u.email_verified
         FROM profiles p
         LEFT JOIN users u ON u.id = p.id
         WHERE p.id = ?`,
        [targetUserId]
      );

      if (!profile) {
        throw new AppError('Profile not found', 404);
      }

      res.json({
        success: true,
        profile: {
          id: profile.id,
          email: profile.email,
          first_name: profile.first_name,
          last_name: profile.last_name,
          is_admin: !!profile.is_admin,
          avatar_url: profile.avatar_url,
          phone: profile.phone,
          company: profile.company,
          address: profile.address || '',
          ico: profile.ico || '',
          dic: profile.dic || '',
          created_at: profile.created_at,
          updated_at: profile.updated_at,
          last_login: profile.last_login,
          email_verified: !!profile.email_verified
        }
      });
    })
  );

  /**
   * Admin: update user role / profile
   * PUT /profile/:userId  { is_admin?: boolean }
   */
  router.put('/profile/:userId',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const targetUserId = req.params.userId;
      const { is_admin } = req.body;

      if (typeof is_admin !== 'boolean') {
        throw new AppError('is_admin must be boolean', 400);
      }

      await db.execute(
        'UPDATE profiles SET is_admin = ?, updated_at = NOW() WHERE id = ?',
        [is_admin ? 1 : 0, targetUserId]
      );

      await auditLog(req.user.id, 'admin.toggle_role', 'user', targetUserId, { is_admin }, req);

      const updated = await db.queryOne(
        `SELECT
           p.id,
           p.email,
           p.first_name,
           p.last_name,
           p.is_admin,
           p.avatar_url,
           p.phone,
           p.company,
           p.address,
           p.ico,
           p.dic,
           p.created_at,
           p.updated_at,
           p.last_login,
           u.email_verified
         FROM profiles p
         LEFT JOIN users u ON u.id = p.id
         WHERE p.id = ?`,
        [targetUserId]
      );

      res.json({
        success: true,
        profile: {
          id: updated.id,
          email: updated.email,
          first_name: updated.first_name,
          last_name: updated.last_name,
          is_admin: !!updated.is_admin,
          avatar_url: updated.avatar_url,
          phone: updated.phone,
          company: updated.company,
          address: updated.address || '',
          ico: updated.ico || '',
          dic: updated.dic || '',
          created_at: updated.created_at,
          updated_at: updated.updated_at,
          last_login: updated.last_login,
          email_verified: !!updated.email_verified
        }
      });
    })
  );

  /**
   * User: update own profile
   * PUT /profile
   */
  router.put('/profile',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const { userId, firstName, lastName, phone, company, avatarUrl, newsletter, address, ico, dic } = req.body || {};
      const targetUserId = userId || req.user.id;

      if (targetUserId !== req.user.id) {
        // Only admins may update other users; keep it simple for now (deny)
        throw new AppError('Forbidden', 403);
      }

      const fields = [];
      const values = [];

      if (typeof firstName === 'string') {
        fields.push('first_name = ?');
        values.push(firstName);
      }
      if (typeof lastName === 'string') {
        fields.push('last_name = ?');
        values.push(lastName);
      }
      if (typeof phone === 'string') {
        fields.push('phone = ?');
        values.push(phone);
      }
      if (typeof company === 'string') {
        fields.push('company = ?');
        values.push(company);
      }
      if (typeof address === 'string') {
        fields.push('address = ?');
        values.push(address);
      }
      if (typeof ico === 'string') {
        fields.push('ico = ?');
        values.push(ico.trim());
      }
      if (typeof dic === 'string') {
        fields.push('dic = ?');
        values.push(dic.trim());
      }
      if (typeof avatarUrl === 'string') {
        // SECURITY: Validace avatar URL - povoleny jen http(s) protokoly
        const trimmedAvatarUrl = avatarUrl.trim();
        if (trimmedAvatarUrl && !/^https?:\/\//i.test(trimmedAvatarUrl)) {
          throw new AppError('Avatar URL must start with http:// or https://', 400);
        }
        fields.push('avatar_url = ?');
        values.push(trimmedAvatarUrl);
      }
      if (typeof newsletter === 'boolean') {
        fields.push('newsletter_subscription = ?');
        values.push(newsletter ? 1 : 0);
      }

      if (fields.length === 0) {
        throw new AppError('No valid fields to update', 400);
      }

      fields.push('updated_at = NOW()');

      const updateQuery = `
        UPDATE profiles
        SET ${fields.join(', ')}
        WHERE id = ?
      `;
      values.push(targetUserId);

      await db.execute(updateQuery, values);

      const updated = await db.queryOne(
        `SELECT
           p.id,
           p.email,
           p.first_name,
           p.last_name,
           p.is_admin,
           p.avatar_url,
           p.phone,
           p.company,
           p.address,
           p.ico,
           p.dic,
           p.created_at,
           p.updated_at,
           p.last_login,
           u.email_verified
         FROM profiles p
         LEFT JOIN users u ON u.id = p.id
         WHERE p.id = ?`,
        [targetUserId]
      );

      res.json({
        success: true,
        profile: {
          id: updated.id,
          email: updated.email,
          first_name: updated.first_name,
          last_name: updated.last_name,
          is_admin: !!updated.is_admin,
          avatar_url: updated.avatar_url,
          phone: updated.phone,
          company: updated.company,
          address: updated.address || '',
          ico: updated.ico || '',
          dic: updated.dic || '',
          created_at: updated.created_at,
          updated_at: updated.updated_at,
          last_login: updated.last_login,
          email_verified: !!updated.email_verified
        }
      });
    })
  );

  /**
   * GET /profile/activity — get current user's activity log
   */
  router.get('/profile/activity',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 20, 50);
      const offset = (page - 1) * limit;

      const total = await db.queryOne(
        'SELECT COUNT(*) as total FROM audit_log WHERE user_id = ?',
        [req.user.id]
      );

      const activities = await db.query(
        'SELECT action, target_type, target_id, ip_address, created_at FROM audit_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [req.user.id, limit, offset]
      );

      // Map action names to Czech labels
      const actionLabels = {
        'login': 'Přihlášení',
        'logout': 'Odhlášení',
        'password.change': 'Změna hesla',
        'mfa.enable': 'Aktivace 2FA',
        'mfa.disable': 'Deaktivace 2FA',
        'order.create': 'Vytvoření objednávky',
        'order.pay': 'Platba objednávky',
        'ticket.create': 'Vytvoření ticketu',
        'ticket.reply': 'Odpověď na ticket',
        'service.renew': 'Obnovení služby',
        'profile.update': 'Úprava profilu',
        'affiliate.join': 'Připojení k affiliate',
        'affiliate.payout': 'Výplata affiliate',
        'promo.use': 'Použití promo kódu'
      };

      const mapped = activities.map(a => ({
        ...a,
        action_label: actionLabels[a.action] || a.action,
        created_at: a.created_at
      }));

      res.json({
        success: true,
        activities: mapped,
        pagination: { page, limit, total: total?.total || 0, pages: Math.ceil((total?.total || 0) / limit) }
      });
    })
  );

  return router;
};
