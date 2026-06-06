import { useState } from 'react';

export function AddDestinationModal({ onClose, onAdded }) {
  const [name, setName] = useState('');
  const [rtmpUrl, setRtmpUrl] = useState('');
  const [streamKey, setStreamKey] = useState('');
  const [format, setFormat] = useState('landscape');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/destinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, rtmpUrl, streamKey, format }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add destination');
      }
      onAdded();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Add Destination</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="YouTube, Twitch, etc."
              required
            />
          </label>
          <label>
            RTMP URL
            <input
              type="text"
              value={rtmpUrl}
              onChange={(e) => setRtmpUrl(e.target.value)}
              placeholder="rtmp://a.rtmp.youtube.com/live2"
              required
            />
          </label>
          <label>
            Stream Key
            <input
              type="password"
              value={streamKey}
              onChange={(e) => setStreamKey(e.target.value)}
              placeholder="xxxx-xxxx-xxxx-xxxx"
              required
            />
          </label>
          <label>
            Format
            <div className="format-toggle">
              <button
                type="button"
                className={`format-btn ${format === 'landscape' ? 'active' : ''}`}
                onClick={() => setFormat('landscape')}
              >
                Landscape (16:9)
              </button>
              <button
                type="button"
                className={`format-btn ${format === 'portrait' ? 'active' : ''}`}
                onClick={() => setFormat('portrait')}
              >
                Portrait (9:16)
              </button>
            </div>
          </label>
          {error && <p className="error">{error}</p>}
          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={saving}>
              {saving ? 'Adding...' : 'Add Destination'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
