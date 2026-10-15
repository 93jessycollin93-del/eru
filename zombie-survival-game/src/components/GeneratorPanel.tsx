import { useEffect, type ReactNode } from "react";
import type { HudState } from "@/game/types";

type Action = "start" | "stop" | "refuel" | "reset" | "connect" | "disconnect" | "pickup";

const Gauge = ({ label, value, max, unit, warn }: { label: string; value: number; max: number; unit: string; warn?: boolean }) => (
  <div>
    <div className="flex justify-between text-xs uppercase tracking-[0.15em] text-stone-500">
      <span>{label}</span>
      <span className={`tabular-nums ${warn ? "text-amber-400" : "text-stone-300"}`}>
        {value.toFixed(unit === "L" ? 1 : 0)} / {max} {unit}
      </span>
    </div>
    <div className="mt-1 h-2 overflow-hidden rounded-sm bg-black/60 ring-1 ring-white/10">
      <div className={`h-full ${warn ? "bg-amber-500" : "bg-stone-300"}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  </div>
);

const Btn = ({ onClick, children, disabled }: { onClick: () => void; children: ReactNode; disabled?: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="rounded-sm bg-stone-200 px-3 py-1.5 text-sm font-semibold uppercase tracking-wider text-black transition hover:bg-white disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
  >
    {children}
  </button>
);

const GeneratorPanel = ({ gen, onAction, onClose }: { gen: NonNullable<HudState["generator"]>; onAction: (a: Action) => void; onClose: () => void }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const state = gen.tripped ? "Breaker tripped" : gen.running ? "Running" : gen.fuelL <= 0 ? "Out of fuel" : "Stopped";
  const stateTone = gen.tripped ? "text-red-400" : gen.running ? "text-lime-300" : "text-stone-400";

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/55 p-4 font-ui">
      <section className="w-full max-w-md rounded-sm bg-stone-950/95 p-4 ring-1 ring-white/10">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold uppercase tracking-[0.15em] text-stone-100">{gen.name}</h2>
            <p className={`text-sm font-semibold uppercase tracking-[0.15em] ${stateTone}`}>{state}</p>
          </div>
          <button onClick={onClose} className="text-sm uppercase tracking-wider text-stone-400 hover:text-stone-100 focus:outline-none focus-visible:underline">
            Close
          </button>
        </header>

        <div className="mt-4 flex flex-col gap-3">
          <Gauge label="Fuel" value={gen.fuelL} max={gen.tankL} unit="L" warn={gen.fuelL < gen.tankL * 0.15} />
          <Gauge label="Load" value={gen.loadW} max={gen.ratedW} unit="W" warn={gen.loadW > gen.ratedW * 0.85} />
          <div className="text-sm text-stone-300">
            {gen.connectedTo ? (
              <>Feeding <span className="font-semibold text-stone-100">{gen.connectedTo}</span></>
            ) : gen.inReach ? (
              <>Not connected. Cable reaches <span className="font-semibold text-stone-100">{gen.inReach}</span>.</>
            ) : (
              "Not connected. Move it within 8 m of a building."
            )}
          </div>
          {gen.autoStart && !gen.portable && (
            <p className="text-sm text-stone-400">Transfer switch: AUTO. It starts on its own when the grid fails, if there is fuel.</p>
          )}
          <p className="text-xs text-stone-500">
            You carry {gen.fuelCarried.toFixed(1)} L of fuel. A running engine can be heard a long way off.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {gen.running ? <Btn onClick={() => onAction("stop")}>Stop</Btn> : <Btn onClick={() => onAction("start")} disabled={gen.fuelL <= 0}>Start</Btn>}
          <Btn onClick={() => onAction("refuel")} disabled={!gen.canRefuel}>Refuel</Btn>
          {gen.tripped && <Btn onClick={() => onAction("reset")}>Reset breaker</Btn>}
          {gen.portable && (gen.connectedTo ? <Btn onClick={() => onAction("disconnect")}>Unplug</Btn> : <Btn onClick={() => onAction("connect")} disabled={!gen.inReach}>Connect</Btn>)}
          {gen.portable && <Btn onClick={() => onAction("pickup")} disabled={gen.running}>Pick up</Btn>}
        </div>
      </section>
    </div>
  );
};

export default GeneratorPanel;
