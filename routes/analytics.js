const express = require('express');
const router = express.Router();

module.exports = function({ db, logger, authenticateUser, requireAdmin }) {
  const { asyncHandler, AppError } = require('../middleware/errorHandler');

  // ============================================
  // REVENUE ANALYTICS
  // ============================================

  /**
   * Revenue overview (admin only)
   * GET /admin/analytics/revenue
   * Query params: period (30d, 90d, 12m, all)
   */
  router.get('/admin/analytics/revenue',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const period = req.query.period || '30d';

      // Build date filter
      let dateFilter = '';
      let dateParam = null;
      switch (period) {
        case '30d':
          dateFilter = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
          break;
        case '90d':
          dateFilter = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)';
          break;
        case '12m':
          dateFilter = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)';
          break;
        case 'all':
        default:
          dateFilter = '';
          break;
      }

      // Total all-time revenue
      const totalResult = await db.query(
        "SELECT COALESCE(SUM(price), 0) as total_revenue FROM user_orders WHERE payment_status = 'paid'"
      );
      const total_revenue = Number(totalResult[0]?.total_revenue) || 0;

      // Period revenue
      const periodResult = await db.query(
        `SELECT COALESCE(SUM(price), 0) as period_revenue
         FROM user_orders o
         WHERE o.payment_status = 'paid' ${dateFilter}`
      );
      const period_revenue = Number(periodResult[0]?.period_revenue) || 0;

      // MRR — Monthly Recurring Revenue from active monthly services
      const mrrResult = await db.query(
        "SELECT COALESCE(SUM(price), 0) as mrr FROM user_hosting_services WHERE status = 'active' AND billing_period = 'monthly'"
      );
      const mrr = Number(mrrResult[0]?.mrr) || 0;

      // ARR — Annual Recurring Revenue (MRR * 12 + yearly subscriptions)
      const yearlyResult = await db.query(
        "SELECT COALESCE(SUM(price), 0) as yearly_revenue FROM user_hosting_services WHERE status = 'active' AND billing_period = 'yearly'"
      );
      const yearly_revenue = Number(yearlyResult[0]?.yearly_revenue) || 0;
      const arr = Math.round((mrr * 12 + yearly_revenue) * 100) / 100;

      // Revenue by month (last 12 months max)
      const revenueByMonth = await db.query(
        `SELECT
           DATE_FORMAT(o.created_at, '%Y-%m') as month,
           COALESCE(SUM(o.price), 0) as revenue,
           COUNT(*) as orders
         FROM user_orders o
         WHERE o.payment_status = 'paid'
           AND o.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
         GROUP BY month
         ORDER BY month DESC`
      );

      // Revenue by plan
      const revenueByPlan = await db.query(
        `SELECT
           o.plan_name,
           COALESCE(SUM(o.price), 0) as revenue,
           COUNT(*) as count
         FROM user_orders o
         WHERE o.payment_status = 'paid' ${dateFilter}
         GROUP BY o.plan_name
         ORDER BY revenue DESC`
      );

      // Revenue by payment provider
      const revenueByProvider = await db.query(
        `SELECT
           COALESCE(o.payment_provider, 'unknown') as provider,
           COALESCE(SUM(o.price), 0) as revenue,
           COUNT(*) as count
         FROM user_orders o
         WHERE o.payment_status = 'paid' ${dateFilter}
         GROUP BY provider
         ORDER BY revenue DESC`
      );

      // Average order value
      const avgResult = await db.query(
        `SELECT COALESCE(AVG(price), 0) as avg_order_value
         FROM user_orders
         WHERE payment_status = 'paid' ${dateFilter}`
      );
      const avg_order_value = Math.round((Number(avgResult[0]?.avg_order_value) || 0) * 100) / 100;

      res.json({
        total_revenue,
        mrr,
        arr,
        period_revenue,
        revenue_by_month: revenueByMonth || [],
        revenue_by_plan: revenueByPlan || [],
        revenue_by_provider: revenueByProvider || [],
        avg_order_value
      });
    })
  );

  // ============================================
  // CUSTOMER ANALYTICS
  // ============================================

  /**
   * Customer analytics (admin only)
   * GET /admin/analytics/customers
   */
  router.get('/admin/analytics/customers',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      // Total customers (all registered users)
      const totalResult = await db.query('SELECT COUNT(*) as total FROM users');
      const total_customers = Number(totalResult[0]?.total) || 0;

      // Active customers (at least 1 active service)
      const activeResult = await db.query(
        "SELECT COUNT(DISTINCT user_id) as active FROM user_hosting_services WHERE status = 'active'"
      );
      const active_customers = Number(activeResult[0]?.active) || 0;

      // New customers this month
      const newThisMonthResult = await db.query(
        `SELECT COUNT(*) as new_count FROM users
         WHERE created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')`
      );
      const new_customers_this_month = Number(newThisMonthResult[0]?.new_count) || 0;

      // Churn rate: users whose last service expired/cancelled this month vs total active last month
      const churnedResult = await db.query(
        `SELECT COUNT(DISTINCT h.user_id) as churned
         FROM user_hosting_services h
         WHERE h.status IN ('expired', 'cancelled')
           AND h.updated_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
           AND NOT EXISTS (
             SELECT 1 FROM user_hosting_services h2
             WHERE h2.user_id = h.user_id AND h2.status = 'active'
           )`
      );
      const churned = Number(churnedResult[0]?.churned) || 0;

      // Active customers at start of month (had active service before this month)
      const activeLastMonthResult = await db.query(
        `SELECT COUNT(DISTINCT user_id) as active_last
         FROM user_hosting_services
         WHERE status = 'active'
            OR (status IN ('expired', 'cancelled') AND updated_at >= DATE_FORMAT(NOW(), '%Y-%m-01'))`
      );
      const activeLastMonth = Number(activeLastMonthResult[0]?.active_last) || 0;
      const churn_rate = activeLastMonth > 0 ? Math.round((churned / activeLastMonth) * 10000) / 100 : 0;

      // Customers by month (last 12 months)
      const customersByMonth = await db.query(
        `SELECT
           DATE_FORMAT(u.created_at, '%Y-%m') as month,
           COUNT(*) as new_count
         FROM users u
         WHERE u.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
         GROUP BY month
         ORDER BY month DESC`
      );

      // Enrich with churned count per month
      const churnedByMonth = await db.query(
        `SELECT
           DATE_FORMAT(h.updated_at, '%Y-%m') as month,
           COUNT(DISTINCT h.user_id) as churned
         FROM user_hosting_services h
         WHERE h.status IN ('expired', 'cancelled')
           AND h.updated_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
           AND NOT EXISTS (
             SELECT 1 FROM user_hosting_services h2
             WHERE h2.user_id = h.user_id AND h2.status = 'active'
           )
         GROUP BY month
         ORDER BY month DESC`
      );
      const churnMap = {};
      for (const row of (churnedByMonth || [])) {
        churnMap[row.month] = Number(row.churned) || 0;
      }

      // Running total of customers
      const totalByMonth = await db.query(
        `SELECT
           DATE_FORMAT(u.created_at, '%Y-%m') as month,
           COUNT(*) as cumulative
         FROM users u
         WHERE u.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
         GROUP BY month
         ORDER BY month ASC`
      );

      // Build cumulative total
      let runningTotal = 0;
      // Get count of users before the 12-month window
      const beforeResult = await db.query(
        'SELECT COUNT(*) as cnt FROM users WHERE created_at < DATE_SUB(NOW(), INTERVAL 12 MONTH)'
      );
      runningTotal = Number(beforeResult[0]?.cnt) || 0;

      const totalMap = {};
      for (const row of (totalByMonth || [])) {
        runningTotal += Number(row.cumulative) || 0;
        totalMap[row.month] = runningTotal;
      }

      const customers_by_month = (customersByMonth || []).map(row => ({
        month: row.month,
        new_count: Number(row.new_count) || 0,
        churned: churnMap[row.month] || 0,
        total: totalMap[row.month] || 0
      }));

      // Average lifetime value
      const ltvResult = await db.query(
        `SELECT COALESCE(AVG(user_total), 0) as avg_ltv
         FROM (
           SELECT user_id, SUM(price) as user_total
           FROM user_orders
           WHERE payment_status = 'paid'
           GROUP BY user_id
         ) sub`
      );
      const avg_lifetime_value = Math.round((Number(ltvResult[0]?.avg_ltv) || 0) * 100) / 100;

      res.json({
        total_customers,
        active_customers,
        new_customers_this_month,
        churn_rate,
        customers_by_month,
        avg_lifetime_value
      });
    })
  );

  // ============================================
  // SERVICE ANALYTICS
  // ============================================

  /**
   * Service analytics (admin only)
   * GET /admin/analytics/services
   */
  router.get('/admin/analytics/services',
    authenticateUser,
    requireAdmin,
    asyncHandler(async (req, res) => {
      // Total services
      const totalResult = await db.query('SELECT COUNT(*) as total FROM user_hosting_services');
      const total_services = Number(totalResult[0]?.total) || 0;

      // Services by status
      const byStatus = await db.query(
        `SELECT status, COUNT(*) as count
         FROM user_hosting_services
         GROUP BY status
         ORDER BY count DESC`
      );

      const statusMap = {};
      for (const row of (byStatus || [])) {
        statusMap[row.status] = Number(row.count) || 0;
      }

      const active_services = statusMap['active'] || 0;
      const suspended_services = statusMap['suspended'] || 0;
      const expired_services = statusMap['expired'] || 0;

      // Services by plan
      const byPlan = await db.query(
        `SELECT plan_name, COUNT(*) as count
         FROM user_hosting_services
         WHERE status = 'active'
         GROUP BY plan_name
         ORDER BY count DESC`
      );

      // Average disk and bandwidth usage from latest statistics
      const usageResult = await db.query(
        `SELECT
           AVG(CASE WHEN h.disk_space > 0 THEN (s.disk_used_mb / h.disk_space) * 100 ELSE 0 END) as avg_disk_usage_percent,
           AVG(CASE WHEN h.bandwidth > 0 THEN (s.bandwidth_used_mb / h.bandwidth) * 100 ELSE 0 END) as avg_bandwidth_usage_percent
         FROM user_hosting_services h
         INNER JOIN (
           SELECT service_id, MAX(id) as latest_id
           FROM service_statistics
           GROUP BY service_id
         ) latest ON latest.service_id = h.id
         INNER JOIN service_statistics s ON s.id = latest.latest_id
         WHERE h.status = 'active'`
      );

      const avg_disk_usage_percent = Math.round((Number(usageResult[0]?.avg_disk_usage_percent) || 0) * 100) / 100;
      const avg_bandwidth_usage_percent = Math.round((Number(usageResult[0]?.avg_bandwidth_usage_percent) || 0) * 100) / 100;

      res.json({
        total_services,
        active_services,
        suspended_services,
        expired_services,
        services_by_plan: byPlan || [],
        services_by_status: byStatus || [],
        avg_disk_usage_percent,
        avg_bandwidth_usage_percent
      });
    })
  );

  return router;
};
