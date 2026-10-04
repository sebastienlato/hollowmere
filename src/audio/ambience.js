/* Living ambience: continuous beds + randomly scheduled creatures & mechanisms.
   Station sources (clock, cauldron, oracle) are positional, so they pan and fade
   as the camera flies past them. */
import { ac, E, gain, biquad, tone, loopNoise, perc, route, panner, setPos, setParam, mtof, rand } from './engine.js';
import { bowl, theremin, heartbeat } from './instruments.js';
import * as fx from './sfx.js';

const SCALE = [2, 4, 5, 7, 9, 10, 13]; // D harmonic minor degrees (semitones from C)

function lfo(freq, depth, param, type = 'sine') {
  const o = ac().createOscillator(); o.type = type; o.frequency.value = freq;
  const g = gain(depth); o.connect(g).connect(param); o.start();
  return o;
}

export function createAmbience() {
  const c = ac();

  // ── wind: a breathing low bed + a whistle through the trees
  const windOut = route({ bus: 'amb', verb: 0.25, life: 0, level: 0 });
  const w1 = biquad('bandpass', 380, 0.6), w1g = gain(0.6);
  loopNoise('pink', w1); w1.connect(w1g).connect(windOut);
  lfo(0.061, 240, w1.frequency); lfo(0.113, 0.3, w1g.gain);
  const w2 = biquad('bandpass', 950, 11), w2g = gain(0.09);
  loopNoise('white', w2); w2.connect(w2g).connect(windOut);
  lfo(0.043, 420, w2.frequency); lfo(0.087, 0.08, w2g.gain);

  // ── scroll rush: the air you move through when you scroll
  const rushOut = route({ bus: 'amb', verb: 0.12, life: 0, level: 0 });
  const rb = biquad('bandpass', 300, 0.55);
  loopNoise('pink', rb); rb.connect(rushOut);

  // ── the veil: sub drone + rumble
  const droneOut = route({ bus: 'amb', verb: 0.45, life: 0, level: 0 });
  const dlp = biquad('lowpass', 260, 0.8);
  dlp.connect(droneOut);
  [[36.7, 0.5], [55, 0.3], [73.4, 0.18], [36.9, 0.4]].forEach(([f, a]) => { const g = gain(a); g.connect(dlp); tone('sine', f, c.currentTime, 1e5, g); });
  const rum = gain(0.5), rlp = biquad('lowpass', 110, 0.7);
  loopNoise('brown', rlp); rlp.connect(rum).connect(droneOut);
  lfo(0.05, 0.05, droneOut.gain);

  // ── crickets: persistent tone voices, pulsed into chirps
  const crickets = Array.from({ length: 4 }, (_, i) => {
    const o = c.createOscillator(); o.frequency.value = 4300 + i * 190 + rand(-50, 50);
    const g = gain(0); const out = route({ bus: 'amb', verb: 0.3, life: 0, pan: rand(-0.9, 0.9), level: 0.5 });
    o.connect(g).connect(out); o.start();
    return { g, next: rand(0, 2) };
  });

  // ── positional stations
  const clockP = panner(null, { ref: 5 });
  clockP.connect(E.amb);
  const gearOut = gain(0), gearAM = gain(0.5);
  lfo(17, 0.5, gearAM.gain, 'square');
  const g1 = biquad('bandpass', 330, 3), g2 = biquad('bandpass', 1150, 6);
  const gsrc = gain(1); loopNoise('pink', gsrc);
  gsrc.connect(g1).connect(gearAM); gsrc.connect(g2).connect(gearAM);
  gearAM.connect(gearOut).connect(clockP);

  const cauldP = panner(null, { ref: 5 });
  cauldP.connect(E.amb);
  const cs = gain(0.35); cauldP.connect(cs).connect(E.verbIn);
  const fireOut = gain(0), flp = biquad('lowpass', 520, 0.7);
  loopNoise('brown', flp); flp.connect(fireOut).connect(cauldP);

  const oracleP = panner(null, { ref: 5 });
  oracleP.connect(E.amb);
  const os = gain(0.6); oracleP.connect(os).connect(E.verbIn);
  const bowlOut = bowl(mtof(50), oracleP);

  // ── the lantern theremin
  const th = theremin(route({ bus: 'music', verb: 0.65, life: 0, level: 1 }));
  let thVol = 0;

  const next = { owl: rand(6, 12), wolf: rand(14, 22), creak: rand(8, 14), rustle: 3, caw: rand(20, 30), whisper: 3, bell: rand(14, 24), heart: 0, tick: 0, bubble: 0, crackle: 0 };
  let tock = false;
  const pan = () => rand(-0.85, 0.85);

  function update(f) {
    const t = c.currentTime, W = f.W;

    // continuous beds
    setParam(windOut.gain, (W.outdoor * 0.38 + f.velN * 0.14 * W.outdoor), 0.5);
    setParam(rushOut.gain, f.velN * 0.42, 0.07);
    setParam(rb.frequency, 260 + f.velN * 2600, 0.08);
    setParam(droneOut.gain, W.void * 0.13, 0.9);

    // stations follow their objects
    setPos(clockP, f.anchors.clock); setPos(cauldP, f.anchors.cauldron); setPos(oracleP, f.anchors.oracle);
    setParam(gearOut.gain, W.clock * (0.04 + f.clockSpeed * 0.55), 0.08);
    setParam(fireOut.gain, W.apo * 0.18, 0.4);
    setParam(bowlOut.gain, W.oracle * (0.04 + f.orb * 0.08), 0.3);

    // theremin follows the lantern (outdoors, mouse only)
    if (f.fine) {
      const y = Math.min(1, Math.max(0, f.pointer.y));
      const m = 81 - y * 24;
      const oct = Math.floor(m / 12), pc = m - oct * 12;
      const q = SCALE.reduce((a, b) => (Math.abs(b - pc) < Math.abs(a - pc) ? b : a)) + oct * 12;
      const freq = mtof(m * 0.25 + q * 0.75);
      setParam(th.osc.frequency, freq, 0.07);
      th.depth.gain.value = freq * 0.013;
      const want = Math.min(1, f.pointer.speed / 1400) * W.outdoor * 0.07;
      thVol += (want - thVol) * (want > thVol ? 0.12 : 0.03);
      setParam(th.out.gain, thVol, 0.05);
    }

    // crickets chirp in the open air
    if (W.nature > 0.2) {
      crickets.forEach((k) => {
        if (t < k.next) return;
        const lvl = 0.05 * W.nature, st = t + 0.05, n = 3 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) {
          const tt = st + i * 0.045;
          k.g.gain.setValueAtTime(0, tt);
          k.g.gain.linearRampToValueAtTime(lvl, tt + 0.008);
          k.g.gain.linearRampToValueAtTime(0, tt + 0.03);
        }
        k.next = t + rand(0.5, 1.6);
      });
    }

    // creatures of the night
    if (W.nature > 0.4) {
      if (t > next.owl) { fx.owl({ pan: pan(), level: 0.9 * W.nature }); next.owl = t + rand(14, 26); }
      if (t > next.wolf) { fx.wolf({ pan: pan(), level: 0.7 * W.nature }); next.wolf = t + rand(26, 44); }
      if (t > next.caw && W.valley > 0.5) { fx.caw({ pan: pan(), bus: 'amb', level: 0.5 }); next.caw = t + rand(22, 40); }
      if (t > next.creak) { fx.creak({ pan: pan(), bus: 'amb', level: 0.35 }); next.creak = t + rand(12, 22); }
      if (t > next.rustle) { rustle(W.nature); next.rustle = t + rand(2.5, 6); }
    }
    if (W.grave > 0.5 && t > next.bell) { fx.distantBell(); next.bell = t + rand(18, 30); }

    // voices in the veil
    if (W.void > 0.5 && t > next.whisper) {
      fx.whisper({ bus: 'amb', pan: pan(), level: 0.55, dur: rand(1.2, 2.4) });
      next.whisper = t + rand(5, 11) / (1 + f.tension * 3);
    }

    // clock: tick… tock… faster as you scrub time
    if (W.clock > 0.05 && t > next.tick) {
      fx.tick(tock, { at: f.anchors.clock, bus: 'amb', level: W.clock * 1.2 });
      tock = !tock;
      next.tick = t + 1 / (1 + f.clockSpeed * 7);
    }

    // cauldron: bubbles and fire crackle
    if (W.apo > 0.05) {
      if (t > next.bubble) { bubble(f.anchors.cauldron, W.apo); next.bubble = t + rand(0.06, 0.22); }
      if (t > next.crackle) { fx.crackle(t, route({ at: f.anchors.cauldron, bus: 'amb', life: 1, verb: 0.2 }), 3, 0.25, W.apo); next.crackle = t + rand(0.15, 0.6); }
    }

    // heartbeat when the lantern nears a hidden spirit
    if (f.tension > 0.08 && t > next.heart) {
      heartbeat(t, route({ bus: 'amb', verb: 0.1, life: 2 }), f.tension);
      next.heart = t + (0.95 - f.tension * 0.4);
    }
  }

  function rustle(w) {
    const t = c.currentTime;
    const out = route({ bus: 'amb', verb: 0.3, pan: pan(), life: 2 });
    const bp = biquad('bandpass', rand(2500, 4500), 0.7), g = gain(0);
    loopNoise('white', bp).stop(t + 1.2);
    bp.connect(g).connect(out);
    for (let k = 0; k < 24; k++) g.gain.setValueAtTime(Math.random() ** 3 * 0.12 * w, t + k * 0.04);
    g.gain.setValueAtTime(0, t + 1);
  }

  function bubble(at, w) {
    const t = c.currentTime;
    const out = route({ at, bus: 'amb', verb: 0.2, life: 1 });
    const g = gain(); g.connect(out);
    const f = rand(180, 640);
    const o = tone('sine', f, t, 0.12, g);
    o.frequency.exponentialRampToValueAtTime(f * rand(1.5, 2.1), t + 0.06);
    perc(g.gain, t, 0.004, 0.22 * w, 0.06);
  }

  return { update };
}
