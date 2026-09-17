/**
 * Thin client for the centralised Storage service.
 * Replaces direct @aws-sdk/client-s3 usage with HTTP calls
 * to the Storage service.
 *
 * Usage:
 *   const { StorageClient } = require('@lozzalingo/storage/server/storage-client');
 *   const client = new StorageClient();
 *
 *   // Upload a buffer
 *   const result = await client.upload(buffer, 'photo.jpg', { siteId: 'fat-big-quiz' });
 *   // result = { cdnUrl: 'https://cdn.../photo.jpg', fileId: 'abc123', sizeBytes: 45678 }
 *
 *   // Upload with image processing (resize + WebP) - handled server-side
 *   const result = await client.upload(buffer, 'hero.png', {
 *     siteId: 'fat-big-quiz', processImage: true, maxWidth: 1200
 *   });
 *
 *   // Get a signed URL
 *   const signed = await client.getSignedUrl('abc123', 3600);
 *   // signed = { url: 'https://...?Signature=...', expiresAt: '...' }
 *
 *   // Delete
 *   await client.delete('abc123');
 *
 *   // List files
 *   const files = await client.listFiles('blog', { siteId: 'crowd-sauced' });
 */

const path = require('path');
const fs = require('fs');

class StorageClient {
  constructor(options = {}) {
    this.url = options.serviceUrl || process.env.STORAGE_SERVICE_URL || 'https://storage.laurence.computer';
    this.key = options.apiKey || process.env.STORAGE_API_KEY || '';
  }

  // -------------------------------------------------------------------
  // Upload
  // -------------------------------------------------------------------

  /**
   * Upload a file buffer to the centralised Storage service.
   *
   * @param {Buffer} fileBuffer - Raw file bytes.
   * @param {string} filename - Target filename (e.g. "photo.jpg").
   * @param {Object} [opts]
   * @param {string} [opts.siteId] - Identifier for the calling site.
   * @param {string} [opts.subfolder] - Optional subfolder (e.g. "blog").
   * @param {boolean} [opts.processImage=true] - Whether the service should compress/resize.
   * @param {number} [opts.maxWidth] - Optional max pixel width for resizing.
   * @returns {Promise<{cdnUrl: string, fileId: string, sizeBytes: number}|null>}
   */
  async upload(fileBuffer, filename, { siteId, subfolder, processImage = true, maxWidth } = {}) {
    try {
      const FormData = await this._getFormData();
      const form = new FormData();

      form.append('file', new Blob([fileBuffer]), filename);
      form.append('site_id', siteId || this._detectSiteId());
      if (subfolder) form.append('subfolder', subfolder);
      form.append('process_image', processImage ? '1' : '0');
      if (maxWidth != null) form.append('max_width', String(Math.round(maxWidth)));

      const resp = await fetch(`${this.url}/api/storage/upload`, {
        method: 'POST',
        headers: { 'X-Storage-Key': this.key },
        body: form,
        signal: AbortSignal.timeout(30000),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        console.error(`[StorageClient] Upload returned ${resp.status}: ${text.slice(0, 200)}`);
        return null;
      }

      const result = await resp.json();
      console.log(`[StorageClient] Uploaded via service: ${result.cdn_url || ''}`);

      return {
        cdnUrl: result.cdn_url || '',
        fileId: result.file_id || '',
        sizeBytes: result.size_bytes || 0,
      };
    } catch (error) {
      console.error('[StorageClient] Upload failed:', error.message);
      return null;
    }
  }

  /**
   * Convenience method to upload a file from a local path.
   *
   * @param {string} filePath - Absolute or relative path to the file.
   * @param {Object} [opts] - Same options as upload().
   * @returns {Promise<{cdnUrl: string, fileId: string, sizeBytes: number}|null>}
   */
  async uploadFromPath(filePath, opts = {}) {
    try {
      const buffer = fs.readFileSync(filePath);
      const filename = path.basename(filePath);
      return await this.upload(buffer, filename, opts);
    } catch (error) {
      console.error('[StorageClient] uploadFromPath failed:', error.message);
      return null;
    }
  }

  // -------------------------------------------------------------------
  // Signed URLs
  // -------------------------------------------------------------------

  /**
   * Get a time-limited signed URL for a protected file.
   *
   * @param {string} fileId - The file identifier returned from upload().
   * @param {number} [expiresIn=3600] - Lifetime of the URL in seconds.
   * @returns {Promise<{url: string, expiresAt: string}|null>}
   */
  async getSignedUrl(fileId, expiresIn = 3600) {
    try {
      const params = new URLSearchParams({ expires_in: String(expiresIn) });
      const resp = await fetch(
        `${this.url}/api/storage/signed-url/${encodeURIComponent(fileId)}?${params}`,
        {
          headers: { 'X-Storage-Key': this.key },
          signal: AbortSignal.timeout(10000),
        },
      );

      if (!resp.ok) {
        console.error(`[StorageClient] Signed URL returned ${resp.status}`);
        return null;
      }

      const data = await resp.json();
      return { url: data.url || '', expiresAt: data.expires_at || '' };
    } catch (error) {
      console.error('[StorageClient] Signed URL failed:', error.message);
      return null;
    }
  }

  // -------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------

  /**
   * Delete a file from the Storage service.
   *
   * @param {string} fileIdOrUrl - A file_id or a full CDN URL.
   * @returns {Promise<boolean>}
   */
  async delete(fileIdOrUrl) {
    if (!fileIdOrUrl) {
      console.warn('[StorageClient] delete() called without identifier');
      return false;
    }

    const isUrl = fileIdOrUrl.startsWith('http');
    const payload = isUrl
      ? { file_url: fileIdOrUrl }
      : { file_id: fileIdOrUrl };

    try {
      const resp = await fetch(`${this.url}/api/storage/delete`, {
        method: 'POST',
        headers: {
          'X-Storage-Key': this.key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      if (resp.ok) {
        console.log(`[StorageClient] Deleted: ${fileIdOrUrl}`);
        return true;
      }
      console.error(`[StorageClient] Delete returned ${resp.status}`);
      return false;
    } catch (error) {
      console.error('[StorageClient] Delete failed:', error.message);
      return false;
    }
  }

  // -------------------------------------------------------------------
  // List files
  // -------------------------------------------------------------------

  /**
   * List files in a subfolder.
   *
   * @param {string} [subfolder=''] - Subfolder to list.
   * @param {Object} [opts]
   * @param {string} [opts.siteId] - Site identifier.
   * @returns {Promise<Array<{url: string, filename: string, sizeBytes: number}>>}
   */
  async listFiles(subfolder = '', { siteId } = {}) {
    try {
      const params = new URLSearchParams({
        site_id: siteId || this._detectSiteId(),
        subfolder,
      });

      const resp = await fetch(`${this.url}/api/storage/list?${params}`, {
        headers: { 'X-Storage-Key': this.key },
        signal: AbortSignal.timeout(15000),
      });

      if (!resp.ok) {
        console.error(`[StorageClient] List returned ${resp.status}`);
        return [];
      }

      const data = await resp.json();
      return data.files || [];
    } catch (error) {
      console.error('[StorageClient] List failed:', error.message);
      return [];
    }
  }

  // -------------------------------------------------------------------
  // File info
  // -------------------------------------------------------------------

  /**
   * Get metadata for a single file.
   *
   * @param {string} fileId - The file identifier.
   * @returns {Promise<Object|null>}
   */
  async getFileInfo(fileId) {
    try {
      const resp = await fetch(
        `${this.url}/api/storage/info/${encodeURIComponent(fileId)}`,
        {
          headers: { 'X-Storage-Key': this.key },
          signal: AbortSignal.timeout(10000),
        },
      );

      if (!resp.ok) return null;
      return await resp.json();
    } catch (error) {
      console.error('[StorageClient] File info failed:', error.message);
      return null;
    }
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  /**
   * Get FormData implementation - uses built-in in Node 18+.
   * @returns {Promise<typeof FormData>}
   */
  async _getFormData() {
    if (typeof globalThis.FormData !== 'undefined') {
      return globalThis.FormData;
    }
    // Fallback for older Node versions
    const { FormData } = await import('undici');
    return FormData;
  }

  /**
   * Try to detect site ID from environment.
   * Checks SITE_ID first, then parses SITE_MONITOR_KEY (format: sm_{site_id}_{random}).
   * @returns {string}
   */
  _detectSiteId() {
    if (process.env.SITE_ID) return process.env.SITE_ID;

    const smKey = process.env.SITE_MONITOR_KEY || '';
    if (smKey.startsWith('sm_') && smKey.split('_').length >= 3) {
      const parts = smKey.split('_');
      return parts.slice(1, -1).join('_');
    }
    return '';
  }
}

module.exports = { StorageClient };
