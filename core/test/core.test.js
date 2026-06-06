const { loadConfigFile, deepMerge, deepClone, interpolateEnvVars } = require("../src/config-loader");
const { DEFAULT_CONFIG } = require("../src/defaults");
const path = require("path");
const fs = require("fs");

// ── Config Loader Tests ────────────────────────────────────────────────────────

describe("Config Loader", () => {
  describe("deepMerge", () => {
    test("merges flat objects", () => {
      const target = { a: 1, b: 2 };
      deepMerge(target, { b: 3, c: 4 });
      expect(target).toEqual({ a: 1, b: 3, c: 4 });
    });

    test("deep merges nested objects", () => {
      const target = { site: { name: "Default", tagline: "" } };
      deepMerge(target, { site: { name: "BucketRace" } });
      expect(target.site.name).toBe("BucketRace");
      expect(target.site.tagline).toBe(""); // preserved
    });

    test("overrides arrays entirely", () => {
      const target = { items: [1, 2] };
      deepMerge(target, { items: [3] });
      expect(target.items).toEqual([3]);
    });

    test("adds new nested keys", () => {
      const target = { features: { logging: true } };
      deepMerge(target, { features: { email: true }, newKey: "val" });
      expect(target.features.logging).toBe(true);
      expect(target.features.email).toBe(true);
      expect(target.newKey).toBe("val");
    });
  });

  describe("deepClone", () => {
    test("produces independent copy", () => {
      const original = { a: { b: 1 } };
      const cloned = deepClone(original);
      cloned.a.b = 99;
      expect(original.a.b).toBe(1);
    });
  });

  describe("interpolateEnvVars", () => {
    test("replaces ${VAR} with env value", () => {
      process.env.TEST_LOZZALINGO_VAR = "hello";
      const result = interpolateEnvVars("prefix_${TEST_LOZZALINGO_VAR}_suffix");
      expect(result).toBe("prefix_hello_suffix");
      delete process.env.TEST_LOZZALINGO_VAR;
    });

    test("leaves unset vars as-is", () => {
      const result = interpolateEnvVars("${NONEXISTENT_VAR_12345}");
      expect(result).toBe("${NONEXISTENT_VAR_12345}");
    });

    test("handles nested objects", () => {
      process.env.TEST_LOZZALINGO_KEY = "secret123";
      const result = interpolateEnvVars({
        level1: { level2: "${TEST_LOZZALINGO_KEY}" },
        plain: "no interpolation",
      });
      expect(result.level1.level2).toBe("secret123");
      expect(result.plain).toBe("no interpolation");
      delete process.env.TEST_LOZZALINGO_KEY;
    });

    test("handles arrays", () => {
      process.env.TEST_LOZZALINGO_ITEM = "found";
      const result = interpolateEnvVars(["${TEST_LOZZALINGO_ITEM}", "plain"]);
      expect(result).toEqual(["found", "plain"]);
      delete process.env.TEST_LOZZALINGO_ITEM;
    });

    test("passes through non-strings unchanged", () => {
      expect(interpolateEnvVars(42)).toBe(42);
      expect(interpolateEnvVars(true)).toBe(true);
      expect(interpolateEnvVars(null)).toBe(null);
    });
  });

  describe("loadConfigFile", () => {
    const tmpDir = path.join(__dirname, "tmp-config-test");

    beforeEach(() => fs.mkdirSync(tmpDir, { recursive: true }));
    afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    test("loads JSON config file", () => {
      fs.writeFileSync(
        path.join(tmpDir, "lozzalingo.json"),
        JSON.stringify({ site: { name: "TestSite" }, features: { logging: false } })
      );
      const config = loadConfigFile(tmpDir);
      expect(config.site.name).toBe("TestSite");
      expect(config.features.logging).toBe(false);
    });

    test("loads YAML config file", () => {
      try {
        require("js-yaml");
      } catch (e) {
        // js-yaml not installed, skip
        return;
      }
      fs.writeFileSync(
        path.join(tmpDir, "lozzalingo.yaml"),
        "site:\n  name: YAMLSite\nfeatures:\n  email: false\n"
      );
      const config = loadConfigFile(tmpDir);
      expect(config.site.name).toBe("YAMLSite");
      expect(config.features.email).toBe(false);
    });

    test("returns empty object when no config file found", () => {
      const config = loadConfigFile(tmpDir);
      expect(config).toEqual({});
    });
  });
});

// ── Defaults Tests ─────────────────────────────────────────────────────────────

describe("Default Config", () => {
  test("has site section", () => {
    expect(DEFAULT_CONFIG.site).toBeDefined();
    expect(DEFAULT_CONFIG.site.name).toBe("Lozzalingo Site");
  });

  test("has features section with booleans", () => {
    expect(DEFAULT_CONFIG.features).toBeDefined();
    expect(typeof DEFAULT_CONFIG.features.logging).toBe("boolean");
    expect(typeof DEFAULT_CONFIG.features.email).toBe("boolean");
  });

  test("core features default to true", () => {
    expect(DEFAULT_CONFIG.features.logging).toBe(true);
    expect(DEFAULT_CONFIG.features.email).toBe(true);
    expect(DEFAULT_CONFIG.features.settings).toBe(true);
    expect(DEFAULT_CONFIG.features.ops).toBe(true);
    expect(DEFAULT_CONFIG.features.auth).toBe(true);
  });

  test("optional features default to false", () => {
    expect(DEFAULT_CONFIG.features.game_engine).toBe(false);
    expect(DEFAULT_CONFIG.features.restream).toBe(false);
    expect(DEFAULT_CONFIG.features.merchandise).toBe(false);
  });

  test("has routes section with default paths", () => {
    expect(DEFAULT_CONFIG.routes.logging).toBe("/api/logs");
    expect(DEFAULT_CONFIG.routes.email).toBe("/api/emails");
    expect(DEFAULT_CONFIG.routes.health).toBe("/api/health");
  });
});
