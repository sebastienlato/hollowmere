/* The lantern cursor: an iron lantern hanging from the pointer, swinging with
   real pendulum physics. Exposes where its flame is on screen so the 3D world
   can be lit, and hidden spirits revealed, from that exact point. */
export function createLantern() {
  const el = document.getElementById('lantern');
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const state = {
    fine,
    x: window.innerWidth * 0.5, y: window.innerHeight * 0.42,   // pivot (pointer)
    gx: window.innerWidth * 0.5, gy: window.innerHeight * 0.5,  // flame position
    nx: 0.5, ny: 0.5,  // normalised pointer (0..1, y down)
    moved: false, idle: 0, touching: false,
  };
  let th = 0, om = 0, vx = 0, lastX = state.x;
  const W = 74, H = W * 1.5, L = H * 0.57;

  if (fine) document.body.classList.add('has-lantern');

  const move = (x, y) => {
    state.x = x; state.y = y; state.moved = true; state.idle = 0;
  };
  window.addEventListener('pointermove', (e) => move(e.clientX, e.clientY), { passive: true });
  window.addEventListener('pointerdown', (e) => { state.touching = e.pointerType !== 'mouse'; move(e.clientX, e.clientY); }, { passive: true });

  function update(dt, t) {
    dt = Math.min(dt, 1 / 30);
    state.idle += dt;
    if (!fine && state.idle > 3) {
      // no pointer: the light drifts on its own
      state.x += ((0.5 + Math.sin(t * 0.3) * 0.22) * window.innerWidth - state.x) * dt * 0.8;
      state.y += ((0.45 + Math.sin(t * 0.47) * 0.12) * window.innerHeight - state.y) * dt * 0.8;
    }
    const nvx = (state.x - lastX) / Math.max(dt, 1e-3);
    const ax = Math.max(-9000, Math.min(9000, (nvx - vx) / Math.max(dt, 1e-3)));
    vx = nvx; lastX = state.x;
    const g = 2600;
    const alpha = -(g / L) * Math.sin(th) + (ax / L) * Math.cos(th) * 0.9 - 2.4 * om;
    om += alpha * dt;
    th += om * dt;
    th = Math.max(-1.2, Math.min(1.2, th));
    const sway = Math.sin(t * 1.7) * 0.02;
    if (fine) {
      el.style.transform = `translate3d(${state.x - W / 2}px, ${state.y - H * 0.03}px, 0) rotate(${th + sway}rad)`;
      state.gx = state.x - Math.sin(th + sway) * L;
      state.gy = state.y + Math.cos(th + sway) * L;
    } else {
      state.gx = state.x; state.gy = state.y;
    }
    state.nx = state.x / window.innerWidth;
    state.ny = state.y / window.innerHeight;
  }

  return { state, update, el };
}
