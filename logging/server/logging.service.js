/**
 * @lozzalingo/logging - Persistent Structured Logging Service
 * Stores logs in DB via Prisma, queryable via admin dashboard
 */

function createLoggingService(prisma) {
  console.log('[Logging] Initializing logging service');

  async function log(level, source, message, details, userId) {
    try {
      await prisma.appLog.create({
        data: {
          level,
          source,
          message,
          details: details ? JSON.stringify(details) : null,
          userId: userId || null,
        },
      });
    } catch (error) {
      // Fallback to console if DB write fails
      console.error('[Logging] Failed to write log to DB:', error.message);
      console.log(`[${source}] [${level}] ${message}`);
    }
  }

  function debug(source, message, details) {
    return log('DEBUG', source, message, details);
  }

  function info(source, message, details) {
    return log('INFO', source, message, details);
  }

  function warning(source, message, details) {
    return log('WARNING', source, message, details);
  }

  function error(source, message, details) {
    return log('ERROR', source, message, details);
  }

  function critical(source, message, details) {
    return log('CRITICAL', source, message, details);
  }

  async function cleanupOldLogs(daysToKeep = 30) {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysToKeep);
      
      const result = await prisma.appLog.deleteMany({
        where: {
          timestamp: { lt: cutoff },
        },
      });
      
      console.log(`[Logging] Cleaned up ${result.count} logs older than ${daysToKeep} days`);
      return result.count;
    } catch (err) {
      console.error('[Logging] Failed to cleanup old logs:', err.message);
      return 0;
    }
  }

  return {
    log,
    debug,
    info,
    warning,
    error,
    critical,
    cleanupOldLogs,
  };
}

module.exports = { createLoggingService };
