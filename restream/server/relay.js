const { spawn } = require('child_process');

class RelayManager {
  constructor(store) {
    this.store = store;
    this.processes = new Map(); // destinationId -> { proc, startedAt, stats }
    this.ingestPath = null;
    this.ingestStartedAt = null;
  }

  get ingestActive() {
    return this.ingestPath !== null;
  }

  startAll(ingestPath) {
    this.ingestPath = ingestPath;
    this.ingestStartedAt = Date.now();
    const destinations = this.store.getDestinations();
    for (const dest of destinations) {
      if (dest.enabled) {
        this._spawnRelay(dest);
      }
    }
  }

  stopAll() {
    for (const [id] of this.processes) {
      this._killRelay(id);
    }
    this.ingestPath = null;
    this.ingestStartedAt = null;
  }

  startOne(destinationId) {
    if (!this.ingestActive) return { error: 'No active ingest stream' };
    if (this.processes.has(destinationId)) return { error: 'Relay already running' };
    const dest = this.store.getDestination(destinationId);
    if (!dest) return { error: 'Destination not found' };
    this._spawnRelay(dest);
    return { ok: true };
  }

  stopOne(destinationId) {
    if (!this.processes.has(destinationId)) return { error: 'Relay not running' };
    this._killRelay(destinationId);
    return { ok: true };
  }

  getStatus() {
    const destinations = this.store.getDestinations().map((dest) => {
      const proc = this.processes.get(dest.id);
      return {
        id: dest.id,
        name: dest.name,
        format: dest.format || 'landscape',
        enabled: dest.enabled,
        relayRunning: !!proc,
        bitrate: proc?.stats?.bitrate || null,
        fps: proc?.stats?.fps || null,
        uptime: proc ? Math.floor((Date.now() - proc.startedAt) / 1000) : 0,
        error: proc?.error || null,
      };
    });

    return {
      ingestActive: this.ingestActive,
      ingestPath: this.ingestPath,
      uptime: this.ingestStartedAt
        ? Math.floor((Date.now() - this.ingestStartedAt) / 1000)
        : 0,
      destinations,
    };
  }

  _spawnRelay(destination) {
    const ingestUrl = `rtmp://127.0.0.1:1935${this.ingestPath}`;
    const target = `${destination.rtmpUrl}/${destination.streamKey}`;

    const isPortrait = destination.format === 'portrait';

    const args = ['-rw_timeout', '5000000', '-i', ingestUrl];

    if (isPortrait) {
      // Crop center of 1920x1080 to 608x1080, then scale to 1080x1920
      args.push('-vf', 'crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920');
      args.push('-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '4000k');
      args.push('-c:a', 'aac', '-b:a', '128k');
    } else {
      args.push('-c', 'copy');
    }

    args.push('-f', 'flv', target);

    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });

    const entry = {
      proc,
      startedAt: Date.now(),
      stats: { bitrate: null, fps: null },
      error: null,
    };

    proc.stderr.on('data', (data) => {
      this._parseStats(destination.id, data.toString());
    });

    proc.on('close', (code) => {
      const existing = this.processes.get(destination.id);
      if (existing && existing.proc === proc) {
        if (code !== 0 && code !== null) {
          existing.error = `FFmpeg exited with code ${code}`;
          // Keep entry so the error is visible in status, but mark proc as dead
          existing.proc = null;
        } else {
          this.processes.delete(destination.id);
        }
      }
    });

    proc.on('error', (err) => {
      console.error(`[Relay] Failed to start FFmpeg for ${destination.name}:`, err.message);
      entry.error = err.message;
      entry.proc = null;
    });

    this.processes.set(destination.id, entry);
    console.log(`[Relay] Started relay for ${destination.name}`);
  }

  _killRelay(destinationId) {
    const entry = this.processes.get(destinationId);
    if (entry?.proc) {
      entry.proc.kill('SIGTERM');
      // Force kill after 5 seconds if still alive
      setTimeout(() => {
        try { entry.proc?.kill('SIGKILL'); } catch {}
      }, 5000);
    }
    this.processes.delete(destinationId);
  }

  _parseStats(destinationId, output) {
    const entry = this.processes.get(destinationId);
    if (!entry) return;

    const bitrateMatch = output.match(/bitrate=\s*([\d.]+)kbits\/s/);
    if (bitrateMatch) entry.stats.bitrate = `${bitrateMatch[1]} kbits/s`;

    const fpsMatch = output.match(/fps=\s*([\d.]+)/);
    if (fpsMatch) entry.stats.fps = parseFloat(fpsMatch[1]);
  }
}

module.exports = RelayManager;
