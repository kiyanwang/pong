const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const WIN_SCORE = 11;

const gameState = {
  players: {},
  ball: { x: 300, y: 200, vx: 4, vy: 2, radius: 8 },
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
  gameState.ball.vx = Math.random() > 0.5 ? 4 : -4;
  gameState.ball.vy = (Math.random() - 0.5) * 4;
}

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  const numPlayers = Object.keys(gameState.players).length;
  if (numPlayers < 2) {
    gameState.players[socket.id] = {
      y: gameState.height / 2 - gameState.paddleHeight / 2,
      paddleSpeed: 0,
      number: numPlayers + 1,
    };
    socket.emit("playerNumber", numPlayers + 1);
  } else {
    socket.emit("full");
    return;
  }

  // Start automatically when both players connected
  if (Object.keys(gameState.players).length === 2 && !gameState.gameStarted) {
    gameState.gameStarted = true;
    io.sockets.emit("gameStart");
  }

  socket.on("paddleMove", (speed) => {
    const player = gameState.players[socket.id];
    if (player && !gameState.gameOver && gameState.gameStarted) {
      player.paddleSpeed = speed;
      player.y += speed;

      if (player.y < 0) player.y = 0;
      if (player.y + gameState.paddleHeight > gameState.height) {
        player.y = gameState.height - gameState.paddleHeight;
      }
    }
  });

  socket.on("restart", () => {
    if (gameState.gameOver) {
      gameState.scores = { 1: 0, 2: 0 };
      gameState.gameOver = false;
      gameState.gameStarted = true;
      resetBall();
      io.sockets.emit("gameStart");
    }
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
    delete gameState.players[socket.id];
    gameState.gameStarted = false; // pause until both rejoin
  });
});

function gameLoop() {
  if (gameState.gameOver || !gameState.gameStarted) return;

  const ball = gameState.ball;

  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.y - ball.radius < 0 || ball.y + ball.radius > gameState.height) {
    ball.vy *= -1;
  }

  // paddle collisions
  Object.values(gameState.players).forEach((player) => {
    let paddleX = player.number === 1 ? 20 : gameState.width - 20;
    let paddleY = player.y;

    if (
      ball.x - ball.radius < paddleX + gameState.paddleWidth &&
      ball.x + ball.radius > paddleX &&
      ball.y > paddleY &&
      ball.y < paddleY + gameState.paddleHeight
    ) {
      ball.vx *= -1;
      ball.vy += player.paddleSpeed * 0.5;
      ball.vx *= 1.05;
    }
  });

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

setInterval(gameLoop, 1000 / 60);

// broadcast state at 30 FPS
setInterval(() => {
  io.sockets.emit("gameState", gameState);
}, 1000 / 30);

server.listen(3000, "0.0.0.0", () => {
  console.log("Server running on http://0.0.0.0:3000");
});
