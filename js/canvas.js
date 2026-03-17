// Shared canvas + context. Populated once by initCanvas().
let canvas = null;
let ctx    = null;

function initCanvas(el) {
  canvas = el;
  ctx    = el.getContext('2d');
}
