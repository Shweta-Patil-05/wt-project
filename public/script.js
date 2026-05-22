const socket = io({
  withCredentials: true
});

const boardEl = document.getElementById("board");
const roomNameEl = document.getElementById("roomName");
const turnText = document.getElementById("turnText");
const turnBadge = document.getElementById("turnBadge");
const winnerText = document.getElementById("winnerText");
const redCapturesEl = document.getElementById("redCaptures");
const blackCapturesEl = document.getElementById("blackCaptures");
const redKingsEl = document.getElementById("redKings");
const blackKingsEl = document.getElementById("blackKings");
const messages = document.getElementById("messages");
const resetBoardBtn = document.getElementById("resetBoardBtn");
const leaveRoomBtn = document.getElementById("leaveRoomBtn");
const myColorEl = document.getElementById("myColor");
const playerRedStatusEl = document.getElementById("playerRedStatus");
const playerBlackStatusEl = document.getElementById("playerBlackStatus");

const urlParams = new URLSearchParams(window.location.search);
const roomId = (urlParams.get("room") || "").trim();

if (!roomId) {
  window.location.href = "/lobby.html";
}

let board = [];
let currentTurn = "red";
let winner = null;
let scores = {
  redCaptures: 0,
  blackCaptures: 0,
  redKings: 0,
  blackKings: 0
};

let myColor = null;
let selectedPiece = null;
let highlightedMoves = [];
let forcedContinuation = null;
let playerStatus = {
  red: "waiting",
  black: "waiting"
};

roomNameEl.textContent = roomId;

function addMessage(text) {
  const div = document.createElement("div");
  div.className = "msg";
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function isInsideBoard(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function getDirections(piece) {
  if (piece.king) {
    return [
      [-1, -1], [-1, 1],
      [1, -1], [1, 1]
    ];
  }

  return piece.color === "red"
    ? [[-1, -1], [-1, 1]]
    : [[1, -1], [1, 1]];
}

function getCaptureMoves(row, col, piece) {
  const moves = [];
  const directions = getDirections(piece);

  for (const [dr, dc] of directions) {
    const middleRow = row + dr;
    const middleCol = col + dc;
    const jumpRow = row + dr * 2;
    const jumpCol = col + dc * 2;

    if (!isInsideBoard(middleRow, middleCol) || !isInsideBoard(jumpRow, jumpCol)) {
      continue;
    }

    const middlePiece = board[middleRow][middleCol];
    const landing = board[jumpRow][jumpCol];

    if (
      middlePiece &&
      middlePiece.color !== piece.color &&
      landing === null
    ) {
      moves.push({
        row: jumpRow,
        col: jumpCol,
        capture: true,
        capturedRow: middleRow,
        capturedCol: middleCol
      });
    }
  }

  return moves;
}

function getSimpleMoves(row, col, piece) {
  const moves = [];
  const directions = getDirections(piece);

  for (const [dr, dc] of directions) {
    const newRow = row + dr;
    const newCol = col + dc;

    if (isInsideBoard(newRow, newCol) && board[newRow][newCol] === null) {
      moves.push({
        row: newRow,
        col: newCol,
        capture: false
      });
    }
  }

  return moves;
}

function getAllForcedPieces(color) {
  const forced = [];

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color === color) {
        const captures = getCaptureMoves(row, col, piece);
        if (captures.length > 0) {
          forced.push({ row, col });
        }
      }
    }
  }

  return forced;
}

function getValidMoves(row, col) {
  const piece = board[row][col];
  if (!piece) return [];

  const captures = getCaptureMoves(row, col, piece);
  if (captures.length > 0) return captures;

  const forced = getAllForcedPieces(piece.color);
  if (forced.length > 0) return [];

  return getSimpleMoves(row, col, piece);
}

function clearSelection() {
  selectedPiece = null;
  highlightedMoves = [];
}

function applyRoomState(state) {
  board = state.board || [];
  currentTurn = state.currentTurn || "red";
  winner = state.winner || null;
  forcedContinuation = state.forcedContinuation || null;
  scores = state.scores || {
    redCaptures: 0,
    blackCaptures: 0,
    redKings: 0,
    blackKings: 0
  };

  playerStatus = state.players || {
    red: "waiting",
    black: "waiting"
  };

  if (state.yourColor) {
    myColor = state.yourColor;
  }

  roomNameEl.textContent = state.roomId || roomId;

  const turnLabel = currentTurn.charAt(0).toUpperCase() + currentTurn.slice(1);
  turnText.textContent = turnLabel;
  turnBadge.textContent = winner
    ? `Winner: ${winner.charAt(0).toUpperCase() + winner.slice(1)}`
    : `Current Turn: ${turnLabel}`;

  winnerText.textContent = winner
    ? winner.charAt(0).toUpperCase() + winner.slice(1)
    : "None";

  redCapturesEl.textContent = scores.redCaptures;
  blackCapturesEl.textContent = scores.blackCaptures;
  redKingsEl.textContent = scores.redKings;
  blackKingsEl.textContent = scores.blackKings;

  myColorEl.textContent = myColor
    ? myColor.charAt(0).toUpperCase() + myColor.slice(1)
    : "Unknown";

  playerRedStatusEl.textContent = playerStatus.red;
  playerBlackStatusEl.textContent = playerStatus.black;
}

function canCurrentUserPlayPiece(piece, row, col) {
  if (!piece) return false;
  if (winner) return false;
  if (!myColor) return false;
  if (myColor === "spectator") return false;
  if (myColor !== currentTurn) return false;
  if (piece.color !== myColor) return false;

  if (forcedContinuation) {
    return (
      forcedContinuation.color === myColor &&
      forcedContinuation.row === row &&
      forcedContinuation.col === col
    );
  }

  return true;
}

function handleCellClick(row, col) {
  const piece = board[row][col];

  if (piece && canCurrentUserPlayPiece(piece, row, col)) {
    selectedPiece = { row, col };

    if (
      forcedContinuation &&
      forcedContinuation.color === myColor &&
      forcedContinuation.row === row &&
      forcedContinuation.col === col
    ) {
      highlightedMoves = getCaptureMoves(row, col, piece);
    } else {
      highlightedMoves = getValidMoves(row, col);
    }

    renderBoard();
    return;
  }

  if (!selectedPiece) return;

  const chosenMove = highlightedMoves.find(
    (move) => move.row === row && move.col === col
  );

  if (!chosenMove) return;

  socket.emit("makeMove", {
    roomId,
    from: {
      row: selectedPiece.row,
      col: selectedPiece.col
    },
    to: {
      row,
      col
    }
  });
}

function renderBoard() {
  boardEl.innerHTML = "";

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const cell = document.createElement("div");
      cell.className = "cell " + (((row + col) % 2 === 0) ? "light" : "dark");

      const moveHere = highlightedMoves.some(
        (move) => move.row === row && move.col === col
      );

      if (moveHere) {
        cell.classList.add("highlight");
      }

      if (
        forcedContinuation &&
        forcedContinuation.row === row &&
        forcedContinuation.col === col
      ) {
        cell.classList.add("must-capture");
      }

      cell.addEventListener("click", () => handleCellClick(row, col));

      const piece = board[row][col];

      if (piece) {
        const pieceEl = document.createElement("div");
        pieceEl.className = `piece ${piece.color}-piece`;

        if (piece.king) {
          pieceEl.classList.add("king");
        }

        if (
          selectedPiece &&
          selectedPiece.row === row &&
          selectedPiece.col === col
        ) {
          pieceEl.classList.add("selected");
        }

        if (!canCurrentUserPlayPiece(piece, row, col)) {
          pieceEl.style.cursor = "default";
          pieceEl.style.opacity = "0.96";
        }

        cell.appendChild(pieceEl);
      }

      boardEl.appendChild(cell);
    }
  }
}

resetBoardBtn.addEventListener("click", () => {
  socket.emit("resetGame", roomId);
});

leaveRoomBtn.addEventListener("click", () => {
  window.location.href = "/lobby.html";
});

function joinCurrentRoom() {
  socket.emit("joinRoom", roomId);
}

socket.on("connect", () => {
  addMessage("Connected to server.");
  joinCurrentRoom();
});

socket.io.on("reconnect", () => {
  addMessage("Reconnected to server.");
  joinCurrentRoom();
});

socket.on("disconnect", () => {
  addMessage("Disconnected from server.");
});

socket.on("connect_error", () => {
  addMessage("Connection error. Please refresh and login again.");
});

socket.on("roomJoined", (state) => {
  myColor = state.yourColor || "spectator";
  clearSelection();
  applyRoomState(state);
  renderBoard();
  addMessage(`Joined room ${state.roomId} as ${myColor}.`);
});

socket.on("roomState", (state) => {
  clearSelection();
  applyRoomState(state);
  renderBoard();
});

socket.on("moveApplied", ({ roomState, message }) => {
  clearSelection();
  applyRoomState(roomState);

  if (
    forcedContinuation &&
    forcedContinuation.color === myColor
  ) {
    selectedPiece = {
      row: forcedContinuation.row,
      col: forcedContinuation.col
    };

    const forcedPiece = board[forcedContinuation.row][forcedContinuation.col];
    highlightedMoves = forcedPiece
      ? getCaptureMoves(
          forcedContinuation.row,
          forcedContinuation.col,
          forcedPiece
        )
      : [];
  }

  renderBoard();

  if (message) {
    addMessage(message);
  }
});

socket.on("invalidMove", (msg) => {
  addMessage(msg || "Invalid move.");
});

socket.on("message", (msg) => {
  addMessage(msg);
});
