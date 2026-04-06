# LMNS — Audio Visualizer

A real-time WebGL audio visualizer built with Three.js. The scene reacts to system audio captured via the browser — shader modes switch on drum hits, the camera tempo-syncs to the groove, and everything slows to near-stillness in silence.

![lmns visualizer](https://raw.githubusercontent.com/placeholder/lmns/main/preview.png)

---

## Features

### Logo
- 3D OBJ mesh with a thick-glass PBR shader — transmission, iridescence, clearcoat, and a procedural scratch normal map
- **20 shader modes** that crossfade on every detected drum hit: Glass, Electric, Aurora, Embers, Hologram, Lava, Prism, Glitch, Nebula, Fire, Water, Ice, Neon, Acid, Gold, Void, Lightning, Oil Slick, Smoke, Sun
- Each mode has one audio-reactive variable (bass controls flame height in Fire, mids control curtain speed in Aurora, etc.)
- On very strong transients, the logo performs a full 360° flip on a random axis with cubic ease-in-out

### Camera
- Orbits on a tilted diagonal path — not a flat horizontal ring
- Speed and direction driven by audio energy (`groove` signal)
- Camera pulls back on every beat (zoom shock), then floats back in
- Mouse tilt: looking slightly toward the cursor position
- All motion slows to near-zero in silence and surges on beats

### Planets
- 20 spheres with procedural textures (6 types: Rocky, Ice, Gas Giant, Lava, Ocean, Desert)
- Kepler-ish orbital mechanics — inner planets orbit faster
- Each planet has a unique tilted orbit plane (inclination + ascending node)
- Fading trail lines covering ~65% of each orbital period
- Independent slow axial spin, decoupled from orbit speed
- All orbits surge together on drum hits via a shared `orbitPulse` signal

### Audio Reactivity
- System audio captured via `getDisplayMedia` — works with any tab, app, or music player
- **Spectral flux onset detection** — fires on kicks, snares, and hi-hats (not bass-only)
- Double-smoothed shader uniforms prevent per-frame pulsing
- Musical time: shader animations run slow in silence, fast during energetic passages
- Beat cooldown of ~1s prevents rapid-fire mode switching on busy tracks

### Effects
- **Star field** — 3620 points across three size layers on a sphere shell at radius 1400–1900
- **Shockwave rings** — expand outward from the logo on every beat, pool of 6
- **Comet streaks** — shoot across the star field on beats and randomly (~1 per 8s)
- **Camera shake** — intensity scales with hit strength, decays in ~150ms
- **Fluid cursor** — 2D Navier-Stokes simulation; moving the cursor creates a chromatic aberration + teal glow trail that swirls and dissipates like spilled water

---

## Tech Stack

- **Three.js r160** via CDN importmap (ES modules, no bundler)
- `MeshPhysicalMaterial` with `onBeforeCompile` GLSL injection for all shader modes
- `EffectComposer` + `UnrealBloomPass` for post-processing
- `RGBELoader` + `PMREMGenerator` for HDRI environment (Polyhaven studio_small_09)
- `LoopSubdivision` (three-subdivide) — 4× mesh density on the logo
- Custom 2D fluid solver: advection → divergence → Jacobi pressure (20 iter) → gradient subtract

---

## File Structure

```
lmns/
├── index.html
├── models/
│   └── lmns_logo_convex.obj
├── css/
│   ├── normalize.css
│   ├── main_codedrops.css   # Illuminate button styles
│   └── main.css
└── js/
    ├── main.js              # Entry point, boot, tagline
    ├── animate.js           # Main loop, beat detection, camera
    ├── audio.js             # getDisplayMedia, FFT, spectral flux
    ├── scene.js             # Renderer, camera, composer, HDRI
    ├── material.js          # Glass material + all 20 GLSL shader modes
    ├── logo.js              # OBJ loading, subdivision, flip animation
    ├── planets.js           # Procedural textures, orbital mechanics, trails
    ├── effects.js           # Star field, shockwave rings, comets
    ├── fluid.js             # Navier-Stokes fluid cursor effect
    ├── lights.js            # Scene lighting
    ├── utils.js             # lerp, sliceAvg
    ├── buttons.js           # Illuminate button animation
    └── TweenMax.min.js      # GSAP (button animation dependency)
```

---

## Running Locally

No build step required — the project uses native ES modules with a CDN importmap.

Because `getDisplayMedia` requires a secure context, you need to serve over HTTPS or `localhost`. The simplest way:

```bash
# Python
python -m http.server 8080

# Node
npx serve .
```

Then open `http://localhost:8080`.

> **Audio:** click **Illuminate**, share a browser tab or system audio when prompted, then play music in that tab. The visualizer reacts to whatever is playing.

---

## Browser Support

Requires a browser with:
- WebGL 2
- ES Modules + Import Maps
- `getDisplayMedia` with audio capture

Chrome and Edge work best. Firefox supports everything except system audio capture via `getDisplayMedia` (tab audio works).

---

## License

MIT
