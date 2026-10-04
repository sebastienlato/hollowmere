/* Core of the Hollowmere sound engine: context, buses, reverbs, 3D panning
   and the small DSP helpers every instrument and effect is built from. */
export const E = {};
let ctx = null;
export const ac = () => ctx;
export const now = () => ctx.currentTime;
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function makeNoise(kind, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w;
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      } else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    }
  }
  return buf;
}

/* Stereo impulse response: pre-delay, early reflections, and a tail that darkens as it decays. */
function makeImpulse(seconds, decay, damp) {
  const rate = ctx.sampleRate, len = Math.floor(rate * seconds), pre = Math.floor(rate * 0.02);
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const k = (i - pre) / (len - pre);
      lp += (0.92 - k * damp) * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * Math.pow(1 - k, decay);
    }
    for (let r = 0; r < 10; r++) d[pre + Math.floor(rate * rand(0.004, 0.07))] += (Math.random() * 2 - 1) * 0.5 * (1 - r / 10);
  }
  return buf;
}

export function createEngine(context) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!context && !AC) return false;
  ctx = context || new AC({ latencyHint: 'interactive' });
  E.white = makeNoise('white', 3);
  E.pink = makeNoise('pink', 3);
  E.brown = makeNoise('brown', 3);

  E.out = ctx.createGain();
  E.out.gain.value = context ? 1 : 0;
  E.muffle = biquad('lowpass', 20000, 0.5);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.008; comp.release.value = 0.35;
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.15;
  E.mix = gain(1);
  E.mix.connect(E.muffle).connect(comp).connect(lim).connect(E.out).connect(ctx.destination);

  const bus = (v) => { const g = gain(v); g.connect(E.mix); return g; };
  E.music = bus(0.55); E.amb = bus(0.8); E.sfx = bus(0.9); E.ui = bus(0.5);

  // two rooms: an open-air hall for the valley, a cathedral for the veil
  E.verbIn = gain(1);
  const hp = biquad('highpass', 160, 0.5);
  E.verbIn.connect(hp);
  const hall = ctx.createConvolver(); hall.buffer = makeImpulse(3.4, 3.2, 0.7);
  const cath = ctx.createConvolver(); cath.buffer = makeImpulse(7.5, 2.1, 0.8);
  E.hallG = gain(0.9); E.cathG = gain(0);
  hp.connect(hall).connect(E.hallG).connect(E.mix);
  hp.connect(cath).connect(E.cathG).connect(E.mix);
  return true;
}

/* ─── node helpers ─── */
export function gain(v = 0) { const g = ctx.createGain(); g.gain.value = v; return g; }
export function biquad(type, f, q = 0.7) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
export function tone(type, f, t, dur, dest, detune = 0) {
  const o = ctx.createOscillator();
  o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
  o.connect(dest); o.start(t); o.stop(t + dur);
  return o;
}
export function noise(kind, t, dur, dest, rate = 1) {
  const s = ctx.createBufferSource();
  s.buffer = E[kind]; s.loop = true; s.playbackRate.value = rate;
  s.connect(dest); s.start(t, Math.random() * 2.5); s.stop(t + dur);
  return s;
}
export function loopNoise(kind, dest, rate = 1) {
  const s = ctx.createBufferSource();
  s.buffer = E[kind]; s.loop = true; s.playbackRate.value = rate;
  s.connect(dest); s.start(ctx.currentTime, Math.random() * 2.5);
  return s;
}
/* percussive envelope */
export function perc(param, t, a, peak, d) {
  param.setValueAtTime(0.0001, t);
  param.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
  param.exponentialRampToValueAtTime(0.0001, t + a + d);
}
/* swell: attack → hold → release */
export function swell(param, t, a, peak, hold, r) {
  param.setValueAtTime(0.0001, t);
  param.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
  param.setValueAtTime(Math.max(peak, 0.0002), t + a + hold);
  param.exponentialRampToValueAtTime(0.0001, t + a + hold + r);
}
export function shaper(amount = 2) {
  const w = ctx.createWaveShaper();
  const n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * amount) / Math.tanh(amount); }
  w.curve = c; w.oversample = '2x';
  return w;
}
export function setParam(param, v, tc = 0.1) { param.setTargetAtTime(v, ctx.currentTime, tc); }

/* ─── routing ─── */
export function panner(at, { ref = 4, roll = 1.25, max = 120 } = {}) {
  const p = ctx.createPanner();
  p.panningModel = 'HRTF'; p.distanceModel = 'inverse';
  p.refDistance = ref; p.rolloffFactor = roll; p.maxDistance = max;
  if (at) setPos(p, at);
  return p;
}
export function setPos(p, v) {
  if (p.positionX) { p.positionX.value = v.x; p.positionY.value = v.y; p.positionZ.value = v.z; }
  else p.setPosition(v.x, v.y, v.z);
}
/* A voice's entry point: gain → (3D panner | stereo pan) → bus, with a reverb send. */
export function route({ bus = 'sfx', pan = 0, verb = 0.25, at = null, level = 1, life = 6, dist } = {}) {
  const g = gain(level);
  let node = g;
  if (at) { node = panner(at, dist); g.connect(node); }
  else if (pan) { node = ctx.createStereoPanner(); node.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(node); }
  node.connect(E[bus]);
  let s = null;
  if (verb > 0) { s = gain(verb); node.connect(s); s.connect(E.verbIn); }
  if (life) setTimeout(() => { try { g.disconnect(); node.disconnect(); s?.disconnect(); } catch {} }, life * 1000 + 400);
  return g;
}

export function setListener(pos, fwd) {
  const l = ctx.listener, t = ctx.currentTime;
  if (l.positionX) {
    l.positionX.setTargetAtTime(pos.x, t, 0.04); l.positionY.setTargetAtTime(pos.y, t, 0.04); l.positionZ.setTargetAtTime(pos.z, t, 0.04);
    l.forwardX.setTargetAtTime(fwd.x, t, 0.04); l.forwardY.setTargetAtTime(fwd.y, t, 0.04); l.forwardZ.setTargetAtTime(fwd.z, t, 0.04);
    l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
  } else {
    l.setPosition(pos.x, pos.y, pos.z);
    l.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0);
  }
}

/* Momentarily pull music + ambience down so a stinger can land. */
export function duck(amount = 0.45, hold = 0.8, rel = 1.6) {
  const t = ctx.currentTime;
  for (const [b, base] of [[E.music, 0.55], [E.amb, 0.8]]) {
    b.gain.cancelScheduledValues(t);
    b.gain.setTargetAtTime(base * (1 - amount), t, 0.05);
    b.gain.setTargetAtTime(base, t + hold, rel / 3);
  }
}
