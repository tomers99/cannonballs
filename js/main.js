// Entry point. Wires all modules and runs the animation loop.

function resizeCanvas() {
  const panel   = document.getElementById('world-panel');
  canvas.width  = panel.clientWidth;
  canvas.height = panel.clientHeight;
  render();
}

let lastTimestamp = null;
let needsBallListUpdate = false;

function loop(ts) {
  if (lastTimestamp !== null) {
    const dtReal = Math.min((ts - lastTimestamp) / 1000, 0.1);
    const dtSim  = dtReal * state.speed;
    state.globalT += dtSim;

    processHeldKeys();
    if (updateBalls(dtSim)) needsBallListUpdate = true;
    updateTooltip();

    // Auto-fire tick (at most one shot per frame)
    if (state.autoFire.active) {
      const now = performance.now();
      if (now >= state.autoFire.nextFireAt) {
        const af = state.autoFire;
        CONTROLS.angle.set(af.currentAngle);
        fireBall();
        needsBallListUpdate = true;
        const next = af.currentAngle + af.step;
        const done = af.step > 0 ? next > af.toAngle + 1e-9 : next < af.toAngle - 1e-9;
        if (done) { stopAutoFire(); needsBallListUpdate = true; }
        else { af.currentAngle = next; af.nextFireAt = now + af.interval * 1000; }
      }
    }

    if (needsBallListUpdate) { updateBallList(); needsBallListUpdate = false; }
  }
  lastTimestamp = ts;
  render();
  requestAnimationFrame(loop);
}

initCanvas(document.getElementById('world-canvas'));
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
initControls();
canvas.focus();

// ── Panel resize (horizontal drag handle) ────────────────────
(function() {
  const handle    = document.getElementById('panel-resize');
  const menuPanel = document.getElementById('menu-panel');
  let dragging = false, startX = 0, startW = 0;
  handle.addEventListener('mousedown', e => {
    dragging = true; startX = e.clientX; startW = menuPanel.offsetWidth;
    e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const newW = Math.max(180, Math.min(600, startW - (e.clientX - startX)));
    menuPanel.style.width = newW + 'px';
    resizeCanvas();
  });
  window.addEventListener('mouseup', () => { dragging = false; });
})();

// ── Ball list resize (vertical drag handle) ───────────────────
(function() {
  const handle   = document.getElementById('ball-list-handle');
  const ballList = document.getElementById('ball-list');
  let dragging = false, startY = 0, startH = 0;
  handle.addEventListener('mousedown', e => {
    dragging = true; startY = e.clientY; startH = ballList.offsetHeight;
    e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const newH = Math.max(60, startH + (e.clientY - startY));
    ballList.style.height = newH + 'px';
  });
  window.addEventListener('mouseup', () => { dragging = false; });
})();

requestAnimationFrame(loop);
