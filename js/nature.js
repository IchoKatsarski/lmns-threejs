// ─── Nature scene — hill, grass, clouds, sun, fog ─────────────────────────────
import * as THREE from 'three';
import { scene }  from './scene.js';

// ── Shared hill height formula ─────────────────────────────────────────────────
function hillY(x, z) {
  const r = Math.sqrt(x * x + z * z);
  return 45 * Math.exp(-r * r / (220 * 220)) - 40;
}

// ── Hill ───────────────────────────────────────────────────────────────────────
let _hill = null;

function buildHill() {
  const geo = new THREE.PlaneGeometry(1600, 1600, 90, 90);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, hillY(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();

  _hill = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color:       0x3d7a35,
    roughness:   0.92,
    metalness:   0.0,
    transparent: true,
    opacity:     0,
  }));
  _hill.receiveShadow = true;
  _hill.visible = false;
  scene.add(_hill);
}

// ── Grass blades (single merged BufferGeometry + ShaderMaterial) ───────────────
const BLADE_COUNT = 5000;
let _grass  = null;
let _grassU = null;

function buildGrass() {
  const posArr   = new Float32Array(BLADE_COUNT * 12); // 4 verts × 3
  const uvArr    = new Float32Array(BLADE_COUNT * 8);  // 4 verts × 2
  const phaseArr = new Float32Array(BLADE_COUNT * 4);  // 1 per vert
  const indices  = [];

  for (let i = 0; i < BLADE_COUNT; i++) {
    // Denser toward center, sparse at far edges
    const r     = Math.pow(Math.random(), 0.55) * 420;
    const a     = Math.random() * Math.PI * 2;
    const bx    = r * Math.cos(a);
    const bz    = r * Math.sin(a);
    const by    = hillY(bx, bz);
    const h     = 2.5 + Math.random() * 5.5;
    const w     = 0.12 + Math.random() * 0.22;
    const phase = Math.random() * Math.PI * 2;
    const vi    = i * 4;

    posArr.set([
      bx - w/2, by,     bz,
      bx + w/2, by,     bz,
      bx - w/2, by + h, bz,
      bx + w/2, by + h, bz,
    ], vi * 3);

    uvArr.set([0, 0,  1, 0,  0, 1,  1, 1], vi * 2);
    phaseArr.fill(phase, vi, vi + 4);
    indices.push(vi, vi+1, vi+2,  vi+1, vi+3, vi+2);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr,   3));
  geo.setAttribute('uv',       new THREE.BufferAttribute(uvArr,    2));
  geo.setAttribute('aPhase',   new THREE.BufferAttribute(phaseArr, 1));
  geo.setIndex(indices);

  _grassU = {
    uTime:  { value: 0 },
    uWind:  { value: 0 },
    uBlend: { value: 0 },
  };

  _grass = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: _grassU,
    vertexShader: `
      uniform float uTime;
      uniform float uWind;
      attribute float aPhase;
      varying float vH;
      void main() {
        vH = uv.y;
        vec3 p = position;
        // Sway increases toward tip (vH²), driven by wind + wobble
        float sway = vH * vH * uWind * sin(uTime * 5.5 + aPhase);
        p.x += sway * cos(aPhase);
        p.z += sway * sin(aPhase);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uBlend;
      varying float vH;
      void main() {
        vec3 dark = vec3(0.06, 0.22, 0.05);
        vec3 lite = vec3(0.22, 0.60, 0.10);
        gl_FragColor = vec4(mix(dark, lite, vH), uBlend);
      }
    `,
    side:        THREE.DoubleSide,
    transparent: true,
    depthWrite:  false,
  }));
  _grass.visible = false;
  scene.add(_grass);
}

// ── Clouds ─────────────────────────────────────────────────────────────────────
const _clouds = [];

function makeCloudTex() {
  const S   = 128;
  const cv  = document.createElement('canvas');
  cv.width  = cv.height = S;
  const ctx = cv.getContext('2d');

  const puff = (cx, cy, r, a) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  };

  puff(S*0.50, S*0.50, S*0.46, 0.90);
  puff(S*0.30, S*0.42, S*0.28, 0.55);
  puff(S*0.72, S*0.44, S*0.24, 0.50);
  puff(S*0.50, S*0.34, S*0.20, 0.45);
  return new THREE.CanvasTexture(cv);
}

function buildClouds() {
  const tex  = makeCloudTex();
  const defs = [
    { pos: [-210, 165, -290], s: 250 },
    { pos: [ 260, 195, -330], s: 210 },
    { pos: [  55, 148, -250], s: 185 },
    { pos: [-110, 180, -310], s: 165 },
    { pos: [ 150, 135, -210], s: 145 },
  ];

  for (const { pos, s } of defs) {
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: 0, depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(...pos);
    sprite.scale.setScalar(s);
    sprite.visible = false;
    scene.add(sprite);
    _clouds.push({ sprite, mat, base: s });
  }
}

// ── Sun ────────────────────────────────────────────────────────────────────────
let _sunLight = null, _sunSprite = null, _sunMat = null;

function makeSunTex() {
  const S   = 128;
  const cv  = document.createElement('canvas');
  cv.width  = cv.height = S;
  const ctx = cv.getContext('2d');
  const g   = ctx.createRadialGradient(S/2, S/2, 0, S/2, S/2, S/2);
  g.addColorStop(0.00, 'rgba(255,252,210,1.0)');
  g.addColorStop(0.25, 'rgba(255,240,160,0.9)');
  g.addColorStop(0.65, 'rgba(255,200,80,0.35)');
  g.addColorStop(1.00, 'rgba(255,180,50,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(cv);
}

function buildSun() {
  _sunLight = new THREE.DirectionalLight(0xfff5e0, 0);
  _sunLight.position.set(260, 440, -200);
  scene.add(_sunLight);

  _sunMat    = new THREE.SpriteMaterial({
    map: makeSunTex(), transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  _sunSprite = new THREE.Sprite(_sunMat);
  _sunSprite.position.set(260, 440, -200);
  _sunSprite.scale.setScalar(190);
  _sunSprite.visible = false;
  scene.add(_sunSprite);
}

// ── Public API ─────────────────────────────────────────────────────────────────
export function buildNatureScene() {
  buildHill();
  buildGrass();
  buildClouds();
  buildSun();
}

// blend:      0 = fully space, 1 = fully nature
// wobble:     0..1 from wobble detector — drives grass sway
// sBass:      smoothed bass — drives sun intensity
// beatPulse:  0..1 decaying per kick — drives cloud scale
export function updateNatureScene(t, blend, wobble, sBass, beatPulse) {
  const vis = blend > 0.01;

  // Hill
  if (_hill) {
    _hill.visible          = vis;
    _hill.material.opacity = blend;
  }

  // Grass — gentle baseline sway + wobble surge
  if (_grass && _grassU) {
    _grass.visible       = vis;
    _grassU.uTime.value  = t;
    _grassU.uWind.value  = 0.28 + wobble * 0.95;
    _grassU.uBlend.value = blend;
  }

  // Clouds — puff up on each kick
  for (const c of _clouds) {
    c.sprite.visible = vis;
    c.mat.opacity    = blend * 0.88;
    c.sprite.scale.setScalar(c.base * (1 + beatPulse * 0.45));
  }

  // Sun — intensity breathes with bass
  if (_sunLight && _sunSprite && _sunMat) {
    _sunLight.intensity = blend * (1.2 + sBass * 3.5);
    _sunSprite.visible  = vis;
    _sunMat.opacity     = blend * (0.82 + sBass * 0.18);
  }

  // Atmospheric fog — fades in with blend, cleared in space
  if (blend < 0.01) {
    scene.fog = null;
  } else {
    if (!scene.fog) scene.fog = new THREE.FogExp2(0x87ceeb, 0);
    scene.fog.density = blend * 0.00055;
  }
}
