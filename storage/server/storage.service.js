/**
 * @lozzalingo/storage - Cloud Storage Service
 * Now uses the centralised Storage service via StorageClient.
 * Replaces direct @aws-sdk/client-s3 calls.
 */

const path = require('path');
const fs = require('fs');
const { StorageClient } = require('./storage-client');

function createStorageService(options = {}) {
  const {
    localPath = './public/uploads',
    siteId,
  } = options;

  console.log('[Storage] Initialising storage service (centralised)');

  const storage = new StorageClient();

  async function uploadFile(fileBuffer, filename, subfolder = '') {
    console.log(`[Storage] Uploading file: ${filename} to ${subfolder || '/'}`);

    const result = await storage.upload(fileBuffer, filename, {
      siteId: siteId || storage._detectSiteId(),
      subfolder,
    });

    if (result) {
      console.log(`[Storage] Uploaded via service: ${result.cdnUrl}`);
      return result.cdnUrl;
    }

    // Local fallback if storage service is unavailable
    console.warn('[Storage] Service unavailable, falling back to local storage');
    const timestamp = Date.now();
    const safeName = `${path.parse(filename).name}_${timestamp}${path.extname(filename)}`;
    const key = subfolder ? `${subfolder}/${safeName}` : safeName;
    const fullDir = path.join(localPath, subfolder);
    fs.mkdirSync(fullDir, { recursive: true });
    const fullPath = path.join(fullDir, safeName);
    fs.writeFileSync(fullPath, fileBuffer);

    const url = `/uploads/${key}`;
    console.log(`[Storage] Saved locally: ${url}`);
    return url;
  }

  async function listFiles(subfolder = '') {
    console.log(`[Storage] Listing files in: ${subfolder || '/'}`);

    const files = await storage.listFiles(subfolder, {
      siteId: siteId || storage._detectSiteId(),
    });

    if (files.length > 0 || storage.url) {
      return files;
    }

    // Local fallback
    const fullDir = path.join(localPath, subfolder);
    if (!fs.existsSync(fullDir)) return [];

    return fs.readdirSync(fullDir).map(file => {
      const filePath = path.join(fullDir, file);
      const stats = fs.statSync(filePath);
      return {
        url: `/uploads/${subfolder ? subfolder + '/' : ''}${file}`,
        filename: file,
        size: stats.size,
        lastModified: stats.mtime,
      };
    });
  }

  async function deleteFile(fileIdOrUrl) {
    console.log(`[Storage] Deleting file: ${fileIdOrUrl}`);

    const deleted = await storage.delete(fileIdOrUrl);
    if (deleted) {
      console.log('[Storage] Deleted via service');
      return true;
    }

    // Local fallback
    try {
      const filePath = path.join(localPath, fileIdOrUrl.replace('/uploads/', ''));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('[Storage] Deleted locally');
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Storage] Local delete error:', error.message);
      return false;
    }
  }

  async function getUsageStats() {
    console.log('[Storage] Getting usage stats');
    // TODO: Wire usage stats through centralised storage service
    return {
      totalFiles: 0,
      totalSize: 0,
      totalSizeFormatted: '0 B',
      provider: 'centralised',
    };
  }

  return { uploadFile, listFiles, deleteFile, getUsageStats };
}

module.exports = { createStorageService };
