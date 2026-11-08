# Housing and construction

Owner's direction (2026-11-08): build houses as realistically as possible, so you can do anything to them. Break a wall and the wiring is in there (copper, metal, rubber), and you can salvage it, as in real life. The wiring is a harness that follows the house's frame and sits hidden in the walls. Next come many house styles, second storeys and basements, then building your own.

## Where houses stand today

There is **one house style**, built from boxes, as the owner guessed:

- **Shell:** a single-storey rectangle, 8–12 × 8–11.5 m, 3 m walls, and a flat slab roof.
- **Walls:** solid 25 cm boxes in plaster or brick colours, with nothing inside them.
- **Layout:** two variants. Deep lots get a back bedroom (bed, wardrobe, nightstand) behind one partition with a door. Shallow lots are a studio.
- **Front room:** a kitchen counter, a fridge, a table and sometimes a laptop.
- **Variety comes only from** size, colours (8 wall, 4 roof), and where the door and windows fall.
- **Missing:** bathrooms, hallways, garages, second storeys, basements, attics and pitched roofs.
- **Other buildings:** stores and hardware stores are one big room with shelves. The police station is the only custom layout (armory, keypad, CCTV, servers).
- **Power:** one abstract circuit per building, with loads by kind (lights, appliances, network).

## The construction model (`src/sim/construction.ts`, tested)

**Walls are assemblies of real layers, outside to inside:**

| Assembly | Layers | Used for |
|---|---|---|
| Wood frame | vinyl siding, plywood sheathing, 2×4 studs at 406 mm, fibreglass, 12.7 mm drywall | house exterior walls |
| Brick veneer | brick, sheathing, studs, fibreglass, drywall | brick houses |
| Block | 190 mm concrete block, plaster | shops |
| Partition | drywall, studs, drywall | interior walls |

**Bays and breaking.** Walls are worked in bays the width of a drywall sheet (1.22 m). Hitting a bay breaks it layer by layer from the side you're on, and force only carries on through a layer that gives. Brick takes more than twice the work of a frame wall, and block more again.

**Salvage.** Studs give planks and nails, siding gives plastic, brick gives bricks, block gives steel ties, and fibreglass gives batts. Drywall and plaster are only dust.

**Framing** is built the way a carpenter would: studs at 16-inch centres, and openings framed with kings, jacks, a doubled header and cripples.

**The wiring harness** is generated from the house's room plan by electricians' rules of thumb:

- every room gets a ceiling light and a switch inside its first door;
- receptacles are spaced so no point on a wall is more than 1.83 m from one, clear of doors;
- a kitchen gets two 20 A counter circuits in 12 AWG and a dedicated fridge circuit;
- everything else runs on 15 A in 14 AWG, with lighting at three rooms per circuit and up to eight receptacles per circuit;
- home runs leave the panel at receptacle height through the studs, and switch legs rise to the ceiling.

The harness is **deterministic from the plan**. It's never saved; only what's been cut out of it is.

**Pulling cable** from an opened bay takes exactly the runs that cross it, measured in metres. The copper is real: three conductors of NM-B (0.056 kg/m in 14 AWG, 0.089 kg/m in 12 AWG). Cutting kills that circuit for good. **Cutting a live circuit bites**, so you shut the breaker or wait for the grid to fail first.

New materials: copper cable, scrap metal, plastic scrap, brick and fibreglass batts. Each has a lineage, for example light timber framing (1832), sheathed house cable (1922) and fibreglass (1932).

## Plan, in order

1. **Plan-first house generator.** Rooms first, then walls, openings, the harness and furniture from the room plan:
   - styles: ranch, two-storey, bungalow with basement, duplex, farmhouse, trailer;
   - rooms: hallways, bathrooms, closets, and a utility room holding the breaker panel and water heater;
   - garages, and gable or hip roofs with attics.
2. **Walls you can open.**
   - Render walls by bay from their assemblies, with holes that show the studs, insulation and cable behind.
   - Salvage by bay, the right tool for each layer, and dust and noise.
   - Zombies breaching weak bays.
3. **The house's systems made real.**
   - A breaker panel you can open and switch.
   - Cut circuits that kill their lights, fridge or computers.
   - Feeding a generator into a house through the panel.
   - A plumbing harness of copper and PEX: the water heater tank holds about 150 L of drinkable water, and toilet tanks hold more.
4. **Up and down.** Stairs, second storeys, basements (cool rooms that keep food longer under the spoilage model) and attics.
5. **Building your own.**
   - The same assemblies, raised by you: frame, sheathe, insulate, board, brick.
   - Load paths, so walls carry roofs.
   - Layered fortifications that hordes have to chew through, layer by layer.
