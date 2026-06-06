/**
 * @lozzalingo/logging - Log Viewer Routes
 * GET  /           — List logs (paginated, filterable)
 * GET  /stats      — Log counts by level
 * DELETE /cleanup  — Delete old logs
 */

const express = require('express');

function createLoggingRoutes(prisma) {
  const router = express.Router();

  // GET / — List logs (paginated, filterable by level/source/date)
  router.get('/', async (req, res) => {
    try {
      console.log('[Logging] Fetching logs');
      const { page = 1, limit = 50, level, source, search, startDate, endDate } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const where = {};
      if (level) where.level = level;
      if (source) where.source = source;
      if (search) {
        where.message = { contains: search };
      }
      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp.gte = new Date(startDate);
        if (endDate) where.timestamp.lte = new Date(endDate);
      }

      const [logs, total] = await Promise.all([
        prisma.appLog.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          skip,
          take: parseInt(limit),
        }),
        prisma.appLog.count({ where }),
      ]);

      res.json({
        logs,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      });
    } catch (error) {
      console.error('[Logging] Error fetching logs:', error.message);
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  });

  // GET /stats — Log counts by level
  router.get('/stats', async (req, res) => {
    try {
      console.log('[Logging] Fetching log stats');
      const levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'];
      const stats = {};

      for (const level of levels) {
        stats[level] = await prisma.appLog.count({ where: { level } });
      }

      const total = await prisma.appLog.count();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const today = await prisma.appLog.count({
        where: { timestamp: { gte: todayStart } },
      });

      res.json({ stats, total, today });
    } catch (error) {
      console.error('[Logging] Error fetching stats:', error.message);
      res.status(500).json({ error: 'Failed to fetch log stats' });
    }
  });

  // DELETE /cleanup — Delete old logs
  router.delete('/cleanup', async (req, res) => {
    try {
      const { days = 30 } = req.query;
      console.log(`[Logging] Cleaning up logs older than ${days} days`);

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(days));

      const result = await prisma.appLog.deleteMany({
        where: { timestamp: { lt: cutoff } },
      });

      console.log(`[Logging] Cleaned up ${result.count} old logs`);
      res.json({ deleted: result.count, daysKept: parseInt(days) });
    } catch (error) {
      console.error('[Logging] Error cleaning up logs:', error.message);
      res.status(500).json({ error: 'Failed to cleanup logs' });
    }
  });

  return router;
}

module.exports = { createLoggingRoutes };
