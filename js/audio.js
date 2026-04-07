// ─── Audio capture + analysis ─────────────────────────────────────────────────
import { lerp, sliceAvg } from './utils.js';

let analyser     = null;
let dataArray    = null;
let prevSpectrum = null;

// First-pass smoothed frequency bands (used for lights, camera, orbit)
export let sBass = 0;
export let sMid  = 0;
export let sHigh = 0;

// Extra-smooth values fed into shader uniforms — prevents per-frame pulsing
export let sBassS = 0;
export let sMidS  = 0;
export let sHighS = 0;

// Spectral flux onset detection — fires on any drum transient
export let spectralFlux = 0;
export let fluxEnv      = 0;

// ── Wobble detection ──────────────────────────────────────────────────────────
// Wobbles are rapid bass amplitude modulations (1–8 Hz "wub wub").
// We track sign changes in the bass derivative over a sliding window.
// wobbleIntensity: 0..1, sustained while wobble is detected.
export let wobbleIntensity = 0;

const WOBBLE_BUF_SIZE = 90;   // ~1.5s at 60fps
const _bassBuf        = new Float32Array(WOBBLE_BUF_SIZE);
let   _bassBufIdx     = 0;
let   _prevBass       = 0;

// Bass event logging — fires on rising edge only
const BASS_THRESHOLD = 0.35;   // tune to taste
let   _bassAbove     = false;

// Raw frequency data for the visualizer — null until audio is started
export let freqData = null;

export async function startAudio() {
  const ctx    = new AudioContext();
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { width: 1, height: 1 },
    audio: { echoCancellation: false, noiseSuppression: false, sampleRate: 44100 },
  });
  stream.getVideoTracks().forEach(t => t.stop());
  if (!stream.getAudioTracks().length) return;

  const source = ctx.createMediaStreamSource(stream);
  analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.8;
  source.connect(analyser);
  dataArray = new Uint8Array(analyser.frequencyBinCount);
  freqData  = dataArray;  // shared reference — always current after readAudio()
}

export function readAudio() {
  if (!analyser) return;
  analyser.getByteFrequencyData(dataArray);
  const n = dataArray.length;

  sBass = lerp(sBass, sliceAvg(dataArray, 0,                    Math.floor(n * 0.05)), 0.18);
  sMid  = lerp(sMid,  sliceAvg(dataArray, Math.floor(n * 0.05), Math.floor(n * 0.30)), 0.12);
  sHigh = lerp(sHigh, sliceAvg(dataArray, Math.floor(n * 0.30), Math.floor(n * 0.65)), 0.10);

  // Spectral flux — sum of positive bin increases across the full spectrum.
  // Detects any transient (kick, snare, hi-hat), not just bass.
  if (prevSpectrum) {
    let flux = 0;
    for (let i = 0; i < n; i++) {
      const diff = dataArray[i] - prevSpectrum[i];
      if (diff > 0) flux += diff;
    }
    spectralFlux = flux / (n * 255);
  }
  if (!prevSpectrum) prevSpectrum = new Uint8Array(n);
  prevSpectrum.set(dataArray);
}

// Second smoothing pass — shader uniforms see a very slow-moving signal
// so visual effects breathe rather than flicker per-frame.
export function updateSmoothedBands() {
  sBassS = lerp(sBassS, sBass, 0.03);
  sMidS  = lerp(sMidS,  sMid,  0.03);
  sHighS = lerp(sHighS, sHigh, 0.03);
}

export function updateFluxEnvelope() {
  fluxEnv = lerp(fluxEnv, spectralFlux, 0.1);

  // Bass event — log on rising edge only (crosses threshold from below)
  const bassHot = sBass > BASS_THRESHOLD;
  if (bassHot && !_bassAbove) {
    console.log(`%c[BASS]%c sBass=${sBass.toFixed(3)}  wobble=${wobbleIntensity.toFixed(3)}`,
      'color:#ff3366;font-weight:bold', 'color:inherit');
  }
  _bassAbove = bassHot;
}

export function updateWobble() {
  // Write current bass into ring buffer
  _bassBuf[_bassBufIdx] = sBass;
  _bassBufIdx = (_bassBufIdx + 1) % WOBBLE_BUF_SIZE;

  // Count derivative sign changes across the whole buffer.
  // Each sign change = one peak or trough = half a wobble cycle.
  // At 60fps, WOBBLE_BUF_SIZE=90 frames ≈ 1.5s window.
  // 1 Hz wobble → 2 sign changes/s → ~3 in window
  // 8 Hz wobble → 16 sign changes/s → ~24 in window
  let signChanges = 0;
  let prevDelta   = 0;
  for (let i = 1; i < WOBBLE_BUF_SIZE; i++) {
    const idx  = (_bassBufIdx + i) % WOBBLE_BUF_SIZE;
    const pidx = (_bassBufIdx + i - 1) % WOBBLE_BUF_SIZE;
    const d    = _bassBuf[idx] - _bassBuf[pidx];
    if (prevDelta !== 0 && Math.sign(d) !== Math.sign(prevDelta)) signChanges++;
    if (Math.abs(d) > 0.025) prevDelta = d;  // ignore tiny jitter
  }

  // Normalise: 3–24 sign changes → wobble range, weighted by bass strength
  const wobbleRate = (signChanges - 3) / 21;   // 0 below 1Hz, 1 at 8Hz
  const inRange    = wobbleRate > 0 && wobbleRate < 1.4;
  const bassStrong = sBass > 0.50;
  const target     = inRange && bassStrong ? Math.min(1, wobbleRate) * sBass * 3.5 : 0;

  wobbleIntensity = lerp(wobbleIntensity, target, inRange ? 0.08 : 0.04);
}
