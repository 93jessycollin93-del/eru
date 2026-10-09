# Roadmap

The goal is a browser-based, third-person zombie survival game that feels like **DayZ** (open world, scavenging, tension, guns are loud), **Vein** (dense, explorable towns where every building has an interior) and **Project Zomboid** (deep survival simulation, "this is how you died").

**North star:** the most realistic survival game ever made, in both the physical and the cybernetic world. See [DESIGN.md](DESIGN.md) for what that means system by system.

**Strategy: browser now, port later.** Every system is built and tested in the browser, where Claude can run and verify it each session. Once the design is proven, it gets ported to Unreal Engine 5 for top-tier visuals.

To make the port practical:
- **Simulation lives in `src/sim/`.** This is plain TypeScript with no Three.js, React or DOM, and it holds the rules of the world: body, wounds, infection, temperature, hunger, items, loot. It is deterministic given an RNG, and its state is serialisable. This is the part that gets ported.
- **Rendering, input and UI** (`src/game/`, `src/components/`) are a thin client over the simulation and are expected to be rewritten in Unreal.
- **Data over code.** Items, loot tables, zombie types and recipes are data tables, so they can be exported as JSON for Unreal.

**Realism pillars:**
1. **Body:** blood, wounds per body part, infection, temperature, fatigue, pain.
2. **World:** persistent, physical, everything enterable, weather.
3. **Sound and sight:** stealth based on noise and light.
4. **Consequences:** permadeath, scarcity, things decay and break.

Single-player first. Multiplayer comes after the port.

Each session below is roughly one working session. The order can change based on what feels most important after playtesting.

## Session 1: 3D foundation ✅

- Three.js world with procedural terrain, forests, and a town of enterable buildings (houses, stores, hardware stores, police station)
- Third-person over-the-shoulder camera with collision and aim zoom
- Movement: walk, sprint (stamina), crouch, jump
- Zombies: wander, hear footsteps and gunshots, see you (less at night or when you crouch), chase, lose track, attack, stagger, die
- Melee (fists, knife, bat, axe) and a pistol with ammo, reloading and headshots
- Survival stats: health, hunger, thirst, stamina, bleeding
- Lootable containers with loot tables per room type, inventory with weight, dropping items
- Day/night cycle with a flashlight
- Synthesised sound (gunshots, hits, groans, wind)
- Death screen with time survived

## Session 2: Body simulation (Health 2.0) ✅
- Blood volume separate from tissue health, wounds per body part (scratch, laceration, bite), bleeding that clots or doesn't
- Zombie infection with hidden incubation and symptoms (Project Zomboid rules: no cure)
- Body temperature, fatigue and sleep, pain, panic
- Zomboid-style status indicators ("moodles"); health panel with a body diagram and per-wound treatment
- First engine-agnostic module in `src/sim/`

## Session 7 (was 2): Characters and animation
- Replace box people with rigged, animated models (CC0 packs such as Quaternius or Kenney, loaded as glTF)
- Animation blending: idle, walk, run, crouch, melee swings, aim, hit reactions, death
- Zombie variety in clothing and body type

## Session 3: Usable computers + Tarkov-style graphics pass (owner request) ✅
- Computers in police stations, shops and houses (laptops): boot, log in, a real shell (`ls`, `cd`, `cat`, `grep`, pipes, `mail`, programs), with lore and gameplay leads (supply caches, power-grid status)
- Electricity: the grid fails on a set day; laptops have batteries
- Street addresses for every building
- Graphics: textured materials, ambient occlusion, colour grading, grain, a physical sky

## Session 4: Networks and CCTV (cybernetic world) ✅
- Building LANs with real addressing; `ip addr`, `ping`, `nmap`, `ssh` into servers (nested sessions)
- Police station network: file server, NVR, IP cameras
- Live CCTV feeds rendered from cameras in the 3D world, viewed from a terminal
- UPS batteries keep network gear alive for hours after the grid fails

## Session 3b: Doors, windows and barricades
- Doors that open, close and lock; zombies bang on them and can break through
- Climb and vault through windows (breaking the glass makes noise)
- Board up windows and doors with planks, a hammer and nails

## Session 4: Zombie navigation and hordes
- Navmesh pathfinding so zombies route through doorways instead of sliding along walls
- Hordes that migrate across the map; noise draws crowds
- Zombies remember the last place they heard something

## Session 5: Saving and persistence
- Save and load to the browser (IndexedDB)
- Looted containers, dropped items, corpses and barricades persist
- Several save slots

## Session 6: Inventory 2.0
- DayZ-style grid inventory with clothing slots: backpack, jacket, pants pockets, vest
- Item condition and durability; weapons wear out
- Drag and drop between containers

## Session 2b: Health follow-ups (fold into later sessions)
- Fractures and splints, wound infection from dirty bandages, disinfectant, food poisoning

## Session 8: Cooking and crafting
- Campfires and stoves; cook food, boil water
- Crafting recipes: bandages from torn clothes, improvised weapons, spears
- Food spoils over time

## Session 9: Base building
- Build walls, gates, barricades and storage
- Rain collectors and gardens for long-term survival

## Session 10: A bigger world
- Several towns joined by roads, farmland, a gas station, a military checkpoint
- World streaming in chunks so the map can be large without slowing the browser
- In-game map that you have to find

## Session 11: Vehicles
- Drivable cars with fuel, keys, damage and engine noise
- Car trunks as mobile storage

## Session 12: Weather and seasons
- Rain, thunderstorms, fog, wind, snow
- Weather affects temperature, visibility and how far sound carries

## Session 13: Weapons 2.0
- Rifles, shotguns and attachments (scopes, suppressors)
- Ballistics, bullet drop, magazines as items
- Melee shove, weapon durability, two-handed weapons

## Session 14: Audio 2.0
- Recorded sound effects with positional 3D audio
- Footsteps per surface, interior reverb
- Music cues for being hunted and for quiet moments

## Session 15: Graphics pass
- Textured (PBR) materials for buildings, roads and terrain
- Post-processing: ambient occlusion, colour grading, film grain
- Grass, foliage that moves in the wind, better sky

## Session 16: Zombie variety
- Crawlers, sprinters at night, armoured riot zombies
- Zombie corpses you can search
- Zombies in vehicles and behind fences

## Session 17: Utilities and the world winding down
- Electricity and water shut off after a set number of days (like Project Zomboid)
- Generators, fuel, battery-powered radios with broadcasts

## Session 18: Skills and progression
- Skills that improve with use: fitness, strength, aiming, carpentry, cooking, first aid
- Books and magazines that speed up learning

## Session 19: Port preparation
- Audit `src/sim/` so it has no browser dependencies, and export all data tables as JSON
- Write the Unreal port plan: module mapping, C++ class layout, asset list
- (Multiplayer comes after the port, on Unreal's networking)

## Session 20: Polish and release
- Settings: graphics quality, mouse sensitivity, key bindings, volume
- Performance profiling and level-of-detail tuning
- Tutorial hints and onboarding
