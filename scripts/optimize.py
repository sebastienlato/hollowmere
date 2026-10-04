"""Resize + compress the raw PNGs in /assets into WebP textures in /public/tex.

Originals are never modified. Re-run with `npm run textures` after replacing any asset.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets"
OUT = ROOT / "public" / "tex"
OUT.mkdir(parents=True, exist_ok=True)

# name -> (max dimension, webp quality)
SPEC = {
    "sky_night": (1536, 82), "manor": (1536, 86), "spirit_board": (1536, 84),
    "mountains_far": (1280, 80), "moon": (1024, 86),
    "forest_left": (1024, 82), "forest_right": (1024, 82), "tree_foreground": (1280, 84),
    "gate_half": (1024, 86), "gate_pillar": (1024, 84), "ground_path": (1024, 80),
    "fog_tile": (512, 80), "smoke_wisp": (256, 80), "spiderweb_corner": (512, 82),
    "jackolantern_01": (512, 84), "jackolantern_02": (512, 84), "jackolantern_03": (512, 84),
    "bat": (256, 84), "crow_flying": (384, 84), "crow_perched": (512, 84),
    "ghost_lady": (1024, 84), "ghost_wraith": (1024, 84), "skeleton_hand": (512, 84),
    "crest": (512, 88), "lantern_cursor": (360, 90), "planchette": (512, 88), "candles": (512, 84),
    "tarot_frame": (1152, 88), "tarot_back": (1152, 86),
    "tarot_01_lantern_walk": (1152, 84), "tarot_02_seance": (1152, 84),
    "tarot_03_masquerade": (1152, 84), "tarot_04_witch_kitchen": (1152, 84),
    "tarot_05_crypt": (1152, 84), "tarot_06_pyre": (1152, 84),
    "crystal_ball": (1024, 86), "clock_face": (1024, 88),
    "clock_hand_hour": (768, 90), "clock_hand_minute": (768, 90),
    "cauldron": (768, 86), "potion_mortal": (1024, 86), "potion_phantom": (1024, 86),
    "potion_undying": (1024, 86), "parchment_letter": (1024, 84), "wax_seal": (768, 88),
    "tombstone_01": (1024, 84), "tombstone_02": (1024, 84), "tombstone_03": (1024, 84),
}

total = 0
for name, (maxdim, q) in SPEC.items():
    im = Image.open(SRC / f"{name}.png")
    im = im.convert("RGBA") if im.mode in ("RGBA", "LA", "P") else im.convert("RGB")
    s = min(1.0, maxdim / max(im.size))
    if s < 1:
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    dst = OUT / f"{name}.webp"
    im.save(dst, "WEBP", quality=q, method=6, exact=False)
    total += dst.stat().st_size
    print(f"{name:26s} {im.width}x{im.height}  {dst.stat().st_size/1024:7.1f} KB")

# social + favicon
og = Image.open(SRC / "og_image.png").convert("RGB").resize((1200, 800), Image.LANCZOS)
og.save(ROOT / "public" / "og_image.jpg", "JPEG", quality=84, optimize=True)
crest = Image.open(SRC / "crest.png").convert("RGBA")
crest.resize((64, 64), Image.LANCZOS).save(ROOT / "public" / "favicon.png")
crest.resize((180, 180), Image.LANCZOS).save(ROOT / "public" / "apple-touch-icon.png")
print(f"\nTotal textures: {total/1024/1024:.2f} MB")
