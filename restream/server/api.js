const express = require('express');

function createApi(store, relayManager) {
  const router = express.Router();

  function maskKey(key) {
    if (!key || key.length <= 4) return '****';
    return '****' + key.slice(-4);
  }

  // List destinations
  router.get('/destinations', (req, res) => {
    const destinations = store.getDestinations().map((d) => ({
      ...d,
      streamKey: maskKey(d.streamKey),
    }));
    res.json(destinations);
  });

  // Add destination
  router.post('/destinations', (req, res) => {
    const { name, rtmpUrl, streamKey, format } = req.body;
    if (!name || !rtmpUrl || !streamKey) {
      return res.status(400).json({ error: 'name, rtmpUrl, and streamKey are required' });
    }
    const dest = store.addDestination({ name, rtmpUrl, streamKey, format });
    res.status(201).json({ ...dest, streamKey: maskKey(dest.streamKey) });
  });

  // Update destination
  router.put('/destinations/:id', (req, res) => {
    const dest = store.updateDestination(req.params.id, req.body);
    if (!dest) return res.status(404).json({ error: 'Destination not found' });
    res.json({ ...dest, streamKey: maskKey(dest.streamKey) });
  });

  // Delete destination
  router.delete('/destinations/:id', (req, res) => {
    relayManager.stopOne(req.params.id);
    const removed = store.removeDestination(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Destination not found' });
    res.json({ ok: true });
  });

  // Start relay for one destination
  router.post('/destinations/:id/start', (req, res) => {
    const result = relayManager.startOne(req.params.id);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  });

  // Stop relay for one destination
  router.post('/destinations/:id/stop', (req, res) => {
    const result = relayManager.stopOne(req.params.id);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  });

  // Full status
  router.get('/status', (req, res) => {
    res.json(relayManager.getStatus());
  });

  return router;
}

module.exports = createApi;
