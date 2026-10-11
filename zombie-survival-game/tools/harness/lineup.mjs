// H13: character lineup. Builds a row of people of every role (seeds found by
// predicate, so the lineup is deterministic), renders front, back, faces and
// portraits, and checks draw calls per character. Screenshots go to tools/harness/out/.
// Options: SHOTS=full,faces1 (a subset), RAW=1 (no post-processing), LOWQ=1 (low quality).
import { mkdirSync } from "node:fs";
import { chromium } from "./pw.mjs";

const port = process.argv[2] ?? "8080";
const outDir = new URL("./out/", import.meta.url);
mkdirSync(outDir, { recursive: true });
const b = await chromium.launch();
const W = 960;
const Hh = 540;
const p = await b.newPage({ viewport: { width: W, height: Hh } });
const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 600)));
await p.goto(`http://127.0.0.1:${port}`);
await p.getByRole("button", { name: /Begin|New game/ }).waitFor({ timeout: 120000 });
await p.getByRole("button", { name: /Begin|New game/ }).click();
await p.waitForTimeout(500);

const res = await p.evaluate(async () => {
  const g = window.__game;
  const A = await import("/src/sim/appearance.ts");
  g.renderer.setAnimationLoop(null);
  g.locked = true;
  g.minutes = 12 * 60 + 30;
  const P = g.player;
  // A flat, clear stretch of street: nothing solid in the row or between it and the camera.
  const clear = (x, z) =>
    !g.colliders.boxes.some((c) => c.enabled !== false && c.maxY > 0.2 && c.minY < 2.2 && c.maxX > x - 8 && c.minX < x + 8 && c.maxZ > z - 1.5 && c.minZ < z + 10.5);
  let base = null;
  for (let r = 0; r < 110 && !base; r += 3) {
    for (let a = 0; a < 24 && !base; a++) {
      const x = Math.round(Math.cos((a / 24) * Math.PI * 2) * r);
      const z = Math.round(Math.sin((a / 24) * Math.PI * 2) * r);
      if (Math.abs(g.terrain.height(x, z)) < 0.01 && Math.abs(g.terrain.height(x + 8, z + 10)) < 0.01 && clear(x, z)) base = new P.pos.constructor(x, 0, z);
    }
  }
  base ??= g.town.playerSpawn.clone();
  P.pos.copy(base).add(new P.pos.constructor(0, 0, -6));
  for (const z of g.zombies) z.pos.set(290, 0, 290);
  for (let i = 0; i < 3; i++) {
    g.update(1 / 30);
    g.input.endFrame();
  }
  for (const z of g.zombies) z.model.root.visible = false;
  P.model.root.visible = false;

  const Z = g.zombies[0].constructor;
  const H = P.model.constructor;
  const T = await import("/src/sim/zombies.ts");
  const find = (role, pred, zombie = true) => {
    for (let s = 1; s < 6000; s++) if (pred(A.rollAppearance(s, role, { zombie, fresh: zombie && T.rollZombieTraits(s).runner }), s)) return s;
    return 1;
  };
  const runner = (s) => T.rollZombieTraits(s).runner;
  const cast = [
    ["police", (a) => a.outer?.id === "police_vest" && a.head?.id === "police_cap" && a.marks.backText === "police"],
    ["police", (a) => !a.outer && a.gear.includes("radio")],
    ["police", (a) => a.marks.backText === "sheriff"],
    ["store_clerk", (a) => a.outer?.id === "apron"],
    ["hardware_worker", (a) => a.outer?.id === "hi_vis_vest" && a.gear.includes("tool_belt")],
    ["hiker", (a) => a.gear.includes("hikepack") && a.head?.id === "beanie"],
    ["hunter", (a) => a.outer?.id === "blaze_vest" && a.head?.id === "blaze_cap"],
    ["sleepwear", (a) => a.feet.id === "barefoot" && a.top.pattern !== "plain"],
    ["office", (a) => a.gear.includes("lanyard") && a.gear.includes("glasses")],
    ["jogger", (a) => a.bottom.id === "shorts" && a.sex === "f" && a.hair.style === "ponytail"],
    ["tradesman", (a) => a.head?.id === "hard_hat" && a.outer?.id === "hi_vis_vest"],
    ["civilian", (a, s) => runner(s) && a.outer?.id === "puffer"],
    ["civilian", (a) => a.head?.id === "hood_up"],
    ["civilian", (a) => a.outer?.open && a.top.pattern === "plaid" && a.gear.includes("daypack")],
  ];
  const people = [];
  const spacing = 0.95;
  cast.forEach(([role, pred], i) => {
    const seed = find(role, pred);
    const x = base.x + (i - (cast.length - 1) / 2) * spacing;
    const pos = new P.pos.constructor(x, g.terrain.height(x, base.z), base.z);
    const z = new Z(pos, seed, role);
    z.model.root.rotation.y = 0;
    g.scene.add(z.model.root);
    people.push({ m: z.model, role, seed, zombie: true });
  });
  // The living: the player and a townsperson, beside their dead counterparts.
  for (const [k, app] of [
    [0, structuredClone(A.PLAYER_APPEARANCE)],
    [1, A.rollAppearance(find("civilian", (a) => a.outer?.id === "puffer", false), "civilian", { zombie: false })],
  ]) {
    const m = new H(app, { zombie: false });
    if (k === 0) m.setGear(A.playerGear([{ id: "pistol", count: 1 }, { id: "baseball_bat", count: 1 }, { id: "kitchen_knife", count: 1 }, { id: "water_bottle", count: 1 }], null, 4));
    const x = base.x + ((cast.length + 1) / 2 + k) * spacing;
    m.root.position.set(x, g.terrain.height(x, base.z), base.z);
    g.scene.add(m.root);
    people.push({ m, role: app.role, seed: 0, zombie: false });
  }
  for (let i = 0; i < 40; i++) for (const { m, zombie } of people) m.animate(1 / 30, 0, { zombie });

  const cam = g.camera;
  const V = (x, y, z) => new P.pos.constructor(x, y, z);
  const y0 = g.terrain.height(base.x, base.z);
  const centre = base.x + 1.0 * spacing;
  // Shots are taken by page screenshots (a canvas readback straight after rendering can come back half drawn).
  window.__shot = (name) => {
    const s = window.__shots[name];
    for (const { m } of people) m.root.rotation.y = s.back ? Math.PI : 0;
    cam.fov = s.fov;
    cam.aspect = window.innerWidth / window.innerHeight;
    cam.updateProjectionMatrix();
    cam.position.copy(s.pos);
    cam.lookAt(s.look);
    cam.updateMatrixWorld();
    if (window.__raw) g.renderer.render(g.scene, cam);
    else {
      g.post.render(1 / 30, 100);
      g.post.render(1 / 30, 100);
    }
  };
  const X = (i) => base.x + (i - (cast.length - 1) / 2) * spacing;
  const near = (x) => ({ pos: V(x, y0 + 1.25, base.z + 3.6), look: V(x, y0 + 0.95, base.z), fov: 40 });
  const face = (x) => ({ pos: V(x, y0 + 1.6, base.z + 2.3), look: V(x, y0 + 1.55, base.z), fov: 30 });
  window.__shots = {
    full: { pos: V(centre, y0 + 1.2, base.z + 11.5), look: V(centre, y0 + 0.92, base.z), fov: 40 },
    left: near((X(0) + X(3)) / 2),
    mid: near((X(4) + X(7)) / 2),
    right: near((X(8) + X(11)) / 2),
    far: near((X(12) + X(15)) / 2),
    back: { pos: V(centre, y0 + 1.3, base.z + 11), look: V(centre, y0 + 1.0, base.z), fov: 42, back: true },
    faces1: face((X(0) + X(1)) / 2),
    faces2: face((X(2) + X(3)) / 2),
    faces3: face((X(6) + X(7)) / 2),
    faces4: face((X(12) + X(13)) / 2),
    faces5: face((X(14) + X(15)) / 2),
    portrait1: { pos: V(X(14), y0 + 1.66, base.z + 0.75), look: V(X(14), y0 + 1.62, base.z), fov: 30 },
    portrait2: { pos: V(X(1), y0 + 1.6, base.z + 0.75), look: V(X(1), y0 + 1.5, base.z), fov: 34 },
    portrait3: { pos: V(X(15), y0 + 1.62, base.z + 0.75), look: V(X(15), y0 + 1.58, base.z), fov: 30 },
  };

  // Draw calls: with and without the lineup.
  const calls = () => {
    const info = g.renderer.info;
    info.autoReset = false;
    info.reset();
    g.renderer.render(g.scene, cam);
    const c = info.render.calls;
    info.autoReset = true;
    return c;
  };
  cam.position.copy(V(centre, y0 + 1.1, base.z + 9));
  cam.lookAt(V(centre, y0 + 0.95, base.z));
  cam.updateMatrixWorld();
  const withPeople = calls();
  for (const { m } of people) m.root.visible = false;
  const without = calls();
  for (const { m } of people) m.root.visible = true;
  // Hide the HUD and menus so only the 3D view is in the screenshots.
  const canvas = g.renderer.domElement;
  for (const el of document.body.querySelectorAll("*")) if (el !== canvas && !el.contains(canvas)) el.style.visibility = "hidden";

  return {
    spot: [base.x, base.z],
    cast: people.map(({ role, seed, m }) => ({ role, seed, fresh: m.appearance.condition.fresh, look: `${m.appearance.top.id}/${m.appearance.outer?.id ?? "-"}/${m.appearance.bottom.id}/${m.appearance.feet.id} ${m.appearance.gear.join(",")}` })),
    calls: { withPeople, without, perCharacter: (withPeople - without) / people.length },
    programs: g.renderer.info.programs?.length,
  };
});

if (process.env.RAW) await p.evaluate(() => (window.__raw = true));
if (process.env.LOWQ) await p.evaluate(() => window.__game.post.setQuality("low"));
for (const name of (process.env.SHOTS ?? "full,left,mid,right,far,back,faces1,faces2,faces3,faces4,faces5").split(",")) {
  await p.evaluate((n) => window.__shot(n), name);
  await p.screenshot({ path: new URL(`lineup-${name}.png`, outDir).pathname });
}
console.log("H13", JSON.stringify(res, null, 1));
console.log("errors:", errs.length ? errs.slice(0, 4) : "none");
await b.close();
