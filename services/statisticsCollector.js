/**
 * Statistics Collector Service
 * Shromažďuje statistiky ze všech aktivních služeb a ukládá je do databáze
 * Mělo by být spuštěno jako cron job každou hodinu
 */

const db = require('./databaseService');
const hestiacp = require('./hestiacpService');
const logger = require('../utils/logger');

/**
 * Shromáždí statistiky pro jednu službu
 */
async function collectServiceStatistics(service) {
  try {
    if (!service.hestia_username || !service.hestia_created) {
      return null;
    }

    const [statsResult, userResult] = await Promise.all([
      hestiacp.getUserStats(service.hestia_username),
      hestiacp.getUserInfo(service.hestia_username)
    ]);

    if (!statsResult.success || !userResult.success) {
      logger.warn(`Failed to collect statistics for service ${service.id}`, {
        serviceId: service.id,
        hestiaUsername: service.hestia_username
      });
      return null;
    }

    const stats = {
      service_id: service.id,
      disk_used_mb: statsResult.stats.disk_used_mb || 0,
      bandwidth_used_mb: statsResult.stats.bandwidth_used_mb || 0,
      email_accounts_used: statsResult.stats.mail_accounts || 0,
      databases_used: statsResult.stats.databases || 0,
      web_domains_used: statsResult.stats.web_domains || 0,
      cpu_usage_percent: 0, // HestiaCP API neposkytuje CPU usage přímo
      memory_usage_percent: 0, // HestiaCP API neposkytuje Memory usage přímo
    };

    // Uložit do databáze
    await db.query(
      `INSERT INTO service_statistics 
       (service_id, disk_used_mb, bandwidth_used_mb, email_accounts_used, databases_used, web_domains_used, cpu_usage_percent, memory_usage_percent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        stats.service_id,
        stats.disk_used_mb,
        stats.bandwidth_used_mb,
        stats.email_accounts_used,
        stats.databases_used,
        stats.web_domains_used,
        stats.cpu_usage_percent,
        stats.memory_usage_percent
      ]
    );

    // Zkontrolovat a vytvořit alerty pokud je potřeba
    await checkAndCreateAlerts(service, stats, userResult.user);

    return stats;
  } catch (error) {
    logger.error(`Error collecting statistics for service ${service.id}`, error);
    return null;
  }
}

/**
 * Zkontroluje limity a vytvoří alerty pokud je potřeba
 */
async function checkAndCreateAlerts(service, stats, userInfo) {
  const alerts = [];

  // Disk limit check (80% warning, 95% critical)
  const diskPercent = userInfo.disk_quota_mb > 0 
    ? (stats.disk_used_mb / userInfo.disk_quota_mb) * 100 
    : 0;
  if (diskPercent >= 95) {
    alerts.push({
      service_id: service.id,
      alert_type: 'disk_limit',
      threshold_value: userInfo.disk_quota_mb,
      current_value: stats.disk_used_mb,
      severity: 'critical'
    });
  } else if (diskPercent >= 80) {
    alerts.push({
      service_id: service.id,
      alert_type: 'disk_limit',
      threshold_value: userInfo.disk_quota_mb,
      current_value: stats.disk_used_mb,
      severity: 'warning'
    });
  }

  // Bandwidth limit check
  const bandwidthPercent = userInfo.bandwidth_limit_mb > 0
    ? (stats.bandwidth_used_mb / userInfo.bandwidth_limit_mb) * 100
    : 0;
  if (bandwidthPercent >= 95) {
    alerts.push({
      service_id: service.id,
      alert_type: 'bandwidth_limit',
      threshold_value: userInfo.bandwidth_limit_mb,
      current_value: stats.bandwidth_used_mb,
      severity: 'critical'
    });
  } else if (bandwidthPercent >= 80) {
    alerts.push({
      service_id: service.id,
      alert_type: 'bandwidth_limit',
      threshold_value: userInfo.bandwidth_limit_mb,
      current_value: stats.bandwidth_used_mb,
      severity: 'warning'
    });
  }

  // Email accounts limit check
  if (userInfo.mail_accounts_limit > 0 && stats.email_accounts_used >= userInfo.mail_accounts_limit * 0.9) {
    alerts.push({
      service_id: service.id,
      alert_type: 'email_limit',
      threshold_value: userInfo.mail_accounts_limit,
      current_value: stats.email_accounts_used,
      severity: stats.email_accounts_used >= userInfo.mail_accounts_limit ? 'critical' : 'warning'
    });
  }

  // Databases limit check
  if (userInfo.databases_limit > 0 && stats.databases_used >= userInfo.databases_limit * 0.9) {
    alerts.push({
      service_id: service.id,
      alert_type: 'database_limit',
      threshold_value: userInfo.databases_limit,
      current_value: stats.databases_used,
      severity: stats.databases_used >= userInfo.databases_limit ? 'critical' : 'warning'
    });
  }

  // Web domains limit check
  if (userInfo.web_domains_limit > 0 && stats.web_domains_used >= userInfo.web_domains_limit * 0.9) {
    alerts.push({
      service_id: service.id,
      alert_type: 'domain_limit',
      threshold_value: userInfo.web_domains_limit,
      current_value: stats.web_domains_used,
      severity: stats.web_domains_used >= userInfo.web_domains_limit ? 'critical' : 'warning'
    });
  }

  // Vytvořit alerty pouze pokud ještě neexistují nepotvrzené alerty stejného typu
  for (const alert of alerts) {
    const existingAlert = await db.queryOne(
      `SELECT id FROM service_alerts 
       WHERE service_id = ? AND alert_type = ? AND acknowledged = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [alert.service_id, alert.alert_type]
    );

    if (!existingAlert) {
      await db.query(
        `INSERT INTO service_alerts 
         (service_id, alert_type, threshold_value, current_value, severity)
         VALUES (?, ?, ?, ?, ?)`,
        [
          alert.service_id,
          alert.alert_type,
          alert.threshold_value,
          alert.current_value,
          alert.severity
        ]
      );
    }
  }
}

/**
 * Shromáždí statistiky pro všechny aktivní služby
 */
async function collectAllStatistics() {
  try {
    logger.info('Starting statistics collection for all services');

    const services = await db.query(
      `SELECT id, hestia_username, hestia_created 
       FROM user_hosting_services 
       WHERE status = 'active' AND hestia_created = 1`
    );

    logger.info(`Found ${services.length} active services to collect statistics for`);

    // Process in batches of 10 to avoid overwhelming HestiaCP API
    const batchSize = 10;
    for (let i = 0; i < services.length; i += batchSize) {
      const batch = services.slice(i, i + batchSize);
      await Promise.all(batch.map(service => collectServiceStatistics(service)));
      
      // Small delay between batches
      if (i + batchSize < services.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    logger.info('Statistics collection completed');
  } catch (error) {
    logger.error('Error in collectAllStatistics', error);
    throw error;
  }
}

/**
 * Cleanup old statistics (keep only last 90 days)
 */
async function cleanupOldStatistics() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    const result = await db.query(
      'DELETE FROM service_statistics WHERE recorded_at < ?',
      [cutoffDate]
    );

    logger.info(`Cleaned up ${result.affectedRows} old statistics records`);
  } catch (error) {
    logger.error('Error cleaning up old statistics', error);
  }
}

// Pokud je spuštěno přímo (ne jako modul), spustit collection
if (require.main === module) {
  (async () => {
    try {
      await collectAllStatistics();
      await cleanupOldStatistics();
      process.exit(0);
    } catch (error) {
      logger.error('Statistics collection failed', error);
      process.exit(1);
    }
  })();
}

module.exports = {
  collectServiceStatistics,
  collectAllStatistics,
  cleanupOldStatistics,
  checkAndCreateAlerts
};
