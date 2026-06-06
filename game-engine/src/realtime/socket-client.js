/**
 * Game Socket Client
 * Browser-side wrapper for Socket.IO game connection
 * Usage: import { createGameClient } from '@lozzalingo/game-engine/client'
 */

const { EVENTS } = require("../types");

/**
 * Create a game socket client
 * @param {import('socket.io-client').Socket} socket - Socket.IO client instance
 */
function createGameClient(socket) {
  const listeners = new Map();

  function on(event, handler) {
    socket.on(event, handler);
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(handler);
  }

  function off(event, handler) {
    socket.off(event, handler);
  }

  function cleanup() {
    for (const [event, handlers] of listeners) {
      for (const handler of handlers) {
        socket.off(event, handler);
      }
    }
    listeners.clear();
  }

  return {
    socket,

    // ── Host Actions ───────────────────────────────────────────

    createGame(config, questions = null, tasks = null) {
      return new Promise((resolve) => {
        socket.emit(EVENTS.GAME_CREATE, {
          hostId: socket.id,
          config,
          questions,
          tasks,
        }, resolve);
      });
    },

    startGame() {
      return new Promise((resolve) => {
        socket.emit(EVENTS.GAME_START, {}, resolve);
      });
    },

    nextRound() {
      return new Promise((resolve) => {
        socket.emit(EVENTS.GAME_NEXT_ROUND, {}, resolve);
      });
    },

    endGame() {
      return new Promise((resolve) => {
        socket.emit(EVENTS.GAME_END, {}, resolve);
      });
    },

    // ── Player Actions ─────────────────────────────────────────

    joinGame(gameCode, playerName) {
      return new Promise((resolve) => {
        socket.emit(EVENTS.GAME_JOIN, { gameCode, playerName }, resolve);
      });
    },

    submitAnswer(answerIndex) {
      return new Promise((resolve) => {
        socket.emit(EVENTS.GAME_ANSWER, { answerIndex }, resolve);
      });
    },

    completeTask(taskId, proof = null) {
      return new Promise((resolve) => {
        socket.emit(EVENTS.GAME_TASK_COMPLETE, { taskId, proof }, resolve);
      });
    },

    // ── Event Listeners ────────────────────────────────────────

    onStateUpdate(handler) { on(EVENTS.GAME_STATE_UPDATE, handler); },
    onQuestion(handler) { on(EVENTS.GAME_QUESTION, handler); },
    onAnswerReveal(handler) { on(EVENTS.GAME_ANSWER_REVEAL, handler); },
    onLeaderboard(handler) { on(EVENTS.GAME_LEADERBOARD, handler); },
    onResults(handler) { on(EVENTS.GAME_RESULTS, handler); },
    onPlayerJoined(handler) { on(EVENTS.GAME_PLAYER_JOINED, handler); },
    onPlayerLeft(handler) { on(EVENTS.GAME_PLAYER_LEFT, handler); },
    onError(handler) { on(EVENTS.GAME_ERROR, handler); },

    cleanup,

    EVENTS,
  };
}

module.exports = { createGameClient, EVENTS };
