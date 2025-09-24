const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const WIDTH = 800;
const HEIGHT = 600;
const PADDLE_HEIGHT = 100;
const PADDLE_WIDTH = 20;
const WIN_SCORE = 11;

let gameState = {
  width: WIDTH,
  height: HEIGHT,
  paddleHeight: PADDLE_HEIGHT,
  paddleWidth: PADDLE_WIDTH,
  players: {},
  ball: { x: WIDTH / 2, y: HEIGHT / 2, vx: 4, vy: 2, radius: 10 },
  scores: { 1: 0, 2: 0 },
  gameOver: false,
  gameStarted: false,
};

function resetBall() {
  gameState.ball.x = WIDTH / 2;
  gameState.ball.y = HEIGHT / 2;
  gameState.ball.vx = Math.random() > 0.5 ? 4 : -4;
  gameState.ball.vy = (Math.random() - 0.5) * 4;
  gameState.ball.pausedUntil = Date.now() + 2000; // pause for 2 seconds
}

function checkWinner() {
  if (gameState.scores[1] >= WIN_SCORE || gameState.scores[2] >= WIN_SCORE) {
    gameState.gameOver = true;
  }
}

function gameLoop() {
  if (gameState.gameOver || !gameState.gameStarted) return;

  const ball = gameState.ball;
  if (ball.pausedUntil && Date.now() < ball.pausedUntil) return;
  ball.pausedUntil = null;

  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.y - ball.radius < 0 || ball.y + ball.radius > HEIGHT) {
    ball.vy *= -1;
  }

Object.values(gameState.players).forEach((player) => {
  if (player.dir) {
    player.y += player.dir * 7;
    if (player.y < 0) player.y = 0;
    if (player.y + PADDLE_HEIGHT > HEIGHT) player.y = HEIGHT - PADDLE_HEIGHT;
    player.paddleSpeed = player.dir * 7;
  } else {
    player.paddleSpeed = 0;
  }
});


  Object.values(gameState.players).forEach((player) => {
    let paddleX = player.number === 1 ? 20 : WIDTH - 20 - PADDLE_WIDTH;
    let paddleY = player.y;
    if (
      ball.x - ball.radius < paddleX + PADDLE_WIDTH &&
      ball.x + ball.radius > paddleX &&
      ball.y > paddleY &&
      ball.y < paddleY + PADDLE_HEIGHT
    ) {
      ball.vx *= -1;
      ball.vy += player.paddleSpeed * 0.5;
      ball.vx *= 1.05;
    }
  });

  if (ball.x < 0) {
    gameState.scores[2] += 1;
    checkWinner();
    resetBall();
  } else if (ball.x > WIDTH) {
    gameState.scores[1] += 1;
    checkWinner();
    resetBall();
  }
}

setInterval(() => {
  gameLoop();
  io.sockets.emit("state", gameState);
}, 1000 / 60);

io.on("connection", (socket) => {
  console.log("a user connected");

  if (!gameState.players[1]) {
    gameState.players[1] = { number: 1, y: HEIGHT / 2 - PADDLE_HEIGHT / 2, paddleSpeed: 0 };
    socket.emit("init", { playerNumber: 1 });
  } else if (!gameState.players[2]) {
    gameState.players[2] = { number: 2, y: HEIGHT / 2 - PADDLE_HEIGHT / 2, paddleSpeed: 0 };
    socket.emit("init", { playerNumber: 2 });
    gameState.gameStarted = true;
  } else {
    socket.emit("init", { playerNumber: 0 });
  }


	socket.on("move", (data) => {
	  const player = Object.values(gameState.players).find((p) => p.number === data.player);
	  if (player) {
	    player.dir = data.dir; // just store direction (-1, 0, 1)
	  }
	});

  socket.on("restart", () => {
    gameState.scores = { 1: 0, 2: 0 };
    gameState.gameOver = false;
    resetBall();
    io.sockets.emit("restart");
  });

  socket.on("disconnect", () => {
    console.log("a user disconnected");
    gameState = {
      width: WIDTH,
      height: HEIGHT,
      paddleHeight: PADDLE_HEIGHT,
      paddleWidth: PADDLE_WIDTH,
      players: {},
      ball: { x: WIDTH / 2, y: HEIGHT / 2, vx: 4, vy: 2, radius: 10 },
      scores: { 1: 0, 2: 0 },
      gameOver: false,
      gameStarted: false,
    };
  });
});

server.listen(3000, "0.0.0.0", () => {
  console.log("Server running on http://0.0.0.0:3000");
});
