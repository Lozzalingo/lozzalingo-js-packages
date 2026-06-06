/**
 * @lozzalingo/ops - System Health Checks
 * Disk, memory, uptime monitoring using Node.js os module
 */

const os = require('os');
const { execSync } = require('child_process');

function getHealthStatus() {
  console.log('[Ops] Running health checks');
  const result = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: os.uptime(),
    uptimeFormatted: formatUptime(os.uptime()),
    memory: getMemoryInfo(),
    disk: getDiskInfo(),
    cpu: {
      cores: os.cpus().length,
      model: os.cpus()[0]?.model || 'Unknown',
      loadAvg: os.loadavg(),
    },
    platform: os.platform(),
    hostname: os.hostname(),
    nodeVersion: process.version,
  };

  // Determine overall status
  if (result.memory.usedPercent > 95 || result.disk.usedPercent > 90) {
    result.status = 'critical';
  } else if (result.memory.usedPercent > 85 || result.disk.usedPercent > 80) {
    result.status = 'warning';
  }

  return result;
}

function getMemoryInfo() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;

  return {
    total: formatBytes(total),
    free: formatBytes(free),
    used: formatBytes(used),
    usedPercent: Math.round((used / total) * 100),
    totalBytes: total,
    freeBytes: free,
  };
}

function getDiskInfo() {
  try {
    const output = execSync('df -k / 2>/dev/null || echo "unavailable"', { encoding: 'utf8' });
    if (output.includes('unavailable')) {
      return { available: false };
    }

    const lines = output.trim().split('\n');
    if (lines.length < 2) return { available: false };

    const parts = lines[1].split(/\s+/);
    const totalKB = parseInt(parts[1]) || 0;
    const usedKB = parseInt(parts[2]) || 0;
    const availKB = parseInt(parts[3]) || 0;

    return {
      available: true,
      total: formatBytes(totalKB * 1024),
      used: formatBytes(usedKB * 1024),
      free: formatBytes(availKB * 1024),
      usedPercent: totalKB > 0 ? Math.round((usedKB / totalKB) * 100) : 0,
    };
  } catch {
    return { available: false };
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${mins}m`);
  return parts.join(' ');
}

module.exports = { getHealthStatus };
