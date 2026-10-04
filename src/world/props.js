import * as THREE from 'three';
import { tex, planeFor } from '../assets.js';
import { layerMaterial, flameMaterial, glowMaterial, fogMaterial } from '../shaders.js';
import { lights } from './registry.js';

// wick tips in candles.png (px of a 1024² image)
const WICKS = [[500, 57], [302, 240], [722, 318], [622, 475], [380, 625]];

/* A cluster of dripping candles with live procedural flames. */
export function makeCandles(parent, x, y, z, h, zone, flip = false) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const m = new THREE.Mesh(planeFor(tex.candles, h), layerMaterial(tex.candles, { side: THREE.DoubleSide }));
  if (flip) m.scale.x = -1;
  g.add(m);
  for (const [px, py] of WICKS) {
    const wx = ((px / 1024) - 0.5) * h * (flip ? -1 : 1);
    const wy = (0.5 - py / 1024) * h;
    const fw = h * 0.085, fh = h * 0.26;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), flameMaterial({ intensity: 1.6 }));
    f.position.set(wx, wy + fh * 0.42, 0.02);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(h * 0.7, h * 0.7), glowMaterial(0xff8a2a, { intensity: 0.35, flicker: 0.6 }));
    glow.position.set(wx, wy + fh * 0.3, 0.01);
    g.add(glow, f);
  }
  lights.push({ obj: g, local: new THREE.Vector3(0, h * 0.4, 0.8), pos: new THREE.Vector3(), base: 0.9, seed: Math.random() * 10, zone });
  parent.add(g);
  return g;
}

export function makeFog(parent, x, y, z, w, h, opacity, tint = 0x6a6f9a, speed = 0.01) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), fogMaterial(tex.fog_tile, { opacity, tint, speed, scale: w / 40 }));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
