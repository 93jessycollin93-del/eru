import type { ReactNode } from "react";
import type { HudState } from "@/game/types";

interface OverlayProps {
  hud: HudState;
  onStart: () => void;
  onResume: () => void;
  onQuality: (q: "low" | "high") => void;
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

const Overlay = ({ hud, onStart, onResume, onQuality }: OverlayProps) => {
  if (hud.status === "playing") {
    // Mouse was released (e.g. Esc closed a menu): one click recaptures it.
    if (!hud.locked && !hud.inventoryOpen && !hud.container && !hud.computer && !hud.reading && !hud.generator) {
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
              <div className="mt-8">
                <Button onClick={onStart}>Begin</Button>
              </div>
              <QualityToggle value={hud.quality} onChange={onQuality} />
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
            <div className="mt-10">
              <Button onClick={onStart}>Try again</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Overlay;
