// ─── Main animation loop ──────────────────────────────────────────────────────
import * as THREE from 'three';
import { lerp }   from './utils.js';
import {
  readAudio, updateSmoothedBands, updateFluxEnvelope,
  sBass, sMid, sHigh, sBassS, sMidS, sHighS,
  spectralFlux, fluxEnv, freqData,
} from './audio.js';
import { buildVisualizer, updateVisualizer } from './visualizer.js';
import { scene, camera, composer } from './scene.js';
import { buildLights, updateLights, buildCursorLight, updateCursorLight } from './lights.js';
import { updateShaderUniforms, triggerEmissivePulse, updateEmissivePulse } from './material.js';
import { buildOBJ, objModel, baseScale, updateLogo } from './logo.js';
import { buildPlanets, updatePlanets } from './planets.js';
import {
  buildStarField,     updateStars,
  buildNebula,        updateNebula,
  buildShockwavePool, spawnShockwave,    updateRings,
  buildCometPool,     spawnComet,        updateComets,
  buildMeteorShower,  spawnMeteorShower, updateMeteorShower,
} from './effects.js';
import {
  initRenderer, initScene, initCamera, initComposer, onResize, renderer,
  triggerFlash, updateColorTemperature,
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

let megaBeatCount = 0;   // triggers meteor shower every N mega-beats

let zoomShock   = 0;
let zoomCurrent = 340;
let zoomTarget  = 340;   // where scroll wants to go (spiky raw input lands here)
let zoomBase    = 340;   // smoothed intermediate (lerps toward zoomTarget)
let scrollVel   = 0;     // scroll momentum

const ZOOM_MIN  = 100;   // closest — won't clip the object
const ZOOM_MAX  = 650;   // furthest — still clearly visible

let shakeAmt = 0;

let mouseX = 0, mouseY = 0;
let tiltX  = 0, tiltY  = 0;

// ── Free-cam state ────────────────────────────────────────────────────────────
let freeCam    = false;
let freeTheta  = 0;      // azimuth  (horizontal), synced from orbitAngle on enable
let freePhi    = 0;      // elevation (vertical),  0 = equator
const PHI_MIN  = -Math.PI * 0.42;
const PHI_MAX  =  Math.PI * 0.42;

let dragActive  = false;
let dragLastX   = 0;
let dragLastY   = 0;
let dragVelX    = 0;   // angular velocity (radians/frame) carried after release
let dragVelY    = 0;

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
  buildCursorLight();
  buildOBJ();
  buildPlanets();
  buildStarField();
  buildNebula();
  buildShockwavePool();
  buildCometPool();
  buildMeteorShower();
  initComposer();

  buildVisualizer();

  // Fluid effect — must be created after renderer + composer exist
  fluidEffect = new FluidEffect(renderer, { simRes: 128, pressureIter: 12 });
  composer.addPass(fluidEffect.pass);

  window.addEventListener('resize', onResize);
  window.addEventListener('wheel', (e) => {
    // Accumulate into scrollVel; zoomTarget is updated in the loop
    scrollVel += e.deltaY * 0.22;
  }, { passive: true });

  // ── Free-cam button ─────────────────────────────────────────────────────────
  const freeCamBtn = document.getElementById('free-cam-btn');
  freeCamBtn.style.display = 'block';

  freeCamBtn.addEventListener('click', () => {
    freeCam = !freeCam;
    freeCamBtn.classList.toggle('active', freeCam);
    if (freeCam) {
      // Seed free-cam angles from the current auto-orbit position
      freeTheta = orbitAngle;
      freePhi   = Math.PI * 0.18 * 0.6; // approximate current tilt elevation
    }
  });

  // Drag to rotate in free-cam mode
  window.addEventListener('pointerdown', (e) => {
    if (!freeCam) return;
    dragActive = true;
    dragLastX  = e.clientX;
    dragLastY  = e.clientY;
  });

  window.addEventListener('pointermove', (e) => {
    if (!freeCam || !dragActive) return;
    const dx  = e.clientX - dragLastX;
    const dy  = e.clientY - dragLastY;
    dragLastX = e.clientX;
    dragLastY = e.clientY;
    // Accumulate velocity so release carries momentum
    dragVelX  = dx * 0.006;
    dragVelY  = dy * 0.006;
    freeTheta -= dragVelX;
    freePhi    = Math.min(PHI_MAX, Math.max(PHI_MIN, freePhi - dragVelY));
  });

  window.addEventListener('pointerup',    () => { dragActive = false; });
  window.addEventListener('pointerleave', () => { dragActive = false; });

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
  // getDelta() must come first — getElapsedTime() calls getDelta() internally,
  // which would reset the delta timer and make our dt read as ~0.
  const dt = Math.min(clock.getDelta(), 0.05); // clamped — prevents spiral on tab blur
  const t  = clock.elapsedTime;               // already updated by getDelta() above

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
    drumCooldown = 0.18;
    lastSwitch   = t;
    beatCount++;
    if (beatCount % 64 === 0) orbitDir *= -1;

    orbitPulse += 4.0;
    shakeAmt   += spectralFlux * 22;
    spawnShockwave(spectralFlux);
    if (Math.random() < 0.55) spawnComet();
  }

  orbitPulse *= 0.90;
  shakeAmt   *= 0.78;

  // Mega-beat check for logo flip (much stricter threshold)
  const isMegaBeat = isBeat && spectralFlux > fluxEnv * 3.0 + 0.018;
  if (isMegaBeat) {
    triggerEmissivePulse(spectralFlux * 8);
    megaBeatCount++;
    if (megaBeatCount % 6 === 0) spawnMeteorShower();
  }

  // ── Shader mode crossfade ───────────────────────────────────────────────────
  modeFloat += (modeTarget - modeFloat) * 0.28;

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

  // Stage 1 — momentum: velocity glides to zero with friction
  scrollVel  *= Math.pow(0.80, dt * 60);   // frame-rate independent friction
  zoomTarget  = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomTarget + scrollVel * dt * 60));

  // Stage 2 — zoomBase smoothly chases zoomTarget (eases out choppy wheel events)
  zoomBase    = lerp(zoomBase, zoomTarget, Math.min(1, dt * 9));

  // Stage 3 — zoomCurrent chases zoomBase + beat shock (final camera ease)
  if (isBeat) {
    zoomShock += 55;
    triggerFlash(spectralFlux * 3.5);
  }
  zoomShock  *= Math.pow(0.94, dt * 60);
  zoomCurrent = lerp(zoomCurrent, zoomBase + zoomShock, Math.min(1, dt * 5));

  const shake = (Math.random() - 0.5) * shakeAmt;

  if (freeCam) {
    // Apply drag inertia when not actively dragging
    if (!dragActive) {
      dragVelX *= 0.90;
      dragVelY *= 0.90;
      freeTheta -= dragVelX;
      freePhi    = Math.min(PHI_MAX, Math.max(PHI_MIN, freePhi - dragVelY));
    }

    // Spherical coords — user controls theta + phi via drag
    const yBob = Math.sin(t * 1.6) * 4;  // gentle idle bob
    const cx   =  Math.cos(freePhi) * Math.sin(freeTheta) * zoomCurrent;
    const cy   =  Math.sin(freePhi) * zoomCurrent + yBob;
    const cz   =  Math.cos(freePhi) * Math.cos(freeTheta) * zoomCurrent;
    camera.position.set(cx + shake, cy + shake, cz);
    camera.lookAt(0, 0, 0);
  } else {
    const TILT   = Math.PI * 0.18;
    const cx     =  Math.sin(orbitAngle) * zoomCurrent;
    const cz     =  Math.cos(orbitAngle) * Math.cos(TILT) * zoomCurrent;
    const yOrbit =  Math.cos(orbitAngle) * Math.sin(TILT) * zoomCurrent;
    const yBob   =  Math.sin(orbitAngle * 1.6) * 10;

    tiltX = lerp(tiltX, mouseX, 0.025);
    tiltY = lerp(tiltY, mouseY, 0.025);

    camera.position.set(
      cx + shake,
      yOrbit + yBob + shake,
      cz
    );
    camera.lookAt(tiltX * 12, -tiltY * 8, 0);
  }

  // ── Logo ───────────────────────────────────────────────────────────────────
  if (objModel) objModel.scale.setScalar(baseScale);
  updateLogo(dt, isMegaBeat);

  // ── Planets ────────────────────────────────────────────────────────────────
  const orbitMult = 0.04 + groove * 1.3 + orbitPulse;
  updatePlanets(orbitMult, sBass, sMid, sHigh);

  // ── Lights ─────────────────────────────────────────────────────────────────
  updateLights(t, sBass, sMid, sHigh);
  updateCursorLight(mouseX, mouseY, camera, zoomCurrent * 0.55);

  // ── Effects ────────────────────────────────────────────────────────────────
  updateRings();
  updateComets(dt);
  updateMeteorShower(dt);
  updateStars(sHigh);
  updateNebula(t, sBass);
  updateVisualizer(freqData);

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

  updateColorTemperature();
  updateEmissivePulse();
  composer.render();
}
