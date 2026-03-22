const express = require('express');
const router = express.Router();

module.exports = function({ db, logger, stripeSDK, authenticateUser }) {
  const { asyncHandler, AppError } = require('../middleware/errorHandler');

  /**
   * Get user's Stripe subscriptions
   * GET /subscriptions
   */
  router.get('/subscriptions',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;

      const subscriptions = await db.query(
        `SELECT s.*, o.plan_name, o.price, o.currency
         FROM stripe_subscriptions s
         LEFT JOIN user_orders o ON o.id = s.order_id
         WHERE s.user_id = ?
         ORDER BY s.created_at DESC`,
        [userId]
      );

      // Enrich with cancel_at_period_end from Stripe API if available
      const enriched = [];
      for (const sub of (subscriptions || [])) {
        let cancel_at_period_end = false;
        try {
          if (sub.stripe_subscription_id && sub.status !== 'canceled') {
            const stripeSub = await stripeSDK.subscriptions.retrieve(sub.stripe_subscription_id);
            cancel_at_period_end = !!stripeSub.cancel_at_period_end;
          }
        } catch (err) {
          // Stripe call failed — use DB data only
          logger.warn('Failed to fetch Stripe subscription details', { subId: sub.stripe_subscription_id, error: err.message });
        }
        enriched.push({ ...sub, cancel_at_period_end });
      }

      res.json({
        success: true,
        subscriptions: enriched
      });
    })
  );

  /**
   * Cancel a Stripe subscription (sets cancel_at_period_end = true)
   * POST /subscriptions/:id/cancel
   */
  router.post('/subscriptions/:id/cancel',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const stripeSubscriptionId = req.params.id;
      const userId = req.user.id;

      // Verify the subscription belongs to this user
      const sub = await db.queryOne(
        'SELECT * FROM stripe_subscriptions WHERE stripe_subscription_id = ? AND user_id = ?',
        [stripeSubscriptionId, userId]
      );

      if (!sub) {
        throw new AppError('Subscription not found', 404);
      }

      if (sub.status === 'canceled') {
        throw new AppError('Subscription is already canceled', 400);
      }

      // Cancel at period end via Stripe API — service remains active until the end of the billing period
      await stripeSDK.subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      logger.info('Subscription cancel_at_period_end set', { stripeSubscriptionId, userId });

      res.json({
        success: true,
        message: 'Subscription will be canceled at the end of the current billing period'
      });
    })
  );

  return router;
};
