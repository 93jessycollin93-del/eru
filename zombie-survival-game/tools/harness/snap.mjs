// Snapshot of everything the town random stream decides, for the determinism check.
import { chromium } from "./pw.mjs";
const port = process.argv[2] ?? "8080";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 640, height: 360 } });
const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
await p.goto(`http://127.0.0.1:${port}`);
await p.getByRole("button", { name: "Begin" }).waitFor({ timeout: 120000 });
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
console.log(JSON.stringify({ snap, errs }));
await b.close();
