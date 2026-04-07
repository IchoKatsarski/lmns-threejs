// ─── Glass material — procedural scratch map + 20 GLSL shader modes ──────────
import * as THREE from 'three';

// Internal ref set by onBeforeCompile; accessed via updateShaderUniforms()
let _uniforms = null;

export function updateShaderUniforms(bass, mid, high, time, mode) {
  if (!_uniforms) return;
  _uniforms.uBass.value = bass;
  _uniforms.uMid.value  = mid;
  _uniforms.uHigh.value = high;
  _uniforms.uTime.value = time;
  _uniforms.uMode.value = mode;
}

// ── Emissive pulse ─────────────────────────────────────────────────────────────
// Call triggerEmissivePulse on mega-beat; call updateEmissivePulse every frame.
let _emissivePulse = 0;

export function triggerEmissivePulse(strength = 1) {
  _emissivePulse = Math.min(3, _emissivePulse + strength);
}

export function updateEmissivePulse() {
  _emissivePulse *= 0.88;
  if (_uniforms) _uniforms.uEmissivePulse.value = _emissivePulse;
}

// ── Procedural scratch normal map ─────────────────────────────────────────────
function buildScratchNormalMap(size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgb(128,128,255)';
  ctx.fillRect(0, 0, size, size);

  // Fine random scratches
  for (let i = 0; i < 280; i++) {
    const x     = Math.random() * size;
    const y     = Math.random() * size;
    const len   = 12 + Math.random() * 90;
    const angle = Math.random() * Math.PI;
    const dev   = 138 + Math.floor(Math.random() * 22);
    ctx.strokeStyle = `rgb(${dev},${dev},255)`;
    ctx.lineWidth   = 0.25 + Math.random() * 0.75;
    ctx.globalAlpha = 0.15 + Math.random() * 0.45;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
  // Deeper gouges
  for (let i = 0; i < 18; i++) {
    const x     = Math.random() * size;
    const y     = Math.random() * size;
    const len   = 40 + Math.random() * 160;
    const angle = Math.random() * Math.PI;
    ctx.strokeStyle = 'rgb(160,160,255)';
    ctx.lineWidth   = 0.8 + Math.random() * 1.2;
    ctx.globalAlpha = 0.12 + Math.random() * 0.22;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

// ── GLSL: 20 mode functions + dispatcher ──────────────────────────────────────
const GLSL_MODES = /* glsl */`
varying vec3 vWPos;
varying vec3 vWNorm;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uMode;

// Mode 0: Glass — domain-warped caustics + thin-film rainbow
// KEY: bass → caustic spatial scale
vec3 _mode0(vec3 wp,vec3 vd,vec3 n,float t,float bass,float mid,float high){
  float scale=0.038-bass*0.022;
  vec3 p=wp*scale;
  float wx=sin(p.y*3.10+t*0.38)*0.45+sin(p.z*2.30+t*0.25)*0.30;
  float wy=sin(p.x*2.70+t*0.45)*0.45+sin(p.z*3.50+t*0.18)*0.30;
  float wz=sin(p.x*2.10+t*0.28)*0.45+sin(p.y*2.90+t*0.35)*0.30;
  p+=vec3(wx,wy,wz)*0.55;
  float r=pow(max(0.0,sin(p.x*5.20+t*0.14)*sin(p.y*4.10)*sin(p.z*3.50)*0.5+0.5),6.0);
  float g=pow(max(0.0,sin(p.x*4.80+t*0.20)*sin(p.y*4.50)*sin(p.z*4.10)*0.5+0.5),6.0);
  float b=pow(max(0.0,sin(p.x*5.50+t*0.11)*sin(p.y*3.90)*sin(p.z*4.30)*0.5+0.5),6.0);
  vec3 caustic=vec3(r,g,b)*0.55*(0.12+mid*0.4+high*0.3);
  float ndv=max(0.0,dot(n,vd));
  float a=(1.0-ndv)*12.0+t*0.07;
  vec3 film;
  film.r=pow(abs(sin(a*1.00+0.00)),1.8);
  film.g=pow(abs(sin(a*1.06+2.09)),1.8);
  film.b=pow(abs(sin(a*1.12+4.19)),1.8);
  film*=pow(1.0-ndv,2.5)*0.9*(0.4+high*0.5);
  return caustic+film;
}

// Mode 1: Electric plasma — sharp cyan/white arcs
// KEY: bass → arc sharpness
vec3 _mode1(vec3 wp,vec3 vd,vec3 n,float t,float bass,float mid,float high){
  vec3 p=wp*0.045;
  float arc=sin(p.x*9.0+t*1.4)*sin(p.y*7.5+t*1.1)*sin(p.z*11.0+t*1.7);
  float sharpness=5.0+bass*10.0;
  arc=pow(max(0.0,arc),sharpness)*4.0;
  float edge=pow(1.0-max(0.0,dot(n,vd)),2.0);
  vec3 col=mix(vec3(0.0,0.4,1.0),vec3(0.7,0.95,1.0),arc);
  return col*arc*(0.3+bass*0.9)+vec3(0.0,0.3,0.9)*edge*(0.25+mid*0.5);
}

// Mode 2: Aurora — flowing green/violet/teal curtains
// KEY: mid → curtain wave speed
vec3 _mode2(vec3 wp,vec3 vd,vec3 n,float t,float bass,float mid,float high){
  vec3 p=wp*0.018;
  float spd=0.28+mid*0.45;
  float w1=sin(p.y*4.2+p.x*1.8+t*spd)*sin(p.z*3.1+t*spd*0.9);
  float w2=sin(p.x*3.3+p.z*2.2+t*spd*1.3)*sin(p.y*3.8+t*spd*0.7);
  float rv=pow(max(0.0,w1*0.5+0.5),2.5)*0.35;
  float gv=pow(max(0.0,w2*0.5+0.5),2.0)*0.95;
  float bv=pow(max(0.0,(w1+w2)*0.25+0.5),2.2)*0.75;
  vec3 col=vec3(rv+bv*0.3,gv+bv*0.4,bv+rv*0.2)*0.9;
  return col*(0.3+mid*0.7+bass*0.4);
}

// Mode 3: Embers — orange/red edge glow with flicker
// KEY: bass → fresnel power
vec3 _mode3(vec3 wp,vec3 vd,vec3 n,float t,float bass,float mid,float high){
  float ndv=max(0.0,dot(n,vd));
  float fresnelPow=3.5-bass*2.5;
  float edge=pow(1.0-ndv,max(0.5,fresnelPow));
  vec3 p=wp*0.038;
  float flk=sin(p.x*6.2+t*2.3)*sin(p.y*5.1+t*1.9)*0.5+0.5;
  flk=pow(flk,2.2);
  vec3 ember=mix(vec3(1.0,0.12,0.0),vec3(1.0,0.65,0.05),flk);
  return ember*(edge*1.2+flk*0.3)*(0.4+bass*0.9+high*0.4);
}

// Mode 4: Hologram — cyan scanlines + fresnel flicker
// KEY: high → scanline density
vec3 _mode4(vec3 wp,vec3 vd,vec3 n,float t,float bass,float mid,float high){
  float density=0.7+high*4.5;
  float scan=pow(sin(wp.y*density+t*2.2)*0.5+0.5,3.0);
  float ndv=max(0.0,dot(n,vd));
  float edge=pow(1.0-ndv,1.8);
  float flicker=sin(t*17.3)*0.06+0.94;
  float glitch=step(0.97,fract(sin(floor(wp.y*0.25+t*6.0)*47.3)*5321.9));
  vec3 col=vec3(0.05,0.8,1.0)*(scan*0.35+edge*0.6)*flicker;
  col+=vec3(0.6,1.0,1.0)*glitch*0.6;
  return col*(0.4+bass*0.7+high*0.4);
}

// Mode 5: Lava lamp — slow organic blobs, purple→magenta→orange
// KEY: bass → blob edge contrast
vec3 _mode5(vec3 wp,vec3 vd,vec3 n,float t,float bass,float mid,float high){
  vec3 p=wp*0.014;
  float b1=sin(p.x*2.1+t*0.22)*sin(p.y*1.9+t*0.17)*sin(p.z*2.4+t*0.20);
  float b2=sin(p.x*1.6+t*0.30+1.5)*sin(p.y*2.4+t*0.26)*sin(p.z*1.8+t*0.14);
  float blob=b1*0.55+b2*0.35+0.5;
  float edge=0.15+bass*0.28;
  vec3 c0=vec3(0.35,0.0,0.75);
  vec3 c1=vec3(0.9,0.0,0.5);
  vec3 c2=vec3(1.0,0.30,0.05);
  vec3 col=mix(c0,c1,smoothstep(0.5-edge,0.5+edge,blob));
  col=mix(col,c2,smoothstep(0.7-edge,0.7+edge,blob));
  return col*0.9*(0.4+bass*0.6+mid*0.4);
}

// Mode 6: Prism bands — hard rainbow arcs, audio-speed
// KEY: bass → band cycle speed
vec3 _mode6(vec3 wp,vec3 vd,vec3 n,float t,float bass,float mid,float high){
  float ndv=max(0.0,dot(n,vd));
  float band=(1.0-ndv)*9.0+t*(0.6+bass*2.5);
  vec3 col;
  col.r=pow(abs(sin(band*1.0+0.000)),1.4);
  col.g=pow(abs(sin(band*1.0+2.094)),1.4);
  col.b=pow(abs(sin(band*1.0+4.189)),1.4);
  return col*1.1*(0.3+high*0.5+bass*0.4);
}

// Mode 7: Glitch — RGB split blocks + corruption scanlines
// KEY: bass → RGB split distance
vec3 _mode7(vec3 wp,vec3 vd,vec3 n,float t,float bass,float mid,float high){
  vec3 p=wp*0.05;
  float sp=bass*0.10+0.02;
  vec3 bk =floor(p*7.0+t*2.5)/7.0;
  vec3 bkR=floor((p+vec3(sp,0,0))*7.0+t*2.5)/7.0;
  vec3 bkB=floor((p-vec3(sp,0,0))*7.0+t*2.5)/7.0;
  float rv=step(0.82,fract(sin(dot(bkR,vec3(127.1,311.7,74.3)))*43758.5));
  float gv=step(0.82,fract(sin(dot(bk ,vec3(269.5,183.3,173.3)))*43758.5));
  float bv=step(0.82,fract(sin(dot(bkB,vec3(113.5,271.9,124.6)))*43758.5));
  float corrupt=step(0.95,fract(sin(floor(wp.y*0.28+t*9.0)*45.1)*5679.9));
  vec3 col=vec3(rv,gv,bv)*1.2+vec3(0.0,1.0,0.4)*corrupt*0.8;
  return col*(0.35+bass*0.8+high*0.3);
}

// Mode 8: Nebula — volumetric dark space with star points
// KEY: mid → cloud density
vec3 _mode8(vec3 wp,vec3 vd,vec3 n,float t,float bass,float mid,float high){
  vec3 p=wp*0.020;
  float n1=sin(p.x*3.2+t*0.11)*sin(p.y*2.8+t*0.09)*sin(p.z*3.6+t*0.10);
  float n2=sin(p.x*5.3+t*0.17+p.y)*sin(p.y*4.9+t*0.13)*sin(p.z*6.2+t*0.15);
  float neb=n1*0.6+n2*0.4;
  float threshold=-0.3+mid*0.5;
  float star=pow(max(0.0,sin(p.x*18.0)*sin(p.y*24.0)*sin(p.z*20.0)),14.0)*3.5;
  vec3 col=mix(vec3(0.04,0.0,0.14),vec3(0.55,0.08,0.88),smoothstep(threshold,0.5,neb));
  col=mix(col,vec3(0.0,0.45,1.0),smoothstep(0.3,0.85,neb));
  col+=vec3(1.0,0.92,0.85)*star;
  return col*(0.4+mid*0.7+bass*0.35);
}

// Mode 9: Fire — upward flickering flames
// KEY: bass → flame height
vec3 _mode9(vec3 wp,vec3 vd,vec3 n,float t,float bass,float mid,float high){
  vec3 p=wp*0.022;
  float turb=sin(p.x*4.2+t*1.1)*sin(p.z*3.8+t*0.9);
  turb+=sin(p.x*8.5+t*1.8+turb*1.2)*sin(p.z*7.0+t*1.4)*0.5;
  float lift=bass*0.6;
  float flame=clamp(p.y*0.6+turb*0.35+0.55+lift,0.0,1.0);
  vec3 col=mix(vec3(0.7,0.0,0.0),vec3(1.0,0.38,0.0),flame);
  col=mix(col,vec3(1.0,0.88,0.15),pow(flame,2.2));
  float ndv=max(0.0,dot(n,vd));
  col*=(0.7+pow(1.0-ndv,1.5)*0.5);
  return col*(0.35+bass*0.9+high*0.3);
}

// Mode 10: Water — overlapping ripples + caustic shimmer
// KEY: bass → wave choppiness
vec3 _mode10(vec3 wp,vec3 vd,vec3 n,float t,float bass,float mid,float high){
  vec3 p=wp*0.018;
  float w1=sin(p.x*5.2+p.z*3.1+t*1.1);
  float w2=sin(p.x*3.3-p.z*4.2+t*0.85+1.3);
  float w3=sin(length(p.xz)*6.5-t*1.4);
  float wave=(w1+w2+w3)/3.0*0.5+0.5;
  float choppiness=1.0+bass*5.0;
  vec3 deep=vec3(0.0,0.12,0.38);
  vec3 shallow=vec3(0.05,0.55,0.85);
  vec3 col=mix(deep,shallow,wave);
  col=mix(col,vec3(0.65,0.88,1.0),pow(wave,choppiness));
  float caust=pow(max(0.0,sin(p.x*13.0+t*2.1)*sin(p.z*11.0+t*1.9)),6.0);
  col+=vec3(0.4,0.75,1.0)*caust*0.3;
  return col*(0.38+mid*0.6+bass*0.45);
}

// Mode 11: Ice — cold crystalline fresnel + crack veins
// KEY: high → crack prominence
vec3 _mode11(vec3 wp,vec3 vd,vec3 n,float t,float bass,float mid,float high){
  float ndv=max(0.0,dot(n,vd));
  float fresnel=pow(1.0-ndv,3.5);
  float crackPow=9.0-high*7.0;
  float crack=pow(abs(sin(dot(wp,vec3(3.7,2.1,4.3))*0.04+t*0.04)),max(1.0,crackPow));
  vec3 col=mix(vec3(0.38,0.65,0.95),vec3(0.88,0.96,1.0),ndv);
  col+=vec3(0.55,0.82,1.0)*fresnel*1.0;
  col+=vec3(0.9,0.97,1.0)*crack*0.5;
  return col*(0.32+high*0.45+bass*0.25);
}

// Mode 12: Neon — silhouette edge glow, hue cycles with music
// KEY: bass → glow width
vec3 _mode12(vec3 wp,vec3 vd,vec3 n,float t,float bass,float mid,float high){
  float ndv=max(0.0,dot(n,vd));
  float glowPow=5.0-bass*3.5;
  float edge=pow(1.0-ndv,max(0.8,glowPow));
  float h=fract(t*0.12+bass*0.25);
  float h6=h*6.0;
  vec3 neon=clamp(vec3(abs(h6-3.0)-1.0,2.0-abs(h6-2.0),2.0-abs(h6-4.0)),0.0,1.0);
  return neon*(edge*1.4+pow(1.0-ndv,10.0)*0.6)*(0.4+mid*0.65+high*0.45);
}

// Mode 13: Acid — domain-warped full-spectrum rainbow
// KEY: bass → warp strength
vec3 _mode13(vec3 wp,vec3 vd,vec3 n,float t,float bass,float mid,float high){
  vec3 p=wp*0.014;
  float wx=sin(p.y*3.1+t*0.45)*sin(p.z*2.6+t*0.32);
  float wy=sin(p.x*2.9+t*0.38)*sin(p.z*3.3+t*0.55);
  float warp=0.3+bass*1.4;
  p+=vec3(wx,wy,wx+wy)*warp;
  float h=fract(length(p)*1.8+t*0.28+mid*0.3);
  float h6=h*6.0;
  vec3 col=clamp(vec3(abs(h6-3.0)-1.0,2.0-abs(h6-2.0),2.0-abs(h6-4.0)),0.0,1.0);
  return col*(0.45+mid*0.7+high*0.35);
}

// Mode 14: Gold — warm swirling metallic sheen
// KEY: mid → swirl speed
vec3 _mode14(vec3 wp,vec3 vd,vec3 n,float t,float bass,float mid,float high){
  float ndv=max(0.0,dot(n,vd));
  vec3 p=wp*0.028;
  float spd=0.14+mid*0.25;
  float swirl=sin(p.x*4.1+p.y*3.2+t*spd)*sin(p.y*3.6+p.z*2.6+t*spd*0.8);
  swirl=swirl*0.5+0.5;
  vec3 gold=mix(vec3(0.55,0.35,0.03),vec3(1.0,0.78,0.18),swirl);
  gold+=vec3(1.0,0.92,0.5)*pow(ndv,7.0)*1.5;
  gold+=vec3(0.75,0.55,0.08)*pow(1.0-ndv,3.0)*0.4;
  return gold*(0.38+bass*0.5+mid*0.35);
}

// Mode 15: Void — dark purple with glowing tendrils
// KEY: bass → tendril spatial frequency
vec3 _mode15(vec3 wp,vec3 vd,vec3 n,float t,float bass,float mid,float high){
  float freq=1.0+bass*1.2;
  vec3 p=wp*0.020;
  float v1=sin(p.x*6.2*freq+t*0.28)*sin(p.y*5.1*freq+t*0.22)*sin(p.z*7.3*freq+t*0.18);
  float v2=sin(p.x*9.5*freq-t*0.35+p.z)*sin(p.y*8.2*freq+t*0.30);
  float vein=pow(max(0.0,v1*v2),4.0)*5.5;
  float edge=pow(1.0-max(0.0,dot(n,vd)),5.0);
  vec3 col=mix(vec3(0.04,0.0,0.10),vec3(0.42,0.0,0.88),vein);
  col+=vec3(0.18,0.0,0.45)*edge;
  return col*(0.38+bass*0.75+mid*0.45);
}

// Mode 16: Lightning — sharp stochastic white arcs
// KEY: bass → bolt firing rate
vec3 _mode16(vec3 wp,vec3 vd,vec3 n,float t,float bass,float mid,float high){
  vec3 p=wp*0.038;
  float bolt=sin(p.x*7.2+floor(t*7.0+bass*3.5)*1.9)*sin(p.y*9.1+floor(t*7.0)*2.4);
  bolt+=sin(p.x*14.0+p.y*5.5+floor(t*11.0)*3.3)*0.5;
  bolt=pow(max(0.0,bolt),9.0)*5.0;
  float flash=step(0.93,fract(sin(floor(t*5.0+bass*2.5)*47.3)*5321.9));
  float edge=pow(1.0-max(0.0,dot(n,vd)),2.0);
  vec3 col=vec3(0.6,0.8,1.0)*bolt+vec3(1.0)*flash*0.35+vec3(0.2,0.45,1.0)*edge*0.25;
  return col*(0.3+bass*1.0+high*0.5);
}

// Mode 17: Oil slick — dark surface iridescence
// KEY: mid → film thickness / colour shift
vec3 _mode17(vec3 wp,vec3 vd,vec3 n,float t,float bass,float mid,float high){
  float ndv=max(0.0,dot(n,vd));
  vec3 p=wp*0.018;
  float drift=sin(p.x*2.8+t*0.09)*sin(p.z*2.3+t*0.07);
  float thickness=5.0+mid*8.0;
  float film=(1.0-ndv)*thickness+drift*1.8+t*0.05;
  vec3 col;
  col.r=pow(abs(sin(film*0.88+0.0)),2.0);
  col.g=pow(abs(sin(film*0.94+2.09)),2.0);
  col.b=pow(abs(sin(film*1.00+4.19)),2.0);
  col*=pow(1.0-ndv,1.2)*1.4;
  return col*(0.38+high*0.55+mid*0.35);
}

// Mode 18: Smoke — layered grey wisps drifting upward
// KEY: mid → drift speed
vec3 _mode18(vec3 wp,vec3 vd,vec3 n,float t,float bass,float mid,float high){
  float spd=0.18+mid*0.30;
  vec3 p=wp*0.016;
  float s1=sin(p.x*2.4+t*spd)*sin(p.y*1.9-t*spd*1.2)*sin(p.z*2.8+t*spd*0.8);
  float s2=sin(p.x*4.3+t*spd*1.5+s1*0.8)*sin(p.y*3.8-t*spd*1.6)*sin(p.z*4.6+t*spd*1.1);
  float smoke=clamp(s1*0.6+s2*0.3+0.5,0.0,1.0);
  vec3 col=mix(vec3(0.08,0.08,0.12),vec3(0.68,0.72,0.82),pow(smoke,1.4));
  float edge=pow(1.0-max(0.0,dot(n,vd)),2.2)*0.4;
  col+=vec3(0.55,0.60,0.75)*edge;
  return col*(0.32+mid*0.55+bass*0.28);
}

// Mode 19: Sun — convective granulation + audio-driven solar flares
// KEY: bass → flare eruption strength
vec3 _mode19(vec3 wp,vec3 vd,vec3 n,float t,float bass,float mid,float high){
  vec3 p=wp*0.022;
  float g1=sin(p.x*5.2+t*0.09)*sin(p.y*4.8+t*0.07)*sin(p.z*5.5+t*0.08);
  float g2=sin(p.x*9.4+t*0.16+g1*0.9)*sin(p.y*8.8+t*0.12)*sin(p.z*10.1+t*0.14);
  float gran=g1*0.6+g2*0.35;
  gran=gran*0.5+0.5;
  vec3 dark =vec3(0.52,0.06,0.0);
  vec3 warm =vec3(1.0,0.32,0.02);
  vec3 hot  =vec3(1.0,0.80,0.22);
  vec3 surf =mix(dark,warm,smoothstep(0.20,0.60,gran));
  surf      =mix(surf,hot, smoothstep(0.62,0.90,gran));
  float ndv =max(0.0,dot(n,vd));
  float corona=pow(1.0-ndv,3.2);
  float fn  =sin(p.x*13.0+t*0.60)*sin(p.y*11.5+t*0.52)*sin(p.z*14.0+t*0.68);
  float flare=pow(max(0.0,fn),5.0)*corona*(0.6+bass*4.5);
  vec3 col  =surf*(0.38+gran*0.32);
  col       +=vec3(1.0,0.42,0.04)*corona*(0.28+bass*0.65);
  col       +=vec3(1.0,0.58,0.08)*flare*1.6;
  return col*(0.50+bass*0.50+mid*0.18);
}

// Dispatcher — smooth blend between two adjacent modes.
// Uses else-if + explicit init so ANGLE/HLSL can prove the variable is always set.
vec3 _modeColor(float m,vec3 wp,vec3 vd,vec3 n,float t,float bass,float mid,float high){
  vec3 c=vec3(0.0);
       if(m< 0.5) c=_mode0 (wp,vd,n,t,bass,mid,high);
  else if(m< 1.5) c=_mode1 (wp,vd,n,t,bass,mid,high);
  else if(m< 2.5) c=_mode2 (wp,vd,n,t,bass,mid,high);
  else if(m< 3.5) c=_mode3 (wp,vd,n,t,bass,mid,high);
  else if(m< 4.5) c=_mode4 (wp,vd,n,t,bass,mid,high);
  else if(m< 5.5) c=_mode5 (wp,vd,n,t,bass,mid,high);
  else if(m< 6.5) c=_mode6 (wp,vd,n,t,bass,mid,high);
  else if(m< 7.5) c=_mode7 (wp,vd,n,t,bass,mid,high);
  else if(m< 8.5) c=_mode8 (wp,vd,n,t,bass,mid,high);
  else if(m< 9.5) c=_mode9 (wp,vd,n,t,bass,mid,high);
  else if(m<10.5) c=_mode10(wp,vd,n,t,bass,mid,high);
  else if(m<11.5) c=_mode11(wp,vd,n,t,bass,mid,high);
  else if(m<12.5) c=_mode12(wp,vd,n,t,bass,mid,high);
  else if(m<13.5) c=_mode13(wp,vd,n,t,bass,mid,high);
  else if(m<14.5) c=_mode14(wp,vd,n,t,bass,mid,high);
  else if(m<15.5) c=_mode15(wp,vd,n,t,bass,mid,high);
  else if(m<16.5) c=_mode16(wp,vd,n,t,bass,mid,high);
  else if(m<17.5) c=_mode17(wp,vd,n,t,bass,mid,high);
  else if(m<18.5) c=_mode18(wp,vd,n,t,bass,mid,high);
  else             c=_mode19(wp,vd,n,t,bass,mid,high);
  return c;
}
`;

// ── Material factory ──────────────────────────────────────────────────────────
export function buildGlassMaterial() {
  const mat = new THREE.MeshPhysicalMaterial({
    color:                     new THREE.Color(0xffffff),
    transmission:              1.0,
    thickness:                 4.0,
    ior:                       1.75,
    roughness:                 0.0,
    metalness:                 0.0,
    iridescence:               1.0,
    iridescenceIOR:            1.38,
    iridescenceThicknessRange: [80, 500],
    clearcoat:                 1.0,
    clearcoatRoughness:        0.02,
    envMapIntensity:           2.5,
    normalMap:                 buildScratchNormalMap(),
    normalScale:               new THREE.Vector2(0.18, 0.18),
    side:                      THREE.FrontSide,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uBass          = { value: 0.0 };
    shader.uniforms.uMid           = { value: 0.0 };
    shader.uniforms.uHigh          = { value: 0.0 };
    shader.uniforms.uDispScale     = { value: 0.0 };  // deformer off
    shader.uniforms.uTime          = { value: 0.0 };
    shader.uniforms.uMode          = { value: 0.0 };
    shader.uniforms.uEmissivePulse = { value: 0.0 };
    _uniforms = shader.uniforms;

    // Vertex — noise helpers + world-space varyings
    shader.vertexShader = shader.vertexShader.replace(
      'void main() {',
      `uniform float uBass;
       uniform float uMid;
       uniform float uHigh;
       uniform float uDispScale;
       uniform float uTime;
       varying vec3 vWPos;
       varying vec3 vWNorm;

       float _h(vec3 p){
         p=fract(p*vec3(443.8975,397.2973,491.1871));
         p+=dot(p.zxy,p.yxz+19.19);
         return fract(p.x*p.y*p.z);
       }
       float _n(vec3 x){
         vec3 i=floor(x),f=fract(x);
         f=f*f*(3.0-2.0*f);
         return mix(
           mix(mix(_h(i),_h(i+vec3(1,0,0)),f.x),
               mix(_h(i+vec3(0,1,0)),_h(i+vec3(1,1,0)),f.x),f.y),
           mix(mix(_h(i+vec3(0,0,1)),_h(i+vec3(1,0,1)),f.x),
               mix(_h(i+vec3(0,1,1)),_h(i+vec3(1,1,1)),f.x),f.y),f.z);
       }

       void main() {`
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vec3 _np=normalize(position);
       float _disp=
         uBass*uDispScale      *_n(_np*2.0 +vec3(uTime*0.30))
        +uMid *uDispScale*0.50 *_n(_np*5.5 +vec3(uTime*0.55,uTime*0.40,0.0))
        +uHigh*uDispScale*0.20 *_n(_np*11.0+vec3(uTime*1.40));
       transformed+=normalize(objectNormal)*_disp;`
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
       vWPos =(modelMatrix*vec4(position,1.0)).xyz;
       vWNorm=normalize(mat3(modelMatrix)*normal);`
    );

    // Fragment — prepend all mode functions, inject blend into emissive
    shader.fragmentShader = GLSL_MODES + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      'uniform float uMode;',
      'uniform float uMode;\nuniform float uEmissivePulse;'
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       vec3 _vd  = normalize(cameraPosition - vWPos);
       vec3 _n   = normalize(vWNorm);
       float _m  = mod(uMode, 20.0);
       float _mA = floor(_m);
       float _mB = mod(_mA + 1.0, 20.0);
       float _f  = fract(_m);
       float _bl = _f < 0.5 ? 2.0*_f*_f : 1.0-2.0*(1.0-_f)*(1.0-_f);
       vec3 _colA = _modeColor(_mA, vWPos, _vd, _n, uTime, uBass, uMid, uHigh);
       vec3 _colB = _modeColor(_mB, vWPos, _vd, _n, uTime, uBass, uMid, uHigh);
       vec3 _modeCol = mix(_colA, _colB, _bl);
       // Emissive pulse: briefly brightens the logo from within on mega-beat
       totalEmissiveRadiance += _modeCol * (1.0 + uEmissivePulse * 1.8);`
    );
  };

  return mat;
}
