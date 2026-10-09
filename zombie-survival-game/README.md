# Zombie Survival

A third-person zombie survival game that runs in the browser, inspired by DayZ, Vein and Project Zomboid. Scavenge a quiet town for food, water and weapons, stay out of sight, and survive as long as you can.

See [ROADMAP.md](ROADMAP.md) for the 20-session plan.

## How to play

| Action | Control |
| ------ | ------- |
| Move | W A S D |
| Look | Mouse |
| Sprint | Shift (uses stamina) |
| Crouch | C (quieter and harder to see) |
| Jump | Space |
| Attack / shoot | Left click |
| Aim | Right click (hold) |
| Reload | R |
| Search a container / use a computer | E |
| Inventory and health | Tab |
| Bandage worst wound | B |
| Sleep / get up | Z |
| Switch weapons | 1–5, 0 to holster |
| Flashlight | F |
| Pause | Esc |

### Survival tips

- **Noise matters.** Sprinting and gunshots draw zombies from far away. Crouch-walking is almost silent.
- **Night is dangerous.** Zombies see less at night, but your flashlight makes you visible.
- **Look everywhere.** Kitchens have food, fridges have drinks, bedrooms hide bandages and sometimes a gun. The police station and hardware stores have weapons.
- **Your body is simulated.** Zombie hits leave scratches, lacerations or bites on a specific body part. Deep wounds bleed until you bandage them, and losing about 2 litres of blood kills you. Leg wounds slow you down; arm wounds weaken your swings and shake your aim.
- **Bites are a death sentence.** Like Project Zomboid, there is no cure. Scratches and lacerations can infect you too. The infection is silent at first, then you feel queasy, then feverish, and then you come back as one of them.
- **Computers work.** Police terminals, shop tills and family laptops boot into a real command line (`help`, `ls`, `cd`, `cat`, `grep`, `mail`, pipes, Tab completion). Passwords are written on notes hidden in the same building. Read the mail: some of it tells you where help was left behind. Desktops need mains power, and the grid fails a few days in; laptops run on battery.
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
    computerContent.ts Generated files, mail and programs for each computer
    items.ts           Item definitions and loot tables
    rng.ts             Seeded random numbers
  game/
    Game.ts            Main loop: connects world, player, zombies, combat, loot and HUD
    audio.ts           Synthesised sound effects
    input.ts           Keyboard and mouse
    entities/
      player.ts        Movement, stamina, survival stats, third-person camera
      zombie.ts        Zombie senses and behaviour
      humanoid.ts      Low-poly character model with procedural animation
    render/
      textures.ts      Procedural surface textures (albedo, normal, roughness)
      postfx.ts        Ambient occlusion, bloom, Tarkov-style colour grade and grain
      sky.ts           Overcast sky dome
    world/
      terrain.ts       Heightmap terrain (the town area is flat)
      town.ts          Procedural town: roads, buildings with interiors, cars, loot
      vegetation.ts    Forests and bushes (instanced)
      environment.ts   Sun, sky, fog, day/night
      colliders.ts     Collision and line-of-sight over a spatial grid
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
