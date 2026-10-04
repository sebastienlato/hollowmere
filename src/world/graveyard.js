import * as THREE from 'three';
import { tex, planeFor, canvasTexture } from '../assets.js';
import { layerMaterial, groundMaterial, glowMaterial, ghostMaterial } from '../shaders.js';
import { addInteractive, updaters, lights, spirits } from './registry.js';
import { makeFog } from './props.js';

// blank face centres measured on the 683×1024 textures
const STONES = [
  { name: 'tombstone_01', face: [358, 520, 330], small: 'HERE LIES', big: 'TICKETS', note: 'claim yours before\nthey are gone', action: 'apothecary' },
  { name: 'tombstone_02', face: [352, 610, 250], small: 'R · I · P', big: 'THE RITES', note: 'six ways to\nlose the night', action: 'deck', light: true },
  { name: 'tombstone_03', face: [339, 700, 300], small: 'SUMMON', big: 'THE KEEPER', note: 'sign the pact', action: 'rsvp' },
];

function engraved(stone) {
  const img = tex[stone.name].image;
  return canvasTexture(img.width, img.height, (ctx) => {
    ctx.drawImage(img, 0, 0);
    const [cx, cy, w] = stone.face;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const [hi, ink] = stone.light ? ['rgba(0,0,0,0.55)', 'rgba(205,215,235,0.78)'] : ['rgba(255,255,255,0.18)', 'rgba(14,14,20,0.82)'];
    const carve = (text, font, y) => {
      ctx.font = font;
      ctx.fillStyle = hi;
      ctx.fillText(text, cx + 1.5, y + 2);
      ctx.fillStyle = ink;
      ctx.fillText(text, cx, y);
    };
    carve(stone.small, '600 30px "Cinzel"', cy - 88);
    let size = 64;
    do { ctx.font = `900 ${size}px "Cinzel Decorative"`; size--; } while (ctx.measureText(stone.big).width > w && size > 16);
    carve(stone.big, ctx.font, cy - 20);
    ctx.fillStyle = stone.light ? 'rgba(205,215,235,0.5)' : 'rgba(14,14,20,0.5)';
    ctx.fillRect(cx - 50, cy + 26, 100, 3);
    stone.note.split('\n').forEach((l, i) => carve(l, 'italic 500 34px "Cormorant Garamond"', cy + 70 + i * 36));
  });
}

export function buildGraveyard({ onAction }) {
  const C = new THREE.Vector3(0, 0, -452);
  const group = new THREE.Group();
  group.position.copy(C);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 70), groundMaterial(tex.ground_path, { path: 0, dirt: 0x5a5a52 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -6);
  group.add(ground);

  const trees = [['forest_left', -16, -8, 24], ['forest_right', 16, -10, 24], ['forest_left', -26, -22, 30], ['forest_right', 27, -24, 30]];
  for (const [n, x, z, h] of trees) {
    const m = new THREE.Mesh(planeFor(tex[n], h, 1, 8), layerMaterial(tex[n], { sway: 0.2 }));
    m.position.set(x, h / 2 - 0.6, z);
    group.add(m);
  }

  const handGeo = planeFor(tex.skeleton_hand, 1.9);
  const stones = STONES.map((s, i) => {
    const h = [4.4, 5.3, 4.5][i];
    const x = [-4.6, 0, 4.7][i];
    const z = [0.3, -0.4, 0.2][i];
    const mat = layerMaterial(engraved(s), { lit: 1 });
    const m = new THREE.Mesh(planeFor(tex[s.name], h), mat);
    m.position.set(x, h / 2 - 0.12, z);
    m.userData.tex = tex[s.name];
    group.add(m);
    const hand = new THREE.Mesh(handGeo, layerMaterial(tex.skeleton_hand));
    hand.position.set(x + (i === 1 ? 1.4 : -1.3), -1.2, z + 1.1);
    hand.rotation.z = i === 1 ? -0.2 : 0.2;
    group.add(hand);
    const st = { mesh: m, hand, hover: 0, mat };
    addInteractive(m, {
      cursor: true,
      previewFirst: true,
      hoverSound: 'bones',
      onHover: () => (st.hover = 1),
      onLeave: () => (st.hover = 0),
      onClick: () => onAction(s.action),
    });
    return st;
  });

  const jacks = [[-7.4, 1.3, 'jackolantern_02'], [-2.3, 1.6, 'jackolantern_01'], [2.4, 1.8, 'jackolantern_03'], [7.8, 1.1, 'jackolantern_01']];
  jacks.forEach(([x, z, n], i) => {
    const h = [1.3, 0.9, 1.4, 1.1][i];
    const m = new THREE.Mesh(planeFor(tex[n], h), layerMaterial(tex[n], { emissive: 1.5 }));
    m.position.set(x, h * 0.47, z);
    const g = new THREE.Mesh(new THREE.PlaneGeometry(h * 3.2, h * 3.2), glowMaterial(0xff6a10, { intensity: 0.45, flicker: 0.6 }));
    g.position.set(x, h * 0.45, z - 0.05);
    group.add(g, m);
    lights.push({ pos: new THREE.Vector3(x, h * 0.6, C.z + z + 0.5), base: 1.0, seed: i * 2.3, zone: 'graveyard' });
  });

  makeFog(group, 0, 1, 4, 50, 5, 0.5, 0x7a6a8a);
  makeFog(group, 0, 1.4, -3, 60, 6, 0.45, 0x6a5a7a);
  makeFog(group, 0, 4, -14, 80, 12, 0.3, 0x5a4a6a);

  const lady = new THREE.Mesh(planeFor(tex.ghost_lady, 6.6), ghostMaterial(tex.ghost_lady, { tint: 0xffd0d8 }));
  lady.position.set(9.6, 3.4, -7);
  group.add(lady);
  spirits.push({ id: 'grave', obj: lady, center: new THREE.Vector3(), zone: 'graveyard', found: false, dwell: 0, reveal: 0 });

  updaters.push((dt, t) => {
    if (!group.visible) return;
    stones.forEach((s, i) => {
      const k = (s.k = THREE.MathUtils.lerp(s.k || 0, s.hover, 0.12));
      s.hand.position.y = -1.3 + k * 1.95 + Math.sin(t * 4 + i) * 0.03 * k;
      s.hand.rotation.z = (i === 1 ? -0.2 : 0.2) + Math.sin(t * 5 + i) * 0.08 * k;
      s.mat.uniforms.uTint.value.setScalar(1 + k * 0.35);
      s.mesh.position.x = [-4.6, 0, 4.7][i] + Math.sin(t * 40) * 0.01 * k;
    });
    lady.position.y = 3.4 + Math.sin(t * 0.6) * 0.3;
  });

  return { group };
}
