# Beating VEIN

Owner's target (2026-11-03): at least twice VEIN's mechanics, features and micromanagement, and eventually graphics at least twice as good and as efficient. Mechanics first, graphics after.

## What VEIN has (sourced)

From its Steam page and patch notes (Early Access since 24 October 2025):

- Multiplayer open-world zombie survival. The Early Access map is about 4 × 4 km, with 14 × 14 km planned.
- Looting, farming, crafting, cooking and base building.
- A simulated power grid and water system. Wind turbines exist, and generators are implied.
- Vehicles you refuel, maintain and upgrade by part.
- An RPG stats and levelling system.
- Appliances such as washing machines, and TVs that play video.
- **No computers.** Patch 0.016 removed computer functionality because "none of them were hooked up anyways".

Sources: [Steam store](https://store.steampowered.com/app/1857950/VEIN/), [0.016 notes](https://steamcommunity.com/games/1857950/announcements/detail/514077209152980708), [0.020 notes](https://store.steampowered.com/news/app/1857950/view/514091156104020065).

## Where we stand

| System | VEIN | Us | Gap |
|---|---|---|---|
| Computers, networks, hacking | removed | real shell, ssh, nmap, CCTV from 3D cameras, door controllers; simulated OS and qpdb designed | **far ahead** |
| Body simulation | stats + RPG | blood volume, wounds by body part, clotting, hidden infection, body temperature, food poisoning | ahead (verify VEIN) |
| Doors, windows, barricades | unknown depth | layered barriers, lock types, maglock fail-safe, nav costs, sieges | likely ahead |
| Power | grid + turbines | grid failure day, building circuits, loads, generators with fuel burn, UPS, breakers | parity |
| Water | simulated system | mains run 36 h past the grid, tap refills, empty bottles kept | behind: no rain, wells, boiling or toilet tanks yet |
| Food | cooking | spoilage by temperature (Q10), fridges warming after power loss, staleness, food poisoning, raw meat risk | ahead on spoilage, behind on recipes |
| Crafting | yes | 2 recipes, real heat (powered kitchen or gas stove burning by the minute) | **behind on breadth** |
| Vehicles | drive, refuel, parts | cars as loot and fuel to siphon | **behind** |
| Farming | yes | none | **behind** |
| Base building | yes | barricades only | **behind** |
| Skills / levelling | yes | none | **behind** |
| Map | 4 × 4 km | one town | **behind** |
| Multiplayer | yes | single-player (after the UE5 port) | behind, by plan |
| Saves | server | versioned, validated, atomic, permadeath | parity |

## The plan to 2× (in order)

Each step is a full system with state, causes and tests in `src/sim/`, then wired into the client.

1. **Water and cooking depth.** Rain collection, boiling, purification tablets, toilet tanks, dirty water sickness; 20+ recipes over real heat sources (campfire, wood stove, gas, electric).
2. **Inventory 2.0.** Clothing slots and containers with volume; item condition, wear and repair; drag between containers.
3. **Vehicles.** Drivable, with per-part condition, fuel burn by load, battery, keys or hotwiring, noise that draws zombies, and trunks as storage.
4. **Skills learned by doing.** Cooking, carpentry, mechanics, first aid, electrical, computing; books speed it up. Deeper than RPG levels: skill changes outcomes, not just numbers.
5. **Farming and base building.** Seasonal crops, soil, water and spoilage tie-ins; walls, gates, storage and rain collectors.
6. **Zombie navigation and hordes.**
7. **The simulated computer and qpdb** (`DESIGN.md`, `QPDB.md`): our signature lead, since VEIN has no computers.
8. **A bigger world**, streamed in chunks.
9. **Graphics**, once mechanics pass VEIN: PBR everywhere, global illumination, volumetric fog and light, better animation. Then the UE5 port.

**How "2×" is counted:** systems that have their own state and interact with others. A feature that only exists as a label doesn't count.

## Horde nights and heat (2026-11-04)

The owner asked for the survival-genre mechanics 7 Days to Die is known for, rebuilt our own way inside the realistic simulation: no copied code, art or names. First in, in `src/sim/horde.ts`:

- **Horde nights.** Every seventh night, from 22:00 to 04:00, the dead come in waves wherever you are, and keep coming whether or not you make a sound. Spawns are out of sight and never inside a sealed building. You're warned that morning, and the clock panel counts down the days.
- **Heat.** Your noise heats the 48 m square it happens in: a gunshot about 7, hammering a little, a running generator and lit windows steadily. Heat halves every two game hours. A square at 50 draws a few scouts to the latest noise, then there's an hour's cooldown.
- **Gamestage.** Days survived, plus one for every 20 kills, sets horde size, group size, pace, and the scout count. Limits keep phones (120 alive) and desktops (170 alive) running.

Next, in the same spirit, each joining a step above:

- **Base building with structural support:** walls, frames and supports that carry load, so a horde knocking out one support can bring a wall down. Goes into step 5.
- **Workstations:** workbench, forge and chemistry bench, each gating recipes and running on real heat and fuel. Goes into step 1.
- **Skills learned by doing, books that teach them, and loot quality that rises with gamestage.** Goes into step 4.
- **The dead digging and breaking through walls during hordes.** Goes into step 6.

