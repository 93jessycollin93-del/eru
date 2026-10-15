/**
 * Generates the contents of in-world computers from facts about the town.
 * Engine-agnostic: pure data in, pure data out.
 */
import type { ComputerDef, VDir, VFile, VNode } from "./computer";
import { hostsFile, macFor, type NetHost, type NetworkSpec } from "./network";
import { pick } from "./rng";

export const TOWN = "Coldwater";
export const COUNTY = "Marlow County";

export interface TownFacts {
  policeAddress: string;
  /** Where the National Guard left a supply cache. */
  stashAddress: string;
  /** Game day the electricity grid goes down (at 06:00). */
  powerOffDay: number;
}

export interface GeneratedComputer {
  def: ComputerDef;
  /** The building's LAN, including this machine. */
  network: NetworkSpec;
  /** A note to hide in the same building (passwords, hints). */
  note?: { title: string; text: string };
  battery: number | null;
}

// ------------------------------------------------------------------- dates

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Day 1 of the game is Friday, October 23. */
export function gameDate(day: number, minuteOfDay: number): string {
  const dayOfOct = 22 + day;
  const month = dayOfOct > 31 ? "Nov" : "Oct";
  const dom = dayOfOct > 31 ? dayOfOct - 31 : dayOfOct;
  const weekday = WEEKDAYS[(5 + day - 1) % 7];
  const h = Math.floor(minuteOfDay / 60) % 24;
  const m = Math.floor(minuteOfDay % 60);
  return `${weekday} ${month} ${String(dom).padStart(2, " ")} ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Calendar text for a game day, e.g. "Tuesday, October 27". */
export function longDate(day: number): string {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayOfOct = 22 + day;
  const month = dayOfOct > 31 ? "November" : "October";
  return `${names[(5 + day - 1) % 7]}, ${month} ${dayOfOct > 31 ? dayOfOct - 31 : dayOfOct}`;
}

// ---------------------------------------------------------- fs builders

const file = (owner: string, modified: string, content: string, extra: Partial<VFile> = {}): VFile => ({
  kind: "file",
  owner,
  modified,
  content: content.replace(/^\n/, ""),
  ...extra,
});
const dir = (owner: string, modified: string, children: Record<string, VNode>, extra: Partial<VDir> = {}): VDir => ({
  kind: "dir",
  owner,
  modified,
  children,
  ...extra,
});
const photo = (owner: string, modified: string): VFile => file(owner, modified, "", { binary: true });

function systemTree(hostname: string, home: Record<string, VDir>, bin: Record<string, VFile>, hosts = ""): VDir {
  return dir("root", "Sep 14 09:12", {
    bin: dir("root", "Sep 14 09:12", {}),
    etc: dir("root", "Sep 30 18:40", {
      hostname: file("root", "Sep 14 09:12", hostname + "\n"),
      "os-release": file("root", "Sep 14 09:12", 'NAME="Ubuntu"\nVERSION="20.04.6 LTS (Focal Fossa)"\n'),
      hosts: file("root", "Sep 14 09:12", hosts || "127.0.0.1\tlocalhost\n"),
      shadow: file("root", "Sep 14 09:12", "", { private: true }),
    }),
    home: dir("root", "Sep 14 09:12", home),
    tmp: dir("root", "Oct 22 23:59", {}),
    usr: dir("root", "Sep 14 09:12", { local: dir("root", "Sep 14 09:12", { bin: dir("root", "Sep 14 09:12", bin) }) }),
    var: dir("root", "Sep 14 09:12", {
      log: dir("root", "Oct 22 23:59", {
        syslog: file(
          "root",
          "Oct 22 23:59",
          `
Oct 22 23:41:07 kernel: [ 9921.33] e1000e: eth0 NIC Link is Down
Oct 22 23:41:09 NetworkManager: <warn> dhcp4 (eth0): request timed out
Oct 22 23:59:58 CRON[2201]: (root) CMD (/usr/sbin/backup --nightly)
Oct 22 23:59:59 backup: ERROR remote host unreachable
`,
        ),
      }),
    }),
  });
}

function mail(from: string, to: string, date: string, subject: string, body: string) {
  return `From: ${from}\nTo: ${to}\nDate: ${date}\nSubject: ${subject}\n\n${body.replace(/^\n/, "")}`;
}

/**
 * A stable 4-digit code from text (FNV-1a, mod 9000 + 1000). Secrets derived
 * this way cost no random draws, so adding one never reshuffles later machines.
 */
export function pinFrom(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return String((h % 9000) + 1000);
}

const word = (rng: () => number) => pick(rng, ["harbor", "maple", "winter", "falcon", "copper", "juniper", "granite", "otter", "cedar", "lantern"]);
const digits = (rng: () => number, n: number) => Array.from({ length: n }, () => Math.floor(rng() * 10)).join("");

// ------------------------------------------------------------------ police

/** MAC prefix shared by the station's VistaGuard cameras, recorder and door controller. */
const VISTAGUARD_OUI = "c0:56:e3";

export function policeComputer(facts: TownFacts, rng: () => number): GeneratedComputer {
  const user = "dispatch";
  const password = `${word(rng)}${digits(rng, 2)}`;
  const powerDate = longDate(facts.powerOffDay);
  const badge = digits(rng, 4);
  // Derived, not drawn: the content rng stream must stay byte-identical.
  const armoryPin = pinFrom(`${password}:${badge}`);
  const reports: Record<string, VNode> = {
    "incident_1003_oak.txt": file(
      user,
      "Oct  3 23:12",
      `
COLDWATER POLICE DEPARTMENT — INCIDENT REPORT #1003-117
Date: Sat Oct 3   Time: 22:48   Officer: Ptl. R. Danner #2291
Type: Assault (aggravated)

Responded to a 911 call reporting a man attacking a neighbour in a front yard.
On arrival the suspect (white male, ~50s) was kneeling over the victim. He did not
respond to verbal commands. Suspect bit Ptl. Danner on the left forearm through
his jacket while being restrained. Two taser deployments had no visible effect.

Suspect transported to Marlow General under restraint. Victim deceased at scene.
Ptl. Danner treated for the bite and returned to duty.
`,
    ),
    "incident_1006_main.txt": file(
      user,
      "Oct  6 04:30",
      `
COLDWATER POLICE DEPARTMENT — INCIDENT REPORT #1006-009
Date: Tue Oct 6   Time: 02:15   Officer: Sgt. M. Ortega #1180
Type: Officer down / welfare check

Ptl. Danner failed to report for shift. Welfare check at his residence.
Door unlocked. Danner found in the kitchen, feverish and unresponsive, then
became violent. He had to be restrained by three officers.

Marlow General reports they are no longer accepting patients from Coldwater.
Advised all units: DO NOT ALLOW SUSPECTS TO BITE OR SCRATCH. Wear gloves.
`,
    ),
    "incident_1009_station.txt": file(
      user,
      "Oct  9 19:02",
      `
COLDWATER POLICE DEPARTMENT — INCIDENT REPORT #1009-031
Date: Fri Oct 9   Time: 18:20   Officer: Sgt. M. Ortega #1180

The holding cells are no longer secure. Lockdown failed at 17:55.
Remaining personnel are evacuating to the county EOC checkpoint on the highway.
Armory emptied except for what is in the lockers. Lockers left unlocked for
any officer who comes back.

If you are reading this, stay off the main roads at night.
`,
    ),
  };
  const home = {
    [user]: dir(user, "Oct  9 19:05", {
      reports: dir(user, "Oct  9 19:02", reports),
      Mail: dir(user, "Oct 12 08:00", {
        "001.eml": file(
          user,
          "Oct  7 10:21",
          mail(
            "Marlow County EOC <eoc@marlowcounty.gov>",
            "All agencies",
            "Wed, 7 Oct 09:58",
            "Shelter-in-place order, Coldwater and Lisle",
            `
Effective immediately, residents of Coldwater and Lisle are ordered to shelter
in place. Roads out of the county are closed at the highway checkpoint.
Do not transport infected persons to Marlow General.
`,
          ),
        ),
        "002.eml": file(
          user,
          "Oct 10 16:44",
          mail(
            "Marlow Power & Light <grid-ops@marlowpower.com>",
            "Coldwater PD",
            "Sat, 10 Oct 16:40",
            "Scheduled grid shutdown",
            `
Due to loss of staff at the Coldwater substation, the grid serving Coldwater
will be shut down at 06:00 on ${powerDate}. We cannot guarantee service after that.

Hospitals and shelters should arrange generator fuel now.
`,
          ),
        ),
        "003.eml": file(
          user,
          "Oct 12 07:59",
          mail(
            "1st Bn, State National Guard <ops@stateng.mil>",
            "Coldwater PD",
            "Mon, 12 Oct 07:55",
            "Supply cache for sheltering residents",
            `
A supply cache (food, water, medical, sidearm and ammunition) has been placed
inside the house at ${facts.stashAddress}, Coldwater, for residents who could not
evacuate. Please pass this on over the radio.

The highway checkpoint is closing. We will not be returning to Coldwater.
`,
          ),
        ),
      }),
      ".bash_history": file(user, "Oct  9 19:04", "dispatch\ncat reports/incident_1009_station.txt\nshutdown\n", { private: true }),
    }),
    "chief.walsh": dir("chief.walsh", "Oct  4 12:00", { "notes.txt": file("chief.walsh", "Oct  4 12:00", "", { private: true }) }, { private: true }),
  };
  const programs = {
    dispatch: [
      "Coldwater CAD 4.2 — dispatch log (read-only, server offline)",
      "--------------------------------------------------------------------",
      "10/09 17:55  SYSTEM    LOCKDOWN FAILED: front entrance held open",
      "10/09 17:41  UNIT 12   10-33 EMERGENCY at the station, cells breached",
      "10/09 17:38  UNIT 7    requesting backup, Oak Ave, multiple subjects",
      "10/09 16:02  CALLER    screaming, address not given, line dropped",
      "10/09 14:20  UNIT 3    convoy left for the highway checkpoint",
      `10/08 22:10  UNIT 7    hardware store on Pine St looted, axes taken`,
      "10/08 19:55  CALLER    neighbour 'eating' the mail carrier",
      "10/08 11:30  EOC       all units: avoid gunfire in town, it draws them",
      "--------------------------------------------------------------------",
      "[connection to CAD server lost]",
    ],
    cctv: [
      "Connecting to camera server 10.0.4.20 ...",
      "CAM 1  FRONT DESK     NO SIGNAL",
      "CAM 2  CELL BLOCK     NO SIGNAL (last frame Oct 9 17:56)",
      "CAM 3  PARKING LOT    NO SIGNAL",
      "CAM 4  ARMORY         NO SIGNAL",
      "Camera server unreachable.",
    ],
  };
  const bin = {
    dispatch: file("root", "Sep 14 09:12", "", { program: "dispatch", binary: true }),
    cctv: file("root", "Sep 14 09:12", "", { program: "cctv", binary: true }),
    nmap: file("root", "Sep 14 09:12", "", { binary: true }),
  };
  home[user].children["Mail"] = {
    ...(home[user].children["Mail"] as VDir),
    children: {
      ...(home[user].children["Mail"] as VDir).children,
      "004.eml": file(
        user,
        "Sep 30 11:02",
        mail(
          "Coldwater PD IT <it@coldwaterpd.org>",
          "All staff",
          "Wed, 30 Sep 11:00",
          "File server move + camera system",
          `
The shared drive has moved to the new file server, cpd-files (10.0.4.10).
Log in over ssh with the same password as your workstation:

    ssh ${user}@cpd-files

Camera feeds: run 'cctv' from the dispatch terminal. The network closet is on
the UPS, so the cameras and server stay up for several hours if we lose power.

Front entrance and armory are now on the door controller cpd-acs (10.0.4.40).
Armory code is set on the controller — ask the Chief.
`,
        ),
      ),
    },
  };
  (home[user].children[".bash_history"] as VFile).content = `nmap -sn 10.0.4.0/24\nssh ${user}@cpd-files\ncctv\ndispatch\ncat reports/incident_1009_station.txt\nshutdown\n`;

  const vg = VISTAGUARD_OUI;
  const cam = (n: number, label: string, mount: "front" | "side" | "desk" | "back"): NetHost => ({
    ip: `10.0.4.${30 + n}`,
    hostname: `cam-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`,
    mac: macFor(30 + n, vg),
    vendor: "VistaGuard Security",
    kind: "camera",
    services: [
      { port: 80, name: "http", http: `HTTP/1.1 401 Unauthorized\nServer: VG-Webs\nWWW-Authenticate: Digest realm="IPC-2141"\n\n<html><title>VistaGuard IPC-2141 - ${label}</title><body>401 Unauthorized</body></html>` },
      { port: 554, name: "rtsp" },
    ],
    camera: { channel: n, label, mount },
  });
  const files = filesServer(facts, user, password);
  const network: NetworkSpec = {
    id: "cpd-lan",
    cidr: "10.0.4.0/24",
    gateway: "10.0.4.1",
    upsMinutes: 8 * 60,
    hosts: [
      {
        ip: "10.0.4.1",
        hostname: "cpd-gw",
        mac: macFor(1, "00:1b:2f"),
        vendor: "Netgear",
        kind: "router",
        services: [
          { port: 22, name: "ssh" },
          { port: 80, name: "http", http: "HTTP/1.1 200 OK\nServer: httpd\n\n<html><title>NETGEAR ProSAFE VPN Firewall</title><body>WAN: DISCONNECTED (no carrier since Oct 9 18:12)</body></html>" },
        ],
      },
      { ip: "10.0.4.10", hostname: "cpd-files", mac: macFor(10, "0c:c4:7a"), vendor: "Super Micro Computer", kind: "server", services: [{ port: 22, name: "ssh" }, { port: 445, name: "microsoft-ds" }], def: files },
      { ip: "10.0.4.11", hostname: "cpd-dispatch-01", mac: macFor(11, "f8:bc:12"), vendor: "Dell", kind: "computer", services: [{ port: 22, name: "ssh" }] },
      {
        ip: "10.0.4.20",
        hostname: "cpd-nvr",
        mac: macFor(20, vg),
        vendor: "VistaGuard Security",
        kind: "nvr",
        services: [
          { port: 80, name: "http", http: "HTTP/1.1 200 OK\nServer: VG-Webs\n\n<html><title>VistaGuard NVR-8 Login</title><body>Channels: 4/8 recording. Disk: 1.8 TB free.</body></html>" },
          { port: 554, name: "rtsp" },
          { port: 8000, name: "http-alt" },
        ],
      },
      cam(1, "FRONT ENTRANCE", "front"),
      cam(2, "PARKING LOT", "side"),
      cam(3, "FRONT DESK", "desk"),
      cam(4, "CELL BLOCK", "back"),
      doorController(armoryPin),
    ],
  };
  return {
    network,
    def: {
      net: { iface: "eth0", ip: "10.0.4.11", mac: macFor(11, "f8:bc:12") },
      hostname: "cpd-dispatch-01",
      osName: "Ubuntu 20.04.6 LTS",
      kind: "desktop",
      users: [
        { name: user, password, fullName: "Dispatch" },
        { name: "chief.walsh", password: `walsh${badge}!`, fullName: "Chief D. Walsh" },
      ],
      fs: systemTree("cpd-dispatch-01", home, bin, hostsFile(network)),
      motd: ["COLDWATER POLICE DEPARTMENT — AUTHORIZED USERS ONLY", "All activity on this system is logged."],
      programs,
    },
    note: {
      title: "Sticky note",
      text: `Night shift login\nuser: ${user}\npass: ${password}\n\nDON'T leave this on the monitor again — Ortega`,
    },
    battery: null,
  };
}

/**
 * The station's door controller: a cheap embedded box on the UPS, still on its
 * factory login. The `door` program talks to the game through ComputerContext.access.
 */
function doorController(pin: string): NetHost {
  const ip = "10.0.4.40";
  const mac = macFor(40, VISTAGUARD_OUI);
  const root = (content: string, modified: string, extra: Partial<VFile> = {}) => file("root", modified, content, extra);
  return {
    ip,
    hostname: "cpd-acs",
    mac,
    vendor: "VistaGuard Security",
    kind: "controller",
    services: [
      { port: 22, name: "ssh" },
      {
        port: 80,
        name: "http",
        http: "HTTP/1.1 200 OK\nServer: VG-Webs\n\n<html><title>VistaGuard ACS-4 Login</title><body>ACS-4 Door Controller (fw 2.3.1)<form>Username <input name=user> Password <input type=password name=pass> <button>Log in</button></form></body></html>",
      },
    ],
    access: {
      doors: [
        { name: "front", label: "Lobby entrance", mode: "maglock", pin: null },
        { name: "armory", label: "Armory", mode: "strike", pin },
      ],
    },
    def: {
      hostname: "cpd-acs",
      osName: "VistaGuard ACS-4 firmware 2.3.1 (BusyBox)",
      kind: "desktop",
      users: [{ name: "admin", password: "admin", fullName: "Administrator" }],
      net: { iface: "eth0", ip, mac },
      motd: ["VistaGuard ACS-4 door controller — 2 doors. Type 'door'."],
      // Only shown if the game hasn't wired the controller up (no ComputerContext.access).
      programs: { acs: ["door: /dev/ttyS1: no response from door bus"] },
      fs: dir("root", "Sep 28 14:02", {
        etc: dir("root", "Sep 28 14:20", {
          hostname: root("cpd-acs\n", "Sep 28 14:02"),
          version: root("ACS-4 2.3.1 build 20190612 (BusyBox v1.24.1)\n", "Sep 28 14:02"),
          acs: dir("root", "Sep 28 14:20", {
            "doors.conf": root(
              `
# VistaGuard ACS-4 door configuration
# Coldwater PD. Installed Sep 28 by Tri-County Security.

[door1]
name=front
label=Lobby entrance
lock=maglock (double leaf)
power_loss=fail-safe: releases on power loss (egress)
egress=push-to-exit button, inside
reader=none

[door2]
name=armory
label=Armory
lock=electric strike
power_loss=fail-secure: stays locked on power loss (lever egress inside)
egress=lever, inside
reader=keypad
pin=${pin}
`,
              "Sep 28 14:20",
            ),
          }),
        }),
        home: dir("root", "Sep 28 14:02", { admin: dir("admin", "Sep 28 14:02", {}) }),
        usr: dir("root", "Sep 28 14:02", { local: dir("root", "Sep 28 14:02", { bin: dir("root", "Sep 28 14:02", { door: root("", "Sep 28 14:02", { program: "acs", binary: true }) }) }) }),
        var: dir("root", "Sep 28 14:02", {
          log: dir("root", "Oct  9 18:25", {
            acs: dir("root", "Oct  9 18:25", {
              "events.log": root(
                `
Sep 28 14:02 system BOOT fw 2.3.1
Sep 28 14:20 armory PIN SET admin
Oct 06 02:31 armory GRANTED keypad
Oct 09 17:44 armory GRANTED keypad
Oct 09 17:52 front FORCED
Oct 09 17:55 front LOCKDOWN FAILED: door held open
Oct 09 18:24 front UNLOCK admin "left open for returning units - MO"
Oct 09 18:25 armory LOCKED
`,
                "Oct  9 18:25",
              ),
            }),
          }),
        }),
      }),
    },
  };
}

/** The police file server, reachable over ssh from the dispatch terminal. */
function filesServer(facts: TownFacts, user: string, password: string): ComputerDef {
  const srv = (content: string, modified: string, extra: Partial<VFile> = {}) => file("root", modified, content, extra);
  return {
    hostname: "cpd-files",
    osName: "Ubuntu 20.04.6 LTS",
    kind: "desktop",
    users: [
      { name: user, password, fullName: "Dispatch" },
      { name: "ortega", password: "Badge1180!", fullName: "Sgt. M. Ortega" },
    ],
    net: { iface: "eth0", ip: "10.0.4.10", mac: macFor(10, "0c:c4:7a") },
    motd: ["cpd-files — Coldwater PD shared storage", "Shared documents are in /srv/shared."],
    programs: {},
    fs: dir("root", "Sep 14 09:12", {
      etc: dir("root", "Sep 14 09:12", { hostname: srv("cpd-files\n", "Sep 14 09:12") }),
      home: dir("root", "Sep 14 09:12", {
        [user]: dir(user, "Oct  9 18:01", {}),
        ortega: dir("ortega", "Oct  9 17:50", {
          "to_my_wife.txt": file(
            "ortega",
            "Oct  9 17:50",
            `
Maria — if this reaches you, I'm sorry I didn't come home. The station isn't safe.
We're taking the convoy to the highway checkpoint. I left a pistol and ammo with the
Guard's supply cache at ${facts.stashAddress}. Go there if you can't get out.
`,
            { private: true },
          ),
        }, { private: true }),
      }),
      srv: dir("root", "Sep 30 10:40", {
        shared: dir("root", "Oct  9 17:44", {
          "infection_timeline.txt": srv(
            `
CASE NOTES — Sgt. M. Ortega (not for release)

Ptl. R. Danner
  Oct 3 22:48  bitten on left forearm by a suspect during arrest
  Oct 4        fine, complained of a headache, worked his shift
  Oct 5 ~14:00 fever, nausea, sent home (about 39 hours after the bite)
  Oct 6 02:15  found violent and unresponsive (about 51 hours after the bite)

Marlow General memo (Oct 6):
  - every patient with a bite has turned, usually within 2 to 3 days
  - some patients with scratches turned, most did not
  - no treatment has slowed it. Antibiotics, antivirals: nothing.
  - they react to SOUND first, then movement. They see poorly in the dark.
`,
            "Oct  7 09:30",
          ),
          "armory_inventory.csv": srv(
            "item,issued,remaining,location\nGlock 17,14,3,officer lockers\n9mm FMJ (box of 50),40,6,lockers / evidence cabinet\nShotgun,4,0,taken by convoy\nFirst aid kit,10,2,lockers\n",
            "Oct  9 17:44",
          ),
          "network_diagram.txt": srv(
            `
COLDWATER PD NETWORK (10.0.4.0/24)
  10.0.4.1    cpd-gw            firewall / router (WAN down since Oct 9)
  10.0.4.10   cpd-files         this server
  10.0.4.11   cpd-dispatch-01   dispatch workstation
  10.0.4.20   cpd-nvr           camera recorder (VistaGuard NVR-8)
  10.0.4.31-34                  IP cameras (front, parking lot, desk, cells)
  10.0.4.40   cpd-acs           door controller (VistaGuard ACS-4)

Network closet runs on an APC Smart-UPS 1500: roughly 8 hours after mains fails.
`,
            "Sep 30 10:40",
          ),
          manuals: dir("root", "Sep 30 10:42", {
            "VistaGuard_ACS-4_QuickStart.txt": srv(
              `
VistaGuard ACS-4 Door Controller — Quick Start Guide (rev C)

1. LOGGING IN
   Each controller has a web page (http://<controller>/) and an ssh console.
   Default login admin / admin (ssh and web). CHANGE THIS.

2. CONSOLE COMMANDS
   door list             every door, its lock type and current state
   door unlock <door>    release a door until it is locked again
   door lock <door>      secure a door (an open door locks once it closes)
   door pulse <door>     momentary release, as if a valid code was entered

3. LOCK TYPES AND POWER LOSS
   Magnetic lock (maglock) = FAIL-SAFE. The magnet needs power to hold the
   door. On power loss it releases and the door opens freely. Fire code
   requires this on exit routes so nobody is trapped.

   Electric strike = FAIL-SECURE. The strike stays locked without power, so
   nobody gets in from outside. The lever on the inside always opens the door
   (free egress). Use strikes for rooms that must stay shut: armories,
   evidence, server rooms.

   Keypads are powered by the controller. With no power they go dark and
   accept no codes.

4. POWER
   Put the controller on a UPS. When mains fails it keeps running on the UPS;
   'door list' shows AC: FAIL and the battery level. When the UPS runs flat
   every maglock releases and every strike stays locked until power returns.
   On power-up the controller restores the last commanded state.
`,
              "Sep 30 10:42",
            ),
          }),
          evidence: dir("root", "Oct  8 12:00", {
            "case_1003_scene_01.jpg": srv("", "Oct  4 01:12", { binary: true }),
            "case_1003_scene_02.jpg": srv("", "Oct  4 01:13", { binary: true }),
            "case_1006_danner_home.jpg": srv("", "Oct  6 03:01", { binary: true }),
          }),
        }),
      }),
    }),
  };
}

// ------------------------------------------------------------------ stores

export function storeComputer(facts: TownFacts, rng: () => number, kind: "store" | "hardware", address: string): GeneratedComputer {
  const name = kind === "store" ? pick(rng, ["Kwik Mart", "Valley Grocery", "Corner Foods", "Pickett's Market"]) : pick(rng, ["Coldwater Hardware", "Ace Tools & Supply", "Barlow Hardware"]);
  const host = name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/-$/, "") + "-pos";
  const user = kind === "store" ? "manager" : "counter";
  const password = kind === "store" ? "admin" : "1234";
  const stock =
    kind === "store"
      ? [
          `${name} — INVENTORY (last sync Oct 8 21:00)`,
          "SKU     ITEM                      ON HAND   BACK ROOM",
          "10021   Bottled water 1L                0          0",
          "10450   Canned beans 400g               0          3",
          "11002   Potato crisps                   2          0",
          "11870   Cereal bars (box)               0          1",
          "20110   Bandages (pack)                 0          0",
          "20115   Painkillers 24ct                0          0",
          "Note: shelves cleared Oct 7–8. Delivery cancelled.",
        ]
      : [
          `${name} — INVENTORY (last sync Oct 8 18:30)`,
          "SKU     ITEM                      ON HAND",
          "50010   Fire axe                        0",
          "50014   Hatchet                         0",
          "50200   Claw hammer                     4",
          "50310   Nails 1kg                      12",
          "50400   Plywood sheet                  31",
          "60010   Flashlight + batteries          0",
          "Note: police took the axes Oct 8. Plywood for boarding windows still in stock.",
        ];
  const home = {
    [user]: dir(user, "Oct  8 21:05", {
      Mail: dir(user, "Oct  8 21:05", {
        "001.eml": file(
          user,
          "Oct  6 07:10",
          mail(
            kind === "store" ? "Northline Distribution <orders@northline.com>" : "BuildRight Wholesale <orders@buildright.com>",
            name,
            "Tue, 6 Oct 07:02",
            "All deliveries to Marlow County suspended",
            `
Due to the road closures in Marlow County we are suspending all deliveries
until further notice. Outstanding orders will be credited.
`,
          ),
        ),
        "002.eml": file(
          user,
          "Oct  8 20:58",
          mail(
            "Owner <owner@mail.com>",
            user,
            "Thu, 8 Oct 20:51",
            "closing up",
            `
Lock up tonight and go home to your family. Don't come back in until this is
over. Take what you need from the back room. Power's supposed to go off on
${longDate(facts.powerOffDay)} anyway.
`,
          ),
        ),
      }),
      "timesheet.csv": file(user, "Oct  8 21:00", "date,hours\n2026-10-01,8\n2026-10-02,8\n2026-10-05,9\n2026-10-06,11\n2026-10-07,12\n2026-10-08,4\n"),
    }),
  };
  const network: NetworkSpec = {
    id: `${host}-lan`,
    cidr: "192.168.0.0/24",
    gateway: "192.168.0.1",
    upsMinutes: 0,
    hosts: [
      { ip: "192.168.0.1", hostname: "router", mac: macFor(host.length, "50:c7:bf"), vendor: "TP-Link", kind: "router", services: [{ port: 80, name: "http", http: "HTTP/1.1 200 OK\n\n<html><title>TP-Link Archer C7</title><body>Internet: Disconnected</body></html>" }] },
      { ip: "192.168.0.10", hostname: host, mac: macFor(host.length + 10, "f8:bc:12"), vendor: "Dell", kind: "computer", services: [] },
      { ip: "192.168.0.50", hostname: "receipt-printer", mac: macFor(host.length + 50, "64:eb:8c"), vendor: "Seiko Epson", kind: "printer", services: [{ port: 80, name: "http", http: "HTTP/1.1 200 OK\n\n<html><title>EPSON TM-T88VI</title><body>Status: Paper near end</body></html>" }, { port: 9100, name: "jetdirect" }] },
    ],
  };
  return {
    network,
    def: {
      net: { iface: "eth0", ip: "192.168.0.10", mac: macFor(host.length + 10, "f8:bc:12") },
      hostname: host,
      osName: "Ubuntu 20.04.6 LTS",
      kind: "desktop",
      users: [{ name: user, password, fullName: name }],
      fs: systemTree(host, home, { inventory: file("root", "Sep 14 09:12", "", { program: "inventory", binary: true }) }, "127.0.0.1\tlocalhost\n192.168.0.1\trouter\n192.168.0.50\treceipt-printer\n"),
      motd: [`${name} point-of-sale terminal — ${address}`, "Run 'inventory' to view stock levels."],
      programs: { inventory: stock },
    },
    note: { title: "Note taped under the counter", text: `POS login\n${user} / ${password}\n(change this!!)` },
    battery: null,
  };
}

// ------------------------------------------------------------------ houses

const FIRST = ["daniel", "sarah", "mike", "jen", "chris", "laura", "tom", "amy", "kevin", "rachel", "omar", "nina", "luis", "erin"];
const LAST = ["Hale", "Mercer", "Okafor", "Lindqvist", "Brennan", "Castillo", "Novak", "Whitaker", "Duarte", "Kowalski", "Pryce", "Moreau"];
const PETS = ["biscuit", "max", "luna", "pepper", "rocky", "daisy", "milo", "bear"];

export function houseLaptop(facts: TownFacts, rng: () => number, address: string): GeneratedComputer {
  const first = pick(rng, FIRST);
  const last = pick(rng, LAST);
  const full = first[0].toUpperCase() + first.slice(1) + " " + last;
  const pet = pick(rng, PETS);
  const locked = rng() < 0.6;
  const password = locked ? `${pet}${pick(rng, ["2019", "123", "!", "88", "2020"])}` : null;
  const sibling = pick(rng, ["Kate", "Ben", "Mom", "Dad", "Ellie", "Sam"]);
  const leftTown = rng() < 0.5;

  const journal = `
Oct 4
Sirens most of the night. Something happened on Oak Ave, a man attacked his neighbour.
News says it's some kind of flu. ${pet[0].toUpperCase() + pet.slice(1)} wouldn't stop barking.

Oct 6
School's closed. Marlow General isn't taking anyone from Coldwater. The Hendersons
across the street haven't opened their curtains in two days.

Oct 8
Saw one of them in the street at dusk. It walked like it was drunk, then it saw
the Pryce kid on his bike and it RAN. I'm not going outside again.

Oct 10
They hear everything. Dropped a pan and three of them came to the window within a
minute. We keep the lights off now. Power company says the grid goes off
${longDate(facts.powerOffDay)}. ${leftTown ? "We're leaving before then." : "We're staying. The roads are worse."}
`;

  const mails: Record<string, VNode> = {
    "001.eml": file(
      first,
      "Oct  5 08:31",
      mail("Coldwater Elementary <office@coldwaterschools.org>", "Parents", "Mon, 5 Oct 08:30", "School closure", `\nAll Coldwater schools are closed until further notice on advice from the county health department.\n`),
    ),
    "002.eml": file(
      first,
      "Oct  7 21:14",
      mail(
        `${sibling} <${sibling.toLowerCase()}@mail.com>`,
        first,
        "Wed, 7 Oct 21:12",
        "are you ok??",
        `\nThe news says Marlow County is closed off. Please call me. If you can get out, come stay with us. Don't wait.\n`,
      ),
    ),
    "003.eml": file(
      first,
      "Oct  9 06:02",
      mail("Marlow County Alerts <alerts@marlowcounty.gov>", "Residents", "Fri, 9 Oct 06:00", "EMERGENCY: shelter in place", `\nStay indoors. Lock doors and windows. Do not approach sick persons.\nNational Guard is distributing supplies to residents who cannot leave.\n`),
    ),
  };
  if (leftTown) {
    mails["004.eml"] = file(
      first,
      "Oct 11 23:40",
      mail(
        `${full} <${first}@mail.com>`,
        `${sibling.toLowerCase()}@mail.com`,
        "Sun, 11 Oct 23:38",
        "[DRAFT - NOT SENT] leaving tonight",
        `\nWe're going for the checkpoint on the highway tonight. If anyone finds this,\nthere's food in the kitchen. Take it. Spare key is under the planter at ${address}.\n`,
      ),
    );
  }

  const home = {
    [first]: dir(first, "Oct 11 23:41", {
      Documents: dir(first, "Oct 10 22:15", {
        "journal.txt": file(first, "Oct 10 22:15", journal),
        "shopping_list.txt": file(first, "Oct  3 17:02", "milk\neggs\nbatteries (D)\nwater - LOTS\ncanned food\nbandages\ndog food\n"),
      }),
      Pictures: dir(first, "Sep 27 14:00", {
        [`${pet}_birthday.jpg`]: photo(first, "Sep  2 18:22"),
        "IMG_2041.jpg": photo(first, "Sep 27 13:51"),
        "IMG_2042.jpg": photo(first, "Sep 27 13:52"),
      }),
      Mail: dir(first, "Oct 11 23:40", mails),
    }),
  };

  const lastOctet = 100 + Math.floor(rng() * 50);
  const hosts: NetHost[] = [
    { ip: "192.168.1.1", hostname: "router.home", mac: macFor(lastOctet, "50:c7:bf"), vendor: "TP-Link", kind: "router", services: [{ port: 53, name: "domain" }, { port: 80, name: "http", http: `HTTP/1.1 200 OK\n\n<html><title>Archer AX10</title><body>Network: ${last.toUpperCase()}-WIFI. Internet: Disconnected</body></html>` }] },
    { ip: `192.168.1.${lastOctet}`, hostname: `${first}-laptop`, mac: macFor(lastOctet + 1, "a4:c3:f0"), vendor: "Intel Corporate", kind: "computer", services: [] },
  ];
  if (rng() < 0.5) hosts.push({ ip: "192.168.1.40", hostname: "living-room-tv", mac: macFor(lastOctet + 2, "f4:f5:d8"), vendor: "Google", kind: "tv", services: [{ port: 8008, name: "http", http: "HTTP/1.1 200 OK\n\n{\"name\":\"Living Room TV\",\"app\":\"Emergency Alert System\",\"status\":\"STAY INDOORS\"}" }, { port: 8009, name: "ajp13" }] });
  const network: NetworkSpec = { id: `${first}-${last}-home`, cidr: "192.168.1.0/24", gateway: "192.168.1.1", upsMinutes: 0, hosts };
  return {
    network,
    def: {
      net: { iface: "wlan0", ip: `192.168.1.${lastOctet}`, mac: macFor(lastOctet + 1, "a4:c3:f0") },
      hostname: `${first}-laptop`,
      osName: "Ubuntu 20.04.6 LTS",
      kind: "laptop",
      users: [{ name: first, password, fullName: full }],
      fs: systemTree(`${first}-laptop`, home, {}, hostsFile(network)),
      motd: [],
      programs: {},
    },
    note: locked
      ? rng() < 0.6
        ? { title: "Fridge magnet note", text: `laptop: ${first} / ${password}\nwifi: ColdwaterNet\n— ${pet} vet appt Tues 3pm` }
        : { title: "Post-it", text: `password hint: the dog + the usual\n(${pet[0].toUpperCase() + pet.slice(1)}'s tag says: ${pet.toUpperCase()})` }
      : undefined,
    battery: Math.round(15 + rng() * 75),
  };
}
