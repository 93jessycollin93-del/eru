# Session Handoff

**Read this first if you are a new Claude Code session picking up this project.**
Keep this file current: update it in the same commit as any meaningful change, so the project can move to a new session at any moment.

_Last updated: session 8 — saving, plus review fixes for doors and access control (2026-10-11)_

## The project

A browser-based, third-person 3D zombie survival game that blends **DayZ** (open world, scavenging, guns are loud), **Vein** (dense towns, every building enterable) and **Project Zomboid** (deep survival simulation, "this is how you died").

The owner plans about 20 sessions. The plan is in [ROADMAP.md](ROADMAP.md).

**North star (owner's words):** "the best realistic survival game ever created"; "the physical and CYBERNETIC world in this game should be more realistic than any other game ever created. Using the best of the best."
**Read [DESIGN.md](DESIGN.md)**: it holds the realism rules and the system-by-system plan for both worlds.

### Decisions already made (don't re-ask)
- **Browser now, port to Unreal Engine 5 later.** All simulation rules go in `src/sim/` as engine-agnostic TypeScript (no `three`, React or DOM imports; injected RNG; serialisable state). Rendering, input and UI are a thin client. See the top of ROADMAP.md.
- **3D third-person** with Three.js (not isometric 2D).
- **Single-player first**; keep systems separable so multiplayer can come later (roadmap session 19).
- **Stack:** Vite, React, TypeScript, Tailwind, Three.js. This is Lovable's stack, so the owner can import the project into Lovable.dev via GitHub. There is no Lovable connector in Claude sessions, so build the code directly.
- **Must not be connected to Base44.** The code has no Base44 dependencies; keep it that way.
- **Graphics should resemble Escape from Tarkov** (owner request, session 3): gritty photoreal, overcast, desaturated, dirty materials, ambient occlusion, film grain. The browser gets as close as it can; full fidelity comes with the Unreal port.
- **In-game computers must be realistic and runnable** (owner request, session 3): physical computers in the world that you boot, log into (passwords found as notes in the world), and use through a working Unix-like shell with a virtual filesystem, mail and programs. They need power (the grid fails on a set day; laptops run on battery). The shell and filesystem logic live in `src/sim/computer.ts` (portable).
- **Visual direction (UI):** muted, grim, desaturated (DayZ-like). HUD uses Barlow Condensed, titles use Big Shoulders Stencil Display, and the death screen uses Special Elite.

## Where the code lives

- Right now: the `zombie-survival-game/` folder of `93jessycollin93-del/eru`, on branch **`claude/zombie-survival-game-repo-v1v6hp`**.
  - Never merge it into `eru` main: that repo is synced to Base44.
- **Pending:** the owner will create a dedicated GitHub repo, `zombie-survival-game`. Claude can't create repos (the GitHub integration returns 403). Once it exists, move this folder's contents to that repo's root and update this file.
  - The owner's target GitHub account is **`yyb84ycgt6-oss`**. As of the end of session 1, Claude had no access to it: Claude's GitHub connection only covers `93jessycollin93-del`. The owner needs to install the Claude GitHub App on `yyb84ycgt6-oss` (via https://claude.ai/connect-github), create the repo, then start a session with that repo selected or attach it with `add_repo`.
- **Playable build:** published as a private Claude artifact at https://claude.ai/artifact/Rb7QJzHErrwfXWtoFxTHtH
  - To update it from a new session: build with `npx vite build --base ./`, then publish with the Artifact tool, passing `url`.
  - The page is a small HTML file that references `./assets/*.js` and `./assets/*.css` from the build. Pass those files via `files`, and set the old asset paths to `null`.

## How to run and test

```sh
cd zombie-survival-game
npm install
npm run dev      # http://localhost:8080
npm run build    # typecheck + production build; must pass before every commit
npm test         # Vitest tests for src/sim; must pass before every commit
```

In dev builds, `window.__game` exposes the `Game` instance.

**Headless testing:** Playwright with Chromium at `/opt/pw-browsers/chromium`. WebGL needs the args `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`.
- Software rendering runs at about 2 fps, so test logic by stepping the simulation: call `renderer.setAnimationLoop(null)`, then call `g.update(1/30)` in a loop.
- For screenshots, call `g.renderer.render(g.scene, g.camera)` after positioning the player.

**Committed harness:** `tools/harness/` (see its README): `doors.mjs` runs the door/window/barricade/police scenarios H0–H12 (H9 loot through walls, H10 hiding behind a glass door, H12 aiming at windows over counters), `save.mjs` runs H11 (change everything → save → reload the page → load → compare a whole-world fingerprint) and H11b (a damaged save is refused with a message), `perf.mjs` measures draw calls and AI cost, `snap.mjs` snapshots everything the town random stream decides (diff it against an older commit's build to prove determinism). Copy their pattern for new systems.

**Gotchas:**
- Don't run `pkill -f vite`; it kills the calling shell. Run servers as background tasks instead.
- Before raycasting from the camera, call `camera.updateMatrixWorld()`.

## Code map

| File | What it does |
| ---- | ------------ |
| `src/sim/body.ts` | **Engine-agnostic** body simulation: blood (ml), tissue health, wounds per body part with bleed rates and healing, Knox infection (hidden incubation then symptoms, bites always infect, death then reanimation), body temperature, fatigue/sleep, pain, panic, moodles, plus derived modifiers (`mobility`, `aimSway`, `strength`, `maxStamina`). Bleeding/stamina/panic run in real seconds; everything else runs in game minutes |
| `src/sim/computer.ts` | **Engine-agnostic** virtual filesystem + Unix-like shell. Login with lockout, permissions, `ls cd cat head tail grep wc find mail history` + pipes, tab completion, data-driven programs |
| `src/sim/computerContent.ts` | Generates police / store / hardware / house-laptop machines from `TownFacts` (police address, supply-cache address, power-off day). Writes lore, mail, incident reports, and the password note for that building. `gameDate(day, minute)`: day 1 = Fri Oct 23 |
| `src/sim/network.ts` | **Engine-agnostic** LAN model: `NetworkSpec` (cidr, gateway, hosts with services/MAC/vendor, `upsMinutes`), `NetworkView` (selfIp + `isUp(ip)` supplied by the game) |
| `src/sim/tuning.ts` | **Every gameplay number** (movement, footsteps, stamina, zombie speeds, senses, melee, firearms) plus pure formulas (`sightRate`, `visibilityRange`, `meleeDamage`, `shotSpread`). Design targets are enforced in `tuning.test.ts`. **Change numbers here, never inline.** |
| `src/sim/nav.ts` | Nav grid (0.25 m cells; cell-centre rasterisation keeps 1 m doorways open) + A* with typed-array workspaces (~1 ms per search) + string-pulling. **Cost layer:** `NavGrid.cost` (extra cells per crossing), `cellsInBox` (half-open, one row for a one-cell strip), `setCellCost`; string-pulling (`pullLineClear`) never cuts through a costed cell the route didn't use. Costs make A* expand a lot when the goal is inside a closed building, so `Game` routes "into a building" with `siegePath` first |
| `src/sim/barriers.ts` | **Engine-agnostic doors/windows/barricades.** `Barrier` state (open, latch, bolted, electronic lock, glass, damage, broken, boards + side). Layered `hitBarrier` (near boards → core → far boards), `coreStrength` (min of leaf and hold), `zombieAccess` (passable/pushable/climbable/blocking), `colliderEnabled`, `occludes`, `navCost`, door actions (free egress from side -1), glass (`climbCut`), boards (`boardCost`, `canBoard`, `addBoard`, `removeBoard`), electric locks (`setLockPower`, `lockCommand`, `keypadEnter`, `tickBarrier`). `createBarrierWorld(seeds, rng)` draws exactly 2 numbers per barrier. Side +1 = the spec normal's side (street / main room) |
| `src/sim/power.ts` | **Engine-agnostic power**: `PowerWorld` (gridFailsAt, circuits keyed by building address, generators), `stepPower` resolves grid → generator → UPS (critical loads only), burns fuel (`fuelPerHour`), trips breakers, auto-starts standby units; `defaultLoads(type)` per building type |
| `src/sim/climate.ts` | Air temperature by time of day, day number and shelter |
| `src/sim/items.ts`, `src/sim/rng.ts` | Item data and loot tables (`peekNextUid`/`setNextUid` for saves); seeded RNG (`mulberry32` returns a `SeededRng` with `state()`/`setState()`) |
| `src/sim/save.ts` | **The save file.** `SaveData` is versioned plain JSON (`SAVE_VERSION`) holding only what the seed can't rebuild: clock, game rng position, player (pos, body, inventory), zombies (by seed), opened containers, ground piles, terminal sessions (`SavedComputer`, minus the machine def), power world + portable generator positions, and the barrier world. `migrate` (step-by-step upgrades), `validate` (throws `SaveError` naming the damaged part), `serialise`/`deserialise`, `trimScreen` |
| `src/game/saveStore.ts` | `SaveStore`: IndexedDB DB "zombie-survival", store "saves", slots `auto`/`1`/`2`/`3`; one transaction per write; falls back to memory and sets `persistent = false` when storage is refused |
| `src/game/Game.ts` | Main loop and orchestration: pointer lock, combat, looting, inventory, zombie management, HUD emission (10 Hz via `onHud`) |
| `src/game/entities/player.ts` | Movement, stamina, jump/gravity, survival stat drain, over-the-shoulder camera with collision |
| `src/game/entities/zombie.ts` | Zombie AI. States: idle, wander, investigate, chase, dead. Senses run every 0.25 s: sight cone + line of sight, footsteps, noise events |
| `src/game/entities/humanoid.ts` | **Procedural skinned human.** 19-bone skeleton; the body is lofted from cross-sections (torso keyframes, arms, legs with calves, a shaped head with jaw, nose and ears, hands, shoes) and skinned with blended weights. Six cached template geometries (m/f × slim/average/heavy). Clothing, hair, eyebrows, grime and blood come from a shader (`zone`/`limbT` attributes + per-character uniforms). Procedural animation: gait with knee and foot plant, hip bob/twist, chest counter-rotation, breathing, crouch, two-handed aim, overhead swing, flinch, zombie hunch/limp/twitch/arm habits, knee-buckle fall. Public API used by others: `root`, `body`, `head`, `hand`, `animate()`, `fall()`, `flinch()`, `setTint()`, `setShadows()` |
| `src/game/world/town.ts` | Procedural town: named streets with real house numbers, buildings with interiors, furniture, loot containers (`preset` items for notes and caches), computers (`ComputerSpot` with a glowing screen mesh), a supply crate at the stash address, cars, street lamps (glow at night while the grid is up), zombie spawn points. Every opening emits a `BarrierSpec` (index = barrier id) from `wall(..., meta)`; window frames and door jambs are added with no random draws. The police armory (back-left corner) and its keypad are built here; the armory PIN is copied from the controller host after generation. **Never add rng draws here** (the whole town and every password would reshuffle) |
| `src/game/world/colliders.ts` | AABB collision + raycast/LOS over an 8 m spatial grid. Boxes can be switched off (`setEnabled`), tagged with `barrierId`, or marked `glass` (bullets skip with `skipGlass`); `raycast(..., out)` reports the box hit |
| `src/game/world/barrierSystem.ts` | **Client side of barriers.** One collider box per opening (doors: switched off when open; windows: always on, `glass`), a one-cell nav cost strip on the wall line, instanced leaves (one mesh per build, hinge-pivoted swing, burst tilt, per-house paint via a paint-mask shader tweak), glass planes, packed shard and board pools, keypad LED. API: `reset`, `syncAll` (save restore path), `nearest`, `nearestKeypad`, `sideOf`, `closestPoint`, `approach`, `open/close/bolt/hit/push/breakGlass/clear/board/pry`, `traversal`, `reachThrough`, `sealed`, `setControllerPower`, `command`, `keypad`, `accessRows`, `update(dt)` |
| `src/game/world/terrain.ts` | Simplex heightmap. The town (radius 120) is flat at y = 0 |
| `src/game/world/vegetation.ts` | Instanced trees and bushes |
| `src/game/world/environment.ts` | Sun, hemisphere light, fog, day/night (`daylight()` 0..1) |
| `src/game/world/builder.ts` | Merges static geometry per material; `material(color, opts, surface)` attaches procedural maps and projects world-space UVs |
| `src/game/render/textures.ts` | `TextureLibrary`: procedural seamless surface maps (4D-noise torus sampling) |
| `src/game/render/postfx.ts` | `PostFX`: EffectComposer chain and the Tarkov-style grade shader; `setQuality("high" or "low")` |
| `src/game/electricity.ts` | `Electricity`: owns the PowerWorld; builds circuits (the police UPS is sized from `network.upsMinutes`); generator objects (the standby at `building.standby`, portables placed by the player); a pool of 4 interior PointLights for lit buildings near the player at night; generator noise every 1.5 s; light lure (noise radius 16 every 3 s) for lit buildings at night; `humLevel` for the engine drone |
| `src/game/render/cctv.ts` | `CctvSystem`: one PerspectiveCamera per camera host at the building's `cameraMounts`; renders one channel every 0.16 s to a render target, reads pixels, applies grayscale, auto-exposure, IR at night, noise and an OSD into canvases that `CctvViewer.tsx` mounts |
| `src/game/render/sky.ts` | `SkyDome`: overcast gradient sky that follows the camera |
| `src/game/audio.ts` | All sounds synthesised with WebAudio (no audio files) |
| `src/game/input.ts` | Keyboard/mouse with per-frame "pressed" edges |
| `src/components/` | React HUD (stat bars, moodles, sleep screen), Inventory + HealthPanel (body diagram, per-wound bandaging), Overlay (menu, pause, death, "you got back up") |

**Key tuning constants:**
- `Game.ts`: `WORLD_SEED`, `TIME_SCALE` (1 game minute per real second), `MAX_WEIGHT` = 20 kg
- `player.ts`: speeds
- `zombie.ts`: attack range/windup
- The `zombieContext()` visibility formula in `Game.ts`

## Status

**Session 8 (saving) is complete and pushed.**
- Format: `src/sim/save.ts` (see the code map). Zombies are rebuilt from their seed (`Zombie.toSave`/`fromSave`; each zombie owns `mulberry32(seed)`), so the save never carries meshes. The game's own rng position is saved, so a loaded run continues the same random stream. Terminal lockouts are stored as real milliseconds left.
- `Game.resetRun()` is shared by `start()` and loading; `toSave()`/`applySave()` are the two halves; `Electricity.toSave()/restore()` and `saveComputer()/restoreComputer()` do their parts; `barriers.syncAll()` rebuilds colliders, nav costs and meshes from the barrier world.
- Autosave ("auto" slot): every 120 real seconds (`AUTOSAVE_SECONDS`) when nothing is hunting you, no UI is open, and you're not mid-climb or mid-action; on lying down to sleep; when the tab is hidden. **Permadeath:** dying deletes the autosave; manual slots 1–3 are kept. This is my reading of "permadeath" plus "saving"; ask the owner if they want slots erased too (pure permadeath) or the autosave kept (no permadeath).
- UI: title screen Continue (newest save) / New game / load list; pause menu save, overwrite, load, delete; death screen load list. A warning shows when the browser won't persist saves.
- Verified: `save.mjs` H11 gives an identical fingerprint after a page reload (clock, rng, player, body, inventory, zombies, barriers, colliders, nav costs, containers, car fuel, ground piles, police terminal session, power world, generators); H11b refuses a damaged save with a message; 6 unit tests in `save.test.ts` plus rng golden values in `rng.test.ts`.
- A review pass after session 7 fixed: door leaves sitting on the step/floor; burst doors hanging inside the frame; crosshair-first targeting (`aimed()`); no looting through walls or glass (`inReach()`); windows over counters targetable; zombie breach/noise handling.

**Session 7 (doors, windows, barricades, access control) is complete and pushed.**
- Design: a 3-approach judge panel produced the spec (kept in the session scratchpad; the decisions are summarised in DESIGN.md "Matter and objects" and "Access control").
- 463 barriers in town: 86 doors (43 solid house fronts, 30 hollow interior, 11 glass shopfronts, the police steel front and armory) and 377 windows.
- Controls: E open/close/break/climb, Q deadbolt or clear shards, hold H board up, Shift+H pry off. Timed actions show a progress bar and lock movement (mouse look still works); moving, releasing H or getting hit cancels.
- Verified in the browser with `tools/harness/doors.mjs`:
  - Closed door blocks movement and sight, open doesn't; deadbolt only from inside; can't close a door on yourself.
  - 1 zombie bursts a latched door after 43 s of pounding (38 blows, 1.14 s apart); 2 on a deadbolt take 66 s.
  - A silent, crouched player ends a siege in ~20 s; the door survives.
  - Break glass (20 m noise), vault 1.97 s, zombie routes to a broken window over a bolted door, climbs in 3.0 s; a punch mid-climb shoves it back out, down.
  - Boarding a window: 24 s, exactly 3 planks + 12 nails; hammering heard at once; outside boards torn before the glass, inside boards after it.
  - Police: ssh admin@cpd-acs (admin/admin) → `door unlock armory` → opens; keypad 5 wrong → 60 s lockout; UPS runs flat → "A heavy clunk from the entrance." (maglock released, armory stays locked, keypad dark); a zombie inside pushes the front door open; refuel the standby → locks restore their commanded state.
  - Determinism: buildings, all 36 computers' passwords, 217 containers and spawn points identical to the pre-feature build. Barrier JSON identical across new games; save → restore gives identical colliders and nav costs.
  - Performance: +12 draw calls (110 → 122 at the fixed pose), AI update unchanged or faster.

**Session 6 (electricity) is complete and pushed.**
- `Game.deviceUp` and `computerPowered` now read circuit status (load kinds: computer, network, appliances).
- L toggles lights; E on a generator opens `GeneratorPanel.tsx`; inventory "Place" sets down a portable generator; the car container has a "Siphon fuel" button. Jerry cans carry `fuel` on the ItemStack (and its weight).
- Verified in the browser:
  - Grid fails → police on UPS (PC and cameras on, lights off) → dark after 9 h.
  - Refuel the standby → generator power (1.26 L/h) → a zombie investigates the engine noise.
  - Portable from the hardware store (26 kg carried → overweight) → placed, connected, fuelled, started → house on generator.
  - Overload trips; reset works; siphon 3.7 L from a car.

**Session 5 is complete and pushed:** mechanics tuning, plus procedural skinned characters (1 draw call each, down from 13).
- Shot hit-volumes follow the new anatomy, scaled by each zombie's height.
- Characters are generated in code because asset sites are blocked and other GitHub repos are out of this session's scope.
- Still to improve: faces are simple (no textures), and elbows and knees crease slightly.
- Player: velocity with accel/decel, slower backpedal and strafe, Alt to walk quietly, winded lockout, head bob, sway from `aimSway`, recoil that springs back 75%, camera shake.
- Zombies:
  - An awareness meter driven by `sightRate`: they stare when suspicious and groan when they commit.
  - Hearing raises awareness, and a lost target gets a predicted position.
  - Lunge at close range; attack slots (max 3).
  - Knockdowns (down 2–3.2 s, then get up); feeler steering and unsticking.
  - A* paths whenever the straight line is blocked (budget: 2 searches per frame).
- Melee: swept arc over the active frames, sweep of 2 for bat and axe, hit-stop, knockdown chance, double damage to downed zombies.
- Guns: cone spread from `shotSpread`; leg hits do less damage.
- **Tuning harness results** (real game loop, see the scratch script pattern in the "How to run" section):
  - Detection at 25 m standing in daylight: 2.3 s. Crouched at night at 12 m: never.
  - Jogging: a walker loses ~2.6 m every 10 s. A runner catches a jogger.
  - Sprint: 11.2 s, then winded, with a 19 m lead on a runner.
  - Jog reached in 0.33 s.
  - Zombie behind a house reaches you: 8.2 s. Zombie inside a house reaches you outside: 5.6–6.9 s.
  - Max 3 attackers. Bat: 2.75 swings per kill.

**Session 4 (networks + CCTV) is complete and pushed.**
- Every building with a computer has a LAN:
  - Police `10.0.4.0/24`: gw, files server, dispatch, NVR, 4 cameras; UPS 8 h.
  - Stores `192.168.0.0/24`: router, POS, receipt printer.
  - Homes `192.168.1.0/24`: router, laptop on Wi-Fi, sometimes a smart TV.
- Shell commands added: `ip`, `ping`, `nmap` (only where installed: the police dispatch box), `arp`, `curl`, `ssh` (host-key prompt, password retries, nested remote session; `exit` returns).
- The `cctv` program raises an effect, and the game opens the live viewer.
- Power rules (`Game.deviceUp`): everything runs on the grid until 06:00 on the power-off day; police gear (including the dispatch desktop) then runs on the UPS for `upsMinutes`. Laptop Wi-Fi needs the home router.
- Verified by 33 unit tests plus a browser run: nmap → ssh → files → exit → cctv with live zombies on camera → night IR → UPS keeps the terminal alive 1 h after the grid fails, dead at 9 h.

**Session 3 is complete.** Computers:
- 36 machines (police terminal, store/hardware POS, about 24 house laptops).
- E uses a computer and opens `ComputerScreen.tsx`. Typing makes a little noise, and zombies keep moving.
- The grid fails at 06:00 on `facts.powerOffDay` (day 3–5); desktops die then, and laptops drain their battery while in use.
- Notes are readable items.
- The HUD shows the street address when you're inside a building.
- Verified by 12 shell tests and a real-keyboard browser test (login via the note's password → mail → stash address).
- **Graphics pass is done:**
  - `render/textures.ts` generates seamless procedural textures (plaster with grime streaks, concrete slabs, brick, cracked asphalt, wood planks, roofing, worn metal, ground, fabric) as albedo, normal and roughness maps.
  - `MeshBuilder` box-projects world-space UVs.
  - `render/postfx.ts`: RenderPass → GTAO → bloom → OutputPass → grade (desaturated, split-toned, contrast, vignette, grain, fringing). Saturation drains with blood loss.
  - `render/sky.ts` adds an overcast gradient dome.
  - Quality setting High/Low is in the menu and pause screen, stored in localStorage. The game drops to Low automatically if the first 8 s run below 32 fps and the player never chose a quality.

**Session 2 (body simulation) is complete and pushed.**
- Added `src/sim/body.ts`, `climate.ts` and the tests.
- Player physiology now lives in `player.body`.
- New controls: B bandages the worst wound, Z sleeps (time runs 30× faster; you wake on threats).
- The shelter check raycasts upward for a roof.
- Painkillers were added as an item.
- Verified with 12 unit tests plus browser tests: wounds, messages, bandaging, sleep, death by infection followed by reanimation.

Session 1 is also complete. Everything in ROADMAP "Session 1" works and was verified with headless tests:
- melee, pistol hits and headshots, reload
- zombie attacks, noise attraction, crouch stealth at night
- hunger and thirst drain
- lighting checked by screenshots

### Known issues / not yet done
- Frame rate has not been measured on a real GPU. There are about 670 draw calls; zombies are about 13 meshes each, which is the main cost. Shadows are skipped beyond 40 m and zombies are hidden beyond 115 m.
- Barriers: keys/lockpicking, openable sash windows, crowbars, holding cells, sound occlusion by closed doors, and zombies reaching through gaps between boards are deferred (see ROADMAP).
- Saving: corpses are saved as dead zombies (they still despawn on the normal timer). There is no cloud sync or export/import of save files yet.
- No mobile/touch controls.
- When pointer lock is refused twice after clicks, the game falls back to free-mouse mode.

## Next session: start here

1. Try `add_repo` with owner `yyb84ycgt6-oss` and repo `zombie-survival-game`. If it works, copy the folder's contents to that repo's root (the history can start fresh), push, and update this file. If it fails, keep working on the `eru` branch.
2. Ask the owner if anything felt off when playing the artifact (performance, controls, difficulty).
3. **Recommended next, in order (owner approved this order):**
   - ~~(b) Doors and access control~~ done in session 7.
   - ~~(c) Saving~~ done in session 8. When adding new state anywhere, add it to `SaveData` (bump `SAVE_VERSION` and write a `migrate` step if the shape changes) and to `save.mjs`'s fingerprint.
   - **(d) Character detail pass (next):** face textures, clothing variety (jackets, hoodies, uniforms on police zombies), carried gear visible on the body. Keep it deterministic per zombie seed (the save rebuilds zombies from their seed).
   Note for (a): **Characters and animation** (roadmap session 7, pulled forward).** The blocky people are now the biggest gap against the Tarkov look. `raw.githubusercontent.com` is reachable, so look for CC0 rigged glTF characters hosted on GitHub. Then do doors, windows and barricades (session 3b) and saving. Put any new rules in `src/sim/`.
4. (Old note, kept for session 7) **Characters and animation**: Use rigged glTF models (CC0, e.g. Quaternius), loaded with `GLTFLoader`, with an `AnimationMixer` per character. Keep the `Humanoid` interface (`root`, `hand`, `animate()`, `fall()`) so `Player` and `Zombie` barely change. Check that model hosts are reachable through the network proxy; if they're blocked, the owner may need to download the assets.
5. Before ending: run `npm test` and `npm run build`, commit, push, update the artifact, and update this file.
6. Asset hosts: `raw.githubusercontent.com` is reachable from the container; `quaternius.com`, `kenney.nl`, `polyhaven.org` and jsDelivr's `/gh/` are blocked by the network proxy.
