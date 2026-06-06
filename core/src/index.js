/**
 * @lozzalingo/core
 *
 * Framework orchestrator - mirrors the Python framework's Lozzalingo class.
 * Reads a config file, auto-registers all enabled packages, wires hooks.
 *
 * Usage (identical pattern to Python):
 *
 *   Python:
 *     from lozzalingo import Lozzalingo
 *     lozzalingo = Lozzalingo(app)
 *
 *   JS:
 *     const { Lozzalingo } = require('@lozzalingo/core');
 *     const lz = new Lozzalingo(app, prisma);
 */

const { Lozzalingo, createLozzalingo } = require("./lozzalingo");
const { loadConfigFile, deepMerge, deepClone } = require("./config-loader");
const { DEFAULT_CONFIG } = require("./defaults");

module.exports = {
  Lozzalingo,
  createLozzalingo,
  loadConfigFile,
  deepMerge,
  deepClone,
  DEFAULT_CONFIG,
};
