// ─── Bioluminescent Forest — trees, mushrooms, fireflies, light shafts ────────
import * as THREE from 'three';
import { scene, camera } from './scene.js';

export const FOREST_BG = new THREE.Color(0x010a04);

// ── Shared ground plane ────────────────────────────────────────────────────────
let _ground = null, _groundMat = null;

function buildGround() {
  const geo = new THREE.PlaneGeometry(1400, 1400);
  geo.rotateX(-Math.PI / 2);
  _groundMat = new THREE.MeshStandardMaterial({
    color: 0x020e05, roughness: 1.0, metalness: 0.0,
    transparent: true, opacity: 0,
  });
  _ground = new THREE.Mesh(geo, _groundMat);
  _ground.position.y = -110;
  _ground.receiveShadow = true;
  _ground.visible = false;
  scene.add(_ground);
}

// ── Tree silhouettes (low-poly dark trunks + layered canopy discs) ─────────────
const _trees = [];

function makeTree(x, z, height, canopyColor) {
  const group = new THREE.Group();

  // Trunk — dark, slightly tapered box
  const trunkGeo = new THREE.CylinderGeometry(2.2, 3.5, height, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x050e06, roughness: 1.0 });
  group.add(new THREE.Mesh(trunkGeo, trunkMat));

  // Canopy — 3 stacked cone layers, glowing edge
  const layers = 3;
  for (let l = 0; l < layers; l++) {
    const r    = (16 + (layers - l) * 10) * (0.7 + Math.random() * 0.4);
    const h    = 22 + l * 6;
    const yOff = height * 0.35 + l * (h * 0.55);
    const geo  = new THREE.ConeGeometry(r, h, 7);
    const mat  = new THREE.MeshStandardMaterial({
      color:             0x020d03,
      emissive:          canopyColor,
      emissiveIntensity: 0.0,
      roughness:         1.0,
      transparent:       true,
      opacity:           0,
    });
    const cone = new THREE.Mesh(geo, mat);
    cone.position.y = yOff;
    group.add(cone);
  }

  group.position.set(x, -110 + height / 2, z);
  group.visible = false;
  scene.add(group);
  _trees.push({ group, height, canopyColor: new THREE.Color(canopyColor) });
}

function buildTrees() {
  // Ring of trees at varying distances — framing the logo without blocking it
  const configs = [
    // [x, z, height, color]
    [-210,  -95, 145, 0x003322],
    [ 185, -110, 160, 0x002211],
    [-155,  180, 130, 0x003300],
    [ 220,  120, 155, 0x004422],
    [ -80, -210, 170, 0x002233],
    [ 270,  -40, 140, 0x003311],
    [-240,   55, 165, 0x004400],
    [  90, -230, 150, 0x002244],
    [ -30,  260, 135, 0x003322],
    [ 200,  200, 145, 0x002211],
    [-290,  150, 175, 0x003300],
    [ 130,  280, 125, 0x001122],
  ];
  for (const [x, z, h, c] of configs) makeTree(x, z, h, c);
}

// ── Glowing mushrooms — 5 distinct visual types ───────────────────────────────
const _shrooms = [];

// Shared cap geometry builder
function makeCapGeo(size) {
  return new THREE.SphereGeometry(size * 0.65, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.55);
}

function makeStemMat() {
  return new THREE.MeshStandardMaterial({
    color: 0x0a1208, emissive: new THREE.Color(0x030803),
    emissiveIntensity: 0.05, roughness: 1.0, transparent: true, opacity: 0,
  });
}

// Gill ring sprite under the cap — lit up color
function makeGillSprite(size, col) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  const g   = ctx.createRadialGradient(64, 64, 64 * 0.12, 64, 64, 64);
  g.addColorStop(0.00, 'rgba(0,0,0,0)');
  g.addColorStop(0.40, `rgba(${Math.round(col.r*255)},${Math.round(col.g*255)},${Math.round(col.b*255)},0.50)`);
  g.addColorStop(0.72, `rgba(${Math.round(col.r*255)},${Math.round(col.g*255)},${Math.round(col.b*255)},0.92)`);
  g.addColorStop(1.00, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const mat  = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cv), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(size * 1.55, size * 0.55, 1);
  spr.position.y = size * 0.56;
  return { sprite: spr, mat };
}

// Underglow — red/orange pool on the ground
function makeUnderglow(size) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  const g   = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0,   'rgba(255,80,5,0.88)');
  g.addColorStop(0.5, 'rgba(210,35,0,0.35)');
  g.addColorStop(1,   'rgba(160,15,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const mat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cv), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(size * 5.5, size * 1.8, 1);
  spr.position.y = -size * 0.6;
  return { sprite: spr, mat };
}

// ── Type A: Solid flat-color (purple, red, teal) ──────────────────────────────
function makeShroomSolid(size, color) {
  const group  = new THREE.Group();
  const col    = new THREE.Color(color);
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(size*0.18, size*0.25, size*1.1, 7), makeStemMat()));
  const capMat = new THREE.MeshStandardMaterial({
    color, emissive: col, emissiveIntensity: 0.80,
    roughness: 0.4, transparent: true, opacity: 0, side: THREE.DoubleSide,
  });
  const cap = new THREE.Mesh(makeCapGeo(size), capMat);
  cap.position.y = size * 0.70;
  group.add(cap);
  const { sprite: gs, mat: glowMat }  = makeGillSprite(size, col);
  const { sprite: us, mat: underMat } = makeUnderglow(size);
  group.add(gs); group.add(us);
  return { group, capMat, stemMat: group.children[0].material, glowMat, underMat, shaderMesh: null };
}

// ── Type B: Gradient cap (canvas texture, two-color radial) ───────────────────
function makeShroomGradient(size, colorA, colorB) {
  const group = new THREE.Group();
  const colA  = new THREE.Color(colorA);
  const colB  = new THREE.Color(colorB);

  group.add(new THREE.Mesh(new THREE.CylinderGeometry(size*0.18, size*0.25, size*1.1, 7), makeStemMat()));

  const S   = 256;
  const cv  = document.createElement('canvas');
  cv.width  = cv.height = S;
  const ctx = cv.getContext('2d');
  const g   = ctx.createRadialGradient(S/2, S/2, 0, S/2, S/2, S/2);
  g.addColorStop(0,   `rgb(${Math.round(colA.r*255)},${Math.round(colA.g*255)},${Math.round(colA.b*255)})`);
  g.addColorStop(1,   `rgb(${Math.round(colB.r*255)},${Math.round(colB.g*255)},${Math.round(colB.b*255)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  const capMat = new THREE.MeshStandardMaterial({
    map:     new THREE.CanvasTexture(cv),
    emissive: colA, emissiveIntensity: 0.70,
    roughness: 0.35, transparent: true, opacity: 0, side: THREE.DoubleSide,
  });
  const cap = new THREE.Mesh(makeCapGeo(size), capMat);
  cap.position.y = size * 0.70;
  group.add(cap);

  const midCol = new THREE.Color().lerpColors(colA, colB, 0.5);
  const { sprite: gs, mat: glowMat }  = makeGillSprite(size, midCol);
  const { sprite: us, mat: underMat } = makeUnderglow(size);
  group.add(gs); group.add(us);
  return { group, capMat, stemMat: group.children[0].material, glowMat, underMat, shaderMesh: null };
}

// ── Type C: Polka-dot cap (canvas texture) ────────────────────────────────────
function makeShroomDots(size, capColor, dotColor) {
  const group = new THREE.Group();
  const col   = new THREE.Color(capColor);
  const dotC  = new THREE.Color(dotColor);

  group.add(new THREE.Mesh(new THREE.CylinderGeometry(size*0.18, size*0.25, size*1.1, 7), makeStemMat()));

  const S   = 256;
  const cv  = document.createElement('canvas');
  cv.width  = cv.height = S;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = `rgb(${Math.round(col.r*255)},${Math.round(col.g*255)},${Math.round(col.b*255)})`;
  ctx.fillRect(0, 0, S, S);
  // Dots
  ctx.fillStyle = `rgb(${Math.round(dotC.r*255)},${Math.round(dotC.g*255)},${Math.round(dotC.b*255)})`;
  const dotCount = 14 + Math.floor(Math.random() * 10);
  for (let i = 0; i < dotCount; i++) {
    const dr = 6 + Math.random() * (S * 0.10);
    const dx = dr + Math.random() * (S - dr * 2);
    const dy = dr + Math.random() * (S - dr * 2);
    ctx.beginPath();
    ctx.arc(dx, dy, dr, 0, Math.PI * 2);
    ctx.fill();
  }

  const capMat = new THREE.MeshStandardMaterial({
    map: new THREE.CanvasTexture(cv),
    emissive: col, emissiveIntensity: 0.75,
    roughness: 0.4, transparent: true, opacity: 0, side: THREE.DoubleSide,
  });
  const cap = new THREE.Mesh(makeCapGeo(size), capMat);
  cap.position.y = size * 0.70;
  group.add(cap);

  const { sprite: gs, mat: glowMat }  = makeGillSprite(size, col);
  const { sprite: us, mat: underMat } = makeUnderglow(size);
  group.add(gs); group.add(us);
  return { group, capMat, stemMat: group.children[0].material, glowMat, underMat, shaderMesh: null };
}

// ── Type D: Animated GLSL shader cap ─────────────────────────────────────────
// Reuses the same uniform structure as the logo shader — same modes, same audio reactivity
const SHROOM_VERT = /* glsl */`
  varying vec3 vWPos;
  varying vec3 vWNorm;
  varying vec3 vViewDir;
  void main() {
    vec4 wPos    = modelMatrix * vec4(position, 1.0);
    vWPos        = wPos.xyz;
    vWNorm       = normalize(mat3(modelMatrix) * normal);
    vViewDir     = normalize(cameraPosition - wPos.xyz);
    gl_Position  = projectionMatrix * viewMatrix * wPos;
  }
`;

// Pick a few visually distinctive modes for mushrooms
const SHROOM_MODES = [
  3,   // embers — orange/red
  5,   // lava lamp — purple/magenta
  12,  // neon — cycling hue
  15,  // void tendrils — dark purple
  2,   // aurora — green/violet
  9,   // fire
  1,   // electric plasma
];

// Shared uniform blocks per shader shroom — each gets its own uniforms object
function makeShaderCapMat(modeIndex) {
  const uniforms = {
    uTime:  { value: 0 },
    uBass:  { value: 0 },
    uMid:   { value: 0 },
    uHigh:  { value: 0 },
    uMode:  { value: modeIndex },
    uBlend: { value: 0 },
  };

  // Inline the specific mode GLSL to avoid importing the full library
  // We embed a minimal dispatcher with just the modes mushrooms use
  const frag = /* glsl */`
    uniform float uTime;
    uniform float uBass;
    uniform float uMid;
    uniform float uHigh;
    uniform float uMode;
    uniform float uBlend;
    varying vec3 vWPos;
    varying vec3 vWNorm;
    varying vec3 vViewDir;

    vec3 _embers(vec3 wp,vec3 vd,vec3 n,float t,float bass,float mid,float high){
      float ndv=max(0.0,dot(n,vd));
      float edge=pow(1.0-ndv,max(0.5,3.5-bass*2.5));
      vec3 p=wp*0.038;
      float flk=sin(p.x*6.2+t*2.3)*sin(p.y*5.1+t*1.9)*0.5+0.5;
      flk=pow(flk,2.2);
      return mix(vec3(1.0,0.12,0.0),vec3(1.0,0.65,0.05),flk)*(edge*1.2+flk*0.3)*(0.4+bass*0.9);
    }
    vec3 _lava(vec3 wp,vec3 vd,vec3 n,float t,float bass,float mid,float high){
      vec3 p=wp*0.014;
      float b1=sin(p.x*2.1+t*0.22)*sin(p.y*1.9+t*0.17)*sin(p.z*2.4+t*0.20);
      float b2=sin(p.x*1.6+t*0.30+1.5)*sin(p.y*2.4+t*0.26)*sin(p.z*1.8+t*0.14);
      float blob=b1*0.55+b2*0.35+0.5;
      float edge=0.15+bass*0.28;
      vec3 col=mix(vec3(0.35,0.0,0.75),vec3(0.9,0.0,0.5),smoothstep(0.5-edge,0.5+edge,blob));
      return mix(col,vec3(1.0,0.30,0.05),smoothstep(0.7-edge,0.7+edge,blob))*0.9*(0.4+bass*0.6+mid*0.4);
    }
    vec3 _neon(vec3 wp,vec3 vd,vec3 n,float t,float bass,float mid,float high){
      float ndv=max(0.0,dot(n,vd));
      float edge=pow(1.0-ndv,max(0.8,5.0-bass*3.5));
      float h=fract(t*0.12+bass*0.25);
      float h6=h*6.0;
      vec3 col=clamp(vec3(abs(h6-3.0)-1.0,2.0-abs(h6-2.0),2.0-abs(h6-4.0)),0.0,1.0);
      return col*(edge*1.4+pow(1.0-ndv,10.0)*0.6)*(0.4+mid*0.65+high*0.45);
    }
    vec3 _void(vec3 wp,vec3 vd,vec3 n,float t,float bass,float mid,float high){
      vec3 p=wp*0.020;
      float v1=sin(p.x*6.2+t*0.28)*sin(p.y*5.1+t*0.22)*sin(p.z*7.3+t*0.18);
      float v2=sin(p.x*9.5-t*0.35+p.z)*sin(p.y*8.2+t*0.30);
      float vein=pow(max(0.0,v1*v2),4.0)*5.5;
      vec3 col=mix(vec3(0.04,0.0,0.10),vec3(0.42,0.0,0.88),vein);
      col+=vec3(0.18,0.0,0.45)*pow(1.0-max(0.0,dot(n,vd)),5.0);
      return col*(0.38+bass*0.75+mid*0.45);
    }
    vec3 _aurora(vec3 wp,vec3 vd,vec3 n,float t,float bass,float mid,float high){
      vec3 p=wp*0.018;
      float spd=0.28+mid*0.45;
      float w1=sin(p.y*4.2+p.x*1.8+t*spd)*sin(p.z*3.1+t*spd*0.9);
      float w2=sin(p.x*3.3+p.z*2.2+t*spd*1.3)*sin(p.y*3.8+t*spd*0.7);
      float rv=pow(max(0.0,w1*0.5+0.5),2.5)*0.35;
      float gv=pow(max(0.0,w2*0.5+0.5),2.0)*0.95;
      float bv=pow(max(0.0,(w1+w2)*0.25+0.5),2.2)*0.75;
      return vec3(rv+bv*0.3,gv+bv*0.4,bv+rv*0.2)*0.9*(0.3+mid*0.7+bass*0.4);
    }
    vec3 _fire(vec3 wp,vec3 vd,vec3 n,float t,float bass,float mid,float high){
      vec3 p=wp*0.022;
      float turb=sin(p.x*4.2+t*1.1)*sin(p.z*3.8+t*0.9);
      turb+=sin(p.x*8.5+t*1.8+turb*1.2)*sin(p.z*7.0+t*1.4)*0.5;
      float flame=clamp(p.y*0.6+turb*0.35+0.55+bass*0.6,0.0,1.0);
      vec3 col=mix(vec3(0.7,0.0,0.0),vec3(1.0,0.38,0.0),flame);
      col=mix(col,vec3(1.0,0.88,0.15),pow(flame,2.2));
      return col*(0.35+bass*0.9+high*0.3);
    }
    vec3 _plasma(vec3 wp,vec3 vd,vec3 n,float t,float bass,float mid,float high){
      vec3 p=wp*0.045;
      float arc=sin(p.x*9.0+t*1.4)*sin(p.y*7.5+t*1.1)*sin(p.z*11.0+t*1.7);
      float shp=5.0+bass*10.0;
      arc=pow(max(0.0,arc),shp)*4.0;
      float edge=pow(1.0-max(0.0,dot(n,vd)),2.0);
      vec3 col=mix(vec3(0.0,0.4,1.0),vec3(0.7,0.95,1.0),arc);
      return col*arc*(0.3+bass*0.9)+vec3(0.0,0.3,0.9)*edge*(0.25+mid*0.5);
    }

    void main() {
      vec3 c = vec3(0.0);
      int m = int(uMode);
      if      (m == 0) c = _embers(vWPos, vViewDir, vWNorm, uTime, uBass, uMid, uHigh);
      else if (m == 1) c = _lava  (vWPos, vViewDir, vWNorm, uTime, uBass, uMid, uHigh);
      else if (m == 2) c = _neon  (vWPos, vViewDir, vWNorm, uTime, uBass, uMid, uHigh);
      else if (m == 3) c = _void  (vWPos, vViewDir, vWNorm, uTime, uBass, uMid, uHigh);
      else if (m == 4) c = _aurora(vWPos, vViewDir, vWNorm, uTime, uBass, uMid, uHigh);
      else if (m == 5) c = _fire  (vWPos, vViewDir, vWNorm, uTime, uBass, uMid, uHigh);
      else             c = _plasma(vWPos, vViewDir, vWNorm, uTime, uBass, uMid, uHigh);
      gl_FragColor = vec4(c * uBlend, uBlend * 0.92);
    }
  `;

  return {
    mat: new THREE.ShaderMaterial({
      vertexShader:   SHROOM_VERT,
      fragmentShader: frag,
      uniforms,
      transparent:    true,
      side:           THREE.DoubleSide,
      depthWrite:     false,
      blending:       THREE.AdditiveBlending,
    }),
    uniforms,
  };
}

// All shader shrooms share their uniform updates
const _shroomShaderUniforms = [];

function makeShroomShader(size, modeLocalIndex) {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(size*0.18, size*0.25, size*1.1, 7), makeStemMat()));

  const { mat, uniforms } = makeShaderCapMat(modeLocalIndex);
  _shroomShaderUniforms.push(uniforms);

  const cap = new THREE.Mesh(makeCapGeo(size), mat);
  cap.position.y = size * 0.70;
  group.add(cap);

  // Gill and underglow still use the local mode color as tint
  const col = new THREE.Color(0x8844ff); // generic purple tint for gills
  const { sprite: gs, mat: glowMat }  = makeGillSprite(size, col);
  const { sprite: us, mat: underMat } = makeUnderglow(size);
  group.add(gs); group.add(us);

  return { group, capMat: mat, stemMat: group.children[0].material, glowMat, underMat, shaderMesh: cap, shaderUniforms: uniforms };
}

function buildShrooms() {
  // [type, minSize, maxSize, count, ...args]
  const specs = [
    // Solid purple
    () => makeShroomSolid(rnd(1.5, 4.0),   0xaa00ff),
    () => makeShroomSolid(rnd(5.0, 11.0),  0xcc22ff),
    () => makeShroomSolid(rnd(12,  20),    0x9900ee),
    // Solid red
    () => makeShroomSolid(rnd(2.0, 5.0),   0xff1133),
    () => makeShroomSolid(rnd(6.0, 13.0),  0xff3300),
    // Original teal/green
    () => makeShroomSolid(rnd(1.2, 3.5),   0x00ffaa),
    () => makeShroomSolid(rnd(4.0, 9.0),   0x44ffcc),
    // Gradient: purple → cyan
    () => makeShroomGradient(rnd(4,  14),  0xcc00ff, 0x00ffee),
    () => makeShroomGradient(rnd(10, 22),  0xff0066, 0xffaa00),
    () => makeShroomGradient(rnd(2,   6),  0x0055ff, 0x00ffaa),
    // Dots: red cap white dots / purple cap yellow dots
    () => makeShroomDots(rnd(3,   9),  0xdd0022, 0xffffff),
    () => makeShroomDots(rnd(5,  14),  0x880088, 0xffff00),
    () => makeShroomDots(rnd(1.5, 4),  0xff4400, 0xffeedd),
    // Shader animated (modeLocalIndex 0–6 map to embers/lava/neon/void/aurora/fire/plasma)
    () => makeShroomShader(rnd(6,  16), 0),  // embers
    () => makeShroomShader(rnd(8,  20), 1),  // lava lamp
    () => makeShroomShader(rnd(4,  10), 2),  // neon
    () => makeShroomShader(rnd(10, 22), 3),  // void tendrils
    () => makeShroomShader(rnd(5,  12), 4),  // aurora
    () => makeShroomShader(rnd(3,   8), 5),  // fire
    () => makeShroomShader(rnd(7,  18), 6),  // plasma
  ];

  // Spread them in rings with slight randomness
  specs.forEach((factory, i) => {
    const angle  = (i / specs.length) * Math.PI * 2 + (Math.random() - 0.5) * 0.9;
    const radius = 50 + Math.random() * 190;
    const x      = Math.cos(angle) * radius;
    const z      = Math.sin(angle) * radius;
    const shroom = factory();
    const size   = shroom.group.children[0].geometry.parameters.height / 1.1; // recover size from stem height
    shroom.group.position.set(x, -110 + Math.max(1, Math.random() * 5), z);
    shroom.group.rotation.y = Math.random() * Math.PI * 2;
    shroom.group.visible    = false;
    scene.add(shroom.group);
    _shrooms.push({ ...shroom, phase: Math.random() * Math.PI * 2, size: radius * 0.08 });
  });
}

function rnd(a, b) { return a + Math.random() * (b - a); }

// ── Fireflies ──────────────────────────────────────────────────────────────────
const FIREFLY_COUNT = 120;
let _ffGeo   = null;
let _ffMesh  = null;
const _ffPos    = new Float32Array(FIREFLY_COUNT * 3);
const _ffCol    = new Float32Array(FIREFLY_COUNT * 3);
const _ffPhase  = new Float32Array(FIREFLY_COUNT);
const _ffSpeed  = new Float32Array(FIREFLY_COUNT);
const _ffRadius = new Float32Array(FIREFLY_COUNT);
const _ffAngle  = new Float32Array(FIREFLY_COUNT);
const _ffY      = new Float32Array(FIREFLY_COUNT);
const _ffYSpd   = new Float32Array(FIREFLY_COUNT);

const FF_COLORS = [
  new THREE.Color(0xff2200),
  new THREE.Color(0xff5500),
  new THREE.Color(0xff3311),
  new THREE.Color(0xff6633),
  new THREE.Color(0xff1100),
];

// Base speeds stored separately so we can scale with audio without drift
const _ffBaseSpeed = new Float32Array(120);

function buildFireflies() {
  for (let i = 0; i < FIREFLY_COUNT; i++) {
    _ffAngle[i]      = Math.random() * Math.PI * 2;
    _ffRadius[i]     = 40 + Math.random() * 220;
    _ffY[i]          = -90 + Math.random() * 180;
    _ffYSpd[i]       = (Math.random() - 0.5) * 0.8;
    _ffBaseSpeed[i]  = (0.12 + Math.random() * 0.28) * (Math.random() < 0.5 ? 1 : -1);
    _ffSpeed[i]      = _ffBaseSpeed[i];
    _ffPhase[i]      = Math.random() * Math.PI * 2;
    const col    = FF_COLORS[Math.floor(Math.random() * FF_COLORS.length)];
    _ffCol[i*3]   = col.r;
    _ffCol[i*3+1] = col.g;
    _ffCol[i*3+2] = col.b;
    _ffPos[i*3]   = Math.cos(_ffAngle[i]) * _ffRadius[i];
    _ffPos[i*3+1] = _ffY[i];
    _ffPos[i*3+2] = Math.sin(_ffAngle[i]) * _ffRadius[i];
  }

  _ffGeo = new THREE.BufferGeometry();
  _ffGeo.setAttribute('position', new THREE.BufferAttribute(_ffPos, 3));
  _ffGeo.setAttribute('color',    new THREE.BufferAttribute(_ffCol, 3));

  _ffMesh = new THREE.Points(_ffGeo, new THREE.PointsMaterial({
    vertexColors:    true,
    size:            3.8,
    sizeAttenuation: true,
    transparent:     true,
    opacity:         0,
    depthWrite:      false,
    blending:        THREE.AdditiveBlending,
  }));
  _ffMesh.visible = false;
  scene.add(_ffMesh);
}

// Moon origin — declared here so both the beam builder and moon builder share it
const MOON_POS = new THREE.Vector3(-120, 115, -220);

// ── Moon light beams — volumetric shafts fanning down from the moon position ───
// Mirrors the underwater sunray technique: planes pinned at moon origin, angled down.
const _shafts = [];

function buildMoonBeam(spreadX, spreadZ, width, length, phase) {
  const segs = 8;
  const geo  = new THREE.PlaneGeometry(width, length, 1, segs);
  geo.translate(0, -length / 2, 0);   // top edge at local y=0, hangs downward

  const posArr = geo.attributes.position.array;
  const colArr = new Float32Array(posArr.length);
  for (let v = 0; v < posArr.length / 3; v++) {
    // Bright at top (moon origin), fully transparent at bottom
    const f = 1.0 + posArr[v * 3 + 1] / length;  // 1 at top → 0 at bottom
    const e = f * f * f;                           // cubic — sharp falloff
    // Cool silver-blue moonlight
    colArr[v*3]   = 0.72 * e;
    colArr[v*3+1] = 0.82 * e;
    colArr[v*3+2] = 1.00 * e;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));

  const mat  = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  // Pin top edge at moon origin; tilt downward + fan outward by spread angles
  mesh.position.copy(MOON_POS);
  mesh.rotation.x =  0.35 + spreadX;   // lean forward into the scene (mostly downward)
  mesh.rotation.z =        spreadZ;    // fan left/right
  mesh.rotation.y = Math.random() * 0.5;
  mesh.visible = false;
  scene.add(mesh);
  _shafts.push({ mesh, mat, phase });
}

function buildShafts() {
  const BEAMS = 9;
  for (let i = 0; i < BEAMS; i++) {
    const t = i / BEAMS;
    const a = t * Math.PI * 2;
    for (let layer = 0; layer < 3; layer++) {
      const spread = 0.06 + Math.random() * 0.20;
      const sX = Math.cos(a) * spread + (Math.random() - 0.5) * 0.03;
      const sZ = Math.sin(a) * spread + (Math.random() - 0.5) * 0.03;
      buildMoonBeam(sX, sZ, 6 + Math.random() * 16, 300 + Math.random() * 100, Math.random() * Math.PI * 2);
    }
  }
}

// ── Moon ──────────────────────────────────────────────────────────────────────
let _moonMesh   = null;
let _moonLight  = null;
let _moonHalo   = null;
let _moonHaloMat = null;


function makeMoonHaloTex() {
  const S   = 256;
  const cv  = document.createElement('canvas');
  cv.width  = cv.height = S;
  const ctx = cv.getContext('2d');
  const g   = ctx.createRadialGradient(S/2, S/2, S*0.12, S/2, S/2, S/2);
  g.addColorStop(0.00, 'rgba(200,215,255,0.0)');
  g.addColorStop(0.35, 'rgba(180,200,255,0.18)');
  g.addColorStop(0.70, 'rgba(140,170,230,0.08)');
  g.addColorStop(1.00, 'rgba(100,140,200,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(cv);
}

// MOON_POS declared above near beam builder

function buildMoon() {
  const geo = new THREE.SphereGeometry(38, 40, 40);
  const mat = new THREE.MeshStandardMaterial({
    map: new THREE.TextureLoader().load('assets/Moon_texture.jpg'),
    roughness: 0.95,
    metalness: 0.00,
    emissive:  new THREE.Color(0xaab8cc),
    emissiveIntensity: 0.12,
    transparent: true,
    opacity:     0,
  });
  _moonMesh = new THREE.Mesh(geo, mat);
  _moonMesh.position.copy(MOON_POS);
  _moonMesh.visible = false;
  scene.add(_moonMesh);

  // Atmospheric halo around moon
  _moonHaloMat = new THREE.SpriteMaterial({
    map:         makeMoonHaloTex(),
    transparent: true,
    opacity:     0,
    blending:    THREE.AdditiveBlending,
    depthWrite:  false,
  });
  _moonHalo = new THREE.Sprite(_moonHaloMat);
  _moonHalo.position.copy(MOON_POS);
  _moonHalo.scale.setScalar(180);
  _moonHalo.visible = false;
  scene.add(_moonHalo);

  // Directional light — cool silver, angled down from moon's position
  _moonLight = new THREE.DirectionalLight(0xaec4e8, 0);
  _moonLight.position.copy(MOON_POS);
  _moonLight.target.position.set(0, 0, 0);
  _moonLight.castShadow = true;
  scene.add(_moonLight);
  scene.add(_moonLight.target);
}

// ── Beat burst — firefly scatter pool ─────────────────────────────────────────
// On a beat, extra bright firefly sprites bloom outward from origin then fade
const BURST_COUNT = 18;
const _bursts     = [];

function buildBurstPool() {
  for (let i = 0; i < BURST_COUNT; i++) {
    const mat = new THREE.SpriteMaterial({
      color: 0x88ffaa, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const s = new THREE.Sprite(mat);
    s.scale.setScalar(6);
    s.visible = false;
    scene.add(s);
    _bursts.push({ sprite: s, mat, active: false, age: 0, vel: new THREE.Vector3() });
  }
}

export function spawnFireflyBurst(flux) {
  const available = _bursts.filter(b => !b.active);
  const count     = Math.min(available.length, 4 + Math.round(flux * 10));
  for (let i = 0; i < count; i++) {
    const b = available[i];
    b.active = true;
    b.age    = 0;
    b.sprite.visible = true;
    b.sprite.position.set(
      (Math.random() - 0.5) * 60,
      (Math.random() - 0.5) * 60,
      (Math.random() - 0.5) * 60
    );
    b.vel.set(
      (Math.random() - 0.5) * 55,
      (Math.random() - 0.5) * 55,
      (Math.random() - 0.5) * 55
    );
    const col = FF_COLORS[Math.floor(Math.random() * FF_COLORS.length)];
    b.mat.color.copy(col);
    b.mat.opacity = 0.85 + flux * 0.15;
    b.sprite.scale.setScalar(4 + flux * 8);
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────
export function buildForestScene() {
  buildGround();
  buildTrees();
  buildShrooms();
  buildFireflies();
  buildShafts();
  buildMoon();
  buildBurstPool();
}

let _prevT = -1;

export function updateForestScene(t, blend, sBass, sMid, sHigh, beatPulse) {
  const dt  = _prevT < 0 ? 0.016 : Math.min(t - _prevT, 0.05);
  _prevT    = t;
  const vis = blend > 0.01;

  // ── Ground ───────────────────────────────────────────────────────────────────
  if (_ground) {
    _ground.visible    = vis;
    _groundMat.opacity = blend * 0.95;
  }

  // ── Trees — canopy emissive breathes with mid ─────────────────────────────────
  for (const tree of _trees) {
    tree.group.visible = vis;
    for (let ci = 1; ci < tree.group.children.length; ci++) {
      const cone = tree.group.children[ci];
      if (cone.material) {
        cone.material.opacity           = blend * (0.82 + sMid * 0.18);
        cone.material.emissiveIntensity = blend * (0.04 + sMid * 0.12 + beatPulse * 0.08);
      }
    }
  }

  // ── Mushrooms — pulse with bass, underglow red/orange ────────────────────────
  for (const sh of _shrooms) {
    sh.group.visible = vis;
    const pulse = 0.88 + 0.12 * Math.sin(t * 2.2 + sh.phase);
    const glow  = blend * (0.75 + sBass * 2.2 + beatPulse * 1.4);

    // Shader mushrooms: tick uniforms; alpha handled inside shader
    if (sh.shaderUniforms) {
      sh.shaderUniforms.uTime.value  = t;
      sh.shaderUniforms.uBass.value  = sBass;
      sh.shaderUniforms.uMid.value   = sMid;
      sh.shaderUniforms.uHigh.value  = sHigh;
      sh.shaderUniforms.uBlend.value = blend * pulse;
    } else {
      sh.capMat.opacity           = blend * 0.88;
      sh.capMat.emissiveIntensity = glow * pulse;
    }

    sh.stemMat.opacity           = blend * 0.80;
    sh.stemMat.emissiveIntensity = blend * 0.05;
    // Gill ring — surges hard with bass
    sh.glowMat.opacity  = blend * (0.55 + sBass * 1.20 + beatPulse * 0.90) * pulse;
    // Underglow — red/orange ground pool
    const ugMat = sh.underMat || sh.underglowMat;
    if (ugMat) ugMat.opacity = blend * (0.18 + sBass * 1.20 + beatPulse * 1.0) * pulse;

    const swellFactor = 0.06 + Math.min(1, sh.size / 22) * 0.08;
    sh.group.scale.setScalar(1 + sBass * swellFactor + beatPulse * 0.10);
  }

  // ── Fireflies — drift, flicker, and react to audio ───────────────────────────
  if (_ffMesh) {
    _ffMesh.visible = vis;
    // Overall brightness lifts with high frequencies
    _ffMesh.material.opacity = blend * (0.50 + sHigh * 0.50);
    // Point size surges on beat — swarm feels agitated
    _ffMesh.material.size = 3.8 + beatPulse * 4.0 + sHigh * 2.5;

    for (let i = 0; i < FIREFLY_COUNT; i++) {
      // Speed scales with high frequencies — fireflies dart faster with bright highs
      const speedMult = 1.0 + sHigh * 2.8 + beatPulse * 1.6;
      _ffAngle[i] += _ffBaseSpeed[i] * speedMult * dt;

      // Vertical drift also quickens with mid
      const yDrift = _ffYSpd[i] * (1.0 + sMid * 1.5) * dt
                   + Math.sin(t * 0.6 + _ffPhase[i]) * 0.14;
      _ffY[i] += yDrift;
      if (_ffY[i] > 90)  _ffYSpd[i] = -Math.abs(_ffYSpd[i]);
      if (_ffY[i] < -90) _ffYSpd[i] =  Math.abs(_ffYSpd[i]);

      // Radius swells outward on beat — swarm expands
      const r = _ffRadius[i]
              + Math.sin(t * 0.35 + _ffPhase[i]) * 18
              + beatPulse * 30;
      _ffPos[i*3]   = Math.cos(_ffAngle[i]) * r;
      _ffPos[i*3+1] = _ffY[i];
      _ffPos[i*3+2] = Math.sin(_ffAngle[i]) * r;

      // Blink — unique frequency per firefly, amplitude driven by sHigh
      // High frequencies = faster, more intense flickering
      const blinkRate = 2.8 + (_ffPhase[i] % 3.0);
      const blinkAmp  = 0.55 + sHigh * 0.45;
      const flicker   = Math.pow(Math.max(0, Math.sin(t * blinkRate + _ffPhase[i])), 4) * blinkAmp;

      const fc = FF_COLORS[i % FF_COLORS.length];
      // Smooth toward target color, spike on flicker
      _ffCol[i*3]   = _ffCol[i*3]   * 0.85 + fc.r * flicker * 0.15;
      _ffCol[i*3+1] = _ffCol[i*3+1] * 0.85 + fc.g * flicker * 0.15;
      _ffCol[i*3+2] = _ffCol[i*3+2] * 0.85 + fc.b * flicker * 0.15;
    }
    _ffGeo.attributes.position.needsUpdate = true;
    _ffGeo.attributes.color.needsUpdate    = true;
  }

  // ── Moon beams — fan from moon origin, shimmer with bass + beat ──────────────
  for (const sh of _shafts) {
    sh.mesh.visible = vis;
    // Gentle two-frequency shimmer — atmospheric mist moving through beams
    const flicker = 0.30 + 0.70
      * Math.abs(Math.sin(t * 0.38 + sh.phase))
      * Math.abs(Math.sin(t * 0.16 + sh.phase * 2.1));
    // Bass and beat surge the moonbeam brightness (same reactive feel as underwater sunrays)
    sh.mat.opacity = blend * 0.070 * flicker * (1.0 + sBass * 2.4 + beatPulse * 1.8);
    // Very slow sway — beams drift as if mist moves through the forest
    sh.mesh.rotation.z += Math.sin(t * 0.07 + sh.phase) * 0.00035;
    sh.mesh.rotation.x += Math.cos(t * 0.05 + sh.phase) * 0.00015;
  }

  // ── Beat burst particles ──────────────────────────────────────────────────────
  for (const b of _bursts) {
    if (!b.active) continue;
    b.age += dt;
    const prog = b.age / 0.90;
    if (prog >= 1) { b.active = false; b.sprite.visible = false; continue; }
    b.sprite.position.addScaledVector(b.vel, dt);
    b.vel.multiplyScalar(0.88);  // drag
    b.mat.opacity = blend * (1 - prog) * (1 - prog) * 0.85;
  }

  // ── Moon — silvery light, audio reactive intensity ────────────────────────────
  if (_moonMesh && _moonLight) {
    _moonMesh.visible = vis;
    _moonHalo.visible = vis;

    // Base opacity fades in with blend
    _moonMesh.material.opacity = blend * 0.95;

    // Very slow self-rotation — moon turns imperceptibly
    _moonMesh.rotation.y += dt * 0.008;

    // Emissive glow surges with bass (bioluminescent moonlight feel)
    const moonGlow = 0.10 + sBass * 0.55 + beatPulse * 0.40;
    _moonMesh.material.emissiveIntensity = blend * moonGlow;

    // Directional light: baseline cool glow + strong bass reactivity
    // peaks around 3.5 lux on heavy bass (similar scale to underwater sun)
    _moonLight.intensity = blend * (0.40 + sBass * 3.0 + beatPulse * 0.80);

    // Halo breathes with mid frequencies — atmospheric scattering feel
    _moonHaloMat.opacity = blend * (0.22 + sMid * 0.55 + beatPulse * 0.30);
    // Halo scale pulses subtly on beat
    const haloScale = 180 + beatPulse * 40 + sBass * 25;
    _moonHalo.scale.setScalar(haloScale);
  }

  // ── Forest fog — thick and moody ─────────────────────────────────────────────
  if (blend < 0.01) {
    scene.fog = null;
  } else {
    if (!scene.fog) scene.fog = new THREE.FogExp2(0x010a04, 0);
    scene.fog.density = blend * 0.0024;
  }
}
