// Draw calls at a fixed pose and AI update cost, run against a given port (old vs new build).
import { chromium } from "./pw.mjs";
const port = process.argv[2] ?? "8080";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(`http://127.0.0.1:${port}`);
await p.getByRole("button", { name: "Begin" }).waitFor({ timeout: 120000 });
await p.getByRole("button", { name: "Begin" }).click();
await p.waitForTimeout(500);
const r = await p.evaluate(() => {
  const g = window.__game;
  g.renderer.setAnimationLoop(null);
  g.locked = true;
  const out = {};
  const P = g.player;
  // Fixed pose: Main Street in town, looking along the houses.
  const pose = () => {
    P.pos.set(20, 0, 6);
    P.yaw = 0.6;
    P.pitch = -0.05;
    g.minutes = 12 * 60;
    for (let i = 0; i < 40; i++) {
      g.update(1 / 30);
      g.input.endFrame();
      P.pos.set(20, 0, 6);
    }
  };
  for (const z of g.zombies) z.pos.set(290, 0, 290);
  pose();
  const calls = () => {
    const info = g.renderer.info;
    info.autoReset = false;
    info.reset();
    g.renderer.render(g.scene, g.camera);
    const c = info.render.calls;
    const tris = info.render.triangles;
    info.autoReset = true;
    return [c, tris];
  };
  calls();
  [out.calls, out.tris] = calls();
  if (g.barriers) {
    g.barriers.group.visible = false;
    [out.callsWithoutBarriers] = calls();
    g.barriers.group.visible = true;
  }
  // AI cost: restart with the normal zombie population and bring them all near the player.
  g.start();
  g.locked = true;
  g.renderer.setAnimationLoop(null);
  P.pos.set(20, 0, 6);
  out.zombies = g.zombies.length;
  for (let i = 0; i < 60; i++) { g.update(1 / 30); g.input.endFrame(); }
  const N = 600;
  const t0 = performance.now();
  for (let i = 0; i < N; i++) {
    g.update(1 / 30);
    g.input.endFrame();
    P.body.health = 100;
    if (g.status !== "playing") g.status = "playing";
  }
  out.updateMs = +((performance.now() - t0) / N).toFixed(3);
  out.active = g.zombies.filter((z) => z.pos.distanceTo(P.pos) < 140).length;
  return out;
});
console.log(port, JSON.stringify(r));
await b.close();
