import * as THREE from 'three';
import gsap from 'gsap';
import { tex, canvasTexture } from '../assets.js';
import { layerMaterial, glowMaterial, COMMON, U } from '../shaders.js';
import { addInteractive, updaters } from './registry.js';
import { makeCandles, makeFog } from './props.js';

function letterTexture() {
  const img = tex.parchment_letter.image;
  const W = 1024, H = 1536;
  return canvasTexture(W, H, (ctx) => {
    ctx.drawImage(img, 0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const ink = 'rgba(52, 24, 8, 0.9)';
    ctx.fillStyle = 'rgba(122, 26, 16, 0.85)';
    ctx.font = '400 74px "Pinyon Script"';
    ctx.fillText('To the one who holds this letter,', W / 2, 250);
    ctx.fillStyle = ink;
    ctx.font = 'italic 400 44px "Cormorant Garamond"';
    const lines = [
      'You are hereby summoned to Hollowmere',
      'on the night of the thirty-first of October,',
      'when the veil between the living and the dead',
      'grows thin as candle smoke.',
      '',
      'Arrive by nine. Bring a lantern.',
      'Tell no one the way.',
    ];
    lines.forEach((l, i) => ctx.fillText(l, W / 2, 360 + i * 62));
    ctx.font = '600 38px "Cinzel"';
    ctx.fillStyle = 'rgba(80, 30, 10, 0.85)';
    ctx.fillText('THE DOOR WILL KNOW YOUR NAME', W / 2, 870);
    ctx.fillStyle = 'rgba(122, 26, 16, 0.85)';
    ctx.font = '400 62px "Pinyon Script"';
    ctx.fillText('— The Keeper of Hollowmere', W / 2, 980);
  });
}

/* Seal broken into jittered triangular shards that burst outward. */
function shatterGeometry(size, n = 9) {
  const pts = [];
  for (let y = 0; y <= n; y++) for (let x = 0; x <= n; x++) {
    const edge = x === 0 || y === 0 || x === n || y === n;
    const j = edge ? 0 : 0.38 / n;
    pts.push([x / n + (Math.random() - 0.5) * j * 2, y / n + (Math.random() - 0.5) * j * 2]);
  }
  const pos = [], uv = [], center = [], rnd = [], bary = [];
  const P = (x, y) => pts[y * (n + 1) + x];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const a = P(x, y), b = P(x + 1, y), c = P(x + 1, y + 1), d = P(x, y + 1);
    const tris = Math.random() > 0.5 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
    for (const tri of tris) {
      const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
      const r = [Math.random(), Math.random(), Math.random()];
      tri.forEach((v, k) => {
        pos.push((v[0] - 0.5) * size, (v[1] - 0.5) * size, 0);
        uv.push(v[0], v[1]);
        center.push((cx - 0.5) * size, (cy - 0.5) * size, 0);
        rnd.push(...r);
        bary.push(k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0);
      });
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aCenter', new THREE.Float32BufferAttribute(center, 3));
  g.setAttribute('aRand', new THREE.Float32BufferAttribute(rnd, 3));
  g.setAttribute('aBary', new THREE.Float32BufferAttribute(bary, 3));
  return g;
}

function sealMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, map: { value: tex.wax_seal }, uBreak: { value: 0 }, uCrack: { value: 0 }, uHover: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform float uBreak;
      attribute vec3 aCenter; attribute vec3 aRand; attribute vec3 aBary;
      varying vec2 vUv; varying vec3 vBary; varying vec3 vWorld; varying float vDist;
      mat2 r2(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
      void main(){
        vUv = uv; vBary = aBary;
        vec3 p = position - aCenter;
        float t = uBreak;
        float spin = t * (aRand.z * 10.0 - 5.0);
        p.xy = r2(spin) * p.xy;
        p.yz = r2(spin * 0.8) * p.yz;
        vec3 dir = normalize(vec3(aCenter.xy + (aRand.xy - 0.5) * 0.35, 0.25 + aRand.z * 0.9));
        vec3 c = aCenter + dir * t * (2.2 + aRand.x * 3.5) + vec3(0.0, -3.5 * t * t, 0.0);
        p = c + p * (1.0 - t * 0.4);
        vec4 w = modelMatrix * vec4(p, 1.0);
        vWorld = w.xyz;
        vec4 mv = viewMatrix * w; vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${COMMON}
      uniform sampler2D map; uniform float uBreak; uniform float uCrack; uniform float uHover;
      varying vec2 vUv; varying vec3 vBary; varying vec3 vWorld; varying float vDist;
      void main(){
        vec4 t = texture2D(map, vUv);
        if(t.a < 0.1) discard;
        vec3 col = t.rgb * (0.4 + sceneLight(vWorld) * 0.4 + uHover * 0.2);
        float e = min(vBary.x, min(vBary.y, vBary.z));
        float crack = (1.0 - smoothstep(0.0, 0.05, e)) * max(uCrack, uHover * (0.25 + 0.2 * sin(uTime * 8.0)));
        col += vec3(1.0, 0.45, 0.1) * crack * 2.5;
        col = mix(col, uFogColor, fogFactor(vDist));
        gl_FragColor = vec4(col, t.a * (1.0 - smoothstep(0.55, 1.0, uBreak)));
      }`,
    transparent: true,
    side: THREE.DoubleSide,
  });
}

export function buildInvitation({ onOpen, onBreak }) {
  const C = new THREE.Vector3(0, 1.4, -380);
  const group = new THREE.Group();
  group.position.copy(C);
  group.userData.shiftX = 2.2;

  const letterGroup = new THREE.Group();
  group.add(letterGroup);
  const letter = new THREE.Mesh(new THREE.PlaneGeometry(4, 6), layerMaterial(letterTexture(), { lit: 0.35, tint: 0xd8cfc4 }));
  letterGroup.add(letter);
  const backGlow = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), glowMaterial(0xff8a3a, { intensity: 0.12, power: 1.8 }));
  backGlow.position.z = -0.5;
  group.add(backGlow);

  const sealMat = sealMaterial();
  const seal = new THREE.Mesh(shatterGeometry(1.35), sealMat);
  seal.position.set(0, -1.72, 0.05);
  seal.userData.tex = tex.wax_seal;
  letterGroup.add(seal);

  makeCandles(group, -3.4, -2.4, 0.6, 2.2, 'invitation');
  makeCandles(group, 3.5, -2.5, 0.4, 1.9, 'invitation', true);
  makeFog(group, 0, -3.2, 1.5, 30, 4, 0.35, 0x5a3f4a);
  makeFog(group, 0, 2, -8, 50, 14, 0.22, 0x3a2433);

  let broken = false, hover = 0;
  addInteractive(seal, {
    cursor: true,
    hoverSound: 'seal',
    onHover: () => { hover = 1; },
    onLeave: () => { hover = 0; },
    onClick: () => breakSeal(),
  });
  addInteractive(letter, { cursor: true, onClick: () => (broken ? onOpen() : breakSeal()) });

  function breakSeal() {
    if (broken) { onOpen(); return; }
    broken = true;
    onBreak?.();
    const u = sealMat.uniforms;
    gsap.timeline()
      .to(u.uCrack, { value: 1, duration: 0.35, ease: 'power2.in' })
      .to(u.uBreak, { value: 1, duration: 1.3, ease: 'power2.out' })
      .to(letterGroup.position, { z: 2.2, y: 0.2, duration: 1.2, ease: 'power3.inOut' }, 0.5)
      .to(letterGroup.rotation, { x: -0.1, duration: 1.2, ease: 'power3.inOut' }, 0.5)
      .add(() => onOpen(), 1.1);
    return true;
  }

  function reset() {
    if (!broken) return;
    broken = false;
    const u = sealMat.uniforms;
    gsap.to(letterGroup.position, { z: 0, y: 0, duration: 1.2, ease: 'power3.inOut' });
    gsap.to(letterGroup.rotation, { x: 0, duration: 1.2 });
    gsap.to(u.uBreak, { value: 0, duration: 1.4, delay: 0.3, ease: 'power3.inOut' });
    gsap.to(u.uCrack, { value: 0, duration: 1.4, delay: 0.8 });
  }

  updaters.push((dt, t) => {
    if (!group.visible) return;
    hover = broken ? 0 : hover;
    sealMat.uniforms.uHover.value = THREE.MathUtils.lerp(sealMat.uniforms.uHover.value, hover, 0.12);
    letter.rotation.y = Math.sin(t * 0.5) * 0.04;
    letter.position.y = Math.sin(t * 0.7) * 0.06;
    seal.position.y = -1.72 + letter.position.y;
    seal.rotation.y = letter.rotation.y;
  });

  return { group, breakSeal, reset, isBroken: () => broken };
}
