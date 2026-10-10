/**
 * Local networks for in-world electronics. Engine-agnostic.
 *
 * Each building with electronics has one LAN (/24). The internet is down:
 * traffic for anything outside the LAN dies at the router. A device only
 * answers while it has power, which the game decides (grid, UPS, battery).
 */
import type { ComputerDef } from "./computer";

export type HostKind = "router" | "computer" | "server" | "nvr" | "camera" | "printer" | "tv" | "controller";

export interface NetService {
  port: number;
  name: string;
  /** Text an HTTP request (curl) gets back, if any. */
  http?: string;
}

export interface NetHost {
  ip: string;
  hostname: string;
  mac: string;
  vendor: string;
  kind: HostKind;
  services: NetService[];
  /** Machines you can log into over ssh. */
  def?: ComputerDef;
  /** Camera metadata: the client places a real camera in the world for it. */
  camera?: { channel: number; label: string; mount: "front" | "side" | "desk" | "back" };
  /** Door controller metadata: the client wires these names to physical doors. */
  access?: { doors: AccessDoor[] };
}

/** A door wired to an access controller (static config; live state comes from AccessView). */
export interface AccessDoor {
  name: string;
  label: string;
  /** maglock fails safe (releases without power), strike fails secure (stays locked). */
  mode: "maglock" | "strike";
  /** Keypad code, or null for a door without a reader. */
  pin: string | null;
}

/** One door as the controller sees it right now. */
export interface AccessDoorStatus {
  name: string;
  label: string;
  mode: AccessDoor["mode"];
  /** What the controller was last told. */
  commanded: "locked" | "unlocked";
  /** Whether the lock holds right now (after power and momentary pulses). */
  locked: boolean;
  open: boolean;
}

/**
 * Live door state for a controller's shell, supplied by the game each call.
 * Functions rather than data so the shell always reads the current state.
 */
export interface AccessView {
  /** Hostname of the controller this view drives. */
  controller: string;
  doors(): AccessDoorStatus[];
  power(): { source: "mains" | "ups"; upsPercent: number | null };
}

export interface NetworkSpec {
  id: string;
  /** e.g. "10.0.4.0/24" */
  cidr: string;
  gateway: string;
  hosts: NetHost[];
  /** Minutes the UPS keeps the network alive after mains power fails (0 = none). */
  upsMinutes: number;
}

/** What a shell needs to talk to its LAN, supplied by the game each call. */
export interface NetworkView {
  spec: NetworkSpec;
  /** This machine's address on the LAN. */
  selfIp: string;
  isUp: (ip: string) => boolean;
}

export const prefix = (cidr: string) => cidr.split("/")[0].split(".").slice(0, 3).join(".");

export const inSubnet = (spec: NetworkSpec, ip: string) => ip.startsWith(prefix(spec.cidr) + ".");

export function resolveHost(spec: NetworkSpec, name: string): NetHost | undefined {
  return spec.hosts.find((h) => h.ip === name || h.hostname === name || h.hostname.split(".")[0] === name);
}

export const isIp = (s: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s);

/** Fake but stable round-trip time for a host. */
export function latencyMs(ip: string, seq: number): number {
  const last = parseInt(ip.split(".").pop() ?? "1", 10);
  return 0.25 + ((last * 37 + seq * 13) % 40) / 100;
}

export function macFor(seed: number, vendorPrefix: string): string {
  const b = (n: number) => ((seed * (n + 7) * 2654435761) >>> 0) % 256;
  return `${vendorPrefix}:${[b(1), b(2), b(3)].map((x) => x.toString(16).padStart(2, "0")).join(":")}`;
}

/** /etc/hosts for a machine on this network. */
export function hostsFile(spec: NetworkSpec): string {
  const lines = ["127.0.0.1\tlocalhost", "::1\t\tlocalhost ip6-localhost", ""];
  for (const h of spec.hosts) if (h.kind !== "camera") lines.push(`${h.ip}\t${h.hostname}`);
  return lines.join("\n") + "\n";
}
