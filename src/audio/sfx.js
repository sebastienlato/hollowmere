/* One-shot sound effects. Each is fully synthesised and routed through route(). */
import { ac, gain, biquad, tone, noise, perc, swell, shaper, route, duck, mtof, rand, pick } from './engine.js';
import { musicBox, choir, organ, pluck, bell, clang } from './instruments.js';

const T = () => ac().currentTime;
const SCALE = [62, 64, 65, 67, 69, 70, 73]; // D harmonic minor from D4
const scaleNote = (i) => SCALE[((i % 7) + 7) % 7] + 12 * Math.floor(i / 7);

/* ── transitions ── */
export function reverseSwell(dur = 1.6, level = 0.5, o = {}) {
  const t = T() + (o.delay || 0);
  const out = route({ verb: 0.5, life: dur + 3, ...o });
  const bp = biquad('bandpass', 400, 0.9);
  bp.frequency.setValueAtTime(350, t);
  bp.frequency.exponentialRampToValueAtTime(7000, t + dur);
  const g = gain(0);
  noise('pink', t, dur + 0.05, bp); bp.connect(g).connect(out);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level * 2.4, t + dur);
  g.gain.linearRampToValueAtTime(0, t + dur + 0.04);
}

export function boom(level = 1, o = {}) {
  const t = T() + (o.delay || 0);
  const out = route({ verb: 0.6, life: 5, ...o });
  const sh = shaper(2.5), lp = biquad('lowpass', 380, 0.7), g = gain();
  sh.connect(lp).connect(g).connect(out);
  const s = tone('sine', 62, t, 3, sh);
  s.frequency.exponentialRampToValueAtTime(26, t + 1.6);
  perc(g.gain, t, 0.006, 0.9 * level, 2.6);
  const n = gain(); const nl = biquad('lowpass', 220, 0.7);
  noise('brown', t, 1.5, nl); nl.connect(n).connect(out);
  perc(n.gain, t, 0.01, 0.8 * level, 1.3);
}

/* Cinematic "braaam": a low brass cluster that opens up and dies away. */
export function braam(level = 1, o = {}) {
  const t = T() + (o.delay || 0);
  const out = route({ bus: 'music', verb: 0.7, life: 7, ...o });
  const lp = biquad('lowpass', 150, 1.4), sh = shaper(2.2), g = gain();
  lp.connect(sh).connect(g).connect(out);
  [38, 50, 57, 62].forEach((m) => [-12, 0, 11].forEach((d) => tone('sawtooth', mtof(m), t, 4.6, lp, d)));
  lp.frequency.setValueAtTime(150, t);
  lp.frequency.exponentialRampToValueAtTime(1500, t + 0.35);
  lp.frequency.exponentialRampToValueAtTime(260, t + 3.6);
  swell(g.gain, t, 0.12, 0.3 * level, 0.6, 3.2);
}

export function whoosh(strength = 1, o = {}) {
  const t = T();
  const out = route({ verb: 0.35, life: 3, ...o });
  const bp = biquad('bandpass', 250, 0.8), g = gain();
  noise('pink', t, 2.2, bp); bp.connect(g).connect(out);
  bp.frequency.setValueAtTime(250, t);
  bp.frequency.exponentialRampToValueAtTime(2600, t + 0.7);
  bp.frequency.exponentialRampToValueAtTime(400, t + 1.8);
  swell(g.gain, t, 0.55, 1.1 * strength, 0.1, 1.2);
}

/* The séance board burns and the veil opens. */
export function veilOpen() {
  reverseSwell(1.3, 0.45);
  const t = T();
  const out = route({ verb: 0.4, life: 4 });
  const bp = biquad('bandpass', 900, 0.5), g = gain();
  noise('brown', t, 2.5, bp); bp.connect(g).connect(out);
  bp.frequency.setValueAtTime(300, t);
  bp.frequency.exponentialRampToValueAtTime(2200, t + 1.1);
  swell(g.gain, t, 0.5, 0.6, 0.3, 1.5);
  setTimeout(() => { boom(0.9); braam(0.8); duck(0.5, 1.2); choirHit([50, 57, 62, 65], 0.35); }, 1250);
}

export function choirHit(notes, level = 0.3) {
  const out = route({ bus: 'music', verb: 0.8, life: 9 });
  choir(notes, T(), 2.2, out, level, 'ah', 'oo');
}

/* ── gates ── */
export function creak(o = {}) {
  const t = T();
  const out = route({ verb: 0.35, life: 4, pan: -0.2, ...o });
  const osc = ac().createOscillator(); osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(48, t);
  osc.frequency.linearRampToValueAtTime(130, t + 0.8);
  osc.frequency.linearRampToValueAtTime(70, t + 1.7);
  osc.frequency.linearRampToValueAtTime(95, t + 2.3);
  const jit = gain(35); const jl = biquad('lowpass', 70, 0.7);
  noise('white', t, 2.6, jl); jl.connect(jit).connect(osc.frequency);
  const mix = gain(1);
  [[620, 12, 1], [1380, 14, 0.7], [2900, 16, 0.4]].forEach(([f, q, a]) => { const b = biquad('bandpass', f, q), g = gain(a * 3); osc.connect(b).connect(g).connect(mix); });
  const env = gain(); mix.connect(env).connect(out);
  osc.start(t); osc.stop(t + 2.6);
  swell(env.gain, t, 0.25, 0.4, 1.6, 0.6);
  const r = gain(); const rl = biquad('lowpass', 180, 0.7);
  noise('brown', t + 0.2, 2.2, rl); rl.connect(r).connect(out);
  swell(r.gain, t + 0.2, 0.5, 0.35, 0.8, 0.9);
}

export function gateClang() {
  const t = T();
  clang(196, t, route({ verb: 0.5, pan: -0.5, life: 3 }), 0.9);
  clang(207, t + 0.09, route({ verb: 0.5, pan: 0.5, life: 3 }), 0.7);
  chains(0.8);
}

export function chains(level = 1) {
  const t = T();
  const out = route({ verb: 0.3, life: 2 });
  for (let i = 0; i < 14; i++) {
    const tt = t + i * rand(0.03, 0.07);
    const g = gain(); g.connect(out);
    tone('sine', rand(2200, 4200), tt, 0.1, g);
    perc(g.gain, tt, 0.001, 0.05 * level, 0.05);
  }
}

/* Swarm of bats sweeping past the camera. */
export function flutter(count = 7) {
  const t = T();
  for (let b = 0; b < count; b++) {
    const start = t + rand(0, 0.8), dur = rand(1.0, 1.8);
    const sp = ac().createStereoPanner();
    const from = rand(-1, 1);
    sp.pan.setValueAtTime(from, start);
    sp.pan.linearRampToValueAtTime(-from * rand(0.6, 1), start + dur);
    const out = route({ verb: 0.2, life: 4 });
    const bp = biquad('bandpass', rand(1400, 2600), 1.6), g = gain(0);
    noise('white', start, dur, bp); bp.connect(g).connect(sp).connect(out);
    const rate = rand(11, 15);
    for (let k = 0; k < dur * rate; k++) {
      const tt = start + k / rate;
      const peak = 0.22 * Math.sin((k / (dur * rate)) * Math.PI);
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.linearRampToValueAtTime(peak, tt + 0.012);
      g.gain.linearRampToValueAtTime(0.0001, tt + 0.05);
    }
  }
}

export function pumpkinPass(pan = 0) {
  const t = T();
  const out = route({ verb: 0.2, pan, life: 2 });
  const lp = biquad('lowpass', 150, 1.2), g = gain();
  noise('brown', t, 0.9, lp); lp.connect(g).connect(out);
  lp.frequency.setValueAtTime(150, t);
  lp.frequency.exponentialRampToValueAtTime(900, t + 0.18);
  lp.frequency.exponentialRampToValueAtTime(180, t + 0.7);
  swell(g.gain, t, 0.12, 0.85, 0.05, 0.5);
  crackle(t, out, 6, 0.6);
}

export function crackle(t, dest, n = 5, spread = 0.5, level = 1) {
  for (let i = 0; i < n; i++) {
    const tt = t + rand(0, spread);
    const g = gain(), hp = biquad('highpass', rand(1500, 3500), 0.7);
    noise('white', tt, 0.02, hp); hp.connect(g).connect(dest);
    perc(g.gain, tt, 0.0008, rand(0.05, 0.2) * level, rand(0.004, 0.015));
  }
}

/* ── the veil ── */
export function portal() {
  reverseSwell(1.2, 0.5);
  setTimeout(() => { boom(1); braam(1); duck(0.55, 1.4); choirHit([38, 50, 57, 62, 65], 0.32); }, 1150);
}

export function harpGliss(up = true) {
  const t = T();
  const out = route({ bus: 'music', verb: 0.6, life: 5 });
  for (let i = 0; i < 12; i++) {
    const idx = up ? i : 11 - i;
    pluck(scaleNote(idx), t + i * 0.055, out, 0.6 + i * 0.02);
  }
}

export function flip(index = 0) {
  const t = T();
  const out = route({ verb: 0.25, life: 2 });
  const bp = biquad('bandpass', 1200, 0.9), g = gain();
  noise('white', t, 0.3, bp); bp.connect(g).connect(out);
  bp.frequency.setValueAtTime(900, t);
  bp.frequency.exponentialRampToValueAtTime(5500, t + 0.14);
  perc(g.gain, t, 0.02, 0.22, 0.14);
  const cel = route({ bus: 'music', verb: 0.55, life: 4 });
  const n = [74, 77, 81, 85, 86, 89][index % 6];
  musicBox(n, t + 0.08, cel, 0.9);
  musicBox(n + 12, t + 0.08, cel, 0.3);
}

export function sparkle(n = 8, level = 0.8) {
  const t = T();
  const out = route({ bus: 'music', verb: 0.6, life: 5 });
  for (let i = 0; i < n; i++) musicBox(scaleNote(Math.floor(rand(7, 17))), t + i * rand(0.05, 0.11), out, level * rand(0.5, 1));
  const s = gain(), hp = biquad('highpass', 7000, 0.7);
  noise('white', t, 1.4, hp); hp.connect(s).connect(out);
  swell(s.gain, t, 0.3, 0.06 * level, 0.2, 0.8);
}

export function whisper(o = {}) {
  const t = T() + (o.delay || 0);
  const dur = o.dur || rand(1.2, 2.2);
  const out = route({ verb: 0.6, life: dur + 3, ...o });
  const src = gain(1);
  noise('pink', t, dur + 0.2, src);
  const sum = gain(0);
  sum.connect(out);
  [[700, 8], [1250, 10], [2600, 12]].forEach(([f, q]) => {
    const b = biquad('bandpass', f, q), g = gain(2.2);
    src.connect(b).connect(g).connect(sum);
    for (let k = 0; k < dur / 0.11; k++) b.frequency.setValueAtTime(f * rand(0.65, 1.45), t + k * rand(0.08, 0.14));
  });
  const sib = gain(0), hp = biquad('highpass', 5500, 0.7);
  noise('white', t, dur, hp); hp.connect(sib).connect(out);
  for (let k = 0; k < 4; k++) perc(sib.gain, t + rand(0, dur), 0.02, rand(0.03, 0.07) * (o.level || 1), 0.12);
  swell(sum.gain, t, 0.35, 0.35 * (o.level || 1), dur - 0.7, 0.5);
}

export function spiritFound() {
  reverseSwell(0.9, 0.3);
  whisper({ delay: 0.5, level: 1.2 });
  setTimeout(() => { sparkle(6, 0.7); choirHit([62, 69, 74], 0.22); }, 850);
}

export function oracle() {
  reverseSwell(0.7, 0.3);
  setTimeout(() => { sparkle(10, 0.9); boom(0.35); whisper({ level: 0.9, pan: rand(-0.6, 0.6) }); }, 650);
}

/* ── the clock ── */
export function midnight() {
  duck(0.6, 3, 4);
  reverseSwell(1.0, 0.4);
  setTimeout(() => {
    const out = route({ bus: 'music', verb: 0.9, life: 12 });
    organ([26, 38, 50, 53, 56, 62, 65, 68], T(), 4.5, out, 0.55);
    boom(1);
    thunder(0.7);
    for (let i = 0; i < 12; i++) {
      setTimeout(() => bell(98 * (i % 2 ? 1 : 1.0), T(), route({ verb: 0.8, life: 9, pan: i % 2 ? 0.25 : -0.25 }), 1 - i * 0.045), i * 1250);
    }
  }, 950);
}

export function tick(tock = false, o = {}) {
  const t = T();
  const out = route({ verb: 0.35, life: 1, ...o });
  const bp = biquad('bandpass', tock ? 2100 : 3200, 4), g = gain();
  noise('white', t, 0.02, bp); bp.connect(g).connect(out);
  perc(g.gain, t, 0.0008, 1.6, 0.014);
  const s = gain(); s.connect(out);
  tone('sine', tock ? 1250 : 1800, t, 0.1, s);
  perc(s.gain, t, 0.001, 0.4, 0.05);
  const th = gain(); th.connect(out);
  tone('sine', tock ? 160 : 190, t, 0.12, th);
  perc(th.gain, t, 0.002, 0.8, 0.07);
}

/* ── apothecary ── */
export function clink(key = 'phantom') {
  const t = T();
  const out = route({ verb: 0.5, life: 3 });
  const base = { mortal: 86, phantom: 89, undying: 81 }[key] || 86;
  [[1, 1], [2.76, 0.4], [5.4, 0.18]].forEach(([r, a], i) => {
    const g = gain(); g.connect(out);
    tone('sine', mtof(base) * r * rand(0.995, 1.005), t, 1.2, g);
    perc(g.gain, t, 0.002, 0.28 * a, 0.9 / (i + 1));
  });
}

export function glug() {
  const t = T();
  const out = route({ verb: 0.3, life: 3 });
  for (let i = 0; i < 6; i++) {
    const tt = t + 0.35 + i * rand(0.11, 0.16);
    const f = 260 + i * 70;
    const b = biquad('bandpass', f, 7), g = gain();
    noise('pink', tt, 0.2, b); b.connect(g).connect(out);
    perc(g.gain, tt, 0.01, 1.6, 0.1);
    const s = gain(); s.connect(out);
    const o = tone('sine', f * 0.9, tt, 0.12, s);
    o.frequency.exponentialRampToValueAtTime(f * 1.7, tt + 0.07);
    perc(s.gain, tt, 0.004, 0.12, 0.06);
  }
}

export function splash() {
  const t = T();
  duck(0.35, 0.6);
  const out = route({ verb: 0.45, life: 4 });
  const lp = biquad('lowpass', 3500, 0.6), g = gain();
  noise('white', t, 1, lp); lp.connect(g).connect(out);
  lp.frequency.setValueAtTime(3500, t);
  lp.frequency.exponentialRampToValueAtTime(500, t + 0.7);
  perc(g.gain, t, 0.008, 0.55, 0.6);
  boom(0.35);
  for (let i = 0; i < 14; i++) {
    const tt = t + 0.1 + rand(0, 1.2);
    const s = gain(); s.connect(out);
    const f = rand(280, 800);
    const o = tone('sine', f, tt, 0.1, s);
    o.frequency.exponentialRampToValueAtTime(f * 1.8, tt + 0.05);
    perc(s.gain, tt, 0.003, 0.08, 0.05);
  }
  const z = gain(), hp = biquad('highpass', 4500, 0.7);
  noise('white', t + 0.1, 1.8, hp); hp.connect(z).connect(out);
  for (let k = 0; k < 40; k++) z.gain.setValueAtTime(Math.random() * 0.06 * (1 - k / 40), t + 0.1 + k * 0.04);
  z.gain.setValueAtTime(0, t + 1.8);
  setTimeout(() => { sparkle(9, 0.8); choirHit([62, 65, 69, 74], 0.22); }, 400);
}

/* ── invitation ── */
export function crack() {
  const t = T();
  duck(0.4, 0.5);
  const out = route({ verb: 0.35, life: 3 });
  for (let i = 0; i < 9; i++) {
    const tt = t + rand(0, 0.32) + (i > 5 ? 0.3 : 0);
    const g = gain(), hp = biquad('highpass', rand(900, 2600), 0.8);
    noise('white', tt, 0.01, hp); hp.connect(g).connect(out);
    perc(g.gain, tt, 0.0006, rand(0.25, 0.6), rand(0.003, 0.012));
  }
  const th = gain(); th.connect(out);
  const o = tone('sine', 190, t + 0.33, 0.3, th);
  o.frequency.exponentialRampToValueAtTime(80, t + 0.5);
  perc(th.gain, t + 0.33, 0.003, 0.5, 0.18);
  setTimeout(paper, 700);
}

export function paper() {
  const t = T();
  const out = route({ verb: 0.2, life: 2 });
  const bp = biquad('bandpass', 3200, 0.7), g = gain(0);
  noise('white', t, 0.9, bp); bp.connect(g).connect(out);
  for (let k = 0; k < 45; k++) g.gain.setValueAtTime(Math.random() ** 3 * 0.35, t + k * 0.017);
  g.gain.setValueAtTime(0, t + 0.8);
}

export function quill() {
  const t = T();
  const out = route({ bus: 'ui', verb: 0.1, life: 1 });
  const bp = biquad('bandpass', rand(3800, 5200), 3), g = gain();
  noise('white', t, 0.08, bp); bp.connect(g).connect(out);
  bp.frequency.setValueAtTime(bp.frequency.value, t);
  bp.frequency.linearRampToValueAtTime(bp.frequency.value * 1.3, t + 0.05);
  perc(g.gain, t, 0.006, 1.3, 0.05);
}

export function pact() {
  const t = T();
  const out = route({ bus: 'music', verb: 0.8, life: 9 });
  organ([50, 57, 62, 65, 69], t, 2.5, out, 0.35);
  sparkle(12, 0.9);
  bell(147, t + 0.1, route({ verb: 0.8, life: 8 }), 0.6);
}

/* ── graveyard & creatures ── */
export function bones(o = {}) {
  const t = T();
  const out = route({ verb: 0.3, life: 2, ...o });
  for (let i = 0; i < 9; i++) {
    const tt = t + rand(0, 0.35);
    const g = gain(); g.connect(out);
    tone('sine', rand(900, 2300), tt, 0.05, g);
    perc(g.gain, tt, 0.001, 0.09, 0.025);
  }
  const d = gain(), lp = biquad('lowpass', 700, 0.7);
  noise('brown', t, 0.6, lp); lp.connect(d).connect(out);
  for (let k = 0; k < 16; k++) d.gain.setValueAtTime(Math.random() * 0.4, t + k * 0.03);
  d.gain.setValueAtTime(0, t + 0.5);
}

export function caw(o = {}) {
  const t0 = T();
  const out = route({ verb: 0.4, life: 2, ...o });
  for (let k = 0; k < 2; k++) {
    const t = t0 + k * 0.34;
    const o1 = ac().createOscillator(); o1.type = 'sawtooth';
    o1.frequency.setValueAtTime(640, t); o1.frequency.exponentialRampToValueAtTime(390, t + 0.24);
    const rasp = ac().createOscillator(); rasp.frequency.value = 85;
    const rg = gain(260); rasp.connect(rg).connect(o1.frequency);
    const b1 = biquad('bandpass', 1300, 3), b2 = biquad('bandpass', 2600, 4), g = gain();
    o1.connect(b1).connect(g); o1.connect(b2).connect(g); g.connect(out);
    o1.start(t); rasp.start(t); o1.stop(t + 0.3); rasp.stop(t + 0.3);
    swell(g.gain, t, 0.02, 0.35, 0.12, 0.1);
  }
}

export function owl(o = {}) {
  const t0 = T();
  const out = route({ bus: 'amb', verb: 0.6, life: 4, ...o });
  [[0, 0.5], [0.95, 0.22], [1.25, 0.3]].forEach(([dt, len]) => {
    const t = t0 + dt;
    const g = gain(), lp = biquad('lowpass', 900, 0.7);
    const s = tone('sine', 395, t, len + 0.2, lp);
    s.frequency.linearRampToValueAtTime(355, t + len);
    lp.connect(g).connect(out);
    swell(g.gain, t, 0.06, 0.12, len * 0.5, len * 0.5);
  });
}

export function wolf(o = {}) {
  const t = T();
  const out = route({ bus: 'amb', verb: 0.8, life: 6, ...o });
  const f0 = rand(330, 420);
  const vib = ac().createOscillator(); vib.frequency.value = 5.2;
  const vg = gain(0); vib.connect(vg);
  vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(9, t + 2);
  const sum = gain(1), lp = biquad('lowpass', 2200, 0.6), env = gain();
  [['sine', 1], ['sawtooth', 0.35], ['triangle', 0.5]].forEach(([type, a]) => {
    const g = gain(a); g.connect(sum);
    const osc = tone(type, f0 * 0.85, t, 3.8, g);
    osc.frequency.exponentialRampToValueAtTime(f0 * 1.6, t + 0.9);
    osc.frequency.linearRampToValueAtTime(f0 * 1.52, t + 2.3);
    osc.frequency.exponentialRampToValueAtTime(f0 * 1.05, t + 3.4);
    vg.connect(osc.frequency);
  });
  [[450, 6, 1], [900, 7, 0.45]].forEach(([f, q, a]) => { const b = biquad('bandpass', f, q), g = gain(a * 2); sum.connect(b).connect(g).connect(lp); });
  lp.connect(env).connect(out);
  vib.start(t); vib.stop(t + 3.8);
  swell(env.gain, t, 0.5, 0.17, 2.2, 1.0);
}

export function thunder(level = 1) {
  const t = T() + 0.2;
  const crack = route({ verb: 0.5, life: 2, pan: rand(-0.4, 0.4) });
  const hp = biquad('highpass', 1200, 0.7), g = gain();
  noise('white', t, 0.2, hp); hp.connect(g).connect(crack);
  perc(g.gain, t, 0.002, 0.5 * level, 0.15);
  [-0.6, 0.6].forEach((pan, i) => {
    const out = route({ verb: 0.6, life: 7, pan });
    const lp = biquad('lowpass', 240, 0.7), r = gain(0);
    noise('brown', t, 5.5, lp, 0.8 + i * 0.1); lp.connect(r).connect(out);
    r.gain.setValueAtTime(0, t);
    let v = 0;
    for (let k = 0; k < 40; k++) { v = Math.max(0, (1 - k / 40)) * rand(0.25, 1); r.gain.linearRampToValueAtTime(v * 0.9 * level, t + 0.05 + k * 0.13); }
    r.gain.linearRampToValueAtTime(0, t + 5.4);
  });
}

export function distantBell() { bell(pick([98, 110, 87]), T(), route({ bus: 'amb', verb: 1, life: 9, pan: rand(-0.7, 0.7), level: 0.35 }), 0.6); }

/* ── UI ── */
export function uiTick(level = 1) {
  const t = T();
  const out = route({ bus: 'ui', verb: 0.15, life: 1 });
  const g = gain(); g.connect(out);
  tone('sine', 880, t, 0.08, g);
  perc(g.gain, t, 0.001, 0.4 * level, 0.05);
  const c = gain(), hp = biquad('highpass', 3000, 0.7);
  noise('white', t, 0.01, hp); hp.connect(c).connect(out);
  perc(c.gain, t, 0.0005, 0.45 * level, 0.008);
}
