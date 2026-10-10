/**
 * In-world computers: a virtual filesystem and a small Unix-like shell.
 *
 * Engine-agnostic and serialisable: a computer is plain data (ComputerDef +
 * ComputerState); programs are data too (lines to print), so the whole thing
 * can be saved or reimplemented in another engine without behaviour changes.
 */
import { inSubnet, isIp, latencyMs, resolveHost, type AccessDoorStatus, type AccessView, type NetHost, type NetworkView } from "./network";

export interface VFile {
  kind: "file";
  content: string;
  owner: string;
  /** Only the owner can read it. */
  private?: boolean;
  /** "Oct  6 14:03" style timestamp for ls -l. */
  modified: string;
  /** Binary files can't be printed (photos, executables). */
  binary?: boolean;
  /** If set, running this file prints the lines of this program. */
  program?: string;
}

export interface VDir {
  kind: "dir";
  owner: string;
  private?: boolean;
  modified: string;
  children: Record<string, VNode>;
}

export type VNode = VFile | VDir;

export interface ComputerUser {
  name: string;
  /** null = no password needed. */
  password: string | null;
  fullName: string;
}

export interface ComputerDef {
  hostname: string;
  osName: string;
  kind: "desktop" | "laptop";
  users: ComputerUser[];
  fs: VDir;
  /** Shown after a successful login. */
  motd: string[];
  /** Output for each program id, used by files with `program` set. */
  programs: Record<string, string[]>;
  /** Network interface, if the machine is on a LAN. */
  net?: { iface: "eth0" | "wlan0"; ip: string; mac: string };
}

export type DoorAction = "lock" | "unlock" | "pulse";

/** Something the shell asks the game to do (open a camera viewer, drive a door lock, ...). */
export type ComputerEffect = { type: "cctv"; nvrIp: string } | { type: "door"; controller: string; door: string; action: DoorAction };

export type ComputerPhase = "off" | "login" | "password" | "shell";

export interface ComputerState {
  def: ComputerDef;
  phase: ComputerPhase;
  user: string | null;
  pendingUser: string | null;
  cwd: string;
  failedLogins: number;
  lockedUntil: number;
  history: string[];
  screen: string[];
  /** Battery percentage for laptops, null for mains-powered machines. */
  battery: number | null;
  /** Active ssh session on another machine; input is forwarded to it. */
  remote: ComputerState | null;
  /** Set on a session that is itself a remote (ssh) session. */
  remoteHost: string | null;
  /** ssh handshake in progress. */
  ssh: { ip: string; host: string; user: string; stage: "hostkey" | "password"; tries: number } | null;
  knownHosts: string[];
  /** Requests for the game, drained after each submit. */
  effects: ComputerEffect[];
}

export interface ComputerContext {
  /** Real milliseconds, for login lockouts. */
  nowMs: number;
  /** "Fri Oct 23 07:42" */
  dateText: string;
  /** Minutes since the machine was booted, for uptime. */
  uptimeMinutes: number;
  /** The LAN this machine is on, if any. */
  network?: NetworkView;
  /** Live door state, if the LAN has an access controller. */
  access?: AccessView;
}

const MAX_SCREEN = 500;

export function createComputerState(def: ComputerDef, battery: number | null): ComputerState {
  return {
    def,
    phase: "off",
    user: null,
    pendingUser: null,
    cwd: "/",
    failedLogins: 0,
    lockedUntil: 0,
    history: [],
    screen: [],
    battery,
    remote: null,
    remoteHost: null,
    ssh: null,
    knownHosts: [],
    effects: [],
  };
}

/** True while the terminal should hide what is typed (passwords). */
export function isSecretInput(s: ComputerState): boolean {
  if (s.remote) return isSecretInput(s.remote);
  return s.phase === "password" || s.ssh?.stage === "password";
}

// ----------------------------------------------------------------- helpers

const print = (s: ComputerState, ...lines: string[]) => {
  s.screen.push(...lines);
  if (s.screen.length > MAX_SCREEN) s.screen.splice(0, s.screen.length - MAX_SCREEN);
};

const homeOf = (user: string) => `/home/${user}`;

function normalise(s: ComputerState, path: string): string {
  if (path === "~" || path.startsWith("~/")) path = homeOf(s.user ?? "") + path.slice(1);
  const parts = (path.startsWith("/") ? path : `${s.cwd}/${path}`).split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (!p || p === ".") continue;
    if (p === "..") out.pop();
    else out.push(p);
  }
  return "/" + out.join("/");
}

function lookup(fs: VDir, abs: string): VNode | null {
  let node: VNode = fs;
  for (const part of abs.split("/").filter(Boolean)) {
    if (node.kind !== "dir") return null;
    const next: VNode | undefined = node.children[part];
    if (!next) return null;
    node = next;
  }
  return node;
}

const canRead = (s: ComputerState, n: VNode) => !n.private || n.owner === s.user;

function resolve(s: ComputerState, path: string): { abs: string; node: VNode | null; denied: boolean } {
  const abs = normalise(s, path);
  // Walk the path so a private directory hides everything beneath it.
  let node: VNode = s.def.fs;
  for (const part of abs.split("/").filter(Boolean)) {
    if (node.kind !== "dir") return { abs, node: null, denied: false };
    if (!canRead(s, node)) return { abs, node: null, denied: true };
    const next: VNode | undefined = node.children[part];
    if (!next) return { abs, node: null, denied: false };
    node = next;
  }
  return { abs, node, denied: !canRead(s, node) };
}

export function prompt(s: ComputerState): string {
  if (s.remote) return prompt(s.remote);
  if (s.ssh?.stage === "hostkey") return "Are you sure you want to continue connecting (yes/no/[fingerprint])? ";
  if (s.ssh?.stage === "password") return `${s.ssh.user}@${s.ssh.host}'s password: `;
  if (s.phase === "login") return `${s.def.hostname} login: `;
  if (s.phase === "password") return "Password: ";
  if (s.phase !== "shell") return "";
  const home = homeOf(s.user!);
  const where = s.cwd === home ? "~" : s.cwd.startsWith(home + "/") ? "~" + s.cwd.slice(home.length) : s.cwd;
  return `${s.user}@${s.def.hostname}:${where}$ `;
}

// -------------------------------------------------------------------- boot

export function boot(s: ComputerState, ctx: ComputerContext) {
  s.screen = [];
  s.phase = "login";
  s.user = null;
  s.cwd = "/";
  const d = s.def;
  print(
    s,
    d.kind === "laptop" ? "Starting up..." : "BIOS v2.41  Memory test: 8192 MB OK",
    `${d.osName} (kernel 5.4.0-88)`,
    "[  OK  ] Mounted /home",
    "[  OK  ] Started Network Manager",
    "[ WARN ] network: no carrier on eth0 (DHCP timeout)",
    "[  OK  ] Reached target Multi-User System",
    "",
    `${d.osName} ${d.hostname} tty1   ${ctx.dateText}`,
    "",
  );
}

export function shutdown(s: ComputerState) {
  s.phase = "off";
  s.user = null;
}

// ------------------------------------------------------------------- input

/** Feed one line of keyboard input. */
export function submit(s: ComputerState, line: string, ctx: ComputerContext) {
  if (s.phase === "off") return;
  if (s.ssh) return sshInput(s, line, ctx);
  if (s.remote) return forwardToRemote(s, line, ctx);
  if (s.phase === "login") {
    print(s, prompt(s) + line);
    const name = line.trim();
    if (!name) return;
    if (ctx.nowMs < s.lockedUntil) {
      print(s, `Too many failed attempts. Try again in ${Math.ceil((s.lockedUntil - ctx.nowMs) / 1000)} seconds.`, "");
      return;
    }
    const user = s.def.users.find((u) => u.name === name);
    if (user && user.password === null) return login(s, user.name, ctx);
    s.pendingUser = name;
    s.phase = "password";
    return;
  }
  if (s.phase === "password") {
    print(s, "Password: ");
    const user = s.def.users.find((u) => u.name === s.pendingUser);
    if (user && user.password === line) return login(s, user.name, ctx);
    s.failedLogins++;
    s.phase = "login";
    print(s, "", "Login incorrect", "");
    if (s.failedLogins >= 3) {
      s.lockedUntil = ctx.nowMs + 30_000;
      s.failedLogins = 0;
      print(s, "Account locked for 30 seconds after 3 failed attempts.", "");
    }
    return;
  }

  print(s, prompt(s) + line);
  const trimmed = line.trim();
  if (!trimmed) return;
  s.history.push(trimmed);
  if (s.history.length > 100) s.history.shift();
  runPipeline(s, trimmed, ctx);
}

// --------------------------------------------------------------------- ssh

// `access` passes through untouched: the `door` program checks it is running on the controller itself.
const remoteContext = (ctx: ComputerContext, r: ComputerState): ComputerContext => ({
  ...ctx,
  network: ctx.network && r.def.net ? { ...ctx.network, selfIp: r.def.net.ip } : undefined,
});

function forwardToRemote(s: ComputerState, line: string, ctx: ComputerContext) {
  const r = s.remote!;
  // The far end lost power: the session dies on the next keystroke instead of
  // carrying on as if the machine were still there (a dead controller takes no commands).
  if (r.def.net && ctx.network && !ctx.network.isUp(r.def.net.ip)) {
    print(s, prompt(r) + line, "client_loop: send disconnect: Broken pipe", "");
    s.remote = null;
    return;
  }
  r.screen = [];
  submit(r, line, remoteContext(ctx, r));
  if (line.trim() === "clear") s.screen = [];
  else print(s, ...r.screen);
  r.screen = [];
  s.effects.push(...r.effects.splice(0));
  if (r.phase !== "shell" && !r.ssh && !r.remote) {
    print(s, `Connection to ${r.remoteHost} closed.`, "");
    s.remote = null;
  }
}

function sshInput(s: ComputerState, line: string, ctx: ComputerContext) {
  const ssh = s.ssh!;
  print(s, prompt(s) + (ssh.stage === "password" ? "" : line));
  if (ssh.stage === "hostkey") {
    if (line.trim() !== "yes") {
      print(s, "Host key verification failed.");
      s.ssh = null;
      return;
    }
    s.knownHosts.push(ssh.ip);
    print(s, `Warning: Permanently added '${ssh.host},${ssh.ip}' (ECDSA) to the list of known hosts.`);
    ssh.stage = "password";
    return;
  }
  const host = ctx.network ? resolveHost(ctx.network.spec, ssh.ip) : undefined;
  const user = host?.def?.users.find((u) => u.name === ssh.user);
  if (host?.def && user && (user.password === null || user.password === line)) {
    s.ssh = null;
    const r = createComputerState(host.def, null);
    r.remoteHost = host.hostname;
    r.phase = "shell";
    const os = host.def.osName;
    print(s, os.startsWith("Ubuntu") ? `Welcome to ${os} (GNU/Linux 5.4.0-88-generic x86_64)` : `Welcome to ${os}`, "");
    login(r, user.name, ctx);
    print(s, ...r.screen);
    r.screen = [];
    s.remote = r;
    return;
  }
  ssh.tries++;
  if (ssh.tries >= 3) {
    print(s, `${ssh.user}@${ssh.host}: Permission denied (publickey,password).`);
    s.ssh = null;
  } else {
    print(s, "Permission denied, please try again.");
  }
}

function login(s: ComputerState, user: string, ctx: ComputerContext) {
  s.user = user;
  s.pendingUser = null;
  s.failedLogins = 0;
  s.phase = "shell";
  s.cwd = lookup(s.def.fs, homeOf(user)) ? homeOf(user) : "/";
  print(s, "", `Last login: ${ctx.dateText.replace(/\d\d:\d\d$/, "")}on tty1`, ...s.def.motd, "");
  const mail = lookup(s.def.fs, homeOf(user) + "/Mail");
  if (mail?.kind === "dir" && Object.keys(mail.children).length) {
    print(s, `You have ${Object.keys(mail.children).length} messages. Type 'mail' to read them.`, "");
  }
}

/** Tab completion for the last word on the line. */
export function complete(s: ComputerState, line: string): string {
  if (s.phase !== "shell") return line;
  const words = line.split(" ");
  const last = words[words.length - 1];
  const isCommand = words.length === 1;
  const slash = last.lastIndexOf("/");
  const dirPart = slash >= 0 ? last.slice(0, slash + 1) : "";
  const stem = last.slice(slash + 1);
  let candidates: string[] = [];
  if (isCommand && !dirPart) {
    candidates = [...Object.keys(BUILTINS), ...programNames(s)];
  } else {
    const dir = resolve(s, dirPart || ".").node;
    if (dir?.kind === "dir" && canRead(s, dir)) {
      candidates = Object.entries(dir.children).map(([n, c]) => (c.kind === "dir" ? n + "/" : n));
    }
  }
  const matches = candidates.filter((c) => c.startsWith(stem));
  if (matches.length === 1) {
    words[words.length - 1] = dirPart + matches[0] + (matches[0].endsWith("/") ? "" : isCommand ? " " : "");
    return words.join(" ");
  }
  if (matches.length > 1) {
    print(s, prompt(s) + line, matches.join("  "));
    // Extend to the longest common prefix.
    let prefix = matches[0];
    for (const m of matches) while (!m.startsWith(prefix)) prefix = prefix.slice(0, -1);
    words[words.length - 1] = dirPart + prefix;
    return words.join(" ");
  }
  return line;
}

function programNames(s: ComputerState): string[] {
  const bin = lookup(s.def.fs, "/usr/local/bin");
  return bin?.kind === "dir" ? Object.keys(bin.children) : [];
}

// ---------------------------------------------------------------- commands

type Cmd = (s: ComputerState, args: string[], stdin: string[] | null, ctx: ComputerContext) => string[];

function tokenize(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: string | null = null;
  let any = false;
  for (const ch of line) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      any = true;
    } else if (ch === " " || ch === "\t") {
      if (cur || any) out.push(cur);
      cur = "";
      any = false;
    } else cur += ch;
  }
  if (cur || any) out.push(cur);
  return out;
}

function runPipeline(s: ComputerState, line: string, ctx: ComputerContext) {
  let stdin: string[] | null = null;
  const stages = line.split("|").map((p) => p.trim());
  for (const stage of stages) {
    const [name, ...args] = tokenize(stage);
    if (!name) {
      print(s, "bash: syntax error near unexpected token `|'");
      return;
    }
    stdin = runCommand(s, name, args, stdin, ctx);
    if (s.phase !== "shell") return; // logged out or shut down
  }
  if (stdin && stdin.length) print(s, ...stdin);
}

function runCommand(s: ComputerState, name: string, args: string[], stdin: string[] | null, ctx: ComputerContext): string[] {
  const builtin = BUILTINS[name];
  if (builtin) return builtin(s, args, stdin, ctx);
  // Executables: by path, or by name from /usr/local/bin
  const path = name.includes("/") ? name : `/usr/local/bin/${name}`;
  const { node, denied } = resolve(s, path);
  if (denied) return [`bash: ${name}: Permission denied`];
  if (node?.kind === "file" && node.program) {
    // Live only on the controller the game wired up; anywhere else it falls back to its canned lines.
    if (node.program === "acs" && ctx.access?.controller === s.def.hostname) return acs(s, args, ctx.access);
    if (node.program === "cctv") {
      const nvr = ctx.network?.spec.hosts.find((h) => h.kind === "nvr");
      if (nvr && ctx.network!.isUp(nvr.ip)) {
        const cams = ctx.network!.spec.hosts.filter((h) => h.kind === "camera" && ctx.network!.isUp(h.ip)).length;
        s.effects.push({ type: "cctv", nvrIp: nvr.ip });
        return [`Connecting to NVR ${nvr.hostname} (${nvr.ip}) ...`, "Authenticated as operator.", `${cams} channels online. Opening viewer.`];
      }
    }
    return s.def.programs[node.program] ?? [`${name}: segmentation fault (core dumped)`];
  }
  if (node?.kind === "file") return [`bash: ${name}: Permission denied`];
  return [`${name}: command not found`];
}

// ------------------------------------------------------- door controller

const ON_POWER_LOSS: Record<AccessDoorStatus["mode"], string> = { maglock: "releases (fail-safe)", strike: "stays locked (fail-secure)" };

const ACS_USAGE = [
  "VistaGuard ACS-4 door control",
  "usage: door list              doors, lock types and state",
  "       door unlock <door>     release until locked again",
  "       door lock <door>       secure (an open door locks when it closes)",
  "       door pulse <door>      momentary release, like a valid keypad code",
];

function doorState(d: AccessDoorStatus): string {
  if (d.open) return d.commanded === "locked" ? "open (held-open alarm)" : "open";
  if (d.locked) return "closed, locked";
  // Powered, commanded locked, yet not holding: a pulse is running.
  return d.commanded === "locked" ? "closed, unlocked (pulse)" : "closed, unlocked";
}

/** The `door` CLI on an access controller. Commands become effects; the game moves the locks. */
function acs(s: ComputerState, args: string[], access: AccessView): string[] {
  const [sub, target] = args;
  const doors = access.doors();
  if (sub === "list" || sub === "status") {
    const p = access.power();
    const ac = p.source === "mains" ? "AC: OK" : `AC: FAIL  UPS ${p.upsPercent === null ? "--" : Math.round(p.upsPercent)}%`;
    const rows = [["DOOR", "LOCK", "ON POWER LOSS", "COMMAND", "STATE"], ...doors.map((d) => [d.name, d.mode, ON_POWER_LOSS[d.mode], d.commanded, doorState(d)])];
    const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)) + 2);
    return [`VistaGuard ACS-4 fw 2.3.1  ${ac}`, "", ...rows.map((r) => r.map((c, i) => (i < r.length - 1 ? pad(c, widths[i]) : c)).join(""))];
  }
  if (sub === "lock" || sub === "unlock" || sub === "pulse") {
    if (!target) return [`usage: door ${sub} <door>`];
    const d = doors.find((x) => x.name === target.toLowerCase());
    if (!d) return [`door: no such door '${target}'`];
    s.effects.push({ type: "door", controller: access.controller, door: d.name, action: sub });
    if (sub === "lock" && d.open) return [`${d.name}: will lock when closed`];
    return [`${d.name}: ${sub} accepted (${d.mode} ${sub === "lock" ? "engaged" : sub === "pulse" ? "released momentarily" : "released"})`];
  }
  return sub && sub !== "help" ? [`door: unknown command '${sub}'`, ...ACS_USAGE] : ACS_USAGE;
}

const fileLines = (s: ComputerState, path: string, cmd: string): string[] | string => {
  const { node, denied } = resolve(s, path);
  if (denied) return `${cmd}: ${path}: Permission denied`;
  if (!node) return `${cmd}: ${path}: No such file or directory`;
  if (node.kind === "dir") return `${cmd}: ${path}: Is a directory`;
  if (node.binary) return `${cmd}: ${path}: binary file, cannot display`;
  return node.content.replace(/\n$/, "").split("\n");
};

const parseN = (args: string[], fallback: number): [number, string[]] => {
  const i = args.indexOf("-n");
  if (i >= 0) {
    const n = parseInt(args[i + 1] ?? "", 10);
    return [isNaN(n) ? fallback : n, args.filter((_, j) => j !== i && j !== i + 1)];
  }
  const short = args.find((a) => /^-\d+$/.test(a));
  if (short) return [parseInt(short.slice(1), 10), args.filter((a) => a !== short)];
  return [fallback, args];
};

function readInputs(s: ComputerState, files: string[], stdin: string[] | null, cmd: string): { lines: string[]; errors: string[] } {
  if (!files.length) return { lines: stdin ?? [], errors: [] };
  const lines: string[] = [];
  const errors: string[] = [];
  for (const f of files) {
    const r = fileLines(s, f, cmd);
    if (typeof r === "string") errors.push(r);
    else lines.push(...r);
  }
  return { lines, errors };
}

function mailMessages(s: ComputerState) {
  const dir = lookup(s.def.fs, homeOf(s.user!) + "/Mail");
  if (!dir || dir.kind !== "dir") return [];
  return Object.entries(dir.children)
    .filter((e): e is [string, VFile] => e[1].kind === "file")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, f]) => {
      const header = (h: string) => f.content.match(new RegExp(`^${h}: (.*)$`, "m"))?.[1] ?? "";
      return { name, file: f, from: header("From"), subject: header("Subject"), date: header("Date") };
    });
}

const pad = (v: string | number, n: number) => String(v).padEnd(n);
const padL = (v: string | number, n: number) => String(v).padStart(n);

const BUILTINS: Record<string, Cmd> = {
  help: () => [
    "Available commands:",
    "  ls [-la] [dir]      list files            cd <dir>        change directory",
    "  cat <file>          print a file          pwd             current directory",
    "  head/tail [-n N]    first/last lines      grep [-in] <pattern> [file]",
    "  wc [-l] [file]      count lines/words     find [dir] -name <pattern>",
    "  mail [n]            read your email       history         past commands",
    "  whoami, hostname, date, uptime, uname [-a], ps, echo, clear",
    "  ip addr, ip route   network interfaces    ping [-c N] <host>",
    "  arp -a              neighbours on the LAN ssh [user@]<host>   log into another machine",
    "  curl <url>          fetch a web page      nmap <host|subnet>  (if installed)",
    "  logout              end session           shutdown        power off",
    "Programs in /usr/local/bin can be run by name. Pipes work: cat file | grep word",
  ],
  pwd: (s) => [s.cwd],
  whoami: (s) => [s.user!],
  hostname: (s) => [s.def.hostname],
  date: (_s, _a, _i, ctx) => [`${ctx.dateText} EDT`],
  uptime: (_s, _a, _i, ctx) => {
    const h = Math.floor(ctx.uptimeMinutes / 60);
    const m = Math.floor(ctx.uptimeMinutes % 60);
    return [` up ${h}:${String(m).padStart(2, "0")},  1 user,  load average: 0.08, 0.03, 0.01`];
  },
  uname: (s, args) => (args.includes("-a") ? [`Linux ${s.def.hostname} 5.4.0-88-generic #99-Ubuntu SMP x86_64 GNU/Linux`] : ["Linux"]),
  echo: (_s, args) => [args.join(" ")],
  clear: (s) => {
    s.screen = [];
    return [];
  },
  history: (s) => s.history.map((h, i) => `${padL(i + 1, 5)}  ${h}`),
  ps: (s) => [
    "  PID TTY          TIME CMD",
    "    1 ?        00:00:03 init",
    "  412 ?        00:00:00 NetworkManager",
    "  988 tty1     00:00:00 bash",
    ...programNames(s).slice(0, 1).map((p) => ` 1022 ?        00:14:51 ${p}d`),
    " 1311 tty1     00:00:00 ps",
  ],
  ls: (s, args) => {
    const flags = args.filter((a) => a.startsWith("-")).join("");
    const long = flags.includes("l");
    const all = flags.includes("a");
    const targets = args.filter((a) => !a.startsWith("-"));
    const out: string[] = [];
    for (const t of targets.length ? targets : ["."]) {
      const { node, denied } = resolve(s, t);
      if (denied) {
        out.push(`ls: cannot open directory '${t}': Permission denied`);
        continue;
      }
      if (!node) {
        out.push(`ls: cannot access '${t}': No such file or directory`);
        continue;
      }
      const entries: [string, VNode][] = node.kind === "dir" ? Object.entries(node.children).sort(([a], [b]) => a.localeCompare(b)) : [[t, node]];
      const shown = entries.filter(([n]) => all || !n.startsWith("."));
      if (targets.length > 1 && node.kind === "dir") out.push(`${t}:`);
      if (long) {
        if (node.kind === "dir") out.push(`total ${shown.length * 4}`);
        for (const [n, c] of shown) {
          const perms = c.kind === "dir" ? (c.private ? "drwx------" : "drwxr-xr-x") : c.program ? "-rwxr-xr-x" : c.private ? "-rw-------" : "-rw-r--r--";
          const size = c.kind === "dir" ? 4096 : c.binary ? 180_000 + (n.length * 7919) % 2_400_000 : c.content.length;
          out.push(`${perms} 1 ${pad(c.owner, 9)}${pad(c.owner, 9)}${padL(size, 8)} ${c.modified} ${n}${c.kind === "dir" ? "/" : ""}`);
        }
      } else if (shown.length) {
        out.push(shown.map(([n, c]) => (c.kind === "dir" ? n + "/" : n)).join("  "));
      }
    }
    return out;
  },
  cd: (s, args) => {
    const target = args[0] ?? "~";
    const { abs, node, denied } = resolve(s, target);
    if (denied) return [`bash: cd: ${target}: Permission denied`];
    if (!node) return [`bash: cd: ${target}: No such file or directory`];
    if (node.kind !== "dir") return [`bash: cd: ${target}: Not a directory`];
    s.cwd = abs;
    return [];
  },
  cat: (s, args, stdin) => {
    const { lines, errors } = readInputs(s, args, stdin, "cat");
    return [...lines, ...errors];
  },
  head: (s, args, stdin) => {
    const [n, rest] = parseN(args, 10);
    const { lines, errors } = readInputs(s, rest, stdin, "head");
    return [...lines.slice(0, n), ...errors];
  },
  tail: (s, args, stdin) => {
    const [n, rest] = parseN(args, 10);
    const { lines, errors } = readInputs(s, rest, stdin, "tail");
    return [...lines.slice(-n), ...errors];
  },
  wc: (s, args, stdin) => {
    const onlyLines = args.includes("-l");
    const { lines, errors } = readInputs(s, args.filter((a) => !a.startsWith("-")), stdin, "wc");
    const words = lines.join(" ").split(/\s+/).filter(Boolean).length;
    const chars = lines.join("\n").length;
    return [onlyLines ? String(lines.length) : `${padL(lines.length, 7)}${padL(words, 8)}${padL(chars, 8)}`, ...errors];
  },
  grep: (s, args, stdin) => {
    const flags = args.filter((a) => a.startsWith("-")).join("");
    const rest = args.filter((a) => !a.startsWith("-"));
    const pattern = rest.shift();
    if (pattern === undefined) return ["usage: grep [-in] PATTERN [FILE...]"];
    let re: RegExp;
    try {
      re = new RegExp(pattern, flags.includes("i") ? "i" : "");
    } catch {
      re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags.includes("i") ? "i" : "");
    }
    const out: string[] = [];
    const sources = rest.length ? rest : [null];
    for (const src of sources) {
      const r = src === null ? stdin ?? [] : fileLines(s, src, "grep");
      if (typeof r === "string") {
        out.push(r);
        continue;
      }
      r.forEach((l, i) => {
        if (re.test(l)) out.push(`${rest.length > 1 ? src + ":" : ""}${flags.includes("n") ? i + 1 + ":" : ""}${l}`);
      });
    }
    return out;
  },
  find: (s, args) => {
    const i = args.indexOf("-name");
    const pattern = i >= 0 ? args[i + 1] ?? "*" : "*";
    const start = args[0] && args[0] !== "-name" ? args[0] : ".";
    const re = new RegExp("^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
    const root = resolve(s, start);
    if (!root.node) return [`find: '${start}': No such file or directory`];
    const out: string[] = [];
    const walk = (node: VNode, path: string) => {
      if (!canRead(s, node)) {
        out.push(`find: '${path}': Permission denied`);
        return;
      }
      if (node.kind !== "dir") return;
      for (const [n, c] of Object.entries(node.children)) {
        const p = path === "/" ? `/${n}` : `${path}/${n}`;
        if (re.test(n)) out.push(p);
        walk(c, p);
      }
    };
    walk(root.node, start === "." ? "." : root.abs);
    return out;
  },
  mail: (s, args) => {
    const msgs = mailMessages(s);
    if (!msgs.length) return [`No mail for ${s.user}`];
    if (args[0]) {
      const n = parseInt(args[0], 10);
      const m = msgs[n - 1];
      if (!m) return [`mail: message ${args[0]} does not exist`];
      return m.file.content.replace(/\n$/, "").split("\n");
    }
    return [
      `Mail for ${s.user}: ${msgs.length} messages. Read one with: mail <number>`,
      ...msgs.map((m, i) => ` ${padL(i + 1, 2)}  ${pad(m.date.slice(0, 17), 18)} ${pad(m.from.slice(0, 26), 27)} ${m.subject}`),
    ];
  },
  ip: (s, args, _i, ctx) => {
    const sub = args[0] ?? "";
    const net = s.def.net;
    const link = linkUp(s, ctx);
    if (sub.startsWith("r")) {
      if (!net || !link || !ctx.network) return [];
      const p = ctx.network.spec.cidr;
      return [`default via ${ctx.network.spec.gateway} dev ${net.iface} proto dhcp metric 100`, `${p} dev ${net.iface} proto kernel scope link src ${net.ip} metric 100`];
    }
    if (sub.startsWith("a") || sub === "") {
      const out = [
        "1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000",
        "    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00",
        "    inet 127.0.0.1/8 scope host lo",
      ];
      if (net) {
        out.push(
          `2: ${net.iface}: <BROADCAST,MULTICAST${link ? ",UP,LOWER_UP" : ""}> mtu 1500 qdisc fq_codel state ${link ? "UP" : "DOWN"} group default qlen 1000`,
          `    link/ether ${net.mac} brd ff:ff:ff:ff:ff:ff`,
        );
        if (link) out.push(`    inet ${net.ip}/24 brd ${net.ip.split(".").slice(0, 3).join(".")}.255 scope global dynamic ${net.iface}`);
      }
      return out;
    }
    return [`Object "${sub}" is unknown, try "ip help".`];
  },
  ifconfig: () => ["", "Command 'ifconfig' not found, but can be installed with:", "", "sudo apt install net-tools", ""],
  ping: (s, args, _i, ctx) => {
    let count = 4;
    const ci = args.indexOf("-c");
    if (ci >= 0) count = Math.max(1, Math.min(10, parseInt(args[ci + 1] ?? "4", 10) || 4));
    const target = args.filter((a, i) => !a.startsWith("-") && i !== ci + 1)[0];
    if (!target) return ["ping: usage error: Destination address required"];
    if (target === "localhost" || target === "127.0.0.1") {
      return [`PING localhost (127.0.0.1) 56(84) bytes of data.`, ...Array.from({ length: count }, (_, i) => `64 bytes from localhost (127.0.0.1): icmp_seq=${i + 1} ttl=64 time=0.0${3 + i} ms`), "", `--- localhost ping statistics ---`, `${count} packets transmitted, ${count} received, 0% packet loss`];
    }
    const net = ctx.network;
    if (!net || !linkUp(s, ctx)) return ["ping: connect: Network is unreachable"];
    const h = resolveHost(net.spec, target);
    if (!h) {
      if (!isIp(target)) return [`ping: ${target}: Temporary failure in name resolution`];
      const gw = net.spec.gateway;
      const local = inSubnet(net.spec, target);
      const lines = Array.from({ length: count }, (_, i) =>
        local ? `From ${net.selfIp} icmp_seq=${i + 1} Destination Host Unreachable` : `From ${gw} icmp_seq=${i + 1} Destination Net Unreachable`,
      );
      return [`PING ${target} (${target}) 56(84) bytes of data.`, ...lines, "", `--- ${target} ping statistics ---`, `${count} packets transmitted, 0 received, +${count} errors, 100% packet loss, time ${count * 1000 - 997}ms`];
    }
    const up = net.isUp(h.ip);
    const times = Array.from({ length: count }, (_, i) => latencyMs(h.ip, i));
    const lines = times.map((t, i) => (up ? `64 bytes from ${h.hostname} (${h.ip}): icmp_seq=${i + 1} ttl=64 time=${t.toFixed(3)} ms` : `From ${net.selfIp} icmp_seq=${i + 1} Destination Host Unreachable`));
    const out = [`PING ${h.hostname} (${h.ip}) 56(84) bytes of data.`, ...lines, "", `--- ${h.hostname} ping statistics ---`];
    if (up) {
      const min = Math.min(...times);
      const max = Math.max(...times);
      const avg = times.reduce((a, b) => a + b, 0) / count;
      out.push(`${count} packets transmitted, ${count} received, 0% packet loss, time ${count * 1000 - 997}ms`, `rtt min/avg/max/mdev = ${min.toFixed(3)}/${avg.toFixed(3)}/${max.toFixed(3)}/${((max - min) / 2).toFixed(3)} ms`);
    } else out.push(`${count} packets transmitted, 0 received, +${count} errors, 100% packet loss, time ${count * 1000 - 997}ms`);
    return out;
  },
  nmap: (s, args, _i, ctx) => {
    if (!lookup(s.def.fs, "/usr/local/bin/nmap") && !lookup(s.def.fs, "/usr/bin/nmap")) {
      return ["", "Command 'nmap' not found, but can be installed with:", "", "sudo apt install nmap", ""];
    }
    const pingOnly = args.includes("-sn");
    const target = args.filter((a) => !a.startsWith("-"))[0];
    if (!target) return ["Nmap 7.80 ( https://nmap.org )", "Usage: nmap [Scan Type(s)] [Options] {target specification}"];
    const date = ctx.dateText;
    const head = `Starting Nmap 7.80 ( https://nmap.org ) at ${date} EDT`;
    const net = ctx.network;
    let targets: NetHost[] = [];
    let total = 1;
    if (net && linkUp(s, ctx)) {
      if (target.endsWith("/24")) {
        total = 256;
        if (inSubnet(net.spec, target.split("/")[0])) targets = net.spec.hosts;
      } else {
        const h = resolveHost(net.spec, target);
        if (h) targets = [h];
        else if (!isIp(target)) return [head, `Failed to resolve "${target}".`, "WARNING: No targets were specified, so 0 hosts scanned."];
      }
    }
    const up = targets.filter((h) => net!.isUp(h.ip));
    const out = [head];
    for (const h of up) {
      out.push(`Nmap scan report for ${h.hostname} (${h.ip})`, `Host is up (0.000${Math.round(latencyMs(h.ip, 0) * 100)}s latency).`);
      if (!pingOnly && h.ip !== net!.selfIp) {
        out.push(`Not shown: ${1000 - h.services.length} closed ports`, "PORT     STATE SERVICE");
        for (const sv of h.services) out.push(`${pad(`${sv.port}/tcp`, 9)}open  ${sv.name}`);
      }
      if (h.ip !== net!.selfIp) out.push(`MAC Address: ${h.mac.toUpperCase()} (${h.vendor})`);
      out.push("");
    }
    if (!up.length && total === 1) out.push("Note: Host seems down. If it is really up, but blocking our ping probes, try -Pn");
    out.push(`Nmap done: ${total} IP address${total > 1 ? "es" : ""} (${up.length} host${up.length === 1 ? "" : "s"} up) scanned in ${((total > 1 ? 4.8 : 0.4) + up.length * 0.21).toFixed(2)} seconds`);
    return out;
  },
  arp: (s, _a, _i, ctx) => {
    const net = ctx.network;
    if (!net || !linkUp(s, ctx) || !s.def.net) return [];
    return net.spec.hosts
      .filter((h) => h.ip !== net.selfIp && h.kind !== "camera" && net.isUp(h.ip))
      .map((h) => `${h.hostname} (${h.ip}) at ${h.mac} [ether] on ${s.def.net!.iface}`);
  },
  curl: (s, args, _i, ctx) => {
    const url = args.filter((a) => !a.startsWith("-"))[0];
    if (!url) return ["curl: try 'curl --help' for more information"];
    const m = url.replace(/^https?:\/\//, "").match(/^([^/:]+)(?::(\d+))?/);
    const hostName = m?.[1] ?? url;
    const port = parseInt(m?.[2] ?? (url.startsWith("https") ? "443" : "80"), 10);
    const net = ctx.network;
    if (!net || !linkUp(s, ctx)) return [`curl: (6) Could not resolve host: ${hostName}`];
    const h = resolveHost(net.spec, hostName);
    if (!h) return isIp(hostName) ? [`curl: (7) Failed to connect to ${hostName} port ${port}: No route to host`] : [`curl: (6) Could not resolve host: ${hostName}`];
    if (!net.isUp(h.ip)) return [`curl: (7) Failed to connect to ${hostName} port ${port}: No route to host`];
    const svc = h.services.find((sv) => sv.port === port);
    if (!svc?.http) return [`curl: (7) Failed to connect to ${hostName} port ${port}: Connection refused`];
    return svc.http.replace(/\n$/, "").split("\n");
  },
  ssh: (s, args, _i, ctx) => {
    const target = args.filter((a) => !a.startsWith("-"))[0];
    if (!target) return ["usage: ssh [-46AaCfGgKkMNnqsTtVvXxYy] [-l login_name] [-p port] destination"];
    const [user, hostName] = target.includes("@") ? (target.split("@") as [string, string]) : [s.user!, target];
    const net = ctx.network;
    if (!net || !linkUp(s, ctx)) return [`ssh: connect to host ${hostName} port 22: Network is unreachable`];
    const h = resolveHost(net.spec, hostName);
    if (!h) {
      if (isIp(hostName)) return [`ssh: connect to host ${hostName} port 22: ${inSubnet(net.spec, hostName) ? "No route to host" : "Network is unreachable"}`];
      return [`ssh: Could not resolve hostname ${hostName}: Name or service not known`];
    }
    if (!net.isUp(h.ip)) return [`ssh: connect to host ${hostName} port 22: No route to host`];
    if (!h.def || !h.services.some((sv) => sv.port === 22)) return [`ssh: connect to host ${hostName} port 22: Connection refused`];
    const known = s.knownHosts.includes(h.ip);
    s.ssh = { ip: h.ip, host: h.hostname, user, stage: known ? "password" : "hostkey", tries: 0 };
    if (known) return [];
    return [
      `The authenticity of host '${h.hostname} (${h.ip})' can't be established.`,
      `ECDSA key fingerprint is SHA256:${fingerprint(h.mac)}.`,
    ];
  },
  man: (_s, args) => (args[0] ? [`No manual entry for ${args[0]}. Try 'help'.`] : ["What manual page do you want?"]),
  sudo: (s) => [`${s.user} is not in the sudoers file.  This incident will be reported.`],
  logout: (s) => {
    s.phase = "login";
    s.user = null;
    s.cwd = "/";
    print(s, "", "logout", "");
    return [];
  },
  exit: (s, a, i, c) => BUILTINS.logout(s, a, i, c),
  shutdown: (s) => {
    if (s.remoteHost) return ["Failed to set wall message, ignoring: Interactive authentication required.", "Failed to power off system via logind: Interactive authentication required."];
    print(s, "Broadcast message: The system is going down for poweroff NOW!", "System halted.");
    s.phase = "off";
    s.user = null;
    return [];
  },
};

/** Does this machine currently have a network link? (Wi-Fi needs a live router.) */
function linkUp(s: ComputerState, ctx: ComputerContext): boolean {
  const net = s.def.net;
  if (!net || !ctx.network) return false;
  if (!ctx.network.isUp(ctx.network.selfIp)) return false;
  return net.iface === "eth0" || ctx.network.isUp(ctx.network.spec.gateway);
}

function fingerprint(mac: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let h = 2166136261;
  let out = "";
  for (let i = 0; i < 43; i++) {
    h = Math.imul(h ^ mac.charCodeAt(i % mac.length) ^ i, 16777619) >>> 0;
    out += chars[h % 64];
  }
  return out;
}

/** Command names the shell understands (for tests and the help screen). */
export const SHELL_COMMANDS = Object.keys(BUILTINS);
