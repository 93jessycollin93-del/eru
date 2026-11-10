#!/usr/bin/env python3
"""
Build the tree textures from Poly Haven's scanned trees (CC0):

  public/textures/bark_{color,normal,arm}.jpg   fir bark, for trunks
  public/textures/needles.png                   a pine bough on a transparent card
  public/textures/leaves.png                    a spray of leaves on a transparent card

The tree models themselves are film-grade (millions of polygons) and aren't used. Their texture
sheets hold single twigs and leaves on black, which this cuts out and arranges into a branch.

Run from the project root:  python3 tools/assets/foliage.py [cache-dir]
Needs network access to api.polyhaven.com and dl.polyhaven.org, Pillow and numpy.
"""
import json
import math
import os
import random
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

UA = "zombie-survival-game-build/1.0"
OUT = "public/textures"
CARD = 512


def fetch(url, path):
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        subprocess.run(["curl", "-sf", "-m", "180", "-A", UA, url, "-o", path], check=True)
    return path


def model_texture(cache, asset, suffix):
    """One texture of a model's 1k glTF, e.g. ("pine_tree_01", "twig_diff")."""
    files = json.load(open(fetch(f"https://api.polyhaven.com/files/{asset}", f"{cache}/m_{asset}.json")))
    for name, f in files["gltf"]["1k"]["gltf"]["include"].items():
        if name.endswith(f"{asset}_{suffix}_1k.jpg"):
            return Image.open(fetch(f["url"], f"{cache}/{asset}_{suffix}.jpg")).convert("RGB")
    raise KeyError(f"{asset} has no {suffix}")


def cut(sheet, box, threshold=26, min_saturation=0.0):
    """
    A sprite from a region of a sheet whose background is black: brightness becomes transparency.
    min_saturation also drops grey pixels (the stretched padding round some scans).
    """
    region = sheet.crop(box)
    rgb = np.asarray(region).astype(np.float32)
    lum = rgb.max(axis=2)
    alpha = np.clip((lum - threshold) / 28.0, 0, 1)
    if min_saturation > 0:
        sat = (lum - rgb.min(axis=2)) / np.maximum(lum, 1)
        alpha *= np.clip((sat - min_saturation) / 0.08, 0, 1)
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    sprite = Image.fromarray(out, "RGBA")
    return sprite.crop(sprite.getbbox())


def paste(card, sprite, x, y, angle, length, flip=False):
    """Paste a sprite so its base (bottom centre) sits at (x, y), pointing along `angle` (0 = up, clockwise)."""
    s = sprite.transpose(Image.FLIP_LEFT_RIGHT) if flip else sprite
    scale = length / s.size[1]
    s = s.resize((max(1, round(s.size[0] * scale)), max(1, round(length))), Image.LANCZOS)
    # Pad so the base is the centre of rotation.
    w, h = s.size
    pad = Image.new("RGBA", (w, h * 2), (0, 0, 0, 0))
    pad.paste(s, (0, 0))
    rot = pad.rotate(-angle, resample=Image.BICUBIC, expand=True)
    card.alpha_composite(rot, (round(x - rot.size[0] / 2), round(y - rot.size[1] / 2)))


def bleed(card):
    """Spread colour into the transparent pixels, so shrunken copies don't pick up a dark fringe."""
    a = np.asarray(card).astype(np.float32)
    alpha = a[..., 3:4] / 255.0
    pre = Image.fromarray((a[..., :3] * alpha).astype(np.uint8), "RGB").filter(ImageFilter.GaussianBlur(6))
    cov = Image.fromarray((alpha[..., 0] * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(6))
    spread = np.asarray(pre).astype(np.float32) / np.maximum(np.asarray(cov).astype(np.float32)[..., None] / 255.0, 0.02)
    mean = (a[..., :3] * alpha).sum(axis=(0, 1)) / max(alpha.sum(), 1)
    spread = np.where(np.asarray(cov)[..., None] > 2, spread, mean)
    rgb = np.where(alpha > 0.5, a[..., :3], np.clip(spread, 0, 255))
    return Image.fromarray(np.dstack([rgb, a[..., 3]]).astype(np.uint8), "RGBA")


def needles(cache):
    sheet = model_texture(cache, "pine_tree_01", "twig_diff")
    twig = cut(sheet, (34, 44, 221, 440), min_saturation=0.2)
    # The scanned twig is drying out (yellow-brown tips): bring it back to a living dark green.
    a = np.asarray(twig).astype(np.float32)
    a[..., 0] *= 0.62
    a[..., 1] *= 0.86
    a[..., 2] *= 0.7
    twig = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")
    card = Image.new("RGBA", (CARD, CARD), (0, 0, 0, 0))
    rng = random.Random(7)
    # A bough: the branch runs up the middle of the card; twigs leave it alternately, angled toward the tip.
    stem_x = CARD / 2
    d = ImageDraw.Draw(card)
    d.line([(stem_x, CARD - 2), (stem_x, 60)], fill=(74, 58, 44, 255), width=7)
    d.line([(stem_x, 200), (stem_x, 40)], fill=(74, 58, 44, 255), width=4)
    n = 13
    for i in range(n):
        t = i / (n - 1)
        y = CARD - 30 - t * (CARD - 150)
        length = 215 - 95 * t + rng.uniform(-12, 12)
        for side in (-1, 1):
            angle = side * (62 - 22 * t + rng.uniform(-9, 9))
            paste(card, twig, stem_x, y + rng.uniform(-8, 8), angle, length, flip=side < 0)
    paste(card, twig, stem_x, 130, 0, 135)
    return bleed(card)


def leaves(cache):
    sheet = model_texture(cache, "island_tree_02", "leaves_diff")
    boxes = [(15, 15, 155, 530), (165, 15, 348, 405), (365, 25, 500, 375), (525, 40, 670, 375), (705, 15, 840, 430), (10, 640, 195, 1024), (215, 585, 370, 1024), (425, 615, 580, 1024)]
    sprites = [cut(sheet, b) for b in boxes]
    # The scans are of a yellow-green tropical leaf: pull them toward a temperate summer green.
    tuned = []
    for s in sprites:
        a = np.asarray(s).astype(np.float32)
        a[..., 0] *= 0.72
        a[..., 1] *= 0.9
        a[..., 2] *= 0.75
        tuned.append(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA"))
    card = Image.new("RGBA", (CARD, CARD), (0, 0, 0, 0))
    rng = random.Random(11)
    d = ImageDraw.Draw(card)
    base = (CARD / 2, CARD - 6)
    # Three twigs fan up from the bottom of the card, each carrying leaves in alternating pairs.
    for stem_angle, stem_len in ((-34, 400), (0, 470), (33, 410)):
        rad = math.radians(stem_angle)
        tip = (base[0] + math.sin(rad) * stem_len, base[1] - math.cos(rad) * stem_len)
        d.line([base, tip], fill=(70, 56, 40, 255), width=5)
        count = 9
        for i in range(count):
            t = (i + 1) / count
            x = base[0] + (tip[0] - base[0]) * t
            y = base[1] + (tip[1] - base[1]) * t
            for side in (-1, 1):
                if i == count - 1 and side == 1:
                    continue
                angle = stem_angle + side * rng.uniform(38, 70)
                paste(card, rng.choice(tuned), x, y, angle, rng.uniform(88, 128), flip=rng.random() < 0.5)
        paste(card, rng.choice(tuned), tip[0], tip[1], stem_angle + rng.uniform(-12, 12), 115)
    return bleed(card)


def bark(cache):
    files = json.load(open(fetch("https://api.polyhaven.com/files/fir_tree_01", f"{cache}/m_fir_tree_01.json")))
    inc = files["gltf"]["1k"]["gltf"]["include"]
    for out, suffix in (("color", "bark_diff"), ("normal", "bark_nor_gl"), ("arm", "bark_arm")):
        for name, f in inc.items():
            if name.endswith(f"fir_tree_01_{suffix}_1k.jpg"):
                im = Image.open(fetch(f["url"], f"{cache}/fir_tree_01_{suffix}.jpg")).convert("RGB").resize((512, 512), Image.LANCZOS)
                im.save(f"{OUT}/bark_{out}.jpg", quality=84, optimize=True)


def main():
    cache = sys.argv[1] if len(sys.argv) > 1 else ".texture-cache"
    os.makedirs(cache, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    needles(cache).save(f"{OUT}/needles.png", optimize=True)
    leaves(cache).save(f"{OUT}/leaves.png", optimize=True)
    bark(cache)
    with open(f"{OUT}/SOURCES.md", "a") as f:
        if "needles.png" not in open(f"{OUT}/SOURCES.md").read():
            f.write(
                "\n## Trees\n\nPrepared by `tools/assets/foliage.py` from the texture sheets of Poly Haven tree models (CC0); the models themselves aren't used.\n\n"
                "| File | From | What |\n|---|---|---|\n"
                "| bark_*.jpg | [fir_tree_01](https://polyhaven.com/a/fir_tree_01) | bark for trunks |\n"
                "| needles.png | [pine_tree_01](https://polyhaven.com/a/pine_tree_01) | one scanned twig arranged into a bough |\n"
                "| leaves.png | [island_tree_02](https://polyhaven.com/a/island_tree_02) | eight scanned leaves arranged into a spray, tinted greener |\n"
            )
    for n in ("needles.png", "leaves.png", "bark_color.jpg", "bark_normal.jpg", "bark_arm.jpg"):
        print(n, os.path.getsize(f"{OUT}/{n}") // 1024, "KB")


if __name__ == "__main__":
    main()
