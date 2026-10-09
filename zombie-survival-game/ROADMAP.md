# Roadmap

The goal is a browser-based, third-person zombie survival game that feels like **DayZ** (open world, scavenging, tension, guns are loud), **Vein** (dense, explorable towns where every building has an interior) and **Project Zomboid** (deep survival simulation, "this is how you died").

Single-player first. Every system is built so multiplayer can be added later without a rewrite.

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

## Session 2: Characters and animation
- Replace box people with rigged, animated models (CC0 packs such as Quaternius or Kenney, loaded as glTF)
- Animation blending: idle, walk, run, crouch, melee swings, aim, hit reactions, death
- Zombie variety in clothing and body type

## Session 3: Doors, windows and barricades
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

## Session 7: Health 2.0
- Per-body-part wounds: scratches, lacerations, bites, fractures
- Infection: bites can turn you
- Sleep and fatigue, body temperature, sickness from bad food or water
- Zomboid-style status icons for panic, pain, tiredness and hunger

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

## Session 19: Multiplayer groundwork
- Separate simulation from rendering so a server can run the world
- Prototype a small co-op server

## Session 20: Polish and release
- Settings: graphics quality, mouse sensitivity, key bindings, volume
- Performance profiling and level-of-detail tuning
- Tutorial hints and onboarding
