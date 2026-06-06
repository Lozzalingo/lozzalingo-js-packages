const { GameState } = require("./core/GameState");
const { calculatePoints, generateStats, SCORING_DEFAULTS } = require("./core/Scoring");
const { EVENTS } = require("./types");

module.exports = {
  GameState,
  calculatePoints,
  generateStats,
  SCORING_DEFAULTS,
  EVENTS,
};
