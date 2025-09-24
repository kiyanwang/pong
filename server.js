const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public")); // serve client files from /public

const gameState = {
  players: {}, // socket.id -> {y, paddleSpeed, number}
  ball: { x: 300, y: 200, vx: 4, vy: 2, radius: 8 },
  paddleHeight: 80,
  paddleWidth: 10,
  width: 600,
  height: 400,
};

function resetBall() {
  gameState.ball.x = gameState.width / 2;
  gameState.ball.y = gameState.height / 2;
  gameState.ball.vx = Math.random() > 0.5 ? 4 : -4;
  gameState.ball.vy = (Math.random() - 0.5) * 4;
}

io.on("connection", (socket) => {
  console.log("A player connected:", socket.id);

  // Assign player number (1 or 2)
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

  socket.on("paddleMove", (speed) => {
    if (gameState.players[socket.id]) {
      gameState.players[socket.id].paddleSpeed = speed;
      gameState.players[socket.id].y += speed;

      // Boundaries
      if (gameState.players[socket.id].y < 0) {
        gameState.players[socket.id].y = 0;
      }
      if (
        gameState.players[socket.id].y + gameState.paddleHeight >
        gameState.height
      ) {
        gameState.players[socket.id].y =
          gameState.height - gameState.paddleHeight;
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
    delete gameState.players[socket.id];
  });
});

function gameLoop() {
  const ball = gameState.ball;

  ball.x += ball.vx;
  ball.y += ball.vy;

  // Bounce top/bottom
  if (ball.y - ball.radius < 0 || ball.y + ball.radius > gameState.height) {
    ball.vy *= -1;
  }

  // Paddle collision detection
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

      // Add effect based on paddle movement speed
      ball.vy += player.paddleSpeed * 0.5;

      // Slightly increase horizontal speed
      ball.vx *= 1.05;
    }
  });

  // Left/right out of bounds
  if (ball.x < 0 || ball.x > gameState.width) {
    resetBall();
  }

  io.sockets.emit("gameState", gameState);
}

setInterval(gameLoop, 1000 / 60);

server.listen(3000, "0.0.0.0", () => {
  console.log("Server running on http://0.0.0.0:3000");
});
