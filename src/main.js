import * as THREE from 'three';
import Lenis from 'lenis';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { U } from './shaders.js';
import { loadAll, alphaAt } from './assets.js';
import { buildBackdrop, buildValley } from './world/valley.js';
import { buildBats, buildMoonCrows, buildParticles } from './world/creatures.js';
import { buildDeck, DECK_P } from './world/deck.js';
import { buildOracle } from './world/oracle.js';
import { buildClock } from './world/clock.js';
import { buildApothecary } from './world/apothecary.js';
import { buildInvitation } from './world/invitation.js';
import { buildGraveyard } from './world/graveyard.js';
import { lights, spirits, interactives, updaters } from './world/registry.js';
import { createPost } from './fx/post.js';
import { cameraAt, envAt, warpAt, zonesAt } from './timeline.js';
import { createLantern } from './cursor.js';
import { createLoader } from './loader.js';
import { createUI } from './ui.js';
import { initAudio, setEnabled, isEnabled, updateAudio, sfx } from './audio/index.js';
import { CHAPTERS } from './content.js';

document.body.classList.add('is-loading');

const smooth = THREE.MathUtils.smoothstep;
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;

/* ─────────── renderer ─────────── */
const canvas = document.getElementById('gl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (e) {
  document.body.insertAdjacentHTML('beforeend', '<div class="fallback"><div><h2>The veil will not open.</h2><p>Hollowmere needs WebGL. Try a recent version of Chrome, Safari, Firefox or Edge.</p></div></div>');
  throw e;
}
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.08;
let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);

renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0d1024');
scene.fog = new THREE.FogExp2(0x0d1024, 0.012);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 2.7, 20);
const post = createPost(renderer, scene, camera);

/* ─────────── state ─────────── */
const S = {
  p: 0, pointer: { x: 0.5, y: 0.5 }, gateOpen: 0, roseGlow: 0, clockQ: 0, clockSpeed: 0, shake: 0,
  entered: false, built: false, midnight: false, flash: 0, lightning: 0, nextBolt: 8,
};
const env = { fog: new THREE.Color(), amb: new THREE.Color(), dens: 0.01, dark: 0.3, mix: 0 };
const lantern = createLantern();
let W = null; // world handles

/* ─────────── scroll ─────────── */
const lenis = new Lenis({ lerp: 0.07, wheelMultiplier: 0.85, touchMultiplier: 1.3, smoothWheel: true });
lenis.stop();
window.scrollTo(0, 0);
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

function gotoP(p) {
  const y = p * lenis.limit;
  const dist = Math.abs(y - lenis.scroll) / Math.max(1, lenis.limit);
  lenis.scrollTo(y, { duration: clamp(1.2 + dist * 9, 1.2, 6), easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) });
}
function goto(id) {
  if (id === 'rsvp') { ui.openRSVP(() => W?.invitation.reset()); return; }
  const ch = CHAPTERS.find((c) => c.id === id);
  if (ch) gotoP(ch.focus);
}

/* ─────────── UI + loader ─────────── */
const ui = createUI({ goto, onSound: (on) => { initAudio(); setEnabled(on); } });
ui.onPact = () => { sfx.pact(); S.flash = 0.5; };
document.querySelector('.sound').setAttribute('aria-pressed', String(isEnabled()));

// UI sounds: soft wooden ticks on hover, quill scratches while writing the pact
let lastUi = null;
document.addEventListener('pointerover', (e) => {
  const el = e.target.closest?.('#rail button, .btn-ghost, .brand, .sound, .btn-seal, .rsvp-close');
  if (el && el !== lastUi) sfx.uiTick();
  lastUi = el;
});
document.querySelector('.rsvp-form').addEventListener('keydown', (e) => { if (e.key.length === 1 || e.key === 'Backspace') sfx.quill(); });

const loader = createLoader({
  onEnter: () => {
    initAudio();
    setEnabled(isEnabled());
    sfx.veilOpen();
    S.entered = true;
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-entered');
    setTimeout(() => lenis.start(), 900);
  },
});

loadAll(renderer, (f) => loader.setProgress(f * 0.85)).then(async () => {
  buildWorld();
  // warm up every shader and upload every texture while the séance plays,
  // so no chapter hitches the first time it appears
  const vis = [];
  scene.traverse((o) => { vis.push([o, o.visible]); o.visible = true; });
  await renderer.compileAsync(scene, camera);
  vis.forEach(([o, v]) => (o.visible = v));
  const textures = new Set();
  scene.traverse((o) => {
    const u = o.material?.uniforms;
    if (u) for (const k in u) if (u[k].value?.isTexture) textures.add(u[k].value);
  });
  let n = 0;
  for (const t of textures) {
    renderer.initTexture(t);
    loader.setProgress(0.85 + (0.15 * ++n) / textures.size);
    if (n % 4 === 0) await new Promise(requestAnimationFrame);
  }
  loader.setProgress(1);
  // dev shortcut: ?skip jumps past the séance, &p=0.5 lands at a scroll position
  const q = new URLSearchParams(location.search);
  if (import.meta.env.DEV && q.has('skip')) {
    document.getElementById('loader')?.remove();
    S.entered = true;
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-entered');
    lenis.start();
    if (q.has('p')) requestAnimationFrame(() => lenis.scrollTo(parseFloat(q.get('p')) * lenis.limit, { immediate: true }));
  }
});
if (import.meta.env.DEV) window.__hm = { lenis, S, gotoP, U, camera };

function buildWorld() {
  const backdrop = buildBackdrop();
  const moonCrows = buildMoonCrows();
  backdrop.group.add(moonCrows.mesh);
  const valley = buildValley();
  const bats = buildBats();
  const particles = buildParticles(window.innerWidth < 800 ? 500 : 900);
  const deck = buildDeck({
    onActive: (i) => { ui.setCard(i); if (S.entered && S.p > 0.33 && S.p < 0.49) sfx.flip(i); },
    onGoto: (i) => gotoP(DECK_P[0] + (i / 5) * (DECK_P[1] - DECK_P[0])),
  });
  const oracle = buildOracle({ onTouch: () => { ui.fortune(); sfx.oracle(); S.flash = 0.12; } });
  const clock = buildClock();
  let lastClink = 0;
  const apothecary = buildApothecary({
    onHover: (k) => { ui.showTier(k); const n = performance.now(); if (n - lastClink > 250) { sfx.clink(k); lastClink = n; } },
    onPour: () => sfx.glug(),
    onSelect: (k) => { ui.chooseTier(k); sfx.splash(); setTimeout(() => goto('invitation'), 2400); },
  });
  const invitation = buildInvitation({
    onBreak: () => { sfx.crack(); S.shake = 0.35; },
    onOpen: () => ui.openRSVP(() => invitation.reset()),
  });
  const graveyard = buildGraveyard({ onAction: goto });

  scene.add(backdrop.group, valley.group, bats.group, particles.points, deck.group, oracle.group, clock.group, apothecary.group, invitation.group, graveyard.group);

  // clickable scenery
  valley.gateMeshes.forEach((m) => { m.userData.cursor = true; m.userData.hoverSound = 'gate'; m.userData.onClick = () => goto('gates'); interactives.push(m); });
  valley.crow.userData.onClick = () => { sfx.caw(); valley.crow.userData.hop = 1; };
  valley.crow.userData.cursor = true;
  interactives.push(valley.crow);

  scene.traverse((o) => { if (o.material?.uniforms?.uPR) o.material.uniforms.uPR.value = pixelRatio; });
  // portrait phones: lift & shrink each station so the copy can sit beneath it
  const portrait = [[deck, 1.5, 0.68], [oracle, 1.3, 0.76], [clock, 1.7, 0.7], [apothecary, 1.1, 0.64], [invitation, 1.2, 0.72]];
  portrait.forEach(([w, y, s]) => Object.assign(w.group.userData, { baseY: w.group.position.y, portY: y, portS: s }));
  W = { backdrop, moonCrows, valley, bats, particles, deck, oracle, clock, apothecary, invitation, graveyard };
  S.built = true;
}

/* ─────────── interaction ─────────── */
const raycaster = new THREE.Raycaster();
let armed = null;
const ndc = new THREE.Vector2();
const pickable = [], hits = [];
const shown = (m) => { for (let o = m; o; o = o.parent) if (!o.visible) return false; return true; };
function pick(x, y) {
  ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  pickable.length = 0;
  for (const m of interactives) if (shown(m)) pickable.push(m);
  hits.length = 0;
  raycaster.intersectObjects(pickable, false, hits);
  for (const h of hits) {
    const map = h.object.userData.tex || h.object.material?.uniforms?.map?.value;
    if (!map || !h.uv || alphaAt(map, h.uv.x, h.uv.y) > 0.25) return h.object;
  }
  return null;
}
canvas.addEventListener('click', (e) => {
  if (!S.entered || ui.isModalOpen()) return;
  const o = pick(e.clientX, e.clientY);
  if (!o) return;
  // touch: first tap previews (hover), second tap acts
  if (!lantern.state.fine && o.userData.previewFirst && armed !== o) {
    armed?.userData.onLeave?.();
    armed = o;
    o.userData.onHover?.();
    return;
  }
  armed = null;
  o.userData.onClick?.();
});

/* ─────────── resize ─────────── */
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 62 : w / h < 1.2 ? 52 : 45;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(w, h);
  post.setSize(w, h, pixelRatio);
  U.uAspect.value = w / h;
  U.uViewport.value.set(w * pixelRatio, h * pixelRatio);
  scene.traverse((o) => { if (o.material?.uniforms?.uPR) o.material.uniforms.uPR.value = pixelRatio; });
}
window.addEventListener('resize', resize);
resize();

/* ─────────── per-frame helpers ─────────── */
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
const mouse = new THREE.Vector2();
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
const lanternWorld = new THREE.Vector3();
const camFwd = new THREE.Vector3();
const anchors = { clock: new THREE.Vector3(), cauldron: new THREE.Vector3(), oracle: new THREE.Vector3() };
let pointerSpeed = 0, lastPX = 0, lastPY = 0;

const cand = [];
const byDistance = (a, b) => a.d - b.d;
function fillLights(zones, t) {
  cand.length = 0;
  for (const l of lights) {
    if (!zones[l.zone]) continue;
    if (l.obj) l.obj.localToWorld(l.pos.copy(l.local));
    l.d = l.pos.distanceToSquared(camera.position);
    cand.push(l);
  }
  cand.sort(byDistance);
  for (let i = 0; i < 12; i++) {
    const l = cand[i], u = U.uLights.value[i];
    if (!l) { u.set(0, -999, 0, 0); continue; }
    const fl = 0.78 + 0.14 * Math.sin(t * 11 + l.seed * 7) + 0.08 * Math.sin(t * 23.7 + l.seed * 3);
    u.set(l.pos.x, l.pos.y, l.pos.z, l.base * fl);
  }
}

let prevP = 0;
let layoutShift = 1, layoutPortrait = 0;
const crossed = (a, b, x) => a < x && b >= x;
function events(p) {
  if (!S.entered) { prevP = p; return; }
  if (crossed(prevP, p, 0.055)) W.bats.trigger(camera.position);
  if (S.clockQ >= 0.82 && !S.midnight && p > 0.6 && p < 0.72) {
    S.midnight = true;
    document.body.classList.add('is-midnight');
    sfx.midnight();
    setTimeout(() => { S.flash = 0.9; S.shake = 1; }, 950);
  }
  prevP = p;
}

function spiritsTick(zones, dt, lx, ly) {
  let tension = 0;
  const R = U.uRevealRadius.value;
  for (const s of spirits) {
    if (!zones[s.zone]) { s.reveal = Math.max(0, s.reveal - dt * 2); continue; }
    s.obj.getWorldPosition(s.center);
    s.center.y += s.yOff || 0;
    tmp.copy(s.center).project(camera);
    if (tmp.z > 1 || Math.abs(tmp.x) > 1.2 || Math.abs(tmp.y) > 1.2) { s.reveal = Math.max(0, s.reveal - dt * 2); continue; }
    const sx = tmp.x * 0.5 + 0.5, sy = tmp.y * 0.5 + 0.5;
    const d = Math.hypot((sx - lx) * U.uAspect.value, sy - ly);
    const near = d < R * 0.7;
    s.reveal = clamp(s.reveal + (near ? dt * 3 : -dt * 1.5), 0, 1);
    if (!s.found) {
      tension = Math.max(tension, clamp(1 - d / (R * 2.2), 0, 1));
      s.dwell = near ? s.dwell + dt : Math.max(0, s.dwell - dt);
      if (s.dwell > 0.5) {
        s.found = true;
        ui.spiritFound();
        sfx.spiritFound();
        S.flash = Math.max(S.flash, 0.08);
      }
    }
  }
  return tension;
}

let hovered = null;
let lastHoverSound = 0;
function playHoverSound(kind) {
  if (!kind) return;
  const n = performance.now();
  if (n - lastHoverSound < 180) return;
  lastHoverSound = n;
  if (kind === 'bones') sfx.bones();
  else if (kind === 'orb') sfx.reverseSwell(0.6, 0.12);
  else if (kind === 'gate') sfx.chains(0.6);
  else sfx.uiTick(0.7);
}

// a flame whoosh as each jack-o'-lantern slides past the camera
let lastCamZ = 0;
function pumpkinTick(zones) {
  const z = camera.position.z;
  if (zones.valley && S.entered) {
    for (const m of W.valley.pumpkins) {
      if (lastCamZ > m.position.z && z <= m.position.z) sfx.pumpkinPass(clamp((m.position.x - camera.position.x) / 4, -1, 1));
    }
  }
  lastCamZ = z;
}
let lastPickX = -1, lastPickY = -1, lastPickP = -1, lastPickT = 0;
function hoverTick(t) {
  if (!lantern.state.fine || !S.entered || ui.isModalOpen()) { if (hovered) { hovered.userData.onLeave?.(); hovered = null; document.body.classList.remove('is-hovering'); } return; }
  // raycast only when something could have changed under the pointer
  const { x, y } = lantern.state;
  if (x === lastPickX && y === lastPickY && S.p === lastPickP && t - lastPickT < 0.25) return;
  lastPickX = x; lastPickY = y; lastPickP = S.p; lastPickT = t;
  const o = pick(x, y);
  if (o !== hovered) {
    hovered?.userData.onLeave?.();
    o?.userData.onHover?.();
    hovered = o;
    document.body.classList.toggle('is-hovering', !!o?.userData.cursor);
    playHoverSound(o?.userData.hoverSound);
  }
}

// adaptive quality: step resolution & MSAA down under load, back up when there's headroom
const QUALITY = [[1.75, 4], [1.5, 4], [1.25, 2], [1, 0], [0.85, 0]]
  .filter(([pr], i, all) => pr <= Math.min(window.devicePixelRatio || 1, 1.75) || i === all.length - 1);
let qLevel = 0, qFrames = 0, qTime = 0, qGood = 0, qCooldown = 3;
function perfTick(dt) {
  if (!S.entered || document.hidden || dt >= 0.05) return; // ignore hitches & tab switches
  qCooldown -= dt;
  qFrames++; qTime += dt;
  if (qTime < 1.5) return;
  const fps = qFrames / qTime;
  qFrames = 0; qTime = 0;
  if (qCooldown > 0) return;
  if (fps < 48 && qLevel < QUALITY.length - 1) setQuality(qLevel + 1);
  else if (fps > 58 && qLevel > 0 && (qGood += 1.5) >= 6) setQuality(qLevel - 1);
  else if (fps <= 58) qGood = 0;
}
function setQuality(level) {
  qLevel = level; qGood = 0; qCooldown = 4;
  const [pr, samples] = QUALITY[level];
  pixelRatio = pr;
  post.setSamples(samples);
  resize();
}

/* ─────────── main loop ─────────── */
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  lenis.raf(now);
  lantern.update(dt, t);
  if (!S.built) return;

  const p = S.entered ? clamp(lenis.progress || 0, 0, 1) : 0;
  const vel = (p - S.p) / Math.max(dt, 1e-3);
  const dp = Math.abs(p - S.p);
  S.p = p;
  S.pointer.x = lantern.state.nx; S.pointer.y = lantern.state.ny;
  const zones = zonesAt(p);

  // camera along the spline + a little lantern-led parallax
  cameraAt(p, camPos, camLook);
  mouse.lerp(tmp2.set(S.pointer.x - 0.5, S.pointer.y - 0.5, 0), 0.04);
  const par = zones.valley || zones.graveyard ? 1 : 0.45;
  camera.position.copy(camPos);
  camera.position.x += mouse.x * 0.7 * par;
  camera.position.y -= mouse.y * 0.35 * par;
  camLook.x += mouse.x * 1.6 * par;
  camLook.y -= mouse.y * 0.8 * par;
  S.shake = Math.max(0, S.shake - dt * 1.2);
  if (S.shake > 0) {
    camera.position.x += (Math.random() - 0.5) * S.shake * 0.12;
    camera.position.y += (Math.random() - 0.5) * S.shake * 0.12;
  }
  camera.lookAt(camLook);

  // lightning (outdoors only)
  if (S.entered && zones.outdoor && t > S.nextBolt && !ui.isModalOpen()) {
    S.lightning = 1; S.nextBolt = t + 14 + Math.random() * 18; sfx.thunder();
  }
  S.lightning = Math.max(0, S.lightning - dt * 1.6);
  const bolt = S.lightning > 0 ? Math.max(0, Math.sin((1 - S.lightning) * 18) * S.lightning) : 0;

  // environment
  envAt(p, env);
  U.uFogColor.value.copy(env.fog);
  U.uFogDensity.value = env.dens;
  U.uAmbient.value.copy(env.amb).multiplyScalar(1 + bolt * 1.6);
  U.uRevealBoost.value = bolt * 0.9;
  scene.background.copy(env.fog);
  scene.fog.color.copy(env.fog);
  scene.fog.density = env.dens;

  // what's drawn
  W.backdrop.group.visible = zones.outdoor;
  W.backdrop.group.position.copy(camera.position);
  W.valley.group.visible = zones.valley;
  W.bats.group.visible = zones.valley;
  W.deck.group.visible = zones.deck;
  W.oracle.group.visible = zones.oracle;
  W.clock.group.visible = zones.clock;
  W.apothecary.group.visible = zones.apothecary;
  W.invitation.group.visible = zones.invitation;
  W.graveyard.group.visible = zones.graveyard;
  layoutShift = lerp(layoutShift, camera.aspect > 1.15 ? 1 : 0, 0.1);
  layoutPortrait = lerp(layoutPortrait, camera.aspect < 0.8 ? 1 : 0, 0.1);
  for (const g of [W.deck.group, W.oracle.group, W.clock.group, W.apothecary.group, W.invitation.group]) {
    const u = g.userData;
    g.position.x = u.shiftX * layoutShift;
    g.position.y = u.baseY + u.portY * layoutPortrait;
    g.scale.setScalar(1 - (1 - u.portS) * layoutPortrait);
  }
  const blood = smooth(p, 0.9, 0.96);
  W.backdrop.moonMat.uniforms.uTint.value.setRGB(1, 1 - blood * 0.62, 1 - blood * 0.66).multiplyScalar(1 + bolt * 0.4);
  W.backdrop.skyMat.uniforms.uTint.value.setRGB(1 + blood * 0.25, 1 - blood * 0.2, 1 - blood * 0.1).multiplyScalar(1 + bolt * 2.2);
  W.backdrop.mtnMat.uniforms.uTint.value.setHex(0xb4bad8).multiplyScalar(1 + bolt * 1.5);
  W.backdrop.haloMat.uniforms.uColor.value.setRGB(1, 0.72 - blood * 0.45, 0.47 - blood * 0.3);

  // scroll-driven state
  S.gateOpen = smooth(p, 0.05, 0.118);
  S.roseGlow = smooth(p, 0.19, 0.26) * (1 - smooth(p, 0.262, 0.292)) * 1.1;
  S.clockQ = clamp((p - 0.6) / (0.705 - 0.6), 0, 1);
  S.clockSpeed = lerp(S.clockSpeed, zones.clock ? clamp(dp / Math.max(dt, 1e-3) * 8, 0, 1) : 0, 0.1);
  events(p);

  // the lantern's light in the world
  const lx = lantern.state.gx / window.innerWidth, ly = 1 - lantern.state.gy / window.innerHeight;
  U.uLanternScreen.value.set(lx, ly);
  post.veil.uLantern.value.set(lx, ly);
  tmp.set(lx * 2 - 1, ly * 2 - 1, 0.5).unproject(camera).sub(camera.position).normalize();
  const depth = zones.valley || zones.graveyard ? 7 : 5.2;
  lanternWorld.copy(camera.position).addScaledVector(tmp, depth);
  const lanternI = (1.0 + Math.sin(t * 13) * 0.05 + Math.sin(t * 7.3) * 0.07) * (hovered?.userData.cursor ? 1.35 : 1);
  U.uLantern.value.set(lanternWorld.x, lanternWorld.y, lanternWorld.z, (S.entered ? lanternI : 0.6) * (zones.outdoor ? 1 : 0.8));

  fillLights(zones, t);
  const tension = spiritsTick(zones, dt, lx, ly);
  hoverTick(t);
  pumpkinTick(zones);
  const lp = lantern.state;
  pointerSpeed = lerp(pointerSpeed, Math.hypot(lp.x - lastPX, lp.y - lastPY) / Math.max(dt, 1e-3), 0.2);
  lastPX = lp.x; lastPY = lp.y;
  W.clock.group.getWorldPosition(anchors.clock);
  W.apothecary.group.getWorldPosition(anchors.cauldron).y -= 1.2;
  W.oracle.group.getWorldPosition(anchors.oracle).y += 1.2;
  camera.getWorldDirection(camFwd);
  updateAudio({
    dt, p, vel: S.entered ? vel : 0, pos: camera.position, fwd: camFwd, anchors, tension, clockSpeed: S.clockSpeed,
    pointer: { x: lp.nx, y: lp.ny, speed: pointerSpeed }, fine: lp.fine, midnight: S.midnight, modal: ui.isModalOpen(),
    orb: hovered?.userData.hoverSound === 'orb' ? 1 : 0,
  });

  W.particles.mat.uniforms.uCam.value.copy(camera.position);
  W.particles.mat.uniforms.uMix.value = env.mix;
  if (zones.valley) {
    const scatter = clamp(1 - Math.hypot(lx - 0.5, ly - 0.75) * 3, 0, 1);
    W.bats.update(dt, t, camera, scatter);
  }
  if (zones.outdoor) W.moonCrows.update(dt);
  for (const u of updaters) u(dt, t, S);

  // post
  S.flash = Math.max(0, S.flash - dt * 1.8);
  const pv = post.veil;
  pv.uTime.value = t;
  pv.uDark.value = S.entered ? env.dark : 0.2;
  pv.uWarp.value = warpAt(p);
  pv.uFlash.value = S.flash * 0.6 + bolt * 0.35;
  pv.uFlashColor.value.setRGB(S.midnight && p < 0.72 ? 1 : 0.85, S.midnight && p < 0.72 ? 0.35 : 0.92, S.midnight && p < 0.72 ? 0.3 : 1);
  pv.uBlood.value = smooth(p, 0.68, 0.72) * (1 - smooth(p, 0.9, 0.93)) + blood * 0.5;
  U.uTime.value = t;

  ui.update(p, t);
  perfTick(dt);
  post.composer.render(dt);
}
requestAnimationFrame(frame);

// spider webs tremble when the lantern passes near
setInterval(() => {
  const { x, y } = lantern.state;
  document.querySelectorAll('.web').forEach((w, i) => {
    const near = y < 220 && (i === 0 ? x < 260 : x > window.innerWidth - 260);
    if (near && !w.classList.contains('tremble')) {
      w.classList.add('tremble');
      setTimeout(() => w.classList.remove('tremble'), 800);
    }
  });
}, 150);
