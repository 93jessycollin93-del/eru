/**
 * Lineage: why everything in the world exists.
 *
 * Every item, machine and system in the game descends, step by real historical step, from nature:
 * ice cut from frozen ponds became an ocean trade, the trade lost half its cargo to melt, so people
 * learned to make cold, and making cold is why there is a fridge in every kitchen and why the food in
 * it spoils when the grid fails. Nothing appears from nowhere: `lineage.test.ts` fails the build if a
 * node has an unknown cause, a cycle, no path back to nature, or leads nowhere, or if an item in the
 * game has no node. Lore, books, terminals and future crafting knowledge read from this one graph.
 *
 * Dates are the commonly cited firsts; `note` is the line the game can show.
 */

export type LineageKind = "nature" | "technique" | "invention" | "infrastructure" | "institution" | "product";

export interface LineageNode {
  id: string;
  name: string;
  kind: LineageKind;
  /** Year it became real (negative = BCE; omitted for nature). */
  year?: number;
  causes: string[];
  note: string;
}

const N = (id: string, name: string, kind: LineageKind, year: number | undefined, causes: string[], note: string): LineageNode => ({ id, name, kind, year, causes, note });

export const LINEAGE: LineageNode[] = [
  // Nature: the only things without causes.
  N("fire", "Fire", "nature", undefined, [], "Lightning, then hands. Everything hot begins here."),
  N("water", "Fresh water", "nature", undefined, [], "Rivers, rain and wells. Towns grow where it is."),
  N("ice", "Natural ice", "nature", undefined, [], "Ponds froze every winter. For most of history that was the only cold there was."),
  N("wood", "Timber", "nature", undefined, [], "Fuel, tools and shelter."),
  N("ore", "Metal ore", "nature", undefined, [], "Copper, tin, then iron, locked in rock."),
  N("plants", "Wild plants", "nature", undefined, [], "Grain, fruit, fibre and willow bark."),
  N("animals", "Animals", "nature", undefined, [], "Meat, hide, and the first domesticated birds."),
  N("oil", "Crude oil", "nature", undefined, [], "Seeped from the ground for millennia before anyone drilled for it."),
  N("lightning", "Electric charge", "nature", undefined, [], "Lightning and static: power nobody could hold until the 1800s."),
  N("sand", "Sand", "nature", undefined, [], "Melted, it becomes glass; purified, it becomes silicon."),

  // Food and medicine
  N("agriculture", "Agriculture", "technique", -9500, ["plants", "water"], "Sown fields, and the first surplus worth storing."),
  N("baking", "Bread", "technique", -8000, ["agriculture", "fire"], "Ground grain and heat. Stale in days, mouldy in a week."),
  N("poultry", "Poultry farming", "technique", -6000, ["animals", "agriculture"], "Chickens: cheap meat that spoils within hours in the heat."),
  N("weaving", "Woven cloth", "technique", -6000, ["plants"], "Linen and cotton. Old cloth becomes rags, rags become bandages."),
  N("dairy", "Dairy", "technique", -6000, ["animals", "agriculture"], "Milk, a food that sours in a day without cold."),
  N("orchards", "Orchards", "technique", -4000, ["agriculture"], "Apples keep for weeks, longer in a cool cellar."),
  N("willow_bark", "Willow-bark remedy", "technique", -1500, ["plants"], "Chewed for pain since antiquity; its active part is salicin."),
  N("aspirin", "Aspirin", "invention", 1897, ["willow_bark", "chemistry"], "Bayer synthesises acetylsalicylic acid: a pill from a tree."),
  N("canning", "Food preservation in sealed jars", "invention", 1809, ["fire", "glassmaking"], "Nicolas Appert wins Napoleon's prize: boil it sealed and it keeps."),
  N("tin_can", "Tin can", "invention", 1810, ["canning", "metalworking"], "Peter Durand's patent: food that outlasts its maker."),
  N("germ_theory", "Germ theory", "institution", 1861, ["microscope"], "Pasteur shows microbes spoil food and infect wounds."),
  N("antisepsis", "Antiseptic surgery", "technique", 1867, ["germ_theory"], "Lister: clean wounds survive. The idea inside every first-aid kit."),
  N("chemistry", "Modern chemistry", "institution", 1789, ["metalworking", "glassmaking"], "Lavoisier and after: substances can be made, not just found."),

  // Cold: from ponds to the cold chain
  N("icehouse", "Icehouses", "technique", -1700, ["ice", "wood"], "Ice packed in straw in pits and sheds, kept into summer."),
  N("ice_trade", "The ice trade", "institution", 1806, ["icehouse", "sailing_ships"], "Frederic Tudor ships Boston pond ice to Martinique; much of it melts on the way."),
  N("mechanical_refrigeration", "Vapour-compression refrigeration", "invention", 1834, ["ice_trade", "steam_power", "chemistry"], "Jacob Perkins patents making cold with a pump: no ponds, no melt."),
  N("industrial_refrigeration", "Industrial refrigeration", "infrastructure", 1876, ["mechanical_refrigeration"], "Carl von Linde's machines chill breweries and meat packers; the ice trade begins to die."),
  N("electric_fridge", "Electric home refrigerator", "product", 1927, ["industrial_refrigeration", "power_grid"], "GE's Monitor-Top: the cold moves into every kitchen."),
  N("cold_chain", "The cold chain", "infrastructure", 1930, ["electric_fridge", "supermarket", "dairy"], "Farm to truck to shop to fridge, never warm; milk was its first big cargo. Break it and food spoils."),
  N("supermarket", "Self-service grocery", "institution", 1916, ["tin_can", "agriculture"], "Piggly Wiggly lets shoppers take goods off the shelf themselves."),

  // Power
  N("metalworking", "Metalworking", "technique", -3500, ["ore", "fire"], "Smelted copper and bronze, then iron: tools that hold an edge."),
  N("glassmaking", "Glassmaking", "technique", -2500, ["sand", "fire"], "Jars, lenses, and later valves and bulbs."),
  N("microscope", "Microscope", "invention", 1676, ["glassmaking"], "Van Leeuwenhoek sees the animalcules that spoil water."),
  N("sailing_ships", "Ocean sailing ships", "technique", 1450, ["wood", "metalworking"], "Hulls that cross oceans, carrying ice among everything else."),
  N("steam_power", "Steam engine", "invention", 1712, ["metalworking", "fire", "water"], "Newcomen's engine pumps mines; Watt's (1769) drives the industrial age."),
  N("electromagnetism", "Electromagnetic induction", "institution", 1831, ["lightning", "metalworking"], "Faraday makes current from a moving magnet: the principle of every generator."),
  N("dynamo", "Dynamo", "invention", 1866, ["electromagnetism", "steam_power"], "Siemens' self-exciting dynamo turns motion into usable power."),
  N("power_grid", "Public power station and grid", "infrastructure", 1882, ["dynamo"], "Edison's Pearl Street Station lights Lower Manhattan. Grids grow until a town can't live without one."),
  N("oil_drilling", "Oil drilling and refining", "infrastructure", 1859, ["oil", "steam_power"], "Drake's well in Pennsylvania; refineries split crude into kerosene, then petrol."),
  N("combustion_engine", "Internal combustion engine", "invention", 1876, ["oil_drilling", "metalworking"], "Otto's four-stroke engine: cars, and later portable generators."),
  N("generator", "Portable generator", "product", 1950, ["combustion_engine", "dynamo"], "An engine and an alternator on a frame: the grid in a box, loud and thirsty."),
  N("jerrycan", "Jerrycan", "product", 1937, ["combustion_engine", "metalworking"], "A German army design for carrying fuel that the whole world copied."),
  N("ups", "Battery backup (UPS)", "product", 1970, ["power_grid", "transistor"], "Keeps servers and cameras alive for hours after the grid drops."),
  N("municipal_water", "Pressurised town water", "infrastructure", 1850, ["water", "steam_power"], "Pumps fill a tower; gravity keeps the taps running for a day after the pumps stop."),
  N("butane_stove", "Butane camping stove", "product", 1955, ["oil_drilling", "metalworking"], "Camping Gaz's small canister stove: a flame that fits in a pack."),

  // Plastics and tools
  N("plastics", "Plastics", "invention", 1907, ["oil_drilling", "chemistry"], "Bakelite, then a century of everything from oil."),
  N("pet_bottle", "PET bottle", "product", 1973, ["plastics"], "Nathaniel Wyeth's patent: light, shatterproof, refillable at any tap."),
  N("sawmill", "Sawmill", "technique", 1594, ["wood", "metalworking"], "Cornelis Corneliszoon's wind-powered sawmill turns logs into planks by the thousand; steam takes over later."),
  N("wire_nails", "Wire nails", "product", 1880, ["metalworking", "steam_power"], "Machine-made from steel wire: cheap enough to board up a town."),
  N("steel_tools", "Forged steel tools", "product", 1850, ["metalworking"], "Hammers, axes and knives from mass-produced steel."),
  N("baseball", "Baseball", "institution", 1845, ["wood"], "A sport whose bat turned up in every garage."),

  // Weapons
  N("gunpowder", "Gunpowder", "invention", 850, ["chemistry_alchemy"], "Chinese alchemists searching for an elixir find an explosive instead."),
  N("chemistry_alchemy", "Alchemy", "technique", -300, ["ore", "fire", "plants"], "Mixing, heating and recording: the ancestor of chemistry."),
  N("firearm", "Firearms", "invention", 1300, ["gunpowder", "metalworking"], "Hand cannons, then six centuries of refinement."),
  N("cartridge", "Metallic cartridge", "invention", 1850, ["firearm", "steam_power"], "Bullet, powder and primer in one brass case."),
  N("pistol", "Semi-automatic pistol", "product", 1896, ["cartridge"], "Self-loading handguns; the police issue descendant sits in the station lockers."),

  // Signals and computing: from the telegraph to the police network
  N("telegraph", "Electric telegraph", "invention", 1844, ["electromagnetism"], "Morse sends 'What hath God wrought' from Washington to Baltimore: dots and dashes, the ancestor of qpdb's notches."),
  N("telephone", "Telephone", "invention", 1876, ["telegraph"], "Bell's voice over wire; the phone network becomes the first data network."),
  N("vacuum_tube", "Vacuum tube", "invention", 1904, ["glassmaking", "electromagnetism"], "Fleming's valve switches current with no moving parts."),
  N("transistor", "Transistor", "invention", 1947, ["vacuum_tube", "sand"], "Bell Labs replaces the valve with a sliver of crystal."),
  N("integrated_circuit", "Integrated circuit", "invention", 1958, ["transistor"], "Kilby (1958) and Noyce (1959) put many transistors on one chip."),
  N("microprocessor", "Microprocessor", "invention", 1971, ["integrated_circuit"], "Intel 4004: a whole computer's brain on one chip."),
  N("unix", "Unix", "invention", 1969, ["integrated_circuit", "telephone"], "Thompson and Ritchie at Bell Labs: files, users, pipes, a shell."),
  N("personal_computer", "Personal computer", "product", 1977, ["microprocessor"], "A computer for one desk, then every desk, then every pocket."),
  N("ethernet", "Ethernet", "invention", 1973, ["integrated_circuit", "telephone"], "Xerox PARC wires machines together on one cable."),
  N("tcp_ip", "TCP/IP", "institution", 1983, ["ethernet", "unix"], "ARPANET switches over on 1 January 1983: the protocol of every LAN in town."),
  N("linux", "Linux", "invention", 1991, ["unix", "personal_computer"], "Linus Torvalds' kernel; the servers in the police station run its descendants."),
  N("cctv", "Closed-circuit television", "invention", 1942, ["vacuum_tube"], "Siemens cameras watch V-2 launches; decades later they watch shop doors."),
  N("ip_camera", "Network camera", "product", 1996, ["cctv", "tcp_ip"], "Axis puts the camera on the network; an NVR records the street."),
  N("access_control", "Electronic access control", "product", 1980, ["integrated_circuit", "power_grid"], "Keypads, maglocks and strikes run by a controller; fail-safe or fail-secure when power dies."),

  // The game's own world
  N("qpdb", "qpdb", "invention", 2026, ["telegraph", "linux"], "Four letters, each a circle and a stick: the owner's code for the town's machines (QPDB.md)."),
];

/** Which lineage node explains each item in the game. Every item must have one (lineage.test.ts). */
export const ITEM_LINEAGE: Record<string, string> = {
  canned_beans: "tin_can",
  crisps: "supermarket",
  cereal_bar: "supermarket",
  water_bottle: "pet_bottle",
  empty_bottle: "pet_bottle",
  soda: "tin_can",
  bread: "baking",
  apple: "orchards",
  milk: "cold_chain",
  raw_chicken: "poultry",
  cooked_chicken: "poultry",
  rag: "weaving",
  bandage: "weaving",
  first_aid_kit: "antisepsis",
  painkillers: "aspirin",
  kitchen_knife: "steel_tools",
  baseball_bat: "baseball",
  fire_axe: "steel_tools",
  hammer: "steel_tools",
  nails: "wire_nails",
  plank: "sawmill",
  pistol: "pistol",
  ammo_9mm: "cartridge",
  jerry_can: "jerrycan",
  portable_generator: "generator",
  cooking_pot: "metalworking",
  camping_stove: "butane_stove",
  gas_canister: "butane_stove",
  note: "weaving",
};

/** Systems in the world that the graph explains: they count as uses, so their causes are not dead ends. */
export const SYSTEM_LINEAGE: Record<string, string> = {
  fridges: "electric_fridge",
  town_water: "municipal_water",
  town_grid: "power_grid",
  ups_batteries: "ups",
  police_network: "tcp_ip",
  police_servers: "linux",
  cctv: "ip_camera",
  door_controllers: "access_control",
  terminals: "personal_computer",
  germ_infection: "germ_theory",
  qpdb: "qpdb",
};

const byId = new Map(LINEAGE.map((n) => [n.id, n]));

export const lineageNode = (id: string) => byId.get(id);

/** The chain of causes behind a node, nature first, each node once (a topological order of its ancestry). */
export function ancestry(id: string): LineageNode[] {
  const out: LineageNode[] = [];
  const seen = new Set<string>();
  const visit = (nid: string) => {
    if (seen.has(nid)) return;
    seen.add(nid);
    const n = byId.get(nid);
    if (!n) return;
    for (const c of n.causes) visit(c);
    out.push(n);
  };
  visit(id);
  return out;
}

/** The main line behind a node, nature first: follow each node's first (primary) cause back to nature. */
export function mainLine(id: string): LineageNode[] {
  const out: LineageNode[] = [];
  for (let n = byId.get(id); n; n = n.causes.length ? byId.get(n.causes[0]) : undefined) out.unshift(n);
  return out;
}

/** "Natural ice → Icehouses → The ice trade (1806) → …" for an item, or null if it has no lineage. */
export function itemOrigin(itemId: string): { line: string; note: string } | null {
  const id = ITEM_LINEAGE[itemId];
  const node = id ? byId.get(id) : undefined;
  if (!node) return null;
  const line = mainLine(node.id)
    .map((n) => (n.year === undefined ? n.name : `${n.name} (${n.year < 0 ? `${-n.year} BCE` : n.year})`))
    .join(" → ");
  return { line, note: node.note };
}

/** Every problem with the graph, in words. Empty means every node traces back to nature and leads somewhere. */
export function lineageProblems(itemIds: string[]): string[] {
  const problems: string[] = [];
  for (const n of LINEAGE) {
    if (n.kind === "nature" && n.causes.length) problems.push(`${n.id}: nature has no causes`);
    if (n.kind !== "nature" && !n.causes.length) problems.push(`${n.id}: appears from nowhere (no causes)`);
    for (const c of n.causes) if (!byId.has(c)) problems.push(`${n.id}: unknown cause ${c}`);
  }
  // Cycles.
  const state = new Map<string, 1 | 2>();
  const dfs = (id: string, path: string[]): void => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) {
      problems.push(`cycle: ${[...path, id].join(" -> ")}`);
      return;
    }
    state.set(id, 1);
    for (const c of byId.get(id)?.causes ?? []) dfs(c, [...path, id]);
    state.set(id, 2);
  };
  for (const n of LINEAGE) dfs(n.id, []);
  // Leads somewhere: a cause of another node, or explains an item or system.
  const used = new Set<string>([...Object.values(ITEM_LINEAGE), ...Object.values(SYSTEM_LINEAGE)]);
  for (const n of LINEAGE) for (const c of n.causes) used.add(c);
  for (const n of LINEAGE) if (!used.has(n.id)) problems.push(`${n.id}: a dead end (causes nothing, explains nothing)`);
  for (const id of itemIds) {
    const l = ITEM_LINEAGE[id];
    if (!l) problems.push(`item ${id}: no lineage`);
    else if (!byId.has(l)) problems.push(`item ${id}: unknown lineage ${l}`);
  }
  return problems;
}
