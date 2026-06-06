import { DestinationCard } from './DestinationCard';

export function Dashboard({ destinations, ingestActive, onAdd }) {
  return (
    <div className="dashboard">
      <div className="destinations-header">
        <h2>Destinations</h2>
        <button className="btn-add" onClick={onAdd}>+ Add Destination</button>
      </div>
      {destinations.length === 0 ? (
        <div className="empty-state">
          <p>No destinations configured yet.</p>
          <p>Add a destination to start multistreaming.</p>
        </div>
      ) : (
        <div className="destinations-grid">
          {destinations.map((dest) => (
            <DestinationCard
              key={dest.id}
              destination={dest}
              ingestActive={ingestActive}
            />
          ))}
        </div>
      )}
    </div>
  );
}
