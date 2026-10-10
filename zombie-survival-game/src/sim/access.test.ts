import { describe, expect, it } from "vitest";
import { boot, createComputerState, isSecretInput, prompt, submit, type ComputerContext, type ComputerEffect, type VDir, type VFile } from "./computer";
import { gameDate, houseLaptop, pinFrom, policeComputer, storeComputer, type TownFacts } from "./computerContent";
import { resolveHost, type AccessDoorStatus, type AccessView } from "./network";
import { mulberry32 } from "./rng";

const facts: TownFacts = { policeAddress: "2 Main Street", stashAddress: "17 Oak Avenue", powerOffDay: 4 };

/**
 * The dispatch terminal with a stand-in for the game's door system: effects
 * drained after each submit move the fake locks, the way Game.computerSubmit will.
 */
function setup(down: string[] = []) {
  const g = policeComputer(facts, mulberry32(7));
  const doors: Record<string, AccessDoorStatus> = {
    front: { name: "front", label: "Lobby entrance", mode: "maglock", commanded: "unlocked", locked: false, open: false },
    armory: { name: "armory", label: "Armory", mode: "strike", commanded: "locked", locked: true, open: false },
  };
  const power: ReturnType<AccessView["power"]> = { source: "mains", upsPercent: 100 };
  const access: AccessView = { controller: "cpd-acs", doors: () => Object.values(doors).map((d) => ({ ...d })), power: () => ({ ...power }) };
  const applied: ComputerEffect[] = [];
  const s = createComputerState(g.def, null);
  const ctx = (): ComputerContext => ({
    nowMs: 0,
    dateText: gameDate(1, 480),
    uptimeMinutes: 5,
    network: { spec: g.network, selfIp: g.def.net!.ip, isUp: (ip) => !down.includes(ip) },
    access,
  });
  boot(s, ctx());
  submit(s, "dispatch", ctx());
  submit(s, g.def.users[0].password!, ctx());
  const run = (line: string) => {
    const before = s.screen.length;
    submit(s, line, ctx());
    for (const fx of s.effects.splice(0)) {
      applied.push(fx);
      if (fx.type !== "door") continue;
      const d = doors[fx.door];
      d.commanded = fx.action === "lock" ? "locked" : "unlocked";
      d.locked = d.commanded === "locked" && !d.open;
    }
    return s.screen.slice(before + 1);
  };
  const sshAcs = (password = "admin") => {
    run("ssh admin@cpd-acs");
    run("yes");
    return run(password);
  };
  return { s, g, run, sshAcs, doors, power, applied, down };
}

describe("pinFrom", () => {
  it("is FNV-1a mod 9000 + 1000", () => {
    expect(pinFrom("")).toBe("8261"); // 0x811c9dc5 = 2166136261
    expect(pinFrom("a")).toBe("4220"); // 0xe40c292c = 3826002220
    for (let i = 0; i < 200; i++) expect(pinFrom(`x${i}`)).toMatch(/^[1-9]\d{3}$/);
  });
});

describe("cpd-acs door controller", () => {
  it("is on the police LAN with its access metadata", () => {
    const { g } = setup();
    const h = resolveHost(g.network, "cpd-acs")!;
    expect(h.ip).toBe("10.0.4.40");
    expect(h.kind).toBe("controller");
    expect(h.vendor).toBe("VistaGuard Security");
    expect(h.services.map((sv) => sv.port)).toEqual([22, 80]);
    expect(h.access!.doors.map((d) => [d.name, d.mode])).toEqual([
      ["front", "maglock"],
      ["armory", "strike"],
    ]);
    expect(h.access!.doors[0].pin).toBeNull();
  });

  it("serves a static web login", () => {
    const { run } = setup();
    expect(run("curl http://cpd-acs/").join("\n")).toContain("VistaGuard ACS-4 Login");
  });

  it("takes the factory login over ssh and refuses a wrong one", () => {
    const ok = setup();
    const out = ok.sshAcs().join("\n");
    expect(out).toContain("Welcome to VistaGuard ACS-4 firmware 2.3.1 (BusyBox)");
    expect(out).not.toContain("Ubuntu");
    expect(out).toContain("VistaGuard ACS-4 door controller — 2 doors. Type 'door'.");
    expect(prompt(ok.s)).toBe("admin@cpd-acs:~$ ");

    const bad = setup();
    bad.run("ssh admin@cpd-acs");
    bad.run("yes");
    for (let i = 0; i < 3; i++) {
      expect(isSecretInput(bad.s)).toBe(true);
      bad.run("password");
    }
    expect(bad.s.screen.join("\n")).toContain("admin@cpd-acs: Permission denied (publickey,password)");
    expect(bad.s.remote).toBeNull();
  });

  it("keeps the Ubuntu banner for Ubuntu hosts", () => {
    const { run } = setup();
    run("ssh dispatch@cpd-files");
    run("yes");
    const g = policeComputer(facts, mulberry32(7));
    expect(run(g.def.users[0].password!)[0]).toBe("Welcome to Ubuntu 20.04.6 LTS (GNU/Linux 5.4.0-88-generic x86_64)");
  });

  it("prints usage for a bare 'door'", () => {
    const { sshAcs, run } = setup();
    sshAcs();
    const out = run("door").join("\n");
    expect(out).toContain("usage: door list");
    expect(out).toContain("door pulse <door>");
  });

  it("lists both doors with their fail modes and the power source", () => {
    const { sshAcs, run, power } = setup();
    sshAcs();
    const list = run("door list");
    expect(list[0]).toBe("VistaGuard ACS-4 fw 2.3.1  AC: OK");
    expect(list[2]).toMatch(/^DOOR\s+LOCK\s+ON POWER LOSS\s+COMMAND\s+STATE$/);
    const front = list.find((l) => l.startsWith("front "))!;
    const armory = list.find((l) => l.startsWith("armory "))!;
    expect(front).toMatch(/maglock\s+releases \(fail-safe\)\s+unlocked\s+closed, unlocked$/);
    expect(armory).toMatch(/strike\s+stays locked \(fail-secure\)\s+locked\s+closed, locked$/);

    power.source = "ups";
    power.upsPercent = 63.4;
    expect(run("door list")[0]).toBe("VistaGuard ACS-4 fw 2.3.1  AC: FAIL  UPS 63%");
  });

  it("'door unlock armory' reaches the game through the ssh session", () => {
    const { s, sshAcs, run, applied } = setup();
    sshAcs();
    expect(run("door unlock armory")).toEqual(["armory: unlock accepted (strike released)"]);
    // Raised on the remote session, collected by the dispatch terminal the game reads.
    expect(applied).toEqual([{ type: "door", controller: "cpd-acs", door: "armory", action: "unlock" }]);
    expect(s.remote!.effects).toHaveLength(0);
    expect(run("door list").find((l) => l.startsWith("armory "))).toMatch(/\s+unlocked\s+closed, unlocked$/);
    expect(run("door pulse front")).toEqual(["front: pulse accepted (maglock released momentarily)"]);
    expect(run("door lock armory")).toEqual(["armory: lock accepted (strike engaged)"]);
    expect(applied.map((fx) => fx.type === "door" && fx.action)).toEqual(["unlock", "pulse", "lock"]);
  });

  it("works through a nested session (dispatch → cpd-files → cpd-acs)", () => {
    const { g, run, applied } = setup();
    run("ssh dispatch@cpd-files");
    run("yes");
    run(g.def.users[0].password!);
    run("ssh admin@cpd-acs");
    run("yes");
    run("admin");
    run("door unlock front");
    expect(applied).toEqual([{ type: "door", controller: "cpd-acs", door: "front", action: "unlock" }]);
  });

  it("warns when locking an open door, and rejects unknown doors", () => {
    const { sshAcs, run, doors, applied } = setup();
    sshAcs();
    doors.front.open = true;
    expect(run("door lock front")).toEqual(["front: will lock when closed"]);
    expect(run("door list").find((l) => l.startsWith("front "))).toContain("open (held-open alarm)");
    applied.length = 0;
    expect(run("door unlock vault")).toEqual(["door: no such door 'vault'"]);
    expect(run("door unlock")).toEqual(["usage: door unlock <door>"]);
    expect(run("door open armory")[0]).toBe("door: unknown command 'open'");
    expect(applied).toHaveLength(0);
  });

  it("falls back to canned output when the game supplies no access view", () => {
    const g = policeComputer(facts, mulberry32(7));
    const acs = resolveHost(g.network, "cpd-acs")!.def!;
    const s = createComputerState(acs, null);
    const ctx: ComputerContext = { nowMs: 0, dateText: gameDate(1, 480), uptimeMinutes: 5 };
    s.phase = "login";
    submit(s, "admin", ctx);
    submit(s, "admin", ctx);
    submit(s, "door list", ctx);
    expect(s.screen.at(-1)).toBe("door: /dev/ttyS1: no response from door bus");
    expect(s.effects).toHaveLength(0);
  });

  it("is unreachable without power, and an open session drops when it dies", () => {
    const off = setup(["10.0.4.40"]);
    expect(off.run("ssh admin@cpd-acs")[0]).toBe("ssh: connect to host cpd-acs port 22: No route to host");

    const live = setup();
    live.sshAcs();
    live.down.push("10.0.4.40");
    expect(live.run("door unlock armory")).toEqual(["client_loop: send disconnect: Broken pipe", ""]);
    expect(live.applied).toHaveLength(0);
    expect(live.s.remote).toBeNull();
    expect(prompt(live.s)).toBe("dispatch@cpd-dispatch-01:~$ ");
  });

  it("doors.conf holds the armory PIN derived from the dispatch password and Walsh's badge", () => {
    const { g, sshAcs, run } = setup();
    sshAcs();
    const password = g.def.users[0].password!;
    const badge = g.def.users[1].password!.match(/^walsh(\d{4})!$/)![1];
    const pin = pinFrom(`${password}:${badge}`);
    const conf = run("cat /etc/acs/doors.conf").join("\n");
    expect(conf).toContain(`pin=${pin}`);
    expect(conf).toContain("fail-safe: releases on power loss (egress)");
    expect(conf).toContain("fail-secure");
    expect(resolveHost(g.network, "cpd-acs")!.access!.doors.find((d) => d.name === "armory")!.pin).toBe(pin);
    const log = run("cat /var/log/acs/events.log").join("\n");
    expect(log).toContain("Oct 09 17:55 front LOCKDOWN FAILED: door held open");
    expect(log).toContain('Oct 09 18:24 front UNLOCK admin "left open for returning units - MO"');
    expect(log).toContain("Oct 09 18:25 armory LOCKED");
  });
});

describe("clues to the controller", () => {
  it("the file server has the quick start manual and the network diagram entry", () => {
    const { g, run } = setup();
    run("ssh dispatch@cpd-files");
    run("yes");
    run(g.def.users[0].password!);
    const manual = run("cat /srv/shared/manuals/VistaGuard_ACS-4_QuickStart.txt").join("\n");
    expect(manual).toContain("Default login admin / admin (ssh and web). CHANGE THIS.");
    expect(manual).toMatch(/maglock\) = FAIL-SAFE/);
    expect(manual).toMatch(/strike = FAIL-SECURE/);
    expect(manual).toContain("lever on the inside always opens the door");
    expect(run("cat /srv/shared/network_diagram.txt").join("\n")).toMatch(/10\.0\.4\.40\s+cpd-acs\s+door controller \(VistaGuard ACS-4\)/);
  });

  it("IT mail and the dispatch log point at it, without giving the PIN away", () => {
    const { g, run } = setup();
    const mail = run("mail 4").join("\n");
    expect(mail).toContain("door controller cpd-acs (10.0.4.40)");
    expect(mail).toContain("Armory code is set on the controller — ask the Chief.");
    const conf = (((resolveHost(g.network, "cpd-acs")!.def!.fs.children.etc as VDir).children.acs as VDir).children["doors.conf"] as VFile).content;
    expect(mail).not.toContain(conf.match(/pin=(\d+)/)![1]);
    expect(run("dispatch").join("\n")).toContain("10/09 17:55  SYSTEM    LOCKDOWN FAILED: front entrance held open");
    expect(run("cat /etc/hosts").join("\n")).toContain("10.0.4.40\tcpd-acs");
  });
});

describe("content rng stream", () => {
  // Captured before the controller was added: policeComputer must consume exactly
  // the same draws, so every later machine keeps its passwords and content.
  const SNAPSHOT = [
    { seed: 7, police: ["harbor09", "walsh6544!"], after: 0.23992518591694534, others: [["corner-foods-pos", "manager", "admin"], ["barlow-hardware-pos", "counter", "1234"], ["jen-laptop", "jen", "milo2019"], ["luis-laptop", "luis", "max123"], ["rachel-laptop", "rachel", null], ["daniel-laptop", "daniel", "milo!"]] },
    { seed: 1987, police: ["harbor15", "walsh8370!"], after: 0.8698230017907917, others: [["kwik-mart-pos", "manager", "admin"], ["ace-tools-supply-pos", "counter", "1234"], ["erin-laptop", "erin", null], ["amy-laptop", "amy", null], ["omar-laptop", "omar", null], ["chris-laptop", "chris", "pepper2019"]] },
    { seed: 42, police: ["granite48", "walsh6152!"], after: 0.6247446539346129, others: [["pickett-s-market-pos", "manager", "admin"], ["ace-tools-supply-pos", "counter", "1234"], ["jen-laptop", "jen", "daisy2019"], ["daniel-laptop", "daniel", "biscuit2019"], ["tom-laptop", "tom", "luna2019"], ["chris-laptop", "chris", "milo123"]] },
  ];

  it("other machines' passwords are unchanged", () => {
    for (const snap of SNAPSHOT) {
      const rng = mulberry32(snap.seed);
      const p = policeComputer(facts, rng);
      expect(p.def.users.map((u) => u.password)).toEqual(snap.police);
      // The very next draw proves the police machine consumed nothing extra.
      const after = rng();
      expect(after).toBe(snap.after);
      const others = [
        storeComputer(facts, rng, "store", "40 Main Street"),
        storeComputer(facts, rng, "hardware", "3 Pine Street"),
        houseLaptop(facts, rng, "9 Pine Street"),
        houseLaptop(facts, rng, "11 Oak Avenue"),
        houseLaptop(facts, rng, "5 Elm Road"),
        houseLaptop(facts, rng, "21 Birch Lane"),
      ];
      expect(others.map((g) => [g.def.hostname, g.def.users[0].name, g.def.users[0].password])).toEqual(snap.others);
    }
  });
});
