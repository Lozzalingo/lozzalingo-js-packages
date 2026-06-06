import { useState } from 'react';
import { useStatus } from './hooks/useStatus';
import { Dashboard } from './components/Dashboard';
import { AddDestinationModal } from './components/AddDestinationModal';
import './App.css';

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function App() {
  const { status, connected } = useStatus();
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="app">
      <header>
        <div className="header-left">
          <h1>Restream</h1>
          <span className={`connection-badge ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="ingest-status">
          <div
            className={`ingest-dot ${status.ingestActive ? 'active' : ''}`}
          />
          <span>
            {status.ingestActive
              ? `Stream Active - ${formatUptime(status.uptime)}`
              : 'No Ingest Stream'}
          </span>
        </div>
      </header>

      <main>
        <Dashboard
          destinations={status.destinations}
          ingestActive={status.ingestActive}
          onAdd={() => setShowModal(true)}
        />
      </main>

      {showModal && (
        <AddDestinationModal
          onClose={() => setShowModal(false)}
          onAdded={() => {}}
        />
      )}
    </div>
  );
}

export default App;
