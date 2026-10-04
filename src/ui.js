import { CARDS, TIERS, FORTUNES, CHAPTERS } from './content.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function createUI({ goto, onSound }) {
  // hero title, split into floating letters
  const title = $('.title');
  [...'HOLLOWMERE'].forEach((ch, i) => {
    const s = document.createElement('span');
    s.className = 'ch'; s.textContent = ch; s.style.setProperty('--i', i);
    title.appendChild(s);
  });
  const titleChars = $$('.title .ch');

  // stagger indices for reveals
  $$('.panel').forEach((panel) => $$('.reveal', panel).forEach((el, i) => el.style.setProperty('--i', i)));

  // chapter rail
  const rail = $('#rail');
  CHAPTERS.forEach((c) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.goto = c.id;
    b.setAttribute('aria-label', c.label);
    b.innerHTML = `<span class="lbl">${c.label}</span><span class="dot"></span>`;
    rail.appendChild(b);
  });
  const railBtns = $$('#rail button');
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-goto]');
    if (!g) return;
    e.preventDefault();
    goto(g.dataset.goto);
  });

  // sound
  const soundBtn = $('.sound');
  soundBtn.addEventListener('click', () => {
    const on = soundBtn.getAttribute('aria-pressed') !== 'true';
    soundBtn.setAttribute('aria-pressed', String(on));
    onSound(on);
  });

  // deck caption
  const cap = $('.deck-caption');
  const pips = $('.deck-pips');
  CARDS.forEach(() => pips.appendChild(document.createElement('i')));
  let deckIdx = -1, swapT = 0;
  function setCard(i) {
    if (i === deckIdx) return;
    deckIdx = i;
    const c = CARDS[i];
    cap.classList.add('swap');
    clearTimeout(swapT);
    swapT = setTimeout(() => {
      $('.deck-num', cap).textContent = c.num;
      $('.deck-title', cap).textContent = c.title;
      $('.deck-time', cap).textContent = c.time;
      $('.deck-text', cap).textContent = c.text;
      cap.classList.remove('swap');
    }, 260);
    $$('i', pips).forEach((p, k) => p.classList.toggle('on', k === i));
  }
  setCard(0);

  // fortune
  const fortuneEl = $('.fortune');
  let lastF = -1, fTimers = [];
  function fortune() {
    let i;
    do { i = Math.floor(Math.random() * FORTUNES.length); } while (i === lastF);
    lastF = i;
    fTimers.forEach(clearTimeout); fTimers = [];
    fortuneEl.innerHTML = '';
    const words = FORTUNES[i].split(' ');
    words.forEach((w, k) => {
      const s = document.createElement('span');
      s.className = 'l'; s.textContent = w + ' ';
      fortuneEl.appendChild(s);
      fTimers.push(setTimeout(() => s.classList.add('on'), 250 + k * 110));
    });
  }

  // countdown to midnight Oct 31 → Nov 1 00:00 local time
  const target = new Date(2026, 10, 1, 0, 0, 0).getTime();
  const cd = { d: $('[data-cd="d"]'), h: $('[data-cd="h"]'), m: $('[data-cd="m"]'), s: $('[data-cd="s"]') };
  const pad = (n) => String(Math.max(0, n)).padStart(2, '0');
  function tickCountdown() {
    let diff = Math.max(0, target - Date.now()) / 1000;
    const d = Math.floor(diff / 86400); diff -= d * 86400;
    const h = Math.floor(diff / 3600); diff -= h * 3600;
    const m = Math.floor(diff / 60); const s = Math.floor(diff - m * 60);
    cd.d.textContent = pad(d); cd.h.textContent = pad(h); cd.m.textContent = pad(m); cd.s.textContent = pad(s);
  }
  tickCountdown();
  setInterval(tickCountdown, 1000);

  // tier card
  const tierCard = $('.tier-card');
  const touch = !window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (touch) { $('.tier-name', tierCard).textContent = 'Tap a potion'; $('.tier-hint', tierCard).textContent = 'Tap again to pour it into the cauldron.'; }
  function showTier(key, chosen = false) {
    const t = TIERS[key];
    tierCard.style.setProperty('--tier-color', t.color);
    $('.tier-name', tierCard).textContent = chosen ? `${t.name}, chosen` : t.name;
    $('.tier-price', tierCard).textContent = `${t.price} per soul`;
    $('.tier-perks', tierCard).innerHTML = t.perks.map((p) => `<li>${p}</li>`).join('');
    $('.tier-hint', tierCard).textContent = chosen ? 'The brew accepts you. Now break the seal.' : touch ? 'Tap it again to pour it into the cauldron.' : 'Click the bottle to pour it into the cauldron.';
  }
  function chooseTier(key) {
    showTier(key, true);
    $('#rsvp select[name="tier"]').value = key;
  }

  // spirits
  const dots = $$('.spirits-dots i');
  const spiritsEl = $('.spirits');
  let found = 0;
  function spiritFound() {
    found = Math.min(5, found + 1);
    dots.forEach((d, i) => d.classList.toggle('on', i < found));
    spiritsEl.classList.remove('pulse'); void spiritsEl.offsetWidth; spiritsEl.classList.add('pulse');
    if (found === 5) {
      const gift = $('.rsvp-gift');
      gift.hidden = false;
      gift.innerHTML = 'All five spirits found. Their gift to you: <b>VEILWALKER</b>, thirteen percent off every soul.';
    }
  }

  // RSVP
  const rsvp = $('#rsvp');
  const form = $('.rsvp-form');
  const done = $('.rsvp-done');
  let onClose = () => {};
  function openRSVP(closeCb) {
    onClose = closeCb || (() => {});
    rsvp.classList.add('is-open');
    rsvp.setAttribute('aria-hidden', 'false');
    setTimeout(() => $('input[name="name"]', form)?.focus({ preventScroll: true }), 700);
  }
  function closeRSVP() {
    rsvp.classList.remove('is-open');
    rsvp.setAttribute('aria-hidden', 'true');
    onClose();
  }
  $('.rsvp-close').addEventListener('click', closeRSVP);
  rsvp.addEventListener('click', (e) => { if (e.target === rsvp) closeRSVP(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && rsvp.classList.contains('is-open')) closeRSVP(); });
  let onPact = () => {};
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const err = $('.rsvp-error');
    if (!String(data.get('name') || '').trim()) return (err.textContent = 'The pact needs a name.');
    if (!/^\S+@\S+\.\S+$/.test(String(data.get('email') || ''))) return (err.textContent = 'The raven cannot find that address.');
    if (!data.get('oath')) return (err.textContent = 'You must accept the oath.');
    err.textContent = '';
    try { localStorage.setItem('hollowmere-pact', JSON.stringify({ name: data.get('name'), tier: data.get('tier'), souls: data.get('souls'), at: Date.now() })); } catch {}
    form.hidden = true;
    done.hidden = false;
    $('h3', done).textContent = `Welcome, ${String(data.get('name')).trim().split(' ')[0]}.`;
    onPact();
  });

  // panels
  const panels = $$('.panel').map((el) => ({ el, ch: CHAPTERS.find((c) => c.id === el.dataset.ch) }));
  let lastActive = '';
  function update(p, t) {
    let activeId = '';
    for (const { el, ch } of panels) {
      const on = p >= ch.range[0] && p <= ch.range[1];
      el.classList.toggle('is-active', on);
      if (on) activeId = ch.id;
    }
    if (activeId && activeId !== lastActive) lastActive = activeId;
    const idx = CHAPTERS.findIndex((c) => p < (c.range[1] + (CHAPTERS[CHAPTERS.indexOf(c) + 1]?.range[0] ?? 1.1)) / 2);
    railBtns.forEach((b, i) => { b.classList.toggle('on', i === idx); b.classList.toggle('done', i < idx); });
    titleChars.forEach((c, i) => c.style.setProperty('--float', `${Math.sin(t * 1.2 + i * 0.6) * 5}px`));
  }

  return {
    update, setCard, fortune, showTier, chooseTier, spiritFound, openRSVP,
    set onPact(fn) { onPact = fn; },
    isModalOpen: () => rsvp.classList.contains('is-open'),
  };
}
