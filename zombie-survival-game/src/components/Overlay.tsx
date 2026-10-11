import { useEffect, useState, type ReactNode } from "react";
import type { HudState } from "@/game/types";

type Slot = "auto" | "1" | "2" | "3";

interface OverlayProps {
  hud: HudState;
  onStart: () => void;
  onResume: () => void;
  onQuality: (q: "low" | "high") => void;
  onSave: (slot: Slot) => void;
  onLoad: (slot: Slot) => void;
  onDelete: (slot: Slot) => void;
}

const CONTROLS: [string, string][] = [
  ["Move", "W A S D"],
  ["Look", "Mouse"],
  ["Sprint", "Shift"],
  ["Walk quietly", "Alt (hold)"],
  ["Crouch", "C"],
  ["Jump", "Space"],
  ["Attack / shoot", "Left click"],
  ["Aim", "Right click (hold)"],
  ["Reload", "R"],
  ["Search", "E"],
  ["Inventory / health", "Tab"],
  ["Bandage worst wound", "B"],
  ["Sleep", "Z"],
  ["Doors: open / deadbolt", "E / Q"],
  ["Windows: break, climb / clear shards", "E / Q"],
  ["Board up / pry off (needs a hammer)", "Hold H / Shift+H"],
  ["Lights (in a building)", "L"],
  ["Weapons", "1–5, 0 to holster"],
  ["Flashlight", "F"],
  ["Pause", "Esc"],
];

const Controls = () => (
  <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-0.5 text-left text-base">
    {CONTROLS.map(([action, key]) => (
      <div key={action} className="contents">
        <dt className="uppercase tracking-[0.12em] text-stone-500">{action}</dt>
        <dd className="text-stone-200">{key}</dd>
      </div>
    ))}
  </dl>
);

const Button = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button
    onClick={onClick}
    className="rounded-sm bg-stone-200 px-10 py-3 font-display text-2xl uppercase tracking-[0.15em] text-black transition hover:bg-white focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/60"
  >
    {children}
  </button>
);

const survivedText = (minutes: number) => {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const parts = [];
  if (days) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  return parts.join(", ");
};

const clock = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")}`;

/**
 * Save slots. In the pause menu each player slot can be written; everywhere a
 * filled slot can be loaded. The autosave is its own row. Anything that throws
 * work away (overwriting, deleting, loading over the run you're in) asks for a
 * second click.
 */
const SaveSlots = ({ hud, canSave, onSave, onLoad, onDelete }: { hud: HudState; canSave: boolean } & Pick<OverlayProps, "onSave" | "onLoad" | "onDelete">) => {
  const [armed, setArmed] = useState<string | null>(null);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(null), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  const rows: Slot[] = canSave ? ["auto", "1", "2", "3"] : (["auto", "1", "2", "3"] as Slot[]).filter((s) => hud.saves.some((x) => x.slot === s));
  if (!rows.length) return null;
  /** Run `act` now, or on a second click within 3 s when `confirm` is set. */
  const guarded = (key: string, confirm: boolean, act: () => void) => () => {
    if (!confirm || armed === key) {
      setArmed(null);
      act();
    } else setArmed(key);
  };
  const label = (key: string, text: string) => (armed === key ? "Sure?" : text);
  return (
    <div className="rounded-sm bg-black/40 p-4 ring-1 ring-white/10">
      <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-stone-400">{canSave ? "Save / load" : "Load"}</h3>
      {!hud.savesPersistent && (
        <p className="mt-2 text-sm text-amber-300">This browser won't keep saves after you close the tab (private window or blocked storage).</p>
      )}
      {hud.loadError && hud.status !== "playing" && <p className="mt-2 text-sm text-red-400">{hud.loadError}</p>}
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map((slot) => {
          const s = hud.saves.find((x) => x.slot === slot);
          return (
            <li key={slot} className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="w-20 text-sm font-semibold uppercase tracking-[0.15em] text-stone-300">{slot === "auto" ? "Autosave" : `Slot ${slot}`}</span>
              <span className={`min-w-0 flex-1 text-sm tabular-nums ${s?.broken ? "text-red-400/80" : "text-stone-400"}`}>
                {s ? `${s.broken ? "Can't load · " : ""}Day ${s.day}, ${clock(s.timeOfDay)} · ${s.location ?? "Outdoors"} · ${s.kills} killed` : "Empty"}
              </span>
              <span className="flex gap-2">
                {canSave && slot !== "auto" && (
                  <SmallButton onClick={guarded(`save:${slot}`, !!s, () => onSave(slot))}>{label(`save:${slot}`, s ? "Overwrite" : "Save")}</SmallButton>
                )}
                {s && !s.broken && (
                  <SmallButton onClick={guarded(`load:${slot}`, canSave, () => onLoad(slot))}>{label(`load:${slot}`, "Load")}</SmallButton>
                )}
                {s && (slot !== "auto" || !canSave) && (
                  <SmallButton quiet onClick={guarded(`del:${slot}`, true, () => onDelete(slot))}>
                    {label(`del:${slot}`, "Delete")}
                  </SmallButton>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const SmallButton = ({ onClick, children, quiet }: { onClick: () => void; children: ReactNode; quiet?: boolean }) => (
  <button
    onClick={onClick}
    className={`rounded-sm px-3 py-1 text-sm font-semibold uppercase tracking-wider transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
      quiet ? "text-stone-400 ring-1 ring-white/15 hover:text-stone-100" : "bg-stone-200 text-black hover:bg-white"
    }`}
  >
    {children}
  </button>
);

const QualityToggle = ({ value, onChange }: { value: "low" | "high"; onChange: (q: "low" | "high") => void }) => (
  <div className="mt-6 flex items-center gap-3 text-sm uppercase tracking-[0.15em] text-stone-400">
    Graphics
    {(["high", "low"] as const).map((q) => (
      <button
        key={q}
        onClick={() => onChange(q)}
        aria-pressed={value === q}
        className={`rounded-sm px-3 py-1 font-semibold ring-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
          value === q ? "bg-stone-200 text-black ring-stone-200" : "text-stone-300 ring-white/20 hover:bg-white/10"
        }`}
      >
        {q}
      </button>
    ))}
  </div>
);

const Overlay = ({ hud, onStart, onResume, onQuality, onSave, onLoad, onDelete }: OverlayProps) => {
  const newest = hud.saves.filter((s) => !s.broken).sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0];
  if (hud.status === "playing") {
    // Mouse was released (e.g. Esc closed a menu): one click recaptures it.
    if (!hud.locked && !hud.inventoryOpen && !hud.container && !hud.computer && !hud.reading && !hud.generator && !hud.keypad) {
      return (
        <button
          onClick={onResume}
          className="absolute inset-0 flex items-center justify-center bg-black/30 font-ui text-xl uppercase tracking-[0.3em] text-stone-200"
        >
          Click to continue
        </button>
      );
    }
    return null;
  }

  return (
    <div className="absolute inset-0 overflow-y-auto bg-gradient-to-t from-black/90 via-black/60 to-black/30 font-ui">
      <div className="mx-auto flex min-h-full max-w-5xl flex-col justify-center gap-10 px-6 py-10">
        {hud.status === "loading" && (
          <p className="text-center text-xl uppercase tracking-[0.3em] text-stone-300">Building the town…</p>
        )}

        {hud.status === "menu" && (
          <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <p className="mb-3 text-sm uppercase tracking-[0.35em] text-stone-400">Coldwater, Marlow County · Day 1</p>
              <h1 className="font-display text-7xl font-black uppercase leading-[0.85] text-stone-100 sm:text-8xl">
                Zombie
                <br />
                Survival
              </h1>
              <p className="mt-5 max-w-md text-lg leading-snug text-stone-300">
                The town went quiet three weeks ago. You have a bottle of water, a cereal bar and a bandage. Scavenge
                what you can, keep your head down, and don't fire a gun unless you mean it.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {newest && <Button onClick={() => onLoad(newest.slot)}>Continue</Button>}
                <Button onClick={onStart}>{newest ? "New game" : "Begin"}</Button>
              </div>
              <QualityToggle value={hud.quality} onChange={onQuality} />
              <div className="mt-6">
                <SaveSlots hud={hud} canSave={false} onSave={onSave} onLoad={onLoad} onDelete={onDelete} />
              </div>
            </div>
            <div className="rounded-sm bg-black/40 p-5 ring-1 ring-white/10">
              <Controls />
            </div>
          </div>
        )}

        {hud.status === "paused" && (
          <div className="flex flex-col items-start gap-8 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="font-display text-7xl font-black uppercase text-stone-100">Paused</h2>
              <p className="mt-2 text-stone-400">The world keeps still while you catch your breath.</p>
              <div className="mt-8">
                <Button onClick={onResume}>Resume</Button>
              </div>
              <QualityToggle value={hud.quality} onChange={onQuality} />
              <div className="mt-6">
                <SaveSlots hud={hud} canSave onSave={onSave} onLoad={onLoad} onDelete={onDelete} />
              </div>
            </div>
            <div className="rounded-sm bg-black/40 p-5 ring-1 ring-white/10">
              <Controls />
            </div>
          </div>
        )}

        {hud.status === "dead" && (
          <div className="mx-auto max-w-lg text-center">
            <p className="font-note text-2xl text-stone-300">This is how you died.</p>
            <h2 className="mt-4 font-display text-6xl font-black uppercase text-red-700 sm:text-7xl">
              {hud.causeOfDeath || "You died"}
            </h2>
            <div className="mt-6 space-y-1 font-note text-lg text-stone-300">
              <p>You survived {survivedText(hud.survivedMinutes)}.</p>
              {hud.turned && <p className="text-red-400">A few minutes later, you got back up.</p>}
              <p>
                {hud.kills} {hud.kills === 1 ? "zombie" : "zombies"} put down.
              </p>
            </div>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Button onClick={onStart}>Try again</Button>
            </div>
            <div className="mx-auto mt-6 max-w-xl text-left">
              <SaveSlots hud={hud} canSave={false} onSave={onSave} onLoad={onLoad} onDelete={onDelete} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Overlay;
