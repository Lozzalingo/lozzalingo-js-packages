/**
 * @lozzalingo/storage - Storage Routes
 */

const express = require('express');

function createStorageRoutes(storageService) {
  const router = express.Router();

  // POST /upload — Upload file
  router.post('/upload', async (req, res) => {
    try {
      if (!req.files || !req.files.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      console.log('[Storage] Upload request received');
      const { file } = req.files;
      const subfolder = req.body.folder || '';

      const url = await storageService.uploadFile(file.data, file.name, subfolder);
      res.json({ success: true, url, filename: file.name });
    } catch (error) {
      console.error('[Storage] Upload error:', error.message);
      res.status(500).json({ error: 'Failed to upload file' });
    }
  });

  // GET /files/:folder — List files in subfolder
  const listHandler = async (req, res) => {
    try {
      const folder = req.params.folder || '';
      console.log(`[Storage] Listing files in: ${folder || '/'}`);
      const files = await storageService.listFiles(folder);
      res.json({ files });
    } catch (error) {
      console.error('[Storage] List error:', error.message);
      res.status(500).json({ error: 'Failed to list files' });
    }
  };
  router.get('/files', listHandler);
  router.get('/files/:folder', listHandler);

  // DELETE /file — Delete file by URL
  router.delete('/file', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: 'File URL is required' });
      }

      console.log('[Storage] Delete request for:', url);
      const success = await storageService.deleteFile(url);
      res.json({ success });
    } catch (error) {
      console.error('[Storage] Delete error:', error.message);
      res.status(500).json({ error: 'Failed to delete file' });
    }
  });

  // GET /stats — Usage statistics
  router.get('/stats', async (req, res) => {
    try {
      console.log('[Storage] Getting usage stats');
      const stats = await storageService.getUsageStats();
      res.json(stats);
    } catch (error) {
      console.error('[Storage] Stats error:', error.message);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  });

  return router;
}

module.exports = { createStorageRoutes };
