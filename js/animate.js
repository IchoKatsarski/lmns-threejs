// ─── Main animation loop ──────────────────────────────────────────────────────
import * as THREE from 'three';
import { lerp }   from './utils.js';
import {
  readAudio, updateSmoothedBands, updateFluxEnvelope,
  sBass, sMid, sHigh, sBassS, sMidS, sHighS,
  spectralFlux, fluxEnv,
} from './audio.js';
import { scene, camera, composer } from './scene.js';
import { buildLights, updateLights } from './lights.js';
import { updateShaderUniforms }      from './material.js';
import { buildOBJ, objModel, baseScale, updateLogo } from './logo.js';
import { buildPlanets, updatePlanets } from './planets.js';
import {
  buildStarField,
  buildShockwavePool, spawnShockwave, updateRings,
  buildCometPool,     spawnComet,     updateComets,
} from './effects.js';
import {
  initRenderer, initScene, initCamera, initComposer, onResize, renderer,
} from './scene.js';
import { FluidEffect } from './fluid.js';

// ── Animation state ───────────────────────────────────────────────────────────
let modeTarget   = 0;
let modeFloat    = 0.0;
let drumCooldown = 0.0;
let lastSwitch   = -99;

let orbitAngle  = 0;
let orbitSpeed  = 0.06;
let orbitDir    = 1;
let beatCount   = 0;
let groove      = 0;
let musicalTime = 0;
let orbitPulse  = 0;

let zoomShock   = 0;
let zoomCurrent = 340;
let zoomBase    = 340;   // scroll-controlled orbit radius
let scrollVel   = 0;     // scroll momentum

const ZOOM_MIN  = 100;   // closest — won't clip the object
const ZOOM_MAX  = 650;   // furthest — still clearly visible

let shakeAmt = 0;

let mouseX = 0, mouseY = 0;
let tiltX  = 0, tiltY  = 0;

// Fluid effect — tracks mouse in UV space for delta calculation
let fluidEffect  = null;
let prevMouseU   = 0.5;
let prevMouseV   = 0.5;
let mouseU       = 0.5;
let mouseV       = 0.5;
let mouseMoving  = false;

const clock = new THREE.Clock();

// ── Public setup ──────────────────────────────────────────────────────────────
export function setupScene() {
  initRenderer();
  initScene();
  initCamera();
  buildLights();
  buildOBJ();
  buildPlanets();
  buildStarField();
  buildShockwavePool();
  buildCometPool();
  initComposer();

  // Fluid effect — must be created after renderer + composer exist
  fluidEffect = new FluidEffect(renderer, { simRes: 256, pressureIter: 20 });
  composer.addPass(fluidEffect.pass);

  window.addEventListener('resize', onResize);
  window.addEventListener('wheel', (e) => {
    scrollVel += e.deltaY * 0.28;
  }, { passive: true });

  window.addEventListener('mousemove', (e) => {
    mouseX   = (e.clientX / window.innerWidth)  * 2 - 1;
    mouseY   = (e.clientY / window.innerHeight) * 2 - 1;
    mouseU   = e.clientX / window.innerWidth;
    mouseV   = 1.0 - e.clientY / window.innerHeight;  // flip Y for UV space
    mouseMoving = true;
  });
}

// ── Loop ──────────────────────────────────────────────────────────────────────
export function animate() {
  requestAnimationFrame(animate);
  const t  = clock.getElapsedTime();
  const dt = 0.016; // fixed step — keeps physics deterministic at ~60 fps

  readAudio();

  // ── Beat / onset detection ──────────────────────────────────────────────────
  updateFluxEnvelope();
  drumCooldown = Math.max(0, drumCooldown - dt);

  // Occasional random comet, independent of beats
  if (Math.random() < 0.002) spawnComet();

  const isBeat = spectralFlux > fluxEnv * 2.0 + 0.008
              && spectralFlux > 0.005
              && drumCooldown <= 0;
  const silentTooLong = (t - lastSwitch) > 12.0;

  if (isBeat || silentTooLong) {
    modeFloat    = Math.round(modeFloat);
    modeTarget   = modeFloat + 1;
    drumCooldown = 1.0;
    lastSwitch   = t;
    beatCount++;
    if (beatCount % 32 === 0) orbitDir *= -1;

    orbitPulse += 4.0;
    shakeAmt   += spectralFlux * 22;
    spawnShockwave();
    if (Math.random() < 0.55) spawnComet();
  }

  orbitPulse *= 0.90;
  shakeAmt   *= 0.78;

  // Mega-beat check for logo flip (much stricter threshold)
  const isMegaBeat = isBeat && spectralFlux > fluxEnv * 3.0 + 0.018;

  // ── Shader mode crossfade ───────────────────────────────────────────────────
  modeFloat += (modeTarget - modeFloat) * 0.12;

  // ── Smoothed audio bands for shader uniforms ────────────────────────────────
  updateSmoothedBands();

  // Musical time — runs slow in silence, surges on beats
  groove = lerp(groove, sBass * 0.55 + sMid * 0.30 + sHigh * 0.15, 0.04);
  musicalTime += (0.06 + groove * 0.85 + orbitPulse * 0.12) * dt;

  updateShaderUniforms(sBassS, sMidS, sHighS, musicalTime, modeFloat);

  // ── Camera orbit ───────────────────────────────────────────────────────────
  const targetSpeed = orbitDir * (0.008 + groove * 0.48);
  orbitSpeed = lerp(orbitSpeed, targetSpeed, 0.022);
  orbitAngle += orbitSpeed * dt;

  // Scroll momentum — velocity decays each frame, giving a natural glide
  scrollVel *= 0.88;
  zoomBase   = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomBase + scrollVel));

  if (isBeat) zoomShock += 55;
  zoomShock  *= 0.94;
  zoomCurrent = lerp(zoomCurrent, zoomBase + zoomShock, 0.07);

  const TILT   = Math.PI * 0.18;
  const cx     =  Math.sin(orbitAngle) * zoomCurrent;
  const cz     =  Math.cos(orbitAngle) * Math.cos(TILT) * zoomCurrent;
  const yOrbit =  Math.cos(orbitAngle) * Math.sin(TILT) * zoomCurrent;
  const yBob   =  Math.sin(orbitAngle * 1.6) * 10;

  tiltX = lerp(tiltX, mouseX, 0.025);
  tiltY = lerp(tiltY, mouseY, 0.025);

  camera.position.set(
    cx + (Math.random() - 0.5) * shakeAmt,
    yOrbit + yBob + (Math.random() - 0.5) * shakeAmt,
    cz
  );
  camera.lookAt(tiltX * 12, -tiltY * 8, 0);

  // ── Logo ───────────────────────────────────────────────────────────────────
  if (objModel) objModel.scale.setScalar(baseScale);
  updateLogo(dt, isMegaBeat);

  // ── Planets ────────────────────────────────────────────────────────────────
  const orbitMult = 0.04 + groove * 1.3 + orbitPulse;
  updatePlanets(orbitMult);

  // ── Lights ─────────────────────────────────────────────────────────────────
  updateLights(t, sBass, sMid, sHigh);

  // ── Effects ────────────────────────────────────────────────────────────────
  updateRings();
  updateComets();

  // ── Fluid ──────────────────────────────────────────────────────────────────
  if (fluidEffect) {
    if (mouseMoving) {
      const du = mouseU - prevMouseU;
      const dv = mouseV - prevMouseV;
      // Only splat if there's meaningful movement to avoid noise
      if (Math.abs(du) + Math.abs(dv) > 0.0001) {
        fluidEffect.splat(mouseU, mouseV, du, dv);
      }
      prevMouseU  = mouseU;
      prevMouseV  = mouseV;
      mouseMoving = false;
    }
    fluidEffect.step();
  }

  composer.render();
}
