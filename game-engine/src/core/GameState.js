/**
 * GameState - Core state machine for game sessions
 * Manages phase transitions, players, scoring, and timers
 */

const { nanoid } = require("nanoid");
const { EVENTS } = require("../types");

class GameState {
  constructor(hostId, config = {}) {
    this.gameCode = this._generateCode();
    this.hostId = hostId;
    this.mode = config.mode || "QUIZ";
    this.phase = "LOBBY";
    this.config = {
      roundTimeLimit: config.roundTimeLimit || 30,
      totalRounds: config.totalRounds || 10,
      showLeaderboardBetweenRounds: config.showLeaderboardBetweenRounds !== false,
      allowLateJoin: config.allowLateJoin !== false,
      maxPlayers: config.maxPlayers || 50,
      teamMode: config.teamMode || false,
      ...config,
    };
    this.players = {};
    this.currentRound = 0;
    this.totalRounds = 0;
    this.questions = [];
    this.tasks = [];
    this.currentQuestion = null;
    this.timer = null;
    this.startedAt = null;
    this.endsAt = null;

    console.log(`[GameState] Created game ${this.gameCode} (${this.mode}) by host ${hostId}`);
  }

  _generateCode() {
    // 6-digit alphanumeric code (uppercase, no ambiguous chars)
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  // ── Player Management ──────────────────────────────────────────

  addPlayer(id, name) {
    if (Object.keys(this.players).length >= this.config.maxPlayers) {
      console.log(`[GameState] Game ${this.gameCode} full, rejecting ${name}`);
      return { success: false, error: "Game is full" };
    }

    if (this.phase !== "LOBBY" && !this.config.allowLateJoin) {
      return { success: false, error: "Game already in progress" };
    }

    this.players[id] = {
      id,
      name,
      score: 0,
      connected: true,
      streak: 0,
      answers: {},
    };

    console.log(`[GameState] Player joined: ${name} (${id}) in game ${this.gameCode}`);
    return { success: true, player: this.players[id] };
  }

  removePlayer(id) {
    if (this.players[id]) {
      this.players[id].connected = false;
      console.log(`[GameState] Player disconnected: ${this.players[id].name} from ${this.gameCode}`);
    }
  }

  reconnectPlayer(id) {
    if (this.players[id]) {
      this.players[id].connected = true;
      console.log(`[GameState] Player reconnected: ${this.players[id].name} in ${this.gameCode}`);
      return true;
    }
    return false;
  }

  // ── Quiz Mode ──────────────────────────────────────────────────

  loadQuestions(questions) {
    this.questions = questions;
    this.totalRounds = questions.length;
    console.log(`[GameState] Loaded ${questions.length} questions for game ${this.gameCode}`);
  }

  startGame() {
    if (this.phase !== "LOBBY") {
      return { success: false, error: "Game already started" };
    }

    const playerCount = Object.keys(this.players).length;
    if (playerCount === 0) {
      return { success: false, error: "No players have joined" };
    }

    this.phase = "COUNTDOWN";
    this.startedAt = Date.now();
    this.currentRound = 0;

    console.log(`[GameState] Game ${this.gameCode} started with ${playerCount} players`);
    return { success: true };
  }

  nextQuestion() {
    if (this.currentRound >= this.totalRounds) {
      return this.endGame();
    }

    this.currentQuestion = this.questions[this.currentRound];
    this.currentRound++;
    this.phase = "QUESTION";
    this.timer = this.currentQuestion.timeLimit || this.config.roundTimeLimit;

    console.log(`[GameState] Round ${this.currentRound}/${this.totalRounds} in game ${this.gameCode}`);

    // Return question without correct answer (for broadcast to players)
    return {
      success: true,
      phase: "QUESTION",
      question: {
        id: this.currentQuestion.id,
        text: this.currentQuestion.text,
        imageUrl: this.currentQuestion.imageUrl,
        options: this.currentQuestion.options,
        timeLimit: this.timer,
        round: this.currentRound,
        totalRounds: this.totalRounds,
      },
    };
  }

  submitAnswer(playerId, answerIndex) {
    const player = this.players[playerId];
    if (!player || this.phase !== "QUESTION" || !this.currentQuestion) {
      return { success: false };
    }

    // Already answered this question
    if (player.answers[this.currentQuestion.id] !== undefined) {
      return { success: false, error: "Already answered" };
    }

    const isCorrect = answerIndex === this.currentQuestion.correctIndex;
    const basePoints = this.currentQuestion.points || 1000;

    let points = 0;
    if (isCorrect) {
      // Streak bonus: 10% extra per consecutive correct
      const streakBonus = 1 + (player.streak * 0.1);
      points = Math.round(basePoints * streakBonus);
      player.streak++;
    } else {
      player.streak = 0;
    }

    player.score += points;
    player.answers[this.currentQuestion.id] = {
      answer: answerIndex,
      correct: isCorrect,
      points,
      timestamp: Date.now(),
    };

    console.log(`[GameState] ${player.name} answered ${isCorrect ? "correctly" : "incorrectly"} (+${points})`);

    return { success: true, correct: isCorrect, points, newScore: player.score };
  }

  revealAnswer() {
    this.phase = "ANSWER_REVEAL";
    return {
      phase: "ANSWER_REVEAL",
      correctIndex: this.currentQuestion.correctIndex,
      leaderboard: this.getLeaderboard(),
    };
  }

  // ── Hunt Mode ──────────────────────────────────────────────────

  loadTasks(tasks) {
    this.tasks = tasks.map((t) => ({ ...t, completed: false }));
    this.totalRounds = tasks.length;
    console.log(`[GameState] Loaded ${tasks.length} tasks for hunt ${this.gameCode}`);
  }

  completeTask(playerId, taskId, proof = null) {
    const player = this.players[playerId];
    const task = this.tasks.find((t) => t.id === taskId);

    if (!player || !task) return { success: false };

    if (!player.answers) player.answers = {};
    if (player.answers[taskId]) return { success: false, error: "Already completed" };

    player.answers[taskId] = {
      completedAt: Date.now(),
      proof,
    };
    player.score += task.points;

    console.log(`[GameState] ${player.name} completed task "${task.title}" (+${task.points})`);
    return { success: true, points: task.points, newScore: player.score };
  }

  // ── Shared ─────────────────────────────────────────────────────

  getLeaderboard() {
    return Object.values(this.players)
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({
        rank: i + 1,
        id: p.id,
        name: p.name,
        score: p.score,
        streak: p.streak,
        connected: p.connected,
      }));
  }

  endGame() {
    this.phase = "FINISHED";
    this.endsAt = Date.now();

    const leaderboard = this.getLeaderboard();
    console.log(`[GameState] Game ${this.gameCode} finished. Winner: ${leaderboard[0]?.name || "N/A"}`);

    return {
      success: true,
      phase: "FINISHED",
      leaderboard,
      stats: {
        duration: this.endsAt - this.startedAt,
        totalPlayers: Object.keys(this.players).length,
        totalRounds: this.currentRound,
      },
    };
  }

  getPublicState() {
    return {
      gameCode: this.gameCode,
      phase: this.phase,
      mode: this.mode,
      playerCount: Object.keys(this.players).length,
      players: Object.values(this.players).map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        connected: p.connected,
      })),
      currentRound: this.currentRound,
      totalRounds: this.totalRounds,
      timer: this.timer,
      leaderboard: this.getLeaderboard().slice(0, 10),
    };
  }
}

module.exports = { GameState };
