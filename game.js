const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let player = {
  x: canvas.width / 2 - 25,
  y: canvas.height - 120,
  width: 50,
  height: 50,
  color: "cyan",
  speed: 8
};

function drawPlayer() {
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, player.width, player.height);
}

function update() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawPlayer();

  requestAnimationFrame(update);
}

update();

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") {
    player.x -= player.speed * 20;
  }

  if (e.key === "ArrowRight") {
    player.x += player.speed * 20;
  }
});
