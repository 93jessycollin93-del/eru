/**
 * In-world computers: a virtual filesystem and a small Unix-like shell.
 *
 * Engine-agnostic and serialisable: a computer is plain data (ComputerDef +
 * ComputerState); programs are data too (lines to print), so the whole thing
 * can be saved or reimplemented in another engine without behaviour changes.
 */

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
}

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
}

export interface ComputerContext {
  /** Real milliseconds, for login lockouts. */
  nowMs: number;
  /** "Fri Oct 23 07:42" */
  dateText: string;
  /** Minutes since the machine was booted, for uptime. */
  uptimeMinutes: number;
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
  };
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
    return s.def.programs[node.program] ?? [`${name}: segmentation fault (core dumped)`];
  }
  if (node?.kind === "file") return [`bash: ${name}: Permission denied`];
  return [`${name}: command not found`];
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
      ...msgs.map((m, i) => ` ${padL(i + 1, 2)}  ${pad(m.date.slice(0, 16), 17)} ${pad(m.from.slice(0, 26), 27)} ${m.subject}`),
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
    print(s, "Broadcast message: The system is going down for poweroff NOW!", "System halted.");
    s.phase = "off";
    s.user = null;
    return [];
  },
};

/** Command names the shell understands (for tests and the help screen). */
export const SHELL_COMMANDS = Object.keys(BUILTINS);
