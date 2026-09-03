/**
 * @lozzalingo/logging - Persistent Structured Logging Service
 * Stores logs in DB via Prisma, queryable via admin dashboard
 */

function createLoggingService(prisma) {
  console.log('[Logging] Initializing logging service');

  const SM_URL = process.env.SITE_MONITOR_URL;
  const SM_KEY = process.env.SITE_MONITOR_KEY;

  function forwardToSiteMonitor(level, source, message, details, userId) {
    if (!SM_URL || !SM_KEY) return;

    const payload = {
      level,
      message,
      timestamp: new Date().toISOString(),
      meta: {
        source,
        details: details ? JSON.stringify(details) : null,
      },
      user: { id: userId || null },
    };

    fetch(`${SM_URL}/api/sm/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SM-Key': SM_KEY,
      },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Silently swallow, Site Monitor being down must never break a site
    });
  }

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

      // Forward to Site Monitor (fire-and-forget)
      forwardToSiteMonitor(level, source, message, details, userId);
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
