// Snapshot of everything the town random stream decides, for the determinism check.
import { chromium } from "./pw.mjs";
const port = process.argv[2] ?? "8080";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 640, height: 360 } });
const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
await p.goto(`http://127.0.0.1:${port}`);
await p.getByRole("button", { name: /Begin|New game/ }).waitFor({ timeout: 120000 });
const snap = await p.evaluate(() => {
  const g = window.__game;
  g.renderer.setAnimationLoop(null);
  const r = (v) => Math.round(v * 1000) / 1000;
  return {
    buildings: g.town.buildings.map((b) => [b.address, b.type, r(b.rect.minX), r(b.rect.minZ), r(b.rect.maxX), r(b.rect.maxZ)]),
    computers: g.town.computers.map((c) => [c.state.def.hostname, c.state.def.users.map((u) => `${u.name}:${u.password}`).join(","), r(c.x), r(c.z)]),
    containers: g.town.containers.map((c) => [c.name, c.table, r(c.x), r(c.z)]),
    spawn: [r(g.town.playerSpawn.x), r(g.town.playerSpawn.z)],
    spawnPoints: g.town.spawnPoints.map((s) => [r(s.x), r(s.z)]),
    facts: g.town.facts,
    hosts: g.town.buildings.filter((b) => b.network).map((b) => b.network.hosts.map((h) => `${h.ip} ${h.hostname} ${(h.def?.users ?? []).map((u) => u.password).join(",")}`)),
  };
});
// H14: start a game; every zombie's seed, place and gameplay traits, and the game rng position, must not change.
await p.getByRole("button", { name: /Begin|New game/ }).click();
await p.waitForTimeout(300);
snap.zombies = await p.evaluate(() => {
  const g = window.__game;
  g.renderer.setAnimationLoop(null);
  const r = (v) => Math.round(v * 1e6) / 1e6;
  return { rng: g.rng.state(), list: g.zombies.map((z) => [z.seed, r(z.pos.x), r(z.pos.z), z.runner, r(z.walkSpeed), r(z.chaseSpeed), r(z.model.root.scale.y)]) };
});
console.log(JSON.stringify({ snap, errs }));
await b.close();
