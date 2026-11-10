# Graphics

Owner's direction (2026-11-10): aim for the highest realism we can reach while staying efficient (good graphics, low latency), and keep improving continuously.

## How improvement works here

Every rendering change goes through the same loop:

1. **Measure before.** `node tools/harness/graphics.mjs before` renders seven fixed views (town street at noon, dusk and night, the highway, forest, a hill view, parked cars). It saves a screenshot of each and prints draw calls, triangles and frame time.
2. **Change one thing.**
3. **Measure after** with a new label, and compare the pictures side by side and the numbers.
4. **Keep it only if** it looks better and its cost is justified at the quality level it runs on.
5. **Run the other harnesses** (phone, save, vehicles, horde, food) and the unit tests.

**Limit:** the cloud machine has no graphics card. Frame times here come from a software renderer and only mean something relative to each other; they overstate fill-rate costs such as multisampling and grass. Real frame rates come from the owner's devices: the pause menu shows frames per second.

## Quality levels

| Level | For | Edges | Lighting from the sky | Ambient occlusion | Bloom | Clouds | Grass (blades / square) | Detailed trees out to |
|---|---|---|---|---|---|---|---|---|
| Low | phones, weak graphics | FXAA | no (hemisphere light) | no | no | 1 noise lookup | 16,000 / 28 m | 48 m |
| Medium | laptops | FXAA | yes | no | yes | full | 48,000 / 42 m | 85 m |
| High | a real graphics card | 4× MSAA | yes | yes | yes | full | 90,000 / 50 m | 105 m |

Phones start on Low and desktops on High. Unless the player has picked a level, the game watches the frame rate and steps down one level at a time (below 32 frames per second over 8 seconds).

## What changed on 2026-11-10

- **Sky** (`render/sky.ts`): drifting cloud lit from the sun's side, a sun disc that shows through thin cloud, stars and a moon at night. Cloud cover is a fixed function of the game clock (`Environment.cloudCover`), and heavy cloud softens the sun.
- **Lighting from the sky:** on Medium and High the sky is filtered into an environment map every 10 game minutes (every 4 through dawn and dusk). Every material takes its ambient light and reflections from it, so car paint and glass mirror the clouds. Nights are moonlit enough to make out shapes.
- **Edges:** 4× multisampling on High; FXAA on Medium and Low. Before, nothing was smoothed.
- **Shadows:** the shadow map moves in whole texels, so edges don't shimmer as you walk.
- **Trees** (`world/vegetation.ts`): pines with eight whorls of ragged, drooping boughs; broadleaf crowns of several soft clumps; per-tree colour; wind sway. Trees are grouped into 75 m chunks, so stands off-screen are culled and distant ones use a simple model that isn't drawn into the shadow map. Every tree stands where it stood (same random draws).
- **Grass** (`render/grass.ts`): one draw call of blades that wraps round the camera in the vertex shader, with no per-frame CPU work. Baked textures give each blade the ground's height and colour and keep it off roads, pavements and floors. It is tall in the wild, short and ground-coloured on lawns, thin on dirt; it bends in the wind and flattens round the player.
- **Roofs:** houses have gable roofs with eaves, gable ends and some chimneys. They are visual only and shaped by the address, so the town and saves are unchanged.
- **Pause menu:** a Medium level and a frames-per-second readout.

## Measured (software renderer, milliseconds per frame, relative only)

| View | Old High | New High | New Medium | Old Low | New Low |
|---|---|---|---|---|---|
| Town street, noon | 3306 | 7638 | 3659 | 2304 | 2255–2423 |
| Forest, noon | 2970 | 7775 | 3015 | 1338 | 1695 |

Medium now costs about what High used to. On the software renderer, grass is about 40% of a High frame and multisampling about 35%; a graphics card handles both far more cheaply, which is why they sit on High. Triangles in the forest view: 1.07 million before, 1.31 million on High, 0.58 million on Medium, 0.43 million on Low.

## Backlog, most valuable first

1. **Real frame rates from the owner's phone and computer**, to set the level defaults and blade counts on evidence.
2. **Materials:** higher-resolution procedural textures with roughness variation; wet roads after rain; dirt and wear on walls; decals (cracks, stains, road markings).
3. **Pine needles and leaves as alpha-tested cards** on the near model, instead of solid cones and clumps.
4. **Characters:** better skin and cloth shading, smoother animation blending, cloth detail.
5. **Fog with depth:** thicker in hollows, tinted toward the sun, light shafts through trees.
6. **Cascaded shadows** for sharp near shadows and far coverage; contact shadows under grass and cars.
7. **Interiors:** light through windows, dust in the beams, lamps casting shadows.
8. **Weather:** rain and wet surfaces tied to cloud cover; wind that strengthens with it.
9. **Water**, when the map has some.
10. **A distant-terrain ring and billboarded far trees**, when the world gets bigger.
