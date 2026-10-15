import * as THREE from "three";
import { GARMENTS, type Appearance, type GarmentDef, type GarmentPick } from "../../sim/appearance";
import { faceTexture, FACE_LAYERS } from "../render/faceAtlas";
import { COLLAR, DECAL, FEET, HAIR, HAIR_THICKNESS, OUTER_KIND, PATTERN, POCKETS, strapMask, woundRest } from "./humanoidLook";
import { HEAD_CENTRE } from "./humanoidGeometry";

/**
 * The character material: a MeshStandardMaterial whose colour, roughness and
 * metalness are painted per pixel from per-character uniforms (clothes,
 * patterns, seams and pockets, uniforms and badges, face, eyes, hair, the
 * state of the dead, blood and wounds), and whose clothes have thickness (a
 * small vertex offset along the normal, skinned with the body). All
 * characters share one shader program.
 */

/** An sRGB hex colour as a linear GLSL vec3 (shader maths runs in linear light). */
const L = (hex: string) => {
  const c = new THREE.Color(hex);
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
};

const COMMON = /* glsl */ `
uniform vec4 uTop;     // kind-agnostic: x unused, y sleeve, z pattern, w hem
uniform vec4 uTopB;    // x collar, y pockets, z placket, w thickness
uniform vec4 uOuter;   // x kind (0 none, 1 generic), y sleeve, z open, w hem
uniform vec4 uOuterB;  // x collar, y pockets, z flags (1 zip, 2 hood, 4 placket), w thickness
uniform vec4 uBottom;  // x pattern, y leg, z pockets, w thickness
uniform vec4 uFeet;    // x kind, y shaft
uniform vec4 uHairS;   // x style, y beanie, z hair thickness
uniform float uHeadY;
uniform float uSeed;

float hhash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hhash(i), hhash(i + vec3(1,0,0)), f.x), mix(hhash(i + vec3(0,1,0)), hhash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hhash(i + vec3(0,0,1)), hhash(i + vec3(1,0,1)), f.x), mix(hhash(i + vec3(0,1,1)), hhash(i + vec3(1,1,1)), f.x), f.y), f.z);
}

// Hair on the scalp: 0..1 by style. h is relative to the head centre.
float hairCover(vec3 h) {
  int s = int(uHairS.x + 0.5);
  if (s == 0) return 0.0;
  float front = smoothstep(-0.02, 0.065, h.z);
  bool longish = s == 3 || s == 4;
  float line = mix(longish ? -0.095 : -0.06, 0.056, front);
  // An irregular hairline: recessions at the temples, a little peak in the middle, ragged edge.
  line += front * (smoothstep(0.015, 0.045, abs(h.x)) * 0.012 - (1.0 - smoothstep(0.0, 0.012, abs(h.x))) * 0.004);
  line += (vnoise(h * 180.0 + uSeed) - 0.5) * 0.008;
  float c = smoothstep(line - 0.008, line + 0.006, h.y);
  // Ears stay clear unless the hair is long enough to cover them.
  if (!longish) c *= 1.0 - (1.0 - smoothstep(0.02, 0.03, h.y)) * smoothstep(0.072, 0.082, abs(h.x)) * smoothstep(-0.04, -0.025, h.z) * (1.0 - smoothstep(0.03, 0.045, h.z));
  // Balding: the crown and temples go first.
  if (s == 7) c *= 1.0 - smoothstep(0.035, 0.06, h.y) * smoothstep(-0.05, 0.0, h.z);
  return c;
}

// Torso coverage. Outer: 1 where the outer garment covers this point.
float outerTorso(vec3 p) {
  if (uOuter.x < 0.5) return 0.0;
  int kind = int(uOuter.x + 0.5);
  float k = smoothstep(uOuter.w - 0.006, uOuter.w + 0.006, p.y);
  if (kind == 13) {
    // Apron: the front only, a bib to the chest.
    k *= smoothstep(-0.01, 0.02, p.z) * (1.0 - smoothstep(1.31, 1.33, p.y));
    k *= 1.0 - step(1.12, p.y) * smoothstep(0.1, 0.12, abs(p.x));
  }
  // Sleeveless outers: armholes.
  if (uOuter.y < 0.05) k *= 1.0 - smoothstep(1.24, 1.3, p.y) * smoothstep(0.13, 0.15, abs(p.x));
  // Vests and some jackets open in a V at the neck.
  if (uOuterB.x > 0.5 && uOuterB.x < 1.5) k *= 1.0 - step(0.0, p.z) * smoothstep(1.43 - (0.16 - abs(p.x) * 1.4), 1.44 - (0.16 - abs(p.x) * 1.4), p.y);
  // Worn open: a gap down the front.
  if (uOuter.z > 0.5) k *= 1.0 - (1.0 - smoothstep(0.035, 0.045, abs(p.x))) * smoothstep(-0.01, 0.02, p.z);
  return k;
}

// Top: 1 where the top covers. Below its hem (or under the waistband when tucked) the bottom shows.
float topTorso(vec3 p) {
  bool tucked = uTop.w > 0.93;
  float k = smoothstep(tucked ? 0.995 : uTop.w - 0.006, tucked ? 1.005 : uTop.w + 0.006, p.y);
  // Sleeveless: bare shoulders.
  if (uTop.y < 0.05) k *= 1.0 - smoothstep(1.3, 1.34, p.y) * smoothstep(0.13, 0.15, abs(p.x));
  // Necklines: V-necks, open collars and polos show a little skin at the front.
  int c = int(uTopB.x + 0.5);
  float depth = c == 1 ? 0.1 : c == 3 ? 0.05 : c == 2 ? 0.035 : 0.0;
  if (depth > 0.0) k *= 1.0 - step(0.0, p.z) * smoothstep(1.43 - (depth - abs(p.x) * 1.3), 1.435 - (depth - abs(p.x) * 1.3), p.y);
  return k;
}

float clothOffset(int z, float t, vec3 p) {
  if (z == 1) {
    float tc = topTorso(p);
    float o = tc * uTopB.w + (1.0 - tc) * step(p.y, 1.01) * uBottom.w;
    float th = uOuterB.w;
    if (int(uOuter.x + 0.5) == 4) th *= 0.78 + 0.22 * abs(sin(p.y * 38.0));
    return o + outerTorso(p) * th;
  }
  if (z == 0) {
    float o = (1.0 - smoothstep(uTop.y - 0.04, uTop.y, t)) * uTopB.w;
    float th = uOuterB.w;
    if (int(uOuter.x + 0.5) == 4) th *= 0.78 + 0.22 * abs(sin(t * 18.0));
    return o + (1.0 - smoothstep(uOuter.y - 0.04, uOuter.y, t)) * step(0.5, uOuter.x) * th;
  }
  if (z == 2) {
    float o = (1.0 - smoothstep(uBottom.y - 0.04, uBottom.y, t)) * uBottom.w;
    return o + smoothstep(0.98 - uFeet.y, 1.0 - uFeet.y, t) * step(0.05, uFeet.y) * 0.006;
  }
  if (z == 4) {
    vec3 h = p - vec3(0.0, uHeadY, 0.01);
    float o = hairCover(h) * uHairS.z;
    // A beanie sits above the brows (the highest brow reaches h.y ~0.036).
    if (uHairS.y > 0.5) o = max(o, smoothstep(0.035, 0.05, h.y) * 0.011);
    return o;
  }
  return 0.0;
}
`;

const VERTEX_HEAD = /* glsl */ `
uniform float uDecay;
attribute float zone;
attribute float limbT;
varying float vZone;
varying float vLimbT;
varying vec3 vRest;
varying vec3 vRestN;
${COMMON}
`;

const VERTEX_BODY = /* glsl */ `
#include <begin_vertex>
vZone = zone; vLimbT = limbT; vRest = position; vRestN = normal;
transformed += normal * clothOffset(int(zone + 0.5), limbT, position);
// The long dead's eyes sink into the sockets.
if (int(zone + 0.5) == 7) transformed.z -= uDecay * 0.0025;
`;

const FRAGMENT_HEAD = /* glsl */ `
uniform vec3 cSkin, cHair, cIris, cTop, cTop2, cOuter, cOuter2, cBottom, cBottom2, cShoes, cHead, cGear, cLeather, cGloves;
uniform vec4 uFace;    // x face layer, y beard, z age lines, w eye open
uniform vec4 uCond;    // x grime, y blood, z blood age, w tears
uniform vec4 uMarks;   // x badge (0 none, 1 silver, 2 gold), y back text layer (-1 none), z name tape, w patch
uniform vec4 uExtras;  // x glasses, y watch, z gloves, w lanyard
uniform vec4 uWoundA, uWoundB;
uniform float uOuterP, uDecay, uStraps, uDetail, uHeadwear, uFresh;
uniform highp sampler2DArray uFaceTex;
varying float vZone;
varying float vLimbT;
varying vec3 vRest;
varying vec3 vRestN;
${COMMON}

vec3 patterned(vec3 base, vec3 alt, float kind, vec3 p) {
  int k = int(kind + 0.5);
  if (k == 0 || uDetail < 0.5) return base;
  vec2 c = vec2(atan(p.x, p.z) * 0.16, p.y);
  if (k == 1) return base * (0.86 + 0.28 * vnoise(p * 160.0 + uSeed));
  if (k == 2) return mix(base, alt, smoothstep(0.42, 0.5, abs(fract(p.y * 16.0) * 2.0 - 1.0)) * 0.9);
  if (k == 3) {
    float a = abs(fract(c.x * 8.0 + 0.25) - 0.5) * 2.0;
    float b = abs(fract(c.y * 8.0) - 0.5) * 2.0;
    float wide = step(0.6, a) + step(0.6, b);
    vec3 col = mix(base, alt, min(wide, 1.0) * 0.6);
    col = mix(col, col * 0.55, max(wide - 1.0, 0.0) * 0.6);
    float thin = max(step(0.94, a), step(0.94, b));
    return mix(col, mix(alt, ${L("#c8c0aa")}, 0.4), thin * 0.6);
  }
  if (k == 4) {
    float n1 = vnoise(p * 7.0 + uSeed);
    float n2 = vnoise(p * 12.0 - uSeed);
    vec3 col = mix(base, alt, step(0.52, n1));
    col = mix(col, base * 1.3 + vec3(0.03, 0.02, 0.0), step(0.6, n2));
    return mix(col, ${L("#3a3326")}, step(0.42, n1 * n2));
  }
  return base;
}

// Living or dead skin.
vec3 skinTone(vec3 p) {
  vec3 s = cSkin * (0.94 + 0.12 * vnoise(p * 28.0 + uSeed));
  if (uDecay > 0.0) {
    // Bloodless: desaturated, greyed toward green, a little darker. The living tone shows through.
    float l = dot(s, vec3(0.2126, 0.7152, 0.0722));
    vec3 dead = mix(s, vec3(l), 0.78) * vec3(0.84, 0.92, 0.86) * (0.66 - 0.3 * l);
    s = mix(s, dead, clamp(0.55 + uDecay * 0.45, 0.0, 1.0));
    if (uDetail > 0.5) {
      s = mix(s, s * vec3(0.8, 0.74, 0.84), smoothstep(0.6, 0.9, vnoise(p * 9.0 - uSeed)) * uDecay);
      float v = 1.0 - abs(2.0 * vnoise(p * 30.0 + uSeed * 0.3) - 1.0);
      s = mix(s, ${L("#3a4250")}, smoothstep(0.955, 0.99, v) * uDecay * 0.45);
    }
    // Lividity pools low in the limbs.
    s = mix(s, s * vec3(0.72, 0.58, 0.78), (1.0 - smoothstep(0.25, 0.95, p.y)) * uDecay * 0.6);
  }
  return s;
}

float seam(float d, float w) { return 1.0 - smoothstep(0.0, w, abs(d)); }
float box2(vec2 p, vec2 lo, vec2 hi) { return step(lo.x, p.x) * step(p.x, hi.x) * step(lo.y, p.y) * step(p.y, hi.y); }
float outline2(vec2 p, vec2 lo, vec2 hi, float w) {
  float inside = box2(p, lo - w, hi + w);
  float core = box2(p, lo + w, hi - w);
  return inside - core;
}

// Badge on the left chest.
float badgeAt(vec3 p) {
  vec2 b = vec2(p.x - 0.075, p.y - 1.3);
  if (p.z < 0.0) return 0.0;
  return step(abs(b.x), 0.02 - max(0.0, -b.y) * 0.45) * step(abs(b.y), 0.028);
}
`;

const FRAGMENT_BODY = /* glsl */ `
#include <color_fragment>
float hRough = 0.85;
float hMetal = 0.0;
{
int z = int(vZone + 0.5);
vec3 p = vRest;
vec3 n = normalize(vRestN);
float t = vLimbT;
vec3 col = vec3(1.0);
float rough = 0.85;
float metal = 0.0;
// 0 skin, 1 top, 2 outer, 3 bottom, 4 shoe, 5 other
int layer = 5;
float detail = uDetail;

// Wounds tear through clothes.
float woundA = uWoundA.w > 0.0 ? distance(p, uWoundA.xyz) / uWoundA.w : 99.0;
float woundB = uWoundB.w > 0.0 ? distance(p, uWoundB.xyz) / uWoundB.w : 99.0;
float wound = min(woundA, woundB);
// Tears: holes worn through, more at knees, elbows and hems.
float tearZone = z == 2 ? 1.0 - abs(t - 0.5) * 1.6 : z == 0 ? 1.0 - abs(t - 0.5) * 1.6 : 0.6;
float tearN = detail > 0.5 ? vnoise(p * 34.0 + uSeed * 2.3) * 0.75 + vnoise(p * 90.0 - uSeed) * 0.25 + tearZone * 0.05 : 0.0;
float tearAt = 0.9 - uCond.w * 0.07;
float tear = smoothstep(tearAt, tearAt + 0.008, tearN) * step(0.01, uCond.w);
float tearRim = smoothstep(tearAt - 0.04, tearAt, tearN) * (1.0 - tear) * step(0.01, uCond.w);
bool torn = tear > 0.5 || wound < 1.15;

if (z == 1) {
  // Torso: outer, then top, then bottom, then skin.
  float oc = outerTorso(p);
  float tc = topTorso(p);
  if (oc > 0.5 && !torn) layer = 2;
  else if (tc > 0.5 && !(torn && oc < 0.5)) layer = 1;
  else if (p.y < 1.01 && !torn) layer = 3;
  else layer = 0;
  if (layer == 2) {
    int kind = int(uOuter.x + 0.5);
    col = patterned(cOuter, cOuter2, uOuterP, p);
    rough = kind == 6 || kind == 4 ? 0.5 : 0.85;
    if (kind == 4) col *= 0.9 + 0.1 * abs(sin(p.y * 38.0)); // baffles catch light
    if (detail > 0.5) {
      float flags = uOuterB.z;
      // Zip or placket down the front.
      if (mod(flags, 2.0) > 0.5 && uOuter.z < 0.5 && p.z > 0.0) { float s = seam(p.x, 0.005); col = mix(col, col * 0.4, s); rough = mix(rough, 0.35, s); metal = mix(metal, 0.4, s); }
      if (uOuter.z > 0.5 && p.z > 0.0) col *= 1.0 - seam(abs(p.x) - 0.045, 0.006) * 0.45;
      // Hood collar / ribbed collar band.
      int oc2 = int(uOuterB.x + 0.5);
      if (oc2 == 4 || oc2 == 5) col *= 1.0 - smoothstep(1.395, 1.405, p.y) * 0.18;
      if (oc2 == 4 && p.z > 0.0 && p.y > 1.24 && p.y < 1.39) col = mix(col, ${L("#b0aa9c")}, seam(abs(p.x) - 0.032, 0.003)); // drawstrings
      // Pockets.
      int pk = int(uOuterB.y + 0.5);
      vec2 q = vec2(abs(p.x), p.y);
      if (p.z > 0.0) {
        if (pk == 3) col *= 1.0 - outline2(vec2(p.x, p.y), vec2(-0.11, 0.87), vec2(0.11, 1.0), 0.003) * 0.5;
        if (pk == 2) col *= 1.0 - (outline2(q, vec2(0.04, 1.19), vec2(0.11, 1.29), 0.003) + seam(p.y - 1.275, 0.003) * box2(q, vec2(0.04, 1.2), vec2(0.11, 1.3))) * 0.45;
        if (pk == 6) col *= 1.0 - outline2(q, vec2(0.03, uOuter.w + 0.06), vec2(0.12, uOuter.w + 0.16), 0.003) * 0.45;
      }
      // Hi-vis: reflective bands.
      if (kind == 11) {
        float band = box2(vec2(0.0, p.y), vec2(-1.0, 1.0), vec2(1.0, 1.035)) + box2(vec2(0.0, p.y), vec2(-1.0, 1.12), vec2(1.0, 1.155));
        band += step(1.155, p.y) * box2(vec2(abs(p.x), 0.0), vec2(0.06, -1.0), vec2(0.09, 1.0));
        if (band > 0.5) { col = ${L("#b4b6b0")}; rough = 0.3; metal = 0.25; }
      }
      // Police vest: panel seams and the word on the back.
      if (kind == 14) {
        col *= 1.0 - seam(abs(abs(atan(p.x, p.z)) - 1.5708), 0.03) * 0.3;
        if (uMarks.y >= 0.0 && p.z < -0.02 && p.y > 1.16 && p.y < 1.33) {
          vec2 uv = vec2(0.5 - p.x / 0.32, (p.y - 1.16) / 0.17);
          float txt = texture(uFaceTex, vec3(uv, ${FACE_LAYERS.toFixed(1)} + uMarks.y)).r;
          col = mix(col, ${L("#c0c0b6")}, txt);
        }
      }
    }
    if (uMarks.x > 0.5 && badgeAt(p) > 0.5) { col = uMarks.x > 1.5 ? vec3(0.62, 0.46, 0.16) : vec3(0.6, 0.6, 0.62); metal = 0.9; rough = 0.35; }
  } else if (layer == 1) {
    col = patterned(cTop, cTop2, uTop.z, p);
    if (detail > 0.5) {
      int c = int(uTopB.x + 0.5);
      // Collar band and ringer trim.
      float collarBand = smoothstep(1.405, 1.415, p.y);
      if (int(uTop.z + 0.5) == 5) col = mix(col, cTop2, collarBand);
      else col *= 1.0 - collarBand * (c == 3 || c == 2 ? 0.22 : 0.1);
      if ((c == 3 || c == 2) && p.z > 0.0) col *= 1.0 - seam(p.y - 1.43 + (0.06 - abs(p.x)) * 0.9, 0.004) * step(abs(p.x), 0.07) * 0.5;
      // Placket and buttons.
      if (uTopB.z > 0.5 && p.z > 0.0 && p.y > max(uTop.w, 1.0)) {
        if (c != 2 || p.y > 1.3) {
          col *= 1.0 - seam(abs(p.x) - 0.011, 0.002) * 0.4;
          float bt = 1.0 - smoothstep(0.0025, 0.004, length(vec2(p.x, mod(p.y - 0.02, 0.075) - 0.0375)));
          col = mix(col, ${L("#9a958a")}, bt * step(abs(p.x), 0.01));
        }
      }
      // Pockets.
      int pk = int(uTopB.y + 0.5);
      vec2 q = vec2(p.x, p.y);
      if (p.z > 0.0 && (pk == 1 || pk == 2)) {
        float pocket = outline2(vec2(-q.x, q.y), vec2(0.035, 1.2), vec2(0.1, 1.3), 0.0025);
        if (pk == 2) pocket += outline2(q, vec2(0.035, 1.2), vec2(0.1, 1.3), 0.0025);
        col *= 1.0 - pocket * 0.45;
      }
      // Side seams.
      col *= 1.0 - seam(abs(atan(p.x, p.z)) - 1.5708, 0.025) * 0.18;
    }
    rough = 0.9;
    if (uMarks.x > 0.5 && badgeAt(p) > 0.5) { col = uMarks.x > 1.5 ? vec3(0.62, 0.46, 0.16) : vec3(0.6, 0.6, 0.62); metal = 0.9; rough = 0.35; }
    if (uMarks.z > 0.5 && p.z > 0.0 && box2(p.xy, vec2(-0.105, 1.315), vec2(-0.04, 1.335)) > 0.5) { col = ${L("#1c1c1a")}; rough = 0.5; }
  } else if (layer == 3) {
    col = patterned(cBottom, cBottom2, uBottom.x, p);
    // Waistband.
    col *= 1.0 - smoothstep(0.975, 0.985, p.y) * 0.15;
    rough = 0.9;
  } else {
    col = skinTone(p);
    rough = uDecay > 0.0 ? 0.45 : 0.55;
  }
  // Pack straps and weapon slings over everything.
  if (uStraps > 0.5) {
    int st = int(uStraps + 0.5);
    bool pack = st == 1 || st == 3 || st == 5 || st == 7 || st == 2 || st == 6;
    if (pack && p.y > 1.02) {
      float sx = abs(p.x) - (p.z > 0.0 ? 0.085 : 0.075);
      float strap = 1.0 - smoothstep(0.016, 0.02, abs(sx));
      if ((st == 2 || st == 3 || st == 6 || st == 7) && p.z > 0.0) strap = max(strap, box2(p.xy, vec2(-0.09, 1.26), vec2(0.09, 1.28)));
      if (strap > 0.5) { col = cGear * 0.6; rough = 0.8; layer = 5; }
    }
    if (st >= 4) {
      float d = (p.z > 0.0 ? p.x : -p.x) - (p.y - 1.15) * 0.55;
      if (abs(d) < 0.016 && p.y > 0.95) { col = ${L("#2a2620")}; rough = 0.8; layer = 5; }
    }
  }
  // Lanyard.
  if (uExtras.w > 0.5 && p.z > 0.0 && layer != 0) {
    float lx = mix(0.0, 0.055, clamp((p.y - 1.19) / 0.22, 0.0, 1.0));
    if (p.y > 1.19 && abs(abs(p.x) - lx) < 0.004) col = ${L("#24345e")};
    if (box2(p.xy, vec2(-0.028, 1.11), vec2(0.028, 1.19)) > 0.5) { col = ${L("#c4c2b8")}; if (box2(p.xy, vec2(-0.02, 1.135), vec2(-0.002, 1.17)) > 0.5) col = ${L("#5a5048")}; rough = 0.4; }
  }
} else if (z == 0) {
  // Arms: outer sleeve, top sleeve, skin.
  if (uOuter.x > 0.5 && t < uOuter.y && !torn) {
    layer = 2;
    col = patterned(cOuter, cOuter2, uOuterP, p);
    col *= 1.0 - smoothstep(uOuter.y - 0.05, uOuter.y - 0.04, t) * 0.18;
    rough = int(uOuter.x + 0.5) == 6 || int(uOuter.x + 0.5) == 4 ? 0.5 : 0.85;
    if (int(uOuter.x + 0.5) == 4) col *= 0.9 + 0.1 * abs(sin(t * 18.0));
  } else if (t < uTop.y && !torn) {
    layer = 1;
    col = patterned(cTop, cTop2, uTop.z, p);
    float cuff = smoothstep(uTop.y - 0.05, uTop.y - 0.04, t);
    if (int(uTop.z + 0.5) == 5) col = mix(col, cTop2, cuff);
    else col *= 1.0 - cuff * 0.15;
    rough = 0.9;
    // Shoulder patch on a uniform.
    if (uMarks.w > 0.5 && detail > 0.5 && n.x * sign(p.x) > 0.55) {
      float d = length(vec2(p.z / 0.03, (t - 0.16) / 0.06));
      if (d < 1.0) col = d > 0.82 ? ${L("#9a8040")} : (d < 0.45 ? ${L("#a49678")} : cTop * 1.4);
    }
  } else {
    layer = 0;
    col = skinTone(p);
    rough = uDecay > 0.0 ? 0.45 : 0.55;
    // Wristwatch on the left wrist.
    if (uExtras.y > 0.5 && p.x < 0.0 && t > 0.9 && t < 0.935) { col = n.z > 0.4 ? vec3(0.5, 0.5, 0.48) : ${L("#151413")}; metal = n.z > 0.4 ? 0.8 : 0.0; rough = 0.4; }
  }
} else if (z == 2) {
  // Legs: apron front, bottoms, boot shafts and socks, skin.
  bool apron = int(uOuter.x + 0.5) == 13 && n.z > 0.35 && p.y > uOuter.w && !torn;
  float bootFrom = 1.0 - uFeet.y;
  int fk = int(uFeet.x + 0.5);
  if (apron) { layer = 2; col = cOuter; rough = 0.85; }
  else if (uFeet.y > 0.05 && t > bootFrom && fk != 8) { layer = 4; col = cShoes * (0.9 + 0.1 * vnoise(p * 60.0)); rough = 0.55; col *= 1.0 - smoothstep(bootFrom, bootFrom + 0.015, t) * (1.0 - smoothstep(bootFrom + 0.015, bootFrom + 0.03, t)) * 0.3; }
  else if (t < uBottom.y && !torn) {
    layer = 3;
    col = patterned(cBottom, cBottom2, uBottom.x, p);
    rough = 0.9;
    float side = sign(p.x);
    float lx = p.x - side * 0.095;
    if (detail > 0.5) {
      int pk = int(uBottom.z + 0.5);
      // Outer and inner seams.
      float sang = atan(lx * side, p.z);
      col *= 1.0 - (seam(sang - 1.5708, 0.06) + seam(sang + 1.5708, 0.06)) * 0.22;
      if (pk == 4) {
        // Jeans: fade on the thigh fronts and knees, back pockets.
        col = mix(col, col * 1.35 + 0.02, smoothstep(0.3, 0.9, vnoise(p * vec3(18.0, 6.0, 18.0) + uSeed)) * step(0.0, p.z) * 0.5);
        if (p.z < 0.0) col *= 1.0 - outline2(vec2(abs(lx), p.y), vec2(0.0, 0.82), vec2(0.055, 0.93), 0.003) * 0.4;
        if (p.z > 0.0 && p.y > 0.86) col *= 1.0 - seam(abs(lx) * 1.4 - (p.y - 0.86) * 1.1 - 0.0, 0.003) * 0.4;
      }
      if (pk == 5 && n.x * side > 0.5) col *= 1.0 - outline2(vec2(p.z, p.y), vec2(-0.05, 0.6), vec2(0.05, 0.74), 0.003) * 0.45;
    }
    // Hem.
    col *= 1.0 - smoothstep(uBottom.y - 0.035, uBottom.y - 0.025, t) * step(uBottom.y, 0.99) * 0.2;
    if (fk == 8 && t > 0.88) { col = cShoes; layer = 4; }
  } else if (fk == 8 && t > 0.88) { layer = 4; col = cShoes; rough = 0.9; }
  else { layer = 0; col = skinTone(p); rough = uDecay > 0.0 ? 0.45 : 0.55; }
} else if (z == 3) {
  // Feet.
  layer = 4;
  int fk = int(uFeet.x + 0.5);
  col = cShoes;
  rough = 0.6;
  float sole = 1.0 - smoothstep(0.022, 0.03, p.y);
  if (fk == 1 || fk == 2) { col = mix(col, ${L("#b8b2a5")}, sole); if (fk == 2) col = mix(col, ${L("#c0c0b8")}, seam(p.y - 0.05 - p.z * 0.1, 0.006) * step(0.0, abs(p.x) - 0.06)); if (p.z > 0.06 && p.y > 0.06) col *= 0.75 + 0.25 * step(0.5, fract(p.z * 90.0)); }
  else if (fk == 3) { rough = 0.32; col *= 0.9 + 0.2 * smoothstep(0.03, 0.08, p.y); col = mix(col, ${L("#1a1816")}, sole); }
  else if (fk >= 4 && fk <= 6) { rough = 0.55; col = mix(col, ${L("#1e1a16")}, sole); }
  else if (fk == 9) { col = skinTone(p) * (1.0 - sole * 0.5); layer = 0; rough = 0.6; }
  else if (fk == 7 || fk == 8) { rough = 0.95; }
} else if (z == 4) {
  // Head: skin, face, beard, hair, beanie.
  layer = 0;
  vec3 h = p - vec3(0.0, uHeadY, 0.01);
  col = skinTone(p);
  rough = uDecay > 0.0 ? 0.42 : 0.52;
  if (detail > 0.5 && h.z > -0.03) {
    vec2 fuv = vec2(0.5 + atan(h.x, h.z) / (0.9 * PI), 0.5 + h.y / 0.24);
    vec4 f = texture(uFaceTex, vec3(fuv, uFace.x));
    float cav = min(f.r * (1.0 + uDecay * 1.4), 1.0);
    col *= 1.0 - cav * 0.6;
    vec3 lip = uDecay > 0.0 ? ${L("#4a3a40")} : col * vec3(0.86, 0.6, 0.58);
    col = mix(col, lip, f.g * 0.75);
    if (uDecay <= 0.0) {
      // Warmth in the cheeks, nose and ears of the living.
      float warm = (1.0 - smoothstep(0.0, 0.03, length(vec2(abs(h.x) - 0.045, h.y + 0.03)))) * 0.4 + smoothstep(0.075, 0.09, abs(h.x)) * 0.3;
      col *= mix(vec3(1.0), vec3(1.06, 0.95, 0.93), clamp(warm, 0.0, 1.0));
    }
    // Age lines: forehead, crow's feet.
    if (uFace.z > 0.05) {
      float fh = smoothstep(0.03, 0.04, h.y) * (1.0 - smoothstep(0.055, 0.06, h.y)) * step(abs(h.x), 0.05);
      float crow = (1.0 - smoothstep(0.01, 0.02, length(vec2(abs(h.x) - 0.06, h.y - 0.002)))) ;
      float lines = max(fh * step(0.6, fract(h.y * 260.0)), crow * step(0.6, fract(atan(h.y - 0.002, abs(h.x) - 0.06) * 3.0)));
      col *= 1.0 - lines * uFace.z * 0.25;
    }
    // Brows (greying with age).
    col = mix(col, mix(cHair, ${L("#a09a92")}, uFace.z * 0.4) * 0.8, f.b * 0.85);
    // Beard and stubble.
    if (uFace.y > 0.01) {
      float bm = smoothstep(1.0 - uFace.y - 0.1, 1.0 - uFace.y + 0.02, f.a);
      // Stubble is a shadow, blue-grey on the skin with a fine speckle, not a painted beard.
      if (uFace.y < 0.5) col = mix(col, col * vec3(0.74, 0.76, 0.8), bm * (0.25 + 0.4 * step(0.6, hhash(floor(p * 1400.0)))) * min(1.0, uFace.y * 2.2));
      else { col = mix(col, cHair * (0.8 + 0.35 * vnoise(vec3(p.x * 500.0, p.y * 120.0, p.z * 500.0))), bm); rough = mix(rough, 0.7, bm); }
    }
    // Glasses: rims, bridge, arms.
    if (uExtras.x > 0.5) {
      vec2 e = vec2(abs(h.x) - 0.033, h.y - 0.005);
      float rim = (1.0 - smoothstep(0.0012, 0.0024, abs(length(e * vec2(1.0, 1.35)) - 0.016))) * step(0.055, h.z);
      rim += step(abs(h.x), 0.017) * (1.0 - smoothstep(0.0012, 0.002, abs(h.y - 0.009))) * step(0.07, h.z);
      rim += step(0.06, abs(h.x)) * (1.0 - smoothstep(0.0012, 0.002, abs(h.y - 0.009))) * step(h.z, 0.065);
      if (rim > 0.5) { col = ${L("#141414")}; rough = 0.3; }
    }
  }
  // Wounds/decay around the mouth for the dead.
  float hc = hairCover(h);
  if (hc > 0.01) {
    vec3 hcol = cHair * (0.78 + 0.44 * vnoise(vec3(p.x * 320.0, p.y * 45.0, p.z * 320.0)));
    float a = int(uHairS.x + 0.5) == 1 ? hc * 0.7 : hc;
    if (uDecay > 0.8) a *= step(0.22, vnoise(p * 70.0 + uSeed)); // patchy hair loss on the long dead
    col = mix(col, hcol, a);
    rough = mix(rough, 0.5, a);
  }
  if (uHairS.y > 0.5) {
    float b = smoothstep(0.04, 0.045, h.y);
    vec3 knit = cHead * (0.85 + 0.25 * step(0.5, fract(atan(h.x, h.z) * 28.0)));
    knit *= 1.0 - (1.0 - smoothstep(0.075, 0.08, h.y)) * 0.15;
    col = mix(col, knit, b);
    rough = mix(rough, 0.95, b);
    layer = b > 0.5 ? 5 : layer;
  }
} else if (z == 5) {
  // Neck and hands.
  layer = 0;
  col = skinTone(p);
  rough = uDecay > 0.0 ? 0.45 : 0.55;
  if (uExtras.z > 0.5 && p.y < 1.0) { col = cGloves; rough = 0.85; layer = 5; }
  // Collar of an outer over the neck base.
} else if (z == 7) {
  // Eyes: lids, sclera, iris, pupil.
  vec3 e = p - vec3(sign(p.x) * ${0.033}, uHeadY + ${0.005}, ${(HEAD_CENTRE.z + 0.083).toFixed(3)});
  float lid = 0.0058 * uFace.w * max(0.0, 1.0 - (e.x * e.x) / (0.0125 * 0.0125));
  if (abs(e.y + 0.0006) > lid) {
    col = skinTone(p) * (uDecay > 0.0 ? 0.6 : 0.82);
    rough = 0.55;
    layer = 0;
  } else {
    float r = length(e.xy);
    vec3 sclera = uDecay > 0.0 ? ${L("#8a8060")} : ${L("#a89e90")};
    if (uDecay > 0.0) sclera = mix(sclera, ${L("#7a2a20")}, step(0.82, vnoise(p * 900.0)) * 0.5);
    // The freshly turned: bloodshot, burst vessels.
    if (uFresh > 0.5) sclera = mix(${L("#8a3028")}, ${L("#5a1410")}, vnoise(p * 1400.0));
    // Shaded toward the corners and under the upper lid.
    col = sclera * (0.65 + 0.35 * (1.0 - smoothstep(0.004, 0.012, abs(e.x)))) * (1.0 - smoothstep(-0.001, lid, e.y) * 0.35);
    if (r < 0.0056) {
      vec3 iris = cIris * (0.7 + 0.6 * vnoise(vec3(atan(e.y, e.x) * 6.0, r * 900.0, 0.0)));
      iris *= 1.0 - smoothstep(0.0044, 0.0056, r) * 0.55;
      if (r < 0.0022) iris = vec3(0.012);
      if (uDecay > 0.0 && uFresh < 0.5) iris = mix(iris, ${L("#a8aaa2")}, 0.75);
      col = iris;
    }
    // Upper lash line.
    col *= 1.0 - smoothstep(lid - 0.0012, lid, e.y + 0.0006) * 0.8;
    rough = 0.08;
    layer = 5;
  }
} else if (z == 8) {
  layer = 5;
  col = cHair * (0.78 + 0.44 * vnoise(vec3(p.x * 280.0, p.y * 35.0, p.z * 280.0)));
  rough = 0.5;
} else if (z == 9) {
  layer = 5;
  col = cHead * (0.92 + 0.12 * vnoise(p * 90.0));
  rough = uHeadwear > 4.5 ? 0.42 : 0.85;
  vec3 h = p - vec3(0.0, uHeadY, 0.01);
  // Police cap badge; a crown seam.
  if (uHeadwear > 1.5 && uHeadwear < 2.5 && h.z > 0.07 && length(vec2(h.x, h.y - 0.055)) < 0.014) { col = uMarks.x > 1.5 ? vec3(0.62, 0.46, 0.16) : vec3(0.6, 0.6, 0.62); metal = 0.9; rough = 0.35; }
  col *= 1.0 - seam(h.x, 0.0025) * step(0.0, h.y - 0.03) * 0.3;
} else if (z == 10) {
  layer = 2;
  col = patterned(cOuter, cOuter2, uOuterP, p) * 0.94;
  rough = 0.85;
} else if (z == 11) {
  layer = 5;
  col = t > 0.5 ? ${L("#5a5440")} : cGear;
  col *= 0.9 + 0.15 * vnoise(p * 120.0);
  rough = 0.82;
} else if (z == 12) {
  layer = 5;
  col = t > 0.5 ? ${L("#4a3220")} : cLeather;
  rough = 0.55;
} else if (z == 13) {
  layer = 5;
  col = t < 0.25 ? ${L("#181818")} : (t < 0.75 ? vec3(0.5, 0.5, 0.52) : vec3(0.6, 0.45, 0.16));
  metal = t < 0.25 ? 0.0 : 0.85;
  rough = t < 0.25 ? 0.5 : 0.35;
} else if (z == 14) {
  layer = 5;
  col = t > 0.5 ? ${L("#7a2a20")} : ${L("#8a6a42")} * (0.85 + 0.3 * vnoise(vec3(p.x * 200.0, p.y * 12.0, p.z * 200.0)));
  rough = t > 0.5 ? 0.45 : 0.75;
}

// Frayed rims round tears; the skin seen through a hole sits in its shadow.
if (tearRim > 0.0 && layer >= 1 && layer <= 3) col *= 1.0 - tearRim * 0.45;
if (tear > 0.5 && layer == 0) col *= 0.55;

// Wounds: a dark wet crater, a raw ring, a bruised halo.
if (wound < 1.9) {
  vec3 bruise = mix(col, col * vec3(0.55, 0.45, 0.6), 0.7);
  col = mix(col, bruise, (1.0 - smoothstep(1.2, 1.9, wound)) * (layer == 0 || torn ? 1.0 : 0.0));
  if (wound < 1.0) {
    float ragged = vnoise(p * 300.0) * 0.35;
    if (wound < 0.55 + ragged) { col = ${L("#240404")}; rough = 0.22; metal = 0.0; }
    else if (wound < 1.0) { col = mix(${L("#5a120c")}, ${L("#3a0a06")}, vnoise(p * 200.0)); rough = 0.3; metal = 0.0; }
  }
}

// Grime: mud from the feet up, and patches.
float n1 = vnoise(p * 9.0 + uSeed);
float grime = smoothstep(0.55, 0.85, n1 + (0.6 - p.y) * 0.3) * uCond.x;
// On skin it's greyer and lighter (smears, not caked mud).
col = layer == 0 ? mix(col, col * vec3(0.66, 0.64, 0.6), grime * 0.6) : mix(col, col * vec3(0.45, 0.4, 0.33), grime * (metal > 0.5 ? 0.5 : 1.0));

// Blood: dried brown with fresher, wetter blood round the mouth and wounds; drips run down.
if (uCond.y > 0.0) {
  float bz = z == 3 ? 0.25 : 1.0;
  float mouth = 0.0;
  if (z == 4) { vec3 h = p - vec3(0.0, uHeadY, 0.01); mouth = (1.0 - smoothstep(-0.07, -0.02, h.y)) * step(0.03, h.z); bz = mouth; }
  if (z == 7) bz = 0.0;
  float near = (1.0 - smoothstep(1.0, 4.5, wound));
  // Drips from the mouth run down the middle of the chest in thin streaks.
  float chin = z == 1 ? smoothstep(1.15, 1.42, p.y) * step(0.0, p.z) * (1.0 - smoothstep(0.05, 0.09, abs(p.x))) * smoothstep(0.62, 0.9, vnoise(vec3(p.x * 110.0, p.y * 4.0, 1.0))) : 0.0;
  float bn = vnoise(p * 6.0 + uSeed * 1.7) * 0.7 + vnoise(p * 23.0 - uSeed) * 0.3;
  float bmask = smoothstep(1.0 - uCond.y * 0.24, 1.06 - uCond.y * 0.24, bn + max(p.z, 0.0) * 0.4 + near * 0.55 + chin * 0.6 + mouth * 0.5) * bz;
  float age = clamp(uCond.z - (mouth + near) * 0.5, 0.0, 1.0);
  vec3 blood = mix(${L("#4a0604")}, ${L("#24100a")}, age);
  col = mix(col, blood, bmask);
  rough = mix(rough, mix(0.18, 0.85, age), bmask);
  metal = mix(metal, 0.0, bmask);
}

// Never negative: bloom's blur would spread a negative pixel into black blocks.
diffuseColor.rgb *= max(col, vec3(0.0));
// Glossy, not mirror: a near-zero roughness peaks past half-float range in direct sun.
hRough = clamp(rough, 0.16, 1.0);
hMetal = metal;
}
`;

/** Per-character uniforms, set from an Appearance. */
export function humanoidUniforms(app: Appearance, zombie: boolean, rest: THREE.Vector3[]) {
  const g = (p: GarmentPick): GarmentDef => GARMENTS[p.id];
  const col = (hex: string) => new THREE.Color(hex);
  const top = app.top;
  const outer = app.outer;
  const tdef = g(top);
  const odef = outer ? g(outer) : null;
  const bdef = g(app.bottom);
  const fdef = g(app.feet);
  const headId = app.head?.id;
  const style = HAIR[app.hair.style];
  return {
    cSkin: { value: col(app.skin) },
    cHair: { value: col(app.hair.color) },
    cIris: { value: col(app.face.iris) },
    cTop: { value: col(top.color) },
    cTop2: { value: col(top.color2) },
    cOuter: { value: col(outer?.color ?? "#000000") },
    cOuter2: { value: col(outer?.color2 ?? "#000000") },
    cBottom: { value: col(app.bottom.color) },
    cBottom2: { value: col(app.bottom.color2) },
    cShoes: { value: col(app.feet.color) },
    cHead: { value: col(app.head?.color ?? "#000000") },
    cGear: { value: col(app.role === "hiker" ? "#3a4a3a" : app.role === "police" ? "#1a1c20" : "#3b3d3a") },
    cLeather: { value: col(app.role === "police" ? "#141414" : "#2e2018") },
    cGloves: { value: col(app.role === "hardware_worker" ? "#8a7a52" : "#2a2a28") },
    uTop: { value: new THREE.Vector4(0, tdef.sleeve ?? 0, PATTERN[top.pattern], tdef.hem ?? 0.86) },
    uTopB: { value: new THREE.Vector4(COLLAR[tdef.collar], POCKETS[tdef.pockets], tdef.placket ? 1 : 0, tdef.thickness) },
    uOuter: { value: new THREE.Vector4(outer ? (OUTER_KIND[outer.id] ?? 1) : 0, odef?.sleeve ?? 0, outer?.open ? 1 : 0, odef?.hem ?? 0.84) },
    uOuterB: { value: new THREE.Vector4(odef ? COLLAR[odef.collar] : 0, odef ? POCKETS[odef.pockets] : 0, (odef?.zip ? 1 : 0) + (odef?.hood ? 2 : 0) + (odef?.placket ? 4 : 0), odef?.thickness ?? 0) },
    uOuterP: { value: outer ? PATTERN[outer.pattern] : 0 },
    uBottom: { value: new THREE.Vector4(PATTERN[app.bottom.pattern], bdef.leg ?? 1, POCKETS[bdef.pockets], bdef.thickness) },
    uFeet: { value: new THREE.Vector4(FEET[app.feet.id as keyof typeof FEET] ?? 1, fdef.shaft ?? 0, 0, 0) },
    uHairS: { value: new THREE.Vector4(headId === "hood_up" || headId === "cap" || headId === "police_cap" || headId === "blaze_cap" ? Math.min(style, 2) : style, headId === "beanie" ? 1 : 0, HAIR_THICKNESS[style], 0) },
    uHeadwear: { value: headId === "cap" ? 1 : headId === "police_cap" ? 2 : headId === "blaze_cap" ? 3 : headId === "beanie" ? 4 : headId === "hard_hat" ? 5 : 0 },
    uFresh: { value: app.condition.fresh ? 1 : 0 },
    uFace: { value: new THREE.Vector4(app.face.index, app.face.beard, app.face.lines, zombie ? 0.75 + (app.patternSeed % 1) * 0.25 : 1) },
    uCond: { value: new THREE.Vector4(app.condition.grime, app.condition.blood, app.condition.bloodAge, app.condition.tears) },
    uDecay: { value: app.condition.decay },
    uMarks: { value: new THREE.Vector4(app.marks.badge === "gold" ? 2 : app.marks.badge === "silver" ? 1 : 0, app.marks.backText === "police" ? DECAL.police : app.marks.backText === "sheriff" ? DECAL.sheriff : -1, app.marks.nameTape ? 1 : 0, app.marks.patch ? 1 : 0) },
    uExtras: { value: new THREE.Vector4(app.gear.includes("glasses") ? 1 : 0, app.gear.includes("watch") ? 1 : 0, app.gear.includes("gloves") ? 1 : 0, app.gear.includes("lanyard") ? 1 : 0) },
    uWoundA: { value: woundRest(app.condition.wounds[0], rest) },
    uWoundB: { value: woundRest(app.condition.wounds[1], rest) },
    uStraps: { value: strapMask(app.gear) },
    uSeed: { value: app.patternSeed },
    uHeadY: { value: HEAD_CENTRE.y },
    uDetail: { value: 1 },
  };
}

export type HumanoidUniforms = ReturnType<typeof humanoidUniforms>;

export function makeHumanoidMaterial(uniforms: HumanoidUniforms) {
  const mat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.85, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, { uFaceTex: { value: faceTexture() } });
    shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>\n${VERTEX_HEAD}`).replace("#include <begin_vertex>", VERTEX_BODY);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAGMENT_HEAD}`)
      .replace("#include <color_fragment>", FRAGMENT_BODY)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = hRough;")
      .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor = hMetal;")
      // Keep the HDR output finite and sane: one overflowing highlight would bloom into a black block.
      .replace("#include <opaque_fragment>", "#include <opaque_fragment>\ngl_FragColor.rgb = clamp(gl_FragColor.rgb, 0.0, 24.0);");
  };
  mat.customProgramCacheKey = () => "humanoid-v2";
  return mat;
}
