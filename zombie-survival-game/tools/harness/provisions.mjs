// Browser harness for food, spoilage, cooking and the kitchen tap (H15).
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
  for (const z of g.zombies) {
    z.pos.set(290, 0, 290);
    z.state = "idle";
    z.awareness = 0;
    z.stateTimer = 999;
  }
  const r = {};
  // A fridge in a house: food found in it carries freshness, aged since the outbreak.
  const fridge = g.town.containers.find((c) => c.table === "fridge");
  fridge.items = [{ uid: 9001, id: "milk", count: 1 }, { uid: 9002, id: "raw_chicken", count: 1 }];
  g.ageFoundFood(fridge);
  r.foundFresh = fridge.items.map((s) => [s.id, +s.fresh.toFixed(2)]);

  // Cook on a camping stove: a timed job, gas burns, output appears.
  const mk = (id, count = 1, extra = {}) => ({ uid: 9100 + Math.floor(Math.random() * 1e6), id, count, ...extra });
  g.inventory.push(mk("raw_chicken", 1, { fresh: 0.95 }), mk("cooking_pot"), mk("camping_stove", 1, { charge: 0 }), mk("gas_canister", 2), mk("rag", 2), mk("empty_bottle", 2));
  const before = g.inventory.map((s) => s.id);
  g.craftRecipe("cook_chicken");
  r.actionLabel = g.action?.label;
  step(21);
  r.cooked = g.inventory.filter((s) => s.id === "cooked_chicken").map((s) => +s.fresh.toFixed(2));
  r.gasLeft = g.inventory.find((s) => s.id === "gas_canister")?.count;
  r.stoveCharge = g.inventory.find((s) => s.id === "camping_stove")?.charge;
  g.craftRecipe("rag_bandage");
  step(4);
  r.bandages = g.inventory.filter((s) => s.id === "bandage").reduce((n, s) => n + s.count, 0);

  // Kitchen tap fills empty bottles while the water runs.
  g.container = g.town.containers.find((c) => c.table === "kitchen");
  g.fillBottles();
  r.water = g.inventory.filter((s) => s.id === "water_bottle").length;
  g.container = null;
  // Drinking leaves the bottle.
  g.useItem(g.inventory.find((s) => s.id === "water_bottle").uid);
  r.emptyAfterDrink = g.inventory.filter((s) => s.id === "empty_bottle").reduce((n, s) => n + s.count, 0);

  // Carried chicken left out for ten hours goes off; eating it makes you sick sooner or later.
  g.inventory.push(mk("raw_chicken", 1, { fresh: 1 }));
  const raw = g.inventory[g.inventory.length - 1];
  g.ageFood(600);
  r.rawAfter10h = +raw.fresh.toFixed(2);
  return r;
});
console.log(JSON.stringify(out));
// Screenshot the inventory with the crafting panel.
await p.evaluate(() => {
  const g = window.__game;
  g.inventoryOpen = true;
  g.emitHud();
});
await p.waitForTimeout(500);
await p.screenshot({ path: "tools/harness/out/provisions-inventory.png" });
console.log("errors:", errs.length ? errs.slice(0, 5) : "none");
await b.close();
