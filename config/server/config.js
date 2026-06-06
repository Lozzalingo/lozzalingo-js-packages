/**
 * @lozzalingo/config - Centralized Config System
 * 3-tier config resolution: env vars → app defaults → hardcoded defaults
 */

const HARDCODED_DEFAULTS = {
  NODE_ENV: 'development',
  PORT: '3001',
  LOG_LEVEL: 'info',
};

function createConfig(appDefaults = {}) {
  console.log('[Config] Initializing config system');

  function get(key, fallback) {
    // Tier 1: env vars
    if (process.env[key] !== undefined) {
      return process.env[key];
    }
    // Tier 2: app defaults
    if (appDefaults[key] !== undefined) {
      return appDefaults[key];
    }
    // Tier 3: hardcoded defaults
    if (HARDCODED_DEFAULTS[key] !== undefined) {
      return HARDCODED_DEFAULTS[key];
    }
    return fallback !== undefined ? fallback : undefined;
  }

  function getRequired(key) {
    const value = get(key);
    if (value === undefined) {
      throw new Error(`[Config] Required config key "${key}" is not set`);
    }
    return value;
  }

  function getFeatureFlag(flag) {
    const key = flag.startsWith('FEATURE_') ? flag : `FEATURE_${flag}`;
    const value = get(key, 'false');
    return value === 'true' || value === '1';
  }

  function getAllFeatureFlags() {
    const flags = {};
    // Check env vars
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith('FEATURE_')) {
        flags[key] = value === 'true' || value === '1';
      }
    }
    // Check app defaults
    for (const [key, value] of Object.entries(appDefaults)) {
      if (key.startsWith('FEATURE_') && flags[key] === undefined) {
        flags[key] = value === 'true' || value === '1' || value === true;
      }
    }
    return flags;
  }

  function getAll() {
    const config = {};
    // Start with hardcoded defaults
    Object.assign(config, HARDCODED_DEFAULTS);
    // Override with app defaults
    Object.assign(config, appDefaults);
    // Override with env vars (only known keys)
    for (const key of Object.keys(config)) {
      if (process.env[key] !== undefined) {
        config[key] = process.env[key];
      }
    }
    return config;
  }

  function getNonSecretEnvVars() {
    const SECRET_PATTERNS = ['KEY', 'SECRET', 'PASSWORD', 'TOKEN', 'CREDENTIAL', 'PRIVATE'];
    const result = {};
    for (const [key, value] of Object.entries(process.env)) {
      const isSecret = SECRET_PATTERNS.some(pattern => key.toUpperCase().includes(pattern));
      if (!isSecret && !key.startsWith('npm_') && !key.startsWith('_')) {
        result[key] = value;
      }
    }
    return result;
  }

  console.log('[Config] Config system ready');

  return {
    get,
    getRequired,
    getFeatureFlag,
    getAllFeatureFlags,
    getAll,
    getNonSecretEnvVars,
  };
}

module.exports = { createConfig };
