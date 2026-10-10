// H11: change many things, save to a slot, reload the page, load, and compare the whole world.
import { chromium } from "./pw.mjs";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 300)));

const boot = async () => {
  await p.goto("http://127.0.0.1:8080");
  await p.getByRole("button", { name: /Begin|New game/ }).waitFor({ timeout: 120000 });
};

/** Installs window.__fingerprint: everything that should survive a save, in comparable form. */
const INSTALL_FINGERPRINT = () => {
  window.__fingerprint = () => {
  const g = window.__game;
  const r = (v) => Math.round(v * 1000) / 1000;
  const P = g.player;
  const pc = g.town.buildings.find((b) => b.type === "police").computer;
  return {
    minutes: r(g.minutes),
    rng: g.rng.state(),
    player: [r(P.pos.x), r(P.pos.y), r(P.pos.z), r(P.yaw), P.crouching],
    body: [r(P.body.blood), r(P.body.health), r(P.body.hunger), P.body.wounds.length, P.body.infection.infected],
    inventory: g.inventory.map((s) => `${s.id}x${s.count}${s.fuel !== undefined ? `@${s.fuel}` : ""}`).sort(),
    equipped: g.equippedStack()?.id ?? null,
    kills: g.kills,
    zombies: g.zombies.map((z) => `${z.seed}:${z.state}:${r(z.pos.x)},${r(z.pos.z)}:${r(z.hp)}:${z.breach}`).sort(),
    barriers: JSON.stringify(g.barriers.world),
    colliders: g.barriers.slots.map((s) => (g.colliders.boxes[s.collider].enabled !== false ? 1 : 0) + (s.box.occludes ? 2 : 0)).join(""),
    nav: Array.from(g.nav.cost).reduce((h, v, i) => (h * 31 + v * (i + 1)) % 1000000007, 7),
    containers: JSON.stringify(g.town.containers.filter((c) => c.items !== null).map((c) => [c.id, c.table, (c.items ?? []).map((s) => `${s.id}x${s.count}`)])),
    cars: g.town.containers.filter((c) => c.table === "car").map((c) => c.fuel),
    groundMeshes: g.groundPiles.size,
    computer: [pc.state.phase, pc.state.user, pc.state.cwd, pc.state.screen.slice(-3).join("|")],
    power: JSON.stringify(g.elec.world),
    generators: g.elec.generators.map((o) => `${o.gen.id}:${r(o.x)},${r(o.z)}:${!!o.mesh}`).sort(),
  };
  };
};

// The fingerprint lives in the page (survives reloads as an init script).
await p.addInitScript(INSTALL_FINGERPRINT);
await boot();
await p.getByRole("button", { name: /Begin|New game/ }).click();
await p.waitForTimeout(600);
const before = await p.evaluate(async () => {
  const g = window.__game;
  g.renderer.setAnimationLoop(null);
  g.locked = true;
  const step = (sec) => {
    for (let t = 0; t < sec; t += 1 / 30) {
      g.update(1 / 30);
      g.input.endFrame();
    }
  };
  const P = g.player;
  // Play a while, then change all sorts of things.
  step(3);
  g.minutes += 600;
  const house = g.town.buildings.find((b) => b.type === "house" && b.containers.length > 1);
  const c = house.containers[0];
  P.pos.set(c.x + 0.8, 0, c.z);
  g.openContainer(c);
  if (c.items.length) g.takeFromContainer(c.items[0].uid);
  g.closeUi(false);
  g.addToInventory({ uid: 7001, id: "hammer", count: 1 });
  g.addToInventory({ uid: 7002, id: "plank", count: 3 });
  g.addToInventory({ uid: 7003, id: "nails", count: 12 });
  g.addToInventory({ uid: 7004, id: "jerry_can", count: 1, fuel: 7.5 });
  const kn = g.inventory.find((s) => s.id === "water_bottle");
  if (kn) g.dropItem(kn.uid);
  const door = g.barriers.specs.find((s) => s.role === "house-front" && s.building === house.address) ?? g.barriers.specs.find((s) => s.role === "house-front");
  g.barriers.close(door.id);
  g.barriers.board(door.id, -1);
  g.barriers.board(door.id, -1);
  const win = g.barriers.specs.find((s) => s.kind === "window" && g.barriers.world.barriers[s.id].glass === "intact" && s.id > 40);
  g.barriers.breakGlass(win.id);
  // Siphon a car, place a portable generator.
  const car = g.town.containers.find((x) => x.table === "car" && (x.fuel ?? 0) > 2);
  if (car) car.fuel = Math.round((car.fuel - 2) * 10) / 10;
  g.elec.placePortable(new P.pos.constructor(house.rect.maxX + 2, 0, house.rect.minZ), 3000, 10, 4.2, 30);
  // A terminal session at the police station.
  const pc = g.town.buildings.find((b) => b.type === "police").computer;
  P.pos.set(pc.x, 0, pc.z + 0.5);
  g.useComputer(pc);
  g.computerSubmit(pc.state.def.users[0].name);
  g.computerSubmit(pc.state.def.users[0].password);
  g.computerSubmit("cd reports");
  g.computerSubmit("ls");
  g.closeUi(false);
  // A wound, a kill, zombies on the move.
  P.body.blood -= 400;
  g.zombies[3].hp = 0;
  g.zombies[3].state = "dead";
  g.zombies[5].pos.set(P.pos.x + 6, 0, P.pos.z);
  g.zombies[5].state = "investigate";
  step(1);
  P.crouching = true;
  await g.saveGame("1");
  return { fp: window.__fingerprint(), saves: (await g.saves.list()).map((s) => s.slot) };
});

// Reload the page: everything in memory is gone; only the save remains.
await boot();
const listed = await p.evaluate(() => window.__game.saveList.map((s) => s.slot));
const continueShown = await p.getByRole("button", { name: "Continue" }).isVisible();
const after = await p.evaluate(async () => {
  const g = window.__game;
  g.renderer.setAnimationLoop(null);
  await g.loadGame("1");
  g.locked = true;
  return window.__fingerprint();
});

const diffs = Object.keys(before.fp).filter((k) => JSON.stringify(before.fp[k]) !== JSON.stringify(after[k]));
console.log("H11", JSON.stringify({ savedSlots: before.saves, listedAfterReload: listed, continueShown, diffs, sample: diffs.map((k) => ({ k, before: before.fp[k], after: after[k] })).slice(0, 4) }));

// Damaged and foreign saves are refused with a message, not a crash.
const refused = await p.evaluate(async () => {
  const g = window.__game;
  await g.saves.write({ slot: "3", meta: { version: 1, worldSeed: 1987, savedAt: new Date().toISOString(), day: 1, timeOfDay: 0, location: null, survivedMinutes: 0, kills: 0, health: 100 }, data: "{broken" });
  await g.loadGame("3");
  const m1 = g.messages.at(-1)?.text;
  await g.deleteSave("3");
  return { damaged: m1, statusAfter: g.status };
});
console.log("H11b", JSON.stringify(refused));
console.log("errors:", errs.length ? errs.slice(0, 6) : "none");
await b.close();
