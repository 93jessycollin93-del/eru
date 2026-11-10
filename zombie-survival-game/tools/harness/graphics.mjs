// Graphics harness (H19): fixed poses at fixed times of day. Saves screenshots and prints draw calls,
// triangles and frame time for each, so a rendering change can be compared before and after.
// Usage: node tools/harness/graphics.mjs <label> [pose,pose...|all] [low|medium|high]
// The label names the screenshots: out/gfx-<label>-<pose>.png
import { chromium } from "./pw.mjs";
const label = process.argv[2] ?? "now";
const only = process.argv[3] && process.argv[3] !== "all" ? process.argv[3].split(",") : undefined;
// Optional third argument: low, medium or high (default: whatever the game picks).
const quality = process.argv[4];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 300)));
await p.goto("http://127.0.0.1:8080");
await p.getByRole("button", { name: "Begin" }).waitFor({ timeout: 120000 });
await p.getByRole("button", { name: "Begin" }).click();
await p.waitForTimeout(800);

// name, player x/z, yaw, pitch, minutes
const POSES = [
  ["street-noon", 20, 6, 0.6, -0.05, 12 * 60],
  ["street-dusk", 20, 6, 0.6, -0.05, 19.6 * 60],
  ["street-night", 20, 6, 0.6, -0.05, 23 * 60],
  ["highway-morning", -150, 2, Math.PI / 2, 0.0, 8 * 60],
  ["forest-noon", -190, 120, 2.2, 0.02, 13 * 60],
  ["hill-view", 150, 150, -2.3, -0.12, 16 * 60],
  ["cars-noon", -60, 4, 1.2, -0.1, 12 * 60],
];
const out = {};
for (const [name, x, z, yaw, pitch, minutes] of POSES) {
  if (only && !only.includes(name)) continue;
  out[name] = await p.evaluate(([x, z, yaw, pitch, minutes, quality]) => {
    const g = window.__game;
    g.renderer.setAnimationLoop(null);
    if (quality && g.quality !== quality) g.setQuality(quality);
    g.locked = true;
    g.freeMouse = true;
    for (const zb of g.zombies) { zb.pos.set(290, 0, 290); zb.state = "idle"; zb.stateTimer = 999; }
    const P = g.player;
    const place = () => { P.pos.set(x, g.terrain.height(x, z), z); P.vel.set(0, 0, 0); P.yaw = yaw; P.pitch = pitch; g.minutes = minutes; };
    place();
    for (let i = 0; i < 45; i++) { g.update(1 / 30); g.input.endFrame(); place(); }
    const frame = () => (g.renderFrame ? g.renderFrame(1 / 60, g.env.daylight(g.minutes % 1440)) : g.post.render(1 / 60, 100));
    frame();
    const info = g.renderer.info;
    info.autoReset = false;
    info.reset();
    frame();
    const calls = info.render.calls;
    const tris = info.render.triangles;
    info.autoReset = true;
    // Software-rendered frame time: only meaningful relative to another run on this machine.
    const gl = g.renderer.getContext();
    const N = 3;
    const t0 = performance.now();
    const px = new Uint8Array(4);
    for (let i = 0; i < N; i++) {
      frame();
      // Reading a pixel back forces the frame to actually finish.
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    }
    const ms = (performance.now() - t0) / N;
    return { calls, tris, ms: +ms.toFixed(1), quality: g.quality };
  }, [x, z, yaw, pitch, minutes, quality]);
  await p.screenshot({ path: `tools/harness/out/gfx-${label}-${name}.png` });
}
out.errors = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
