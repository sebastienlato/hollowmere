import * as THREE from 'three';

const NAMES = [
  'sky_night', 'moon', 'mountains_far', 'manor', 'forest_left', 'forest_right', 'tree_foreground',
  'gate_half', 'gate_pillar', 'ground_path', 'fog_tile', 'smoke_wisp',
  'jackolantern_01', 'jackolantern_02', 'jackolantern_03', 'bat', 'crow_flying', 'crow_perched',
  'ghost_lady', 'ghost_wraith', 'skeleton_hand', 'crest',
  'tarot_frame', 'tarot_back', 'tarot_01_lantern_walk', 'tarot_02_seance', 'tarot_03_masquerade',
  'tarot_04_witch_kitchen', 'tarot_05_crypt', 'tarot_06_pyre',
  'crystal_ball', 'candles', 'clock_face', 'clock_hand_hour', 'clock_hand_minute',
  'cauldron', 'potion_mortal', 'potion_phantom', 'potion_undying',
  'parchment_letter', 'wax_seal', 'tombstone_01', 'tombstone_02', 'tombstone_03',
];
const DATA_TEX = new Set(['fog_tile', 'smoke_wisp']);
const REPEAT = new Set(['fog_tile', 'ground_path']);

export const tex = {};
const alphaMaps = new Map();

export function loadAll(renderer, onProgress) {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const manager = new THREE.LoadingManager();
  const loader = new THREE.TextureLoader(manager);
  const fontsReady = Promise.all([
    document.fonts.load('900 64px "Cinzel Decorative"'),
    document.fonts.load('700 64px "Cinzel Decorative"'),
    document.fonts.load('600 40px "Cinzel"'),
    document.fonts.load('italic 400 40px "Cormorant Garamond"'),
    document.fonts.load('500 40px "Cormorant Garamond"'),
    document.fonts.load('400 60px "Pinyon Script"'),
  ]).catch(() => {});

  return new Promise((resolve) => {
    manager.onProgress = (_url, loaded, total) => onProgress?.(loaded / total);
    manager.onLoad = async () => { await fontsReady; resolve(tex); };
    for (const n of NAMES) {
      tex[n] = loader.load(`${import.meta.env.BASE_URL}tex/${n}.webp`, (t) => {
        t.colorSpace = DATA_TEX.has(n) ? THREE.NoColorSpace : THREE.SRGBColorSpace;
        t.anisotropy = Math.min(8, maxAniso);
        if (REPEAT.has(n)) t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.needsUpdate = true;
      });
    }
  });
}

/* Small CPU alpha map per texture so raycasts ignore transparent pixels. */
export function alphaAt(texture, u, v) {
  const img = texture.image;
  if (!img) return 1;
  let m = alphaMaps.get(img);
  if (!m) {
    const w = 96, h = Math.round(96 * (img.height / img.width));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    m = { w, h, data: ctx.getImageData(0, 0, w, h).data };
    alphaMaps.set(img, m);
  }
  const x = Math.min(m.w - 1, Math.max(0, Math.floor(u * m.w)));
  const y = Math.min(m.h - 1, Math.max(0, Math.floor((1 - v) * m.h)));
  return m.data[(y * m.w + x) * 4 + 3] / 255;
}

/* Build a THREE.CanvasTexture by drawing onto a base image. */
export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/* A plane sized by height, keeping the texture's aspect. */
export function planeFor(texture, height, segX = 1, segY = 1) {
  const img = texture.image;
  const aspect = img ? img.width / img.height : 1;
  return new THREE.PlaneGeometry(height * aspect, height, segX, segY);
}
