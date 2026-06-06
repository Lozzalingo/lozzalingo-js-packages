const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const Store = require('./store');
const RelayManager = require('./relay');
const createApi = require('./api');
const createRtmpServer = require('./rtmp');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

// Initialize store
const store = new Store(path.join(DATA_DIR, 'config.json'));

// Initialize relay manager
const relayManager = new RelayManager(store);

// Express app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', createApi(store, relayManager));

// Serve built React client in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// HTTP + WebSocket server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Broadcast status to all connected clients every 2 seconds
setInterval(() => {
  const status = relayManager.getStatus();
  const payload = JSON.stringify(status);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}, 2000);

// RTMP server
const nms = createRtmpServer(
  (id, streamPath) => relayManager.startAll(streamPath),
  (id, streamPath) => relayManager.stopAll()
);

// Start servers
nms.run();
server.listen(PORT, () => {
  console.log(`[Restream] Dashboard: http://localhost:${PORT}`);
  console.log(`[Restream] RTMP ingest: rtmp://localhost:1935/live/<your-key>`);
});
