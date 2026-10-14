import { describe, expect, it } from "vitest";
import { ROLES, rollAppearance, type RoleId } from "../../sim/appearance";
import { BONES, PIECES, SHAPES, geometryFor, kit } from "./humanoidGeometry";
import { piecesFor } from "./humanoidLook";

describe("character kits", () => {
  it("every body kit is well formed: weights sum to 1, real bones, known zones, finite unit normals", () => {
    const zones = new Set([0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14]);
    for (const key of Object.keys(SHAPES)) {
      const k = kit(key);
      const { position, normal, skinIndex, skinWeight, zone } = k.attributes;
      for (let i = 0; i < position.count; i++) {
        const w = skinWeight.getX(i) + skinWeight.getY(i) + skinWeight.getZ(i) + skinWeight.getW(i);
        expect(Math.abs(w - 1), `${key} weight ${i}`).toBeLessThan(1e-5);
        for (const b of [skinIndex.getX(i), skinIndex.getY(i)]) expect(b).toBeLessThan(BONES.length);
        expect(zones.has(zone.getX(i)), `${key} zone ${zone.getX(i)}`).toBe(true);
        for (const v of [position.getX(i), position.getY(i), position.getZ(i)]) expect(Number.isFinite(v)).toBe(true);
      }
      // Every vertex a triangle uses has a usable normal (a zero normal is NaN on the GPU).
      const used = new Set(k.index);
      for (const i of used) {
        const len = Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i));
        expect(Math.abs(len - 1), `${key} normal ${i}`).toBeLessThan(1e-3);
      }
      for (const p of PIECES) expect(k.pieces[p][1], `${key} ${p}`).toBeGreaterThan(0);
    }
  });

  it("a character only draws what it wears, within budget, sharing its kit's buffers", () => {
    const roles = Object.keys(ROLES) as RoleId[];
    let worst = 0;
    for (const role of roles) {
      for (let i = 0; i < 300; i++) {
        const app = rollAppearance(i * 7919 + 5, role, { zombie: i % 2 === 0 });
        const key = `${app.sex}-${app.build}`;
        const geo = geometryFor(key, piecesFor(app));
        expect(geo.getAttribute("position")).toBe(kit(key).attributes.position);
        const verts = new Set(geo.getIndex()!.array).size;
        const tris = geo.getIndex()!.count / 3;
        worst = Math.max(worst, verts);
        // Open shells (hair, hoods, caps) carry an inside lining; the worst outfit (an officer
        // with a cap, long hair and the full duty belt) is 2,820 vertices and 4,604 triangles.
        expect(verts, role).toBeLessThanOrEqual(3000);
        expect(tris, role).toBeLessThanOrEqual(5000);
      }
    }
    expect(worst).toBeGreaterThan(1500);
  });
});
