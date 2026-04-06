// ─── Logo OBJ loading + beat-triggered flip ───────────────────────────────────
import * as THREE from 'three';
import { OBJLoader }      from 'three/addons/loaders/OBJLoader.js';
import { mergeVertices }  from 'three/addons/utils/BufferGeometryUtils.js';
import { LoopSubdivision } from 'https://cdn.jsdelivr.net/npm/three-subdivide/build/index.module.js';
import { scene, camera }  from './scene.js';
import { buildGlassMaterial } from './material.js';

export let objModel    = null;
export let baseScale   = 1;

let spinState    = null;  // { axis, duration, elapsed, origQuat } while spinning
let spinCooldown = 0;     // seconds until next spin is allowed

export function buildOBJ() {
  const mat = buildGlassMaterial();

  new OBJLoader().load(
    'models/lmns_logo_convex.obj',
    (obj) => {
      const box    = new THREE.Box3().setFromObject(obj);
      const ctr    = box.getCenter(new THREE.Vector3());
      const size   = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      baseScale = 130 / maxDim;
      obj.scale.setScalar(baseScale);
      // obj.position stays at (0,0,0) — centering baked into geometry vertices
      // so rotation always pivots around the true geometric centre.

      obj.traverse(child => {
        if (!child.isMesh) return;
        try {
          let geo = mergeVertices(child.geometry);
          geo = LoopSubdivision.modify(geo, 2);
          geo.translate(-ctr.x, -ctr.y, -ctr.z);
          child.geometry = geo;
        } catch (e) {
          console.warn('Subdivision skipped:', e.message);
        }
        child.material      = mat;
        child.castShadow    = true;
        child.receiveShadow = true;
      });

      objModel = obj;
      scene.add(obj);
    },
    undefined,
    err => console.error('OBJ load error:', err)
  );
}

// Called every frame — handles cooldown tick and active spin animation.
// isMegaBeat: true on an exceptionally strong transient.
export function updateLogo(dt, isMegaBeat) {
  spinCooldown = Math.max(0, spinCooldown - dt);

  // Trigger a new flip on a mega-beat when idle and cooldown has expired
  if (isMegaBeat && spinCooldown <= 0 && !spinState && objModel) {
    const ax = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5
    ).normalize();

    spinState    = {
      axis:     ax,
      duration: 0.85 + Math.random() * 0.3,
      elapsed:  0,
      origQuat: objModel.quaternion.clone(),
    };
    spinCooldown = 14.0;
  }

  // Animate the active spin
  if (spinState && objModel) {
    spinState.elapsed += dt;
    const prog = Math.min(1, spinState.elapsed / spinState.duration);
    // Cubic ease-in-out — fast middle, snappy ends
    const ease  = prog < 0.5
      ? 4 * prog * prog * prog
      : 1 - Math.pow(-2 * prog + 2, 3) / 2;
    const angle = ease * Math.PI * 2;

    objModel.quaternion.copy(spinState.origQuat);
    objModel.quaternion.multiply(
      new THREE.Quaternion().setFromAxisAngle(spinState.axis, angle)
    );

    if (prog >= 1) {
      objModel.quaternion.copy(spinState.origQuat);  // snap clean to origin
      spinState = null;
    }
  }
}
