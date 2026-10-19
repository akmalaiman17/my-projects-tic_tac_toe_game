
"use strict";

/* =========================================
   XO OVERDRIVE — GAME SETTINGS
========================================= */

const STORAGE_KEY = "neonTicTacToeStatsV1";

const MUSIC_START = 19; // 0:19
const MUSIC_END = 92;   // 1:32

const WINNING_COMBINATIONS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

/* =========================================
   DOM ELEMENTS
========================================= */

const modeScreen = document.getElementById("modeScreen");
const gameScreen = document.getElementById("gameScreen");

const aiModeBtn = document.getElementById("aiModeBtn");
const humanModeBtn = document.getElementById("humanModeBtn");
const difficultySelect = document.getElementById("difficulty");

const muteBtn = document.getElementById("muteBtn");
const soundIcon = document.getElementById("soundIcon");
const soundLabel = document.getElementById("soundLabel");

const modeLabel = document.getElementById("modeLabel");
const oLabel = document.getElementById("oLabel");

const xScore = document.getElementById("xScore");
const oScore = document.getElementById("oScore");
const drawScore = document.getElementById("drawScore");

const statusText = document.getElementById("status");
const cells = [...document.querySelectorAll(".cell")];

const newRoundBtn = document.getElementById("newRoundBtn");
const changeModeBtn = document.getElementById("changeModeBtn");
const backToMenuBtn = document.getElementById("backToMenuBtn");
const resetScoresBtn = document.getElementById("resetScoresBtn");

const totalGames = document.getElementById("totalGames");
const xWinsStat = document.getElementById("xWinsStat");
const oWinsStat = document.getElementById("oWinsStat");
const drawsStat = document.getElementById("drawsStat");
const winRateStat = document.getElementById("winRateStat");

const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

const celebration = document.getElementById("celebration");
const celebrationIcon = document.getElementById("celebrationIcon");
const celebrationEyebrow = document.getElementById("celebrationEyebrow");
const celebrationTitle = document.getElementById("celebrationTitle");
const celebrationMessage = document.getElementById("celebrationMessage");
const playAgainBtn = document.getElementById("playAgainBtn");
const celebrationCloseBtn = document.getElementById("celebrationCloseBtn");
const confettiLayer = document.getElementById("confettiLayer");

/* Music elements */
const backgroundMusic = document.getElementById("backgroundMusic");
const musicToggleBtn = document.getElementById("musicToggleBtn");
const musicVolume = document.getElementById("musicVolume");
const musicStatus = document.getElementById("musicStatus");

/* =========================================
   GAME STATE
========================================= */

let board = Array(9).fill("");
let currentPlayer = "X";
let gameMode = null;
let gameOver = false;
let aiThinking = false;
let aiTimer = null;
let gameStartedAt = null;

let muted = false;
let musicWanted = false;
let musicLoopTimer = null;
let audioContext = null;
let activeMusicNodes = [];

let scores = {
  X: 0,
  O: 0,
  draws: 0
};

let stats = loadStats();

/* =========================================
   SAVED STATISTICS
========================================= */

function createDefaultStats() {
  return {
    total: 0,
    xWins: 0,
    oWins: 0,
    draws: 0,
    history: []
  };
}

function loadStats() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return createDefaultStats();
    }

    const parsed = JSON.parse(saved);

    return {
      total: Number(parsed.total) || 0,
      xWins: Number(parsed.xWins) || 0,
      oWins: Number(parsed.oWins) || 0,
      draws: Number(parsed.draws) || 0,
      history: Array.isArray(parsed.history)
        ? parsed.history.slice(0, 30)
        : []
    };
  } catch (error) {
    console.warn("Could not load saved statistics:", error);
    return createDefaultStats();
  }
}

function saveStats() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (error) {
    console.warn("Could not save statistics:", error);
  }
}

/* =========================================
   SOUND EFFECTS
========================================= */

function getAudioContext() {
  if (muted) return null;

  try {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return null;

    if (!audioContext) {
      audioContext = new AudioContextClass();
    }

    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }

    return audioContext;
  } catch (error) {
    console.warn("Audio is unavailable:", error);
    return null;
  }
}

function playTone(frequency, duration = 0.12, type = "sine", volume = 0.06) {
  const context = getAudioContext();

  if (!context || muted) return;

  try {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);

    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      volume,
      context.currentTime + 0.015
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + duration
    );

    oscillator.connect(gain);
    gain.connect(context.destination);

    activeMusicNodes.push(oscillator);

    oscillator.onended = () => {
      activeMusicNodes = activeMusicNodes.filter(
        (node) => node !== oscillator
      );

      oscillator.disconnect();
      gain.disconnect();
    };

    oscillator.start();
    oscillator.stop(context.currentTime + duration + 0.03);
  } catch (error) {
    console.warn("Could not play sound effect:", error);
  }
}

function playPlaceSound(player) {
  if (player === "X") {
    playTone(520, 0.09, "sine", 0.045);
  } else {
    playTone(380, 0.1, "sine", 0.045);
  }
}

function playWinSound() {
  playTone(523.25, 0.16, "triangle", 0.06);

  setTimeout(() => {
    if (!muted) playTone(659.25, 0.16, "triangle", 0.06);
  }, 130);

  setTimeout(() => {
    if (!muted) playTone(783.99, 0.24, "triangle", 0.06);
  }, 260);
}

function playDrawSound() {
  playTone(390, 0.14, "sine", 0.045);

  setTimeout(() => {
    if (!muted) playTone(330, 0.18, "sine", 0.045);
  }, 150);
}

function playLoseSound() {
  playTone(320, 0.18, "triangle", 0.05);

  setTimeout(() => {
    if (!muted) playTone(240, 0.25, "triangle", 0.05);
  }, 170);
}

function stopAllAudio() {
  activeMusicNodes.forEach((node) => {
    try {
      node.stop();
    } catch {
      // The sound may already have stopped.
    }
  });

  activeMusicNodes = [];
}

/* =========================================
   BACKGROUND MUSIC
   Plays only from 00:19 to 01:32.
========================================= */

function setMusicStatus(message) {
  if (musicStatus) {
    musicStatus.textContent = message;
  }
}

function updateMusicButton() {
  if (!musicToggleBtn) return;

  if (muted) {
    musicToggleBtn.textContent = "🔇 Muted";
  } else if (musicWanted && !backgroundMusic.paused) {
    musicToggleBtn.textContent = "Ⅱ Pause Music";
  } else {
    musicToggleBtn.textContent = "▶ Play Music";
  }
}

function startBackgroundMusic() {
  if (!backgroundMusic) return;

  if (muted) {
    setMusicStatus("Sound is muted");
    updateMusicButton();
    return;
  }

  musicWanted = true;

  // If the file has not reached the requested segment yet,
  // begin at 19 seconds.
  if (
    backgroundMusic.currentTime < MUSIC_START ||
    backgroundMusic.currentTime >= MUSIC_END
  ) {
    backgroundMusic.currentTime = MUSIC_START;
  }

  backgroundMusic.volume = Number(musicVolume.value) / 100;

  const playPromise = backgroundMusic.play();

  if (playPromise && typeof playPromise.then === "function") {
    playPromise
      .then(() => {
        setMusicStatus("Playing · 00:19–01:32 · Loop enabled");
        updateMusicButton();
      })
      .catch((error) => {
        setMusicStatus("Click Play Music if playback does not start");
        updateMusicButton();
        console.warn("Music playback could not start:", error);
      });
  }

  updateMusicButton();
}

function pauseBackgroundMusic() {
  if (!backgroundMusic) return;

  musicWanted = false;
  backgroundMusic.pause();

  setMusicStatus("Music paused");
  updateMusicButton();
}

function toggleBackgroundMusic() {
  if (muted) {
    muted = false;
    updateMuteButton();
  }

  if (!backgroundMusic.paused && musicWanted) {
    pauseBackgroundMusic();
  } else {
    startBackgroundMusic();
  }
}

function checkMusicSegment() {
  if (!backgroundMusic || !musicWanted || muted) return;

  // The music file should be longer than 1:32.
  // Seek back to 19 seconds when the segment ends.
  if (
    backgroundMusic.currentTime >= MUSIC_END ||
    backgroundMusic.ended
  ) {
    backgroundMusic.currentTime = MUSIC_START;

    if (musicWanted && !muted) {
      backgroundMusic.play().catch(() => {
        setMusicStatus("Click Play Music to resume");
      });
    }
  }
}

function initialiseMusic() {
  if (!backgroundMusic) return;

  // We handle the segment loop ourselves rather than looping
  // the entire audio file.
  backgroundMusic.loop = false;
  backgroundMusic.preload = "auto";
  backgroundMusic.volume = Number(musicVolume.value) / 100;

  musicLoopTimer = window.setInterval(checkMusicSegment, 250);

  backgroundMusic.addEventListener("error", () => {
    setMusicStatus("Could not load music.mp3 — check the filename");
    musicToggleBtn.textContent = "▶ Try Again";
  });

  backgroundMusic.addEventListener("ended", () => {
    if (musicWanted && !muted) {
      backgroundMusic.currentTime = MUSIC_START;
      backgroundMusic.play().catch(() => {
        setMusicStatus("Click Play Music to resume");
      });
    }
  });

  backgroundMusic.addEventListener("pause", updateMusicButton);
  backgroundMusic.addEventListener("play", updateMusicButton);

  updateMusicButton();
}

function updateMuteButton() {
  muteBtn.setAttribute("aria-pressed", String(muted));

  if (muted) {
    soundIcon.textContent = "🔇";
    soundLabel.textContent = "Sound Off";
    pauseBackgroundMusic();
    stopAllAudio();
  } else {
    soundIcon.textContent = "🔊";
    soundLabel.textContent = "Sound On";

    if (gameMode && !gameScreen.hidden) {
      startBackgroundMusic();
    }
  }

  updateMusicButton();
}

/* =========================================
   GAME SETUP
========================================= */

function startGame(mode) {
  clearTimeout(aiTimer);
  stopAllAudio();

  gameMode = mode;
  gameOver = false;
  aiThinking = false;

  modeScreen.hidden = true;
  gameScreen.hidden = false;

  if (mode === "ai") {
    modeLabel.textContent = `PLAYER VS COMPUTER · ${difficultySelect.value.toUpperCase()}`;
    oLabel.textContent = "COMPUTER";
  } else {
    modeLabel.textContent = "PLAYER VS PLAYER";
    oLabel.textContent = "PLAYER O";
  }

  startNewRound();

  // This call follows a button click, which helps browsers
  // permit audio playback.
  startBackgroundMusic();
}

function returnToMenu() {
  clearTimeout(aiTimer);

  gameMode = null;
  aiThinking = false;
  gameOver = true;

  pauseBackgroundMusic();
  stopAllAudio();

  celebration.hidden = true;
  gameScreen.hidden = true;
  modeScreen.hidden = false;
}

function startNewRound() {
  clearTimeout(aiTimer);

  board = Array(9).fill("");
  currentPlayer = "X";
  gameOver = false;
  aiThinking = false;
  gameStartedAt = Date.now();

  celebration.hidden = true;
  confettiLayer.innerHTML = "";

  cells.forEach((cell, index) => {
    cell.textContent = "";
    cell.classList.remove(
      "mark-x",
      "mark-o",
      "winning-cell"
    );

    cell.setAttribute(
      "aria-label",
      `Row ${Math.floor(index / 3) + 1}, column ${(index % 3) + 1}, empty`
    );
  });

  statusText.textContent = "Player X's turn";
  updateBoard();
  updateScores();

  // Do not restart the music here. It should continue across rounds.
}

function updateBoard() {
  cells.forEach((cell, index) => {
    const value = board[index];

    cell.textContent = value;
    cell.classList.toggle("mark-x", value === "X");
    cell.classList.toggle("mark-o", value === "O");

    const row = Math.floor(index / 3) + 1;
    const column = (index % 3) + 1;
    const description = value ? value : "empty";

    cell.setAttribute(
      "aria-label",
      `Row ${row}, column ${column}, ${description}`
    );

    const isAITurn =
      gameMode === "ai" &&
      currentPlayer === "O";

    cell.disabled =
      gameOver ||
      aiThinking ||
      Boolean(value) ||
      isAITurn;
  });
}

function updateScores() {
  xScore.textContent = scores.X;
  oScore.textContent = scores.O;
  drawScore.textContent = scores.draws;
}

/* =========================================
   PLAYER MOVES
========================================= */

function handleCellClick(event) {
  const index = Number(event.currentTarget.dataset.index);

  if (gameOver || aiThinking || board[index]) return;

  if (gameMode === "ai" && currentPlayer === "O") {
    return;
  }

  makeMove(index, currentPlayer);
}

function makeMove(index, player) {
  if (gameOver || board[index]) return;

  board[index] = player;

  playPlaceSound(player);
  updateBoard();

  const winningLine = getWinningLine(board);

  if (winningLine) {
    finishGame(player, winningLine);
    return;
  }

  if (board.every(Boolean)) {
    finishGame("draw");
    return;
  }

  currentPlayer = player === "X" ? "O" : "X";

  if (gameMode === "ai" && currentPlayer === "O") {
    aiThinking = true;
    statusText.textContent = "Computer is thinking...";
    updateBoard();

    aiTimer = window.setTimeout(() => {
      if (gameOver) return;

      const aiMove = getAIMove();

      aiThinking = false;

      if (aiMove !== -1 && aiMove !== undefined) {
        makeMove(aiMove, "O");
      }
    }, 450);
  } else {
    statusText.textContent = `Player ${currentPlayer}'s turn`;
    updateBoard();
  }
}

/* =========================================
   WIN DETECTION
========================================= */

function getWinningLine(currentBoard) {
  for (const combination of WINNING_COMBINATIONS) {
    const [a, b, c] = combination;

    if (
      currentBoard[a] &&
      currentBoard[a] === currentBoard[b] &&
      currentBoard[a] === currentBoard[c]
    ) {
      return combination;
    }
  }

  return null;
}

/* =========================================
   AI
========================================= */

function getEmptyCells(currentBoard) {
  return currentBoard
    .map((value, index) => value === "" ? index : -1)
    .filter((index) => index !== -1);
}

function getAIMove() {
  const emptyCells = getEmptyCells(board);

  if (emptyCells.length === 0) return -1;

  const difficulty = difficultySelect.value;

  if (difficulty === "easy") {
    return emptyCells[
      Math.floor(Math.random() * emptyCells.length)
    ];
  }

  if (difficulty === "medium" && Math.random() < 0.35) {
    return emptyCells[
      Math.floor(Math.random() * emptyCells.length)
    ];
  }

  let bestScore = -Infinity;
  let bestMove = emptyCells[0];

  for (const index of emptyCells) {
    board[index] = "O";

    const score = minimax(board, 0, false);

    board[index] = "";

    if (score > bestScore) {
      bestScore = score;
      bestMove = index;
    }
  }

  return bestMove;
}

function minimax(currentBoard, depth, isMaximizing) {
  const winningLine = getWinningLine(currentBoard);

  if (winningLine) {
    const winner = currentBoard[winningLine[0]];

    if (winner === "O") return 10 - depth;
    if (winner === "X") return depth - 10;
  }

  const emptyCells = getEmptyCells(currentBoard);

  if (emptyCells.length === 0) {
    return 0;
  }

  if (isMaximizing) {
    let bestScore = -Infinity;

    for (const index of emptyCells) {
      currentBoard[index] = "O";

      const score = minimax(currentBoard, depth + 1, false);

      currentBoard[index] = "";
      bestScore = Math.max(bestScore, score);
    }

    return bestScore;
  }

  let bestScore = Infinity;

  for (const index of emptyCells) {
    currentBoard[index] = "X";

    const score = minimax(currentBoard, depth + 1, true);

    currentBoard[index] = "";
    bestScore = Math.min(bestScore, score);
  }

  return bestScore;
}

/* =========================================
   FINISH GAME
========================================= */

function finishGame(result, winningLine = null) {
  gameOver = true;
  aiThinking = false;

  clearTimeout(aiTimer);

  cells.forEach((cell) => {
    cell.disabled = true;
  });

  if (winningLine) {
    winningLine.forEach((index) => {
      cells[index].classList.add("winning-cell");
    });
  }

  if (result === "draw") {
    scores.draws++;
    statusText.textContent = "It's a draw!";
    playDrawSound();
  } else {
    scores[result]++;
    statusText.textContent = `Player ${result} wins!`;

    if (gameMode === "ai" && result === "O") {
      playLoseSound();
    } else {
      playWinSound();
    }
  }

  updateScores();
  recordResult(result);
  showCelebration(result);
}

/* =========================================
   HISTORY AND STATISTICS
========================================= */

function recordResult(result) {
  stats.total++;

  if (result === "X") {
    stats.xWins++;
  } else if (result === "O") {
    stats.oWins++;
  } else {
    stats.draws++;
  }

  const durationSeconds = gameStartedAt
    ? Math.max(0, Math.round((Date.now() - gameStartedAt) / 1000))
    : 0;

  const record = {
    result,
    mode: gameMode,
    difficulty: gameMode === "ai" ? difficultySelect.value : null,
    date: new Date().toISOString(),
    duration: durationSeconds
  };

  stats.history.unshift(record);
  stats.history = stats.history.slice(0, 30);

  saveStats();
  renderStats();
}

function renderStats() {
  totalGames.textContent = stats.total;
  xWinsStat.textContent = stats.xWins;
  oWinsStat.textContent = stats.oWins;
  drawsStat.textContent = stats.draws;

  const winRate = stats.total
    ? Math.round((stats.xWins / stats.total) * 100)
    : 0;

  winRateStat.textContent = `${winRate}%`;

  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = "";

  if (!stats.history.length) {
    const empty = document.createElement("div");
    empty.className = "empty-history";

    const symbol = document.createElement("span");
    symbol.textContent = "⌁";

    const message = document.createElement("p");
    message.textContent = "No matches recorded yet.";

    const hint = document.createElement("small");
    hint.textContent = "Your recent results will appear here.";

    empty.append(symbol, message, hint);
    historyList.appendChild(empty);
    return;
  }

  stats.history.forEach((record) => {
    const item = document.createElement("article");
    item.className = "history-item";

    const main = document.createElement("div");
    main.className = "history-main";

    const badge = document.createElement("div");
    badge.className = "history-badge";

    if (record.result === "draw") {
      badge.classList.add("draw");
      badge.textContent = "=";
    } else {
      badge.classList.add(record.result.toLowerCase());
      badge.textContent = record.result;
    }

    const details = document.createElement("div");

    const title = document.createElement("p");
    title.className = "history-title";

    if (record.result === "draw") {
      title.textContent = "Match Draw";
    } else {
      title.textContent = `Player ${record.result} Won`;
    }

    const meta = document.createElement("p");
    meta.className = "history-meta";

    const modeText = record.mode === "ai"
      ? `VS Computer${record.difficulty ? ` · ${record.difficulty}` : ""}`
      : "VS Friend";

    let dateText = "Unknown date";

    if (record.date) {
      const parsedDate = new Date(record.date);

      if (!Number.isNaN(parsedDate.getTime())) {
        dateText = parsedDate.toLocaleString();
      }
    }

    const durationText = formatDuration(Number(record.duration) || 0);

    meta.textContent = `${modeText} · ${dateText} · ${durationText}`;

    details.append(title, meta);
    main.append(badge, details);

    const resultLabel = document.createElement("span");
    resultLabel.className = "history-result";

    if (record.result === "draw") {
      resultLabel.classList.add("draw");
      resultLabel.textContent = "DRAW";
    } else {
      resultLabel.classList.add("win");
      resultLabel.textContent = "VICTORY";
    }

    item.append(main, resultLabel);
    historyList.appendChild(item);
  });
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return minutes > 0
    ? `${minutes}m ${seconds}s`
    : `${seconds}s`;
}

/* =========================================
   CELEBRATION
========================================= */

function showCelebration(result) {
  celebration.hidden = false;
  confettiLayer.innerHTML = "";

  if (result === "draw") {
    celebrationIcon.textContent = "🤝";
    celebrationEyebrow.textContent = "WELL PLAYED";
    celebrationTitle.textContent = "IT'S A DRAW!";
    celebrationMessage.textContent =
      "An even match. Ready to break the tie?";
  } else if (gameMode === "ai" && result === "O") {
    celebrationIcon.textContent = "🤖";
    celebrationEyebrow.textContent = "AI VICTORY";
    celebrationTitle.textContent = "COMPUTER WINS!";
    celebrationMessage.textContent =
      "The computer takes this round. Give it another shot!";
  } else {
    celebrationIcon.textContent = "🏆";
    celebrationEyebrow.textContent = "VICTORY";
    celebrationTitle.textContent = `PLAYER ${result} WINS!`;
    celebrationMessage.textContent =
      "An incredible move. The arena is yours!";

    createConfetti();
  }
}

function closeCelebration() {
  celebration.hidden = true;
  confettiLayer.innerHTML = "";
}

function createConfetti() {
  const colors = [
    "#00e5ff",
    "#ff2d95",
    "#a855f7",
    "#52ffb8",
    "#ffffff"
  ];

  for (let i = 0; i < 75; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti";

    piece.style.left = `${Math.random() * 100}%`;
    piece.style.setProperty(
      "--confetti-color",
      colors[Math.floor(Math.random() * colors.length)]
    );
    piece.style.setProperty(
      "--fall-duration",
      `${2 + Math.random() * 3}s`
    );
    piece.style.setProperty(
      "--drift",
      `${Math.random() * 180 - 90}px`
    );

    piece.style.animationDelay = `${Math.random() * 0.8}s`;

    confettiLayer.appendChild(piece);
  }
}

/* =========================================
   EVENT LISTENERS
========================================= */

aiModeBtn.addEventListener("click", () => {
  startGame("ai");
});

humanModeBtn.addEventListener("click", () => {
  startGame("human");
});

cells.forEach((cell) => {
  cell.addEventListener("click", handleCellClick);
});

newRoundBtn.addEventListener("click", () => {
  startNewRound();
});

changeModeBtn.addEventListener("click", returnToMenu);
backToMenuBtn.addEventListener("click", returnToMenu);

resetScoresBtn.addEventListener("click", () => {
  const confirmed = window.confirm(
    "Reset the current scoreboard and all saved statistics?"
  );

  if (!confirmed) return;

  scores = {
    X: 0,
    O: 0,
    draws: 0
  };

  stats = createDefaultStats();

  saveStats();
  updateScores();
  renderStats();
  startNewRound();
});

clearHistoryBtn.addEventListener("click", () => {
  if (!stats.history.length) return;

  const confirmed = window.confirm(
    "Clear your match history? This will not reset your statistics."
  );

  if (!confirmed) return;

  stats.history = [];
  saveStats();
  renderHistory();
});

playAgainBtn.addEventListener("click", () => {
  startNewRound();
});

celebrationCloseBtn.addEventListener("click", closeCelebration);

celebration.addEventListener("click", (event) => {
  if (event.target === celebration) {
    closeCelebration();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !celebration.hidden) {
    closeCelebration();
  }
});

muteBtn.addEventListener("click", () => {
  muted = !muted;
  updateMuteButton();
});

musicToggleBtn.addEventListener("click", toggleBackgroundMusic);

musicVolume.addEventListener("input", () => {
  const volume = Number(musicVolume.value) / 100;

  backgroundMusic.volume = volume;

  if (volume === 0) {
    setMusicStatus("Volume is at 0%");
  } else if (!muted && !backgroundMusic.paused) {
    setMusicStatus(`Playing · ${Math.round(volume * 100)}% volume`);
  }
});

difficultySelect.addEventListener("change", () => {
  if (gameMode === "ai") {
    modeLabel.textContent =
      `PLAYER VS COMPUTER · ${difficultySelect.value.toUpperCase()}`;
  }
});

/* =========================================
   INITIALISE
========================================= */

initialiseMusic();
updateScores();
renderStats();
