// Browser harness for horde nights, heat and scouts (H17).
import { chromium } from "./pw.mjs";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 300)));
await p.goto("http://127.0.0.1:8080");
await p.getByRole("button", { name: "Begin" }).waitFor({ timeout: 120000 });
await p.getByRole("button", { name: "Begin" }).click();
await p.waitForTimeout(600);

const out = await p.evaluate(() => {
  const g = window.__game;
  g.renderer.setAnimationLoop(null);
  g.locked = true;
  g.freeMouse = true;
  const step = (sec, dt = 1 / 10) => {
    for (let t = 0; t < sec; t += dt) {
      g.update(dt);
      g.input.endFrame();
    }
  };
  const r = {};
  let lastHud = null;
  const origHud = g.onHud;
  g.onHud = (h) => { lastHud = h; origHud(h); };
  const hud = () => { g.emitHud(); return lastHud; };
  const msgs = () => g.messages.map((m) => m.text);
  // Keep the player alive and fed through a long night: this is about who comes, not survival.
  const keepAlive = () => {
    const bd = g.player.body;
    bd.health = 100; bd.blood = 100; bd.hunger = 100; bd.thirst = 100; bd.fatigue = 0; bd.wounds = [];
  };

  // Heat: a burst of gunfire in one spot draws scouts to it; quiet doesn't.
  const startAlive = g.zombies.filter((z) => z.alive).length;
  r.labelDay1 = hud().horde;
  const spot = g.player.pos.clone();
  for (let i = 0; i < 8; i++) g.noises.push({ pos: spot.clone(), radius: 60, ttl: 0.5 });
  step(0.2);
  r.heatAfterShots = hud().heat;
  step(6);
  r.scouts = g.zombies.filter((z) => z.alive).length - startAlive;
  r.scoutMsg = msgs().some((t) => t.includes("noise carried"));
  r.scoutsInvestigating = g.zombies.slice(-r.scouts).filter((z) => z.state === "investigate" || z.state === "chase").length;

  // Day 7: the warning in the morning, the horde at 22:00, dawn at 04:00.
  g.minutes = 6 * 1440 + 8 * 60;
  step(0.3);
  r.warned = msgs().some((t) => t.includes("Every seventh night"));
  r.labelDay7 = hud().horde;
  g.minutes = 6 * 1440 + 22 * 60 - 1;
  step(0.5);
  keepAlive();
  const before = g.zombies.filter((z) => z.alive).length;
  const d0 = (z) => z.pos.distanceTo(g.player.pos);
  step(4);
  r.hordeStarted = msgs().some((t) => t.includes("They're coming"));
  r.labelNight = hud().horde;
  const firstWave = [...g.hordeZombies];
  r.firstWave = firstWave.length;
  r.firstWaveDist = firstWave.map((z) => Math.round(d0(z)));
  // They head for you even if you never make a sound.
  for (let i = 0; i < 20; i++) { step(1); keepAlive(); }
  r.firstWaveDistAfter20s = firstWave.filter((z) => z.alive).map((z) => Math.round(d0(z)));
  for (let i = 0; i < 60; i++) { step(1); keepAlive(); }
  r.hordeSpawnedAfter80s = g.horde.spawned;
  r.hordeTotalPlanned = 12 + 3 * (6 + Math.floor(g.kills / 20));
  r.aliveCap = g.zombies.filter((z) => z.alive).length <= 170;
  g.minutes = 7 * 1440 + 4 * 60 - 1;
  step(1.5);
  r.dawn = msgs().some((t) => t.includes("Dawn"));
  r.hordeAfterDawn = g.horde;
  r.labelDay8 = hud().horde;

  // Saves carry heat and the horde record; an old save with neither still loads.
  const s = g.toSave();
  r.saveHasHorde = "horde" in s && "heat" in s;
  return r;
});
out.errors = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
