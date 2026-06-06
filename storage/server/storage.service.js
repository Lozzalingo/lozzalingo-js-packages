/**
 * @lozzalingo/storage - Cloud Storage Service
 * Supports DigitalOcean Spaces (S3-compatible) and local file storage
 * Auto-compresses images with sharp
 */

const path = require('path');
const fs = require('fs');

function createStorageService(options = {}) {
  const {
    provider = process.env.STORAGE_TYPE || 'local',
    spacesRegion = process.env.DO_SPACES_REGION,
    spacesName = process.env.DO_SPACES_NAME,
    spacesKey = process.env.DO_SPACES_KEY,
    spacesSecret = process.env.DO_SPACES_SECRET,
    localPath = './public/uploads',
    maxWidth = 1920,
    convertToWebP = true,
  } = options;

  console.log(`[Storage] Initializing storage service (provider: ${provider})`);

  let s3Client = null;

  if (provider === 'spaces' && spacesRegion && spacesKey && spacesSecret) {
    try {
      const { S3Client } = require('@aws-sdk/client-s3');
      s3Client = new S3Client({
        endpoint: `https://${spacesRegion}.digitaloceanspaces.com`,
        region: spacesRegion,
        credentials: {
          accessKeyId: spacesKey,
          secretAccessKey: spacesSecret,
        },
      });
      console.log('[Storage] S3 client initialized for Spaces');
    } catch (error) {
      console.error('[Storage] Failed to initialize S3 client:', error.message);
    }
  }

  async function processImage(fileBuffer, filename) {
    // Skip processing for non-images and GIFs
    const ext = path.extname(filename).toLowerCase();
    const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.tiff'];
    if (!imageExts.includes(ext)) {
      return { buffer: fileBuffer, filename };
    }

    try {
      const sharp = require('sharp');
      let pipeline = sharp(fileBuffer).resize(maxWidth, null, {
        withoutEnlargement: true,
        fit: 'inside',
      });

      let newFilename = filename;
      if (convertToWebP && ext !== '.webp') {
        pipeline = pipeline.webp({ quality: 85 });
        newFilename = filename.replace(/\.[^.]+$/, '.webp');
      } else if (ext === '.jpg' || ext === '.jpeg') {
        pipeline = pipeline.jpeg({ quality: 85 });
      } else if (ext === '.png') {
        pipeline = pipeline.png({ compressionLevel: 8 });
      }

      const buffer = await pipeline.toBuffer();
      console.log(`[Storage] Image processed: ${filename} -> ${newFilename} (${fileBuffer.length} -> ${buffer.length} bytes)`);
      return { buffer, filename: newFilename };
    } catch (error) {
      console.warn('[Storage] Image processing failed, using original:', error.message);
      return { buffer: fileBuffer, filename };
    }
  }

  async function uploadFile(fileBuffer, filename, subfolder = '') {
    console.log(`[Storage] Uploading file: ${filename} to ${subfolder || '/'}`);

    // Process images
    const { buffer, filename: processedFilename } = await processImage(fileBuffer, filename);
    const timestamp = Date.now();
    const safeName = `${path.parse(processedFilename).name}_${timestamp}${path.extname(processedFilename)}`;
    const key = subfolder ? `${subfolder}/${safeName}` : safeName;

    if (provider === 'spaces' && s3Client) {
      try {
        const { PutObjectCommand } = require('@aws-sdk/client-s3');
        await s3Client.send(new PutObjectCommand({
          Bucket: spacesName,
          Key: key,
          Body: buffer,
          ACL: 'public-read',
          ContentType: getMimeType(processedFilename),
        }));

        const url = `https://${spacesName}.${spacesRegion}.digitaloceanspaces.com/${key}`;
        console.log(`[Storage] Uploaded to Spaces: ${url}`);
        return url;
      } catch (error) {
        console.error('[Storage] Spaces upload error:', error.message);
        throw error;
      }
    }

    // Local fallback
    const fullDir = path.join(localPath, subfolder);
    fs.mkdirSync(fullDir, { recursive: true });
    const fullPath = path.join(fullDir, safeName);
    fs.writeFileSync(fullPath, buffer);

    const url = `/uploads/${key}`;
    console.log(`[Storage] Saved locally: ${url}`);
    return url;
  }

  async function listFiles(subfolder = '') {
    console.log(`[Storage] Listing files in: ${subfolder || '/'}`);

    if (provider === 'spaces' && s3Client) {
      try {
        const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
        const result = await s3Client.send(new ListObjectsV2Command({
          Bucket: spacesName,
          Prefix: subfolder ? `${subfolder}/` : '',
        }));

        return (result.Contents || []).map(obj => ({
          url: `https://${spacesName}.${spacesRegion}.digitaloceanspaces.com/${obj.Key}`,
          filename: path.basename(obj.Key),
          size: obj.Size,
          lastModified: obj.LastModified,
        }));
      } catch (error) {
        console.error('[Storage] Spaces list error:', error.message);
        throw error;
      }
    }

    // Local
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

  async function deleteFile(fileUrl) {
    console.log(`[Storage] Deleting file: ${fileUrl}`);

    if (provider === 'spaces' && s3Client) {
      try {
        const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
        // Extract key from URL
        const urlObj = new URL(fileUrl);
        const key = urlObj.pathname.substring(1);

        await s3Client.send(new DeleteObjectCommand({
          Bucket: spacesName,
          Key: key,
        }));

        console.log('[Storage] Deleted from Spaces');
        return true;
      } catch (error) {
        console.error('[Storage] Spaces delete error:', error.message);
        return false;
      }
    }

    // Local
    try {
      const filePath = path.join(localPath, fileUrl.replace('/uploads/', ''));
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

    if (provider === 'spaces' && s3Client) {
      try {
        const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
        const result = await s3Client.send(new ListObjectsV2Command({
          Bucket: spacesName,
        }));

        const files = result.Contents || [];
        const totalSize = files.reduce((sum, f) => sum + (f.Size || 0), 0);

        return {
          totalFiles: files.length,
          totalSize,
          totalSizeFormatted: formatBytes(totalSize),
          provider: 'spaces',
        };
      } catch (error) {
        console.error('[Storage] Spaces stats error:', error.message);
        return { totalFiles: 0, totalSize: 0, provider: 'spaces', error: error.message };
      }
    }

    // Local
    try {
      let totalFiles = 0;
      let totalSize = 0;

      function walkDir(dir) {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walkDir(fullPath);
          } else {
            totalFiles++;
            totalSize += fs.statSync(fullPath).size;
          }
        }
      }

      walkDir(localPath);

      return {
        totalFiles,
        totalSize,
        totalSizeFormatted: formatBytes(totalSize),
        provider: 'local',
      };
    } catch (error) {
      return { totalFiles: 0, totalSize: 0, provider: 'local', error: error.message };
    }
  }

  return { uploadFile, listFiles, deleteFile, getUsageStats };
}

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const types = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf', '.zip': 'application/zip',
    '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
  };
  return types[ext] || 'application/octet-stream';
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = { createStorageService };
