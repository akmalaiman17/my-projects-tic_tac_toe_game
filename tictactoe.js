
const modeScreen = document.getElementById("modeScreen");
const gameScreen = document.getElementById("gameScreen");
const aiModeBtn = document.getElementById("aiModeBtn");
const humanModeBtn = document.getElementById("humanModeBtn");
const difficultySelect = document.getElementById("difficulty");
const muteBtn = document.getElementById("muteBtn");

const boardElement = document.getElementById("board");
const cells = [...document.querySelectorAll(".cell")];
const statusElement = document.getElementById("status");
const modeLabel = document.getElementById("modeLabel");

const xScoreElement = document.getElementById("xScore");
const oScoreElement = document.getElementById("oScore");
const drawScoreElement = document.getElementById("drawScore");
const oLabel = document.getElementById("oLabel");

const celebration = document.getElementById("celebration");
const celebrationCard = document.querySelector(".celebration-card");
const celebrationIcon = document.getElementById("celebrationIcon");
const celebrationEyebrow = document.getElementById("celebrationEyebrow");
const celebrationTitle = document.getElementById("celebrationTitle");
const celebrationMessage = document.getElementById("celebrationMessage");
const confettiLayer = document.getElementById("confettiLayer");

const STORAGE_KEY = "neonTicTacToeStatsV1";

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

let board = Array(9).fill("");
let currentPlayer = "X";
let gameMode = null;
let gameOver = false;
let aiThinking = false;
let aiTimer = null;
let muted = false;
let audioContext = null;
let activeMusicNodes = [];
let gameStartedAt = 0;

let scores = {
    X: 0,
    O: 0,
    draws: 0
};

function loadStats() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

        if (
            saved &&
            Number.isFinite(saved.total) &&
            Number.isFinite(saved.xWins) &&
            Number.isFinite(saved.oWins) &&
            Number.isFinite(saved.draws) &&
            Array.isArray(saved.history)
        ) {
            return {
                total: saved.total,
                xWins: saved.xWins,
                oWins: saved.oWins,
                draws: saved.draws,
                history: saved.history
            };
        }
    } catch (error) {
        console.warn("Could not load saved game statistics.", error);
    }

    return {
        total: 0,
        xWins: 0,
        oWins: 0,
        draws: 0,
        history: []
    };
}

let stats = loadStats();

function saveStats() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (error) {
        console.warn("Could not save game statistics.", error);
    }
}

// --------------------------------------------------
// AUDIO: browser-generated sound effects and music
// --------------------------------------------------

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
        console.warn("Audio is unavailable.", error);
        return null;
    }
}

function playTone(frequency, duration, type = "sine", volume = 0.07, delay = 0) {
    const ctx = getAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    const startAt = ctx.currentTime + delay;
    const endAt = startAt + duration;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);

    gain.gain.setValueAtTime(0.001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, endAt);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(startAt);
    oscillator.stop(endAt + 0.02);
}

function playPlaceSound(player) {
    if (player === "X") {
        playTone(650, 0.12, "sine", 0.06);
        playTone(980, 0.1, "sine", 0.035, 0.06);
    } else {
        playTone(440, 0.13, "triangle", 0.06);
        playTone(660, 0.1, "triangle", 0.035, 0.06);
    }
}

function playWinSound() {
    stopMusic();

    const notes = [
        [523.25, 0],
        [659.25, 0.13],
        [783.99, 0.26],
        [1046.5, 0.43],
        [783.99, 0.65],
        [1046.5, 0.83]
    ];

    notes.forEach(([frequency, delay], index) => {
        playTone(frequency, index === 5 ? 0.48 : 0.22, "triangle", 0.075, delay);
    });
}

function playDrawSound() {
    stopMusic();

    const notes = [
        [440, 0],
        [392, 0.22],
        [349.23, 0.44],
        [392, 0.68]
    ];

    notes.forEach(([frequency, delay]) => {
        playTone(frequency, 0.3, "sine", 0.055, delay);
    });
}

function playLoseSound() {
    stopMusic();

    const notes = [
        [392, 0],
        [349.23, 0.2],
        [293.66, 0.42],
        [220, 0.68],
        [196, 0.96]
    ];

    notes.forEach(([frequency, delay]) => {
        playTone(frequency, 0.28, "triangle", 0.06, delay);
    });
}

function stopMusic() {
    activeMusicNodes.forEach((node) => {
        try {
            node.stop();
        } catch {
            // The oscillator may have already stopped.
        }
    });

    activeMusicNodes = [];
}

function stopAllAudio() {
    stopMusic();

    if (audioContext) {
        audioContext.suspend().catch(() => {});
    }
}

muteBtn.addEventListener("click", () => {
    muted = !muted;

    muteBtn.textContent = muted ? "🔇 Sound Off" : "🔊 Sound On";
    muteBtn.setAttribute("aria-pressed", String(muted));

    if (muted) {
        stopAllAudio();
    } else if (audioContext) {
        audioContext.resume().catch(() => {});
    }
});

// --------------------------------------------------
// GAME SETUP
// --------------------------------------------------

aiModeBtn.addEventListener("click", () => startGame("ai"));
humanModeBtn.addEventListener("click", () => startGame("human"));

function startGame(mode) {
    clearTimeout(aiTimer);
    stopAllAudio();

    gameMode = mode;
    modeScreen.hidden = true;
    gameScreen.hidden = false;
    celebration.hidden = true;

    modeLabel.textContent = mode === "ai"
        ? `VS COMPUTER · ${difficultySelect.value.toUpperCase()}`
        : "TWO PLAYERS";

    oLabel.textContent = mode === "ai" ? "AI · O" : "PLAYER O";

    startNewRound();
}

function startNewRound() {
    clearTimeout(aiTimer);
    stopMusic();

    board = Array(9).fill("");
    currentPlayer = "X";
    gameOver = false;
    aiThinking = false;
    gameStartedAt = Date.now();

    celebration.hidden = true;
    confettiLayer.replaceChildren();

    cells.forEach((cell, index) => {
        cell.textContent = "";
        cell.className = "cell";
        cell.disabled = false;
        cell.setAttribute("aria-label", `Cell ${index + 1}, empty`);
    });

    statusElement.classList.remove("thinking");
    updateBoard();
    updateScores();

    statusElement.textContent = "PLAYER X'S TURN";
}

document.getElementById("newRoundBtn").addEventListener("click", startNewRound);

document.getElementById("changeModeBtn").addEventListener("click", () => {
    clearTimeout(aiTimer);
    stopAllAudio();

    gameScreen.hidden = true;
    celebration.hidden = true;
    modeScreen.hidden = false;
    gameMode = null;

    renderStats();
});

document.getElementById("resetScoresBtn").addEventListener("click", () => {
    const confirmed = window.confirm(
        "Reset all scores and game history? This cannot be undone."
    );

    if (!confirmed) return;

    scores = { X: 0, O: 0, draws: 0 };

    stats = {
        total: 0,
        xWins: 0,
        oWins: 0,
        draws: 0,
        history: []
    };

    saveStats();
    updateScores();
    renderStats();
});

document.getElementById("clearHistoryBtn").addEventListener("click", () => {
    stats.history = [];
    saveStats();
    renderStats();
});

document.getElementById("playAgainBtn").addEventListener("click", startNewRound);

document.getElementById("celebrationCloseBtn").addEventListener("click", () => {
    celebration.hidden = true;
});

// --------------------------------------------------
// BOARD AND PLAYER MOVES
// --------------------------------------------------

cells.forEach((cell) => {
    cell.addEventListener("click", () => {
        const index = Number(cell.dataset.index);

        if (
            gameOver ||
            aiThinking ||
            board[index] !== "" ||
            (gameMode === "ai" && currentPlayer === "O")
        ) {
            return;
        }

        makeMove(index, currentPlayer);
    });
});

function makeMove(index, player) {
    if (gameOver || board[index] !== "") return;

    board[index] = player;
    playPlaceSound(player);
    updateBoard();

    const winningLine = getWinningLine(board);

    if (winningLine) {
        finishGame(player, winningLine);
        return;
    }

    if (board.every((cell) => cell !== "")) {
        finishGame("draw", []);
        return;
    }

    currentPlayer = player === "X" ? "O" : "X";

    if (gameMode === "ai" && currentPlayer === "O") {
        aiThinking = true;
        statusElement.textContent = "AI IS THINKING...";
        statusElement.classList.add("thinking");
        updateBoard();

        aiTimer = setTimeout(() => {
            if (gameOver) return;

            const aiMove = getAIMove();

            aiThinking = false;
            statusElement.classList.remove("thinking");

            if (aiMove !== -1) {
                makeMove(aiMove, "O");
            }
        }, 450);
    } else {
        statusElement.textContent = `PLAYER ${currentPlayer}'S TURN`;
        statusElement.classList.remove("thinking");
        updateBoard();
    }
}

function updateBoard() {
    cells.forEach((cell, index) => {
        const mark = board[index];

        cell.textContent = mark;
        cell.classList.toggle("x", mark === "X");
        cell.classList.toggle("o", mark === "O");

        const aiTurn = gameMode === "ai" && currentPlayer === "O";

        cell.disabled = gameOver || aiThinking || aiTurn || mark !== "";

        cell.setAttribute(
            "aria-label",
            `Cell ${index + 1}, ${mark || "empty"}`
        );
    });
}

function getWinningLine(currentBoard) {
    return WINNING_COMBINATIONS.find(([a, b, c]) => {
        return (
            currentBoard[a] &&
            currentBoard[a] === currentBoard[b] &&
            currentBoard[a] === currentBoard[c]
        );
    }) || null;
}

// --------------------------------------------------
// AI: EASY, MEDIUM, HARD
// --------------------------------------------------

function getAIMove() {
    const emptyCells = board
        .map((value, index) => value === "" ? index : -1)
        .filter((index) => index !== -1);

    if (emptyCells.length === 0) return -1;

    const difficulty = difficultySelect.value;

    if (difficulty === "easy") {
        return emptyCells[Math.floor(Math.random() * emptyCells.length)];
    }

    if (difficulty === "medium") {
        // Usually plays intelligently, but sometimes makes a random move.
        if (Math.random() < 0.35) {
            return emptyCells[Math.floor(Math.random() * emptyCells.length)];
        }
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
    const winner = getWinningLine(currentBoard);

    if (winner) {
        return currentBoard[winner[0]] === "O" ? 10 - depth : depth - 10;
    }

    if (currentBoard.every((cell) => cell !== "")) {
        return 0;
    }

    if (isMaximizing) {
        let bestScore = -Infinity;

        for (let i = 0; i < 9; i++) {
            if (currentBoard[i] !== "") continue;

            currentBoard[i] = "O";
            bestScore = Math.max(
                bestScore,
                minimax(currentBoard, depth + 1, false)
            );
            currentBoard[i] = "";
        }

        return bestScore;
    }

    let bestScore = Infinity;

    for (let i = 0; i < 9; i++) {
        if (currentBoard[i] !== "") continue;

        currentBoard[i] = "X";
        bestScore = Math.min(
            bestScore,
            minimax(currentBoard, depth + 1, true)
        );
        currentBoard[i] = "";
    }

    return bestScore;
}

// --------------------------------------------------
// GAME RESULTS AND VICTORY CELEBRATION
// --------------------------------------------------

function finishGame(result, winningLine) {
    if (gameOver) return;

    gameOver = true;
    aiThinking = false;
    clearTimeout(aiTimer);

    cells.forEach((cell) => {
        cell.disabled = true;
    });

    if (result === "draw") {
        scores.draws++;
        statusElement.textContent = "IT'S A DRAW!";
    } else {
        scores[result]++;
        statusElement.textContent = `PLAYER ${result} WINS!`;

        winningLine.forEach((index) => {
            cells[index].classList.add("winning");
        });
    }

    updateScores();
    recordResult(result);
    showCelebration(result);
}

function recordResult(result) {
    const durationSeconds = Math.max(
        1,
        Math.round((Date.now() - gameStartedAt) / 1000)
    );

    stats.total++;

    if (result === "X") stats.xWins++;
    else if (result === "O") stats.oWins++;
    else stats.draws++;

    stats.history.unshift({
        result,
        mode: gameMode,
        difficulty: gameMode === "ai" ? difficultySelect.value : null,
        date: new Date().toISOString(),
        duration: durationSeconds
    });

    // Keep the latest 30 matches.
    stats.history = stats.history.slice(0, 30);

    saveStats();
    renderStats();
}

function showCelebration(result) {
    celebration.hidden = false;
    celebrationCard.className = "celebration-card";
    confettiLayer.replaceChildren();

    if (result === "draw") {
        celebrationCard.classList.add("draw");
        celebrationIcon.textContent = "🤝";
        celebrationEyebrow.textContent = "MATCH COMPLETE";
        celebrationTitle.textContent = "IT'S A DRAW!";
        celebrationMessage.textContent =
            "A close battle! No winner this time. Ready for another round?";

        playDrawSound();
    } else {
        const playerWon = gameMode === "human" || result === "X";

        if (playerWon) {
            celebrationIcon.textContent = "🏆";
            celebrationEyebrow.textContent = "INCREDIBLE PERFORMANCE";
            celebrationTitle.textContent = `${result} WINS!`;
            celebrationMessage.textContent = gameMode === "ai"
                ? "You defeated the AI. The arena belongs to you!"
                : `Player ${result} takes the victory! Well played!`;

            playWinSound();
            createConfetti();
        } else {
            celebrationCard.classList.add("defeat");
            celebrationIcon.textContent = "💥";
            celebrationEyebrow.textContent = "MATCH COMPLETE";
            celebrationTitle.textContent = "DEFEAT!";
            celebrationMessage.textContent =
                "The AI wins this round. Learn from the moves and try again!";

            playLoseSound();
        }
    }
}

function createConfetti() {
    const amount = 90;

    for (let i = 0; i < amount; i++) {
        const piece = document.createElement("span");

        piece.className = "confetti";
        piece.style.left = `${Math.random() * 100}%`;
        piece.style.setProperty(
            "--fall-duration",
            `${2 + Math.random() * 2.5}s`
        );
        piece.style.setProperty(
            "--fall-delay",
            `${Math.random() * 0.9}s`
        );
        piece.style.setProperty(
            "--drift",
            `${Math.random() * 180 - 90}px`
        );

        confettiLayer.appendChild(piece);
    }
}

// --------------------------------------------------
// SCOREBOARD AND GAME HISTORY
// --------------------------------------------------

function updateScores() {
    xScoreElement.textContent = scores.X;
    oScoreElement.textContent = scores.O;
    drawScoreElement.textContent = scores.draws;
}

function renderStats() {
    document.getElementById("totalGames").textContent =
        `${stats.total} ${stats.total === 1 ? "GAME" : "GAMES"}`;

    document.getElementById("xWinsStat").textContent = stats.xWins;
    document.getElementById("oWinsStat").textContent = stats.oWins;
    document.getElementById("drawsStat").textContent = stats.draws;

    const winRate = stats.total
        ? Math.round((stats.xWins / stats.total) * 100)
        : 0;

    document.getElementById("winRateStat").textContent = `${winRate}%`;

    const historyList = document.getElementById("historyList");
    historyList.replaceChildren();

    if (stats.history.length === 0) {
        const emptyItem = document.createElement("li");
        emptyItem.className = "empty-history";
        emptyItem.textContent =
            stats.total > 0
                ? "No recent matches saved. Your overall stats are still available."
                : "Your completed matches will appear here.";

        historyList.appendChild(emptyItem);
        return;
    }

    stats.history.forEach((match) => {
        const item = document.createElement("li");

        const result = document.createElement("span");
        result.className = "history-result";

        if (match.result === "draw") {
            result.textContent = "DRAW";
            result.classList.add("draw-result");
        } else {
            result.textContent = `PLAYER ${match.result} WON`;
            result.classList.add(
                match.result === "X" ? "x-result" : "o-result"
            );
        }

        const details = document.createElement("span");
        details.className = "history-meta";

        const modeText = match.mode === "ai"
            ? `VS AI${match.difficulty ? ` · ${match.difficulty}` : ""}`
            : "2 PLAYERS";

        const date = new Date(match.date);
        const validDate = !Number.isNaN(date.getTime());

        const dateText = validDate
            ? date.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric"
            }) + " " + date.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit"
            })
            : "Previous match";

        details.textContent =
            `${modeText} · ${dateText} · ${match.duration || 0}s`;

        item.append(result, details);
        historyList.appendChild(item);
    });
}

// --------------------------------------------------
// INITIAL DISPLAY
// --------------------------------------------------

renderStats();
updateScores();
