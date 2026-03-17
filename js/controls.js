// UI controls: slider/input sync, keyboard, mouse, button handlers, ball list,
// auto-fire.

const CONTROLS = {
  angle:   { sliderId:'angle-slider',   inputId:'angle-input',   rowId:'row-angle',   stateKey:'angle',   focusKey:'a', step:1,    wrap:360     },
  height:  { sliderId:'height-slider',  inputId:'height-input',  rowId:'row-height',  stateKey:'height',  focusKey:'h', step:5,    freeMax:true },
  s:       { sliderId:'s-slider',       inputId:'s-input',       rowId:'row-s',       stateKey:'s',       focusKey:'s', step:0.5              },
  gravity: { sliderId:'gravity-slider', inputId:'gravity-input', rowId:'row-gravity', stateKey:'gravity', focusKey:'g', step:0.1              },
  speed:   { sliderId:'speed-slider',   inputId:'speed-input',   rowId:'row-speed',   stateKey:'speed',   focusKey:'t', step:0.1              },
  zoom:    { sliderId:'zoom-slider',    inputId:'zoom-input',    rowId:'row-zoom',    stateKey:'zoom',    focusKey:'z', step:0.05, freeRange:true },
};

// ── Modifier + held-key state ────────────────────────────────────
const mod      = { shift: false, ctrl: false };
const heldKeys = new Set();

function getMultiplier() { return mod.ctrl ? 10 : mod.shift ? 5 : 1; }

function syncSliderSteps() {
  const mult = getMultiplier();
  for (const c of Object.values(CONTROLS)) {
    if (c.slider) c.slider.step = c.step * mult;
  }
}

// ── Keyboard focus ───────────────────────────────────────────────
let focusedControl = null;

function focusControl(name) {
  if (focusedControl) CONTROLS[focusedControl].row.classList.remove('kb-focused');
  if (name === focusedControl) { focusedControl = null; return; }
  focusedControl = name;
  CONTROLS[name].row.classList.add('kb-focused');
}

// ── Held-key processing (called every animation frame) ───────────
function processHeldKeys() {
  const isRight = heldKeys.has('ArrowRight') || heldKeys.has('ArrowUp');
  const isLeft  = heldKeys.has('ArrowLeft')  || heldKeys.has('ArrowDown');
  if (!isRight && !isLeft) return;

  const dir  = isRight ? 1 : -1;
  const mult = getMultiplier();

  if (focusedControl) {
    const c = CONTROLS[focusedControl];
    c.set(state[c.stateKey] + dir * c.step * mult);
  } else {
    state.panX += dir * (50 / getScale()) * mult;
    render();
  }
}

// ── One-shot keyboard handler ────────────────────────────────────
function handleKeyDown(e) {
  if (e.target.tagName === 'INPUT' && e.target.type === 'number') return;
  const key = e.key.toLowerCase();

  // Focus keys
  for (const [name, ctrl] of Object.entries(CONTROLS)) {
    if (key === ctrl.focusKey) { focusControl(name); e.preventDefault(); return; }
  }

  // Arrow keys: movement handled by processHeldKeys; just prevent page scroll
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
    e.preventDefault(); return;
  }

  // One-shot actions
  if (e.key === ' ')                               { e.preventDefault(); handleFire();   }
  if (key  === 'p')                                { e.preventDefault(); togglePaths();  }
  if (key  === 'x')                                { e.preventDefault(); toggleAxes();   }
  if (e.key === 'Escape')                          { e.preventDefault(); stopAutoFire(); }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); handleClear();  }
}

function togglePaths() {
  const cb = document.getElementById('show-paths-cb');
  cb.checked = !cb.checked; state.showPaths = cb.checked; render();
}
function toggleAxes() {
  const cb = document.getElementById('show-axes-cb');
  cb.checked = !cb.checked; state.showAxes = cb.checked; render();
}

// ── Actions ──────────────────────────────────────────────────────
function handleFire() { fireBall(); updateBallList(); }

function handleClear() { clearBalls(); updateBallList(); render(); }

// ── Auto-fire ────────────────────────────────────────────────────
function startAutoFire() {
  const af = state.autoFire;
  af.fromAngle = parseFloat(document.getElementById('af-from').value)    || 30;
  af.toAngle   = parseFloat(document.getElementById('af-to').value)      || 75;
  af.step      = parseFloat(document.getElementById('af-step').value)    || 5;
  af.interval  = Math.max(0.05, parseFloat(document.getElementById('af-interval').value) || 1);
  af.step      = Math.abs(af.step) * (af.toAngle >= af.fromAngle ? 1 : -1);
  af.currentAngle = af.fromAngle;
  af.nextFireAt   = performance.now();
  af.active       = true;
  document.getElementById('af-start-btn').style.display = 'none';
  document.getElementById('af-stop-btn').style.display  = '';
}

function stopAutoFire() {
  state.autoFire.active = false;
  document.getElementById('af-start-btn').style.display = '';
  document.getElementById('af-stop-btn').style.display  = 'none';
}

// ── Ball list ────────────────────────────────────────────────────
function updateBallList() {
  const listEl = document.getElementById('ball-list');
  const noMsg  = document.getElementById('no-balls-msg');
  listEl.querySelectorAll('.ball-entry').forEach(el => el.remove());
  if (state.balls.length === 0) { noMsg.style.display = ''; return; }
  noMsg.style.display = 'none';
  const MAX_LIST = 50;
  for (const ball of [...state.balls].reverse().slice(0, MAX_LIST)) {
    const div = document.createElement('div');
    div.className = 'ball-entry';
    const stats = ball.landed
      ? `Air time: ${ball.timeInAir.toFixed(2)}&nbsp;t &nbsp;|&nbsp; x: ${ball.landX.toFixed(2)}`
      : `<em style="color:#6acf80">In flight\u2026</em>`;
    div.innerHTML = `
      <button class="show-path-btn">${ball.showPath ? 'Hide path' : 'Show path'}</button>
      <span class="ball-id">#${ball.id}</span><br/>
      Angle: ${ball.angle.toFixed(1)}\u00b0 &nbsp; s=${ball.s.toFixed(1)}<br/>
      ${stats}
    `;
    div.querySelector('.show-path-btn').addEventListener('click', () => {
      ball.showPath = !ball.showPath; updateBallList();
    });
    listEl.appendChild(div);
  }
}

// ── Tooltip (ball hover) ─────────────────────────────────────────
let mouseCanvasX = -9999, mouseCanvasY = -9999;
let mouseClientX = 0,     mouseClientY = 0;

function updateTooltip() {
  const tooltip = document.getElementById('ball-tooltip');
  let hovered = null;
  for (const ball of state.balls) {
    const [bx, by] = ball.landed ? w2c(ball.landX, 0) : w2c(ball.x, ball.y);
    if (Math.hypot(mouseCanvasX - bx, mouseCanvasY - by) < 12) { hovered = ball; break; }
  }
  if (hovered) {
    const dist = hovered.landed ? hovered.landX : hovered.x;
    tooltip.style.display = 'block';
    tooltip.style.left    = (mouseClientX + 14) + 'px';
    tooltip.style.top     = (mouseClientY - 28) + 'px';
    tooltip.textContent   =
      `#${hovered.id}  ${hovered.angle.toFixed(1)}\u00b0  x: ${dist.toFixed(3)}`;
  } else {
    tooltip.style.display = 'none';
  }
}

// ── Init ─────────────────────────────────────────────────────────
function initControls() {
  for (const c of Object.values(CONTROLS)) {
    c.slider = document.getElementById(c.sliderId);
    c.input  = document.getElementById(c.inputId);
    c.row    = document.getElementById(c.rowId);
    c.clamp  = v => Math.min(parseFloat(c.slider.max), Math.max(parseFloat(c.slider.min), v));

    c.set = (rawVal) => {
      let val = parseFloat(rawVal);
      if (isNaN(val)) return;
      val = c.wrap      ? ((val % c.wrap) + c.wrap) % c.wrap
          : c.freeMax   ? Math.max(parseFloat(c.slider.min), val)
          : c.freeRange ? Math.max(0.0001, val)   // zoom: just ensure positive
          :               c.clamp(val);

      if (c.stateKey === 'zoom') {
        const oldScale = getScale();
        state.zoom = val;
        const newScale = getScale();
        const cx = canvas.width / 2;
        const worldCX = cx / oldScale + WORLD_LEFT + state.panX;
        state.panX = worldCX - WORLD_LEFT - cx / newScale;
      } else {
        state[c.stateKey] = val;
      }

      c.slider.value = val;
      c.input.value  = parseFloat(val.toFixed(3));
      render();
    };

    c.slider.addEventListener('input',  () => c.set(c.slider.value));
    c.input.addEventListener('change',  () => c.set(c.input.value));
  }

  // Modifier keys
  document.addEventListener('keydown', e => {
    heldKeys.add(e.key);
    mod.shift = e.shiftKey; mod.ctrl = e.ctrlKey;
    syncSliderSteps();
    handleKeyDown(e);
  });
  document.addEventListener('keyup', e => {
    heldKeys.delete(e.key);
    mod.shift = e.shiftKey; mod.ctrl = e.ctrlKey;
    syncSliderSteps();
  });

  // Canvas drag to pan
  let dragging = false, dragStartX = 0, dragStartPan = 0;
  canvas.addEventListener('mousedown', e => {
    dragging = true; dragStartX = e.clientX; dragStartPan = state.panX;
    canvas.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouseCanvasX = e.clientX - rect.left;
    mouseCanvasY = e.clientY - rect.top;
    mouseClientX = e.clientX;
    mouseClientY = e.clientY;
    if (dragging) {
      state.panX = dragStartPan - (e.clientX - dragStartX) / getScale();
      render();
    }
    updateTooltip();
  });
  window.addEventListener('mouseup', () => {
    dragging = false; canvas.style.cursor = 'grab';
  });
  canvas.style.cursor = 'grab';

  // Mouse-wheel zoom centred on cursor (unlimited)
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const rect     = canvas.getBoundingClientRect();
    const mx       = e.clientX - rect.left;
    const oldScale = getScale();
    const factor   = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    state.zoom     = Math.max(0.0001, state.zoom * factor);
    const newScale = getScale();
    const worldAtMouse = mx / oldScale + WORLD_LEFT + state.panX;
    state.panX = worldAtMouse - WORLD_LEFT - mx / newScale;
    CONTROLS.zoom.slider.value = parseFloat(state.zoom.toFixed(3));
    CONTROLS.zoom.input.value  = parseFloat(state.zoom.toFixed(3));
    render();
  }, { passive: false });

  // Buttons
  document.getElementById('fire-btn').addEventListener('click',  handleFire);
  document.getElementById('clear-btn').addEventListener('click', handleClear);
  document.getElementById('show-paths-cb').addEventListener('change', e => {
    state.showPaths = e.target.checked; render();
  });
  document.getElementById('show-axes-cb').addEventListener('change', e => {
    state.showAxes = e.target.checked; render();
  });
  document.getElementById('fancy-glow-cb').addEventListener('change', e => {
    state.fancyGlow = e.target.checked; render();
  });
  document.getElementById('af-start-btn').addEventListener('click', startAutoFire);
  document.getElementById('af-stop-btn').addEventListener('click',  stopAutoFire);
}
