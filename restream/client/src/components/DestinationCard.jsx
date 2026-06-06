export function DestinationCard({ destination, ingestActive }) {
  const { id, name, format, enabled, relayRunning, bitrate, fps, uptime, error } = destination;

  function formatUptime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  async function handleStartStop() {
    const action = relayRunning ? 'stop' : 'start';
    await fetch(`/api/destinations/${id}/${action}`, { method: 'POST' });
  }

  async function handleToggleEnabled() {
    await fetch(`/api/destinations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !enabled }),
    });
  }

  async function handleDelete() {
    if (!confirm(`Delete "${name}"?`)) return;
    await fetch(`/api/destinations/${id}`, { method: 'DELETE' });
  }

  const statusColor = error ? '#e74c3c' : relayRunning ? '#2ecc71' : '#95a5a6';
  const statusText = error ? 'Error' : relayRunning ? 'Live' : 'Stopped';

  return (
    <div className={`destination-card ${relayRunning ? 'live' : ''}`}>
      <div className="card-header">
        <div className="status-dot" style={{ backgroundColor: statusColor }} />
        <h3>{name}</h3>
        <span className={`format-badge ${format === 'portrait' ? 'portrait' : ''}`}>
          {format === 'portrait' ? '9:16' : '16:9'}
        </span>
        <span className="status-text" style={{ color: statusColor }}>{statusText}</span>
      </div>

      {relayRunning && (
        <div className="card-stats">
          <span>Bitrate: {bitrate || '...'}</span>
          <span>FPS: {fps || '...'}</span>
          <span>Uptime: {formatUptime(uptime)}</span>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="card-actions">
        <label className="toggle">
          <input type="checkbox" checked={enabled} onChange={handleToggleEnabled} />
          <span>{enabled ? 'Enabled' : 'Disabled'}</span>
        </label>
        <button
          onClick={handleStartStop}
          disabled={!ingestActive || !enabled}
          className={relayRunning ? 'btn-stop' : 'btn-start'}
        >
          {relayRunning ? 'Stop' : 'Start'}
        </button>
        <button onClick={handleDelete} className="btn-delete">Delete</button>
      </div>
    </div>
  );
}
