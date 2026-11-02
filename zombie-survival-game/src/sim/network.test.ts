import { describe, expect, it } from "vitest";
import { boot, createComputerState, isSecretInput, prompt, submit, type ComputerContext, type ComputerState } from "./computer";
import { gameDate, houseLaptop, policeComputer, type TownFacts } from "./computerContent";
import { mulberry32 } from "./rng";

const facts: TownFacts = { policeAddress: "2 Main Street", stashAddress: "17 Oak Avenue", powerOffDay: 4 };

function setup(down: string[] = []) {
  const g = policeComputer(facts, mulberry32(7));
  const s = createComputerState(g.def, null);
  const ctx = (): ComputerContext => ({
    nowMs: 0,
    dateText: gameDate(1, 480),
    uptimeMinutes: 5,
    network: { spec: g.network, selfIp: g.def.net!.ip, isUp: (ip) => !down.includes(ip) },
  });
  boot(s, ctx());
  submit(s, "dispatch", ctx());
  submit(s, g.def.users[0].password!, ctx());
  const run = (line: string) => {
    const before = s.screen.length;
    submit(s, line, ctx());
    return s.screen.slice(before + 1);
  };
  return { s, g, run, ctx };
}

describe("network commands", () => {
  it("shows the interface and route", () => {
    const { run } = setup();
    expect(run("ip addr").join("\n")).toContain("inet 10.0.4.11/24");
    expect(run("ip route")[0]).toBe("default via 10.0.4.1 dev eth0 proto dhcp metric 100");
    expect(run("ifconfig").join("\n")).toContain("net-tools");
  });

  it("pings hosts that have power and fails on ones that don't", () => {
    const { run } = setup(["10.0.4.20"]);
    expect(run("ping -c 2 cpd-files").join("\n")).toContain("2 received, 0% packet loss");
    expect(run("ping -c 2 cpd-nvr").join("\n")).toContain("100% packet loss");
    expect(run("ping -c 1 8.8.8.8").join("\n")).toContain("Destination Net Unreachable");
  });

  it("scans the subnet with nmap", () => {
    const { run } = setup();
    const out = run("nmap 10.0.4.0/24").join("\n");
    expect(out).toContain("Nmap scan report for cpd-files (10.0.4.10)");
    expect(out).toContain("22/tcp   open  ssh");
    expect(out).toContain("554/tcp  open  rtsp");
    expect(out).toContain("(9 hosts up)");
    // The door controller answers on ssh and its web login.
    const acs = out.slice(out.indexOf("Nmap scan report for cpd-acs (10.0.4.40)")).split("\n\n")[0];
    expect(acs).toContain("22/tcp   open  ssh");
    expect(acs).toContain("80/tcp   open  http");
    expect(acs).toContain("(VistaGuard Security)");
  });

  it("lists neighbours and fetches device web pages", () => {
    const { run } = setup();
    expect(run("arp -a").some((l) => l.startsWith("cpd-gw (10.0.4.1)"))).toBe(true);
    expect(run("curl http://10.0.4.20/").join("\n")).toContain("NVR-8");
  });
});

describe("ssh", () => {
  it("logs into the file server with the reused password, reads files, and exits", () => {
    const { s, g, run } = setup();
    expect(run("ssh dispatch@cpd-files").join("\n")).toContain("authenticity of host");
    run("yes");
    expect(isSecretInput(s)).toBe(true);
    run(g.def.users[0].password!);
    expect(prompt(s)).toBe("dispatch@cpd-files:~$ ");
    expect(run("cat /srv/shared/infection_timeline.txt").join("\n")).toContain("51 hours after the bite");
    expect(run("cat /home/ortega/to_my_wife.txt")[0]).toContain("Permission denied");
    run("exit");
    expect(s.screen.join("\n")).toContain("Connection to cpd-files closed.");
    expect(prompt(s)).toBe("dispatch@cpd-dispatch-01:~$ ");
  });

  it("refuses wrong passwords and unpowered hosts", () => {
    const { s, run } = setup(["10.0.4.10"]);
    expect(run("ssh cpd-files")[0]).toContain("No route to host");
    const ok = setup();
    ok.run("ssh cpd-files");
    ok.run("yes");
    ok.run("nope");
    ok.run("nope");
    ok.run("nope");
    expect(ok.s.screen.join("\n")).toContain("Permission denied (publickey,password)");
    expect(ok.s.remote).toBeNull();
    void s;
  });
});

describe("cctv", () => {
  it("opens the viewer when the NVR is up", () => {
    const { s, run } = setup();
    expect(run("cctv").join("\n")).toContain("4 channels online");
    expect(s.effects).toEqual([{ type: "cctv", nvrIp: "10.0.4.20" }]);
  });

  it("shows no signal when the NVR has no power", () => {
    const { s, run } = setup(["10.0.4.20"]);
    expect(run("cctv").join("\n")).toContain("NO SIGNAL");
    expect(s.effects).toHaveLength(0);
  });
});

describe("home wifi", () => {
  it("loses the network when the router loses power", () => {
    const g = houseLaptop(facts, mulberry32(3), "9 Pine Street");
    let routerUp = true;
    const s: ComputerState = createComputerState(g.def, 50);
    const ctx = (): ComputerContext => ({
      nowMs: 0,
      dateText: gameDate(1, 480),
      uptimeMinutes: 5,
      network: { spec: g.network, selfIp: g.def.net!.ip, isUp: (ip) => ip !== "192.168.1.1" || routerUp },
    });
    boot(s, ctx());
    const u = g.def.users[0];
    submit(s, u.name, ctx());
    if (u.password) submit(s, u.password, ctx());
    const run = (l: string) => {
      const b = s.screen.length;
      submit(s, l, ctx());
      return s.screen.slice(b + 1);
    };
    expect(run("ping -c 1 router.home").join("\n")).toContain("1 received");
    routerUp = false;
    expect(run("ping -c 1 router.home")[0]).toBe("ping: connect: Network is unreachable");
    expect(run("ip addr").join("\n")).toContain("state DOWN");
  });
});
