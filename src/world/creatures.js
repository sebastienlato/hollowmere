import * as THREE from 'three';
import { tex } from '../assets.js';
import { flapMaterial, particleMaterial } from '../shaders.js';

const rand = (a, b) => a + Math.random() * (b - a);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _zRot = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function flappers(texture, count, amp, speedRange, lit = 1, fog = 1) {
  const geo = new THREE.PlaneGeometry(1, 1, 24, 1);
  const phase = new Float32Array(count), speed = new Float32Array(count);
  for (let i = 0; i < count; i++) { phase[i] = Math.random() * 6.28; speed[i] = rand(...speedRange); }
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  geo.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speed, 1));
  const mesh = new THREE.InstancedMesh(geo, flapMaterial(texture, { amp, lit, fog }), count);
  mesh.frustumCulled = false;
  return mesh;
}

/* Bats circling the manor towers + a swarm that bursts out of the gate. */
export function buildBats() {
  const group = new THREE.Group();
  const ORBIT = 34, BURST = 28;

  const orbit = flappers(tex.bat, ORBIT, 1.0, [16, 24]);
  const orbitData = Array.from({ length: ORBIT }, () => ({
    a: Math.random() * 6.28, r: rand(7, 20), sp: rand(0.25, 0.6) * (Math.random() > 0.3 ? 1 : -1),
    h: rand(12, 26), s: rand(0.9, 1.7), wob: Math.random() * 6.28,
  }));

  const burst = flappers(tex.bat, BURST, 1.1, [22, 30]);
  const burstData = Array.from({ length: BURST }, () => ({ t: -1, delay: 0, dur: 1, from: new THREE.Vector3(), to: new THREE.Vector3(), s: 1, curve: rand(-2, 2) }));

  group.add(orbit, burst);

  let burstLive = true; // one pass hides the swarm at start
  function trigger(cam) {
    burstLive = true;
    for (const b of burstData) {
      b.t = 0;
      b.delay = rand(0, 0.7);
      b.dur = rand(1.6, 2.6);
      b.from.set(rand(-4, 4), rand(1.5, 6), rand(-14, -6));
      b.to.set(cam.x + rand(-9, 9), cam.y + rand(-2, 5), cam.z + rand(3, 7));
      b.s = rand(0.7, 1.2);
    }
  }

  function update(dt, t, camera, scatter) {
    _q.copy(camera.quaternion);
    for (let i = 0; i < ORBIT; i++) {
      const d = orbitData[i];
      d.a += d.sp * dt * (1 + scatter * 2.5);
      const r = d.r + scatter * 6;
      _p.set(Math.cos(d.a) * r, d.h + 4 + Math.sin(t * 0.8 + d.wob) * 2, -64 + Math.sin(d.a) * r * 0.45);
      _s.setScalar(d.s);
      _m.compose(_p, _q, _s);
      orbit.setMatrixAt(i, _m);
    }
    orbit.instanceMatrix.needsUpdate = true;

    if (!burstLive) return;
    burstLive = false;
    for (let i = 0; i < BURST; i++) {
      const b = burstData[i];
      if (b.t >= 0) burstLive = true;
      if (b.t < 0) { _s.setScalar(0); _m.compose(_p.set(0, -99, 0), _q, _s); burst.setMatrixAt(i, _m); continue; }
      b.t += dt;
      const k = (b.t - b.delay) / b.dur;
      if (k < 0) { _s.setScalar(0); } else if (k > 1) { b.t = -1; _s.setScalar(0); } else {
        _p.lerpVectors(b.from, b.to, k * k);
        _p.x += Math.sin(k * Math.PI) * b.curve;
        _p.y += Math.sin(k * Math.PI * 2 + i) * 0.4;
        _s.setScalar(b.s);
      }
      _zRot.setFromAxisAngle(Z_AXIS, Math.sin(t * 6 + i) * 0.25);
      _m.compose(_p, _q2.copy(_q).multiply(_zRot), _s);
      burst.setMatrixAt(i, _m);
    }
    burst.instanceMatrix.needsUpdate = true;
  }

  return { group, trigger, update };
}

/* Crows gliding across the moon (lives in the backdrop group). */
export function buildMoonCrows() {
  const N = 4;
  const mesh = flappers(tex.crow_flying, N, 0.75, [5, 7.5], 0, 0);
  mesh.renderOrder = -6;
  const data = Array.from({ length: N }, (_, i) => ({ x: -200 - i * 22, y: rand(38, 66), z: rand(-296, -286), sp: rand(9, 13), s: rand(5, 8) }));
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2);
  function update(dt) {
    data.forEach((d, i) => {
      d.x += d.sp * dt;
      if (d.x > 240) { d.x = -240 - Math.random() * 120; d.y = rand(34, 70); }
      _p.set(d.x, d.y + Math.sin(d.x * 0.05) * 3, d.z);
      _s.setScalar(d.s);
      _m.compose(_p, q, _s);
      mesh.setMatrixAt(i, _m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  return { mesh, update };
}

/* Embers (valley) ↔ spirit motes (the veil). */
export function buildParticles(count = 900) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), seed = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) { pos[i] = Math.random(); seed[i] = Math.random(); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
  const mat = particleMaterial({ box: 44, size: 4.5 });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, mat };
}
