// ─── 2D Navier-Stokes fluid simulation ───────────────────────────────────────
// Mouse movement injects velocity into the field. The velocity advects a
// density texture. Wherever density > 0 the scene renders as a colour-negative,
// creating a flowing "reveal" trail that follows the cursor and dissipates.
//
// Pipeline each frame:
//   splat (mouse force + density) → advect velocity → divergence →
//   pressure (Jacobi iterations) → gradient subtract → advect density →
//   composite (scene ⊕ negative, blended by density)
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE   from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
function rt(w, h) {
  return new THREE.WebGLRenderTarget(w, h, {
    minFilter:  THREE.LinearFilter,
    magFilter:  THREE.LinearFilter,
    format:     THREE.RGBAFormat,
    type:       THREE.HalfFloatType,
    depthBuffer: false,
  });
}

const BASE_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
`;

// ── Shader sources ────────────────────────────────────────────────────────────
const ADVECT_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D tVel;
  uniform sampler2D tSrc;
  uniform vec2      px;       // 1/sim_size
  uniform float     dt;
  uniform float     decay;
  varying vec2 vUv;
  void main() {
    vec2 vel = texture2D(tVel, vUv).xy;
    vec2 pos = vUv - dt * vel;
    gl_FragColor = decay * texture2D(tSrc, clamp(pos, px, 1.0 - px));
  }
`;

const SPLAT_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D tSrc;
  uniform vec2      point;    // cursor UV (0..1)
  uniform vec3      color;    // force or density amount
  uniform float     radius;
  uniform float     aspect;
  varying vec2 vUv;
  void main() {
    vec2  d = vUv - point;
    d.x *= aspect;
    float gauss = exp(-dot(d, d) / radius);
    gl_FragColor = texture2D(tSrc, vUv) + vec4(color * gauss, 0.0);
  }
`;

const DIV_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D tVel;
  uniform vec2      px;
  varying vec2 vUv;
  void main() {
    float L = texture2D(tVel, vUv - vec2(px.x, 0.0)).x;
    float R = texture2D(tVel, vUv + vec2(px.x, 0.0)).x;
    float B = texture2D(tVel, vUv - vec2(0.0, px.y)).y;
    float T = texture2D(tVel, vUv + vec2(0.0, px.y)).y;
    gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
  }
`;

const PRESSURE_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D tPress;
  uniform sampler2D tDiv;
  uniform vec2      px;
  varying vec2 vUv;
  void main() {
    float L = texture2D(tPress, vUv - vec2(px.x, 0.0)).r;
    float R = texture2D(tPress, vUv + vec2(px.x, 0.0)).r;
    float B = texture2D(tPress, vUv - vec2(0.0, px.y)).r;
    float T = texture2D(tPress, vUv + vec2(0.0, px.y)).r;
    float d = texture2D(tDiv,   vUv).r;
    gl_FragColor = vec4((L + R + B + T - d) * 0.25, 0.0, 0.0, 1.0);
  }
`;

const GRAD_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D tPress;
  uniform sampler2D tVel;
  uniform vec2      px;
  varying vec2 vUv;
  void main() {
    float L = texture2D(tPress, vUv - vec2(px.x, 0.0)).r;
    float R = texture2D(tPress, vUv + vec2(px.x, 0.0)).r;
    float B = texture2D(tPress, vUv - vec2(0.0, px.y)).r;
    float T = texture2D(tPress, vUv + vec2(0.0, px.y)).r;
    vec2 vel = texture2D(tVel, vUv).xy - 0.5 * vec2(R - L, T - B);
    gl_FragColor = vec4(vel, 0.0, 1.0);
  }
`;

// Final compositing pass added to EffectComposer.
// tDiffuse = normal scene (from previous pass)
// tFluid   = fluid density texture (updated each frame)
//
// Effect: chromatic aberration (RGB channel split) scaled by density,
// plus a soft additive glow in the trail colour.
const COMPOSITE_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D tDiffuse;
  uniform sampler2D tFluid;
  varying vec2 vUv;

  void main() {
    float density = texture2D(tFluid, vUv).r;
    float mask    = smoothstep(0.008, 0.45, density) * 0.42;

    // Chromatic aberration — R drifts right, B drifts left, G stays centre
    float split = density * 0.014;
    float r = texture2D(tDiffuse, vUv + vec2( split, 0.0)).r;
    float g = texture2D(tDiffuse, vUv).g;
    float b = texture2D(tDiffuse, vUv - vec2( split, 0.0)).b;
    vec3 chroma = vec3(r, g, b);

    // Additive glow — teal/cyan smear, kept subtle
    vec3 glow = vec3(0.18, 0.68, 1.0) * density * 0.55;

    vec4 scene   = texture2D(tDiffuse, vUv);
    vec3 result  = mix(scene.rgb, chroma, mask) + glow * mask;
    gl_FragColor = vec4(result, scene.a);
  }
`;

// ── FluidEffect class ─────────────────────────────────────────────────────────
export class FluidEffect {
  constructor(renderer, { simRes = 256, pressureIter = 20 } = {}) {
    this.renderer      = renderer;
    this.W             = simRes;
    this.H             = simRes;
    this.pressureIter  = pressureIter;

    const px = new THREE.Vector2(1 / this.W, 1 / this.H);

    // Ping-pong targets
    this.vel0  = rt(this.W, this.H); this.vel1  = rt(this.W, this.H);
    this.den0  = rt(this.W, this.H); this.den1  = rt(this.W, this.H);
    this.prs0  = rt(this.W, this.H); this.prs1  = rt(this.W, this.H);
    this.divRT = rt(this.W, this.H);

    // Full-screen quad for passes
    this._cam   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this._scene = new THREE.Scene();
    this._quad  = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this._scene.add(this._quad);

    // ── Materials ──────────────────────────────────────────────────────────────
    this._advect = new THREE.ShaderMaterial({
      uniforms: {
        tVel:  { value: null }, tSrc: { value: null },
        px:    { value: px   }, dt:   { value: 0.016 }, decay: { value: 1.0 },
      },
      vertexShader: BASE_VERT, fragmentShader: ADVECT_FRAG,
    });

    this._splat = new THREE.ShaderMaterial({
      uniforms: {
        tSrc:   { value: null },
        point:  { value: new THREE.Vector2(0.5, 0.5) },
        color:  { value: new THREE.Vector3() },
        radius: { value: 0.003 },
        aspect: { value: 1.0 },
      },
      vertexShader: BASE_VERT, fragmentShader: SPLAT_FRAG,
    });

    this._div = new THREE.ShaderMaterial({
      uniforms: { tVel: { value: null }, px: { value: px } },
      vertexShader: BASE_VERT, fragmentShader: DIV_FRAG,
    });

    this._press = new THREE.ShaderMaterial({
      uniforms: {
        tPress: { value: null }, tDiv: { value: null }, px: { value: px },
      },
      vertexShader: BASE_VERT, fragmentShader: PRESSURE_FRAG,
    });

    this._grad = new THREE.ShaderMaterial({
      uniforms: {
        tPress: { value: null }, tVel: { value: null }, px: { value: px },
      },
      vertexShader: BASE_VERT, fragmentShader: GRAD_FRAG,
    });

    // The ShaderPass that gets added to EffectComposer
    this._pass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        tFluid:   { value: null },
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: COMPOSITE_FRAG,
    });
  }

  // ── Internal render-to-target helper ─────────────────────────────────────────
  _run(mat, target) {
    this._quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this._scene, this._cam);
  }

  // ── Inject mouse force + density at (u, v) in 0..1 coords ────────────────────
  // du / dv = normalised mouse delta this frame
  splat(u, v, du, dv) {
    const aspect = window.innerWidth / window.innerHeight;
    const force  = 18;      // gentle push — prevents vortex ring / mushroom
    const velRad = 0.0018;  // small injection point
    const denRad = 0.0010;  // tight density core

    // ── Velocity splat ──
    this._splat.uniforms.tSrc.value   = this.vel0.texture;
    this._splat.uniforms.point.value.set(u, v);
    this._splat.uniforms.color.value.set(du * force, dv * force, 0);
    this._splat.uniforms.radius.value  = velRad;
    this._splat.uniforms.aspect.value  = aspect;
    this._run(this._splat, this.vel1);
    [this.vel0, this.vel1] = [this.vel1, this.vel0];

    // ── Density splat ──
    this._splat.uniforms.tSrc.value   = this.den0.texture;
    this._splat.uniforms.color.value.set(1.1, 1.1, 1.1);
    this._splat.uniforms.radius.value  = denRad;
    this._run(this._splat, this.den1);
    [this.den0, this.den1] = [this.den1, this.den0];
  }

  // ── Full simulation step (call once per frame) ────────────────────────────────
  step() {
    // 1. Advect velocity (slight decay to prevent energy build-up)
    this._advect.uniforms.tVel.value   = this.vel0.texture;
    this._advect.uniforms.tSrc.value   = this.vel0.texture;
    this._advect.uniforms.decay.value  = 0.92;  // fast decay kills vortex rings before mushrooming
    this._run(this._advect, this.vel1);
    [this.vel0, this.vel1] = [this.vel1, this.vel0];

    // 2. Divergence of velocity field
    this._div.uniforms.tVel.value = this.vel0.texture;
    this._run(this._div, this.divRT);

    // 3. Pressure solve (Jacobi iterations)
    for (let i = 0; i < this.pressureIter; i++) {
      this._press.uniforms.tPress.value = this.prs0.texture;
      this._press.uniforms.tDiv.value   = this.divRT.texture;
      this._run(this._press, this.prs1);
      [this.prs0, this.prs1] = [this.prs1, this.prs0];
    }

    // 4. Subtract pressure gradient (makes field divergence-free / incompressible)
    this._grad.uniforms.tPress.value = this.prs0.texture;
    this._grad.uniforms.tVel.value   = this.vel0.texture;
    this._run(this._grad, this.vel1);
    [this.vel0, this.vel1] = [this.vel1, this.vel0];

    // 5. Advect density (higher decay = faster fade-out)
    this._advect.uniforms.tVel.value   = this.vel0.texture;
    this._advect.uniforms.tSrc.value   = this.den0.texture;
    this._advect.uniforms.decay.value  = 0.962;
    this._run(this._advect, this.den1);
    [this.den0, this.den1] = [this.den1, this.den0];

    // Done — restore renderer state
    this.renderer.setRenderTarget(null);

    // Feed latest density into the composite pass
    this._pass.uniforms.tFluid.value = this.den0.texture;
  }

  // Returns the ShaderPass to add to EffectComposer
  get pass() { return this._pass; }
}
