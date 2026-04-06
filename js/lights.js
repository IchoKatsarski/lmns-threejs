// ─── Scene lighting ───────────────────────────────────────────────────────────
import * as THREE from 'three';
import { scene }  from './scene.js';

let bassLight = null;
const orbiters = [];

export function buildLights() {
  // Soft ambient fill
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd0c8b8, 0.45));

  // Key light — large soft overhead-front, casts shadows
  const key = new THREE.DirectionalLight(0xfff8f0, 1.6);
  key.position.set(-60, 280, 180);
  key.castShadow             = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.camera.near     = 1;
  key.shadow.camera.far      = 900;
  key.shadow.camera.left     = key.shadow.camera.bottom = -200;
  key.shadow.camera.right    = key.shadow.camera.top    =  200;
  key.shadow.bias            = -0.0002;
  key.shadow.radius          = 3;
  scene.add(key);

  // Fill — reduces harsh shadow contrast
  const fill = new THREE.DirectionalLight(0xf0f4ff, 0.35);
  fill.position.set(160, 100, 120);
  scene.add(fill);

  // Bass spotlight — punches down on each kick
  bassLight = new THREE.SpotLight(0x6688ff, 0, 600, Math.PI * 0.18, 0.35, 1.8);
  bassLight.position.set(0, 320, 60);
  bassLight.target.position.set(0, 0, 0);
  scene.add(bassLight);
  scene.add(bassLight.target);

  // 4 audio-reactive colour orbiters
  for (const color of [0x4466ff, 0xaa33ff, 0x00ddcc, 0xff44aa]) {
    const l = new THREE.PointLight(color, 2.5, 550);
    scene.add(l);
    orbiters.push(l);
  }
}

export function updateLights(t, sBass, sMid, sHigh) {
  if (bassLight) {
    bassLight.intensity = sBass * 18;
    bassLight.color.setHSL((0.60 + t * 0.03) % 1, 1.0, 0.60);
  }

  orbiters.forEach((light, i) => {
    const a = t * 0.38 + i * (Math.PI / 2);
    const b = t * 0.22 + i * (Math.PI / 2);
    light.position.set(Math.cos(a) * 165, Math.sin(b) * 110, Math.sin(a) * 115);
    const band = [sBass, sMid, sHigh, (sBass + sHigh) * 0.5][i];
    light.intensity = 2.5 + band * 6;
    light.color.setHSL((0.55 + t * 0.04 + i * 0.12) % 1, 1.0, 0.55);
  });
}
