import * as THREE from 'three';
import { tex } from '../assets.js';
import { layerMaterial, glowMaterial, sigilMaterial } from '../shaders.js';
import { updaters } from './registry.js';
import { makeFog, makeCandles } from './props.js';

function gearGeometry(R, teeth, depth = 0.16) {
  const s = new THREE.Shape();
  const inner = R * 0.86, toothW = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * toothW;
    const pts = [[inner, a], [R, a + toothW * 0.18], [R, a + toothW * 0.48], [inner, a + toothW * 0.66], [inner, a + toothW]];
    pts.forEach(([r, ang], j) => {
      const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
      if (i === 0 && j === 0) s.moveTo(x, y); else s.lineTo(x, y);
    });
  }
  const hub = new THREE.Path(); hub.absarc(0, 0, R * 0.12, 0, Math.PI * 2, true); s.holes.push(hub);
  const spokes = 5;
  for (let i = 0; i < spokes; i++) {
    const a0 = (i / spokes) * Math.PI * 2 + 0.22, a1 = ((i + 1) / spokes) * Math.PI * 2 - 0.22;
    const h = new THREE.Path();
    h.absarc(0, 0, R * 0.7, a0, a1, false);
    h.absarc(0, 0, R * 0.26, a1, a0, true);
    s.holes.push(h);
  }
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 24 });
}

export function buildClock() {
  const C = new THREE.Vector3(0, 2, -260);
  const group = new THREE.Group();
  group.position.copy(C);
  group.userData.shiftX = -3.3;

  const S = 7;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(S, S), layerMaterial(tex.clock_face, { lit: 0.6 }));
  const hourMat = layerMaterial(tex.clock_hand_hour, { lit: 0.9 });
  const minMat = layerMaterial(tex.clock_hand_minute, { lit: 0.9 });
  const hour = new THREE.Mesh(new THREE.PlaneGeometry(S, S), hourMat);
  const minute = new THREE.Mesh(new THREE.PlaneGeometry(S, S), minMat);
  hour.position.z = 0.04; minute.position.z = 0.08;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), glowMaterial(0xff9a3a, { intensity: 0.14, power: 1.8 }));
  back.position.z = -2.2;
  group.add(back, face, hour, minute);

  // brass & iron clockwork behind the dial
  const brass = new THREE.MeshStandardMaterial({ color: 0x5a4020, metalness: 0.8, roughness: 0.42 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x24201c, metalness: 0.7, roughness: 0.55 });
  const gearSpec = [
    [-3.6, 2.4, -0.9, 2.0, 24, 0.22, brass], [3.7, -2.0, -0.8, 2.3, 28, -0.19, iron],
    [3.0, 3.1, -1.4, 1.4, 16, 0.31, brass], [-3.3, -2.9, -1.2, 1.7, 20, -0.26, iron],
    [-5.4, -0.3, -1.8, 1.1, 12, 0.4, brass], [5.6, 0.8, -1.9, 1.3, 14, -0.34, brass],
  ];
  const gears = gearSpec.map(([x, y, z, r, n, sp, mat]) => {
    const g = new THREE.Mesh(gearGeometry(r, n), mat);
    g.position.set(x, y, z);
    g.userData.sp = sp;
    group.add(g);
    return g;
  });

  // pendulum
  const pend = new THREE.Group();
  pend.position.set(0, 0, -0.45);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.4, 8), brass);
  rod.position.y = -2.2;
  const bob = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.14, 40), brass);
  bob.rotation.x = Math.PI / 2;
  bob.position.y = -4.4;
  pend.add(rod, bob);
  group.add(pend);

  const key = new THREE.PointLight(0xffa04a, 16, 16, 1.6);
  key.position.set(2.5, 1.5, 3.5);
  const rim = new THREE.DirectionalLight(0x9fb8ff, 0.7);
  rim.position.set(6, 8, 2);
  group.add(key, rim);

  const sigil = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), sigilMaterial(0xff9a3a, { opacity: 0.22, spin: 0.03 }));
  sigil.position.z = -3;
  group.add(sigil);
  makeFog(group, 0, -4, 2, 36, 5, 0.35, 0x4a3f66);
  makeCandles(group, -4.8, -3.9, 1.2, 1.9, 'clock');
  makeCandles(group, 4.8, -4.0, 1.0, 1.7, 'clock', true);

  const now = new Date();
  const startMin = (now.getHours() % 12) * 60 + now.getMinutes() + now.getSeconds() / 60;
  const toMidnight = 720 - startMin; // minutes of dial travel forward to XII

  updaters.push((dt, t, s) => {
    if (!group.visible) return;
    // scroll scrubs the hands forward from "now" to midnight
    const q = THREE.MathUtils.smoothstep(s.clockQ, 0.12, 0.82);
    const live = (Date.now() - now.getTime()) / 60000;
    const minutes = startMin + live * (1 - q) + toMidnight * q;
    minute.rotation.z = -((minutes % 60) / 60) * Math.PI * 2;
    hour.rotation.z = -((minutes / 60) % 12 / 12) * Math.PI * 2;
    const spin = 1 + s.clockSpeed * 14;
    gears.forEach((g) => (g.rotation.z += g.userData.sp * dt * spin));
    pend.rotation.z = Math.sin(t * 2.1) * 0.22;
    key.intensity = 15 + Math.sin(t * 9) * 1.5 + Math.random() * 1.5;
  });

  return { group };
}
