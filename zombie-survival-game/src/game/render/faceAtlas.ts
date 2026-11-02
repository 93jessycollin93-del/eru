import * as THREE from "three";
import { FACES_PER_SEX } from "../../sim/appearance";
import { mulberry32, range } from "../../sim/rng";

/**
 * Painted faces: one texture array shared by every character. Each face layer
 * packs four masks the character shader reads in head space:
 *   R  cavity (eye sockets, under-brow shadow, eye bags, nasolabial folds,
 *      nostrils, the mouth line, the dip under the lower lip)
 *   G  lips
 *   B  brows
 *   A  beard field (1 at the chin and jaw core, falling off up the cheeks;
 *      the shader thresholds it: stubble covers the core, a full beard more)
 * After the faces come decal layers (R = mask): the words on police vests.
 *
 * Faces are painted from seeded parameters (no image files), so every face
 * is the same every run.
 */

export const FACE_SIZE = 128;
export const FACE_LAYERS = FACES_PER_SEX * 2;
const DECALS = ["POLICE", "SHERIFF"];

let texture: THREE.DataArrayTexture | null = null;

/** Head-space metres (x right, y up, from the head centre) to canvas pixels, matching the shader's mapping. */
function toPx(hx: number, hy: number, female: boolean): [number, number] {
  const rx = female ? 0.083 : 0.09;
  const k = Math.max(0.05, 1 - (hx / rx) ** 2 - (hy / 0.115) ** 2);
  const hz = 0.1 * Math.sqrt(k);
  const u = 0.5 + Math.atan2(hx, hz) / (0.9 * Math.PI);
  const v = 0.5 + hy / 0.24;
  return [u * FACE_SIZE, (1 - v) * FACE_SIZE];
}

interface FaceSpec {
  female: boolean;
  socket: number;
  browY: number;
  browThick: number;
  browArch: number;
  browLen: number;
  noseW: number;
  noseY: number;
  mouthY: number;
  mouthW: number;
  lipUp: number;
  lipLow: number;
  fold: number;
  bags: number;
  jaw: number;
}

function faceSpec(i: number): FaceSpec {
  const r = mulberry32(9001 + i * 7919);
  const female = i >= FACES_PER_SEX;
  return {
    female,
    socket: range(r, 0.45, 0.95),
    browY: range(r, 0.022, 0.03),
    browThick: female ? range(r, 0.0025, 0.004) : range(r, 0.004, 0.0065),
    browArch: female ? range(r, 0.003, 0.006) : range(r, 0, 0.003),
    browLen: range(r, 0.024, 0.03),
    noseW: female ? range(r, 0.01, 0.013) : range(r, 0.012, 0.017),
    noseY: range(r, -0.032, -0.024),
    mouthY: range(r, -0.054, -0.047),
    mouthW: female ? range(r, 0.019, 0.023) : range(r, 0.02, 0.026),
    lipUp: female ? range(r, 0.004, 0.006) : range(r, 0.0025, 0.0045),
    lipLow: female ? range(r, 0.006, 0.0085) : range(r, 0.004, 0.0065),
    fold: range(r, 0.3, 0.85),
    bags: range(r, 0.2, 0.7),
    jaw: range(r, 0.07, 0.085),
  };
}

type Ctx = CanvasRenderingContext2D;

function channel(paint: (ctx: Ctx) => void): Uint8ClampedArray {
  const c = document.createElement("canvas");
  c.width = c.height = FACE_SIZE;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, FACE_SIZE, FACE_SIZE);
  paint(ctx);
  return ctx.getImageData(0, 0, FACE_SIZE, FACE_SIZE).data;
}

/** A soft filled ellipse in head space. */
function blob(ctx: Ctx, f: FaceSpec, hx: number, hy: number, rx: number, ry: number, value: number, blur: number) {
  const [x, y] = toPx(hx, hy, f.female);
  const [x2] = toPx(hx + rx, hy, f.female);
  const [, y2] = toPx(hx, hy + ry, f.female);
  ctx.filter = blur > 0 ? `blur(${blur}px)` : "none";
  const v = Math.round(Math.max(0, Math.min(1, value)) * 255);
  ctx.fillStyle = `rgb(${v},${v},${v})`;
  ctx.globalCompositeOperation = "lighten";
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, Math.abs(x2 - x)), Math.max(0.5, Math.abs(y2 - y)), 0, 0, Math.PI * 2);
  ctx.fill();
}

/** A soft stroke through head-space points. */
function stroke(ctx: Ctx, f: FaceSpec, pts: [number, number][], width: number, value: number, blur: number) {
  ctx.filter = blur > 0 ? `blur(${blur}px)` : "none";
  const v = Math.round(Math.max(0, Math.min(1, value)) * 255);
  ctx.strokeStyle = `rgb(${v},${v},${v})`;
  ctx.globalCompositeOperation = "lighten";
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  pts.forEach(([hx, hy], i) => {
    const [x, y] = toPx(hx, hy, f.female);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function paintFace(f: FaceSpec) {
  const ex = 0.033;
  const ey = 0.005;
  const cavity = channel((ctx) => {
    for (const s of [-1, 1]) {
      // Socket and the shadow under the brow ridge.
      blob(ctx, f, s * ex, ey + 0.002, 0.019, 0.013, 0.55 * f.socket, 3);
      blob(ctx, f, s * ex, ey + 0.012, 0.016, 0.004, 0.35 * f.socket, 2);
      // Eye bags.
      stroke(ctx, f, [[s * (ex - 0.012), ey - 0.011], [s * ex, ey - 0.014], [s * (ex + 0.012), ey - 0.01]], 1.5, 0.35 * f.bags, 1);
      // Nasolabial fold, nose wing to mouth corner.
      stroke(ctx, f, [[s * (f.noseW + 0.004), f.noseY + 0.006], [s * (f.mouthW + 0.006), f.mouthY - 0.004], [s * (f.mouthW + 0.004), f.mouthY - 0.014]], 1.6, 0.5 * f.fold, 1.2);
      // Nostrils and the side of the nose.
      blob(ctx, f, s * f.noseW * 0.5, f.noseY, 0.003, 0.002, 0.75, 0.6);
      stroke(ctx, f, [[s * 0.008, ey - 0.004], [s * (f.noseW * 0.8), f.noseY + 0.004]], 1.4, 0.22, 1.5);
    }
    // Philtrum, mouth line, under the lower lip, chin crease.
    blob(ctx, f, 0, (f.noseY + f.mouthY) / 2 + 0.002, 0.003, 0.006, 0.18, 1);
    stroke(ctx, f, [[-f.mouthW, f.mouthY + 0.001], [-f.mouthW * 0.4, f.mouthY - 0.0005], [0, f.mouthY], [f.mouthW * 0.4, f.mouthY - 0.0005], [f.mouthW, f.mouthY + 0.001]], 1.1, 0.8, 0.4);
    blob(ctx, f, 0, f.mouthY - f.lipLow - 0.005, f.mouthW * 0.7, 0.003, 0.4, 1.5);
    blob(ctx, f, 0, -0.088, 0.012, 0.003, 0.2, 1.5);
  });
  const lips = channel((ctx) => {
    // Upper lip with a cupid's bow, fuller lower lip.
    stroke(ctx, f, [[-f.mouthW * 0.95, f.mouthY + 0.0005], [-f.mouthW * 0.4, f.mouthY + f.lipUp], [-0.003, f.mouthY + f.lipUp * 0.75], [0.003, f.mouthY + f.lipUp * 0.75], [f.mouthW * 0.4, f.mouthY + f.lipUp], [f.mouthW * 0.95, f.mouthY + 0.0005]], 2.2, 1, 0.6);
    blob(ctx, f, 0, f.mouthY + f.lipUp * 0.5, f.mouthW * 0.8, f.lipUp * 0.55, 1, 0.6);
    blob(ctx, f, 0, f.mouthY - f.lipLow * 0.5, f.mouthW * 0.82, f.lipLow * 0.6, 1, 0.8);
  });
  const brows = channel((ctx) => {
    for (const s of [-1, 1]) {
      const inner = s * (ex - f.browLen * 0.5);
      const outer = s * (ex + f.browLen * 0.55);
      const mid = s * (ex + f.browLen * 0.1);
      stroke(ctx, f, [[inner, f.browY - 0.001], [mid, f.browY + f.browArch], [outer, f.browY - 0.003 + f.browArch * 0.3]], (f.browThick / 0.24) * FACE_SIZE, 1, 0.7);
    }
  });
  const beard = channel((ctx) => {
    if (f.female) return;
    // The jaw and chin, heavily blurred so the field falls off up the cheeks.
    ctx.filter = "blur(6px)";
    ctx.fillStyle = "#fff";
    ctx.globalCompositeOperation = "source-over";
    ctx.beginPath();
    const jaw: [number, number][] = [
      [-f.jaw, -0.018],
      [-f.jaw * 0.98, -0.045],
      [-f.jaw * 0.8, -0.075],
      [-0.03, -0.1],
      [0, -0.108],
      [0.03, -0.1],
      [f.jaw * 0.8, -0.075],
      [f.jaw * 0.98, -0.045],
      [f.jaw, -0.018],
      [f.mouthW + 0.012, f.noseY - 0.004],
      [0, f.noseY - 0.002],
      [-(f.mouthW + 0.012), f.noseY - 0.004],
    ];
    jaw.forEach(([hx, hy], i) => {
      const [x, y] = toPx(hx, hy, f.female);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    // Clear the lips and a little round them.
    ctx.filter = "blur(1.5px)";
    ctx.fillStyle = "#000";
    const [mx, my] = toPx(0, f.mouthY - (f.lipLow - f.lipUp) * 0.5, f.female);
    const [mx2] = toPx(f.mouthW * 1.05, f.mouthY, f.female);
    const [, my2] = toPx(0, f.mouthY + f.lipUp + 0.002, f.female);
    ctx.beginPath();
    ctx.ellipse(mx, my, mx2 - mx, Math.abs(my2 - my) + 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  return { cavity, lips, brows, beard };
}

function paintDecal(text: string) {
  return channel((ctx) => {
    ctx.filter = "none";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let size = 46;
    ctx.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
    while (ctx.measureText(text).width > FACE_SIZE * 0.92 && size > 10) {
      size -= 2;
      ctx.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
    }
    ctx.fillText(text, FACE_SIZE / 2, FACE_SIZE / 2);
  });
}

/** The shared face/decal texture array (painted on first use). */
export function faceTexture(): THREE.DataArrayTexture {
  if (texture) return texture;
  const layers = FACE_LAYERS + DECALS.length;
  const S = FACE_SIZE;
  const data = new Uint8Array(S * S * 4 * layers);
  const put = (layer: number, r: Uint8ClampedArray, g?: Uint8ClampedArray, b?: Uint8ClampedArray, a?: Uint8ClampedArray) => {
    for (let y = 0; y < S; y++) {
      // Canvas rows run top-down; texture rows bottom-up.
      const src = (S - 1 - y) * S * 4;
      const dst = (layer * S * S + y * S) * 4;
      for (let x = 0; x < S; x++) {
        const si = src + x * 4;
        const di = dst + x * 4;
        data[di] = r[si];
        data[di + 1] = g ? g[si] : 0;
        data[di + 2] = b ? b[si] : 0;
        data[di + 3] = a ? a[si] : 0;
      }
    }
  };
  if (typeof document !== "undefined") {
    for (let i = 0; i < FACE_LAYERS; i++) {
      const f = paintFace(faceSpec(i));
      put(i, f.cavity, f.lips, f.brows, f.beard);
    }
    DECALS.forEach((text, i) => put(FACE_LAYERS + i, paintDecal(text)));
  }
  texture = new THREE.DataArrayTexture(data, S, S, layers);
  texture.format = THREE.RGBAFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}
