// Browser harness for cars (H18): get in, start, drive, steer, crash, run a zombie down, get out, save.
import { chromium } from "./pw.mjs";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 300)));
await p.goto("http://127.0.0.1:8080");
await p.getByRole("button", { name: "Begin" }).waitFor({ timeout: 120000 });
await p.getByRole("button", { name: "Begin" }).click();
await p.waitForTimeout(600);

const out = await p.evaluate(() => {
  const g = window.__game;
  g.renderer.setAnimationLoop(null);
  g.locked = true;
  g.freeMouse = true;
  const step = (sec, dt = 1 / 30) => {
    for (let t = 0; t < sec; t += dt) {
      g.update(dt);
      g.input.endFrame();
    }
  };
  const key = (code, down) => g.input.setVirtual(code, down);
  const tap = (code) => {
    // Opening a container frees the mouse, as in real play; a player would click back in.
    if (!g.uiOpen()) g.locked = true;
    key(code, true);
    step(1 / 30);
    key(code, false);
    step(1 / 30);
  };
  for (const z of g.zombies) {
    z.pos.set(290, 0, 290);
    z.state = "idle";
    z.awareness = 0;
    z.stateTimer = 999;
  }
  const r = {};
  r.cars = g.vehicles.list.length;
  r.kinds = [...new Set(g.vehicles.list.map((v) => v.state.kind))];
  // A car on Main Street with clear road ahead: put the player at its door.
  const car = g.vehicles.list.reduce((best, v) => (Math.abs(v.state.z) < Math.abs(best.state.z) && Math.abs(v.state.x) < 90 ? v : best));
  Object.assign(car.state, { keys: true, locked: false, battery: 90, fuel: 30, engine: 90, yaw: Math.PI / 2, tyres: [90, 90, 90, 90], radiator: 100, coolant: 100, tank: 100 });
  car.pose(g.terrain, 1);
  g.vehicles.park(car);
  const door = car.doorPoint(1);
  g.player.pos.set(door.x, g.terrain.height(door.x, door.z), door.z);
  g.player.yaw = Math.atan2(car.state.x - door.x, car.state.z - door.z);
  step(0.2);
  g.emitHud();
  tap("KeyE");
  r.inCar = g.driving === car;
  r.playerHidden = !g.player.model.root.visible;
  // Start it: a few cranks at most.
  for (let i = 0; i < 6 && !car.state.running; i++) tap("KeyR");
  r.running = car.state.running;
  // Find 80 m of clear road heading east: no solid box in a strip as wide as the car (other parked cars, walls).
  g.vehicles.unpark(car);
  const blocked = (x0, x1, z0, z1) =>
    g.colliders.boxes.some((bx) => bx.enabled !== false && bx.maxX > x0 && bx.minX < x1 && bx.maxZ > z0 && bx.minZ < z1 && bx.maxY - g.terrain.height((bx.minX + bx.maxX) / 2, (bx.minZ + bx.maxZ) / 2) > 0.4);
  let start = null;
  for (const road of [0, -60, 60]) {
    for (let x = -145; x < 60 && !start; x += 5) {
      for (const zz of [road - 2, road + 2]) {
        // Lamps line the kerbs, so only the carriageway itself must be clear, and no parked car within reach of a swerve.
        const carsNear = g.vehicles.list.some((v) => v !== car && v.state.x > x - 5 && v.state.x < x + 60 && Math.abs(v.state.z - zz) < 5);
        if (!carsNear && !blocked(x - 3, x + 58, zz - 2.2, zz + 2.2)) {
          start = { x, z: zz };
          break;
        }
      }
    }
    if (start) break;
  }
  r.clearRoadAt = start;
  if (start) {
    car.state.x = start.x;
    car.state.z = start.z;
    car.state.yaw = Math.PI / 2;
    car.state.speed = 0;
  }
  // Drive east for 3 s.
  const x0 = car.state.x;
  key("KeyW", true);
  step(3);
  r.speedAfter3s = Math.round(car.state.speed * 3.6);
  key("KeyW", false);
  r.movedM = +(car.state.x - x0).toFixed(1);
  r.playerFollows = Math.hypot(g.player.pos.x - car.state.x, g.player.pos.z - car.state.z) < 0.01;
  r.fuelUsed = +(30 - car.state.fuel).toFixed(2);
  // Steer right while rolling: yaw falls (right is -yaw).
  const yaw0 = car.state.yaw;
  key("KeyD", true);
  step(0.8);
  key("KeyD", false);
  r.steeredRight = car.state.yaw < yaw0;
  // Brake to a stop: S slows a moving car rather than reversing it.
  const brakeFrom = car.state.speed;
  key("KeyS", true);
  let t = 0;
  while (car.state.speed > 0.01 && t < 8) {
    step(0.1);
    t += 0.1;
  }
  key("KeyS", false);
  r.brakeFromKmh = Math.round(brakeFrom * 3.6);
  r.brakeSeconds = +t.toFixed(1);
  r.stoppedSpeed = +car.state.speed.toFixed(2);
  // Run a zombie down at ~35 km/h.
  const z = g.zombies.find((zz) => zz.alive);
  car.state.yaw = Math.PI / 2;
  const ahead = { x: car.state.x + 8, z: car.state.z };
  z.pos.set(ahead.x, g.terrain.height(ahead.x, ahead.z), ahead.z);
  car.state.speed = 10;
  const kills0 = g.kills;
  const body0 = car.state.body;
  key("KeyW", true);
  step(1.5);
  key("KeyW", false);
  r.zombieHit = !z.alive || z.state === "down";
  r.killsGained = g.kills - kills0;
  r.carBodyDamaged = car.state.body < body0;
  // Rear-end another parked car at 45 km/h: both stop, the car is dented, the driver is hurt.
  const other = g.vehicles.list.find((v) => v !== car);
  const back = 9;
  car.state.yaw = other.state.yaw;
  car.state.x = other.state.x - Math.sin(other.state.yaw) * back;
  car.state.z = other.state.z - Math.cos(other.state.yaw) * back;
  Object.assign(car.state, { body: 100, engine: 100, speed: 12.5 });
  const hp0 = g.player.body.health;
  step(1.5);
  r.crashBodyLoss = +(100 - car.state.body).toFixed(1);
  r.crashEngineLoss = +(100 - car.state.engine).toFixed(1);
  r.crashStopped = Math.abs(car.state.speed) < 3;
  r.driverHurt = +(hp0 - g.player.body.health).toFixed(1);
  r.didNotPassThrough = Math.hypot(car.state.x - other.state.x, car.state.z - other.state.z) > (car.spec.length + other.spec.length) / 2 - 0.6;
  g.player.body.health = 100;
  // Get out once stopped: the car parks as an obstacle where it stands.
  car.state.speed = 0;
  step(0.2);
  tap("KeyE");
  r.outOfCar = g.driving === null && g.player.model.root.visible;
  r.parkedCollider = g.colliders.boxes[car.collider].enabled !== false;
  r.trunkFollows = Math.hypot(car.container.x - car.state.x, car.container.z - car.state.z) < 0.01;
  const s = g.toSave();
  const sv = s.vehicles.find((v) => v.id === car.state.id);
  r.saved = !!sv && Math.abs(sv.x - car.state.x) < 0.01;

  const standAt = (v) => {
    const d = v.doorPoint(1);
    g.player.pos.set(d.x, g.terrain.height(d.x, d.z), d.z);
    g.player.yaw = Math.atan2(v.state.x - d.x, v.state.z - d.z);
    step(0.1);
  };
  const msgs = () => g.messages.map((m) => m.text).join(" | ");

  // A locked car: E only says so; H puts a window through (noise, maybe the alarm), then you're in.
  const locked = g.vehicles.list.find((v) => v.state.locked && !v.state.keys && v.spec.kind !== "police" && v !== car);
  r.lockedFound = !!locked;
  if (locked) {
    Object.assign(locked.state, { alarm: true, hasBattery: true, battery: 60 });
    standAt(locked);
    tap("KeyE");
    r.lockedBlocks = g.driving === null && msgs().includes("locked");
    tap("KeyH");
    r.smashUnlocks = !locked.state.locked && locked.state.windows <= 55;
    r.alarmSounding = g.alarms.has(locked);
    const n0 = g.noises.length;
    step(1.2);
    r.alarmMakesNoise = g.noises.some((n) => n.radius >= 80);
    tap("KeyE");
    r.inAfterSmash = g.driving === locked;
    // Hotwire needs a screwdriver: give one and do it, then crank; the alarm stops once it runs.
    g.inventory.push({ uid: 990001, id: "screwdriver", count: 1 });
    Object.assign(locked.state, { battery: 90, fuel: 20, engine: 90 });
    tap("KeyR");
    step(9);
    r.hotwired = locked.state.hotwired;
    for (let i = 0; i < 6 && !locked.state.running; i++) tap("KeyR");
    r.alarmStopsWhenRunning = locked.state.running && !g.alarms.has(locked);
    g.exitVehicle(true);
  }

  // The police cruiser: keys hang in a station locker; the siren is a lure heard from 140 m.
  const cop = g.vehicles.list.find((v) => v.spec.kind === "police");
  r.cruiser = !!cop;
  if (cop) {
    const locker = g.town.containers.find((c) => c.table === "police_locker");
    if (locker) {
      locker.items = null;
      g.openContainer(locker);
      const keys = locker.items.find((i) => i.id === "car_keys");
      r.cruiserKeysInLocker = !!keys;
      if (keys) {
        g.inventory.push(keys);
        locker.items = locker.items.filter((i) => i !== keys);
      }
      g.closeUi(false);
    }
    Object.assign(cop.state, { hasBattery: true, battery: 80 });
    standAt(cop);
    tap("KeyE");
    r.cruiserKeysOpenIt = g.driving === cop && cop.state.keys;
    tap("KeyG");
    r.sirenOn = cop.state.siren;
    let heard = false;
    for (let i = 0; i < 45; i++) {
      step(1 / 30);
      heard = heard || g.noises.some((n) => n.radius >= 140);
    }
    r.sirenNoise = heard;
    tap("KeyG");
    g.exitVehicle(true);
  }

  // Keys in houses: each set fits exactly one car, by its plate.
  let keysFound = 0;
  let keysFitACar = true;
  for (const c of g.town.containers.filter((c) => c.table === "bedroom" || c.table === "kitchen")) {
    c.items = null;
    g.openContainer(c);
    for (const k of c.items.filter((i) => i.id === "car_keys")) {
      keysFound++;
      const fits = g.vehicles.list.filter((v) => k.text.includes(v.state.plate));
      if (fits.length !== 1) keysFitACar = false;
    }
    g.closeUi(false);
  }
  r.houseKeys = keysFound;
  r.houseKeysFitOneCarEach = keysFitACar;

  // Repairs from the car panel: a flat changed for a spare, a battery taken for salvage.
  const fix = g.vehicles.list.find((v) => v !== car && v.spec.kind !== "police" && !v.state.locked);
  fix.state.tyres[0] = 2;
  g.inventory.push({ uid: 990002, id: "wrench", count: 1 }, { uid: 990003, id: "spare_tyre", count: 1, charge: 88 });
  standAt(fix);
  tap("KeyQ");
  const panel = g.carPanel();
  r.panelShowsParts = !!panel && panel.parts.length >= 12;
  r.panelOffersTyre = !!panel && panel.repairs.some((o) => o.id === "tyre:swap:0" && o.ok);
  g.repairVehicle("tyre:swap:0");
  g.locked = true;
  step(13);
  r.tyreChanged = fix.state.tyres[0] === 88;
  standAt(fix);
  tap("KeyQ");
  g.repairVehicle("battery:take");
  g.locked = true;
  step(6);
  const bat = g.inventory.find((i) => i.id === "car_battery");
  r.batterySalvaged = !fix.state.hasBattery && !!bat && bat.charge > 0;
  g.closeUi(false);

  // Jump-start: a flat battery borrows charge through cables from a car parked alongside.
  const dead = car;
  const donor = fix;
  Object.assign(donor.state, { hasBattery: true, battery: 80 });
  g.vehicles.unpark(donor);
  donor.state.x = dead.state.x + Math.cos(dead.state.yaw) * 2.4;
  donor.state.z = dead.state.z - Math.sin(dead.state.yaw) * 2.4;
  donor.state.yaw = dead.state.yaw;
  g.vehicles.park(donor);
  Object.assign(dead.state, { battery: 3, keys: true, locked: false, running: false });
  g.inventory.push({ uid: 990004, id: "jumper_cables", count: 1 });
  standAt(dead);
  tap("KeyE");
  tap("KeyR");
  step(5);
  r.jumpStarted = dead.state.battery >= 15;

  // Overheating: a holed radiator and no coolant cook the engine until it seizes.
  Object.assign(dead.state, { radiator: 5, coolant: 0, temp: 120, engine: 40, running: true, fuel: 30 });
  key("KeyW", true);
  let seized = false;
  for (let i = 0; i < 40 && !seized; i++) {
    step(0.5);
    seized = !dead.state.running;
  }
  key("KeyW", false);
  r.overheatSeizes = seized && msgs().includes("seized");

  // Skid marks: a hard stop from speed lays rubber.
  Object.assign(dead.state, { engine: 90, running: true, temp: 90, radiator: 100, coolant: 100, speed: 15, yaw: Math.PI / 2 });
  const marks0 = g.vehicles.skids.mesh.count;
  key("KeyS", true);
  step(1.5);
  key("KeyS", false);
  r.skidMarks = g.vehicles.skids.mesh.count - marks0;
  g.exitVehicle(true);
  return r;
});
out.errors = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
