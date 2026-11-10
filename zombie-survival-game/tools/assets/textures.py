#!/usr/bin/env python3
"""
Fetch photo-scanned surface textures from Poly Haven (CC0) and prepare them for the game.

For each surface in MANIFEST this downloads the 1k colour, normal (OpenGL) and ARM (ambient occlusion,
roughness, metalness packed in R, G, B) maps, resizes them, and writes
public/textures/<surface>_{color,normal,arm}.jpg plus SOURCES.md.

mode "own":    the photo keeps its colours (brick is brick-coloured).
mode "detail": the photo is reduced to brightness around 0.85, so it adds real surface detail to
               whatever colour the game paints that surface (house walls come in eight colours).

Run from the project root:  python3 tools/assets/textures.py [cache-dir]
Needs network access to api.polyhaven.com and dl.polyhaven.org, and Pillow.
"""
import json
import os
import subprocess
import sys

from PIL import Image, ImageStat

UA = "zombie-survival-game-build/1.0"
OUT = "public/textures"

# surface: (Poly Haven id, mode, output size in pixels, metres one repeat covers)
MANIFEST = {
    "brick": ("red_brick_03", "own", 512, 1.0),
    "plaster": ("painted_plaster_wall", "detail", 512, 2.0),
    "concrete": ("concrete_floor_worn_001", "detail", 1024, 3.0),
    "asphalt": ("asphalt_02", "own", 1024, 3.0),
    "wood": ("wood_floor", "detail", 512, 1.7),
    "roof": ("grey_roof_01", "detail", 1024, 8.0),
    "ground": ("forrest_ground_01", "detail", 1024, 2.0),
}


def fetch(url, path):
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        subprocess.run(["curl", "-sf", "-m", "180", "-A", UA, url, "-o", path], check=True)
    return path


def main():
    cache = sys.argv[1] if len(sys.argv) > 1 else ".texture-cache"
    os.makedirs(cache, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    sources = ["# Texture sources", "", "All from [Poly Haven](https://polyhaven.com), licence CC0 (public domain). Prepared by `tools/assets/textures.py`.", "", "| Surface | Asset | Use | Size | Repeat |", "|---|---|---|---|---|"]
    for surface, (asset, mode, size, tile) in MANIFEST.items():
        files = json.load(open(fetch(f"https://api.polyhaven.com/files/{asset}", f"{cache}/{asset}.json")))
        maps = {"color": "Diffuse", "normal": "nor_gl", "arm": "arm"}
        total = 0
        for name, key in maps.items():
            src = fetch(files[key]["1k"]["jpg"]["url"], f"{cache}/{asset}_{name}.jpg")
            im = Image.open(src).convert("RGB")
            if name == "color" and mode == "detail":
                grey = im.convert("L")
                mean = ImageStat.Stat(grey).mean[0]
                # Brightness relative to the photo's average, centred on 0.85 so it multiplies a colour without darkening it much.
                grey = grey.point(lambda v: max(0, min(255, round(v / mean * 0.85 * 255))))
                im = Image.merge("RGB", (grey, grey, grey))
            if im.size[0] != size:
                im = im.resize((size, size), Image.LANCZOS)
            out = f"{OUT}/{surface}_{name}.jpg"
            im.save(out, quality=84, optimize=True)
            total += os.path.getsize(out)
        sources.append(f"| {surface} | [{asset}](https://polyhaven.com/a/{asset}) | {'its own colours' if mode == 'own' else 'detail under the game colour'} | {size} px | {tile} m |")
        print(f"{surface:9s} {asset:26s} {mode:6s} {size:5d}px  {total // 1024} KB")
    open(f"{OUT}/SOURCES.md", "w").write("\n".join(sources) + "\n")


if __name__ == "__main__":
    main()
