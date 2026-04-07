// ─── Ambient frequency bar visualizer (DOM canvas overlay) ────────────────────
// 16 bars in the bottom-right corner, visible after scene starts.
// Feed raw frequency bin data each frame via updateVisualizer().

const BAR_COUNT  = 16;
const BAR_W      = 3;
const BAR_GAP    = 2;
const BAR_MAX_H  = 48;
const PADDING    = 18;

let _canvas  = null;
let _ctx     = null;
let _heights = new Float32Array(BAR_COUNT);  // smoothed bar heights

export function buildVisualizer() {
  _canvas        = document.createElement('canvas');
  _canvas.width  = BAR_COUNT * (BAR_W + BAR_GAP) - BAR_GAP + PADDING * 2;
  _canvas.height = BAR_MAX_H + PADDING * 2;

  Object.assign(_canvas.style, {
    position:       'fixed',
    bottom:         '24px',
    right:          '24px',
    zIndex:         '300',
    opacity:        '0',
    transition:     'opacity 1s ease',
    pointerEvents:  'none',
    imageRendering: 'pixelated',
  });

  document.body.appendChild(_canvas);
  _ctx = _canvas.getContext('2d');

  // Fade in after a short delay
  requestAnimationFrame(() => { _canvas.style.opacity = '1'; });
}

// dataArray: Uint8Array from analyser.getByteFrequencyData()
// sBass/sMid/sHigh: smoothed bands for tinting
export function updateVisualizer(dataArray, sBass, sMid, sHigh) {
  if (!_ctx || !dataArray) return;

  const n       = dataArray.length;
  const step    = Math.floor(n * 0.55 / BAR_COUNT);  // use lower 55% of spectrum
  const W       = _canvas.width;
  const H       = _canvas.height;

  _ctx.clearRect(0, 0, W, H);

  for (let i = 0; i < BAR_COUNT; i++) {
    // Average a small bin slice per bar
    let sum = 0;
    for (let j = 0; j < step; j++) sum += dataArray[i * step + j];
    const raw    = (sum / step) / 255;
    _heights[i] += (raw - _heights[i]) * 0.20;  // smooth

    const barH  = Math.max(1, _heights[i] * BAR_MAX_H);
    const x     = PADDING + i * (BAR_W + BAR_GAP);
    const y     = PADDING + BAR_MAX_H - barH;

    // Hue shifts from bass (warm) → high (cool) across the bar index
    const t   = i / (BAR_COUNT - 1);
    const r   = Math.round(lerp(180, 80,  t) + sBass * 75);
    const g   = Math.round(lerp(80,  180, t) + sMid  * 60);
    const b   = Math.round(lerp(80,  255, t) + sHigh * 40);
    const a   = 0.55 + _heights[i] * 0.45;

    _ctx.fillStyle = `rgba(${clamp(r)},${clamp(g)},${clamp(b)},${a.toFixed(2)})`;
    _ctx.fillRect(x, y, BAR_W, barH);
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v)       { return Math.min(255, Math.max(0, Math.round(v))); }
