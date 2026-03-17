// Flight physics.
// Each ball has a private time t (starts at 0 when fired):
//   x(t) = s * cos(a) * t
//   y(t) = g/2 * t² + s * sin(a) * t + h
// where s is the muzzle speed snapshotted at fire time.

const MAX_BALLS    = 500;  // hard cap to prevent memory runaway
const PATH_STEP_SQ = 25;   // store path point only if moved ≥5 world units (squared)

let nextId = 1;

function fireBall() {
  if (state.balls.length >= MAX_BALLS) state.balls.shift(); // drop oldest
  const a_rad = displayToPhysicalRad(state.angle);
  const ball = {
    id:        nextId++,
    angle:     state.angle,
    angleRad:  a_rad,
    s:         state.s,
    height:    state.height,
    gravity:   state.gravity,
    privateT:  0,
    x:         0,
    y:         state.height,
    path:      [[0, state.height]],
    landed:    false,
    landX:     null,
    timeInAir: null,
    showPath:  false,
  };
  state.balls.push(ball);
  return ball;
}

function clearBalls() {
  state.balls = [];
  nextId = 1;
}

// Advance all in-flight balls by dtSim t-units.
// Returns true if any ball newly landed this tick.
function updateBalls(dtSim) {
  let anyLanded = false;
  for (const ball of state.balls) {
    if (ball.landed) continue;
    ball.privateT += dtSim;
    const t = ball.privateT;
    ball.x = ball.s * Math.cos(ball.angleRad) * t;
    ball.y = ball.gravity / 2 * t * t + ball.s * Math.sin(ball.angleRad) * t + ball.height;

    if (ball.y <= 0) {
      // Solve (g/2)t² + s·sin(a)·t + h = 0 exactly so the landing position
      // is frame-rate independent and always identical for the same parameters.
      const A = ball.gravity / 2;
      const B = ball.s * Math.sin(ball.angleRad);
      const C = ball.height;
      let t_land = ball.privateT; // fallback
      if (A === 0) {
        if (B !== 0) t_land = Math.max(0, -C / B); // linear (g=0)
      } else {
        const disc = B * B - 4 * A * C;
        if (disc >= 0) {
          const sq   = Math.sqrt(disc);
          const t1   = (-B + sq) / (2 * A);
          const t2   = (-B - sq) / (2 * A);
          const pos  = [t1, t2].filter(t => t >= 0);
          if (pos.length > 0) t_land = Math.min(...pos);
        }
      }
      ball.y         = 0;
      ball.landed    = true;
      ball.landX     = ball.s * Math.cos(ball.angleRad) * t_land;
      ball.timeInAir = t_land;
      ball.path.push([ball.landX, 0]); // exact landing point — never below ground
      anyLanded      = true;
    } else {
      // Path decimation: only record if ball moved enough since last stored point
      const last = ball.path[ball.path.length - 1];
      const dx = ball.x - last[0], dy = ball.y - last[1];
      if (dx * dx + dy * dy >= PATH_STEP_SQ) {
        ball.path.push([ball.x, ball.y]);
      }
    }
  }
  return anyLanded;
}
