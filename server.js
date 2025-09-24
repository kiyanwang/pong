// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const WIN_SCORE = 11;

const gameState = {
  players: { 1: null, 2: null }, // slots
  ball: { x: 300, y: 200, vx: 4, vy: 2, radius: 8, pausedUntil: null },
  paddleHeight: 80,
  paddleWidth: 10,
  width: 600,
  height: 400,
  scores: { 1: 0, 2: 0 },
  gameOver: false,
  gameStarted: false,
};

function resetBall() {
  gameState.ball.x = gameState.width / 2;
  gameState.ball.y = gameState.height / 2;
  // reasonable starting speed
  const baseSpeed = 4;
  gameState.ball.vx = Math.random() > 0.5 ? baseSpeed : -baseSpeed;
  gameState.ball.vy = (Math.random() - 0.5) * 3;
  gameState.ball.pausedUntil = Date.now() + 2000; // 2 seconds pause
}

io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);

  // assign first available slot 1 or 2
  let myNumber = null;
  if (!gameState.players[1]) myNumber = 1;
  else if (!gameState.players[2]) myNumber = 2;
  else {
    socket.emit("full");
    return;
  }

  gameState.players[myNumber] = {
    socketId: socket.id,
    y: gameState.height / 2 - gameState.paddleHeight / 2,
    paddleSpeed: 0,
    number: myNumber,
  };
  socket.playerNumber = myNumber;
  socket.emit("playerNumber", myNumber);
  console.log(`Assigned player ${myNumber} to ${socket.id}`);

  // send an immediate state so client can initialize
  socket.emit("gameState", createOutboundState());

  // if both present, start
  if (gameState.players[1] && gameState.players[2] && !gameState.gameStarted) {
    gameState.gameStarted = true;
    gameState.scores = { 1: 0, 2: 0 };
    resetBall();
    io.sockets.emit("gameStart");
    io.sockets.emit("gameState", createOutboundState());
  }

  socket.on("paddleMove", (speed) => {
    const num = socket.playerNumber;
    if (!num) return;
    const p = gameState.players[num];
    if (!p || gameState.gameOver || !gameState.gameStarted) return;
    p.paddleSpeed = speed;
    p.y += speed;
    if (p.y < 0) p.y = 0;
    if (p.y + gameState.paddleHeight > gameState.height) {
      p.y = gameState.height - gameState.paddleHeight;
    }
  });

  socket.on("restart", () => {
    if (!gameState.gameOver) return;
    gameState.scores = { 1: 0, 2: 0 };
    gameState.gameOver = false;
    gameState.gameStarted = true;
    resetBall();
    io.sockets.emit("gameStart");
    io.sockets.emit("gameState", createOutboundState());
  });

  socket.on("disconnect", () => {
    console.log("disconnect:", socket.id);
    const num = socket.playerNumber;
    if (num && gameState.players[num] && gameState.players[num].socketId === socket.id) {
      gameState.players[num] = null;
      gameState.gameStarted = false;
      io.sockets.emit("playerLeft", { number: num });
      io.sockets.emit("gameState", createOutboundState());
    }
  });
});

function gameLoop() {
  if (gameState.gameOver || !gameState.gameStarted) return;

  const ball = gameState.ball;

  // if paused, do not move the ball (players can still reposition)
  if (ball.pausedUntil && Date.now() < ball.pausedUntil) {
    return;
  } else {
    ball.pausedUntil = null;
  }

  ball.x += ball.vx;
  ball.y += ball.vy;

  // bounce top/bottom
  if (ball.y - ball.radius < 0 || ball.y + ball.radius > gameState.height) {
    ball.vy *= -1;
  }

  // check paddle collisions for each present player
  for (const n of [1, 2]) {
    const p = gameState.players[n];
    if (!p) continue;
    const paddleX = n === 1 ? 20 : gameState.width - 20 - gameState.paddleWidth;
    const paddleY = p.y;

    if (
      ball.x - ball.radius < paddleX + gameState.paddleWidth &&
      ball.x + ball.radius > paddleX &&
      ball.y > paddleY &&
      ball.y < paddleY + gameState.paddleHeight
    ) {
      // reflect X
      ball.vx *= -1;
      // add vertical momentum based on paddle speed
      ball.vy += p.paddleSpeed * 0.5;
      // slightly increase horizontal speed
      ball.vx *= 1.05;
    }
  }

  // scoring
  if (ball.x < 0) {
    gameState.scores[2] += 1;
    checkWinner();
    resetBall();
  } else if (ball.x > gameState.width) {
    gameState.scores[1] += 1;
    checkWinner();
    resetBall();
  }
}

function checkWinner() {
  if (gameState.scores[1] >= WIN_SCORE) {
    gameState.gameOver = true;
    io.sockets.emit("gameOver", { winner: 1 });
  } else if (gameState.scores[2] >= WIN_SCORE) {
    gameState.gameOver = true;
    io.sockets.emit("gameOver", { winner: 2 });
  }
}

function createOutboundState() {
  // send a compact state with numeric player slots 1 and 2
  const outPlayers = {
    1: null,
    2: null,
  };
  for (const n of [1, 2]) {
    const p = gameState.players[n];
    outPlayers[n] = p ? { y: p.y, paddleSpeed: p.paddleSpeed, number: p.number } : null;
  }
  return {
    players: outPlayers,
    ball: { ...gameState.ball }, // includes pausedUntil (timestamp or null)
    paddleHeight: gameState.paddleHeight,
    paddleWidth: gameState.paddleWidth,
    width: gameState.width,
    height: gameState.height,
    scores: { ...gameState.scores },
    gameOver: gameState.gameOver,
    gameStarted: gameState.gameStarted,
  };
}

// run simulation + broadcast
setInterval(gameLoop, 1000 / 60); // simulation 60Hz
setInterval(() => {
  io.sockets.emit("gameState", createOutboundState());
}, 1000 / 30); // broadcast 30Hz

server.listen(3000, "0.0.0.0", () => {
  console.log("Server running on http://0.0.0.0:3000");
});
