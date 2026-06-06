/**
 * Game Engine Type Definitions (JSDoc)
 * Used by both quiz (FBQ) and hunt (BucketRace) game modes
 */

/**
 * @typedef {'LOBBY' | 'COUNTDOWN' | 'QUESTION' | 'ANSWER_REVEAL' | 'TASK' | 'SCORING' | 'RESULTS' | 'FINISHED'} GamePhase
 */

/**
 * @typedef {'QUIZ' | 'HUNT'} GameMode
 */

/**
 * @typedef {Object} Player
 * @property {string} id
 * @property {string} name
 * @property {string} [teamId]
 * @property {number} score
 * @property {boolean} connected
 * @property {number} streak - consecutive correct answers
 * @property {Object} [answers] - map of questionId -> answer
 */

/**
 * @typedef {Object} Question
 * @property {string} id
 * @property {string} text
 * @property {string} [imageUrl]
 * @property {string[]} options
 * @property {number} correctIndex
 * @property {number} timeLimit - seconds
 * @property {number} points
 * @property {string} [category]
 */

/**
 * @typedef {Object} HuntTask
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {'PHOTO' | 'GPS' | 'TRIVIA' | 'CHALLENGE'} type
 * @property {number} points
 * @property {{lat: number, lng: number}} [location]
 * @property {number} [radiusMetres]
 * @property {boolean} completed
 */

/**
 * @typedef {Object} GameConfig
 * @property {GameMode} mode
 * @property {number} [roundTimeLimit] - seconds per question/task
 * @property {number} [totalRounds]
 * @property {boolean} [showLeaderboardBetweenRounds]
 * @property {boolean} [allowLateJoin]
 * @property {number} [maxPlayers]
 * @property {boolean} [teamMode]
 */

/**
 * @typedef {Object} GameState
 * @property {string} gameCode
 * @property {string} hostId
 * @property {GamePhase} phase
 * @property {GameMode} mode
 * @property {GameConfig} config
 * @property {Object.<string, Player>} players
 * @property {number} currentRound
 * @property {number} totalRounds
 * @property {Question} [currentQuestion]
 * @property {HuntTask[]} [tasks]
 * @property {number} [timer]
 * @property {Array<{name: string, score: number}>} leaderboard
 * @property {number} startedAt
 * @property {number} [endsAt]
 */

// Game event names
const EVENTS = {
  // Host -> Server
  GAME_CREATE: "game:create",
  GAME_START: "game:start",
  GAME_NEXT_ROUND: "game:next-round",
  GAME_END: "game:end",
  GAME_KICK: "game:kick",

  // Player -> Server
  GAME_JOIN: "game:join",
  GAME_ANSWER: "game:answer",
  GAME_TASK_COMPLETE: "game:task-complete",

  // Server -> All
  GAME_STATE_UPDATE: "game:state-update",
  GAME_QUESTION: "game:question",
  GAME_ANSWER_REVEAL: "game:answer-reveal",
  GAME_LEADERBOARD: "game:leaderboard",
  GAME_RESULTS: "game:results",
  GAME_ERROR: "game:error",
  GAME_PLAYER_JOINED: "game:player-joined",
  GAME_PLAYER_LEFT: "game:player-left",
};

module.exports = { EVENTS };
