import * as THREE from 'three';
import { pathX } from './shaders.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* Camera keys: p = scroll progress. `stop` keys ease to a standstill (a "station"). */
const KEYS = [
  { p: 0.0, pos: V(0, 4.2, 26), look: V(0, 9, -60), stop: true },
  { p: 0.045, pos: V(0, 4.0, 24), look: V(0, 8.7, -60), stop: true },
  { p: 0.13, pos: V(pathX(3), 2.2, 3), look: V(0.4, 3.2, -40) },
  { p: 0.2, pos: V(pathX(-22), 2.3, -22), look: V(-0.8, 7, -62) },
  { p: 0.255, pos: V(-0.9, 9.4, -42), look: V(-1.02, 13.2, -62) },
  { p: 0.3, pos: V(-1.02, 13.2, -61.4), look: V(-1.02, 13.2, -100) },
  { p: 0.33, pos: V(0, 3, -112), look: V(0, 2, -140) },
  { p: 0.35, pos: V(0, 2, -127), look: V(0, 2, -140), stop: true },
  { p: 0.47, pos: V(0, 2, -127.6), look: V(0, 2, -140), stop: true },
  { p: 0.545, pos: V(0, 2.4, -191), look: V(0, 2.2, -200), stop: true },
  { p: 0.585, pos: V(0, 2.4, -191.5), look: V(0, 2.2, -200), stop: true },
  { p: 0.64, pos: V(0, 1.8, -249), look: V(0, 1.6, -260), stop: true },
  { p: 0.705, pos: V(0, 1.8, -249.4), look: V(0, 1.6, -260), stop: true },
  { p: 0.77, pos: V(0, 1.4, -308.5), look: V(0, 0.9, -320), stop: true },
  { p: 0.82, pos: V(0, 1.4, -309), look: V(0, 0.9, -320), stop: true },
  { p: 0.875, pos: V(0, 1.4, -371.2), look: V(0, 1.2, -380), stop: true },
  { p: 0.905, pos: V(0, 1.4, -371.6), look: V(0, 1.2, -380), stop: true },
  { p: 0.93, pos: V(0, 4, -418), look: V(0, 2, -452) },
  { p: 0.965, pos: V(0, 2.7, -437), look: V(0, 2.2, -452), stop: true },
  { p: 1.0, pos: V(0, 2.5, -439), look: V(0, 2.1, -452), stop: true },
];

function tangent(i, field) {
  const k = KEYS[i];
  if (k.stop || i === 0 || i === KEYS.length - 1) return new THREE.Vector3();
  const a = KEYS[i - 1], b = KEYS[i + 1];
  return b[field].clone().sub(a[field]).divideScalar(b.p - a.p);
}
const TAN = KEYS.map((_, i) => ({ pos: tangent(i, 'pos'), look: tangent(i, 'look') }));

function hermite(out, p0, m0, p1, m1, t, dur) {
  const t2 = t * t, t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
  return out.set(
    h00 * p0.x + h10 * m0.x * dur + h01 * p1.x + h11 * m1.x * dur,
    h00 * p0.y + h10 * m0.y * dur + h01 * p1.y + h11 * m1.y * dur,
    h00 * p0.z + h10 * m0.z * dur + h01 * p1.z + h11 * m1.z * dur,
  );
}

export function cameraAt(p, outPos, outLook) {
  p = THREE.MathUtils.clamp(p, 0, 1);
  let i = 0;
  while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const dur = b.p - a.p;
  const t = THREE.MathUtils.clamp((p - a.p) / dur, 0, 1);
  hermite(outPos, a.pos, TAN[i].pos, b.pos, TAN[i + 1].pos, t, dur);
  hermite(outLook, a.look, TAN[i].look, b.look, TAN[i + 1].look, t, dur);
}

/* Environment keys: fog colour & density, ambient light, lantern darkness, particle mood. */
const C = (h) => new THREE.Color(h);
const L = (r, g, b) => new THREE.Color().setRGB(r, g, b); // linear multipliers
const ENV = [
  { p: 0.0, fog: C('#0d1024'), dens: 0.0105, amb: L(0.95, 0.98, 1.14), dark: 0.3, mix: 0 },
  { p: 0.2, fog: C('#0d1024'), dens: 0.012, amb: L(0.92, 0.95, 1.12), dark: 0.32, mix: 0.1 },
  { p: 0.29, fog: C('#0a0c1a'), dens: 0.009, amb: L(0.88, 0.9, 1.08), dark: 0.36, mix: 0.5 },
  { p: 0.32, fog: C('#06050c'), dens: 0.03, amb: L(0.86, 0.84, 1.02), dark: 0.4, mix: 1 },
  { p: 0.6, fog: C('#07050d'), dens: 0.03, amb: L(0.9, 0.86, 1.04), dark: 0.4, mix: 1 },
  { p: 0.705, fog: C('#0d0409'), dens: 0.03, amb: L(1.0, 0.86, 0.92), dark: 0.4, mix: 0.8 },
  { p: 0.91, fog: C('#0c0409'), dens: 0.03, amb: L(0.98, 0.86, 0.92), dark: 0.4, mix: 0.8 },
  { p: 0.94, fog: C('#140a14'), dens: 0.02, amb: L(1.0, 0.9, 1.04), dark: 0.32, mix: 0.2 },
  { p: 1.0, fog: C('#140a14'), dens: 0.018, amb: L(1.0, 0.9, 1.04), dark: 0.3, mix: 0.1 },
];

export function envAt(p, out) {
  let i = 0;
  while (i < ENV.length - 2 && p > ENV[i + 1].p) i++;
  const a = ENV[i], b = ENV[i + 1];
  const t = THREE.MathUtils.smoothstep(p, a.p, b.p);
  out.fog.copy(a.fog).lerp(b.fog, t);
  out.amb.copy(a.amb).lerp(b.amb, t);
  out.dens = THREE.MathUtils.lerp(a.dens, b.dens, t);
  out.dark = THREE.MathUtils.lerp(a.dark, b.dark, t);
  out.mix = THREE.MathUtils.lerp(a.mix, b.mix, t);
  return out;
}

const bump = (p, a, m, b) => (p < a || p > b ? 0 : p < m ? THREE.MathUtils.smoothstep(p, a, m) : 1 - THREE.MathUtils.smoothstep(p, m, b));
export const warpAt = (p) => Math.max(bump(p, 0.268, 0.3, 0.338), bump(p, 0.9, 0.925, 0.952) * 0.85);

/* Which world zones need to be drawn at progress p. */
export function zonesAt(p) {
  return {
    outdoor: p < 0.302 || p > 0.918,
    valley: p < 0.302,
    deck: p > 0.285 && p < 0.53,
    oracle: p > 0.46 && p < 0.63,
    clock: p > 0.56 && p < 0.75,
    apothecary: p > 0.68 && p < 0.87,
    invitation: p > 0.8 && p < 0.935,
    graveyard: p > 0.9,
  };
}
