/**
 * @lozzalingo/ops - Operations Controller
 */

const { getHealthStatus } = require('./health');
const { execSync } = require('child_process');

function createOpsController(prisma, options = {}) {
  console.log('[Ops] Initializing ops controller');

  async function healthCheck(req, res) {
    try {
      const health = getHealthStatus();
      res.json(health);
    } catch (error) {
      console.error('[Ops] Health check error:', error.message);
      res.status(500).json({ status: 'error', error: error.message });
    }
  }

  async function detailedHealth(req, res) {
    try {
      console.log('[Ops] Running detailed health check');
      const health = getHealthStatus();
      
      // Add Docker info if available
      try {
        const dockerPs = execSync('docker ps --format "{{.Names}}: {{.Status}}" 2>/dev/null', { encoding: 'utf8' });
        health.docker = {
          available: true,
          containers: dockerPs.trim().split('\n').filter(Boolean),
        };
      } catch {
        health.docker = { available: false };
      }

      // Add process info
      health.process = {
        pid: process.pid,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
      };

      res.json(health);
    } catch (error) {
      console.error('[Ops] Detailed health check error:', error.message);
      res.status(500).json({ status: 'error', error: error.message });
    }
  }

  async function getRecentErrors(req, res) {
    if (!prisma) {
      return res.json({ errors: [], message: 'Logging not available' });
    }

    try {
      console.log('[Ops] Fetching recent errors');
      const { limit = 20 } = req.query;

      const errors = await prisma.appLog.findMany({
        where: {
          level: { in: ['ERROR', 'CRITICAL'] },
        },
        orderBy: { timestamp: 'desc' },
        take: parseInt(limit),
      });

      res.json({ errors });
    } catch (error) {
      console.error('[Ops] Error fetching errors:', error.message);
      res.status(500).json({ error: 'Failed to fetch errors' });
    }
  }

  async function dockerCleanup(req, res) {
    try {
      console.log('[Ops] Running Docker cleanup');
      
      let output = '';
      try {
        output = execSync('docker image prune -f 2>&1', { encoding: 'utf8' });
      } catch (e) {
        output = e.message;
      }

      console.log('[Ops] Docker cleanup result:', output.trim());
      res.json({ success: true, output: output.trim() });
    } catch (error) {
      console.error('[Ops] Docker cleanup error:', error.message);
      res.status(500).json({ error: 'Docker cleanup failed' });
    }
  }

  async function getAlerts(req, res) {
    if (!prisma) {
      return res.json({ alerts: [], hasSpike: false });
    }

    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const recentErrorCount = await prisma.appLog.count({
        where: {
          level: { in: ['ERROR', 'CRITICAL'] },
          timestamp: { gte: oneHourAgo },
        },
      });

      const alerts = [];
      const hasSpike = recentErrorCount > 10;

      if (hasSpike) {
        alerts.push({
          level: 'critical',
          message: `Error spike detected: ${recentErrorCount} errors in the last hour`,
          count: recentErrorCount,
          since: oneHourAgo.toISOString(),
        });
      }

      // Check health status for additional alerts
      const health = getHealthStatus();
      if (health.memory && parseFloat(health.memory.usedPercent) > 90) {
        alerts.push({
          level: 'warning',
          message: `High memory usage: ${health.memory.usedPercent}%`,
        });
      }
      if (health.disk && parseFloat(health.disk.usedPercent) > 85) {
        alerts.push({
          level: 'warning',
          message: `High disk usage: ${health.disk.usedPercent}%`,
        });
      }

      console.log(`[Ops] Alert check: ${alerts.length} alerts, spike: ${hasSpike}`);
      res.json({ alerts, hasSpike, errorCount: recentErrorCount });
    } catch (error) {
      console.error('[Ops] Alert check error:', error.message);
      res.status(500).json({ error: 'Failed to check alerts' });
    }
  }

  return {
    healthCheck,
    detailedHealth,
    getRecentErrors,
    dockerCleanup,
    getAlerts,
  };
}

module.exports = { createOpsController };
