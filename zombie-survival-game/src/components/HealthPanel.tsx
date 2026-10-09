import type { BodyPart } from "@/sim/body";
import type { HudState, WoundView } from "@/game/types";

const PARTS: { part: BodyPart; shape: JSX.Element }[] = [
  { part: "head", shape: <rect x="40" y="4" width="20" height="22" rx="8" /> },
  { part: "torso", shape: <rect x="34" y="30" width="32" height="44" rx="4" /> },
  { part: "leftArm", shape: <rect x="20" y="31" width="11" height="44" rx="4" /> },
  { part: "rightArm", shape: <rect x="69" y="31" width="11" height="44" rx="4" /> },
  { part: "leftLeg", shape: <rect x="35" y="78" width="14" height="50" rx="4" /> },
  { part: "rightLeg", shape: <rect x="51" y="78" width="14" height="50" rx="4" /> },
];

/** Colour a body part by the worst thing wrong with it. */
const partClass = (wounds: WoundView[]) => {
  if (wounds.some((w) => w.bleeding)) return "fill-red-600";
  if (wounds.some((w) => !w.bandaged)) return "fill-amber-500";
  if (wounds.length) return "fill-stone-300";
  return "fill-stone-700";
};

const woundLabel: Record<string, string> = {
  scratch: "Scratch",
  laceration: "Laceration",
  bite: "Bite",
  gunshot: "Gunshot wound",
};

const Vital = ({ label, value, warn }: { label: string; value: string; warn?: boolean }) => (
  <div className="flex items-baseline justify-between gap-4">
    <dt className="text-xs uppercase tracking-[0.15em] text-stone-500">{label}</dt>
    <dd className={`tabular-nums ${warn ? "text-amber-400" : "text-stone-200"}`}>{value}</dd>
  </div>
);

const HealthPanel = ({ hud, onTreat }: { hud: HudState; onTreat: (woundId: number) => void }) => {
  // Blood percent maps 0..100 onto 3.0..5.0 litres.
  const litres = 3 + (hud.blood / 100) * 2;
  return (
    <section className="flex max-h-[70vh] min-w-0 flex-1 flex-col rounded-sm bg-stone-950/90 ring-1 ring-white/10">
      <header className="border-b border-white/10 px-3 py-2">
        <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-stone-200">Health</h2>
      </header>
      <div className="flex gap-4 overflow-y-auto p-3">
        <svg viewBox="0 0 100 132" className="h-48 w-auto shrink-0" role="img" aria-label="Body diagram">
          {PARTS.map(({ part, shape }) => (
            <g key={part} className={partClass(hud.wounds.filter((w) => w.part === part))}>
              {shape}
            </g>
          ))}
        </svg>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <dl className="flex flex-col gap-0.5">
            <Vital label="Condition" value={`${Math.round(hud.health)}%`} warn={hud.health < 50} />
            <Vital label="Blood" value={`${litres.toFixed(1)} L`} warn={hud.blood < 60} />
            <Vital label="Body temp" value={`${hud.bodyTemp.toFixed(1)}°C`} warn={hud.bodyTemp < 36 || hud.bodyTemp > 37.8} />
            <Vital label="Fatigue" value={`${Math.round(hud.fatigue)}%`} warn={hud.fatigue > 60} />
            <Vital label="Pain" value={hud.pain < 5 ? "None" : `${Math.round(hud.pain)}%`} warn={hud.pain > 35} />
          </dl>
          <ul className="flex flex-col gap-1">
            {hud.wounds.length === 0 && <li className="text-stone-500">No wounds.</li>}
            {hud.wounds.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-2 border-t border-white/5 pt-1">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-stone-100">
                    {woundLabel[w.kind]} <span className="font-normal text-stone-400">· {w.partName}</span>
                  </div>
                  <div className={`text-xs ${w.bleeding ? "text-red-400" : w.bandaged ? "text-stone-400" : "text-amber-400"}`}>
                    {w.bleeding ? "Bleeding" : w.bandaged ? "Bandaged" : "Open"} · {Math.round((1 - w.severity) * 100)}% healed
                  </div>
                </div>
                {!w.bandaged && hud.canBandage && (
                  <button
                    onClick={() => onTreat(w.id)}
                    className="shrink-0 rounded-sm bg-stone-200 px-2 py-0.5 text-sm font-semibold uppercase tracking-wider text-black hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                  >
                    Bandage
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default HealthPanel;
