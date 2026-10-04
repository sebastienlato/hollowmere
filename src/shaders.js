import * as THREE from 'three';

/* Shared uniforms: every material references the SAME uniform objects,
   so updating U.x.value once per frame propagates everywhere. */
export const U = {
  uTime: { value: 0 },
  uLantern: { value: new THREE.Vector4(0, 0, 0, 0) },
  uLanternColor: { value: new THREE.Color(1.0, 0.58, 0.26) },
  uLanternRange: { value: 10 },
  uLights: { value: Array.from({ length: 12 }, () => new THREE.Vector4(0, -999, 0, 0)) },
  uLightColor: { value: new THREE.Color(1.0, 0.45, 0.12) },
  uAmbient: { value: new THREE.Color(0.62, 0.66, 0.85) },
  uFogColor: { value: new THREE.Color('#0b0d1c') },
  uFogDensity: { value: 0.016 },
  uLanternScreen: { value: new THREE.Vector2(0.5, 0.5) },
  uRevealRadius: { value: 0.2 },
  uRevealBoost: { value: 0 },
  uAspect: { value: 1.6 },
  uViewport: { value: new THREE.Vector2(1, 1) },
};

export const COMMON = /* glsl */ `
uniform float uTime;
uniform vec4 uLantern; uniform vec3 uLanternColor; uniform float uLanternRange;
uniform vec4 uLights[12]; uniform vec3 uLightColor;
uniform vec3 uAmbient;
uniform vec3 uFogColor; uniform float uFogDensity;
uniform vec2 uLanternScreen; uniform float uRevealRadius; uniform float uRevealBoost; uniform float uAspect;
uniform vec2 uViewport;

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float s = 0., a = .5; for(int i = 0; i < 5; i++){ s += a*vnoise(p); p = p*2.03 + 17.1; a *= .5; } return s; }
mat2 rot2(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

vec3 sceneLight(vec3 wp){
  vec3 l = uAmbient;
  float d = distance(wp, uLantern.xyz);
  float a = clamp(1.0 - d / uLanternRange, 0.0, 1.0);
  l += uLanternColor * uLantern.w * a * a;
  for(int i = 0; i < 12; i++){
    vec4 L = uLights[i];
    float dd = distance(wp, L.xyz);
    float aa = clamp(1.0 - dd / 7.5, 0.0, 1.0);
    l += uLightColor * L.w * aa * aa;
  }
  return l;
}
float fogFactor(float dist){ float f = uFogDensity * dist; return 1.0 - exp(-f * f); }
float lanternReveal(){
  vec2 sp = gl_FragCoord.xy / uViewport;
  vec2 d = sp - uLanternScreen; d.x *= uAspect;
  return max(1.0 - smoothstep(uRevealRadius * 0.25, uRevealRadius, length(d)), uRevealBoost);
}
`;

const VERT = /* glsl */ `
uniform float uTime; uniform float uSway; uniform float uSeed;
varying vec2 vUv; varying vec3 vWorld; varying float vDist;
void main(){
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  float h = uv.y;
  w.x += sin(uTime * 0.7 + uSeed * 6.2831 + w.y * 0.15) * uSway * h * h;
  w.z += cos(uTime * 0.53 + uSeed * 4.0) * uSway * 0.4 * h * h;
  vWorld = w.xyz;
  vec4 mv = viewMatrix * w;
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

/* ── Lit cut-out layer ── */
export function layerMaterial(map, o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...U,
      map: { value: map },
      uOpacity: { value: o.opacity ?? 1 },
      uTint: { value: new THREE.Color(o.tint ?? 0xffffff) },
      uEmissive: { value: o.emissive ?? 0 },
      uEmMode: { value: o.emMode ?? 0 },
      uEmColor: { value: new THREE.Color(o.emColor ?? 0xffffff) },
      uReveal: { value: o.reveal ? 1 : 0 },
      uLit: { value: o.lit ?? 1 },
      uFogAmt: { value: o.fog ?? 1 },
      uSway: { value: o.sway ?? 0 },
      uSeed: { value: o.seed ?? Math.random() },
      uRecolor: { value: 0 },
      uRecolorTo: { value: new THREE.Color(0x7dff9a) },
    },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      ${COMMON}
      uniform sampler2D map; uniform float uOpacity; uniform vec3 uTint; uniform float uEmissive; uniform float uEmMode; uniform vec3 uEmColor;
      uniform float uReveal; uniform float uLit; uniform float uFogAmt; uniform float uRecolor; uniform vec3 uRecolorTo;
      varying vec2 vUv; varying vec3 vWorld; varying float vDist;
      void main(){
        vec4 tex = texture2D(map, vUv);
        float alpha = tex.a * uOpacity;
        if(uReveal > 0.5) alpha *= lanternReveal();
        if(alpha < 0.004) discard;
        vec3 base = tex.rgb;
        // liquid recolour (green brew → chosen potion colour)
        float gm = smoothstep(0.05, 0.25, base.g - max(base.r, base.b));
        float l0 = dot(base, vec3(.299,.587,.114));
        base = mix(base, uRecolorTo * l0 * 2.2, gm * uRecolor);
        vec3 col = base * uTint * mix(vec3(1.0), sceneLight(vWorld), uLit);
        float lum = dot(base, vec3(.299,.587,.114));
        float mx = max(base.r, max(base.g, base.b)), mn = min(base.r, min(base.g, base.b));
        float warm = clamp((base.r - base.b) * 2.2, 0.0, 1.0);
        float sat = smoothstep(0.15, 0.5, mx - mn);
        float mask = mix(smoothstep(0.30, 0.75, lum) * warm, smoothstep(0.12, 0.6, lum) * sat, uEmMode);
        float fl = 0.7 + 0.3 * vnoise(vUv * 16.0 + vec2(uTime * 2.3, uTime * 1.7));
        col += base * uEmColor * mask * uEmissive * fl * 1.8;
        col = mix(col, uFogColor, fogFactor(vDist) * uFogAmt);
        gl_FragColor = vec4(col, alpha);
      }`,
    transparent: true,
    depthWrite: false,
    side: o.side ?? THREE.FrontSide,
  });
}

/* ── Additive spectral ghost (black background images) ── */
export function ghostMaterial(map, o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, map: { value: map }, uOpacity: { value: o.opacity ?? 1 }, uTint: { value: new THREE.Color(o.tint ?? 0xffffff) }, uReveal: { value: o.reveal === false ? 0 : 1 }, uSway: { value: 0 }, uSeed: { value: Math.random() } },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      ${COMMON}
      uniform sampler2D map; uniform float uOpacity; uniform vec3 uTint; uniform float uReveal;
      varying vec2 vUv; varying vec3 vWorld; varying float vDist;
      void main(){
        vec2 uv = vUv;
        uv.x += sin(uv.y * 9.0 + uTime * 1.3) * 0.006 * uv.y;
        vec3 c = texture2D(map, uv).rgb;
        float r = uReveal > 0.5 ? lanternReveal() : 1.0;
        float f = 1.0 - fogFactor(vDist) * 0.8;
        float shimmer = 0.85 + 0.15 * sin(uTime * 3.0 + uv.y * 20.0);
        gl_FragColor = vec4(c * uTint * uOpacity * r * f * shimmer * 1.35, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/* ── Drifting volumetric fog sheet ── */
export function fogMaterial(map, o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...U, map: { value: map }, uOpacity: { value: o.opacity ?? 0.5 }, uSpeed: { value: new THREE.Vector2(o.speed ?? 0.012, 0.002) },
      uScale: { value: o.scale ?? 1.4 }, uTint: { value: new THREE.Color(o.tint ?? 0x8a93b8) }, uSeed: { value: Math.random() * 10 }, uSway: { value: 0 },
    },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      ${COMMON}
      uniform sampler2D map; uniform float uOpacity; uniform vec2 uSpeed; uniform float uScale; uniform vec3 uTint; uniform float uSeed;
      varying vec2 vUv; varying vec3 vWorld; varying float vDist;
      void main(){
        vec2 uv = vUv * vec2(uScale * 1.6, uScale) + uSeed;
        float n1 = texture2D(map, uv + uTime * uSpeed).r;
        float n2 = texture2D(map, uv * 1.7 - uTime * uSpeed * 0.6 + 0.37).r;
        float n = smoothstep(0.1, 0.95, n1 * 0.7 + n2 * 0.5 - 0.1);
        float edge = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x) * smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.45, vUv.y);
        float near = smoothstep(1.0, 6.0, vDist);
        vec3 col = uTint * sceneLight(vWorld);
        float a = n * edge * near * uOpacity * (1.0 - fogFactor(vDist) * 0.5);
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true,
    depthWrite: false,
  });
}

/* ── Ground: cobbled path winding through dark moss ── */
export const pathX = (z) => Math.sin(z * 0.06) * 1.6;
export function groundMaterial(map, o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, map: { value: map }, uPath: { value: o.path ?? 1 }, uSway: { value: 0 }, uSeed: { value: 0 }, uDirt: { value: new THREE.Color(o.dirt ?? 0x6b7360) } },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      ${COMMON}
      uniform sampler2D map; uniform float uPath; uniform vec3 uDirt;
      varying vec2 vUv; varying vec3 vWorld; varying float vDist;
      void main(){
        vec2 w = vWorld.xz;
        vec3 cob = texture2D(map, w / 3.4).rgb;
        vec3 dirt = texture2D(map, w / 8.0 + 0.37).rgb;
        dirt = mix(vec3(dot(dirt, vec3(.33))), dirt, 0.4) * uDirt;
        float n = fbm(w * 0.3);
        float px = sin(vWorld.z * 0.06) * 1.6;
        float dp = abs(vWorld.x - px);
        float m = (1.0 - smoothstep(1.7 + n * 0.9, 2.8 + n * 1.2, dp)) * uPath;
        vec3 alb = mix(dirt * (0.6 + 0.7 * n), cob * 0.95, m);
        vec3 col = alb * sceneLight(vWorld + vec3(0.0, 0.8, 0.0));
        col = mix(col, uFogColor, fogFactor(vDist));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

/* ── Procedural flame (candle = mode 0, fire bed = mode 1) ── */
export function flameMaterial(o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...U, uMode: { value: o.mode ?? 0 }, uIntensity: { value: o.intensity ?? 1.4 }, uSeedF: { value: Math.random() * 10 },
      uColorA: { value: new THREE.Color(o.colorA ?? 0xfff1c0) }, uColorB: { value: new THREE.Color(o.colorB ?? 0xff5a0a) },
    },
    vertexShader: /* glsl */ `varying vec2 vUv; varying float vDist; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      ${COMMON}
      uniform float uMode; uniform float uIntensity; uniform float uSeedF; uniform vec3 uColorA; uniform vec3 uColorB;
      varying vec2 vUv; varying float vDist;
      void main(){
        vec2 uv = vUv; float t = uTime * 2.6 + uSeedF;
        vec3 col; float a;
        if(uMode < 0.5){
          float y = uv.y;
          float sway = (fbm(vec2(y * 2.5 - t, uSeedF)) - 0.5) * 0.35 * y;
          float x = uv.x - 0.5 - sway;
          float width = 0.24 * pow(max(1.0 - y, 0.0), 0.9) * smoothstep(0.0, 0.22, y);
          float core = 1.0 - smoothstep(width * 0.1, width, abs(x));
          core *= smoothstep(1.0, 0.4, y) * smoothstep(0.02, 0.12, y);
          float halo = exp(-length(vec2(x * 2.2, (y - 0.3) * 1.3)) * 5.0) * 0.35;
          col = mix(uColorB, uColorA, pow(core, 1.5)) * (core + halo);
          a = 1.0;
        } else {
          float n = fbm(vec2(uv.x * 5.0 + uSeedF, uv.y * 2.6 - t * 1.3));
          float n2 = fbm(vec2(uv.x * 9.0 - uSeedF, uv.y * 4.0 - t * 2.0));
          float edge = smoothstep(0.0, 0.25, uv.x) * smoothstep(1.0, 0.75, uv.x);
          float f = (n * 1.25 + n2 * 0.35) - uv.y * 1.25 + 0.05;
          f = clamp(f * edge * 2.2, 0.0, 1.0);
          col = mix(uColorB * 0.6, uColorA, f * f) * f;
          a = 1.0;
        }
        col *= uIntensity * (1.0 - fogFactor(vDist) * 0.8);
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/* ── Soft radial glow sprite ── */
export function glowMaterial(color, o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uColor: { value: new THREE.Color(color) }, uIntensity: { value: o.intensity ?? 1 }, uPower: { value: o.power ?? 2.4 }, uFlick: { value: o.flicker ?? 0 }, uSeedG: { value: Math.random() * 10 } },
    vertexShader: /* glsl */ `varying vec2 vUv; varying float vDist; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      ${COMMON}
      uniform vec3 uColor; uniform float uIntensity; uniform float uPower; uniform float uFlick; uniform float uSeedG;
      varying vec2 vUv; varying float vDist;
      void main(){
        float r = length(vUv - 0.5) * 2.0;
        float g = pow(max(1.0 - r, 0.0), uPower);
        float fl = 1.0 - uFlick * (0.5 - 0.5 * vnoise(vec2(uTime * 7.0, uSeedG)));
        gl_FragColor = vec4(uColor * g * uIntensity * fl * (1.0 - fogFactor(vDist) * 0.7), 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/* ── Arcane sigil circle (flat, additive) ── */
export function sigilMaterial(color, o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uColor: { value: new THREE.Color(color) }, uOpacity: { value: o.opacity ?? 0.8 }, uSpin: { value: o.spin ?? 0.06 } },
    vertexShader: /* glsl */ `varying vec2 vUv; varying float vDist; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      ${COMMON}
      uniform vec3 uColor; uniform float uOpacity; uniform float uSpin;
      varying vec2 vUv; varying float vDist;
      float ring(float r, float R, float w){ return smoothstep(w, 0.0, abs(r - R)); }
      float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
      void main(){
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        float rotA = uTime * uSpin;
        vec2 q = rot2(rotA) * p;
        float a = atan(q.y, q.x);
        float s = ring(r, 0.96, 0.012) + ring(r, 0.91, 0.006) + ring(r, 0.64, 0.008) + ring(r, 0.6, 0.004) + ring(r, 0.22, 0.006);
        float f = fract(a / 6.28318 * 96.0);
        s += step(0.91, r) * step(r, 0.96) * (1.0 - smoothstep(0.0, 0.1, abs(f - 0.5))) * 0.8;
        // heptagram {7/3}
        vec2 q2 = rot2(-rotA * 2.0) * p;
        float dmin = 10.0;
        for(int i = 0; i < 7; i++){
          float a0 = float(i) * 6.28318 / 7.0;
          float a1 = float(i + 3) * 6.28318 / 7.0;
          dmin = min(dmin, seg(q2, 0.6 * vec2(cos(a0), sin(a0)), 0.6 * vec2(cos(a1), sin(a1))));
        }
        s += smoothstep(0.008, 0.0, dmin) * 0.9;
        // runes band
        float cell = floor(a / 6.28318 * 36.0);
        float rune = step(0.45, hash12(vec2(cell, 3.0)));
        float fr = fract(a / 6.28318 * 36.0);
        float band = step(0.7, r) * step(r, 0.84);
        float glyph = band * rune * (1.0 - smoothstep(0.0, 0.06, abs(fr - 0.5) - 0.18)) * step(0.5, hash12(vec2(cell, floor(r * 40.0))));
        s += glyph * 0.6;
        // moon dots
        float mc = floor(a / 6.28318 * 12.0);
        float ma = (mc + 0.5) / 12.0 * 6.28318;
        vec2 mp = 0.775 * vec2(cos(ma), sin(ma));
        s += smoothstep(0.03, 0.02, length(q - mp)) * 0.8;
        float pulse = 0.75 + 0.25 * sin(uTime * 1.6 - r * 6.0);
        float fade = smoothstep(1.0, 0.94, r);
        vec3 col = uColor * s * pulse * fade * uOpacity * (1.0 - fogFactor(vDist) * 0.7);
        col += uColor * exp(-r * 3.0) * 0.08 * uOpacity;
        gl_FragColor = vec4(col, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

/* ── Flapping wings (bats / crows), instanced ── */
export function flapMaterial(map, o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, map: { value: map }, uFlapAmp: { value: o.amp ?? 1.1 }, uOpacity: { value: 1 }, uLitF: { value: o.lit ?? 1 }, uFogAmt: { value: o.fog ?? 1 } },
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uFlapAmp;
      attribute float aPhase; attribute float aSpeed;
      varying vec2 vUv; varying vec3 vWorld; varying float vDist;
      void main(){
        vUv = uv;
        vec3 p = position;
        float s = abs(p.x);
        float flap = sin(uTime * aSpeed + aPhase);
        float ang = flap * uFlapAmp * smoothstep(0.03, 0.5, s);
        p.x = sign(p.x) * s * cos(ang);
        p.z = s * sin(ang) * 0.9;
        p.y += flap * 0.04;
        vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
        vWorld = w.xyz;
        vec4 mv = viewMatrix * w;
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${COMMON}
      uniform sampler2D map; uniform float uOpacity; uniform float uLitF; uniform float uFogAmt;
      varying vec2 vUv; varying vec3 vWorld; varying float vDist;
      void main(){
        vec4 t = texture2D(map, vUv);
        if(t.a < 0.05) discard;
        vec3 col = t.rgb * mix(vec3(1.0), sceneLight(vWorld), uLitF);
        col = mix(col, uFogColor, fogFactor(vDist) * uFogAmt);
        gl_FragColor = vec4(col, t.a * uOpacity);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/* ── Ambient particles: embers / spectral motes, world-anchored infinite box ── */
export function particleMaterial(o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...U, uCam: { value: new THREE.Vector3() }, uBox: { value: o.box ?? 40 }, uSize: { value: o.size ?? 5 }, uPR: { value: 1 },
      uMix: { value: 0 }, uOpacity: { value: 1 }, uRise: { value: o.rise ?? 1 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime; uniform vec3 uCam; uniform float uBox; uniform float uSize; uniform float uPR; uniform float uRise;
      attribute vec3 aSeed;
      varying float vA; varying vec3 vSeed; varying float vDist;
      void main(){
        vec3 p = position;
        p.y += uTime * (0.006 + aSeed.x * 0.012) * uRise;
        p.x += sin(uTime * 0.35 + aSeed.y * 6.28) * 0.012;
        p.z += cos(uTime * 0.27 + aSeed.z * 6.28) * 0.012;
        vec3 base = p * uBox;
        vec3 wp = uCam + mod(base - uCam + uBox * 0.5, uBox) - uBox * 0.5;
        vec4 mv = viewMatrix * vec4(wp, 1.0);
        vDist = -mv.z;
        float edge = 1.0 - smoothstep(uBox * 0.3, uBox * 0.5, length(wp - uCam));
        vA = edge * (0.4 + 0.6 * sin(uTime * (1.5 + aSeed.z * 3.0) + aSeed.x * 20.0) * 0.5 + 0.3);
        vSeed = aSeed;
        gl_PointSize = uSize * uPR * (0.4 + aSeed.z) * (12.0 / max(vDist, 0.5));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uMix; uniform float uOpacity; uniform vec3 uFogColor; uniform float uFogDensity;
      varying float vA; varying vec3 vSeed; varying float vDist;
      void main(){
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float g = pow(max(1.0 - r, 0.0), 2.2);
        vec3 ember = mix(vec3(1.0, 0.35, 0.05), vec3(1.0, 0.75, 0.3), vSeed.y);
        vec3 spirit = mix(vec3(0.45, 1.0, 0.7), vec3(0.6, 0.8, 1.0), vSeed.y);
        vec3 col = mix(ember, spirit, uMix);
        float f = uFogDensity * vDist; f = exp(-f * f);
        gl_FragColor = vec4(col * g * vA * uOpacity * (0.3 + 0.7 * f) * 1.6, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
