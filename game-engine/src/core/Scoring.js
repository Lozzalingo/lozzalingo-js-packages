/**
 * Scoring Module
 * Point calculation, streaks, and time bonuses
 */

const SCORING_DEFAULTS = {
  basePoints: 1000,
  streakMultiplier: 0.1,   // +10% per consecutive correct
  maxStreakBonus: 2.0,      // cap at 2x
  timeBonusMax: 500,        // max bonus for fast answers
  timeBonusWindow: 5,       // seconds for full time bonus
};

/**
 * Calculate points for a correct answer
 */
function calculatePoints(options = {}) {
  const {
    basePoints = SCORING_DEFAULTS.basePoints,
    streak = 0,
    timeRemaining = 0,
    timeLimit = 30,
  } = options;

  // Streak bonus
  const streakMultiplier = Math.min(
    1 + streak * SCORING_DEFAULTS.streakMultiplier,
    SCORING_DEFAULTS.maxStreakBonus
  );

  // Time bonus (faster answers = more points)
  const timeRatio = Math.max(0, timeRemaining / timeLimit);
  const timeBonus = Math.round(SCORING_DEFAULTS.timeBonusMax * timeRatio);

  const total = Math.round(basePoints * streakMultiplier) + timeBonus;

  return {
    base: basePoints,
    streakMultiplier: parseFloat(streakMultiplier.toFixed(2)),
    timeBonus,
    total,
  };
}

/**
 * Generate final game statistics
 */
function generateStats(players, questions) {
  const playerList = Object.values(players);

  if (playerList.length === 0) return { players: 0 };

  const totalCorrect = playerList.reduce((sum, p) => {
    return sum + Object.values(p.answers || {}).filter((a) => a.correct).length;
  }, 0);

  const totalAnswered = playerList.reduce((sum, p) => {
    return sum + Object.keys(p.answers || {}).length;
  }, 0);

  return {
    players: playerList.length,
    totalQuestions: questions?.length || 0,
    totalAnswered,
    totalCorrect,
    accuracy: totalAnswered > 0 ? ((totalCorrect / totalAnswered) * 100).toFixed(1) + "%" : "0%",
    averageScore: Math.round(
      playerList.reduce((sum, p) => sum + p.score, 0) / playerList.length
    ),
    highestScore: Math.max(...playerList.map((p) => p.score)),
    longestStreak: Math.max(...playerList.map((p) => p.streak || 0)),
  };
}

module.exports = { calculatePoints, generateStats, SCORING_DEFAULTS };
