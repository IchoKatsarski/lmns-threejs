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
}
