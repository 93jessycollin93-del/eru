// Browser harness for doors, windows, barricades and access control (H1-H8).
import { chromium } from "./pw.mjs";
const only = process.argv[2] ?? "all";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + e.message + " " + (e.stack ?? "").split("\n").slice(0, 3).join(" | ")));
p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 300)));
await p.goto("http://127.0.0.1:8080");
await p.getByRole("button", { name: "Begin" }).waitFor({ timeout: 120000 });
await p.getByRole("button", { name: "Begin" }).click();
await p.waitForTimeout(600);

await p.evaluate(() => {
  const g = window.__game;
  g.renderer.setAnimationLoop(null);
  g.locked = true;
  g.freeMouse = true;
  const H = (window.__h = {});
  window.__THREE_M4 = g.camera.matrix.constructor;
  H.g = g;
  H.step = (sec, dt = 1 / 30, until) => {
    let t = 0;
    for (; t < sec; t += dt) {
      g.update(dt);
      g.input.endFrame();
      if (until && until()) break;
    }
    return t;
  };
  H.clearZombies = () => {
    for (const z of g.zombies) {
      z.pos.set(290, 0, 290);
      z.state = "idle";
      z.breach = null;
      z.clamber = null;
      z.awareness = 0;
      z.stateTimer = 999;
    }
  };
  H.press = (code) => {
    g.input.pressed.add(code);
    g.input.down.add(code);
  };
  H.release = (code) => g.input.down.delete(code);
  H.spec = (pred) => g.barriers.specs.find(pred);
  H.face = (P, x, z) => {
    P.yaw = Math.atan2(x - P.pos.x, z - P.pos.z);
    P.bodyYaw = P.yaw;
  };
  H.stand = (id, side, d, along = 0) => {
    const s = g.barriers.specs[id];
    const ax = s.axis === "x" ? 1 : 0;
    const az = s.axis === "z" ? 1 : 0;
    return { x: s.cx + s.nx * side * d + ax * along, z: s.cz + s.nz * side * d + az * along };
  };
  H.put = (obj, pt) => {
    obj.pos.set(pt.x, g.terrain.height(pt.x, pt.z), pt.z);
  };
  H.noisesOver = (r) => g.noises.filter((n) => n.radius >= r).length;
});

const run = async (name, fn) => {
  if (only !== "all" && !only.split(",").includes(name)) return;
  const t0 = Date.now();
  try {
    const out = await p.evaluate(fn);
    console.log(name, JSON.stringify(out), `(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  } catch (e) {
    console.log(name, "THREW", e.message.split("\n").slice(0, 6).join(" | "));
  }
};

// ---------------------------------------------------------------- H0 inventory of barriers
await run("H0", () => {
  const { g } = window.__h;
  const specs = g.barriers.specs;
  const by = {};
  for (const s of specs) by[`${s.kind}:${s.role}:${s.build}`] = (by[`${s.kind}:${s.role}:${s.build}`] ?? 0) + 1;
  const w = g.barriers.world.barriers;
  return {
    count: specs.length,
    by,
    open: w.filter((b) => b.open).length,
    bolted: w.filter((b) => b.bolted).length,
    brokenGlass: w.filter((b) => b.glass === "broken").length,
    preBoarded: w.filter((b) => b.boards.length).length,
    keypads: specs.filter((s) => s.keypad).length,
    armoryPin: w.find((b) => b.role === "armory")?.electronic?.pin,
    navCosted: specs.reduce((n, s) => n + g.barriers.slots[s.id].cells.length, 0),
  };
});

// ---------------------------------------------------------------- H1 open/close a house front door
await run("H1", () => {
  const H = window.__h;
  const { g } = H;
  H.clearZombies();
  const s = H.spec((x) => x.role === "house-front");
  const id = s.id;
  const P = g.player;
  g.barriers.world.barriers[id].open = false;
  g.barriers.world.barriers[id].bolted = false;
  g.barriers.syncAll();
  const out = { id, address: s.building, hinge: s.hinge, swingIn: s.swingIn };
  const out2 = H.stand(id, 1, 1.5);
  H.put(P, out2);
  H.face(P, s.cx, s.cz);
  H.step(0.2);
  const ray = () => {
    const o = H.stand(id, 1, 1.0);
    const d = H.stand(id, -1, 1.0);
    const dx = d.x - o.x, dz = d.z - o.z, L = Math.hypot(dx, dz);
    return +g.colliders.raycast(o.x, 1.0, o.z, dx / L, 0, dz / L, L).toFixed(2);
  };
  const los = () => {
    const o = H.stand(id, 1, 1.0);
    const d = H.stand(id, -1, 1.0);
    return g.colliders.lineOfSight(o.x, 1.5, o.z, d.x, 1.5, d.z);
  };
  out.closedRay = ray();
  out.closedLos = los();
  out.target = g.nearestInteractable();
  out.prompt = g.barrierPrompt(id, 1);
  g.noises = [];
  H.press("KeyE");
  H.step(1 / 30);
  out.openedState = g.barriers.world.barriers[id].open;
  out.openNoise = g.noises.map((n) => n.radius);
  H.step(1.0);
  out.openRay = ray();
  out.openLos = los();
  out.leafAngle = +g.barriers.slots[id].angle.toFixed(2);
  // Leaf corners: closed leaf must meet the jambs (check the matrix of the closed leaf)
  g.noises = [];
  H.press("KeyE");
  H.step(1 / 30);
  out.closeNoise = g.noises.map((n) => n.radius);
  H.step(1.0);
  out.closedAgainRay = ray();
  // Bolt from inside, try from outside
  H.put(P, H.stand(id, -1, 1.2));
  H.face(P, s.cx, s.cz);
  H.press("KeyQ");
  H.step(1 / 30);
  out.boltedFromInside = g.barriers.world.barriers[id].bolted;
  H.put(P, H.stand(id, 1, 1.2));
  H.face(P, s.cx, s.cz);
  H.press("KeyE");
  H.step(1 / 30);
  out.outsideTry = g.messages.at(-1)?.text;
  out.stillClosed = !g.barriers.world.barriers[id].open;
  // From inside: unbolt + open in one action (0.3 s)
  H.put(P, H.stand(id, -1, 1.2));
  H.face(P, s.cx, s.cz);
  H.press("KeyE");
  H.step(1 / 30);
  out.actionLabel = g.action?.label;
  H.step(0.5);
  out.openedFromInside = g.barriers.world.barriers[id].open && !g.barriers.world.barriers[id].bolted;
  // Can't close on yourself
  H.put(P, { x: s.cx, z: s.cz });
  H.press("KeyE");
  H.step(1 / 30);
  out.blockedClose = g.messages.at(-1)?.text;
  return out;
});

// ---------------------------------------------------------------- H2 siege timing
await run("H2", () => {
  const H = window.__h;
  const { g } = H;
  const P = g.player;
  const siege = (bolted, nz) => {
    H.clearZombies();
    const s = H.spec((x) => x.role === "house-front" && x.id > 5);
    const id = s.id;
    const B = g.barriers.world.barriers[id];
    Object.assign(B, { open: false, bolted, broken: false, damage: 0, boards: [] });
    g.barriers.syncAll();
    H.put(P, H.stand(id, -1, 2.5));
    P.crouching = true;
    const zs = g.zombies.slice(0, nz);
    zs.forEach((z, i) => {
      H.put(z, H.stand(id, 1, 8, (i - (nz - 1) / 2) * 1.2));
      z.state = "idle";
      z.hp = 100;
      z.alert(P.pos.clone(), 0.9);
    });
    let t = 0;
    let hits = 0;
    let firstHit = null;
    const orig = g.barriers.hit.bind(g.barriers);
    g.barriers.hit = (bid, dmg, side) => {
      if (bid === id) {
        hits++;
        if (firstHit === null) firstHit = t;
      }
      return orig(bid, dmg, side);
    };
    const dt = 1 / 30;
    let noiseT = 0;
    while (t < 200 && !B.broken) {
      // The survivor inside keeps shuffling about (a little noise every 2 s keeps them interested).
      noiseT += dt;
      if (noiseT > 2) {
        noiseT = 0;
        g.noises.push({ pos: P.pos.clone(), radius: 9, ttl: 0.4 });
      }
      H.step(dt, dt);
      t += dt;
      // Keep the player out of reach and alive.
      P.body.health = 100;
    }
    g.barriers.hit = orig;
    return { bolted, zombies: nz, burst: B.broken, total: +t.toFixed(1), firstHit: firstHit && +firstHit.toFixed(1), pounding: firstHit && +(t - firstHit).toFixed(1), hits, perSlotInterval: firstHit && +((t - firstHit) / hits * Math.min(nz, 2)).toFixed(2), states: zs.map((z) => `${z.state}/${z.breach}`) };
  };
  return [siege(false, 1), siege(true, 2)];
});

// ---------------------------------------------------------------- H3 silence ends the siege
await run("H3", () => {
  const H = window.__h;
  const { g } = H;
  const P = g.player;
  H.clearZombies();
  const s = H.spec((x) => x.role === "house-front" && x.id > 5);
  const id = s.id;
  const B = g.barriers.world.barriers[id];
  Object.assign(B, { open: false, bolted: true, broken: false, damage: 0, boards: [] });
  g.barriers.syncAll();
  H.put(P, H.stand(id, -1, 3));
  P.crouching = true;
  const z = g.zombies[0];
  H.put(z, H.stand(id, 1, 6));
  z.state = "idle";
  z.alert(P.pos.clone(), 0.9);
  let t = 0;
  let startedAt = null;
  let stoppedAt = null;
  while (t < 60) {
    H.step(1 / 30, 1 / 30);
    t += 1 / 30;
    if (z.breach !== null && startedAt === null) startedAt = t;
    if (startedAt !== null && z.breach === null && stoppedAt === null) stoppedAt = t;
  }
  return { startedAt: startedAt && +startedAt.toFixed(1), stoppedAt: stoppedAt && +stoppedAt.toFixed(1), doorDamage: B.damage, broken: B.broken, zState: z.state };
});


// ---------------------------------------------------------------- H4 windows: break, vault, zombie climb, shove-off
await run("H4", () => {
  const H = window.__h;
  const { g } = H;
  const P = g.player;
  H.clearZombies();
  const out = {};
  // A front window of a house that also has a front door on the same wall.
  const door = g.barriers.specs.find((d) => d.role === "house-front" && g.barriers.specs.some((w) => w.kind === "window" && w.building === d.building && w.nx === d.nx && w.nz === d.nz && Math.hypot(w.cx - d.cx, w.cz - d.cz) > 2.5));
  const win = g.barriers.specs.find((w) => w.kind === "window" && w.building === door.building && w.nx === door.nx && w.nz === door.nz && Math.hypot(w.cx - door.cx, w.cz - door.cz) > 2.5);
  const W = g.barriers.world.barriers[win.id];
  const D = g.barriers.world.barriers[door.id];
  Object.assign(W, { glass: "intact", boards: [], damage: 0 });
  Object.assign(D, { open: false, bolted: true, broken: false, boards: [], damage: 0 });
  g.barriers.syncAll();
  out.window = win.id;
  out.doorToWindow = +Math.hypot(win.cx - door.cx, win.cz - door.cz).toFixed(1);
  H.put(P, H.stand(win.id, 1, 1.0));
  H.face(P, win.cx, win.cz);
  H.step(0.1);
  out.prompt = g.barrierPrompt(win.id, 1);
  g.noises = [];
  H.press("KeyE");
  H.step(1 / 30);
  out.breakAction = g.action?.label;
  H.step(0.5);
  out.glass = W.glass;
  out.breakNoise = Math.max(0, ...g.noises.map((n) => n.radius));
  const m = new window.__THREE_M4();
  g.barriers.glass.getMatrixAt(g.barriers.slots[win.id].pane, m);
  out.paneHidden = m.elements.slice(0, 11).every((v) => Math.abs(v) < 1e-9);
  // Vault in
  const wounds0 = P.body.wounds.length;
  H.press("KeyE");
  H.step(1 / 30);
  out.traversing = P.traversing;
  const t = H.step(5, 1 / 30, () => !P.traversing);
  out.vaultSeconds = +(t + 1 / 30).toFixed(2);
  out.landedSide = g.barriers.sideOf(win.id, P.pos);
  out.landedDist = +Math.hypot(P.pos.x - win.cx, P.pos.z - win.cz).toFixed(2);
  out.cutRolls = P.body.wounds.length - wounds0;
  // Zombie: 3 m outside the broken window, the bolted door further along. Player inside.
  H.put(P, H.stand(win.id, -1, 2.0));
  P.crouching = false;
  P.body.health = 100;
  const z = g.zombies[0];
  H.put(z, H.stand(win.id, 1, 3.0, 0.4));
  z.hp = 100;
  z.state = "idle";
  z.alert(P.pos.clone(), 0.9);
  out.zDistDoor = +Math.hypot(z.pos.x - door.cx, z.pos.z - door.cz).toFixed(1);
  let tt = 0;
  let climbStart = null;
  let climbEnd = null;
  let engaged = null;
  while (tt < 30) {
    H.step(1 / 30, 1 / 30);
    tt += 1 / 30;
    P.body.health = 100;
    if (engaged === null && (z.breach !== null || z.clamber)) engaged = z.clamber ? `climb ${z.clamber.id}` : `breach ${z.breach}`;
    if (z.clamber && climbStart === null) climbStart = tt;
    if (climbStart !== null && !z.clamber && climbEnd === null) climbEnd = tt;
    if (climbEnd !== null && z.attacking) break;
  }
  out.zEngaged = engaged;
  out.zClimb = climbStart !== null && climbEnd !== null ? +(climbEnd - climbStart).toFixed(2) : null;
  out.zInside = g.barriers.sideOf(win.id, z.pos) === -1;
  out.zAttacking = z.attacking;
  // Shove-off: zombie climbing in, player hits it mid-climb.
  H.put(z, H.stand(win.id, 1, 1.0));
  z.state = "chase";
  z.breach = null;
  z.clamber = null;
  H.put(P, H.stand(win.id, -1, 0.9));
  H.face(P, win.cx, win.cz);
  let started = false;
  for (let i = 0; i < 120 && !started; i++) {
    H.step(1 / 30);
    started = !!z.clamber;
  }
  out.shoveClimbStarted = started;
  H.step(0.6);
  const startPos = z.clamber ? z.clamber.start.clone() : null;
  // Equip nothing: a punch counts. Swing at it.
  g.attackCooldown = 0;
  g.swingTime = 0;
  g.input.leftDown = true;
  H.step(0.4);
  g.input.leftDown = false;
  out.shoved = z.state === "down" && !z.clamber;
  out.backOutside = g.barriers.sideOf(win.id, z.pos) === 1;
  out.backAtStart = startPos ? +z.pos.distanceTo(startPos).toFixed(2) : null;
  return out;
});

// ---------------------------------------------------------------- H5 boarding
await run("H5", () => {
  const H = window.__h;
  const { g } = H;
  const P = g.player;
  H.clearZombies();
  const out = {};
  const win = g.barriers.specs.find((w) => w.kind === "window" && w.build === "pane" && g.barriers.world.barriers[w.id].glass === "intact" && !g.barriers.world.barriers[w.id].boards.length && w.id > 30);
  const W = g.barriers.world.barriers[win.id];
  g.inventory = g.inventory.filter((s) => !["hammer", "plank", "nails"].includes(s.id));
  g.addToInventory({ uid: 9001, id: "hammer", count: 1 });
  g.addToInventory({ uid: 9002, id: "plank", count: 3 });
  g.addToInventory({ uid: 9003, id: "nails", count: 12 });
  H.put(P, H.stand(win.id, -1, 1.0));
  H.face(P, win.cx, win.cz);
  H.step(0.1);
  out.prompt = g.barrierPrompt(win.id, -1);
  // Idle zombie 15 m away (outside)
  const z = g.zombies[0];
  H.put(z, H.stand(win.id, 1, 15));
  z.state = "idle";
  z.stateTimer = 999;
  z.awareness = 0;
  let hammerNoises = 0;
  const push = g.noises.push.bind(g.noises);
  const origPush = Array.prototype.push;
  H.press("KeyH");
  let t = 0;
  let heard = null;
  const dt = 1 / 30;
  while (t < 40) {
    const before = g.noises.length;
    g.update(dt);
    for (let i = before; i < g.noises.length; i++) if (g.noises[i].radius === 18) hammerNoises++;
    g.input.endFrame();
    g.input.down.add("KeyH");
    t += dt;
    if (heard === null && z.state !== "idle") heard = t;
    if (!g.action && W.boards.length >= 3) break;
  }
  H.release("KeyH");
  out.boards = W.boards.length;
  out.seconds = +t.toFixed(2);
  out.planks = g.countItem("plank");
  out.nails = g.countItem("nails");
  out.hammerNoises = hammerNoises;
  out.zombieHeardAt = heard && +heard.toFixed(1);
  out.occludesNow = g.barriers.slots[win.id].box.occludes;
  out.messages = g.messages.map((m) => m.text).slice(-2);
  // Pry one off
  H.press("KeyH");
  H.press("ShiftLeft");
  H.step(1 / 30);
  H.release("ShiftLeft");
  t = 0;
  while (t < 6 && (g.action || t < 0.1)) {
    g.update(dt);
    g.input.endFrame();
    g.input.down.add("KeyH");
    t += dt;
    if (W.boards.length === 2) break;
  }
  H.release("KeyH");
  out.pryBoardsLeft = W.boards.length;
  out.prySeconds = +t.toFixed(2);
  out.planksBack = g.countItem("plank");
  // Tearing order with boards outside: a zombie outside tears the boards, then the glass.
  H.clearZombies();
  Object.assign(W, { glass: "intact", boards: [{ hp: 300 }, { hp: 300 }], boardSide: 1, damage: 0 });
  g.barriers.syncAll();
  const seq = [];
  const orig = g.barrierEffects.bind(g);
  g.barrierEffects = (id, r, mat, src, side, byZ) => {
    if (id === win.id && (r.boardTorn || r.glassBroke)) seq.push(r.boardTorn ? "board" : "glass");
    return orig(id, r, mat, src, side, byZ);
  };
  H.put(P, H.stand(win.id, -1, 2.5));
  const zz = g.zombies[1];
  H.put(zz, H.stand(win.id, 1, 0.85));
  zz.hp = 100;
  zz.state = "idle";
  zz.alert(P.pos.clone(), 0.9);
  zz.breach = win.id;
  let n = 0;
  t = 0;
  while (t < 120 && seq.length < 3) {
    H.step(dt, dt);
    t += dt;
    if (++n % 60 === 0) g.noises.push({ pos: P.pos.clone(), radius: 9, ttl: 0.4 });
    P.body.health = 100;
  }
  out.outsideOrder = seq.join(">");
  out.outsideSeconds = +t.toFixed(1);
  // Inside boards: glass goes first, then the boards.
  H.clearZombies();
  seq.length = 0;
  Object.assign(W, { glass: "intact", boards: [{ hp: 300 }], boardSide: -1, damage: 0 });
  g.barriers.syncAll();
  H.put(zz, H.stand(win.id, 1, 0.85));
  zz.state = "idle";
  zz.alert(P.pos.clone(), 0.9);
  zz.breach = win.id;
  t = 0;
  n = 0;
  while (t < 120 && seq.length < 2) {
    H.step(dt, dt);
    t += dt;
    if (++n % 60 === 0) g.noises.push({ pos: P.pos.clone(), radius: 9, ttl: 0.4 });
    P.body.health = 100;
  }
  g.barrierEffects = orig;
  out.insideOrder = seq.join(">");
  return out;
});

// ---------------------------------------------------------------- H6 police access control
await run("H6", () => {
  const H = window.__h;
  const { g } = H;
  const P = g.player;
  H.clearZombies();
  const out = {};
  const police = g.town.buildings.find((b) => b.type === "police");
  const front = g.barriers.specs.find((s) => s.role === "police-front");
  const armory = g.barriers.specs.find((s) => s.role === "armory");
  const A = g.barriers.world.barriers[armory.id];
  const F = g.barriers.world.barriers[front.id];
  out.armoryLockedAtStart = !A.open && g.barriers.accessRows("cpd-acs").find((r) => r.name === "armory").locked;
  out.frontLockedAtStart = g.barriers.accessRows("cpd-acs").find((r) => r.name === "front").locked;
  // Try the armory door from the main room: locked.
  H.put(P, H.stand(armory.id, 1, 1.0));
  H.face(P, armory.cx, armory.cz);
  H.step(0.1);
  out.armoryTarget = g.nearestInteractable()?.type;
  g.useBarrier(armory.id, 1);
  out.armoryTry = g.messages.at(-1)?.text;
  // Dispatch terminal: log in, scan, ssh to the controller, unlock.
  const pc = police.computer;
  H.put(P, { x: pc.x, z: pc.z + 0.5 });
  g.useComputer(pc);
  const say = (l) => g.computerSubmit(l);
  say(pc.state.def.users[0].name);
  say(pc.state.def.users[0].password);
  say("nmap -sn 10.0.4.0/24");
  out.nmap = pc.state.screen.filter((l) => /cpd-acs|hosts up/.test(l));
  say("ssh admin@10.0.4.40");
  say("yes");
  say("admin");
  say("door list");
  out.doorList = pc.state.screen.slice(-6);
  say("door unlock armory");
  out.unlockReply = pc.state.screen.slice(-2);
  g.closeUi(false);
  out.armoryUnlocked = !g.barriers.accessRows("cpd-acs").find((r) => r.name === "armory").locked;
  H.put(P, H.stand(armory.id, 1, 1.0));
  H.face(P, armory.cx, armory.cz);
  g.useBarrier(armory.id, 1);
  H.step(1);
  out.armoryOpened = A.open;
  // Lock again (it's open → locks when closed), close it, and lock the front for a safehouse.
  g.useComputer(pc);
  say("door lock armory");
  out.lockOpenReply = pc.state.screen.slice(-2);
  say("door lock front");
  g.closeUi(false);
  H.put(P, H.stand(armory.id, 1, 1.2));
  g.useBarrier(armory.id, 1);
  H.step(1);
  out.armoryClosedLocked = !A.open && g.barriers.accessRows("cpd-acs").find((r) => r.name === "armory").locked;
  out.frontLockedNow = g.barriers.accessRows("cpd-acs").find((r) => r.name === "front").locked;
  // Keypad with power: wrong x5 → lockout; then right after lockout → granted.
  const pin = A.electronic.pin;
  H.put(P, { x: armory.keypad.x + armory.keypad.nx * 0.7, z: armory.keypad.z + armory.keypad.nz * 0.7 });
  H.face(P, armory.keypad.x, armory.keypad.z);
  H.step(0.05);
  out.keypadTarget = g.nearestInteractable()?.type;
  g.openKeypad(armory.id);
  const enter = (code) => {
    for (const c of code) g.keypadPress(c);
    g.keypadPress("#");
    return g.keypadStatus;
  };
  out.wrong = [enter("0000"), enter("1111"), enter("2222"), enter("3333"), enter("4444")];
  out.rightDuringLockout = enter(pin);
  A.electronic.lockoutLeft = 0;
  out.right = enter(pin);
  out.keypadClosedOnGrant = g.keypadId === null;
  out.armoryPulse = !g.barriers.accessRows("cpd-acs").find((r) => r.name === "armory").locked;
  H.step(7);
  out.relockedAfterPulse = g.barriers.accessRows("cpd-acs").find((r) => r.name === "armory").locked;
  // Power: grid fails, UPS runs flat.
  const failAt = g.elec.world.gridFailsAt;
  H.put(P, { x: (police.rect.minX + police.rect.maxX) / 2, z: (police.rect.minZ + police.rect.maxZ) / 2 });
  g.minutes = failAt - 1;
  H.step(0.1);
  g.minutes = failAt + 1;
  H.step(0.1);
  out.onUps = g.elec.statusOf(police)?.source;
  out.frontLockedOnUps = g.barriers.accessRows("cpd-acs").find((r) => r.name === "front").locked;
  g.messages = [];
  for (let i = 0; i < 10 * 60; i++) {
    g.minutes += 1;
    g.updateElectricity(0, 1);
  }
  out.afterUps = g.elec.statusOf(police)?.source;
  out.frontReleased = !g.barriers.accessRows("cpd-acs").find((r) => r.name === "front").locked;
  out.armoryStillLocked = g.barriers.accessRows("cpd-acs").find((r) => r.name === "armory").locked;
  out.clunkMsg = g.messages.map((m) => m.text);
  out.acsUp = g.deviceUp(police.network, "10.0.4.40");
  g.messages = [];
  g.openKeypad(armory.id);
  out.keypadDark = g.messages.at(-1)?.text;
  // A zombie inside walks out through the released front door (pushable from inside).
  g.noises = [];
  const z = g.zombies[0];
  H.put(z, H.stand(front.id, -1, 3));
  z.hp = 100;
  H.put(P, H.stand(front.id, 1, 9));
  z.state = "idle";
  z.alert(P.pos.clone(), 0.9);
  let t = 0;
  const trace = [];
  let fr = 0;
  while (t < 15 && !F.open) {
    H.step(1 / 30, 1 / 30);
    t += 1 / 30;
    P.body.health = 100;
    for (const n of g.noises) if (Math.hypot(n.pos.x - front.cx, n.pos.z - front.cz) < 4 && trace.length < 40) trace.push(`  noise r=${n.radius} at ${n.pos.x.toFixed(1)},${n.pos.z.toFixed(1)} ttl=${n.ttl.toFixed(2)} lure=${!!n.lure}`);
    if (fr++ % 30 === 0) trace.push(`${t.toFixed(1)} ${z.state} b=${z.breach} c=${!!z.clamber} side=${g.barriers.sideOf(front.id, z.pos)} d=${Math.hypot(z.pos.x - front.cx, z.pos.z - front.cz).toFixed(2)} acc=${g.barriers.access(front.id, -1)} tgt=${z.target.x.toFixed(1)},${z.target.z.toFixed(1)}`);
  }
  out.pushTrace = trace;
  out.zombiePushedFrontOpen = F.open;
  out.pushSeconds = +t.toFixed(1);
  H.clearZombies();
  F.open = false;
  g.barriers.syncAll();
  // Refuel and start the standby generator: controller back; front re-locks (it was commanded locked).
  const standby = g.elec.generators.find((x) => !x.gen.portable && x.gen.buildingId === police.address);
  g.inventory.push({ uid: 8801, id: "jerry_can", count: 1, fuel: 20 });
  H.put(P, { x: standby.x, z: standby.z + 1 });
  g.openGenerator(standby);
  g.generatorAction("refuel");
  g.generatorAction("start");
  g.closeUi(false);
  g.updateElectricity(0, 1);
  out.onGenerator = g.elec.statusOf(police)?.source;
  out.frontRelocked = g.barriers.accessRows("cpd-acs").find((r) => r.name === "front").locked;
  out.acsUpAgain = g.deviceUp(police.network, "10.0.4.40");
  H.put(P, { x: armory.keypad.x + armory.keypad.nx * 0.7, z: armory.keypad.z + armory.keypad.nz * 0.7 });
  g.openKeypad(armory.id);
  out.grantOnGenerator = enter(pin);
  return out;
});

// ---------------------------------------------------------------- H8 determinism and save round-trip
await run("H8", () => {
  const H = window.__h;
  const { g } = H;
  g.start();
  g.locked = true;
  g.renderer.setAnimationLoop(null);
  const a = JSON.stringify(g.barriers.world);
  g.start();
  g.locked = true;
  g.renderer.setAnimationLoop(null);
  const b = JSON.stringify(g.barriers.world);
  const flags = () => ({
    col: g.barriers.slots.map((s) => [g.colliders.boxes[s.collider].enabled !== false, s.box.occludes].join()).join("|"),
    cost: Array.from(g.nav.cost).reduce((h, v, i) => (h * 31 + v * (i + 1)) % 1000000007, 7),
  });
  // Scripted changes, save, more changes, restore.
  const w = g.barriers.world.barriers;
  const door = w.find((x) => x.role === "house-front");
  g.barriers.open(door.id, 1);
  const win = w.find((x) => x.kind === "window" && x.glass === "intact");
  g.barriers.breakGlass(win.id);
  g.barriers.board(win.id, -1);
  const saved = JSON.stringify(g.barriers.world);
  const before = flags();
  g.barriers.close(door.id);
  g.barriers.board(win.id, -1);
  g.barriers.board(win.id, -1);
  const changed = flags();
  g.barriers.world = JSON.parse(saved);
  g.barriers.syncAll();
  const after = flags();
  return { sameStart: a === b, changedDiffers: changed.col !== before.col && changed.cost !== before.cost, restoredCollidersMatch: after.col === before.col, restoredNavMatches: after.cost === before.cost };
});


// ---------------------------------------------------------------- H9 no interacting through walls
await run("H9", () => {
  const H = window.__h;
  const { g } = H;
  const P = g.player;
  H.clearZombies();
  const out = { cases: [] };
  // Bedroom doors close to a side wall: stand outside that wall, facing the door through it.
  for (const s of g.barriers.specs.filter((x) => x.role === "interior").slice(0, 12)) {
    const b = g.town.buildings.find((bb) => bb.address === s.building);
    const r = b.rect;
    const dl = s.cx - r.minX;
    const dr = r.maxX - s.cx;
    const dzMin = s.cz - r.minZ;
    const dzMax = r.maxZ - s.cz;
    const m = Math.min(dl, dr, dzMin, dzMax);
    let pt;
    if (m === dl) pt = { x: r.minX - 0.45, z: s.cz };
    else if (m === dr) pt = { x: r.maxX + 0.45, z: s.cz };
    else if (m === dzMin) pt = { x: s.cx, z: r.minZ - 0.45 };
    else pt = { x: s.cx, z: r.maxZ + 0.45 };
    H.put(P, pt);
    H.face(P, s.cx, s.cz);
    const d = Math.hypot(s.cx - pt.x, s.cz - pt.z);
    const t = g.nearestInteractable();
    out.cases.push({ id: s.id, dist: +d.toFixed(2), target: t ? `${t.type}${t.id !== undefined ? ":" + t.id : ""}` : null });
  }
  out.throughWall = out.cases.filter((c) => c.target === `barrier:${c.id}`).length;
  // The armory corner: in the main room just past the armory's side wall, 1.7 m from its door.
  const arm = g.barriers.specs.find((x) => x.role === "armory");
  const al = { x: arm.axis === "x" ? 1 : 0, z: arm.axis === "z" ? 1 : 0 };
  const sign = Math.sign((arm.keypad.x - arm.cx) * al.x + (arm.keypad.z - arm.cz) * al.z);
  const corner = { x: arm.cx + al.x * sign * 1.55 - arm.nx * 0.75, z: arm.cz + al.z * sign * 1.55 - arm.nz * 0.75 };
  H.put(P, corner);
  H.face(P, arm.cx, arm.cz);
  const ct = g.nearestInteractable();
  out.armoryCorner = { dist: +Math.hypot(arm.cx - corner.x, arm.cz - corner.z).toFixed(2), target: ct ? `${ct.type}${ct.id !== undefined ? ":" + ct.id : ""}` : null, armoryId: arm.id };
  // Containers inside a building from outside its wall.
  let through = 0;
  let tried = 0;
  for (const c of g.town.containers.slice(0, 120)) {
    const b = g.town.buildings.find((bb) => c.x > bb.rect.minX && c.x < bb.rect.maxX && c.z > bb.rect.minZ && c.z < bb.rect.maxZ);
    if (!b) continue;
    const r = b.rect;
    const opts = [
      { d: c.x - r.minX, p: { x: r.minX - 0.4, z: c.z } },
      { d: r.maxX - c.x, p: { x: r.maxX + 0.4, z: c.z } },
      { d: c.z - r.minZ, p: { x: c.x, z: r.minZ - 0.4 } },
      { d: r.maxZ - c.z, p: { x: c.x, z: r.maxZ + 0.4 } },
    ].sort((a, b2) => a.d - b2.d);
    if (opts[0].d > 1.2) continue;
    tried++;
    H.put(P, opts[0].p);
    H.face(P, c.x, c.z);
    const t = g.nearestInteractable();
    if (t?.type === "container" && t.container === c) through++;
  }
  out.containersThroughWalls = `${through}/${tried}`;
  // Sanity: the same doors are still usable from inside, 1 m away.
  let ok = 0;
  for (const c of out.cases) {
    const p0 = H.stand(c.id, 1, 1.0);
    H.put(P, p0);
    H.face(P, g.barriers.specs[c.id].cx, g.barriers.specs[c.id].cz);
    const t = g.nearestInteractable();
    if (t?.type === "barrier" && t.id === c.id) ok++;
  }
  out.usableFromInside = `${ok}/${out.cases.length}`;
  return out;
});


// ---------------------------------------------------------------- H10 hiding right behind a glass door doesn't work
await run("H10", () => {
  const H = window.__h;
  const { g } = H;
  const P = g.player;
  H.clearZombies();
  const s = g.barriers.specs.find((x) => x.role === "shopfront");
  const B = g.barriers.world.barriers[s.id];
  Object.assign(B, { open: false, broken: false, bolted: true, glass: "intact", damage: 0, boards: [] });
  g.barriers.syncAll();
  H.put(P, H.stand(s.id, -1, 0.7));
  P.crouching = false;
  const z = g.zombies[0];
  H.put(z, H.stand(s.id, 1, 4));
  z.hp = 100;
  z.state = "chase";
  z.awareness = 1.2;
  let t = 0;
  let breachAt = null;
  let attackedAt = null;
  let hits = 0;
  const orig = g.onZombieAttack.bind(g);
  g.onZombieAttack = (zz) => {
    hits++;
    if (attackedAt === null) attackedAt = t;
  };
  while (t < 90 && attackedAt === null) {
    H.step(1 / 30, 1 / 30);
    t += 1 / 30;
    P.body.health = 100;
    if (breachAt === null && z.breach !== null) breachAt = t;
  }
  g.onZombieAttack = orig;
  return { breachAt: breachAt && +breachAt.toFixed(1), burst: B.broken, attackedAt: attackedAt && +attackedAt.toFixed(1), zState: z.state, dist: +z.pos.distanceTo(P.pos).toFixed(2) };
});

console.log("errors:", errs.length ? errs.slice(0, 8) : "none");
await b.close();
