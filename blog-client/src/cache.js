/**
 * Simple in-process TTL cache for blog service responses.
 *
 * Default TTL: 60 seconds. Each BlogClient instance gets its own cache,
 * so different sites running in the same process do not collide.
 *
 * Console logging prefix: [Blog]
 */

const DEFAULT_TTL_MS = 60 * 1000;

class MemoryCache {
  /**
   * @param {number} [ttlMs] - Cache entry lifetime in milliseconds (default 60 000).
   */
  constructor(ttlMs) {
    this._ttl = typeof ttlMs === 'number' && ttlMs > 0 ? ttlMs : DEFAULT_TTL_MS;
    /** @type {Map<string, { ts: number, value: unknown }>} */
    this._store = new Map();
  }

  /**
   * Return cached value if it exists and has not expired, otherwise null.
   * @param {string} key
   * @returns {unknown | null}
   */
  get(key) {
    const entry = this._store.get(key);
    if (entry && Date.now() - entry.ts < this._ttl) {
      return entry.value;
    }
    this._store.delete(key);
    return null;
  }

  /**
   * Store a value in the cache.
   * @param {string} key
   * @param {unknown} value
   */
  set(key, value) {
    this._store.set(key, { ts: Date.now(), value });
  }

  /** Remove all entries. */
  clear() {
    this._store.clear();
  }
}

module.exports = { MemoryCache, DEFAULT_TTL_MS };
