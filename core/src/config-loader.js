/**
 * Config Loader
 *
 * Loads lozzalingo.yaml / lozzalingo.yml / lozzalingo.json / lozzalingo.config.js
 * from the site root. Mirrors Python framework's _load_yaml_config().
 *
 * Resolution order:
 *   1. lozzalingo.yaml (or .yml)
 *   2. lozzalingo.json
 *   3. lozzalingo.config.js
 */

const fs = require("fs");
const path = require("path");

/**
 * Interpolate ${ENV_VAR} references in string values.
 */
function interpolateEnvVars(obj) {
  if (typeof obj === "string") {
    return obj.replace(/\$\{(\w+)\}/g, (match, varName) => {
      return process.env[varName] || match;
    });
  }
  if (Array.isArray(obj)) {
    return obj.map(interpolateEnvVars);
  }
  if (obj && typeof obj === "object") {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateEnvVars(value);
    }
    return result;
  }
  return obj;
}

/**
 * Deep merge source into target (modifies target in place).
 */
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

/**
 * Deep clone an object.
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Load config from file. Searches cwd and optional basePath.
 * Returns the parsed config object, or {} if no file found.
 */
function loadConfigFile(basePath) {
  const searchDirs = [basePath, process.cwd()].filter(Boolean);

  for (const dir of searchDirs) {
    // Try YAML first
    for (const yamlName of ["lozzalingo.yaml", "lozzalingo.yml"]) {
      const yamlPath = path.join(dir, yamlName);
      if (fs.existsSync(yamlPath)) {
        try {
          const yaml = require("js-yaml");
          const content = fs.readFileSync(yamlPath, "utf8");
          const parsed = yaml.load(content) || {};
          console.log("[Core] Loaded config from", yamlPath);
          return interpolateEnvVars(parsed);
        } catch (err) {
          if (err.code === "MODULE_NOT_FOUND") {
            console.warn(
              "[Core] Found",
              yamlName,
              "but js-yaml is not installed. Run: npm install js-yaml"
            );
          } else {
            console.error("[Core] Failed to parse", yamlPath, ":", err.message);
          }
        }
      }
    }

    // Try JSON
    const jsonPath = path.join(dir, "lozzalingo.json");
    if (fs.existsSync(jsonPath)) {
      try {
        const content = fs.readFileSync(jsonPath, "utf8");
        const parsed = JSON.parse(content);
        console.log("[Core] Loaded config from", jsonPath);
        return interpolateEnvVars(parsed);
      } catch (err) {
        console.error("[Core] Failed to parse", jsonPath, ":", err.message);
      }
    }

    // Try JS module
    const jsPath = path.join(dir, "lozzalingo.config.js");
    if (fs.existsSync(jsPath)) {
      try {
        const parsed = require(jsPath);
        console.log("[Core] Loaded config from", jsPath);
        return interpolateEnvVars(parsed);
      } catch (err) {
        console.error("[Core] Failed to load", jsPath, ":", err.message);
      }
    }
  }

  console.log("[Core] No config file found, using defaults");
  return {};
}

module.exports = { loadConfigFile, deepMerge, deepClone, interpolateEnvVars };
