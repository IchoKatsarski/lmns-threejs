// ─── Visual effects — star field, nebula, shockwave rings, comet streaks ───────
import * as THREE from 'three';
import { lerp }   from './utils.js';
import { scene, camera } from './scene.js';

// ── Star field ────────────────────────────────────────────────────────────────
const _starMaterials = [];  // kept for pulse animation

export function buildStarField() {
  const layers = [
    { count: 2800, size: 0.9, baseSize: 0.9, opacity: 0.60 },
    { count:  700, size: 1.6, baseSize: 1.6, opacity: 0.75 },
    { count:  120, size: 2.6, baseSize: 2.6, opacity: 0.88 },
  ];

  for (const layer of layers) {
    const { count, size, opacity } = layer;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 1400 + Math.random() * 500;
      pos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i*3+2] = r * Math.cos(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff, size, sizeAttenuation: false,
      transparent: true, opacity, depthWrite: false,
    });
    _starMaterials.push({ mat, baseSize: layer.baseSize });
    scene.add(new THREE.Points(geo, mat));
  }
}

// Call each frame — sHigh drives a short pulse on the star sizes
export function updateStars(sHigh) {
  const pulse = 1 + sHigh * 1.8;
  for (const { mat, baseSize } of _starMaterials) {
    mat.size = lerp(mat.size, baseSize * pulse, 0.12);
  }
}

// ── Nebula billboards ─────────────────────────────────────────────────────────
const _nebulae = [];

function buildNebulaTexture(hue) {
  const S  = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const cx  = S / 2, cy = S / 2;

  // Layered radial gradients for a soft cloud look
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 0.5);
  g.addColorStop(0.00, `hsla(${hue},70%,55%,0.22)`);
  g.addColorStop(0.35, `hsla(${hue + 20},60%,40%,0.12)`);
  g.addColorStop(0.70, `hsla(${hue - 15},50%,30%,0.05)`);
  g.addColorStop(1.00, `hsla(${hue},40%,20%,0.00)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  // A few offset wisps
  for (let i = 0; i < 4; i++) {
    const ox = (Math.random() - 0.5) * S * 0.55;
    const oy = (Math.random() - 0.5) * S * 0.55;
    const r  = S * (0.18 + Math.random() * 0.22);
    const g2 = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, r);
    g2.addColorStop(0, `hsla(${hue + 30},65%,60%,0.10)`);
    g2.addColorStop(1, `hsla(${hue},40%,20%,0.00)`);
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, S, S);
  }

  return new THREE.CanvasTexture(cv);
}

export function buildNebula() {
  const configs = [
    { hue: 270, pos: new THREE.Vector3( 350,  120, -600), scale: 680 },
    { hue: 220, pos: new THREE.Vector3(-420,  -80, -550), scale: 560 },
    { hue: 300, pos: new THREE.Vector3(  80,  280, -700), scale: 500 },
    { hue: 200, pos: new THREE.Vector3(-200, -200, -480), scale: 440 },
  ];

  for (const { hue, pos, scale } of configs) {
    const tex = buildNebulaTexture(hue);
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: 0.0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(pos);
    sprite.scale.setScalar(scale);
    scene.add(sprite);
    _nebulae.push({ sprite, mat, baseOpacity: 0.55 + Math.random() * 0.25, drift: Math.random() * Math.PI * 2 });
  }
}

// Call each frame — sBass pulses opacity, slow drift keeps them alive
export function updateNebula(t, sBass) {
  for (const n of _nebulae) {
    const pulse      = 1 + sBass * 0.55;
    const driftScale = 1 + Math.sin(t * 0.08 + n.drift) * 0.06;
    n.mat.opacity    = lerp(n.mat.opacity, n.baseOpacity * pulse * driftScale * 0.01, 0.03);
    // Drift nebula slightly for parallax feel
    n.sprite.position.y += Math.sin(t * 0.05 + n.drift) * 0.04;
  }
}

// ── Shockwave rings ───────────────────────────────────────────────────────────
const rings = [];

export function buildShockwavePool() {
  for (let i = 0; i < 6; i++) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(1, 1.22, 72),
      new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false,
      })
    );
    mesh.visible = false;
    scene.add(mesh);
    rings.push({ mesh, active: false, age: 0 });
  }
}

// flux: spectralFlux value [0..1+] used to tint the ring warm/cool
export function spawnShockwave(flux = 0) {
  const ring = rings.find(r => !r.active);
  if (!ring) return;
  ring.active = true;
  ring.age    = 0;
  ring.mesh.visible = true;
  ring.mesh.position.set(0, 0, 0);
  ring.mesh.scale.setScalar(1);
  ring.mesh.material.opacity = 0.7;
  ring.mesh.lookAt(camera.position);

  // Soft blue for gentle beats → warm orange/white for strong ones
  const t   = Math.min(1, flux * 18);   // normalise flux to 0..1 range
  const hue = lerp(210, 28, t);         // blue(210) → orange(28)
  const sat = lerp(0.6, 1.0, t);
  const lit = lerp(0.6, 0.9, t);
  ring.mesh.material.color.setHSL(hue / 360, sat, lit);
}

export function updateRings() {
  rings.forEach(r => {
    if (!r.active) return;
    r.age += 0.016;
    const prog = r.age / 0.55;
    if (prog >= 1) { r.active = false; r.mesh.visible = false; return; }
    r.mesh.scale.setScalar(6 + prog * 90);
    r.mesh.material.opacity = 0.5 * Math.pow(1 - prog, 1.8);
  });
}

// ── Comet streaks ─────────────────────────────────────────────────────────────
const comets = [];

export function buildCometPool() {
  for (let i = 0; i < 8; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0xddeeff, transparent: true, opacity: 0, depthWrite: false,
    }));
    line.frustumCulled = false;
    line.visible = false;
    scene.add(line);
    comets.push({
      line, active: false, age: 0, duration: 0,
      head: new THREE.Vector3(), dir: new THREE.Vector3(),
      speed: 0, trailLen: 0,
    });
  }
}

export function spawnComet() {
  const c = comets.find(c => !c.active);
  if (!c) return;

  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2 * Math.random() - 1);
  const r     = 1500;
  c.head.set(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi)
  );

  // Tangent direction — perpendicular to the radial vector
  const radial = c.head.clone().normalize();
  const perp   = new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5);
  perp.addScaledVector(radial, -perp.dot(radial)).normalize();
  c.dir.copy(perp);

  c.active   = true;
  c.age      = 0;
  c.duration = 0.35 + Math.random() * 0.25;
  c.speed    = 2200 + Math.random() * 1800;
  c.trailLen = 100  + Math.random() * 220;
  c.line.visible = true;
}

export function updateComets() {
  comets.forEach(c => {
    if (!c.active) return;
    c.age += 0.016;
    const prog = c.age / c.duration;
    if (prog >= 1) { c.active = false; c.line.visible = false; return; }

    c.head.addScaledVector(c.dir, c.speed * 0.016);
    const tail = c.head.clone().addScaledVector(c.dir, -c.trailLen);
    const pa   = c.line.geometry.attributes.position.array;
    pa[0] = tail.x; pa[1] = tail.y; pa[2] = tail.z;
    pa[3] = c.head.x; pa[4] = c.head.y; pa[5] = c.head.z;
    c.line.geometry.attributes.position.needsUpdate = true;

    const op = prog < 0.15 ? prog / 0.15 : 1 - (prog - 0.15) / 0.85;
    c.line.material.opacity = Math.max(0, op) * 0.85;
  });
}
