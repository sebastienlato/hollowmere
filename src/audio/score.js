/* The generative score. One D-minor progression (i – VI – iv – V) runs the whole
   night; each chapter decides which instruments are awake to play it. */
import { ac, setParam, route, rand } from './engine.js';
import { musicBox, choir, organ, bow } from './instruments.js';

const BPM = 66;
const E8 = 60 / BPM / 2;                 // one eighth note
const CHOIR = [[57, 62, 65, 69], [58, 62, 65, 70], [55, 62, 67, 70], [57, 61, 64, 67]];
const ORGAN = [[38, 50, 57, 62, 65], [34, 46, 58, 62, 65], [31, 43, 58, 62, 67], [33, 45, 57, 61, 67]];
const ROOTS = [38, 34, 43, 45];
const OSTINATO = [0, 0, 12, 0, 7, 0, 12, 7];
// a crooked lullaby, one row per bar (eighth notes, 0 = rest)
const MELODY = [
  [81, 0, 86, 0, 89, 88, 86, 0],
  [85, 0, 86, 0, 81, 0, 0, 0],
  [82, 0, 86, 0, 89, 88, 86, 0],
  [84, 0, 82, 0, 81, 0, 0, 0],
  [79, 0, 82, 0, 86, 84, 82, 0],
  [81, 0, 79, 0, 77, 0, 0, 0],
  [76, 0, 79, 0, 85, 0, 88, 0],
  [86, 0, 85, 0, 81, 0, 0, 0],
];

export function createScore() {
  const c = ac();
  const layer = (verb) => route({ bus: 'music', verb, life: 0, level: 0 });
  const L = { box: layer(0.55), choir: layer(0.5), organ: layer(0.6), bass: layer(0.35), cel: layer(0.6) };
  let step = 0, nextT = c.currentTime + 0.2;
  let lvl = { box: 0, choir: 0, organ: 0, bass: 0, cel: 0 };
  let warble = 10;

  function schedule(i, t) {
    const bar = Math.floor(i / 8) % 8, s = i % 8, ch = Math.floor(bar / 2) % 4;
    if (s === 0 && bar % 2 === 0) {
      const dur = E8 * 16;
      if (lvl.choir > 0.02) choir(CHOIR[ch], t, dur, L.choir, 0.36, Math.random() > 0.5 ? 'oo' : 'ah', Math.random() > 0.5 ? 'ah' : 'eh');
      if (lvl.organ > 0.02) organ(ORGAN[ch], t, dur - 0.3, L.organ, 0.26);
    }
    const note = MELODY[bar][s];
    if (note && lvl.box > 0.02 && Math.random() > 0.05) {
      musicBox(note, t + rand(-0.015, 0.015), L.box, rand(0.75, 1), warble);
      if (Math.random() < 0.12) musicBox(note - 12, t + E8 * 0.5, L.box, 0.35, warble);
    }
    if (lvl.bass > 0.02) bow(ROOTS[ch] + OSTINATO[s], t, E8 * 0.92, L.bass, s % 2 === 0 ? 1 : 0.65);
    if (lvl.cel > 0.02 && Math.random() < 0.2) musicBox(CHOIR[ch][Math.floor(Math.random() * 4)] + 24, t, L.cel, rand(0.4, 0.8), 4);
  }

  function update(f) {
    const W = f.W;
    lvl = {
      box: Math.max(W.valley * (1 - W.gates * 0.4) * 0.9, W.invite * 0.85, W.grave * 0.55),
      choir: Math.max(W.void * (1 - W.clock * 0.75) * 0.42, W.grave * 0.32),
      organ: W.clock * 0.75 + W.apo * (f.midnight ? 0.25 : 0.1),
      bass: Math.min(1, W.gates * (0.35 + 0.65 * f.velN) + W.apo * (f.midnight ? 0.45 : 0.25) + W.clock * 0.3),
      cel: W.deck * 0.6 + W.oracle * 0.45,
    };
    warble = f.midnight ? 34 : 10 + W.invite * 20;
    for (const k in L) setParam(L[k].gain, lvl[k], 0.6);

    const t = c.currentTime;
    if (nextT < t) nextT = t + 0.05; // resync after a pause
    while (nextT < t + 0.3) { schedule(step++, nextT); nextT += E8; }
  }

  return { update };
}
