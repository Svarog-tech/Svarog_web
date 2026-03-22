/**
 * Factory for audit logging helper.
 * @param {{ db: object, logger: object }} deps
 * @returns {Function} auditLog(userId, action, targetType, targetId, details, req)
 */
module.exports = function createAuditLog({ db, logger }) {

  /**
   * SECURITY: Audit logging helper
   * Logs user actions to audit_log table for security tracking.
   */
  async function auditLog(userId, action, targetType, targetId, details, req) {
    try {
      await db.execute(
        'INSERT INTO audit_log (user_id, action, target_type, target_id, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, action, targetType, targetId, details ? JSON.stringify(details) : null, req?.ip || null, req?.get('user-agent')?.substring(0, 500) || null]
      );
    } catch (err) {
      logger.error('Failed to write audit log', { error: err.message, action, userId });
    }
  }

  return auditLog;
};
