// ─── Underwater scene — sunrays, fish, jellyfish, bubbles, caustic floor ──────
import * as THREE from 'three';
import { scene, camera } from './scene.js';

export const WATER_BG = new THREE.Color(0x001a2e);

// ── Sun surface origin (simulates hole in water surface above the scene) ───────
const SUN_POS = new THREE.Vector3(80, 290, -90);

// ── Sunrays — volumetric shafts diverging downward from SUN_POS ───────────────
const _rays = [];

function buildRayPlane(spreadAngleX, spreadAngleZ, width, length, phase) {
  // Geometry hangs downward: top edge at y=0, bottom at y=-length
  const segs = 8;
  const geo  = new THREE.PlaneGeometry(width, length, 1, segs);
  geo.translate(0, -length / 2, 0);           // pivot top edge at local origin

  // Vertex color: bright at top (y≈0), fully transparent at bottom (y≈-length)
  const posArr = geo.attributes.position.array;
  const colArr = new Float32Array(posArr.length);
  for (let v = 0; v < posArr.length / 3; v++) {
    const t = 1.0 + posArr[v * 3 + 1] / length; // 1 at top, 0 at bottom
    const e = t * t * t;                          // cubic — fast falloff
    colArr[v*3]   = 0.62 * e;
    colArr[v*3+1] = 0.91 * e;
    colArr[v*3+2] = 1.00 * e;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));

  const mat  = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent:  true,
    opacity:      0,
    side:         THREE.DoubleSide,
    blending:     THREE.AdditiveBlending,
    depthWrite:   false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  // Position top of each ray at the sun origin; angle it into the deep
  mesh.position.copy(SUN_POS);
  mesh.rotation.x =  0.45 + spreadAngleX;   // lean forward/back (mostly downward)
  mesh.rotation.z =        spreadAngleZ;     // fan left/right
  mesh.rotation.y = Math.random() * 0.4;    // slight twist per ray
  mesh.visible    = false;
  scene.add(mesh);
  _rays.push({ mesh, mat, phase });
}

function buildSunrays() {
  const BEAMS = 7;
  for (let i = 0; i < BEAMS; i++) {
    const t   = i / BEAMS;
    const ang = t * Math.PI * 2;
    const spreadR = 0.08 + Math.random() * 0.22;  // cone spread radius

    // 3 overlapping layers per beam — gives volumetric depth
    for (let layer = 0; layer < 3; layer++) {
      const w      = 5 + Math.random() * 18;
      const length = 380 + Math.random() * 120;
      const sX     = Math.cos(ang) * spreadR + (Math.random() - 0.5) * 0.04;
      const sZ     = Math.sin(ang) * spreadR + (Math.random() - 0.5) * 0.04;
      buildRayPlane(sX, sZ, w, length, Math.random() * Math.PI * 2);
    }
  }
}

// ── Fish trail — ring-buffer bubble points ────────────────────────────────────
const FISH_TRAIL_LEN = 55;

function buildTrailPoints(maxLen, color) {
  const posArr = new Float32Array(maxLen * 3);
  const colArr = new Float32Array(maxLen * 3);  // brightness = fade
  const geo    = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colArr, 3));
  geo.setDrawRange(0, 0);

  const mat  = new THREE.PointsMaterial({
    vertexColors:    true,
    size:            2.0,
    sizeAttenuation: true,
    transparent:     true,
    opacity:         0,
    depthWrite:      false,
    blending:        THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.visible = false;
  scene.add(pts);
  return { pts, geo, mat, posArr, colArr, trail: [], color };
}

// ── Fish ───────────────────────────────────────────────────────────────────────
const _fish = [];
const FISH_COLORS = [
  0xff6040, 0xffcc00, 0x00bbff, 0xff8800,
  0x88ff44, 0xff4488, 0x44ffcc, 0xffaa66,
  0xff3366, 0x66eeee,
];

function makeFishMesh(color, size) {
  const group = new THREE.Group();
  const mat   = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1 });

  // Body
  const bodyGeo = new THREE.SphereGeometry(size, 8, 6);
  bodyGeo.scale(1.8, 0.65, 0.65);
  group.add(new THREE.Mesh(bodyGeo, mat));

  // Tail
  const tailGeo = new THREE.ConeGeometry(size * 0.60, size * 1.1, 4);
  tailGeo.rotateZ(Math.PI / 2);
  const tail = new THREE.Mesh(tailGeo, mat);
  tail.position.set(-size * 1.7, 0, 0);
  group.add(tail);

  // Dorsal fin
  const finPts = new Float32Array([
    0,          0,          0,
    size * 0.8, size * 0.85, 0,
   -size * 0.4, size * 0.75, 0,
  ]);
  const finGeo = new THREE.BufferGeometry();
  finGeo.setAttribute('position', new THREE.BufferAttribute(finPts, 3));
  finGeo.setIndex([0, 1, 2]);
  finGeo.computeVertexNormals();
  group.add(new THREE.Mesh(finGeo, new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide })));

  // Eye
  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(size * 0.17, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1 })
  );
  eye.position.set(size * 1.25, size * 0.12, size * 0.42);
  group.add(eye);

  return group;
}

function buildFish() {
  for (let i = 0; i < 10; i++) {
    const size   = 1.8 + Math.random() * 2.8;    // smaller: was 4–10
    const color  = FISH_COLORS[i % FISH_COLORS.length];
    const mesh   = makeFishMesh(color, size);
    const radius = 90 + Math.random() * 120;
    const speed  = (0.22 + Math.random() * 0.32) * (Math.random() < 0.5 ? 1 : -1);
    const yBase  = (Math.random() - 0.5) * 110;
    const phase  = Math.random() * Math.PI * 2;
    const wagSpd = 4 + Math.random() * 4;
    const wagAmp = 0.10 + Math.random() * 0.12;
    const trailObj = buildTrailPoints(FISH_TRAIL_LEN, new THREE.Color(color));

    mesh.visible = false;
    scene.add(mesh);
    _fish.push({ mesh, radius, speed, yBase, phase, wagSpd, wagAmp, trailObj });
  }
}

// ── Jellyfish ──────────────────────────────────────────────────────────────────
const _jellies = [];
const JELLY_COLORS = [0x88aaff, 0xff88cc, 0x88ffee, 0xff99ff, 0x66ffbb];
const JELLY_TRAIL_LEN = 40;

function makeJellyMesh(color, size) {
  const group = new THREE.Group();

  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const u = i / 14;
    const r = Math.sin(u * Math.PI) * size * (0.9 + 0.1 * Math.cos(u * Math.PI));
    const y = (1 - u) * size * 1.05;
    pts.push(new THREE.Vector2(r, y));
  }
  const bellGeo = new THREE.LatheGeometry(pts, 22);
  const bellMat = new THREE.MeshPhysicalMaterial({
    color,
    emissive:          color,
    emissiveIntensity: 0.70,
    transparent:       true,
    opacity:           0.50,
    roughness:         0.05,
    metalness:         0.0,
    side:              THREE.DoubleSide,
    depthWrite:        false,
  });
  group.add(new THREE.Mesh(bellGeo, bellMat));

  for (let i = 0; i < 14; i++) {
    const a   = (i / 14) * Math.PI * 2;
    const r   = size * 0.62;
    const seg = [];
    for (let j = 0; j <= 10; j++) {
      const tv = j / 10;
      seg.push(new THREE.Vector3(
        Math.cos(a) * r * (1 - tv * 0.55),
        -tv * size * (1.4 + Math.random() * 0.6),
        Math.sin(a) * r * (1 - tv * 0.55)
      ));
    }
    const tGeo = new THREE.BufferGeometry().setFromPoints(seg);
    group.add(new THREE.Line(tGeo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.42 })));
  }

  const glowGeo = new THREE.SphereGeometry(size * 0.40, 10, 10);
  const glowMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false });
  const glowMesh = new THREE.Mesh(glowGeo, glowMat);
  glowMesh.position.y = size * 0.25;
  group.add(glowMesh);

  return { group, bellMat };
}

function buildJellies() {
  for (let i = 0; i < 5; i++) {
    const size  = 5 + Math.random() * 7;     // smaller: was 9–22
    const color = new THREE.Color(JELLY_COLORS[i % JELLY_COLORS.length]);
    const { group, bellMat } = makeJellyMesh(color, size);
    const radius     = 65 + Math.random() * 130;
    const phase      = Math.random() * Math.PI * 2;
    const driftSpeed = 0.035 + Math.random() * 0.065;
    const yBase      = -20 + (Math.random() - 0.5) * 90;
    const pulseSpeed = 0.9 + Math.random() * 1.0;
    const trailObj   = buildTrailPoints(JELLY_TRAIL_LEN, color);

    group.visible = false;
    scene.add(group);
    _jellies.push({ group, bellMat, radius, phase, driftSpeed, yBase, pulseSpeed, trailObj, color });
  }
}

// ── Ambient bubbles (background) ──────────────────────────────────────────────
const BUBBLE_COUNT = 70;
let _ambBubbleGeo  = null;
let _ambBubbleMesh = null;
const _ambPos    = new Float32Array(BUBBLE_COUNT * 3);
const _ambSpeeds = new Float32Array(BUBBLE_COUNT);
const _ambPhases = new Float32Array(BUBBLE_COUNT);

function buildBubbles() {
  for (let i = 0; i < BUBBLE_COUNT; i++) {
    _ambPos[i*3]   = (Math.random() - 0.5) * 360;
    _ambPos[i*3+1] = (Math.random() - 0.5) * 260;
    _ambPos[i*3+2] = (Math.random() - 0.5) * 260;
    _ambSpeeds[i]  = 5 + Math.random() * 9;
    _ambPhases[i]  = Math.random() * Math.PI * 2;
  }
  _ambBubbleGeo = new THREE.BufferGeometry();
  _ambBubbleGeo.setAttribute('position', new THREE.BufferAttribute(_ambPos, 3));
  _ambBubbleMesh = new THREE.Points(_ambBubbleGeo, new THREE.PointsMaterial({
    color: 0xaaddff, size: 2.2, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true,
  }));
  _ambBubbleMesh.visible = false;
  scene.add(_ambBubbleMesh);
}

// ── Caustic floor ─────────────────────────────────────────────────────────────
let _floor    = null;
let _floorMat = null;
let _causticTex = null;

function makeCausticTex() {
  const S  = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#001525';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    const r = 6 + Math.random() * 38;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0,    'rgba(70,185,255,0)');
    g.addColorStop(0.50, 'rgba(85,200,255,0.09)');
    g.addColorStop(0.80, 'rgba(120,225,255,0.20)');
    g.addColorStop(1.0,  'rgba(70,185,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }
  return new THREE.CanvasTexture(cv);
}

function buildFloor() {
  _causticTex = makeCausticTex();
  _causticTex.wrapS = _causticTex.wrapT = THREE.RepeatWrapping;
  _causticTex.repeat.set(3, 3);
  const geo = new THREE.PlaneGeometry(1200, 1200);
  geo.rotateX(-Math.PI / 2);
  _floorMat = new THREE.MeshStandardMaterial({
    color: 0x002030, roughness: 0.95, transparent: true, opacity: 0, map: _causticTex,
  });
  _floor = new THREE.Mesh(geo, _floorMat);
  _floor.position.y  = -140;
  _floor.receiveShadow = true;
  _floor.visible       = false;
  scene.add(_floor);
}

// ── Trail helpers ─────────────────────────────────────────────────────────────
// Pushes current creature position onto its trail ring-buffer,
// then writes fading vertex colors (bright head → dark tail) into the Points geo.
function updateTrail(trailObj, px, py, pz, blend, maxLen) {
  const { trail, pts, geo, posArr, colArr, mat, color } = trailObj;
  pts.visible  = blend > 0.01;
  mat.opacity  = blend * 0.70;

  // Emit a new bubble slightly offset from exact center — more organic feel
  trail.push(new THREE.Vector3(
    px + (Math.random() - 0.5) * 1.8,
    py + (Math.random() - 0.5) * 1.8,
    pz + (Math.random() - 0.5) * 1.8
  ));
  if (trail.length > maxLen) trail.shift();

  const len = trail.length;
  for (let i = 0; i < len; i++) {
    const v    = trail[len - 1 - i];          // index 0 = most recent (head)
    const fade = Math.pow(1 - i / maxLen, 1.8);
    posArr[i*3]   = v.x;
    posArr[i*3+1] = v.y;
    posArr[i*3+2] = v.z;
    // Encode fade in vertex color brightness; additive blending makes it glow
    colArr[i*3]   = color.r * fade;
    colArr[i*3+1] = color.g * fade;
    colArr[i*3+2] = color.b * fade;
  }
  geo.setDrawRange(0, len);
  geo.attributes.position.needsUpdate = true;
  geo.attributes.color.needsUpdate    = true;
}

// ── Underwater ripple waves ───────────────────────────────────────────────────
// Horizontal rings that expand outward from the logo center, like a pressure
// wave pushing through water — flatter than space shockwaves, tinted cyan/teal.
const RIPPLE_POOL = 8;
const _ripples    = [];

export function buildRipplePool() {
  for (let i = 0; i < RIPPLE_POOL; i++) {
    // Thin ring, faces camera (same axis as space shockwaves)
    const geo = new THREE.RingGeometry(1, 1.12, 96);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00eeff, transparent: true, opacity: 0,
      side: THREE.DoubleSide, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    scene.add(mesh);
    _ripples.push({ mesh, active: false, age: 0, dur: 0, flux: 0 });
  }
}

export function spawnRipple(flux = 0) {
  const r = _ripples.find(r => !r.active);
  if (!r) return;
  r.active = true;
  r.age    = 0;
  r.flux   = Math.min(1, flux * 20);
  // Stronger beats → shorter, punchier rings; softer beats → slower expansion
  r.dur  = 0.70 + (1 - r.flux) * 0.45;

  r.mesh.position.set(0, (Math.random() - 0.5) * 30, 0);
  r.mesh.scale.setScalar(1);
  r.mesh.visible = true;
  r.mesh.lookAt(camera.position);  // face camera, same as space shockwaves

  // Tint: gentle cyan for soft beats → bright aqua-white for hard hits
  const hue = 185 - r.flux * 25;   // 185 (cyan) → 160 (teal-green)
  const lit  = 0.55 + r.flux * 0.35;
  r.mesh.material.color.setHSL(hue / 360, 1.0, lit);
  r.mesh.material.opacity = 0.55 + r.flux * 0.30;
}

export function updateRipples(dt, blend) {
  for (const r of _ripples) {
    if (!r.active) continue;
    r.age += dt;
    const prog = r.age / r.dur;
    if (prog >= 1) { r.active = false; r.mesh.visible = false; continue; }

    // Expand quickly at first, ease out — feels like a pressure wave slowing in water
    const ease  = 1 - Math.pow(1 - prog, 2.4);
    // Max radius scales with flux: gentle ripple ~40 units, hard kick ~110 units
    const maxR  = 40 + r.flux * 70;
    r.mesh.scale.setScalar(ease * maxR);

    // Fade out and thin the ring as it expands
    r.mesh.material.opacity = blend * (0.55 + r.flux * 0.30) * Math.pow(1 - prog, 1.6);

  }
}

// ── Public API ─────────────────────────────────────────────────────────────────
export function buildUnderwaterScene() {
  buildSunrays();
  buildFish();
  buildJellies();
  buildBubbles();
  buildFloor();
  buildRipplePool();
}

let _prevT     = -1;
let _trailTick = 0;
// Jellyfish sustained glow — surges on mega-bass, decays slowly
let _jellyGlow = 0;

// fishBlend, jellyBlend, rayBlend are independent 0-1 values driven per-element
export function updateUnderwaterScene(t, fishBlend, jellyBlend, rayBlend, sBass, sHigh, beatPulse) {
  const dt    = _prevT < 0 ? 0.016 : Math.min(t - _prevT, 0.05);
  _prevT      = t;
  const anyVis = fishBlend > 0.01 || jellyBlend > 0.01 || rayBlend > 0.01;
  _trailTick++;

  // Mega-bass detector — sustained bioluminescent surge when bass is heavy
  const megaBass = Math.max(0, (sBass - 0.55) / 0.30);  // 0 below 0.55, ramps to 1 at ~0.85
  if (megaBass > _jellyGlow) _jellyGlow = megaBass;      // instant attack
  _jellyGlow *= Math.pow(0.12, dt);                       // slow decay (~2s)

  // ── Sunrays ──────────────────────────────────────────────────────────────────
  for (const r of _rays) {
    r.mesh.visible = rayBlend > 0.01;
    // Two-frequency shimmer simulates light scattered by moving surface water
    const flicker = 0.30 + 0.70
      * Math.abs(Math.sin(t * 0.55 + r.phase))
      * Math.abs(Math.sin(t * 0.21 + r.phase * 2.1));
    // Bright base + strong bass and beat reactivity
    r.mat.opacity = rayBlend * 0.16 * flicker * (1.0 + sBass * 2.2 + beatPulse * 1.4);
    // Very slow drift — shafts sway with imaginary current
    r.mesh.rotation.z += Math.sin(t * 0.11 + r.phase) * 0.00045;
    r.mesh.rotation.x += Math.cos(t * 0.09 + r.phase) * 0.00025;
  }

  // ── Fish ─────────────────────────────────────────────────────────────────────
  for (const f of _fish) {
    f.mesh.visible = fishBlend > 0.01;
    const angle = t * f.speed + f.phase;
    const x = Math.cos(angle) * f.radius;
    const z = Math.sin(angle) * f.radius;
    const y = f.yBase + Math.sin(t * 0.55 + f.phase) * 18;
    f.mesh.position.set(x, y, z);

    const velX = -Math.sin(angle) * f.speed;
    const velZ =  Math.cos(angle) * f.speed;
    f.mesh.rotation.y = Math.atan2(-velZ, velX);
    f.mesh.rotation.z = Math.sin(t * f.wagSpd + f.phase) * f.wagAmp;
    f.mesh.scale.setScalar(fishBlend * (1 + beatPulse * 0.10));

    if (_trailTick % 2 === 0) {
      updateTrail(f.trailObj, x, y, z, fishBlend, FISH_TRAIL_LEN);
    }
  }

  // ── Jellyfish ─────────────────────────────────────────────────────────────────
  for (const j of _jellies) {
    j.group.visible = jellyBlend > 0.01;
    const angle = t * j.driftSpeed + j.phase;
    const x = Math.cos(angle) * j.radius;
    const z = Math.sin(angle) * j.radius;
    const y = j.yBase + Math.sin(t * 0.18 + j.phase) * 32;
    j.group.position.set(x, y, z);

    const pulse = 0.80 + 0.20 * Math.abs(Math.sin(t * j.pulseSpeed + j.phase));
    j.group.scale.set(jellyBlend, jellyBlend * pulse, jellyBlend);
    j.group.rotation.y += dt * 0.12;

    // Normal glow + mega-bass surge (up to 4× brighter, whole bell lights up)
    j.bellMat.emissiveIntensity = jellyBlend * (0.55 + sBass * 1.4 + beatPulse * 0.60 + _jellyGlow * 4.0);
    j.bellMat.opacity           = jellyBlend * 0.50;

    if (_trailTick % 3 === 0) {
      updateTrail(j.trailObj, x, y, z, jellyBlend, JELLY_TRAIL_LEN);
    }
  }

  // ── Ambient bubbles ───────────────────────────────────────────────────────────
  const ambBlend = Math.max(fishBlend, rayBlend);
  if (_ambBubbleMesh && _ambBubbleGeo) {
    _ambBubbleMesh.visible = ambBlend > 0.01;
    _ambBubbleMesh.material.opacity = ambBlend * 0.44;
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      _ambPos[i*3]   += Math.sin(t * 0.4 + _ambPhases[i]) * 0.06;
      _ambPos[i*3+1] += _ambSpeeds[i] * dt;
      if (_ambPos[i*3+1] > 160) {
        _ambPos[i*3]   = (Math.random() - 0.5) * 360;
        _ambPos[i*3+1] = -140;
        _ambPos[i*3+2] = (Math.random() - 0.5) * 260;
      }
    }
    _ambBubbleGeo.attributes.position.needsUpdate = true;
  }

  // ── Caustic floor ─────────────────────────────────────────────────────────────
  const floorBlend = Math.max(fishBlend, jellyBlend, rayBlend);
  if (_floor) {
    _floor.visible    = floorBlend > 0.01;
    _floorMat.opacity = floorBlend * 0.92;
    if (_causticTex) {
      _causticTex.offset.x = t * 0.016;
      _causticTex.offset.y = t * 0.011;
    }
  }

  // ── Ripple waves ──────────────────────────────────────────────────────────────
  updateRipples(dt, Math.max(fishBlend, rayBlend, jellyBlend));

  // ── Underwater fog ────────────────────────────────────────────────────────────
  if (floorBlend < 0.01) {
    scene.fog = null;
  } else {
    if (!scene.fog) scene.fog = new THREE.FogExp2(0x001a2e, 0);
    scene.fog.density = floorBlend * 0.0019;
  }
}
