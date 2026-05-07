const BOARD_SIZE = 8;
const TURN_TIME = 15;
const AI_PLAYER = 2;
const specialPositions = new Set(['1,2','1,5','2,3','2,4','5,3','5,4','6,2','6,5']);

const dom = {
  menuScreen: document.getElementById('menuScreen'),
  gameScreen: document.getElementById('gameScreen'),
  board: document.getElementById('board'),
  player1Name: document.getElementById('player1Name'),
  player2Name: document.getElementById('player2Name'),
  displayName1: document.getElementById('displayName1'),
  displayName2: document.getElementById('displayName2'),
  turnIndicator: document.getElementById('turnIndicator'),
  timerLabel: document.getElementById('timerLabel'),
  timerBar: document.getElementById('timerBar'),
  startButton: document.getElementById('startButton'),
  backMenu: document.getElementById('backMenu'),
  endScreen: document.getElementById('endScreen'),
  endTitle: document.getElementById('endTitle'),
  endMessage: document.getElementById('endMessage'),
  endWinner: document.getElementById('endWinner'),
  endMoves: document.getElementById('endMoves'),
  endCaptures: document.getElementById('endCaptures'),
  rematchButton: document.getElementById('rematchButton'),
  menuButton: document.getElementById('menuButton'),
  statGames: document.getElementById('statGames'),
  statP1: document.getElementById('statP1'),
  statP2: document.getElementById('statP2'),
  statDraws: document.getElementById('statDraws'),
  soundToggle: document.getElementById('soundToggle'),
  musicToggle: document.getElementById('musicToggle'),
  themeToggle: document.getElementById('themeToggle'),
  aiLevelSelect: document.getElementById('aiLevelSelect'),
  difficultyCard: document.getElementById('difficultyCard'),
  gameNotice: document.getElementById('gameNotice'),
};

const state = {
  board: [],
  currentPlayer: 1,
  selected: null,
  validMoves: [],
  pendingChain: null,
  gameActive: false,
  mode: 'local',
  aiLevel: 'medium',
  timer: TURN_TIME,
  timerInterval: null,
  turnCount: 0,
  lastCaptureTurn: 0,
  stats: {
    games: 0,
    winsP1: 0,
    winsP2: 0,
    draws: 0,
  },
  soundOn: true,
  theme: 'dark',
  musicOn: false,
};

let audioContext = null;
let musicGain = null;
let musicOscillator = null;

function createPiece(player) {
  return { player, king: false, evolved: false, charged: false, moves: 0 };
}

function init() {
  loadSettings();
  attachEvents();
  showScreen('menu');
}

function loadSettings() {
  const stored = JSON.parse(localStorage.getItem('neoDamasSettings') || '{}');
  if (stored.theme) {
    state.theme = stored.theme;
    document.body.className = `theme-${stored.theme}`;
    dom.themeToggle.textContent = stored.theme === 'dark' ? 'Oscuro' : 'Claro';
  }
  if (stored.soundOn !== undefined) {
    state.soundOn = stored.soundOn;
    dom.soundToggle.textContent = stored.soundOn ? 'ON' : 'OFF';
  }
  if (stored.musicOn !== undefined) {
    state.musicOn = stored.musicOn;
    dom.musicToggle.textContent = stored.musicOn ? 'ON' : 'OFF';
  }
  if (stored.aiLevel) {
    state.aiLevel = stored.aiLevel;
    dom.aiLevelSelect.value = stored.aiLevel;
  }
  const savedStats = JSON.parse(localStorage.getItem('neoDamasStats') || '{}');
  state.stats = { ...state.stats, ...savedStats };
  updateStatsPanel();
}

function saveSettings() {
  localStorage.setItem('neoDamasSettings', JSON.stringify({
    theme: state.theme,
    soundOn: state.soundOn,
    musicOn: state.musicOn,
    aiLevel: state.aiLevel,
  }));
}

function saveStats() {
  localStorage.setItem('neoDamasStats', JSON.stringify(state.stats));
}

function attachEvents() {
  document.querySelectorAll('input[name="mode"]').forEach((radio) => {
    radio.addEventListener('change', (event) => {
      state.mode = event.target.value;
      dom.difficultyCard.style.display = state.mode === 'ai' ? 'block' : 'none';
      dom.player2Name.disabled = state.mode === 'ai';
      if (state.mode === 'ai') {
        dom.player2Name.value = 'ANIMA';
      } else {
        dom.player2Name.disabled = false;
      }
    });
  });

  dom.startButton.addEventListener('click', startGame);
  dom.backMenu.addEventListener('click', () => {
    clearInterval(state.timerInterval);
    state.gameActive = false;
    showScreen('menu');
  });
  dom.rematchButton.addEventListener('click', () => {
    dom.endScreen.classList.add('hidden');
    startGame(true);
  });
  dom.menuButton.addEventListener('click', () => {
    dom.endScreen.classList.add('hidden');
    showScreen('menu');
  });
  dom.aiLevelSelect.addEventListener('change', (event) => {
    state.aiLevel = event.target.value;
    saveSettings();
  });
  dom.soundToggle.addEventListener('click', () => {
    state.soundOn = !state.soundOn;
    dom.soundToggle.textContent = state.soundOn ? 'ON' : 'OFF';
    saveSettings();
    if (!state.soundOn) stopMusic();
    else if (state.musicOn) startMusic();
  });
  dom.musicToggle.addEventListener('click', () => {
    state.musicOn = !state.musicOn;
    dom.musicToggle.textContent = state.musicOn ? 'ON' : 'OFF';
    saveSettings();
    if (state.musicOn && state.soundOn) startMusic();
    else stopMusic();
  });
  dom.themeToggle.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.body.className = `theme-${state.theme}`;
    dom.themeToggle.textContent = state.theme === 'dark' ? 'Oscuro' : 'Claro';
    saveSettings();
  });
}

function showScreen(screen) {
  dom.menuScreen.classList.toggle('active', screen === 'menu');
  dom.gameScreen.classList.toggle('active', screen === 'game');
}

function startGame(rematch = false) {
  state.mode = document.querySelector('input[name="mode"]:checked').value;
  state.aiLevel = dom.aiLevelSelect.value;
  state.currentPlayer = 1;
  state.selected = null;
  state.pendingChain = null;
  state.timer = TURN_TIME;
  state.turnCount = 0;
  state.lastCaptureTurn = 0;
  state.gameActive = true;
  state.mode = state.mode;
  state.player1Name = dom.player1Name.value.trim() || 'Jugador 1';
  state.player2Name = state.mode === 'ai' ? 'ANIMA' : (dom.player2Name.value.trim() || 'Jugador 2');
  dom.displayName1.textContent = state.player1Name;
  dom.displayName2.textContent = state.player2Name;
  dom.turnIndicator.textContent = `Turno: ${state.player1Name}`;
  if (state.mode === 'ai') {
    dom.player2Name.value = 'ANIMA';
    dom.player2Name.disabled = true;
  } else {
    dom.player2Name.disabled = false;
  }
  initBoard();
  renderBoard();
  updateStatsPanel();
  showScreen('game');
  resetTimer();
  startTimer();
  queueAIMove();
  if (state.soundOn) playSound('start');
}

function initBoard() {
  state.board = Array.from({ length: BOARD_SIZE }, (_, row) =>
    Array.from({ length: BOARD_SIZE }, (_, col) => {
      if ((row + col) % 2 === 1) {
        if (row < 3) return createPiece(2);
        if (row > 4) return createPiece(1);
      }
      return null;
    })
  );
}

function renderBoard() {
  dom.board.innerHTML = '';
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const tile = document.createElement('div');
      tile.className = `cell ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
      tile.dataset.row = row;
      tile.dataset.col = col;
      const key = `${row},${col}`;
      if (specialPositions.has(key)) {
        tile.classList.add('special');
      }
      const piece = state.board[row][col];
      if (piece) {
        const pawn = document.createElement('div');
        pawn.className = `piece player${piece.player}`;
        if (piece.king) pawn.classList.add('king');
        if (piece.evolved) pawn.classList.add('evolved');
        if (piece.charged) pawn.classList.add('charged');
        pawn.innerHTML = `<span>${piece.evolved ? '★' : piece.king ? 'K' : ''}</span>`;
        tile.appendChild(pawn);
      }

      const selectedCell = state.selected && state.selected.row === row && state.selected.col === col;
      if (selectedCell) tile.classList.add('selected');

      const valid = state.validMoves.find((move) => move.toRow === row && move.toCol === col);
      if (valid) {
        tile.classList.add(valid.capture ? 'capture-highlight' : 'highlight');
      }
      tile.addEventListener('click', handleCellClick);
      dom.board.appendChild(tile);
    }
  }
}

function handleCellClick(event) {
  if (!state.gameActive) return;
  const row = Number(event.currentTarget.dataset.row);
  const col = Number(event.currentTarget.dataset.col);
  const piece = state.board[row][col];

  if (state.pendingChain) {
    const move = state.validMoves.find((move) => move.toRow === row && move.toCol === col);
    if (move) return applyMove(move);
    return;
  }

  const valid = state.validMoves.find((move) => move.toRow === row && move.toCol === col);
  if (valid) {
    return applyMove(valid);
  }

  if (piece && piece.player === state.currentPlayer) {
    state.selected = { row, col };
    state.validMoves = getMovesForPiece(row, col, state.board);
    renderBoard();
  }
}

function showNotice(message) {
  dom.gameNotice.textContent = message;
  dom.gameNotice.classList.remove('hidden');
  clearTimeout(dom.gameNotice.hideTimeout);
  dom.gameNotice.hideTimeout = setTimeout(() => {
    dom.gameNotice.classList.add('hidden');
  }, 1900);
}

function getMovesForPiece(row, col, board) {
  const piece = board[row][col];
  if (!piece) return [];

  const capturePaths = getCapturePaths(board, row, col, piece, [], []);
  if (capturePaths.length) {
    return capturePaths.map((path) => ({
      fromRow: row,
      fromCol: col,
      toRow: path.toRow,
      toCol: path.toCol,
      captures: path.captures,
      capture: true,
      usedCharge: false,
    }));
  }

  const moves = [];
  const directions = getDirections(piece);

  for (const [dr, dc] of directions) {
    const nextRow = row + dr;
    const nextCol = col + dc;
    if (!onBoard(nextRow, nextCol) || board[nextRow][nextCol]) continue;
    moves.push({ fromRow: row, fromCol: col, toRow: nextRow, toCol: nextCol, captures: [], capture: false, usedCharge: false });

    if (piece.charged || piece.evolved) {
      const jumpRow = nextRow + dr;
      const jumpCol = nextCol + dc;
      if (onBoard(jumpRow, jumpCol) && !board[jumpRow][jumpCol]) {
        moves.push({ fromRow: row, fromCol: col, toRow: jumpRow, toCol: jumpCol, captures: [], capture: false, usedCharge: true });
      }
    }
  }

  return moves;
}

function getCapturePaths(board, row, col, piece, visited, chain) {
  const opponent = piece.player === 1 ? 2 : 1;
  let results = [];
  const directions = getDirections(piece, true);

  for (const [dr, dc] of directions) {
    const midRow = row + dr;
    const midCol = col + dc;
    const landRow = row + dr * 2;
    const landCol = col + dc * 2;
    if (!onBoard(landRow, landCol)) continue;
    const mid = board[midRow][midCol];
    if (!mid || mid.player !== opponent) continue;
    if (board[landRow][landCol]) continue;
    const id = `${midRow},${midCol}`;
    if (visited.includes(id)) continue;

    const cloneBoard = cloneBoardState(board);
    cloneBoard[midRow][midCol] = null;
    cloneBoard[landRow][landCol] = { ...cloneBoard[row][col] };
    cloneBoard[row][col] = null;

    const chainVisited = [...visited, id];
    const nextPaths = getCapturePaths(cloneBoard, landRow, landCol, cloneBoard[landRow][landCol], chainVisited, []);
    if (nextPaths.length) {
      nextPaths.forEach((child) => {
        results.push({
          toRow: child.toRow,
          toCol: child.toCol,
          captures: [{ row: midRow, col: midCol }, ...child.captures],
        });
      });
    } else {
      results.push({ toRow: landRow, toCol: landCol, captures: [{ row: midRow, col: midCol }] });
    }
  }

  return sortCapturePaths(results);
}

function sortCapturePaths(paths) {
  return paths.sort((a, b) => b.captures.length - a.captures.length);
}

function getDirections(piece, captureOnly = false) {
  const forward = piece.player === 1 ? -1 : 1;
  if (piece.king || piece.evolved) {
    return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  }
  return [[forward, -1], [forward, 1]];
}

function onBoard(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function cloneBoardState(board) {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function applyMove(move) {
  const piece = state.board[move.fromRow][move.fromCol];
  state.board[move.fromRow][move.fromCol] = null;
  state.board[move.toRow][move.toCol] = piece;
  piece.moves += 1;

  if (move.capture && move.captures.length) {
    move.captures.forEach((target) => {
      state.board[target.row][target.col] = null;
    });
    state.lastCaptureTurn = state.turnCount;
    showNotice('Captura ejecutada + combo!');
    playSound('capture');
    spawnParticles(move.toRow, move.toCol, piece.player === 1 ? '#7df1f6' : '#ff76d8');
  } else {
    playSound('move');
  }

  if (specialPositions.has(`${move.toRow},${move.toCol}`) && !move.capture) {
    piece.charged = true;
    showNotice('Zona Neón activa: habilidad cargada');
  }

  if (move.usedCharge) {
    piece.charged = false;
  }

  if (piece.player === 1 && move.toRow === 0) {
    piece.king = true;
    piece.evolved = true;
    showNotice('¡Pieza evolucionada!');
    spawnParticles(move.toRow, move.toCol, '#83f4ff');
  }
  if (piece.player === 2 && move.toRow === BOARD_SIZE - 1) {
    piece.king = true;
    piece.evolved = true;
    showNotice('¡Pieza evolucionada!');
    spawnParticles(move.toRow, move.toCol, '#ff89f2');
  }

  state.turnCount += 1;
  state.selected = null;
  state.validMoves = [];

  const chainMoves = move.capture ? getMovesForPiece(move.toRow, move.toCol, state.board).filter((m) => m.capture) : [];
  if (move.capture && chainMoves.length) {
    state.pendingChain = { row: move.toRow, col: move.toCol };
    state.selected = { row: move.toRow, col: move.toCol };
    state.validMoves = chainMoves;
    renderBoard();
    if (state.mode === 'ai' && state.currentPlayer === AI_PLAYER) {
      queueAIMove(600);
    }
    return;
  }

  state.pendingChain = null;
  switchTurn();
}

function switchTurn() {
  state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
  state.timer = TURN_TIME;
  state.selected = null;
  state.validMoves = [];
  state.pendingChain = null;
  updateTurnText();
  renderBoard();
  if (checkGameEnd()) return;
  startTimer();
  queueAIMove();
}

function updateTurnText() {
  const name = state.currentPlayer === 1 ? state.player1Name : state.player2Name;
  dom.turnIndicator.textContent = `Turno: ${name}`;
}

function resetTimer() {
  clearInterval(state.timerInterval);
  state.timer = TURN_TIME;
  updateTimerDisplay();
}

function startTimer() {
  clearInterval(state.timerInterval);
  updateTimerDisplay();
  state.timerInterval = setInterval(() => {
    state.timer -= 1;
    updateTimerDisplay();
    if (state.timer <= 0) {
      clearInterval(state.timerInterval);
      showNotice('Tiempo agotado: turno perdido');
      playSound('timeout');
      switchTurn();
    }
  }, 1000);
}

function updateTimerDisplay() {
  dom.timerLabel.textContent = String(state.timer).padStart(2, '0');
  const percent = (state.timer / TURN_TIME) * 100;
  dom.timerBar.style.width = `${percent}%`;
  dom.timerBar.style.background = state.timer <= 5 ? 'linear-gradient(90deg, #ff7a8f, #ffbacc)' : 'linear-gradient(90deg, var(--accent), var(--accent2))';
}

function queueAIMove(delay = 500) {
  if (state.mode !== 'ai' || state.currentPlayer !== AI_PLAYER || !state.gameActive) return;
  setTimeout(() => {
    if (!state.gameActive) return;
    const move = chooseAIMove();
    if (move) applyMove(move);
  }, delay);
}

function chooseAIMove() {
  const moves = getAllAvailableMoves(state.currentPlayer, state.board);
  if (!moves.length) return null;
  const captures = moves.filter((move) => move.capture);
  if (captures.length) {
    return selectAIMove(captures);
  }
  return selectAIMove(moves);
}

function selectAIMove(moves) {
  if (state.aiLevel === 'easy') {
    return moves[Math.floor(Math.random() * moves.length)];
  }
  if (state.aiLevel === 'medium') {
    const rated = moves.map((move) => ({ move, score: evaluateMove(move) }));
    rated.sort((a, b) => b.score - a.score);
    return rated[0].move;
  }
  return searchBestMove(moves, 3);
}

function evaluateMove(move) {
  let score = 0;
  if (move.capture) score += move.captures.length * 18;
  if (specialPositions.has(`${move.toRow},${move.toCol}`)) score += 6;
  const toRow = move.toRow;
  score += state.currentPlayer === 2 ? toRow : BOARD_SIZE - 1 - toRow;
  if (move.usedCharge) score += 5;
  return score;
}

function searchBestMove(moves, depth) {
  let bestScore = -Infinity;
  let bestMove = moves[0];
  for (const move of moves) {
    const boardCopy = cloneBoardState(state.board);
    applyVirtualMove(boardCopy, move);
    const score = minimax(boardCopy, depth - 1, -Infinity, Infinity, false, 1);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}

function applyVirtualMove(board, move) {
  const piece = board[move.fromRow][move.fromCol];
  board[move.fromRow][move.fromCol] = null;
  board[move.toRow][move.toCol] = { ...piece, moves: piece.moves + 1 };
  if (move.capture) {
    move.captures.forEach((target) => {
      board[target.row][target.col] = null;
    });
  }
  if (piece.player === 2 && move.toRow === BOARD_SIZE - 1) {
    board[move.toRow][move.toCol].king = true;
    board[move.toRow][move.toCol].evolved = true;
  }
  if (piece.player === 1 && move.toRow === 0) {
    board[move.toRow][move.toCol].king = true;
    board[move.toRow][move.toCol].evolved = true;
  }
}

function minimax(board, depth, alpha, beta, maximizing, player) {
  const opponent = player === 2 ? 1 : 2;
  if (depth <= 0) return evaluateBoard(board);
  const moves = getAllAvailableMoves(player, board);
  if (!moves.length) return maximizing ? -9999 : 9999;

  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves.slice(0, 18)) {
      const copy = cloneBoardState(board);
      applyVirtualMove(copy, move);
      const evaluation = minimax(copy, depth - 1, alpha, beta, false, opponent);
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break;
    }
    return maxEval;
  }
  let minEval = Infinity;
  for (const move of moves.slice(0, 16)) {
    const copy = cloneBoardState(board);
    applyVirtualMove(copy, move);
    const evaluation = minimax(copy, depth - 1, alpha, beta, true, opponent);
    minEval = Math.min(minEval, evaluation);
    beta = Math.min(beta, evaluation);
    if (beta <= alpha) break;
  }
  return minEval;
}

function evaluateBoard(board) {
  let total = 0;
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const cell = board[row][col];
      if (!cell) continue;
      const baseValue = cell.evolved ? 17 : cell.king ? 12 : 8;
      const chargeBonus = cell.charged ? 2 : 0;
      const positionValue = cell.player === 2 ? row * 0.4 : (BOARD_SIZE - 1 - row) * 0.4;
      const color = cell.player === AI_PLAYER ? 1 : -1;
      total += color * (baseValue + chargeBonus + positionValue);
    }
  }
  return total;
}

function getAllAvailableMoves(player, board) {
  const moves = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = board[row][col];
      if (!piece || piece.player !== player) continue;
      const pieceMoves = getMovesForPiece(row, col, board);
      pieceMoves.forEach((move) => moves.push(move));
    }
  }
  const captureMoves = moves.filter((move) => move.capture);
  return captureMoves.length ? captureMoves : moves;
}

function endGame(result) {
  state.gameActive = false;
  clearInterval(state.timerInterval);
  let title = '¡Partida finalizada!';
  let message = '';
  let winner = '';
  if (result === 'draw') {
    title = 'Empate';
    message = 'Nadie dominó el tablero esta vez.';
    winner = 'Empate';
    state.stats.draws += 1;
  } else {
    winner = result === 1 ? state.player1Name : state.player2Name;
    title = `¡Victoria de ${winner}!`;
    message = result === 1 ? `${state.player1Name} lideró la estrategia.` : `${state.player2Name} ejecutó la jugada perfecta.`;
    result === 1 ? state.stats.winsP1 += 1 : state.stats.winsP2 += 1;
  }
  state.stats.games += 1;
  saveStats();
  updateStatsPanel();
  dom.endTitle.textContent = title;
  dom.endMessage.textContent = message;
  dom.endWinner.textContent = winner;
  dom.endMoves.textContent = state.turnCount;
  dom.endCaptures.textContent = calculateCaptures();
  dom.endScreen.classList.remove('hidden');
  playSound(result === 'draw' ? 'draw' : 'win');
}

function calculateCaptures() {
  let count = 0;
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (state.board[row][col] && state.board[row][col].moves > 0) {
        count += state.board[row][col].moves > 1 ? 1 : 0;
      }
    }
  }
  return Math.max(count, 1);
}

function updateStatsPanel() {
  dom.statGames.textContent = state.stats.games;
  dom.statP1.textContent = state.stats.winsP1;
  dom.statP2.textContent = state.stats.winsP2;
  dom.statDraws.textContent = state.stats.draws;
}

function checkGameEnd() {
  const moves = getAllAvailableMoves(state.currentPlayer, state.board);
  if (!moves.length) {
    const winner = state.currentPlayer === 1 ? 2 : 1;
    endGame(winner);
    return true;
  }
  const noCaptureCount = state.turnCount - state.lastCaptureTurn;
  if (noCaptureCount >= 50) {
    endGame('draw');
    return true;
  }
  return false;
}

function spawnParticles(row, col, color) {
  const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  if (!cell) return;
  for (let i = 0; i < 10; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.background = color;
    particle.style.left = '50%';
    particle.style.top = '50%';
    cell.appendChild(particle);
    const angle = Math.random() * Math.PI * 2;
    const distance = 28 + Math.random() * 18;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    particle.animate([
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(0.2)`, opacity: 0 }
    ], { duration: 700 + Math.random() * 300, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    setTimeout(() => particle.remove(), 900);
  }
}

function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playSound(type) {
  if (!state.soundOn) return;
  initAudioContext();
  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.connect(gain);
  gain.connect(audioContext.destination);
  const settings = {
    move: { freq: 440, duration: 0.12, type: 'sine' },
    capture: { freq: 580, duration: 0.16, type: 'triangle' },
    win: { freq: 720, duration: 0.4, type: 'sawtooth' },
    timeout: { freq: 320, duration: 0.22, type: 'square' },
    draw: { freq: 520, duration: 0.28, type: 'triangle' },
    start: { freq: 360, duration: 0.18, type: 'sine' },
  }[type] || { freq: 440, duration: 0.12, type: 'sine' };
  osc.type = settings.type;
  osc.frequency.value = settings.freq;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.13, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + settings.duration);
  osc.start(now);
  osc.stop(now + settings.duration + 0.02);
}

function startMusic() {
  if (!state.soundOn) return;
  initAudioContext();
  if (musicOscillator) return;
  musicGain = audioContext.createGain();
  musicGain.gain.setValueAtTime(0.05, audioContext.currentTime);
  musicGain.connect(audioContext.destination);
  musicOscillator = audioContext.createOscillator();
  musicOscillator.type = 'sine';
  musicOscillator.frequency.value = 110;
  musicOscillator.connect(musicGain);
  musicOscillator.start();
}

function stopMusic() {
  if (musicOscillator) {
    musicOscillator.stop();
    musicOscillator.disconnect();
    musicOscillator = null;
  }
  if (musicGain) {
    musicGain.disconnect();
    musicGain = null;
  }
}

window.addEventListener('beforeunload', () => {
  saveSettings();
  saveStats();
});

init();
