# Zombie Survival

A top-down, wave-based zombie survival shooter that runs in the browser.

## How to play

| Action | Control |
| ------ | ------- |
| Move   | WASD / arrow keys |
| Aim    | Mouse |
| Shoot  | Left click (hold for auto-fire) |
| Reload | R |
| Pause  | Esc / P |

- Zombies come in waves from every edge of the map. Each wave is bigger, and the zombies are tougher and faster.
- **Walkers** are slow, **runners** (from wave 2) are fast and fragile, and **brutes** (from wave 3) are slow tanks that hit hard.
- Killed zombies sometimes drop **ammo crates** or **med kits**. Pick them up before they disappear.
- Clearing a wave restores some health and ammo.
- Your high score is saved in the browser.

## Tech stack

Built on the same stack Lovable generates (Vite, React, TypeScript, Tailwind CSS), so it can be imported into [Lovable](https://lovable.dev) through GitHub and kept editing there.

- `src/game/engine.ts`: the game loop, entities, collisions and canvas rendering
- `src/game/types.ts`: shared game types
- `src/components/Hud.tsx`: health, ammo, wave and score overlay
- `src/components/Overlay.tsx`: start, pause and game-over screens
- `src/pages/Index.tsx`: mounts the canvas and connects the engine to React

## Run locally

```sh
npm install
npm run dev     # http://localhost:8080
npm run build   # production build in dist/
```
