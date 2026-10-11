# Zombie Survival

A third-person zombie survival game that runs in the browser, inspired by DayZ, Vein and Project Zomboid. Scavenge a quiet town for food, water and weapons, stay out of sight, and survive as long as you can.

See [ROADMAP.md](ROADMAP.md) for the 20-session plan.

## How to play

| Action | Control |
| ------ | ------- |
| Move | W A S D |
| Look | Mouse |
| Sprint | Shift (uses stamina; run dry and you're winded) |
| Walk quietly | Alt (hold) |
| Crouch | C (quieter and harder to see) |
| Jump | Space |
| Attack / shoot | Left click |
| Aim | Right click (hold) |
| Reload | R |
| Search, use a computer, open/close a door, break a window or climb through | E |
| Deadbolt a door (from inside) / clear shards from a broken window | Q |
| Board up a door or window (needs a hammer, planks and nails) | Hold H |
| Pry a board off (from the side it's nailed on) | Shift + H |
| Inventory and health | Tab |
| Bandage worst wound | B |
| Sleep / get up | Z |
| Lights on/off (inside a building) | L |
| Switch weapons | 1–5, 0 to holster |
| Flashlight | F |
| Pause (save and load from here) | Esc |

### Saving

- **Continue** on the title screen loads your newest save. **New game** starts a fresh run.
- **Esc** pauses: save to slot 1, 2 or 3, load any slot, or delete one.
- **Autosave** writes the "auto" slot every 2 minutes of play, when you lie down to sleep, and when you switch away from the tab, but never while a zombie is hunting you, a menu is open, or you're mid-climb or mid-hammer.
- **Death is permanent:** dying erases the autosave. Your own slots are kept, so a manual save is a deliberate checkpoint.
- Saves live in the browser (IndexedDB). In a private window, or with site data blocked, saves only last until you close the tab, and the menu says so.
- A save holds everything that changed: your body, wounds and inventory, every zombie, opened containers and dropped piles, boarded and broken doors and windows, generators and fuel, and logged-in terminal sessions (even an open ssh session).

### How the mechanics are tuned

Every gameplay number lives in `src/sim/tuning.ts`, with the reasoning written next to it. `src/sim/tuning.test.ts` enforces the design targets, for example:
- A full bar of stamina sprints for 10–13 s; running dry leaves you winded for 3–5 s.
- Jogging (3.1 m/s) slowly outpaces a normal zombie (2.0–2.9 m/s), a runner (about 1 in 8) catches a jogger, and only a sprint escapes it.
- A zombie notices you standing still in daylight at 25 m after 1.5–4 s, and a sprinting player at 8 m almost instantly. Crouched at night 12 m away, you're invisible, unless your flashlight is on.
- The axe kills in 2 hits, the bat and knife in 3, fists in 10. Hitting a knocked-down zombie does double damage.
- At most 3 zombies can attack you at once; the rest crowd behind.

Zombies build awareness gradually (they stop and stare before they charge), path around buildings with A* on a navigation grid, use doorways, and guess where you went when they lose sight of you. Closed doors and windows have a crossing cost on the grid, so a zombie takes the open way round unless it's much longer, and heads for a building's easiest way in.

### Survival tips

- **Noise matters.** Sprinting and gunshots draw zombies from far away. Crouch-walking is almost silent.
- **Night is dangerous.** Zombies see less at night, but your flashlight makes you visible.
- **Look everywhere.** Kitchens have food, fridges have drinks, bedrooms hide bandages and sometimes a gun. The police station and hardware stores have weapons.
- **Your body is simulated.** Zombie hits leave scratches, lacerations or bites on a specific body part. Deep wounds bleed until you bandage them, and losing about 2 litres of blood kills you. Leg wounds slow you down; arm wounds weaken your swings and shake your aim.
- **Bites are a death sentence.** Like Project Zomboid, there is no cure. Scratches and lacerations can infect you too. The infection is silent at first, then you feel queasy, then feverish, and then you come back as one of them.
- **Computers work.** Police terminals, shop tills and family laptops boot into a real command line (`help`, `ls`, `cd`, `cat`, `grep`, `mail`, pipes, Tab completion). Passwords are written on notes hidden in the same building. Read the mail: some of it tells you where help was left behind. Desktops need mains power, and the grid fails a few days in; laptops run on battery.
- **Buildings have real networks.** Use `ip addr`, `ping`, `arp -a`, `nmap` and `curl` to explore a building's LAN, and `ssh user@host` to log into other machines (the police file server reuses the workstation password, just like real offices). Routers, printers, smart TVs, servers and cameras all answer only while they have power.
- **Electricity is simulated.** Every building has a circuit (lights, network gear, computers, appliances, a laptop charger). Power comes from the grid until it fails, then from a generator if one is connected and running, then from a UPS battery that only carries critical equipment. Generators burn fuel according to the load they carry (a 3 kW unit uses about 0.3 L/h idling, 1.4 L/h flat out), trip their breaker if overloaded, and are loud enough to draw zombies from 30–40 m.
- **Bring the power back.** The police station's standby generator was drained for the evacuation; refuel it and it starts by itself. A hardware store still has a portable generator in stock: carry it (24 kg), set it down outside a house, run the cable in, fuel it and start it. Find jerry cans in hardware stores and car trunks, and siphon fuel from cars.
- **Light gives you away.** Lights left on light up windows at night and draw zombies. Press L to switch a building's lights off.
- **Live CCTV.** The police station has four network cameras covering the entrance, the parking lot, the front desk and the cells. Run `cctv` on the dispatch terminal to watch them live, with infrared at night. Check the street before you leave. The station's network closet runs on a UPS for about 8 hours after the grid dies.
- **Doors and windows are real.** Front doors are latched or deadbolted; you can only throw the deadbolt from inside, and a door bolted from inside won't open from the street. Zombies never use handles: they pound on what's in their way, three at most on a wide door. One zombie takes about 45 s to burst a latched door and a minute or two to get through a deadbolt. A hollow interior door lasts about 15 s. The noise draws others, and they join in. Go quiet and they lose interest in about 20 s.
- **Glass gives you away.** Breaking a window is loud (20 m). Climbing through shards can slice your arm or leg; knock them out first (Q, 2 s). Zombies climb through broken windows too, slowly: hit one mid-climb and it falls back out.
- **Board up.** Hold H with a hammer to nail a plank across a door or window (8 s and 4 nails per plank; a wide shop window needs two planks per board). Hammering carries 18 m. Boards on the outside get torn off before the zombies reach the glass; boards nailed inside are only reached after the glass shatters, which is your warning. Three boards on a window or four on a door also block the view. The hardware store has hammers, nails and planks.
- **The armory.** The police station's armory has a steel door on an electric strike and a keypad. The door controller is on the station network, still on its factory login. A strike stays locked when the power dies (fail-secure); the lobby's maglock lets go (fail-safe). Read the manual on the file server.
- **Nights are cold.** Stay indoors after dark. Rest when you're tired (Z), but never with zombies nearby.
- **Watch your weight.** Carrying more than 20 kg slows you down and stops you sprinting.

## Tech stack

Vite, React, TypeScript, Tailwind CSS and Three.js. This is the same stack Lovable generates, so the project can be imported into [Lovable](https://lovable.dev) through GitHub and edited there.

```
src/
  sim/                 Engine-agnostic simulation (ported to Unreal later). No three/React/DOM imports.
    body.ts            Blood, wounds, infection, temperature, fatigue, pain, panic, moodles
    body.test.ts       Tests for the body rules (npm test)
    climate.ts         Air temperature by time of day and shelter
    computer.ts        Virtual filesystem and Unix-like shell for in-game computers
    computerContent.ts Generated files, mail, programs and networks for each building
    network.ts         LAN model: hosts, services, addressing
    nav.ts             Navigation grid and A* pathfinding with crossing costs and path smoothing
    barriers.ts        Doors, windows and barricades: locks, glass, boards, layered damage, electric locks
    tuning.ts          Every gameplay number, with design targets in tuning.test.ts
    power.ts           Building circuits, grid, generators (fuel, breakers, auto-start), UPS
    items.ts           Item definitions and loot tables
    rng.ts             Seeded random numbers (with a saveable position)
    save.ts            The save file: versioned plain JSON, migration and validation
  game/
    Game.ts            Main loop: connects world, player, zombies, combat, loot and HUD
    audio.ts           Synthesised sound effects
    input.ts           Keyboard and mouse
    electricity.ts     Runtime power: generator objects, interior lights, generator noise, light lure
    saveStore.ts       Save slots in IndexedDB (memory fallback when storage is blocked)
    entities/
      player.ts        Movement, stamina, survival stats, third-person camera
      zombie.ts        Zombie senses and behaviour
      humanoid.ts      Procedural skinned human (19 bones, generated body, clothing shader, procedural animation)
    render/
      textures.ts      Procedural surface textures (albedo, normal, roughness)
      postfx.ts        Ambient occlusion, bloom, Tarkov-style colour grade and grain
      sky.ts           Overcast sky dome
      cctv.ts          Live CCTV: renders world cameras offscreen with auto-exposure and IR
    world/
      terrain.ts       Heightmap terrain (the town area is flat)
      town.ts          Procedural town: roads, buildings with interiors, cars, loot
      vegetation.ts    Forests and bushes (instanced)
      environment.ts   Sun, sky, fog, day/night
      colliders.ts     Collision and line-of-sight over a spatial grid
      barrierSystem.ts Door leaves, glass, boards and their colliders, nav costs and swing animation
  components/          React HUD, inventory and menus
```

The world is generated from a fixed seed (`WORLD_SEED` in `Game.ts`), so everyone gets the same town.

## Run locally

```sh
npm install
npm run dev     # http://localhost:8080
npm run build   # production build in dist/
npm test        # simulation tests
```
