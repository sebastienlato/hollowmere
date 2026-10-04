/* Public API of the Hollowmere sound engine. */
import { createEngine, E, ac, setParam, setListener } from './engine.js';
import * as fx from './sfx.js';
import { createAmbience } from './ambience.js';
import { createScore } from './score.js';

let ready = false, amb = null, score = null, offline = false;
let enabled = (() => { try { return localStorage.getItem('hollowmere-sound') !== 'off'; } catch { return true; } })();
export const isEnabled = () => enabled;

/* `context` lets tests drive the engine with an OfflineAudioContext. */
export function initAudio(context) {
  if (ready) return;
  if (!createEngine(context)) return;
  offline = !!context;
  amb = createAmbience();
  score = createScore();
  ready = true;
  if (!offline) document.addEventListener('visibilitychange', () => {
    if (document.hidden) ac().suspend();
    else if (enabled) ac().resume();
  });
}

export function setEnabled(on) {
  enabled = on;
  try { localStorage.setItem('hollowmere-sound', on ? 'on' : 'off'); } catch {}
  if (!ready) return;
  if (!offline && ac().state !== 'running') ac().resume();
  setParam(E.out.gain, on ? 0.85 : 0, on ? 0.7 : 0.15);
}

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const bump = (x, a, b, c, d) => sm(a, b, x) * (1 - sm(c, d, x));
function weights(p) {
  const outdoor = Math.min(1, 1 - sm(0.27, 0.31, p) + sm(0.915, 0.945, p));
  return {
    outdoor, void: 1 - outdoor,
    valley: 1 - sm(0.27, 0.31, p),
    gates: bump(p, 0.04, 0.08, 0.2, 0.26),
    nature: outdoor,
    deck: bump(p, 0.3, 0.34, 0.48, 0.52),
    oracle: bump(p, 0.47, 0.51, 0.59, 0.63),
    clock: bump(p, 0.575, 0.615, 0.71, 0.75),
    apo: bump(p, 0.7, 0.74, 0.83, 0.87),
    invite: bump(p, 0.82, 0.85, 0.91, 0.935),
    grave: sm(0.92, 0.955, p),
  };
}

/* Scroll-triggered stingers, fired when progress crosses each mark going forward. */
const STINGERS = [
  [0.018, () => fx.whoosh(0.35)],
  [0.055, () => { fx.creak(); fx.flutter(8); }],
  [0.116, () => fx.gateClang()],
  [0.185, () => fx.wolf({ pan: 0.6 })],
  [0.262, () => fx.portal()],
  [0.338, () => fx.harpGliss(true)],
  [0.488, () => fx.whoosh(0.8)],
  [0.515, () => { fx.reverseSwell(1.1, 0.22); fx.whisper({ pan: -0.5, delay: 0.9 }); }],
  [0.595, () => fx.whoosh(0.8)],
  [0.62, () => fx.choirHit([38, 50, 57, 62], 0.18)],
  [0.715, () => fx.whoosh(0.8)],
  [0.742, () => fx.pumpkinPass(0)],
  [0.832, () => fx.whoosh(0.7)],
  [0.852, () => fx.paper()],
  [0.9, () => fx.reverseSwell(1.4, 0.4)],
  [0.93, () => { fx.boom(0.7); fx.thunder(0.8); }],
  [0.958, () => { fx.wolf({ pan: -0.5 }); fx.distantBell(); }],
];
let prevP = 0, lastSting = -1;
function stingers(p) {
  const t = ac().currentTime;
  for (const [mark, fire] of STINGERS) {
    if (prevP < mark && p >= mark && t - lastSting > 0.45) { fire(); lastSting = t; }
  }
  prevP = p;
}

/* Called every frame with the state of the world. */
export function updateAudio(f) {
  if (!ready) return;
  if (!enabled || (!offline && ac().state !== 'running')) { prevP = f.p; return; }
  f.W = weights(f.p);
  f.velN = Math.min(1, Math.abs(f.vel) / 0.1);
  setListener(f.pos, f.fwd);
  setParam(E.hallG.gain, 0.2 + 0.7 * f.W.outdoor, 0.5);
  setParam(E.cathG.gain, 0.65 * f.W.void, 0.5);
  setParam(E.muffle.frequency, f.modal ? 850 : 20000, 0.18);
  amb.update(f);
  score.update(f);
  stingers(f.p);
}

/* Every effect, silently skipped until audio is running and enabled. */
export const sfx = new Proxy({}, {
  get: (_, k) => (...a) => (ready && enabled && typeof fx[k] === 'function' ? fx[k](...a) : undefined),
});
