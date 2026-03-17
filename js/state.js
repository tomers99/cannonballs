// Single source of truth for all mutable simulation state.
const state = {
  angle:     45,    // display angle (standard: 0=right/+x, CCW)
  height:    150,
  gravity:   -9.8,
  s:         150,
  speed:     1,
  zoom:      0.2,
  showPaths: false,
  balls:     [],
  globalT:   0,
  panX:      0,
  showAxes:  true,
  fancyGlow: true,
  autoFire: {
    active:       false,
    fromAngle:    30,
    toAngle:      75,
    step:         5,
    interval:     1,      // real seconds between shots
    currentAngle: 30,
    nextFireAt:   0,      // performance.now() ms timestamp
  },
};
