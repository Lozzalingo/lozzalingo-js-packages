/**
 * @lozzalingo/storage/client - Browser-side image storage SDK
 *
 * Talks to the @lozzalingo/storage server routes (mounted at /api/storage by default).
 */

export interface StorageConfig {
  /** API base URL, e.g. process.env.NEXT_PUBLIC_API_BASE_URL */
  baseUrl: string;
  /** Server route mount path (defaults to '/api/storage') */
  mountPath?: string;
  /** Extra headers to send with every request (e.g. { 'x-admin-secret': '...' }) */
  headers?: Record<string, string>;
}

export interface UploadOptions {
  /** URL of a previous file to delete after successful upload */
  oldFile?: string;
}

export interface UploadResult {
  url: string;
  filename: string;
}

export interface ImageInfo {
  url: string;
  filename: string;
  size?: number;
  lastModified?: string;
}

export interface StorageStats {
  totalFiles: number;
  totalSize: number;
  totalSizeFormatted: string;
  provider: string;
  error?: string;
}

/** Set the API base URL and optional config. Call once at app startup. */
export function configureStorage(options: StorageConfig): void;

/** Upload an image file to a storage folder. Posts to /api/storage/upload. */
export function uploadImage(file: File, folder: string, options?: UploadOptions): Promise<UploadResult>;

/** Delete a file from storage by its full URL. Calls DELETE /api/storage/file. */
export function deleteImage(fileUrl: string): Promise<boolean>;

/** List all files in a storage folder. Calls GET /api/storage/files/:folder. */
export function listImages(folder: string): Promise<ImageInfo[]>;

/** Get storage usage statistics. Calls GET /api/storage/stats. */
export function getStats(): Promise<StorageStats>;

/** Extract the filename from a storage image URL. */
export function getFilenameFromUrl(url: string): string | null;

/** Extract the storage folder from a storage image URL. */
export function getFolderFromUrl(url: string): string | null;

/** Extract all image URLs from HTML content that belong to managed storage folders. */
export function extractImageUrls(htmlContent: string, folders?: string[]): string[];

/** Delete images that are no longer used in the content. Only deletes from safe folders. */
export function deleteUnusedImages(imagesToDelete: string[], safeFolders?: string[]): Promise<void>;
