/**
 * @lozzalingo/storage/client - Browser-side image storage SDK
 *
 * Provides upload, delete, list, and URL utility functions.
 * Talks to the @lozzalingo/storage server routes (mounted at /api/storage by default).
 *
 * Usage:
 *   import { configureStorage, uploadImage, listImages } from '@lozzalingo/storage/client';
 *   configureStorage({ baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL });
 *   const result = await uploadImage(file, 'blog-body');
 */

var _baseUrl = '';
var _mountPath = '/api/storage';
var _headers = {};

/**
 * Set the API base URL and optional config. Call once at app startup.
 * @param {object} options
 * @param {string} options.baseUrl - e.g. 'https://api.example.com' or process.env.NEXT_PUBLIC_API_BASE_URL
 * @param {string} [options.mountPath] - Server route mount path (defaults to '/api/storage')
 * @param {object} [options.headers] - Extra headers to send with every request (e.g. { 'x-admin-secret': '...' })
 */
function configureStorage(options) {
  if (!options || !options.baseUrl) {
    console.error('[Storage Client] configureStorage requires a baseUrl');
    return;
  }
  _baseUrl = options.baseUrl.replace(/\/$/, '');
  if (options.mountPath) {
    _mountPath = options.mountPath.replace(/\/$/, '');
  }
  if (options.headers) {
    _headers = options.headers;
  }
  console.log('[Storage Client] Configured:', _baseUrl + _mountPath);
}

function getBaseUrl() {
  if (!_baseUrl) {
    // Fallback: try env var (works in Next.js client code)
    if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_API_BASE_URL) {
      _baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '');
    }
  }
  if (!_baseUrl) {
    console.error('[Storage Client] No baseUrl configured. Call configureStorage() first.');
  }
  return _baseUrl;
}

function storageUrl(path) {
  return getBaseUrl() + _mountPath + path;
}

/**
 * Upload an image file to a storage folder.
 *
 * Server route: POST /api/storage/upload
 * Expects: FormData with 'file' field + 'folder' field
 * Returns: { success: true, url, filename }
 *
 * @param {File} file - The file to upload
 * @param {string} folder - Target subfolder (e.g. 'blog-body', 'blog-headers', 'products', 'bucketrace/events')
 * @param {object} [options]
 * @param {string} [options.oldFile] - URL of a previous file to delete after upload
 * @returns {Promise<{ url: string, filename: string }>}
 */
async function uploadImage(file, folder, options) {
  var base = getBaseUrl();
  if (!base) throw new Error('[Storage Client] No baseUrl configured');

  var formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  console.log('[Storage Client] Uploading to folder:', folder);

  var response = await fetch(storageUrl('/upload'), {
    method: 'POST',
    headers: Object.assign({}, _headers),
    body: formData,
  });

  if (!response.ok) {
    var errorData = await response.json().catch(function () { return {}; });
    throw new Error(errorData.error || 'Image upload failed');
  }

  var data = await response.json();
  var url = data.url || '';
  var filename = data.filename || getFilenameFromUrl(url) || '';

  console.log('[Storage Client] Upload complete:', url);

  // If an old file was specified, delete it after successful upload
  if (options && options.oldFile) {
    try {
      await deleteImage(options.oldFile);
    } catch (err) {
      console.error('[Storage Client] Failed to delete old file:', err);
      // Don't throw, upload was successful
    }
  }

  return { url: url, filename: filename };
}

/**
 * Delete a file from storage by its full URL.
 *
 * Server route: DELETE /api/storage/file
 * Expects: { url: '...' }
 *
 * @param {string} fileUrl - Full URL of the file to delete
 * @returns {Promise<boolean>} true if deleted
 */
async function deleteImage(fileUrl) {
  var base = getBaseUrl();
  if (!base) throw new Error('[Storage Client] No baseUrl configured');

  console.log('[Storage Client] Deleting:', fileUrl);

  var response = await fetch(storageUrl('/file'), {
    method: 'DELETE',
    headers: Object.assign({ 'Content-Type': 'application/json' }, _headers),
    body: JSON.stringify({ url: fileUrl }),
  });

  if (!response.ok) {
    console.error('[Storage Client] Delete failed:', response.status);
    return false;
  }

  console.log('[Storage Client] Delete complete');
  return true;
}

/**
 * List all files in a storage folder.
 *
 * Server route: GET /api/storage/files/:folder
 * Returns: { files: [{ url, filename, size, lastModified }] }
 *
 * @param {string} folder - Folder to list (e.g. 'blog-body', 'products')
 * @returns {Promise<Array<{ url: string, filename: string, size?: number, lastModified?: string }>>}
 */
async function listImages(folder) {
  var base = getBaseUrl();
  if (!base) throw new Error('[Storage Client] No baseUrl configured');

  console.log('[Storage Client] Listing images in:', folder);

  var response = await fetch(storageUrl('/files/' + encodeURIComponent(folder)), {
    headers: Object.assign({}, _headers),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch images');
  }

  var data = await response.json();
  // Server returns { files: [...] }
  var images = data.files || data.images || [];

  console.log('[Storage Client] Found', images.length, 'images in', folder);
  return images;
}

/**
 * Get storage usage statistics.
 *
 * Server route: GET /api/storage/stats
 *
 * @returns {Promise<{ totalFiles: number, totalSize: number, totalSizeFormatted: string, provider: string }>}
 */
async function getStats() {
  var base = getBaseUrl();
  if (!base) throw new Error('[Storage Client] No baseUrl configured');

  var response = await fetch(storageUrl('/stats'), {
    headers: Object.assign({}, _headers),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch storage stats');
  }

  return await response.json();
}

/**
 * Extract the filename from a storage image URL.
 *
 * @param {string} url - Full image URL
 * @returns {string|null}
 */
function getFilenameFromUrl(url) {
  try {
    var urlPath = url.split('/').pop();
    if (!urlPath) return null;
    return decodeURIComponent(urlPath);
  } catch (error) {
    console.error('[Storage Client] Error extracting filename from URL:', error);
    return null;
  }
}

/**
 * Extract the storage folder from a storage image URL.
 * Recognises common path patterns from DigitalOcean Spaces and local storage.
 *
 * @param {string} url - Full image URL
 * @returns {string|null} e.g. 'blog-body', 'products', 'blog-headers'
 */
function getFolderFromUrl(url) {
  try {
    // Match known folder patterns in URLs:
    // Spaces: https://bucket.region.digitaloceanspaces.com/blog-body/file.jpg
    // Spaces with app prefix: https://bucket.region.digitaloceanspaces.com/ai-blog-builder/blog-body/file.jpg
    // Legacy: /server/images/blog-body/file.jpg
    // Local: /uploads/blog-body/file.jpg
    var knownFolders = ['blog-body', 'blog-headers', 'products', 'events'];
    for (var i = 0; i < knownFolders.length; i++) {
      if (url.includes('/' + knownFolders[i] + '/')) {
        return knownFolders[i];
      }
    }
    return null;
  } catch (error) {
    console.error('[Storage Client] Error extracting folder from URL:', error);
    return null;
  }
}

/**
 * Extract all image URLs from HTML content that belong to managed storage folders.
 *
 * @param {string} htmlContent - HTML string to parse
 * @param {string[]} [folders] - Folder names to match (defaults to ['blog-body', 'products'])
 * @returns {string[]}
 */
function extractImageUrls(htmlContent, folders) {
  if (!htmlContent) return [];
  var matchFolders = folders || ['blog-body', 'products'];
  var parser = new DOMParser();
  var doc = parser.parseFromString(htmlContent, 'text/html');
  var images = Array.from(doc.querySelectorAll('img'));
  return images
    .map(function (img) { return img.src; })
    .filter(function (src) {
      return matchFolders.some(function (f) {
        return src.includes('/' + f + '/');
      });
    });
}

/**
 * Delete images that are no longer used in the content.
 * Only deletes from safe folders (defaults to 'blog-body' only - never auto-deletes product images).
 *
 * @param {string[]} imagesToDelete - Array of full image URLs to delete
 * @param {string[]} [safeFolders] - Folders that are safe to auto-delete from (defaults to ['blog-body'])
 * @returns {Promise<void>}
 */
async function deleteUnusedImages(imagesToDelete, safeFolders) {
  var safe = safeFolders || ['blog-body'];

  var promises = imagesToDelete.map(async function (imageUrl) {
    try {
      var folder = getFolderFromUrl(imageUrl);
      if (!folder) return;

      if (safe.indexOf(folder) === -1) {
        console.log('[Storage Client] Skipping deletion of', folder, 'image:', getFilenameFromUrl(imageUrl));
        return;
      }

      console.log('[Storage Client] Deleting unused image:', imageUrl);
      await deleteImage(imageUrl);
    } catch (error) {
      console.error('[Storage Client] Error during image deletion:', error);
    }
  });

  await Promise.all(promises);
}

module.exports = {
  configureStorage: configureStorage,
  uploadImage: uploadImage,
  deleteImage: deleteImage,
  listImages: listImages,
  getStats: getStats,
  getFilenameFromUrl: getFilenameFromUrl,
  getFolderFromUrl: getFolderFromUrl,
  extractImageUrls: extractImageUrls,
  deleteUnusedImages: deleteUnusedImages,
};
