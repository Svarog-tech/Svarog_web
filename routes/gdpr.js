const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

module.exports = function({ db, logger, hestiacp, authenticateUser }) {
  const { asyncHandler, AppError } = require('../middleware/errorHandler');

  // ============================================
  // GET /account/export — Export all user data as JSON (GDPR)
  // ============================================
  router.get('/account/export',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;

      logger.info('GDPR data export requested', { userId });

      // Collect all user data
      const [
        profile,
        orders,
        hostingServices,
        tickets,
        ticketMessages,
        alerts,
        credits,
        creditTransactions,
        affiliateData,
        activityLog
      ] = await Promise.all([
        db.queryOne('SELECT id, email, first_name, last_name, company, phone, address, city, zip, country, avatar_url, language, created_at, updated_at FROM profiles WHERE id = ?', [userId]),
        db.query('SELECT id, plan_name, plan_id, price, currency, status, payment_status, payment_provider, domain_name, billing_email, billing_name, billing_company, billing_address, created_at, updated_at FROM user_orders WHERE user_id = ?', [userId]),
        db.query('SELECT id, plan_name, plan_id, status, price, billing_period, hestia_domain, activated_at, expires_at, created_at FROM user_hosting_services WHERE user_id = ?', [userId]),
        db.query('SELECT id, subject, status, priority, category, created_at, updated_at FROM tickets WHERE user_id = ?', [userId]),
        db.query('SELECT tm.id, tm.ticket_id, tm.message, tm.is_admin, tm.created_at FROM ticket_messages tm INNER JOIN tickets t ON t.id = tm.ticket_id WHERE t.user_id = ?', [userId]),
        db.query('SELECT id, type, title, message, is_read, created_at FROM alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', [userId]),
        db.queryOne('SELECT balance, total_earned, total_spent, updated_at FROM user_credits WHERE user_id = ?', [userId]),
        db.query('SELECT id, type, amount, description, created_at FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 200', [userId]),
        db.queryOne('SELECT referral_code, total_referrals, total_earnings, status, created_at FROM affiliates WHERE user_id = ?', [userId]),
        db.query('SELECT action, target_type, target_id, ip_address, created_at FROM audit_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 200', [userId])
      ]);

      const exportData = {
        exported_at: new Date().toISOString(),
        user: {
          profile: profile || null,
          orders: orders || [],
          hosting_services: hostingServices || [],
          tickets: tickets || [],
          ticket_messages: ticketMessages || [],
          alerts: alerts || [],
          credits: credits || null,
          credit_transactions: creditTransactions || [],
          affiliate: affiliateData || null,
          activity_log: activityLog || []
        }
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="gdpr-export-${userId}-${Date.now()}.json"`);
      res.json(exportData);
    })
  );

  // ============================================
  // DELETE /account — Request account deletion (GDPR)
  // ============================================
  router.delete('/account',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const { password } = req.body;

      if (!password) {
        throw new AppError('Password is required to delete account', 400);
      }

      // 1. Verify password
      const user = await db.queryOne(
        'SELECT id, email, password_hash FROM users WHERE id = ?',
        [userId]
      );

      if (!user || !user.password_hash) {
        throw new AppError('Account not found or OAuth account (use provider to manage)', 400);
      }

      const passwordValid = await bcrypt.compare(password, user.password_hash);
      if (!passwordValid) {
        throw new AppError('Invalid password', 403);
      }

      logger.info('Account deletion requested', { userId, email: user.email });

      // 2. Cancel all active Stripe subscriptions
      try {
        const subscriptions = await db.query(
          "SELECT stripe_subscription_id FROM stripe_subscriptions WHERE user_id = ? AND status IN ('active', 'trialing', 'past_due')",
          [userId]
        );

        if (subscriptions && subscriptions.length > 0) {
          let stripe = null;
          if (process.env.STRIPE_SECRET_KEY) {
            stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
          }
          if (stripe) {
            for (const sub of subscriptions) {
              try {
                await stripe.subscriptions.cancel(sub.stripe_subscription_id);
              } catch (stripeErr) {
                logger.error('Failed to cancel Stripe subscription during account deletion', {
                  error: stripeErr.message, subscriptionId: sub.stripe_subscription_id, userId
                });
              }
            }
          }
        }
      } catch (subErr) {
        logger.error('Error cancelling subscriptions during account deletion', { error: subErr.message, userId });
      }

      // 3. Suspend all active hosting services
      try {
        const services = await db.query(
          "SELECT id, hestia_username FROM user_hosting_services WHERE user_id = ? AND status = 'active' AND hestia_username IS NOT NULL",
          [userId]
        );

        if (services && services.length > 0) {
          for (const svc of services) {
            try {
              await hestiacp.suspendUser(svc.hestia_username);
            } catch (hErr) {
              logger.error('Failed to suspend HestiaCP user during account deletion', {
                error: hErr.message, username: svc.hestia_username, userId
              });
            }
          }
          await db.execute(
            "UPDATE user_hosting_services SET status = 'suspended' WHERE user_id = ? AND status = 'active'",
            [userId]
          );
        }
      } catch (svcErr) {
        logger.error('Error suspending services during account deletion', { error: svcErr.message, userId });
      }

      // 4-7. Anonymize user data (keep order records for tax compliance)
      const deletedEmail = `deleted_${userId}@deleted`;
      const deletedName = 'Deleted User';

      await db.transaction(async (connection) => {
        // Anonymize profile
        await connection.execute(
          `UPDATE profiles SET
            email = ?, first_name = ?, last_name = ?,
            company = NULL, phone = NULL, address = NULL, city = NULL, zip = NULL,
            avatar_url = NULL, updated_at = NOW()
          WHERE id = ?`,
          [deletedEmail, deletedName, '', userId]
        );

        // Anonymize user record
        await connection.execute(
          `UPDATE users SET
            email = ?, password_hash = NULL, email_verified = 0,
            mfa_enabled = 0, mfa_secret = NULL, mfa_recovery_codes = NULL
          WHERE id = ?`,
          [deletedEmail, userId]
        );

        // Anonymize orders (keep for tax compliance)
        await connection.execute(
          `UPDATE user_orders SET
            billing_email = ?, billing_name = ?, customer_email = ?, customer_name = ?,
            billing_company = NULL, billing_address = NULL, billing_phone = NULL
          WHERE user_id = ?`,
          [deletedEmail, deletedName, deletedEmail, deletedName, userId]
        );

        // Delete refresh tokens
        await connection.execute(
          'DELETE FROM refresh_tokens WHERE user_id = ?',
          [userId]
        );

        // Delete user's ticket messages (but keep ticket records)
        await connection.execute(
          `DELETE tm FROM ticket_messages tm
           INNER JOIN tickets t ON t.id = tm.ticket_id
           WHERE t.user_id = ? AND tm.is_admin = 0`,
          [userId]
        );

        // Delete alerts
        await connection.execute(
          'DELETE FROM alerts WHERE user_id = ?',
          [userId]
        );

        // Delete affiliate data
        await connection.execute(
          'DELETE FROM affiliates WHERE user_id = ?',
          [userId]
        );
        await connection.execute(
          'DELETE FROM affiliate_referrals WHERE referrer_id = ?',
          [userId]
        );

        // Delete credit data
        await connection.execute(
          'DELETE FROM credit_transactions WHERE user_id = ?',
          [userId]
        );
        await connection.execute(
          'DELETE FROM user_credits WHERE user_id = ?',
          [userId]
        );
      });

      logger.info('Account anonymized and marked as deleted', { userId, originalEmail: user.email });

      res.json({
        success: true,
        message: 'Account has been deleted and data anonymized'
      });
    })
  );

  return router;
};
