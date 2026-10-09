# Session Handoff

**Read this first if you are a new Claude Code session picking up this project.**
Keep this file current: update it in the same commit as any meaningful change, so the project can move to a new session at any moment.

_Last updated: end of session 1 (2026-10-09)_

## The project

A browser-based, third-person 3D zombie survival game that blends **DayZ** (open world, scavenging, guns are loud), **Vein** (dense towns, every building enterable) and **Project Zomboid** (deep survival simulation, "this is how you died").

The owner plans about 20 sessions. The plan is in [ROADMAP.md](ROADMAP.md).

### Decisions already made (don't re-ask)
- **3D third-person** with Three.js (not isometric 2D).
- **Single-player first**; keep systems separable so multiplayer can come later (roadmap session 19).
- **Stack:** Vite, React, TypeScript, Tailwind, Three.js. This is Lovable's stack, so the owner can import the project into Lovable.dev via GitHub. There is no Lovable connector in Claude sessions, so build the code directly.
- **Must not be connected to Base44.** The code has no Base44 dependencies; keep it that way.
- **Visual direction:** muted, grim, desaturated (DayZ-like). HUD uses Barlow Condensed, titles use Big Shoulders Stencil Display, and the death screen uses Special Elite.

## Where the code lives

- Right now: the `zombie-survival-game/` folder of `93jessycollin93-del/eru`, on branch **`claude/zombie-survival-game-repo-v1v6hp`**.
  - Never merge it into `eru` main: that repo is synced to Base44.
- **Pending:** the owner will create a dedicated GitHub repo, `zombie-survival-game`. Claude can't create repos (the GitHub integration returns 403). Once it exists, move this folder's contents to that repo's root and update this file.
- **Playable build:** published as a private Claude artifact at https://claude.ai/artifact/Rb7QJzHErrwfXWtoFxTHtH
  - To update it from a new session: build with `npx vite build --base ./`, then publish with the Artifact tool, passing `url`.
  - The page is a small HTML file that references `./assets/*.js` and `./assets/*.css` from the build. Pass those files via `files`, and set the old asset paths to `null`.

## How to run and test

```sh
cd zombie-survival-game
npm install
npm run dev      # http://localhost:8080
npm run build    # typecheck + production build; must pass before every commit
```

In dev builds, `window.__game` exposes the `Game` instance.

**Headless testing:** Playwright with Chromium at `/opt/pw-browsers/chromium`. WebGL needs the args `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`.
- Software rendering runs at about 2 fps, so test logic by stepping the simulation: call `renderer.setAnimationLoop(null)`, then call `g.update(1/30)` in a loop.
- For screenshots, call `g.renderer.render(g.scene, g.camera)` after positioning the player.

**Gotchas:**
- Don't run `pkill -f vite`; it kills the calling shell. Run servers as background tasks instead.
- Before raycasting from the camera, call `camera.updateMatrixWorld()`.

## Code map

| File | What it does |
| ---- | ------------ |
| `src/game/Game.ts` | Main loop and orchestration: pointer lock, combat, looting, inventory, zombie management, HUD emission (10 Hz via `onHud`) |
| `src/game/entities/player.ts` | Movement, stamina, jump/gravity, survival stat drain, over-the-shoulder camera with collision |
| `src/game/entities/zombie.ts` | Zombie AI. States: idle, wander, investigate, chase, dead. Senses run every 0.25 s: sight cone + line of sight, footsteps, noise events |
| `src/game/entities/humanoid.ts` | Box-built character with pivoted limbs, procedural animation, held item meshes |
| `src/game/world/town.ts` | Procedural town: roads, buildings with interiors (wall openings for doors/windows), furniture, loot containers, cars, lamps, zombie spawn points |
| `src/game/world/colliders.ts` | AABB collision + raycast/LOS over an 8 m spatial grid |
| `src/game/world/terrain.ts` | Simplex heightmap. The town (radius 120) is flat at y = 0 |
| `src/game/world/vegetation.ts` | Instanced trees and bushes |
| `src/game/world/environment.ts` | Sun, hemisphere light, fog, day/night (`daylight()` 0..1) |
| `src/game/world/builder.ts` | Merges static geometry per material to keep draw calls low |
| `src/game/items.ts` | Item definitions + loot tables |
| `src/game/audio.ts` | All sounds synthesised with WebAudio (no audio files) |
| `src/game/input.ts` | Keyboard/mouse with per-frame "pressed" edges |
| `src/components/` | React HUD, Inventory (loot transfer), Overlay (menu, pause, death) |

**Key tuning constants:**
- `Game.ts`: `WORLD_SEED`, `TIME_SCALE` (1 game minute per real second), `MAX_WEIGHT` = 20 kg
- `player.ts`: speeds
- `zombie.ts`: attack range/windup
- The `zombieContext()` visibility formula in `Game.ts`

## Status

Session 1 is complete and pushed. Everything in ROADMAP "Session 1" works and was verified with headless tests:
- melee, pistol hits and headshots, reload
- zombie attacks, noise attraction, crouch stealth at night
- hunger and thirst drain
- lighting checked by screenshots

### Known issues / not yet done
- Frame rate has not been measured on a real GPU. There are about 670 draw calls; zombies are about 13 meshes each, which is the main cost. Shadows are skipped beyond 40 m and zombies are hidden beyond 115 m.
- Zombies have no pathfinding and can get stuck on walls (roadmap session 4).
- Doorways have no doors (session 3).
- No saving (session 5).
- No mobile/touch controls.
- When pointer lock is refused twice after clicks, the game falls back to free-mouse mode.

## Next session: start here

1. Check whether the owner has created the `zombie-survival-game` repo. If so, use `add_repo`, move the code there, and update this file.
2. Ask the owner if anything felt off when playing the artifact (performance, controls, difficulty).
3. Begin **roadmap session 2: characters and animation**. Use rigged glTF models (CC0, e.g. Quaternius), loaded with `GLTFLoader`, with an `AnimationMixer` per character. Keep the `Humanoid` interface (`root`, `hand`, `animate()`, `fall()`) so `Player` and `Zombie` barely change. Check that model hosts are reachable through the network proxy; if they're blocked, the owner may need to download the assets.
4. Before ending: run `npm run build`, commit, push, update the artifact, and update this file.
