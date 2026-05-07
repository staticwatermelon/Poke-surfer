const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const STATE = {
  RUNNING: "running",
  GAME_OVER: "game_over"
};

let laneX = [];
let laneWidth = 0;

const player = {
  lane: 1,
  y: 0,
  width: 0,
  height: 0,
  color: "#00e5ff"
};

let obstacles = [];
let coins = [];
let score = 0;
let gameState = STATE.RUNNING;
let distanceSpeed = 5;
let speedIncreaseTimer = 0;
let obstacleSpawnTimer = 0;
let coinSpawnTimer = 0;
let lastTime = 0;

const MIN_OBSTACLE_GAP = 260;
const BASE_OBSTACLE_SPAWN_MS = 850;
const BASE_COIN_SPAWN_MS = 550;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  laneWidth = canvas.width / 3;
  laneX = [laneWidth * 0.5, laneWidth * 1.5, laneWidth * 2.5];

  player.width = Math.min(56, laneWidth * 0.35);
  player.height = player.width;
  player.y = canvas.height - player.height - 28;
}

function resetGame() {
  player.lane = 1;
  obstacles = [];
  coins = [];
  score = 0;
  distanceSpeed = 5;
  speedIncreaseTimer = 0;
  obstacleSpawnTimer = 0;
  coinSpawnTimer = 0;
  gameState = STATE.RUNNING;
}

function drawBackground() {
  ctx.fillStyle = "#1b1b1b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#444";
  ctx.lineWidth = 4;
  ctx.setLineDash([20, 18]);
  for (let i = 1; i < 3; i += 1) {
    const x = laneWidth * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawPlayer() {
  const x = laneX[player.lane] - player.width / 2;
  ctx.fillStyle = player.color;
  ctx.fillRect(x, player.y, player.width, player.height);
}

function spawnObstacle() {
  const lane = Math.floor(Math.random() * 3);
  const width = player.width;
  const height = player.height * 1.1;

  obstacles.push({
    lane,
    y: -height,
    width,
    height,
    vx: (Math.random() - 0.5) * 0.6
  });
}

function spawnCoin() {
  const lane = Math.floor(Math.random() * 3);
  coins.push({
    lane,
    y: -20,
    radius: Math.max(10, player.width * 0.2)
  });
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function updateEntities(dt) {
  obstacleSpawnTimer += dt;
  coinSpawnTimer += dt;
  speedIncreaseTimer += dt;

  const obstacleSpawnRate = Math.max(420, BASE_OBSTACLE_SPAWN_MS - distanceSpeed * 35);
  if (obstacleSpawnTimer > obstacleSpawnRate) {
    obstacleSpawnTimer = 0;
    spawnObstacle();
  }

  if (coinSpawnTimer > BASE_COIN_SPAWN_MS) {
    coinSpawnTimer = 0;
    spawnCoin();
  }

  if (speedIncreaseTimer > 1500) {
    speedIncreaseTimer = 0;
    distanceSpeed += 0.25;
  }

  const playerRect = {
    x: laneX[player.lane] - player.width / 2,
    y: player.y,
    width: player.width,
    height: player.height
  };

  obstacles = obstacles.filter((obstacle, i) => {
    obstacle.y += distanceSpeed;
    obstacle.lane = Math.min(2, Math.max(0, obstacle.lane + obstacle.vx * dt * 0.002));

    const ox = laneWidth * (obstacle.lane + 0.5) - obstacle.width / 2;
    const oRect = { x: ox, y: obstacle.y, width: obstacle.width, height: obstacle.height };

    if (rectsOverlap(playerRect, oRect)) {
      gameState = STATE.GAME_OVER;
      return true;
    }

    return obstacle.y < canvas.height + 80;
  });

  coins = coins.filter((coin) => {
    coin.y += distanceSpeed * 0.95;
    const cx = laneX[coin.lane];

    const touches =
      cx + coin.radius > playerRect.x &&
      cx - coin.radius < playerRect.x + playerRect.width &&
      coin.y + coin.radius > playerRect.y &&
      coin.y - coin.radius < playerRect.y + playerRect.height;

    if (touches) {
      score += 10;
      return false;
    }

    return coin.y < canvas.height + 30;
  });

  score += dt * 0.01;
}

function drawObstacles() {
  ctx.fillStyle = "#ff6b6b";
  for (const obstacle of obstacles) {
    const x = laneWidth * (obstacle.lane + 0.5) - obstacle.width / 2;
    ctx.fillRect(x, obstacle.y, obstacle.width, obstacle.height);
  }
}

function drawCoins() {
  ctx.fillStyle = "#ffd54f";
  for (const coin of coins) {
    const x = laneX[coin.lane];
    ctx.beginPath();
    ctx.arc(x, coin.y, coin.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawUI() {
  ctx.fillStyle = "#fff";
  ctx.font = "bold 24px system-ui, sans-serif";
  ctx.fillText(`Score: ${Math.floor(score)}`, 20, 36);

  if (gameState === STATE.GAME_OVER) {
    const panelWidth = Math.min(canvas.width * 0.8, 320);
    const panelHeight = 180;
    const x = (canvas.width - panelWidth) / 2;
    const y = (canvas.height - panelHeight) / 2;

    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(x, y, panelWidth, panelHeight);

    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "bold 34px system-ui, sans-serif";
    ctx.fillText("Game Over", canvas.width / 2, y + 58);
    ctx.font = "20px system-ui, sans-serif";
    ctx.fillText(`Final Score: ${Math.floor(score)}`, canvas.width / 2, y + 95);

    const bw = 150;
    const bh = 46;
    const bx = canvas.width / 2 - bw / 2;
    const by = y + 115;

    ctx.fillStyle = "#00b894";
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.fillText("Restart", canvas.width / 2, by + 30);

    ctx.textAlign = "start";

    return { bx, by, bw, bh };
  }

  return null;
}

let restartButton = null;

function gameLoop(timestamp) {
  if (!lastTime) {
    lastTime = timestamp;
  }
  const dt = Math.min(40, timestamp - lastTime);
  lastTime = timestamp;

  drawBackground();

  if (gameState === STATE.RUNNING) {
    updateEntities(dt);
  }

  drawCoins();
  drawObstacles();
  drawPlayer();
  restartButton = drawUI();

  requestAnimationFrame(gameLoop);
}

function moveLane(direction) {
  if (gameState !== STATE.RUNNING) {
    return;
  }
  player.lane = Math.max(0, Math.min(2, player.lane + direction));
}

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") {
    moveLane(-1);
  }
  if (e.key === "ArrowRight") {
    moveLane(1);
  }
  if (e.key.toLowerCase() === "r" && gameState === STATE.GAME_OVER) {
    resetGame();
  }
});

let touchStartX = null;
let touchStartY = null;

canvas.addEventListener("touchstart", (e) => {
  const t = e.changedTouches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
}, { passive: true });

canvas.addEventListener("touchend", (e) => {
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;

  if (gameState === STATE.GAME_OVER) {
    if (restartButton) {
      const inside = t.clientX >= restartButton.bx && t.clientX <= restartButton.bx + restartButton.bw &&
        t.clientY >= restartButton.by && t.clientY <= restartButton.by + restartButton.bh;
      if (inside) {
        resetGame();
      }
    }
    return;
  }

  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 24) {
    moveLane(dx > 0 ? 1 : -1);
  }
}, { passive: true });

canvas.addEventListener("click", (e) => {
  if (gameState === STATE.GAME_OVER && restartButton) {
    const inside = e.clientX >= restartButton.bx && e.clientX <= restartButton.bx + restartButton.bw &&
      e.clientY >= restartButton.by && e.clientY <= restartButton.by + restartButton.bh;
    if (inside) {
      resetGame();
    }
  }
});

window.addEventListener("resize", resizeCanvas);

resizeCanvas();
resetGame();
requestAnimationFrame(gameLoop);
