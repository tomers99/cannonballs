// All canvas drawing. Reads from state, canvas, and transform globals.

const BARREL_LEN = 55;
const BARREL_W   = 14;

const PALETTE = ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#ff922b','#cc5de8','#f06595','#74c0fc'];
function ballColor(id) { return PALETTE[(id - 1) % PALETTE.length]; }

// ── Sky ──────────────────────────────────────────────────────────
function drawSky() {
  const gy   = groundCY();
  const grad = ctx.createLinearGradient(0, 0, 0, gy);
  grad.addColorStop(0,   '#4a90d9');
  grad.addColorStop(0.7, '#87c4ed');
  grad.addColorStop(1,   '#c2e4f5');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, gy);
}

// ── Ground strip ─────────────────────────────────────────────────
function drawGround() {
  const gy = groundCY();
  ctx.fillStyle = '#6b4c2a';
  ctx.fillRect(0, gy, canvas.width, GROUND_H);
  ctx.fillStyle = '#4a8a38';
  ctx.fillRect(0, gy, canvas.width, 10);
}

// ── Hill ─────────────────────────────────────────────────────────
// Left base is at world (WORLD_LEFT, 0); peak at world (0, height).
// Both computed via w2c so panning preserves the hill shape.
function drawHill() {
  const [lx, ]   = w2c(WORLD_LEFT, 0);   // left base
  const [px, py] = w2c(0, state.height); // peak / launch point
  const gy = groundCY();

  // Body
  ctx.beginPath();
  ctx.moveTo(lx, gy);
  ctx.bezierCurveTo(
    lx + (px - lx) * 0.20, gy,
    lx + (px - lx) * 0.65, py + (gy - py) * 0.12,
    px, py
  );
  ctx.lineTo(px, gy);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, py, 0, gy);
  grad.addColorStop(0, '#4a8a38');
  grad.addColorStop(1, '#365f28');
  ctx.fillStyle = grad;
  ctx.fill();

  // Grass surface line
  ctx.beginPath();
  ctx.moveTo(lx, gy);
  ctx.bezierCurveTo(
    lx + (px - lx) * 0.20, gy,
    lx + (px - lx) * 0.65, py + (gy - py) * 0.12,
    px, py
  );
  ctx.strokeStyle = '#72c455';
  ctx.lineWidth   = 4;
  ctx.stroke();
}

// ── Height label (plain number left of the cliff face) ───────────
function drawHeightLabel() {
  const [cx, cy_top] = w2c(0, state.height);
  const [,   cy_bot] = w2c(0, 0);
  const midY = (cy_top + cy_bot) / 2;
  ctx.save();
  ctx.font      = '11px Courier New';
  ctx.fillStyle = 'rgba(190, 220, 190, 0.85)';
  ctx.textAlign = 'right';
  ctx.fillText(Math.round(state.height), cx - 6, midY + 4);
  ctx.textAlign = 'left';
  ctx.restore();
}

// ── Cannon ───────────────────────────────────────────────────────
function drawCannon() {
  const [mx, my] = w2c(0, state.height);
  const a_rad    = displayToPhysicalRad(state.angle);
  const bx = mx - BARREL_LEN * Math.cos(a_rad);
  const by = my + BARREL_LEN * Math.sin(a_rad);

  // Wheel
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 5; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;
  ctx.beginPath(); ctx.arc(bx, by, 11, 0, Math.PI * 2);
  ctx.fillStyle = '#7a4520'; ctx.fill();
  ctx.strokeStyle = '#3a1e08'; ctx.lineWidth = 2; ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#3a1e08'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    const sa = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(bx + Math.cos(sa) * 3.5, by + Math.sin(sa) * 3.5);
    ctx.lineTo(bx + Math.cos(sa) * 10,  by + Math.sin(sa) * 10);
    ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = '#2a1008'; ctx.fill();
  ctx.restore();

  // Barrel
  ctx.save();
  ctx.translate(mx, my);
  ctx.rotate(-a_rad);
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 6; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#2c2c2c';
  ctx.fillRect(-BARREL_LEN, -BARREL_W / 2, BARREL_LEN, BARREL_W);
  ctx.fillStyle = '#484848';
  ctx.fillRect(-BARREL_LEN + 3, -BARREL_W / 2 + 2, BARREL_LEN - 6, 3);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#404040';
  ctx.fillRect(-BARREL_LEN + 8, -BARREL_W / 2 - 1, 6, BARREL_W + 2);
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(-5, -BARREL_W / 2 - 2, 8, BARREL_W + 4);
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(0, 0, BARREL_W * 0.32, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ── Angle label (left of muzzle) ─────────────────────────────────
function drawAngleLabel() {
  const [mx, my] = w2c(0, state.height);
  const text = `${Math.round(state.angle)}\u00b0`;
  ctx.save();
  ctx.font = 'bold 12px Courier New';
  const tw = ctx.measureText(text).width;
  const lx = mx - 12 - tw, ly = my - 14;
  ctx.fillStyle = 'rgba(0,0,20,0.65)';
  ctx.fillRect(lx - 3, ly - 13, tw + 7, 17);
  ctx.fillStyle = '#ffe87c';
  ctx.fillText(text, lx, ly);
  ctx.restore();
}

// ── Ball paths ───────────────────────────────────────────────────
function drawPaths() {
  for (const ball of state.balls) {
    if (!ball.showPath && !state.showPaths) continue;
    if (ball.path.length < 2) continue;
    ctx.beginPath();
    const [x0, y0] = w2c(ball.path[0][0], ball.path[0][1]);
    ctx.moveTo(x0, y0);
    for (let i = 1; i < ball.path.length; i++) {
      const [xi, yi] = w2c(ball.path[i][0], ball.path[i][1]);
      ctx.lineTo(xi, yi);
    }
    ctx.strokeStyle = ballColor(ball.id) + 'aa';
    ctx.lineWidth   = 1.5;
    ctx.stroke();
  }
}

// ── Cannonballs ──────────────────────────────────────────────────
function drawBalls() {
  for (const ball of state.balls) {
    const [cx, cy] = ball.landed ? w2c(ball.landX, 0) : w2c(ball.x, ball.y);
    const r        = ball.landed ? 4 : 6;
    const color    = ballColor(ball.id);
    ctx.save();
    if (!ball.landed) {
      if (state.fancyGlow) {
        ctx.shadowColor = color; ctx.shadowBlur = 10;
      } else {
        // Cheap glow: radial gradient halo, no shadowBlur
        const grad = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r + 4);
        grad.addColorStop(0,   color + '50');
        grad.addColorStop(0.5, color + '28');
        grad.addColorStop(1,   color + '00');
        ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }
    }
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle   = ball.landed ? '#888' : color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    if (ball.landed) {
      ctx.save();
      ctx.font = '9px Courier New'; ctx.fillStyle = '#bbb';
      ctx.fillText(`#${ball.id}`, cx + 6, cy + 4);
      ctx.restore();
    }
  }
}

// ── Coordinate axes ───────────────────────────────────────────────
function niceStep(range) {
  if (range <= 0) return 1;
  const rough = range / 7;
  const mag   = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm  = rough / mag;
  const nice  = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
  return nice * mag;
}

function drawAxes() {
  if (!state.showAxes) return;
  const s    = getScale();
  const gy   = groundCY();
  const AXIS = 'rgba(255,255,255,0.55)';
  const TICK = 'rgba(255,255,255,0.40)';
  const LBL  = 'rgba(220,220,220,0.85)';

  ctx.save();
  ctx.font = '9px Courier New';

  // ── Y axis: fixed at canvas x = 38, labels show world y ──────
  const YX = 38;
  const worldYTop = gy / s;               // world y at canvas top
  const yStep     = niceStep(worldYTop);

  ctx.strokeStyle = AXIS; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(YX, 0); ctx.lineTo(YX, gy); ctx.stroke();

  for (let wy = 0; wy <= worldYTop + yStep; wy += yStep) {
    const cy = gy - wy * s;
    if (cy < 0 || cy > gy) continue;
    ctx.strokeStyle = TICK;
    ctx.beginPath(); ctx.moveTo(YX - 4, cy); ctx.lineTo(YX + 4, cy); ctx.stroke();
    ctx.fillStyle = LBL; ctx.textAlign = 'right';
    ctx.fillText(Math.round(wy), YX - 6, cy + 3);
  }

  // ── X axis: fixed at canvas y = gy + 14 (inside brown ground) ─
  const XY = gy + 14;
  // visible world x range
  const wxLeft  = WORLD_LEFT + state.panX;
  const wxRight = wxLeft + canvas.width / s;
  const xStep   = niceStep(canvas.width / s);
  const xStart  = Math.ceil(wxLeft / xStep) * xStep;

  ctx.strokeStyle = AXIS; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, XY); ctx.lineTo(canvas.width, XY); ctx.stroke();

  ctx.textAlign = 'center';
  for (let wx = xStart; wx <= wxRight; wx += xStep) {
    const cx = (wx - WORLD_LEFT - state.panX) * s;
    ctx.strokeStyle = TICK;
    ctx.beginPath(); ctx.moveTo(cx, XY - 4); ctx.lineTo(cx, XY + 4); ctx.stroke();
    ctx.fillStyle = LBL;
    ctx.fillText(Math.round(wx), cx, XY + 13);
  }

  ctx.textAlign = 'left';
  ctx.restore();
}

// ── Master render ────────────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSky();
  drawGround();
  drawHill();
  drawHeightLabel();
  drawAxes();
  drawPaths();
  drawCannon();
  drawBalls();
  drawAngleLabel();
}
