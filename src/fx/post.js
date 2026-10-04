import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const VeilShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAspect: { value: 1 },
    uLantern: { value: new THREE.Vector2(0.5, 0.5) },
    uRadius: { value: 0.3 },
    uDark: { value: 0.35 },
    uWarp: { value: 0 },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(1, 0.95, 0.9) },
    uCA: { value: 0.0015 },
    uGrain: { value: 0.035 },
    uVignette: { value: 1.0 },
    uBlood: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uAspect; uniform vec2 uLantern; uniform float uRadius;
    uniform float uDark; uniform float uWarp; uniform float uFlash; uniform vec3 uFlashColor; uniform float uCA; uniform float uGrain; uniform float uVignette; uniform float uBlood;
    varying vec2 vUv;
    float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main(){
      vec2 uv = vUv;
      // portal warp: a spiral pull toward the centre
      vec2 c = uv - 0.5; c.x *= uAspect;
      float r = length(c);
      float w = uWarp;
      float ang = w * 5.0 * (1.0 - smoothstep(0.0, 1.1, r)) + w * sin(uTime * 2.0 + r * 12.0) * 0.08;
      float cs = cos(ang), sn = sin(ang);
      c = mat2(cs, -sn, sn, cs) * c * (1.0 - w * 0.45 * (1.0 - r));
      c.x /= uAspect;
      uv = c + 0.5;
      vec2 dir = uv - 0.5;
      float ca = uCA + w * 0.025 + uFlash * 0.01;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir * ca).b;
      // lantern: the world beyond your light is darker
      vec2 d = vUv - uLantern; d.x *= uAspect;
      float lit = 1.0 - smoothstep(uRadius * 0.25, uRadius, length(d));
      col *= mix(1.0 - uDark, 1.0 + 0.12 * uDark, lit);
      col += vec3(1.0, 0.55, 0.2) * lit * 0.015 * uDark;
      // portal glow
      col = mix(col, col * vec3(0.35, 1.0, 0.75) + vec3(0.0, 0.05, 0.03) * (1.0 - r), w * 0.7);
      col *= 1.0 - w * 0.75 * smoothstep(0.05, 0.8, r);
      // midnight blood tint
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, vec3(l * 1.3, l * 0.35, l * 0.4), uBlood * 0.35);
      // vignette
      vec2 v = vUv - 0.5; v.x *= uAspect * 0.8;
      col *= mix(1.0, smoothstep(1.05, 0.25, length(v)), uVignette);
      // flash
      col += uFlashColor * uFlash;
      // film grain
      col += (h12(vUv * vec2(1920.0, 1080.0) + fract(uTime * 17.0) * 100.0) - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function createPost(renderer, scene, camera) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.62, 0.5, 0.78);
  composer.addPass(bloom);
  const veil = new ShaderPass(VeilShader);
  composer.addPass(veil);
  composer.addPass(new OutputPass());

  function setSize(w, h, pr) {
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    bloom.setSize(w * pr * 0.5, h * pr * 0.5);
    veil.uniforms.uAspect.value = w / h;
  }
  function setSamples(n) {
    for (const rt of [composer.renderTarget1, composer.renderTarget2]) {
      if (rt.samples === n) continue;
      rt.samples = n;
      rt.dispose();
    }
  }
  return { composer, bloom, veil: veil.uniforms, setSize, setSamples };
}
