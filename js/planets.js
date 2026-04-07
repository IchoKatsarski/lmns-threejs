// ─── Planets — procedural textures, orbital mechanics, fading trails ─────────
import * as THREE from 'three';
import { scene }  from './scene.js';

const PLANET_COUNT = 20;

export const planets = [];

// ── Procedural planet textures (6 types) ─────────────────────────────────────
function buildPlanetTexture(seed) {
  const S  = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const cx = cv.getContext('2d');

  let s = seed * 127.1 + 311.7;
  const rng = () => { s = Math.sin(s) * 43758.5453; return s - Math.floor(s); };
  const type = seed % 6;

  if (type === 0) {
    // Rocky grey — craters
    cx.fillStyle = `hsl(25,8%,42%)`; cx.fillRect(0,0,S,S);
    for (let i = 0; i < 45; i++) {
      const x=rng()*S, y=rng()*S, r=4+rng()*22;
      cx.beginPath(); cx.arc(x,y,r,0,Math.PI*2);
      cx.fillStyle=`hsl(25,6%,${28+rng()*18}%)`; cx.fill();
      cx.strokeStyle=`hsl(25,5%,22%)`; cx.lineWidth=1.2; cx.stroke();
    }
    for (let i=0;i<300;i++){
      cx.fillStyle=`rgba(0,0,0,${rng()*0.12})`; cx.fillRect(rng()*S,rng()*S,2,2);
    }

  } else if (type === 1) {
    // Ice — blue-white with crack veins
    const g=cx.createRadialGradient(S*0.38,S*0.32,0,S/2,S/2,S*0.65);
    g.addColorStop(0,'#d8f0ff'); g.addColorStop(1,'#4480bb');
    cx.fillStyle=g; cx.fillRect(0,0,S,S);
    cx.strokeStyle='rgba(190,225,255,0.55)'; cx.lineWidth=1;
    for (let i=0;i<35;i++){
      const x1=rng()*S,y1=rng()*S;
      cx.beginPath(); cx.moveTo(x1,y1);
      cx.lineTo(x1+(rng()-.5)*90,y1+(rng()-.5)*90); cx.stroke();
    }

  } else if (type === 2) {
    // Gas giant — horizontal colour bands
    const hue = 18 + (seed * 41) % 200;
    for (let y=0;y<S;y++){
      const b=Math.sin(y/S*Math.PI*10+seed)*0.5+0.5;
      cx.fillStyle=`hsl(${hue+b*30},${48+b*22}%,${38+b*28}%)`; cx.fillRect(0,y,S,1);
    }
    cx.globalAlpha=0.28;
    for (let i=0;i<6;i++){
      cx.beginPath();
      cx.ellipse(rng()*S,rng()*S,28+rng()*44,7+rng()*14,rng()*Math.PI,0,Math.PI*2);
      cx.strokeStyle=`hsl(${hue},65%,72%)`; cx.lineWidth=2; cx.stroke();
    }
    cx.globalAlpha=1;

  } else if (type === 3) {
    // Lava — dark with glowing cracks
    cx.fillStyle='#140300'; cx.fillRect(0,0,S,S);
    for (let i=0;i<30;i++){
      const x1=rng()*S,y1=rng()*S,x2=x1+(rng()-.5)*110,y2=y1+(rng()-.5)*110;
      const g=cx.createLinearGradient(x1,y1,x2,y2);
      g.addColorStop(0,`hsla(${12+rng()*28},100%,52%,0.85)`);
      g.addColorStop(0.5,`hsla(28,100%,62%,0.5)`);
      g.addColorStop(1,`hsla(8,100%,28%,0.2)`);
      cx.strokeStyle=g; cx.lineWidth=1+rng()*3;
      cx.beginPath(); cx.moveTo(x1,y1); cx.lineTo(x2,y2); cx.stroke();
    }

  } else if (type === 4) {
    // Ocean — deep blue with continent patches
    cx.fillStyle='#001228'; cx.fillRect(0,0,S,S);
    for (let i=0;i<10;i++){
      const x=rng()*S,y=rng()*S,r=18+rng()*55;
      const g=cx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,`hsla(210,55%,28%,0.75)`); g.addColorStop(1,`hsla(220,70%,12%,0)`);
      cx.fillStyle=g; cx.beginPath(); cx.arc(x,y,r,0,Math.PI*2); cx.fill();
    }
    cx.strokeStyle='rgba(80,160,255,0.12)'; cx.lineWidth=1;
    for (let i=0;i<18;i++){
      const y=rng()*S; cx.beginPath(); cx.moveTo(0,y); cx.lineTo(S,y); cx.stroke();
    }

  } else {
    // Desert/Mars — orange-red with dust craters
    cx.fillStyle=`hsl(${14+(seed*7)%20},58%,36%)`; cx.fillRect(0,0,S,S);
    for (let i=0;i<35;i++){
      cx.beginPath(); cx.arc(rng()*S,rng()*S,3+rng()*20,0,Math.PI*2);
      cx.fillStyle=`hsla(${8+rng()*22},48%,${26+rng()*16}%,0.72)`; cx.fill();
    }
  }

  return new THREE.CanvasTexture(cv);
}

// ── Planet + trail builder ────────────────────────────────────────────────────
export function buildPlanets() {
  for (let i = 0; i < PLANET_COUNT; i++) {
    const radius    = 90  + Math.random() * 270;
    const sizeFrac  = Math.pow(Math.random(), 1.6);   // bias toward small
    const size      = 1.2 + sizeFrac * 6.5;           // 1.2 – 7.7
    const incl      = (Math.random() - 0.5) * Math.PI * 0.85;
    const ascNode   = Math.random() * Math.PI * 2;
    const baseSpeed = (0.25 + Math.random() * 0.65) * Math.pow(90 / radius, 0.5);

    // Trail length scales with planet size: small (1.2) → 60 pts, large (7.7) → 1800 pts
    const sizeFracNorm = (size - 1.2) / 6.5;   // 0..1
    const trailLen     = Math.round(60 + Math.pow(sizeFracNorm, 1.4) * 1740);

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size, 22, 16),
      new THREE.MeshStandardMaterial({
        map: buildPlanetTexture(i), roughness: 0.82, metalness: 0.06,
      })
    );
    scene.add(mesh);

    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(trailLen * 3), 3));
    trailGeo.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(trailLen * 3), 3));
    trailGeo.setDrawRange(0, 0);
    const line = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.65, depthWrite: false,
    }));
    line.frustumCulled = false;
    scene.add(line);

    // Saturn-style ring on selected planets
    if (i === 3 || i === 8 || i === 14) {
      const innerR = size * 1.55;
      const outerR = size * 2.80;
      const ringGeo = new THREE.RingGeometry(innerR, outerR, 64);

      // Tilt UVs so the ring fades from inner to outer edge
      const uv = ringGeo.attributes.uv;
      const pos = ringGeo.attributes.position;
      for (let vi = 0; vi < pos.count; vi++) {
        const vx = pos.getX(vi), vy = pos.getY(vi);
        const r  = Math.sqrt(vx * vx + vy * vy);
        uv.setXY(vi, (r - innerR) / (outerR - innerR), 0);
      }

      const ringMat = new THREE.MeshBasicMaterial({
        color:       new THREE.Color().setHSL((i * 0.13) % 1, 0.5, 0.65),
        side:        THREE.DoubleSide,
        transparent: true,
        opacity:     0.35,
        depthWrite:  false,
      });

      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      // Tilt the ring relative to the planet's equator
      ringMesh.rotation.x = Math.PI * (0.42 + Math.random() * 0.16);
      mesh.add(ringMesh);   // child of planet so it orbits with it
    }

    // Slow independent axial spin, decoupled from orbital speed
    const spinAxis = new THREE.Vector3(
      (Math.random() - 0.5) * 0.6,
      1.0,
      (Math.random() - 0.5) * 0.4
    ).normalize();
    const spinRate = (0.008 + Math.random() * 0.018) * (Math.random() < 0.5 ? 1 : -1);

    planets.push({
      mesh, line, trail: [],
      angle: Math.random() * Math.PI * 2,
      baseSpeed, radius, incl, ascNode, trailLen,
      spinAxis, spinRate,
    });
  }
}

// Smoothed per-planet tint accumulator (persists between frames)
const _tint = { r: 0, g: 0, b: 0 };

// ── Per-frame planet update ───────────────────────────────────────────────────
// sBass/sMid/sHigh: smoothed audio bands [0..1] for trail color tinting
export function updatePlanets(orbitMult, sBass = 0, sMid = 0, sHigh = 0) {
  // Target tint: bass drives red, mid drives green, high drives blue.
  // Lerp slowly so color shifts breathe rather than flicker.
  _tint.r += (Math.min(1, sBass * 2.2) - _tint.r) * 0.06;
  _tint.g += (Math.min(1, sMid  * 2.0) - _tint.g) * 0.06;
  _tint.b += (Math.min(1, sHigh * 1.8) - _tint.b) * 0.06;

  // When silent the tint is near zero → trail stays white-grey (baseline 0.18)
  const tR = 0.18 + _tint.r * 0.82;
  const tG = 0.18 + _tint.g * 0.82;
  const tB = 0.18 + _tint.b * 0.82;

  planets.forEach(p => {
    p.angle += p.baseSpeed * orbitMult * 0.016;
    p.mesh.rotateOnWorldAxis(p.spinAxis, p.spinRate * 0.016);

    // Kepler orbit: flat XZ → inclined → rotated by ascending node
    const x0 =  Math.cos(p.angle) * p.radius;
    const z0 =  Math.sin(p.angle) * p.radius;
    const y1 = -z0 * Math.sin(p.incl);
    const z1 =  z0 * Math.cos(p.incl);
    const px =  x0 * Math.cos(p.ascNode) + z1 * Math.sin(p.ascNode);
    const py =  y1;
    const pz = -x0 * Math.sin(p.ascNode) + z1 * Math.cos(p.ascNode);
    p.mesh.position.set(px, py, pz);

    // Ring-buffer trail
    p.trail.push(new THREE.Vector3(px, py, pz));
    if (p.trail.length > p.trailLen) p.trail.shift();

    const posArr = p.line.geometry.attributes.position.array;
    const colArr = p.line.geometry.attributes.color.array;
    const len    = p.trail.length;
    for (let i = 0; i < len; i++) {
      const v    = p.trail[len - 1 - i];  // most-recent point first (brightest head)
      const fade = Math.pow(1 - i / p.trailLen, 1.6);
      posArr[i*3]   = v.x;      posArr[i*3+1] = v.y;      posArr[i*3+2] = v.z;
      colArr[i*3]   = fade * tR; colArr[i*3+1] = fade * tG; colArr[i*3+2] = fade * tB;
    }
    p.line.geometry.setDrawRange(0, len);
    p.line.geometry.attributes.position.needsUpdate = true;
    p.line.geometry.attributes.color.needsUpdate    = true;
  });
}
