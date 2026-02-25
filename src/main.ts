const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
resize();

ctx.fillStyle = '#1a1a2e';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = '#e0e0e0';
ctx.font = '24px monospace';
ctx.textAlign = 'center';
ctx.fillText('Imperial Battleground', canvas.width / 2, canvas.height / 2);
