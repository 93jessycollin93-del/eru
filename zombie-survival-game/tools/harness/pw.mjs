// Playwright from the project (npm i --no-save playwright) or the container's global install.
const mod = await import("playwright").catch(() => import("/opt/node22/lib/node_modules/playwright/index.mjs"));
const raw = mod.chromium ?? mod.default.chromium;
const ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
/** Chromium with software WebGL (the container's browser lives in /opt/pw-browsers). */
export const chromium = {
  launch: (opts = {}) => raw.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ARGS, ...opts }),
};
