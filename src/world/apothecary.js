import * as THREE from 'three';
import gsap from 'gsap';
import { tex, planeFor, canvasTexture } from '../assets.js';
import { layerMaterial, flameMaterial, glowMaterial, sigilMaterial } from '../shaders.js';
import { addInteractive, updaters, lights } from './registry.js';
import { makeFog } from './props.js';
import { TIERS } from '../content.js';

const rand = (a, b) => a + Math.random() * (b - a);

// label centres measured on the 683×1024 textures
const LABELS = {
  mortal: { x: 332, y: 618, w: 205, ink: '#2b1607', sub: '#5a2e10' },
  phantom: { x: 340, y: 690, w: 190, ink: '#2b1607', sub: '#5a2e10' },
  undying: { x: 336, y: 580, w: 225, ink: '#f7d98a', sub: '#e2b35a' },
};

function potionTexture(key) {
  const img = tex[`potion_${key}`].image;
  const L = LABELS[key], tier = TIERS[key];
  return canvasTexture(img.width, img.height, (ctx) => {
    ctx.drawImage(img, 0, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let size = 34;
    do { ctx.font = `700 ${size}px "Cinzel Decorative"`; size--; } while (ctx.measureText(tier.name).width > L.w && size > 12);
    ctx.fillStyle = L.ink;
    ctx.globalAlpha = 0.9;
    ctx.fillText(tier.name, L.x, L.y - 12);
    ctx.font = '600 22px "Cinzel"';
    ctx.fillStyle = L.sub;
    ctx.fillText(tier.price, L.x, L.y + 22);
  });
}

function smokeMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: tex.smoke_wisp }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D map; uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv; void main(){ float s = texture2D(map, vUv).r; gl_FragColor = vec4(uColor * s * uOpacity, 1.0); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

function pointsMaterial(color, size) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uSize: { value: size }, uPR: { value: 1 } },
    vertexShader: `attribute float aAlpha; varying float vA; uniform float uSize; uniform float uPR;
      void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = uSize * uPR * (10.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; varying float vA;
      void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0; float ring = smoothstep(1.0, 0.75, r) * (0.35 + smoothstep(0.55, 0.95, r)); gl_FragColor = vec4(uColor * ring * vA * 1.4, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

export function buildApothecary({ onHover, onSelect, onPour }) {
  const C = new THREE.Vector3(0, 0, -320);
  const group = new THREE.Group();
  group.position.copy(C);
  group.userData.shiftX = 2.0;

  // cauldron & fire
  const CH = 5.2;
  const cauldronMat = layerMaterial(tex.cauldron, { emissive: 0.4, emMode: 1 });
  const cauldron = new THREE.Mesh(planeFor(tex.cauldron, CH), cauldronMat);
  cauldron.position.set(0, -1.6, 0);
  const surfaceY = -1.6 + (0.5 - 0.13) * CH;
  const fireBack = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 3.4), flameMaterial({ mode: 1, intensity: 1.6, colorA: 0xffd27a, colorB: 0xff3d00 }));
  fireBack.position.set(0, -2.6, -0.15);
  const fireFront = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.1), flameMaterial({ mode: 1, intensity: 1.0, colorA: 0xffc060, colorB: 0xff3d00 }));
  fireFront.position.set(0, -3.55, 0.08);
  const liquidGlow = new THREE.Mesh(new THREE.PlaneGeometry(7, 5), glowMaterial(0x7dff9a, { intensity: 0.22, power: 1.8 }));
  liquidGlow.position.set(0, surfaceY + 0.6, -0.1);
  group.add(fireBack, cauldron, fireFront, liquidGlow);
  lights.push({ obj: group, local: new THREE.Vector3(0, -2.4, 1.6), pos: new THREE.Vector3(), base: 1.4, seed: 3, zone: 'apothecary' });

  const sigil = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), sigilMaterial(0x7dff9a, { opacity: 0.5, spin: 0.05 }));
  sigil.rotation.x = -Math.PI / 2;
  sigil.position.y = -4.1;
  group.add(sigil);
  makeFog(group, 0, -3.8, 1.8, 34, 4, 0.4, 0x3f5a4a);
  makeFog(group, 0, 2, -9, 50, 16, 0.25, 0x2f3f3a);

  // bubbles
  const NB = 40;
  const bGeo = new THREE.BufferGeometry();
  const bPos = new Float32Array(NB * 3), bA = new Float32Array(NB), bSeed = Array.from({ length: NB }, () => [Math.random(), Math.random(), rand(0.4, 1.2)]);
  bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
  bGeo.setAttribute('aAlpha', new THREE.BufferAttribute(bA, 1));
  const bubbleMat = pointsMaterial(0x9dffb8, 5.5);
  const bubbles = new THREE.Points(bGeo, bubbleMat);
  bubbles.frustumCulled = false;
  group.add(bubbles);

  // steam
  const steam = Array.from({ length: 9 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), smokeMaterial(0x7dff9a));
    m.userData.off = i / 9;
    m.userData.x = rand(-1, 1);
    group.add(m);
    return m;
  });

  // splash particles
  const NS = 110;
  const sGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(NS * 3), sA = new Float32Array(NS);
  const sVel = Array.from({ length: NS }, () => new THREE.Vector3());
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute('aAlpha', new THREE.BufferAttribute(sA, 1));
  const splashMat = pointsMaterial(0x7dff9a, 7);
  const splash = new THREE.Points(sGeo, splashMat);
  splash.frustumCulled = false;
  group.add(splash);
  let splashT = 99;

  // potions
  const potions = ['mortal', 'phantom', 'undying'].map((key, i) => {
    const h = [2.3, 2.9, 3.3][i];
    const x = [-2.9, 0, 2.95][i];
    const y = [2.3, 2.75, 2.35][i];
    const mat = layerMaterial(potionTexture(key), { emissive: 0.22, emMode: 1, lit: 0.6 });
    const m = new THREE.Mesh(planeFor(tex[`potion_${key}`], h), mat);
    m.position.set(x, y, 0.6);
    m.userData.tex = tex[`potion_${key}`];
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(h * 1.6, h * 1.6), glowMaterial(TIERS[key].color, { intensity: 0.07, power: 2 }));
    glow.position.set(x, y - h * 0.1, 0.5);
    group.add(glow, m);
    const p = { key, mesh: m, glow, home: new THREE.Vector3(x, y, 0.6), hover: 0, busy: false, seed: i * 1.7 };
    addInteractive(m, {
      cursor: true,
      previewFirst: true,
      onHover: () => { p.hover = 1; onHover(key); },
      onLeave: () => { p.hover = 0; },
      onClick: () => pour(p),
    });
    return p;
  });

  const liquid = { color: new THREE.Color(0x7dff9a) };
  function pour(p) {
    if (p.busy) return;
    p.busy = true;
    onPour?.(p.key);
    const m = p.mesh;
    const dir = p.home.x > 0.1 ? 1 : p.home.x < -0.1 ? -1 : (Math.random() > 0.5 ? 1 : -1);
    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(m.position, { x: p.home.x, y: p.home.y + 2, z: p.home.z });
        gsap.set(m.rotation, { z: 0 });
        gsap.to(m.material.uniforms.uOpacity, { value: 1, duration: 1.2, delay: 1.6 });
        gsap.to(m.position, { y: p.home.y, duration: 1.6, delay: 1.6, ease: 'power3.out', onComplete: () => (p.busy = false) });
      },
    });
    tl.to(m.position, { x: dir * 0.7, y: surfaceY + 2.1, z: 0.9, duration: 0.9, ease: 'power2.inOut' })
      .to(m.rotation, { z: dir * 2.3, duration: 0.7, ease: 'back.in(1.4)' }, '-=0.35')
      .to(m.position, { y: surfaceY + 0.2, duration: 0.45, ease: 'power3.in' })
      .add(() => { doSplash(TIERS[p.key].liquid); onSelect(p.key); })
      .to(m.material.uniforms.uOpacity, { value: 0, duration: 0.25 }, '<');
  }

  function doSplash(rgb) {
    const c = new THREE.Color(...rgb);
    splashMat.uniforms.uColor.value.copy(c);
    gsap.to(liquid.color, { r: c.r, g: c.g, b: c.b, duration: 1.2 });
    const cu = cauldronMat.uniforms;
    cu.uRecolorTo.value.copy(c);
    cu.uRecolor.value = 1;
    splashT = 0;
    for (let i = 0; i < NS; i++) {
      sPos[i * 3] = rand(-0.6, 0.6); sPos[i * 3 + 1] = surfaceY; sPos[i * 3 + 2] = rand(-0.2, 0.4);
      sVel[i].set(rand(-2.6, 2.6), rand(3, 7.5), rand(-0.5, 1.8));
    }
  }

  updaters.push((dt, t) => {
    if (!group.visible) return;
    // liquid tint follows the last poured draught
    liquidGlow.material.uniforms.uColor.value.copy(liquid.color);
    bubbleMat.uniforms.uColor.value.copy(liquid.color).multiplyScalar(1.1);
    steam.forEach((m) => {
      const life = (t * 0.12 + m.userData.off) % 1;
      m.position.set(m.userData.x + Math.sin(t * 0.5 + m.userData.off * 9) * 0.4, surfaceY + 0.2 + life * 4.2, 0.2);
      m.scale.setScalar(0.6 + life * 1.6);
      m.rotation.z = life * 1.2 + m.userData.off * 6;
      m.material.uniforms.uOpacity.value = Math.sin(life * Math.PI) * 0.22;
      m.material.uniforms.uColor.value.copy(liquid.color);
    });
    for (let i = 0; i < NB; i++) {
      const [sx, sz, sp] = bSeed[i];
      const life = (t * sp * 0.6 + sx * 7.1) % 1;
      bPos[i * 3] = (sx - 0.5) * 3.0;
      bPos[i * 3 + 1] = surfaceY + 0.05 + life * 0.5;
      bPos[i * 3 + 2] = (sz - 0.5) * 0.6 + 0.3;
      bA[i] = Math.sin(life * Math.PI) * 0.9;
    }
    bGeo.attributes.position.needsUpdate = true;
    bGeo.attributes.aAlpha.needsUpdate = true;
    if (splashT < 2) {
      splashT += dt;
      for (let i = 0; i < NS; i++) {
        sVel[i].y -= 9.8 * dt;
        sPos[i * 3] += sVel[i].x * dt; sPos[i * 3 + 1] += sVel[i].y * dt; sPos[i * 3 + 2] += sVel[i].z * dt;
        sA[i] = Math.max(0, 1 - splashT / 1.4);
      }
      sGeo.attributes.position.needsUpdate = true;
      sGeo.attributes.aAlpha.needsUpdate = true;
    }
    potions.forEach((p) => {
      if (p.busy) return;
      const m = p.mesh;
      const hv = (m.userData.hv = THREE.MathUtils.lerp(m.userData.hv || 0, p.hover, 0.1));
      m.position.y = p.home.y + Math.sin(t * 1.1 + p.seed) * 0.12 + hv * 0.3;
      m.rotation.z = Math.sin(t * 0.8 + p.seed) * 0.05 + hv * Math.sin(t * 6) * 0.03;
      m.scale.setScalar(1 + hv * 0.06);
      m.material.uniforms.uEmissive.value = 0.22 + hv * 0.75;
      p.glow.position.y = m.position.y - 0.3;
      p.glow.material.uniforms.uIntensity.value = 0.07 + hv * 0.28;
    });
  });

  return { group, potions };
}
