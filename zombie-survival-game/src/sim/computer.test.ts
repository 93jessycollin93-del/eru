import { describe, expect, it } from "vitest";
import { boot, complete, createComputerState, prompt, submit, type ComputerState } from "./computer";
import { gameDate, houseLaptop, policeComputer, storeComputer, type TownFacts } from "./computerContent";
import { mulberry32 } from "./rng";

const facts: TownFacts = { policeAddress: "2 Main Street", stashAddress: "17 Oak Avenue", powerOffDay: 4 };
let now = 0;
const ctx = () => ({ nowMs: now, dateText: gameDate(1, 8 * 60), uptimeMinutes: 12 });

function police(): { s: ComputerState; password: string } {
  const g = policeComputer(facts, mulberry32(7));
  const s = createComputerState(g.def, g.battery);
  boot(s, ctx());
  return { s, password: g.def.users[0].password! };
}

/** Run a command and return only the new output lines. */
function run(s: ComputerState, line: string): string[] {
  const before = s.screen.length;
  submit(s, line, ctx());
  return s.screen.slice(before + 1);
}

function login(s: ComputerState, user: string, pass: string) {
  submit(s, user, ctx());
  submit(s, pass, ctx());
}

describe("login", () => {
  it("boots to a login prompt and accepts the right password", () => {
    const { s, password } = police();
    expect(prompt(s)).toBe("cpd-dispatch-01 login: ");
    login(s, "dispatch", password);
    expect(s.phase).toBe("shell");
    expect(prompt(s)).toBe("dispatch@cpd-dispatch-01:~$ ");
  });

  it("rejects a wrong password and locks out after three tries", () => {
    const { s, password } = police();
    for (let i = 0; i < 3; i++) login(s, "dispatch", "wrong");
    expect(s.screen.join("\n")).toContain("Account locked");
    login(s, "dispatch", password);
    expect(s.phase).not.toBe("shell");
    now += 31_000;
    login(s, "dispatch", password);
    expect(s.phase).toBe("shell");
  });

  it("the password is on the note hidden in the building", () => {
    const g = policeComputer(facts, mulberry32(7));
    expect(g.note?.text).toContain(g.def.users[0].password!);
  });
});

describe("shell", () => {
  const ready = () => {
    const { s, password } = police();
    login(s, "dispatch", password);
    return s;
  };

  it("lists, changes directory and prints files", () => {
    const s = ready();
    expect(run(s, "ls")).toEqual(["Mail/  reports/"]);
    run(s, "cd reports");
    expect(run(s, "pwd")).toEqual(["/home/dispatch/reports"]);
    expect(run(s, "cat incident_1003_oak.txt").join("\n")).toContain("bit Ptl. Danner");
    expect(run(s, "ls -l")[0]).toBe("total 12");
  });

  it("supports pipes into grep, head and wc", () => {
    const s = ready();
    const hits = run(s, "cat reports/incident_1006_main.txt | grep -i bite");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((l) => /bite/i.test(l))).toBe(true);
    expect(run(s, "cat reports/incident_1009_station.txt | head -n 2")).toHaveLength(2);
    expect(run(s, "cat reports/incident_1009_station.txt | wc -l")[0]).toMatch(/^\d+$/);
  });

  it("enforces permissions on other users' private files", () => {
    const s = ready();
    expect(run(s, "ls /home/chief.walsh")[0]).toContain("Permission denied");
    expect(run(s, "cat /etc/shadow")[0]).toContain("Permission denied");
  });

  it("reads mail, which leads to the supply cache", () => {
    const s = ready();
    const list = run(s, "mail");
    expect(list[0]).toContain("4 messages");
    expect(run(s, "mail 3").join("\n")).toContain("17 Oak Avenue");
    expect(run(s, "mail 2").join("\n")).toContain("06:00");
  });

  it("runs programs from /usr/local/bin", () => {
    const s = ready();
    expect(run(s, "dispatch").join("\n")).toContain("CAD");
    expect(run(s, "nonsense")[0]).toBe("nonsense: command not found");
  });

  it("finds files by name and completes paths with Tab", () => {
    const s = ready();
    expect(run(s, "find / -name '*1009*'").some((l) => l.endsWith("incident_1009_station.txt"))).toBe(true);
    expect(complete(s, "cat rep")).toBe("cat reports/");
    expect(complete(s, "disp")).toBe("dispatch ");
  });

  it("logs out and shuts down", () => {
    const s = ready();
    run(s, "logout");
    expect(s.phase).toBe("login");
    login(s, "dispatch", s.def.users[0].password!);
    run(s, "shutdown");
    expect(s.phase).toBe("off");
  });
});

describe("other machines", () => {
  it("house laptops have personal files and photos that can't be printed", () => {
    for (let seed = 1; seed < 6; seed++) {
      const g = houseLaptop(facts, mulberry32(seed), "9 Pine Street");
      const s = createComputerState(g.def, g.battery);
      boot(s, ctx());
      const u = g.def.users[0];
      login(s, u.name, u.password ?? "");
      if (u.password === null) submit(s, "", ctx());
      expect(s.phase).toBe("shell");
      expect(run(s, "cat Documents/journal.txt").join("\n")).toContain("Oct 4");
      const pic = Object.keys((g.def.fs.children.home as any).children[u.name].children.Pictures.children)[0];
      expect(run(s, `cat Pictures/${pic}`)[0]).toContain("binary file");
      expect(g.battery).toBeGreaterThan(0);
    }
  });

  it("store terminals show stock levels", () => {
    const g = storeComputer(facts, mulberry32(3), "store", "40 Main Street");
    const s = createComputerState(g.def, null);
    boot(s, ctx());
    login(s, "manager", "admin");
    expect(run(s, "inventory").join("\n")).toContain("BACK ROOM");
  });
});
