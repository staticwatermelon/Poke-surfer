const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const STATE = {
  RUNNING: "running",
  GAME_OVER: "game_over"
};

let laneX = [];
let laneWidth = 0;

const player = {
  currentLane: 1,
  targetLane: 1,
  x: 0,
  targetX: 0,
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
let visualTime = 0;
let roadScroll = 0;

const MIN_OBSTACLE_GAP = 260;
const BASE_OBSTACLE_SPAWN_MS = 850;
const BASE_COIN_SPAWN_MS = 550;

const horizonYRatio = 0.2;
const nearRoadHalfWidthRatio = 0.48;
const farRoadHalfWidthRatio = 0.1;

const spriteDefs = {
  player: "assets/player.png",
  train: "assets/train.png",
  coin: "assets/coin.png",
  road: "assets/road.png",
  background: "assets/background.png"
};

const sprites = {};

function loadSprites() {
  for (const [key, src] of Object.entries(spriteDefs)) {
    const img = new Image();
    img.src = src;
    sprites[key] = { img, loaded: false };
    img.onload = () => {
      sprites[key].loaded = true;
    };
    img.onerror = () => {
      sprites[key].loaded = false;
    };
  }
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  laneWidth = canvas.width / 3;
  laneX = [laneWidth * 0.5, laneWidth * 1.5, laneWidth * 2.5];

  player.width = Math.min(56, laneWidth * 0.35);
  player.height = player.width;
  player.y = canvas.height - player.height - 28;
  player.x = laneX[player.currentLane];
  player.targetX = laneX[player.targetLane];
}

function resetGame() {
  player.currentLane = 1;
  player.targetLane = 1;
  player.x = laneX[player.currentLane];
  player.targetX = laneX[player.targetLane];
  obstacles = [];
  coins = [];
  score = 0;
  distanceSpeed = 5;
  speedIncreaseTimer = 0;
  obstacleSpawnTimer = 0;
  coinSpawnTimer = 0;
  gameState = STATE.RUNNING;
}

function getRoadEdges(y) {
  const horizonY = canvas.height * horizonYRatio;
  const t = Math.max(0, Math.min(1, (y - horizonY) / (canvas.height - horizonY)));
  const halfWidth = (canvas.width * farRoadHalfWidthRatio) + ((canvas.width * nearRoadHalfWidthRatio) - (canvas.width * farRoadHalfWidthRatio)) * t;
  return { left: canvas.width / 2 - halfWidth, right: canvas.width / 2 + halfWidth, t, horizonY };
}

function getPerspectiveScale(y) {
  const { t } = getRoadEdges(y);
  return 0.45 + t * 0.95;
}

function drawBackground() {
  const bg = sprites.background;
  if (bg?.loaded) {
    const parallax = (roadScroll * 0.15) % canvas.width;
    ctx.drawImage(bg.img, -parallax, 0, canvas.width, canvas.height);
    ctx.drawImage(bg.img, canvas.width - parallax, 0, canvas.width, canvas.height);
  } else {
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, "#87b5ff");
    sky.addColorStop(0.45, "#a6d7ff");
    sky.addColorStop(1, "#1f2a44");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(255,255,255,0.22)";
    for (let i = 0; i < 8; i += 1) {
      const x = ((i * 210) - (roadScroll * 0.05) % 210);
      ctx.beginPath();
      ctx.arc(x, 110 + (i % 2) * 16, 38, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const { horizonY } = getRoadEdges(canvas.height);
  ctx.fillStyle = "rgba(25, 28, 32, 0.35)";
  ctx.fillRect(0, horizonY - 6, canvas.width, canvas.height - horizonY + 6);
}

function drawRoad() {
  const horizonY = canvas.height * horizonYRatio;
  const near = getRoadEdges(canvas.height);
  const far = getRoadEdges(horizonY);

  ctx.beginPath();
  ctx.moveTo(far.left, horizonY);
  ctx.lineTo(far.right, horizonY);
  ctx.lineTo(near.right, canvas.height);
  ctx.lineTo(near.left, canvas.height);
  ctx.closePath();

  if (sprites.road?.loaded) {
    ctx.save();
    ctx.clip();
    const tex = sprites.road.img;
    const scrollY = roadScroll % tex.height;
    ctx.drawImage(tex, near.left, horizonY + scrollY - tex.height, near.right - near.left, canvas.height - horizonY + tex.height);
    ctx.drawImage(tex, near.left, horizonY + scrollY, near.right - near.left, canvas.height - horizonY + tex.height);
    ctx.restore();
  } else {
    const asphalt = ctx.createLinearGradient(0, horizonY, 0, canvas.height);
    asphalt.addColorStop(0, "#3f454d");
    asphalt.addColorStop(1, "#181b20");
    ctx.fillStyle = asphalt;
    ctx.fill();
  }

  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(210, 230, 255, 0.6)";
  for (let i = 1; i < 3; i += 1) {
    const laneY = horizonY;
    const topX = far.left + ((far.right - far.left) * i) / 3;
    const bottomX = near.left + ((near.right - near.left) * i) / 3;
    ctx.setLineDash([16, 12]);
    ctx.beginPath();
    ctx.moveTo(topX, laneY);
    ctx.lineTo(bottomX, canvas.height);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawShadow(x, y, scale, widthFactor = 1) {
  const w = player.width * scale * widthFactor;
  const h = w * 0.25;
  const gradient = ctx.createRadialGradient(x, y, 1, x, y, w * 0.55);
  gradient.addColorStop(0, "rgba(0,0,0,0.33)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(x, y, w * 0.5, h, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer() {
  const bounce = Math.sin(visualTime * 0.013) * 6;
  const y = player.y + bounce;
  drawShadow(player.x, player.y + player.height * 0.92, 1, 0.9);

  const p = sprites.player;
  if (p?.loaded) {
    ctx.drawImage(p.img, player.x - player.width / 2, y, player.width, player.height);
    return;
  }

  // Fallback runner
  const cx = player.x;
  const bodyW = player.width * 0.34;
  const bodyH = player.height * 0.42;
  ctx.fillStyle = "#00e5ff";
  ctx.fillRect(cx - bodyW / 2, y + player.height * 0.34, bodyW, bodyH);
  ctx.fillStyle = "#ffd7b0";
  ctx.beginPath();
  ctx.arc(cx, y + player.height * 0.22, player.width * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#00e5ff";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx - 4, y + player.height * 0.55);
  ctx.lineTo(cx - player.width * 0.17, y + player.height * 0.9);
  ctx.moveTo(cx + 4, y + player.height * 0.55);
  ctx.lineTo(cx + player.width * 0.17, y + player.height * 0.9);
  ctx.stroke();
}

function spawnObstacle() {
  const lane = Math.floor(Math.random() * 3);
  const width = player.width;
  const height = player.height * 1.1;

  obstacles.push({
    lane,
    y: -height,
    width,
    height
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
  visualTime += dt;
  roadScroll += distanceSpeed * dt * 0.12;

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

  const laneMoveLerp = 1 - Math.exp(-0.02 * dt);
  player.x += (player.targetX - player.x) * laneMoveLerp;
  const snapDistance = 0.5;
  if (Math.abs(player.x - player.targetX) <= snapDistance) {
    player.x = player.targetX;
    player.currentLane = player.targetLane;
  }

  const playerRect = {
    x: player.x - player.width / 2,
    y: player.y,
    width: player.width,
    height: player.height
  };

  obstacles = obstacles.filter((obstacle) => {
    obstacle.y += distanceSpeed;

    const ox = laneX[obstacle.lane] - obstacle.width / 2;
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
  for (const obstacle of obstacles) {
    const scale = getPerspectiveScale(obstacle.y + obstacle.height);
    const w = obstacle.width * scale;
    const h = obstacle.height * scale;
    const x = laneX[obstacle.lane] - w / 2;
    const y = obstacle.y - h * 0.08;
    drawShadow(laneX[obstacle.lane], y + h * 0.98, scale, 1.1);

    if (sprites.train?.loaded) {
      ctx.drawImage(sprites.train.img, x, y, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(x + w * 0.08, y + h * 0.08, w * 0.84, h * 0.12);
      continue;
    }

    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, "#c74848");
    g.addColorStop(1, "#7f1f1f");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#ffd0d0";
    ctx.fillRect(x + w * 0.1, y + h * 0.1, w * 0.8, h * 0.12);
    ctx.fillStyle = "#3b4455";
    ctx.fillRect(x + w * 0.12, y + h * 0.36, w * 0.76, h * 0.18);
  }
}

function drawCoins() {
  for (const coin of coins) {
    const scale = getPerspectiveScale(coin.y) * 0.88;
    const r = coin.radius * scale;
    const x = laneX[coin.lane];
    const y = coin.y;

    drawShadow(x, y + r * 1.4, scale, 0.55);

    if (sprites.coin?.loaded) {
      ctx.drawImage(sprites.coin.img, x - r, y - r, r * 2, r * 2);
    } else {
      const cg = ctx.createRadialGradient(x - r * 0.25, y - r * 0.22, 1, x, y, r);
      cg.addColorStop(0, "#fff8cf");
      cg.addColorStop(0.55, "#ffd54f");
      cg.addColorStop(1, "#dd9f00");
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const shine = 0.55 + Math.sin(visualTime * 0.018 + y * 0.05) * 0.25;
    ctx.strokeStyle = `rgba(255,255,255,${shine})`;
    ctx.lineWidth = Math.max(1.5, r * 0.14);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, Math.PI * 1.2, Math.PI * 1.75);
    ctx.stroke();
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
  drawRoad();

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
  const nextLane = Math.max(0, Math.min(2, player.targetLane + direction));
  player.targetLane = nextLane;
  player.targetX = laneX[player.targetLane];
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

loadSprites();
resizeCanvas();
resetGame();
requestAnimationFrame(gameLoop);
