// World ↔ Canvas coordinate transform.
// World: x right, y up. Canvas: x right, y down.
// WORLD_LEFT is the fixed world-x shown at canvas x=0.
// Both axes use the same scale so zoom preserves shape.

const GROUND_H   = 50;
const WORLD_LEFT = -200;

function getScale()  { return (canvas.height - GROUND_H) / 400 * state.zoom; }
function groundCY()  { return canvas.height - GROUND_H; }
// Convert a display angle (standard: 0 = right/+x, CCW) to physical radians.
function displayToPhysicalRad(deg) {
  return deg * Math.PI / 180;
}

function w2c(wx, wy) {
  const s = getScale();
  return [(wx - WORLD_LEFT - state.panX) * s,  groundCY() - wy * s];
}
