import * as THREE from 'three';
import { tex, canvasTexture } from '../assets.js';
import { COMMON, U, sigilMaterial } from '../shaders.js';
import { addInteractive, updaters } from './registry.js';
import { makeFog } from './props.js';
import { CARDS } from '../content.js';

export const DECK_P = [0.352, 0.468]; // scroll range over which the ring turns through all six cards

function cardMaterial(map) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, map: { value: map }, uTilt: { value: new THREE.Vector2() }, uActive: { value: 0 }, uFade: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vWorld; varying float vDist; varying vec3 vN; varying vec3 vV;
      void main(){
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - w.xyz);
        vec4 mv = viewMatrix * w; vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${COMMON}
      uniform sampler2D map; uniform vec2 uTilt; uniform float uActive; uniform float uFade;
      varying vec2 vUv; varying vec3 vWorld; varying float vDist; varying vec3 vN; varying vec3 vV;
      void main(){
        vec4 t = texture2D(map, vUv);
        vec3 col = t.rgb * (0.42 + sceneLight(vWorld) * 0.32 + uActive * 0.14);
        float mx = max(t.r, max(t.g, t.b)), mn = min(t.r, min(t.g, t.b));
        float gold = smoothstep(0.12, 0.35, mx - mn) * step(t.b * 1.25, t.r) * smoothstep(0.08, 0.3, t.g);
        float facing = dot(vN, vV);
        float band = vUv.x * 1.2 + vUv.y * 0.8 + uTilt.x * 1.6 - uTilt.y * 1.2 + facing * 0.8;
        vec3 irid = 0.5 + 0.5 * cos(6.28318 * (band + vec3(0.0, 0.33, 0.67)));
        col += gold * irid * 0.16 * (0.3 + uActive);
        float sweep = 1.0 - smoothstep(0.0, 0.05, abs(fract(band * 0.5 - uTime * 0.07) - 0.5));
        col += sweep * (0.05 + gold * 0.22) * (0.2 + uActive);
        col = mix(col, uFogColor, fogFactor(vDist));
        gl_FragColor = vec4(col, t.a * uFade);
      }`,
    transparent: true,
  });
}

function composeFront(card) {
  const W = 768, H = 1152;
  return canvasTexture(W, H, (ctx) => {
    ctx.drawImage(tex[card.tex].image, 0, 0, W, H);
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(tex.tarot_frame.image, 0, 0, W, H);
    // title inside the banner cartouche
    const cx = W / 2, cy = 1059;
    let size = 34;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const label = card.title.toUpperCase();
    do { ctx.font = `700 ${size}px "Cinzel Decorative"`; size -= 1; } while (ctx.measureText(label).width > 390 && size > 16);
    const g = ctx.createLinearGradient(0, cy - 20, 0, cy + 20);
    g.addColorStop(0, '#fff2c4'); g.addColorStop(0.5, '#f0c668'); g.addColorStop(1, '#a8701f');
    ctx.shadowColor = 'rgba(255,170,60,0.55)'; ctx.shadowBlur = 12;
    ctx.fillStyle = g;
    ctx.fillText(label, cx, cy + 2);
    ctx.shadowBlur = 0;
    ctx.font = '700 22px "Cinzel Decorative"';
    ctx.fillStyle = 'rgba(255,230,170,0.85)';
    ctx.fillText(card.num, cx, 142);
  });
}

export function buildDeck({ onActive, onGoto }) {
  const C = new THREE.Vector3(0, 2, -140);
  const R = 6;
  const group = new THREE.Group();
  group.position.copy(C);
  group.userData.shiftX = 2.3;
  const ring = new THREE.Group();
  group.add(ring);

  const W = 3.0, H = 4.5;
  const geo = new THREE.PlaneGeometry(W, H);
  const cards = CARDS.map((card, i) => {
    const holder = new THREE.Group();
    const th = (i * Math.PI) / 3;
    holder.position.set(Math.sin(th) * R, 0, Math.cos(th) * R);
    holder.rotation.y = th;
    const flip = new THREE.Group();
    holder.add(flip);
    const frontMat = cardMaterial(composeFront(card));
    const front = new THREE.Mesh(geo, frontMat);
    const back = new THREE.Mesh(geo, cardMaterial(tex.tarot_back));
    back.rotation.y = Math.PI;
    flip.add(front, back);
    ring.add(holder);
    const hit = (m) => addInteractive(m, { cursor: true, hoverSound: 'card', onClick: () => onGoto(i) });
    hit(front); hit(back);
    return { holder, flip, front, back, card, base: Math.PI, act: 0 };
  });

  // arcane circle beneath the ring
  const sigil = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), sigilMaterial(0xf0b44a, { opacity: 0.55, spin: 0.05 }));
  sigil.rotation.x = -Math.PI / 2;
  sigil.position.y = -3.2;
  group.add(sigil);
  const sigil2 = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), sigilMaterial(0x7dff9a, { opacity: 0.07, spin: -0.02 }));
  sigil2.position.set(0, 1, -16);
  group.add(sigil2);

  makeFog(group, 0, -2.2, 2, 40, 5, 0.35, 0x4a4f78);
  makeFog(group, 0, 2, -12, 60, 16, 0.3, 0x3d3a66);

  let active = -1;
  const tilt = new THREE.Vector2(), tiltTarget = new THREE.Vector2();
  updaters.push((dt, t, s) => {
    if (!group.visible) return;
    const k = THREE.MathUtils.clamp((s.p - DECK_P[0]) / (DECK_P[1] - DECK_P[0]), 0, 1) * 5;
    ring.rotation.y = THREE.MathUtils.lerp(ring.rotation.y, (-k * Math.PI) / 3, 0.12);
    const idx = Math.round(k);
    if (idx !== active) { active = idx; onActive(idx); }
    tilt.lerp(tiltTarget.set((s.pointer.x - 0.5) * 2, (s.pointer.y - 0.5) * 2), 0.08);
    cards.forEach((c, i) => {
      const dist = Math.abs(k - i);
      const shown = 1 - THREE.MathUtils.smoothstep(dist, 0.3, 0.8);
      c.base = THREE.MathUtils.lerp(c.base, Math.PI * (1 - shown), 0.14);
      const isActive = i === idx ? 1 : 0;
      c.act = THREE.MathUtils.lerp(c.act, isActive, 0.1);
      c.flip.rotation.y = c.base + c.act * tilt.x * 0.2;
      c.holder.position.y = Math.sin(t * 0.9 + i * 1.3) * 0.12 + isActive * 0.1;
      c.flip.rotation.x = THREE.MathUtils.lerp(c.flip.rotation.x, isActive * tilt.y * 0.16, 0.1);
      c.flip.rotation.z = Math.sin(t * 0.6 + i) * 0.02;
      const act = c.front.material.uniforms.uActive;
      act.value = THREE.MathUtils.lerp(act.value, isActive, 0.1);
      c.front.material.uniforms.uTilt.value.copy(tilt);
      c.back.material.uniforms.uTilt.value.copy(tilt);
    });
  });

  return { group, cards };
}
