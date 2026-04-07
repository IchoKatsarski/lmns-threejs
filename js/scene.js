// ─── Renderer, scene, camera, composer ───────────────────────────────────────
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RGBELoader }     from 'three/addons/loaders/RGBELoader.js';

export let renderer;
export let scene;
export let camera;
export let composer;

export function initRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping         = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.60;
  renderer.outputColorSpace    = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled   = true;
  renderer.shadowMap.type      = THREE.PCFSoftShadowMap;
  document.getElementById('canvas').appendChild(renderer.domElement);
}

export function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // HDRI used only for PBR reflections — not rendered as background
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  new RGBELoader().load(
    'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr',
    (hdrTex) => {
      scene.environment = pmrem.fromEquirectangular(hdrTex).texture;
      hdrTex.dispose();
      pmrem.dispose();
    }
  );
}

export function initCamera() {
  camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 22, 240);
}

export function initComposer() {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.12, 0.40, 0.92
  ));
}

// ── Beat color temperature ─────────────────────────────────────────────────────
// flashAmt: 0..1, drives a brief exposure + warmth surge then fades back
let _flashAmt = 0;

export function triggerFlash(strength) {
  _flashAmt = Math.min(1, _flashAmt + strength);
}

export function updateColorTemperature(wobble = 0) {
  _flashAmt *= 0.88;  // decay each frame
  // Wobble adds a gentle breathing pulse on top of the beat flash
  renderer.toneMappingExposure = 0.60 + _flashAmt * 0.55 + wobble * 0.18;
}

export function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}
