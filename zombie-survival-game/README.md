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
| Search a container | E |
| Inventory | Tab |
| Switch weapons | 1–5, 0 to holster |
| Flashlight | F |
| Pause | Esc |

### Survival tips

- **Noise matters.** Sprinting and gunshots draw zombies from far away. Crouch-walking is almost silent.
- **Night is dangerous.** Zombies see less at night, but your flashlight makes you visible.
- **Look everywhere.** Kitchens have food, fridges have drinks, bedrooms hide bandages and sometimes a gun. The police station and hardware stores have weapons.
- **Treat bleeding fast.** Zombie hits can make you bleed; bandages and first aid kits stop it.
- **Watch your weight.** Carrying more than 20 kg slows you down and stops you sprinting.

## Tech stack

Vite, React, TypeScript, Tailwind CSS and Three.js. This is the same stack Lovable generates, so the project can be imported into [Lovable](https://lovable.dev) through GitHub and edited there.

```
src/
  game/
    Game.ts            Main loop: connects world, player, zombies, combat, loot and HUD
    items.ts           Item definitions and loot tables
    audio.ts           Synthesised sound effects
    input.ts           Keyboard and mouse
    entities/
      player.ts        Movement, stamina, survival stats, third-person camera
      zombie.ts        Zombie senses and behaviour
      humanoid.ts      Low-poly character model with procedural animation
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
```
