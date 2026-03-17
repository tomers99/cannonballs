# Cannonballs — Project Documentation

## Overview

A browser-based 2D cannonball simulation. A cannon sits on a hill; the user fires balls at configurable angles and observes parabolic trajectories under configurable gravity, muzzle speed, and time scale. The simulation is purely client-side: open `index.html` by double-click, no server required.

---

## File Structure

```
Cannonballs/
├── index.html          — Shell, all CSS, HTML layout, <script> loading order
└── js/
    ├── canvas.js       — Shared canvas/context references
    ├── state.js        — Single source of truth for all mutable state
    ├── transform.js    — World ↔ canvas coordinate math
    ├── physics.js      — Flight equations, path storage, landing detection
    ├── render.js       — All canvas drawing
    ├── controls.js     — UI wiring, keyboard, mouse, auto-fire, ball list
    └── main.js         — Animation loop, canvas resize, panel drag-resize
```

Scripts are loaded in the order above with plain `<script>` tags (no ES modules), so every function and variable is global. Load order matters: each file may call functions defined in earlier files.

---

## Physics Model

Each ball obeys exact closed-form kinematics — no numerical integration for position:

```
x(t) = s · cos(a) · t
y(t) = (g/2) · t² + s · sin(a) · t + h
```

| Symbol | Meaning |
|--------|---------|
| `t`    | Ball's **private time**, starts at 0 the moment it is fired |
| `s`    | Muzzle speed (snapshot of `state.s` at fire time) |
| `a`    | Physical angle in radians (`displayToPhysicalRad(state.angle)`) |
| `g`    | Gravity (negative; snapshot of `state.gravity`) |
| `h`    | Launch height (snapshot of `state.height`) |

### Landing

When `y(t) ≤ 0`, the exact landing time `t_land` is computed analytically by solving the quadratic `(g/2)t² + s·sin(a)·t + h = 0`. This makes `landX = s·cos(a)·t_land` perfectly frame-rate-independent — identical regardless of how many frames the ball took to fly.

### Angle Convention

Display angles follow the **standard math convention**: 0° = right (+x), increasing counter-clockwise.

```javascript
// js/transform.js
function displayToPhysicalRad(deg) {
  return deg * Math.PI / 180;
}
```

---

## Coordinate System

```
World space:   x → right,  y ↑ up   (origin at cannon base, world x=0, y=0)
Canvas space:  x → right,  y ↓ down (standard HTML canvas)
```

Key constants (in `transform.js`):

| Constant | Value | Meaning |
|----------|-------|---------|
| `GROUND_H` | 50 px | Height of the brown ground strip at canvas bottom |
| `WORLD_LEFT` | −200 | World x shown at canvas left edge (never changes with pan) |

```javascript
function getScale()      { return (canvas.height - GROUND_H) / 400 * state.zoom; }
function groundCY()      { return canvas.height - GROUND_H; }
function w2c(wx, wy)     { return [(wx - WORLD_LEFT - state.panX) * s,  groundCY() - wy * s]; }
```

The same scale applies to both axes, so **zoom always preserves shape** (no distortion). Panning is a horizontal offset only (`state.panX`).

---

## State (`js/state.js`)

All mutable values live in one `state` object:

| Key | Default | Meaning |
|-----|---------|---------|
| `angle` | 45 | Display angle (°), 0 = right, CCW |
| `height` | 150 | Hill / launch height (world units) |
| `gravity` | −9.8 | Gravitational acceleration (world units / t²) |
| `s` | 150 | Muzzle speed (world units / t) |
| `speed` | 1 | Simulation speed multiplier (t-units per real second) |
| `zoom` | 0.2 | Zoom level (1 = default scale) |
| `panX` | 0 | Horizontal pan offset (world units) |
| `showPaths` | false | Show all ball paths globally |
| `showAxes` | true | Show coordinate axes |
| `balls` | `[]` | Array of live ball objects |
| `globalT` | 0 | Accumulated simulation time (informational) |
| `autoFire` | object | Auto-fire sweep configuration (see below) |

### Ball Object

Each ball created by `fireBall()` carries:

| Field | Meaning |
|-------|---------|
| `id` | Ordinal integer, resets to 1 on clear |
| `angle`, `s`, `height`, `gravity` | Snapshots of state at fire time |
| `angleRad` | Physical angle in radians |
| `privateT` | Ball's own elapsed simulation time |
| `x`, `y` | Current world position |
| `path` | `[[x,y], ...]` — trajectory recorded during flight (decimated, see below) |
| `landed` | Boolean |
| `landX`, `timeInAir` | Set on landing (exact analytic values) |
| `showPath` | Per-ball path display toggle |

### Auto-Fire Object

| Field | Meaning |
|-------|---------|
| `active` | Whether sweep is running |
| `fromAngle`, `toAngle` | Sweep range (°) |
| `step` | Angular increment per shot (°) |
| `interval` | Real-time gap between shots (seconds) |
| `currentAngle` | Next angle to fire |
| `nextFireAt` | `performance.now()` timestamp for next shot |

---

## Modules

### `js/canvas.js`
Holds the two globals `canvas` and `ctx`. `initCanvas(el)` populates them from the `<canvas>` element. All other modules reference these globals directly.

### `js/transform.js`
Pure coordinate math. No side effects. Provides `getScale()`, `groundCY()`, `w2c()`, `displayToPhysicalRad()`.

### `js/physics.js`

**`fireBall()`** — Snapshots current state into a new ball object, appends it to `state.balls`. Hard cap: if `state.balls.length >= 500`, the oldest ball is dropped (`shift()`) before adding the new one.

**`updateBalls(dtSim)`** — Advances every in-flight ball by `dtSim` simulation time units. Returns `true` if any ball landed this tick (signals the caller to refresh the UI list). Path points are added with **decimation**: a new point is only stored when the ball has moved ≥5 world units from the last stored point (`PATH_STEP_SQ = 25`). On landing, only the exact analytic landing point `[landX, 0]` is appended — no underground points are ever stored.

**`clearBalls()`** — Empties `state.balls` and resets `nextId` to 1.

### `js/render.js`
All drawing in one file; reads `state` and calls `w2c()`. Nothing is mutated.

| Function | What it draws |
|----------|---------------|
| `drawSky()` | Blue gradient sky above ground line |
| `drawGround()` | Brown ground strip + thin green grass line |
| `drawHill()` | Bezier-curved green hill; left base anchored at `w2c(WORLD_LEFT, 0)` so it is pan-safe |
| `drawHeightLabel()` | Numeric height label to the left of the cliff face |
| `drawCannon()` | Wheel + barrel, rotated to current angle; muzzle at world (0, height) |
| `drawAngleLabel()` | Current angle in degrees, displayed near the muzzle |
| `drawPaths()` | Parabolic paths for balls with `showPath=true` or `state.showPaths=true` |
| `drawBalls()` | Circles for all balls (glowing if in flight, grey if landed) with ID labels |
| `drawAxes()` | X and Y axes with auto-scaled tick marks (`niceStep()`) when `state.showAxes` is true |
| `render()` | Master function: clears canvas and calls all draw functions in correct z-order |

### `js/controls.js`

#### CONTROLS table
A declarative map from control name → slider ID, input ID, row ID, state key, keyboard focus key, step size, and behaviour flags:

| Flag | Effect |
|------|--------|
| `wrap: 360` | Value wraps modulo 360 (angle) |
| `freeMax: true` | No upper bound (height) |
| `freeRange: true` | Only enforces `> 0.0001` (zoom) |
| *(none)* | Clamped to slider min/max |

Each control gets a `c.set(val)` function that applies the correct clamping/wrapping, updates both the slider and number input, and calls `render()`. The zoom `set()` also adjusts `state.panX` to keep the canvas centre fixed in world space during a zoom change.

#### Keyboard handling
- **Focus keys** (`A`, `H`, `S`, `G`, `T`, `Z`): select a control row (highlighted in red); Arrow keys then adjust that control.
- **Arrow keys with no focused control**: pan the view left/right.
- **Held-key tracking**: `heldKeys` Set is updated on `keydown`/`keyup`. `processHeldKeys()` is called every animation frame for smooth continuous adjustment, independent of browser key-repeat rate.
- **Modifiers**: `Shift` = ×5, `Ctrl` = ×10 step multiplier (applied to both slider step and held-key adjustment).
- **One-shot keys**: `Space` = fire, `P` = toggle paths, `X` = toggle axes, `Delete`/`Backspace` = clear, `Escape` = stop auto-fire.

#### Mouse handling
- **Canvas drag**: pans `state.panX`.
- **Mouse wheel**: zooms centred on cursor position; adjusts `panX` to hold the world point under the cursor fixed.
- **Hover tooltip**: shows ball `#id`, firing angle, and current/final x distance.

#### Auto-fire
`startAutoFire()` reads the four inputs, sets `af.step` sign to match sweep direction, and arms `af.active = true`. `stopAutoFire()` disarms it and shows the Start button again.

#### Ball list
`updateBallList()` rebuilds the DOM list (latest 50 entries shown). Each entry shows angle, `s`, air time and landing x (or "In flight" for active balls), and a per-ball Show/Hide path button.

### `js/main.js`

**`resizeCanvas()`** — Sets `canvas.width/height` from the world panel's client size; called on load and on window resize.

**Animation loop (`loop(ts)`):**
1. Compute `dtReal = min(frame_delta, 0.1s)` to survive tab backgrounding.
2. `dtSim = dtReal × state.speed`.
3. `processHeldKeys()` — smooth key-held adjustments.
4. `updateBalls(dtSim)` — physics tick; sets `needsBallListUpdate` if any ball landed.
5. `updateTooltip()` — hover detection.
6. **Auto-fire tick** — if active and `performance.now() >= nextFireAt`, fires one shot, advances `currentAngle`, stops sweep if past `toAngle`.
7. `updateBallList()` — called at most **once per frame** via `needsBallListUpdate` flag (prevents DOM thrash when many balls land in rapid succession).
8. `render()`.

**Panel resize (horizontal):** Dragging `#panel-resize` resizes `#menu-panel` between 180 px and 600 px and calls `resizeCanvas()`.

**Ball-list resize (vertical):** Dragging `#ball-list-handle` resizes `#ball-list` height (minimum 60 px).

---

## Layout (`index.html`)

```
body (flex row)
├── #world-panel (flex: 1)          — fills remaining width
│   └── #world-canvas               — sized to panel by resizeCanvas()
├── #panel-resize (5 px)            — horizontal drag handle
└── #menu-panel (default 280 px)    — right sidebar
    ├── .menu-section  Cannon       — angle, height, muzzle speed, Fire button
    ├── .menu-section  Physics      — gravity
    ├── .menu-section  Time         — speed multiplier
    ├── .menu-section  View         — zoom, show-paths checkbox, show-axes checkbox, Clear button
    ├── .menu-section  Auto-fire    — from°, to°, step°, interval, Start/Stop buttons
    ├── #ball-list-handle (5 px)    — vertical drag handle
    ├── #ball-list (default 200 px) — scrollable ball log
    └── #key-hints                  — keyboard shortcut reference bar
```

The `#ball-tooltip` div is positioned `fixed` and shown/hidden by `updateTooltip()`.

---

## Performance Notes

- **Path decimation**: path points are stored only when the ball moves ≥5 world units from the last stored point, reducing path array sizes by ~10× at typical speeds.
- **Ball cap**: hard limit of 500 balls; oldest is dropped on overflow.
- **Ball list cap**: DOM shows the 50 most recent balls regardless of total count.
- **Batched DOM updates**: `updateBallList()` runs at most once per animation frame.
- **Landed ball skip**: `updateBalls` skips landed balls in O(1).
- **Off-screen rendering**: the canvas clips automatically; at default zoom=0.2, full trajectories for `s=150` are visible without panning.

---

## Notes for Future Sessions

### For the user

- **You own the math.** The flight equations (`x(t)`, `y(t)`), the analytic landing solve, the coordinate transforms, and the angle convention are yours to define. Don't let Claude quietly "fix" these — if something looks physically wrong, question it before accepting a change.
- **Zoom vs. range.** With high muzzle speeds, balls can land far off-screen. The default zoom (0.2) was chosen for `s=150`; if you change the default `s`, you may need to adjust the default zoom in `state.js` and the matching `value=` attribute on `#zoom-slider` and `#zoom-input` in `index.html`.
- **Angle convention.** The current convention is **standard math**: 0° = right (+x), increasing counter-clockwise. This is implemented as `displayToPhysicalRad(deg) = deg * Math.PI / 180`. It was changed back and forth during development — if it ever looks wrong again, check `transform.js` first.
- **Opening the file.** Always open by double-clicking `index.html`. ES modules are deliberately not used because they are blocked on `file://` URLs in most browsers.
- **Clearing balls resets the counter.** Ball IDs restart from #1 after every clear, by design.
- **Auto-fire stops automatically** when it reaches `toAngle`. You can also stop it early with `Escape`.

### For Claude

- **Read before editing.** Always read a file with the Read tool before making changes. The Edit tool will fail on mismatched strings, and guessing whitespace causes bugs.
- **Do not touch physics without asking.** `js/physics.js` and `js/transform.js` contain math the user deliberately designed. Raise any proposed change as a question first.
- **No ES modules — ever.** Do not add `import`, `export`, or `type="module"` to any file. All JS must be plain globals loaded via `<script>` tags in the order: `canvas → state → transform → physics → render → controls → main`.
- **Hill shape depends on `w2c`.** The hill's left base must be drawn at `w2c(WORLD_LEFT, 0)`, not a hardcoded canvas pixel. Using a hardcoded value breaks the hill shape under pan — this was a past bug.
- **Landing point must be analytic.** Never record the ball's in-flight `[x, y]` position as the landing point. Always solve the quadratic for `t_land` and compute `landX = s·cos(a)·t_land`. Frame-rate-dependent landing was a past bug.
- **Never push a path point with y < 0.** The path's last segment must end at `[landX, 0]`, pushed only in the landing branch. Pushing the above-ground position first (as the old code did) caused the path to visually dip below the ground line at high zoom.
- **`updateBallList()` is expensive — batch it.** It rebuilds the entire DOM list. It must only be called via the `needsBallListUpdate` flag in `main.js`, at most once per frame. Do not add extra direct calls.
- **Zoom=0.2 is intentional.** It was set specifically because `s=150` sends balls ~2400 world units right, which is off-screen at zoom=1. Don't revert it to 1 without adjusting the default `s`.
- **Angle convention is standard math (0=right, CCW).** `displayToPhysicalRad(deg) = deg * Math.PI / 180`. It was previously `(deg + 180) * Math.PI / 180` and reverted. Don't re-introduce the +180 offset.
- **`clearBalls()` in `physics.js` resets `nextId`.** Use it instead of directly assigning `state.balls = []`, or ball IDs won't reset.
