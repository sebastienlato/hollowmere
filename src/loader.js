/* The séance loader: a spirit board whose planchette spells E-N-T-E-R as the
   world loads, then burns away when touched. */
const BW = 1536, BH = 1024;

function layoutLetters() {
  const L = {};
  const arc = (str, cx, cy, R, deg) => {
    [...str].forEach((ch, i) => {
      const a = ((-deg + (2 * deg * i) / (str.length - 1)) * Math.PI) / 180;
      L[ch] = { x: cx + Math.sin(a) * R, y: cy - Math.cos(a) * R, r: a, size: 78 };
    });
  };
  arc('ABCDEFGHIJKLM', 768, 1900, 1480, 25);
  arc('NOPQRSTUVWXYZ', 768, 2020, 1440, 22.5);
  [...'1234567890'].forEach((ch, i) => (L['n' + ch] = { x: 420 + i * 77.3, y: 790, r: 0, size: 60, ch }));
  L.YES = { x: 360, y: 235, r: 0, size: 64, ch: 'YES' };
  L.NO = { x: 1176, y: 235, r: 0, size: 64, ch: 'NO' };
  L.BYE = { x: 768, y: 905, r: 0, size: 56, ch: 'GOOD BYE' };
  return L;
}

function makeNoiseField(w, h) {
  const rnd = new Float32Array(64 * 64).map(() => Math.random());
  const smooth = (t) => t * t * (3 - 2 * t);
  const vn = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
    const g = (a, b) => rnd[((b & 63) * 64) + (a & 63)];
    const a = g(xi, yi) + (g(xi + 1, yi) - g(xi, yi)) * xf;
    const b = g(xi, yi + 1) + (g(xi + 1, yi + 1) - g(xi, yi + 1)) * xf;
    return a + (b - a) * yf;
  };
  const f = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, amp = 0.5, fx = x / 18, fy = y / 18;
    for (let o = 0; o < 4; o++) { s += vn(fx, fy) * amp; fx *= 2.1; fy *= 2.1; amp *= 0.5; }
    f[y * w + x] = s;
  }
  return f;
}

export function createLoader({ onEnter }) {
  const root = document.getElementById('loader');
  const board = root.querySelector('.board');
  const canvas = root.querySelector('.board-canvas');
  const ctx = canvas.getContext('2d');
  const planch = root.querySelector('.planchette');
  const spelled = [...root.querySelectorAll('.loader-spelled span')];
  const hint = root.querySelector('.loader-hint');
  const pct = root.querySelector('.loader-pct');
  const letters = layoutLetters();
  const WORD = ['E', 'N', 'T', 'E', 'R'];

  const img = new Image();
  img.src = `${import.meta.env.BASE_URL}tex/spirit_board.webp`;
  const cache = document.createElement('canvas');
  cache.width = BW; cache.height = BH;
  const cctx = cache.getContext('2d');
  let cacheReady = false;

  const drawLetter = (c, l, text, glow) => {
    c.save();
    c.translate(l.x, l.y);
    c.rotate(l.r);
    c.font = `700 ${l.size}px "Cinzel Decorative", serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (glow > 0) {
      c.shadowColor = `rgba(255,150,40,${glow})`;
      c.shadowBlur = 40 * glow;
      c.fillStyle = `rgba(255,235,180,${glow})`;
      c.fillText(text, 0, 0);
      c.shadowBlur = 0;
    } else {
      c.fillStyle = 'rgba(10,4,0,0.55)';
      c.fillText(text, 2, 3);
      const g = c.createLinearGradient(0, -l.size / 2, 0, l.size / 2);
      g.addColorStop(0, '#f3d38a'); g.addColorStop(0.55, '#c08a3a'); g.addColorStop(1, '#7a4a18');
      c.fillStyle = g;
      c.fillText(text, 0, 0);
    }
    c.restore();
  };

  async function buildCache() {
    await img.decode().catch(() => {});
    await document.fonts.load('700 70px "Cinzel Decorative"').catch(() => {});
    cctx.drawImage(img, 0, 0, BW, BH);
    for (const [k, l] of Object.entries(letters)) drawLetter(cctx, l, l.ch || k, 0);
    cacheReady = true;
  }
  buildCache();

  function resize() {
    const r = board.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  // planchette motion
  const pos = { x: 768, y: 520 }, vel = { x: 0, y: 0 };
  let step = 0, dwell = 0, progress = 0, ready = false, burning = false, burnT = 0, raf = 0;
  const glows = new Map();
  const start = performance.now();
  const MF = 0.35;
  const noise = makeNoiseField(160, 107);

  function setProgress(p) { progress = p; }

  function target(t) {
    if (ready) return { x: 768 + Math.sin(t * 0.8) * 30, y: 500 + Math.cos(t * 0.6) * 18 };
    if (step < WORD.length) {
      const allowed = progress >= (step + 1) / WORD.length - 0.19 && t > 0.9 + step * 0.75;
      if (allowed) {
        const ch = WORD[step];
        const l = letters[ch];
        return { x: l.x, y: l.y };
      }
      return { x: 768 + Math.sin(t * 1.3) * 260, y: 500 + Math.sin(t * 0.9) * 110 };
    }
    return { x: 768, y: 500 };
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const t = (now - start) / 1000;
    const dt = 1 / 60;
    const tg = target(t);
    const k = 9, d = 5.2;
    vel.x += ((tg.x - pos.x) * k - vel.x * d) * dt;
    vel.y += ((tg.y - pos.y) * k - vel.y * d) * dt;
    pos.x += vel.x * dt + Math.sin(t * 7.3) * 0.25;
    pos.y += vel.y * dt + Math.cos(t * 6.1) * 0.25;

    if (step < WORD.length) {
      const l = letters[WORD[step]];
      const dist = Math.hypot(pos.x - l.x, pos.y - l.y);
      const allowed = progress >= (step + 1) / WORD.length - 0.19 && t > 0.9 + step * 0.75;
      if (allowed && dist < 26) {
        dwell += dt;
        if (dwell > MF) {
          spelled[step].textContent = WORD[step];
          spelled[step].classList.add('on');
          glows.set(WORD[step], 1);
          step++; dwell = 0;
        }
      } else dwell = 0;
    } else if (progress >= 1 && !ready) {
      ready = true;
      root.classList.add('is-ready');
      hint.textContent = 'Touch the planchette to part the veil';
    }
    if (!ready) pct.textContent = `${Math.round(progress * 100)}%`;

    // draw board
    const cw = canvas.width, ch = canvas.height, sx = cw / BW;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    if (cacheReady) {
      ctx.setTransform(sx, 0, 0, sx, 0, 0);
      ctx.drawImage(cache, 0, 0);
      // candle-lit warmth that flickers
      const fl = 0.16 + Math.sin(t * 13) * 0.02 + Math.sin(t * 7.7) * 0.03;
      const g = ctx.createRadialGradient(pos.x, pos.y, 20, pos.x, pos.y, 700);
      g.addColorStop(0, `rgba(255,150,60,${fl})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g; ctx.fillRect(0, 0, BW, BH);
      ctx.globalCompositeOperation = 'source-over';
      for (const [key, v] of glows) {
        drawLetter(ctx, letters[key], key, v);
        glows.set(key, Math.max(0.35, v - dt * 0.4));
      }
      if (burning) drawBurn(cw, ch);
    }

    // place planchette (its hole sits at 50%, 48% of the image)
    const bw = board.clientWidth, bh = board.clientHeight, pw = bw * 0.17;
    const px = (pos.x / BW) * bw - pw * 0.5, py = (pos.y / BH) * bh - pw * 0.482;
    planch.style.transform = `translate3d(${px}px, ${py}px, 0) rotate(${vel.x * 0.0009}rad)`;
  }
  raf = requestAnimationFrame(frame);

  // burn-away: noise threshold rising from the planchette outward
  const mw = 160, mh = 107;
  const mask = document.createElement('canvas'); mask.width = mw; mask.height = mh;
  const mctx = mask.getContext('2d');
  const md = mctx.createImageData(mw, mh);
  const glowC = document.createElement('canvas'); glowC.width = mw; glowC.height = mh;
  const gctx = glowC.getContext('2d');
  const gd = gctx.createImageData(mw, mh);
  function drawBurn(cw, ch) {
    burnT += 1 / 60 / 1.7;
    const th = burnT * 1.55 - 0.2;
    const ox = (pos.x / BW) * mw, oy = (pos.y / BH) * mh;
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
      const i = y * mw + x;
      const radial = Math.hypot(x - ox, y - oy) / 120;
      const n = noise[i] * 0.55 + radial * 0.75;
      const a = Math.min(1, Math.max(0, (n - th) / 0.05));
      const e = Math.max(0, 1 - Math.abs(n - th - 0.03) / 0.045);
      md.data[i * 4 + 3] = a * 255;
      gd.data[i * 4] = 255; gd.data[i * 4 + 1] = 120 + e * 110; gd.data[i * 4 + 2] = 30 * e; gd.data[i * 4 + 3] = e * 255;
    }
    mctx.putImageData(md, 0, 0);
    gctx.putImageData(gd, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0, cw, ch);
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = 'blur(2px)';
    ctx.drawImage(glowC, 0, 0, cw, ch);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
  }

  function enter() {
    if (!ready || burning) return;
    burning = true;
    root.classList.add('is-burning');
    hint.textContent = '';
    onEnter();
    setTimeout(() => {
      root.classList.add('is-gone');
      setTimeout(() => { cancelAnimationFrame(raf); root.remove(); }, 2000);
    }, 1100);
  }
  planch.addEventListener('click', enter);
  board.addEventListener('click', enter);
  window.addEventListener('keydown', (e) => { if (e.key === 'Enter') enter(); });

  return { setProgress };
}
