const express = require("express");
const http = require("http");
const path = require("path");
const mysql = require("mysql2");
const session = require("express-session");
const { Server } = require("socket.io");
const dotenv = require("dotenv");

const authRoutes = require("./routes/authRoutes");

dotenv.config();

const app = express();
const server = http.createServer(app);

/* ================= MYSQL ================= */
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

if (!global.dbConnected) {
  db.connect((err) => {
    if (err) {
      console.log("MySQL connection failed:", err);
    } else {
      console.log("MySQL Connected Successfully");
      global.dbConnected = true;
    }
  });
}

/* ================= MIDDLEWARE ================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("trust proxy", 1);

/* ================= SESSION ================= */
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "checkers_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24
  }
});

app.use(sessionMiddleware);

/* ================= ROUTES ================= */
app.use("/api/auth", authRoutes);

/* ================= AUTH GUARD ================= */
function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect("/auth.html");
  next();
}

/* ================= PAGES ================= */
app.get("/", (req, res) => {
  if (req.session.user) return res.redirect("/lobby.html");
  res.redirect("/auth.html");
});

app.get("/auth.html", (req, res) => {
  if (req.session.user) return res.redirect("/lobby.html");
  res.sendFile(path.join(__dirname, "public", "auth.html"));
});

app.get("/lobby.html", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "lobby.html"));
});

app.get("/index.html", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use(express.static(path.join(__dirname, "public")));

/* ================= SOCKET.IO ================= */
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true
  }
});

io.engine.use(sessionMiddleware);

/* ================= SOCKET AUTH FIX ================= */
io.use((socket, next) => {
  const session = socket.request.session;

  if (!session || !session.user) {
    return next(new Error("Unauthorized"));
  }

  socket.data.user = session.user;
  next();
});

/* ================= GAME STATE ================= */
const rooms = new Map();

function createPiece(color, king = false) {
  return { color, king };
}

function createBoard() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 !== 0) board[r][c] = createPiece("black");
    }
  }

  for (let r = 5; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 !== 0) board[r][c] = createPiece("red");
    }
  }

  return board;
}

function createRoom(id) {
  return {
    id,
    players: { red: null, black: null },
    board: createBoard(),
    currentTurn: "red",
    winner: null,
    scores: { redCaptures: 0, blackCaptures: 0 }
  };
}

/* ================= SOCKET EVENTS ================= */
io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("joinRoom", (roomId) => {
    let room = rooms.get(roomId);

    if (!room) {
      room = createRoom(roomId);
      rooms.set(roomId, room);
    }

    let color = "spectator";

    if (!room.players.red) {
      room.players.red = socket.id;
      color = "red";
    } else if (!room.players.black) {
      room.players.black = socket.id;
      color = "black";
    }

    socket.join(roomId);
    socket.data.roomId = roomId;

    socket.emit("roomJoined", {
      roomId,
      board: room.board,
      currentTurn: room.currentTurn,
      winner: room.winner,
      yourColor: color,
      scores: room.scores
    });

    io.to(roomId).emit("message", `${color} joined`);
  });

  socket.on("makeMove", ({ roomId, from, to }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const piece = room.board[from.row][from.col];
    if (!piece) return;

    room.board[to.row][to.col] = piece;
    room.board[from.row][from.col] = null;

    if (Math.abs(from.row - to.row) === 2) {
      const mr = (from.row + to.row) / 2;
      const mc = (from.col + to.col) / 2;

      const captured = room.board[mr][mc];

      if (captured) {
        if (captured.color === "red") room.scores.blackCaptures++;
        else room.scores.redCaptures++;
      }

      room.board[mr][mc] = null;
    }

    if (piece.color === "red" && to.row === 0) piece.king = true;
    if (piece.color === "black" && to.row === 7) piece.king = true;

    let red = 0, black = 0;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = room.board[r][c];
        if (p) {
          if (p.color === "red") red++;
          else black++;
        }
      }
    }

    if (red === 0) room.winner = "black";
    if (black === 0) room.winner = "red";

    room.currentTurn = room.currentTurn === "red" ? "black" : "red";

    io.to(roomId).emit("moveApplied", {
      roomState: room
    });
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    if (room.players.red === socket.id) room.players.red = null;
    if (room.players.black === socket.id) room.players.black = null;

    if (!room.players.red && !room.players.black) {
      rooms.delete(roomId);
    }
  });
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});