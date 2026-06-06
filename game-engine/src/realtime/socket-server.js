/**
 * Game Socket Server
 * Attaches Socket.IO handlers to an existing server instance
 * Used by FBQ and BucketRace servers
 */

const { GameState } = require("../core/GameState");
const { EVENTS } = require("../types");

// In-memory game store (keyed by gameCode)
const games = new Map();

/**
 * Attach game socket handlers to a Socket.IO instance
 * @param {import('socket.io').Server} io
 * @param {Object} options - { onGameEnd, loadQuestions, loadTasks }
 */
function attachGameHandlers(io, options = {}) {
  const gameNamespace = io.of("/game");

  console.log("[GameSocket] Attaching game handlers");

  gameNamespace.on("connection", (socket) => {
    console.log("[GameSocket] Client connected:", socket.id);

    // ── Host: Create Game ────────────────────────────────────────

    socket.on(EVENTS.GAME_CREATE, async (data, callback) => {
      const { hostId, config, questions, tasks } = data;

      const game = new GameState(hostId, config);

      // Load content
      if (config?.mode === "HUNT" && tasks) {
        game.loadTasks(tasks);
      } else if (questions) {
        game.loadQuestions(questions);
      } else if (options.loadQuestions) {
        const qs = await options.loadQuestions(data);
        game.loadQuestions(qs);
      }

      games.set(game.gameCode, game);
      socket.join(game.gameCode);
      socket.data.gameCode = game.gameCode;
      socket.data.isHost = true;

      console.log(`[GameSocket] Game created: ${game.gameCode}`);
      if (callback) callback({ success: true, gameCode: game.gameCode });
    });

    // ── Player: Join Game ────────────────────────────────────────

    socket.on(EVENTS.GAME_JOIN, (data, callback) => {
      const { gameCode, playerName } = data;
      const game = games.get(gameCode?.toUpperCase());

      if (!game) {
        if (callback) callback({ success: false, error: "Game not found" });
        return;
      }

      const result = game.addPlayer(socket.id, playerName);

      if (!result.success) {
        if (callback) callback(result);
        return;
      }

      socket.join(gameCode);
      socket.data.gameCode = gameCode;
      socket.data.playerId = socket.id;

      // Notify everyone
      gameNamespace.to(gameCode).emit(EVENTS.GAME_PLAYER_JOINED, {
        player: { id: socket.id, name: playerName },
        playerCount: Object.keys(game.players).length,
      });

      if (callback) callback({ success: true, player: result.player, state: game.getPublicState() });
    });

    // ── Host: Start Game ─────────────────────────────────────────

    socket.on(EVENTS.GAME_START, (data, callback) => {
      const game = games.get(socket.data.gameCode);
      if (!game || !socket.data.isHost) return;

      const result = game.startGame();
      if (!result.success) {
        if (callback) callback(result);
        return;
      }

      gameNamespace.to(game.gameCode).emit(EVENTS.GAME_STATE_UPDATE, game.getPublicState());

      // Auto-advance to first question after 3s countdown
      setTimeout(() => {
        const qResult = game.nextQuestion();
        if (qResult.success) {
          gameNamespace.to(game.gameCode).emit(EVENTS.GAME_QUESTION, qResult.question);
          gameNamespace.to(game.gameCode).emit(EVENTS.GAME_STATE_UPDATE, game.getPublicState());

          // Auto-reveal after time limit
          startQuestionTimer(gameNamespace, game);
        }
      }, 3000);

      if (callback) callback({ success: true });
    });

    // ── Host: Next Round ─────────────────────────────────────────

    socket.on(EVENTS.GAME_NEXT_ROUND, (data, callback) => {
      const game = games.get(socket.data.gameCode);
      if (!game || !socket.data.isHost) return;

      const result = game.nextQuestion();

      if (result.phase === "FINISHED") {
        gameNamespace.to(game.gameCode).emit(EVENTS.GAME_RESULTS, result);
        if (options.onGameEnd) options.onGameEnd(game);
        games.delete(game.gameCode);
      } else if (result.success) {
        gameNamespace.to(game.gameCode).emit(EVENTS.GAME_QUESTION, result.question);
        gameNamespace.to(game.gameCode).emit(EVENTS.GAME_STATE_UPDATE, game.getPublicState());
        startQuestionTimer(gameNamespace, game);
      }

      if (callback) callback(result);
    });

    // ── Player: Submit Answer ────────────────────────────────────

    socket.on(EVENTS.GAME_ANSWER, (data, callback) => {
      const game = games.get(socket.data.gameCode);
      if (!game) return;

      const result = game.submitAnswer(socket.id, data.answerIndex);

      // Send personal result to player
      if (callback) callback(result);

      // Update host with answer count
      const answered = Object.values(game.players).filter(
        (p) => p.answers[game.currentQuestion?.id] !== undefined
      ).length;

      gameNamespace.to(game.gameCode).emit(EVENTS.GAME_STATE_UPDATE, {
        ...game.getPublicState(),
        answeredCount: answered,
      });
    });

    // ── Player: Complete Task (Hunt mode) ────────────────────────

    socket.on(EVENTS.GAME_TASK_COMPLETE, (data, callback) => {
      const game = games.get(socket.data.gameCode);
      if (!game) return;

      const result = game.completeTask(socket.id, data.taskId, data.proof);
      if (callback) callback(result);

      if (result.success) {
        gameNamespace.to(game.gameCode).emit(EVENTS.GAME_LEADERBOARD, {
          leaderboard: game.getLeaderboard(),
        });
      }
    });

    // ── Host: End Game ───────────────────────────────────────────

    socket.on(EVENTS.GAME_END, (data, callback) => {
      const game = games.get(socket.data.gameCode);
      if (!game || !socket.data.isHost) return;

      const result = game.endGame();
      gameNamespace.to(game.gameCode).emit(EVENTS.GAME_RESULTS, result);

      if (options.onGameEnd) options.onGameEnd(game);
      games.delete(game.gameCode);

      if (callback) callback(result);
    });

    // ── Disconnect ───────────────────────────────────────────────

    socket.on("disconnect", () => {
      const game = games.get(socket.data.gameCode);
      if (game && socket.data.playerId) {
        game.removePlayer(socket.data.playerId);
        gameNamespace.to(game.gameCode).emit(EVENTS.GAME_PLAYER_LEFT, {
          playerId: socket.data.playerId,
          playerCount: Object.values(game.players).filter((p) => p.connected).length,
        });
      }
      console.log("[GameSocket] Client disconnected:", socket.id);
    });
  });

  return { games, gameNamespace };
}

function startQuestionTimer(gameNamespace, game) {
  const timeLimit = (game.currentQuestion?.timeLimit || game.config.roundTimeLimit) * 1000;

  setTimeout(() => {
    if (game.phase === "QUESTION") {
      const reveal = game.revealAnswer();
      gameNamespace.to(game.gameCode).emit(EVENTS.GAME_ANSWER_REVEAL, reveal);
      gameNamespace.to(game.gameCode).emit(EVENTS.GAME_STATE_UPDATE, game.getPublicState());
    }
  }, timeLimit);
}

module.exports = { attachGameHandlers, games };
