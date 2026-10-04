import * as THREE from 'three';
import { tex, planeFor } from '../assets.js';
import { layerMaterial, ghostMaterial, fogMaterial, groundMaterial, glowMaterial, pathX } from '../shaders.js';
import { lights, spirits, updaters } from './registry.js';

const rand = (a, b) => a + Math.random() * (b - a);

/* Far-away layers that ride along with the camera (sky, moon, mountains). */
export function buildBackdrop() {
  const group = new THREE.Group();

  const skyMat = layerMaterial(tex.sky_night, { lit: 0, fog: 0 });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(660, 440), skyMat);
  sky.position.set(0, 64, -340);
  sky.renderOrder = -10;

  const halo = new THREE.Mesh(new THREE.PlaneGeometry(190, 190), glowMaterial(0xffb877, { intensity: 0.32, power: 2.2 }));
  halo.position.set(104, 60, -318);
  halo.renderOrder = -9;

  const moonMat = layerMaterial(tex.moon, { lit: 0, fog: 0, tint: 0xfff1dc });
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(58, 58), moonMat);
  moon.position.set(104, 60, -315);
  moon.renderOrder = -8;

  const mtnMat = layerMaterial(tex.mountains_far, { lit: 0, fog: 0, tint: 0xb4bad8 });
  const mtn = new THREE.Mesh(new THREE.PlaneGeometry(600, 400), mtnMat);
  mtn.position.set(0, 10, -290);
  mtn.renderOrder = -7;

  group.add(sky, halo, moon, mtn);
  return { group, skyMat, moonMat, mtnMat, haloMat: halo.material, moon };
}

/* The haunted valley: gates, path, pumpkins, forest, manor, hidden spirits. */
export function buildValley() {
  const group = new THREE.Group();

  // ── Ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(110, 120), groundMaterial(tex.ground_path));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -30);
  group.add(ground);

  // ── Manor on the hill
  const manorMat = layerMaterial(tex.manor, { emissive: 1.8, fog: 0.22, lit: 0.35 });
  const manor = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), manorMat);
  manor.position.set(0, 10, -62);
  group.add(manor);
  const windowGlow = new THREE.Mesh(new THREE.PlaneGeometry(36, 26), glowMaterial(0xff7a18, { intensity: 0.2, power: 1.6, flicker: 0.4 }));
  windowGlow.position.set(-1, 15, -62.5);
  group.add(windowGlow);
  // the rose window we will fly through
  const roseGlow = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), glowMaterial(0x7dff9a, { intensity: 0, power: 1.4 }));
  roseGlow.position.set(-1.02, 13.2, -61.9);
  group.add(roseGlow);

  // fog bank hiding the hill base
  const fogTex = tex.fog_tile;
  const addFog = (x, y, z, w, h, opacity, tint = 0x8f97bd, speed = 0.01) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), fogMaterial(fogTex, { opacity, tint, speed: speed * (Math.random() > 0.5 ? 1 : -1), scale: w / 40 }));
    m.position.set(x, y, z);
    group.add(m);
    return m;
  };
  addFog(0, 1, -57, 120, 16, 0.9, 0x7a82a8, 0.006);
  addFog(0, 4, -52, 110, 12, 0.45, 0x7a82a8, 0.008);

  // ── Forest layers
  const forest = [
    ['forest_left', -15, 8, 22, 0.8], ['forest_right', 15, 3, 22, 0.8],
    ['forest_left', -18, -12, 26, 0.6], ['forest_right', 18, -18, 26, 0.6],
    ['forest_right', -30, -30, 30, 0.45, true], ['forest_left', 30, -34, 30, 0.45, true],
    ['forest_left', -14, -36, 22, 0.5], ['forest_right', 14, -42, 22, 0.5],
    ['forest_left', -22, -54, 28, 0.4], ['forest_right', 23, -56, 28, 0.4],
  ];
  for (const [name, x, z, h, sway, flip] of forest) {
    const mat = layerMaterial(tex[name], { sway: sway * 0.35, side: flip ? THREE.DoubleSide : THREE.FrontSide });
    const m = new THREE.Mesh(planeFor(tex[name], h, 1, 8), mat);
    m.position.set(x, h / 2 - 0.6, z);
    if (flip) m.scale.x = -1;
    group.add(m);
  }

  // ── Low ground fog along the road
  for (let i = 0; i < 9; i++) {
    const z = 16 - i * 8.5;
    addFog(pathX(z) + rand(-4, 4), 1.1, z, 44, 5, rand(0.35, 0.55));
    if (i % 2 === 0) addFog(rand(-10, 10), 3.5, z - 4, 50, 10, rand(0.18, 0.28));
  }

  // ── Gates
  const pillarH = 10.5;
  const pillarGeo = planeFor(tex.gate_pillar, pillarH);
  const pillarL = new THREE.Mesh(pillarGeo, layerMaterial(tex.gate_pillar, { emissive: 1.4 }));
  pillarL.position.set(-7.2, pillarH / 2 - 0.05, 0);
  const pillarR = new THREE.Mesh(pillarGeo, layerMaterial(tex.gate_pillar, { emissive: 1.4, side: THREE.DoubleSide }));
  pillarR.position.set(7.2, pillarH / 2 - 0.05, 0);
  pillarR.scale.x = -1;
  group.add(pillarL, pillarR);
  for (const x of [-7.2, 7.2]) {
    lights.push({ pos: new THREE.Vector3(x, 9.7, 0.6), base: 1.2, seed: Math.random() * 10, zone: 'valley' });
    const g = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), glowMaterial(0xff7a18, { intensity: 0.55, flicker: 0.5 }));
    g.position.set(x, 9.6, -0.1);
    group.add(g);
  }

  const doorGeo = new THREE.PlaneGeometry(5.4, 8.1, 8, 1);
  const hingeX = 5.1;
  const doorL = new THREE.Group(); doorL.position.set(-hingeX, 0, 0);
  const doorR = new THREE.Group(); doorR.position.set(hingeX, 0, 0);
  const dL = new THREE.Mesh(doorGeo, layerMaterial(tex.gate_half, { side: THREE.DoubleSide }));
  dL.position.set(2.7, 4.05, 0);
  const dR = new THREE.Mesh(doorGeo, layerMaterial(tex.gate_half, { side: THREE.DoubleSide }));
  dR.position.set(-2.7, 4.05, 0);
  dR.scale.x = -1;
  doorL.add(dL); doorR.add(dR);
  group.add(doorL, doorR);
  dL.userData.tex = tex.gate_half; dR.userData.tex = tex.gate_half;

  // ── Foreground framing tree + perched crow
  const treeMat = layerMaterial(tex.tree_foreground, { sway: 0.12 });
  const tree = new THREE.Mesh(planeFor(tex.tree_foreground, 9.5, 1, 10), treeMat);
  tree.position.set(-5.33, 3.35, 17);
  group.add(tree);

  const crowMat = layerMaterial(tex.crow_perched, { side: THREE.DoubleSide });
  const crow = new THREE.Mesh(planeFor(tex.crow_perched, 1.0), crowMat);
  crow.position.set(-5.02, 7.3, 17.05);
  crow.userData.tex = tex.crow_perched;
  group.add(crow);

  // ── Path of jack-o'-lanterns
  const jackNames = ['jackolantern_01', 'jackolantern_02', 'jackolantern_03'];
  const pumpkins = [];
  let side = 1;
  for (let z = 13; z > -52; z -= rand(4.2, 6.2)) {
    const name = jackNames[Math.floor(Math.random() * 3)];
    const h = rand(1.0, 1.55);
    const x = pathX(z) + side * rand(2.9, 3.6);
    const m = new THREE.Mesh(planeFor(tex[name], h), layerMaterial(tex[name], { emissive: 1.5 }));
    m.position.set(x, h * 0.47, z);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(h * 3.2, h * 3.2), glowMaterial(0xff6a10, { intensity: 0.5, power: 2.2, flicker: 0.6 }));
    glow.position.set(x, h * 0.45, z - 0.05);
    group.add(glow, m);
    lights.push({ pos: new THREE.Vector3(x, h * 0.6, z + 0.5), base: 1.05, seed: Math.random() * 10, zone: 'valley' });
    pumpkins.push(m);
    side *= -1;
  }

  // ── Hidden spirits (revealed only by the lantern)
  const lady = new THREE.Mesh(planeFor(tex.ghost_lady, 7.2), ghostMaterial(tex.ghost_lady, { tint: 0xcfffee }));
  lady.position.set(-12, 3.5, -6);
  group.add(lady);
  spirits.push({ id: 'lady', obj: lady, center: new THREE.Vector3(), zone: 'valley', found: false, dwell: 0, reveal: 0 });

  const handMat = layerMaterial(tex.skeleton_hand, { reveal: true });
  const hand = new THREE.Mesh(planeFor(tex.skeleton_hand, 2.3), handMat);
  hand.position.set(4.4, -0.2, -15);
  group.add(hand);
  const handSpirit = { id: 'hand', obj: hand, yOff: 1.1, center: new THREE.Vector3(), zone: 'valley', found: false, dwell: 0, reveal: 0 };
  spirits.push(handSpirit);

  const wraith = new THREE.Mesh(planeFor(tex.ghost_wraith, 8.5), ghostMaterial(tex.ghost_wraith, { tint: 0xc8ffe0 }));
  wraith.position.set(9.6, 4.3, -30);
  group.add(wraith);
  spirits.push({ id: 'wraith', obj: wraith, center: new THREE.Vector3(), zone: 'valley', found: false, dwell: 0, reveal: 0 });

  // ── Per-frame animation
  let crowFacing = 1;
  updaters.push((dt, t, s) => {
    if (!group.visible) return;
    // gates swing open with scroll
    const open = s.gateOpen;
    doorL.rotation.y = open * 1.62 + Math.sin(t * 1.3) * 0.006 * (1 - open);
    doorR.rotation.y = -open * 1.66 - Math.sin(t * 1.1 + 1) * 0.006 * (1 - open);
    // crow watches the lantern
    const want = s.pointer.x > 0.52 ? -1 : 1;
    if (want !== crowFacing) { crowFacing = want; crow.userData.hop = 1; }
    crow.userData.hop = Math.max(0, (crow.userData.hop || 0) - dt * 4);
    crow.scale.x = THREE.MathUtils.lerp(crow.scale.x, crowFacing, 0.25);
    crow.position.y = 7.3 + Math.sin(crow.userData.hop * Math.PI) * 0.18;
    crow.rotation.z = Math.sin(t * 2.1) * 0.02;
    // skeleton hand claws upward when lit
    hand.position.y = THREE.MathUtils.lerp(hand.position.y, -1.1 + handSpirit.reveal * 1.25, 0.08);
    hand.rotation.z = Math.sin(t * 3) * 0.04 * handSpirit.reveal;
    // ghosts drift
    lady.position.y = 3.5 + Math.sin(t * 0.7) * 0.25;
    lady.position.x = -12 + Math.sin(t * 0.3) * 0.4;
    wraith.position.y = 4.3 + Math.sin(t * 0.5 + 2) * 0.3;
    roseGlow.material.uniforms.uIntensity.value = s.roseGlow;
  });

  return { group, crow, gateMeshes: [dL, dR], manor, pumpkins };
}
