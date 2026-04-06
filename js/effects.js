// ─── Visual effects — star field, shockwave rings, comet streaks ──────────────
import * as THREE from 'three';
import { scene, camera } from './scene.js';

// ── Star field ────────────────────────────────────────────────────────────────
export function buildStarField() {
  const layers = [
    { count: 2800, size: 0.9, opacity: 0.60 },
    { count:  700, size: 1.6, opacity: 0.75 },
    { count:  120, size: 2.6, opacity: 0.88 },
  ];

  for (const { count, size, opacity } of layers) {
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
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffffff, size, sizeAttenuation: false,
      transparent: true, opacity, depthWrite: false,
    })));
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

export function spawnShockwave() {
  const ring = rings.find(r => !r.active);
  if (!ring) return;
  ring.active = true;
  ring.age    = 0;
  ring.mesh.visible = true;
  ring.mesh.position.set(0, 0, 0);
  ring.mesh.scale.setScalar(1);
  ring.mesh.material.opacity = 0.7;
  ring.mesh.lookAt(camera.position);
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
