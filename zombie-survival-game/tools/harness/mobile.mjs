// Device harness (H16): phones in landscape (touch controls) and a desktop (keyboard), in Chromium's device emulation.
import { chromium } from "./pw.mjs";
const mod = await import("playwright").catch(() => import("/opt/node22/lib/node_modules/playwright/index.mjs"));
const devices = mod.devices ?? mod.default.devices;
const only = process.argv[2];
const DEVICES = [
  ["iphone", devices["iPhone 14 landscape"]],
  ["android", devices["Pixel 7 landscape"]],
  ["windows", { viewport: { width: 1366, height: 768 }, userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36", hasTouch: false, isMobile: false }],
].filter(([n]) => !only || n === only);
const b = await chromium.launch();
const results = {};
for (const [name, dev] of DEVICES) {
  const { defaultBrowserType, ...opts } = dev;
  const ctx = await b.newContext(opts);
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 200)));
  await p.goto("http://127.0.0.1:8080");
  const begin = p.getByRole("button", { name: "Begin" });
  await begin.waitFor({ timeout: 180000 });
  const r = { titleShot: `out/device-${name}-title.png` };
  await p.screenshot({ path: `tools/harness/${r.titleShot}` });
  if (opts.hasTouch) await begin.tap();
  else await begin.click();
  await p.waitForFunction(() => window.__game?.status === "playing", null, { timeout: 120000 });
  await p.evaluate(() => {
    const g = window.__game;
    g.renderer.setAnimationLoop(null);
    for (const z of g.zombies) {
      z.pos.set(290, 0, 290);
      z.state = "idle";
      z.awareness = 0;
      z.stateTimer = 999;
    }
    window.__step = (sec) => {
      for (let t = 0; t < sec; t += 1 / 15) {
        g.update(1 / 15);
        g.input.endFrame();
      }
    };
    g.emitHud();
  });
  await p.waitForTimeout(400);
  const state = () => p.evaluate(() => { const g = window.__game; return { x: g.player.pos.x, z: g.player.pos.z, yaw: g.player.yaw, locked: g.locked, touch: g.touch, inv: g.inventoryOpen, quality: g.quality }; });
  const s0 = await state();
  r.touch = s0.touch;
  r.locked = s0.locked;
  r.quality = s0.quality;
  if (opts.hasTouch) {
    const cdp = await ctx.newCDPSession(p);
    const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts });
    const stick = await p.getByLabel("Move").boundingBox();
    const sx = stick.x + stick.width / 2;
    const sy = stick.y + stick.height / 2;
    await touch("touchStart", [{ x: sx, y: sy, id: 1 }]);
    await touch("touchMove", [{ x: sx, y: sy - 50, id: 1 }]);
    await p.evaluate(() => window.__step(2));
    await touch("touchEnd", []);
    const s1 = await state();
    r.moved = +Math.hypot(s1.x - s0.x, s1.z - s0.z).toFixed(2);
    const vw = opts.viewport.width;
    const vh = opts.viewport.height;
    await touch("touchStart", [{ x: vw * 0.5, y: vh * 0.4, id: 2 }]);
    for (let i = 1; i <= 5; i++) await touch("touchMove", [{ x: vw * 0.5 + i * 20, y: vh * 0.4, id: 2 }]);
    await p.evaluate(() => window.__step(0.2));
    await touch("touchEnd", []);
    const s2 = await state();
    r.turned = +(s2.yaw - s1.yaw).toFixed(3);
    r.controlsShot = `out/device-${name}-play.png`;
    await p.evaluate(() => window.__game.renderer.render(window.__game.scene, window.__game.camera));
    await p.screenshot({ path: `tools/harness/${r.controlsShot}` });
    await p.getByLabel("Bag").tap();
    await p.evaluate(() => window.__step(0.2));
    r.bagOpens = (await state()).inv;
  } else {
    await p.keyboard.down("KeyW");
    await p.evaluate(() => window.__step(2));
    await p.keyboard.up("KeyW");
    const s1 = await state();
    r.moved = +Math.hypot(s1.x - s0.x, s1.z - s0.z).toFixed(2);
    r.touchControlsShown = (await p.getByLabel("Move").count()) > 0;
  }
  r.errors = errs.slice(0, 3);
  results[name] = r;
  await ctx.close();
}
console.log(JSON.stringify(results, null, 1));
await b.close();
