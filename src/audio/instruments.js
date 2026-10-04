/* Synthesised instruments. Every function schedules at time `t` into `dest`. */
import { ac, gain, biquad, tone, noise, perc, swell, shaper, mtof, rand } from './engine.js';

/* Music box / celesta: a struck tine with inharmonic overtones and a tiny mechanical click. */
export function musicBox(m, t, dest, vel = 1, warble = 0) {
  const f = mtof(m) * Math.pow(2, (rand(-1, 1) * warble) / 1200);
  const out = gain(1);
  out.connect(dest);
  const partials = [[1, 1, 2.8], [2.0, 0.22, 1.0], [5.4, 0.09, 0.22], [8.93, 0.035, 0.09]];
  for (const [r, a, d] of partials) {
    const g = gain(); g.connect(out);
    tone('sine', f * r, t, d + 0.1, g);
    perc(g.gain, t, 0.002, a * vel * 0.2, d);
  }
  const c = gain(); const hp = biquad('highpass', 5000, 0.7);
  noise('white', t, 0.03, hp); hp.connect(c); c.connect(out);
  perc(c.gain, t, 0.001, 0.05 * vel, 0.012);
}

const VOWELS = {
  ah: [[720, 1, 9], [1120, 0.5, 11], [2550, 0.22, 13]],
  oo: [[330, 1, 9], [820, 0.38, 11], [2350, 0.12, 13]],
  eh: [[520, 1, 9], [1750, 0.45, 12], [2600, 0.2, 13]],
};

/* Choir: detuned saw voices through a shared vowel-formant bank, slowly morphing vowels. */
export function choir(notes, t, dur, dest, level = 0.5, from = 'oo', to = 'ah') {
  const sum = gain(1), out = gain(0);
  out.connect(dest);
  VOWELS[from].forEach(([f, a, q], i) => {
    const b = biquad('bandpass', f, q), g = gain(a * 2.2);
    b.frequency.setValueAtTime(f, t);
    b.frequency.linearRampToValueAtTime(VOWELS[to][i][0], t + dur * 0.8);
    sum.connect(b).connect(g).connect(out);
  });
  const vib = ac().createOscillator(); vib.frequency.value = rand(4.4, 5.2);
  const vg = gain(10); vib.connect(vg);
  const len = dur + 3.5;
  notes.forEach((m) => [-8, 0, 7].forEach((dt) => { const o = tone('sawtooth', mtof(m), t, len, sum, dt + rand(-2, 2)); vg.connect(o.detune); }));
  vib.start(t); vib.stop(t + len);
  swell(out.gain, t, Math.min(2.2, dur * 0.4), level, Math.max(0.1, dur - 2.2), 3.2);
}

/* Pipe organ: additive ranks (16' 8' 4' 2⅔' 2') with chiff and tremulant. */
export function organ(notes, t, dur, dest, level = 0.3) {
  const out = gain(0);
  const lp = biquad('lowpass', 3200, 0.4);
  lp.connect(out); out.connect(dest);
  const trem = ac().createOscillator(); trem.frequency.value = 5.4;
  const tg = gain(level * 0.06); trem.connect(tg).connect(out.gain);
  trem.start(t); trem.stop(t + dur + 1.6);
  const ranks = [[0.5, 0.55], [1, 1], [2, 0.5], [3, 0.2], [4, 0.16]];
  notes.forEach((m) => {
    const f = mtof(m);
    ranks.forEach(([r, a]) => { const g = gain(a / notes.length); g.connect(lp); tone('sine', f * r, t, dur + 1.6, g, rand(-3, 3)); });
    const ch = gain(); const bp = biquad('bandpass', f * 3, 3);
    noise('white', t, 0.12, bp); bp.connect(ch); ch.connect(out);
    perc(ch.gain, t, 0.005, 0.25 / notes.length, 0.08);
  });
  swell(out.gain, t, 0.09, level, dur, 1.4);
}

/* Bowed low string: detuned saws through an opening/closing low-pass. */
export function bow(m, t, dur, dest, vel = 1) {
  const out = gain(0);
  const lp = biquad('lowpass', 220, 2.2);
  lp.connect(out); out.connect(dest);
  [-6, 5].forEach((d) => tone('sawtooth', mtof(m), t, dur + 0.5, lp, d));
  lp.frequency.setValueAtTime(220, t);
  lp.frequency.exponentialRampToValueAtTime(500 + 700 * vel, t + 0.06);
  lp.frequency.exponentialRampToValueAtTime(320, t + dur);
  swell(out.gain, t, 0.035, 0.22 * vel, dur * 0.4, dur * 0.6 + 0.3);
}

/* Plucked harp string. */
export function pluck(m, t, dest, vel = 1) {
  const f = mtof(m);
  const out = gain(0);
  const lp = biquad('lowpass', 4500, 0.6);
  lp.connect(out); out.connect(dest);
  lp.frequency.setValueAtTime(4500, t);
  lp.frequency.exponentialRampToValueAtTime(700, t + 1.4);
  tone('triangle', f, t, 2.4, lp);
  const g2 = gain(0.25); g2.connect(lp); tone('sine', f * 2, t, 2.4, g2);
  perc(out.gain, t, 0.003, 0.28 * vel, 2.1);
}

/* Church bell: additive partials (hum, prime, tierce, quint, nominal…) + strike. */
export function bell(f, t, dest, vel = 1) {
  const out = gain(1);
  out.connect(dest);
  const P = [[0.5, 0.6, 7.5], [1, 1, 5.5], [1.19, 0.42, 3.6], [1.5, 0.3, 2.8], [2, 0.5, 2.4], [2.52, 0.2, 1.7], [3.01, 0.14, 1.3], [4.07, 0.08, 0.8]];
  P.forEach(([r, a, d]) => {
    const g = gain(); g.connect(out);
    tone('sine', f * r, t, d + 0.3, g, rand(-5, 5));
    perc(g.gain, t, 0.004, a * vel * 0.22, d);
  });
  const s = gain(); const bp = biquad('bandpass', 2400, 0.8);
  noise('white', t, 0.1, bp); bp.connect(s); s.connect(out);
  perc(s.gain, t, 0.001, 0.22 * vel, 0.05);
}

/* Metallic clang (iron gate, chains). */
export function clang(f, t, dest, vel = 1) {
  const out = gain(1); out.connect(dest);
  [[1, 1, 1.6], [2.32, 0.6, 1.1], [3.87, 0.45, 0.8], [5.21, 0.3, 0.5], [6.9, 0.2, 0.35]].forEach(([r, a, d]) => {
    const g = gain(); g.connect(out);
    tone('sine', f * r, t, d + 0.2, g, rand(-10, 10));
    perc(g.gain, t, 0.002, a * vel * 0.18, d);
  });
  const s = gain(); const bp = biquad('bandpass', 3000, 0.6);
  noise('white', t, 0.08, bp); bp.connect(s); s.connect(out);
  perc(s.gain, t, 0.001, 0.3 * vel, 0.04);
}

/* Singing bowl: sustained, gently beating partials (persistent voice). */
export function bowl(f, dest) {
  const out = gain(0); out.connect(dest);
  const t = ac().currentTime;
  [[1, 1, 0.6], [2.71, 0.45, 1.1], [5.1, 0.18, 1.7]].forEach(([r, a, beat]) => {
    [0, beat].forEach((b) => { const g = gain(a * 0.5); g.connect(out); tone('sine', f * r + b, t, 1e5, g); });
  });
  return out;
}

/* Theremin: one continuous sine with vibrato, glide and a little tube warmth. */
export function theremin(dest) {
  const c = ac();
  const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 440;
  const lfo = c.createOscillator(); lfo.frequency.value = 5.6;
  const depth = gain(5); lfo.connect(depth).connect(o.frequency);
  const sh = shaper(1.6), hp = biquad('highpass', 180, 0.7), out = gain(0);
  o.connect(sh).connect(hp).connect(out).connect(dest);
  o.start(); lfo.start();
  return { osc: o, depth, out };
}

/* Heartbeat: lub-dub through a dark low-pass. */
export function heartbeat(t, dest, lvl = 1) {
  const lp = biquad('lowpass', 160, 0.8), out = gain(1);
  lp.connect(out).connect(dest);
  [[0, 62, 40, 1], [0.2, 54, 34, 0.7]].forEach(([dt, f0, f1, a]) => {
    const g = gain(); g.connect(lp);
    const o = tone('sine', f0, t + dt, 0.3, g);
    o.frequency.exponentialRampToValueAtTime(f1, t + dt + 0.15);
    perc(g.gain, t + dt, 0.012, 0.9 * lvl * a, 0.2);
  });
}
