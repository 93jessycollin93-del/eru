import type { HudState } from "@/game/types";

interface HudProps {
  hud: HudState;
}

const Hud = ({ hud }: HudProps) => {
  const hpPct = Math.max(0, (hud.hp / hud.maxHp) * 100);
  const hpColor = hpPct > 50 ? "bg-green-500" : hpPct > 25 ? "bg-yellow-500" : "bg-red-600";

  return (
    <div className="pointer-events-none absolute inset-0 select-none p-4 font-mono text-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="w-48 space-y-1 sm:w-64">
          <div className="text-xs uppercase tracking-widest text-neutral-400">Health</div>
          <div className="h-3 overflow-hidden rounded bg-neutral-800/80">
            <div className={`h-full transition-all ${hpColor}`} style={{ width: `${hpPct}%` }} />
          </div>
          <div className="text-neutral-300">
            {hud.hp} / {hud.maxHp}
          </div>
        </div>

        <div className="text-center">
          <div className="font-display text-3xl text-red-500 drop-shadow">Wave {hud.wave || "—"}</div>
          <div className="text-neutral-400">
            {hud.intermission > 0 ? `Next wave in ${hud.intermission}…` : `${hud.zombiesLeft} zombies left`}
          </div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold text-amber-300">{hud.score.toLocaleString()}</div>
          <div className="text-neutral-400">{hud.kills} kills</div>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 text-right">
        <div className="text-3xl font-bold">
          {hud.reloading ? (
            <span className="text-amber-300">Reloading…</span>
          ) : (
            <>
              <span className={hud.mag === 0 ? "text-red-500" : "text-neutral-100"}>{hud.mag}</span>
              <span className="text-neutral-500"> / {hud.reserve}</span>
            </>
          )}
        </div>
        {!hud.reloading && hud.mag === 0 && hud.reserve > 0 && (
          <div className="text-red-400">Press R to reload</div>
        )}
        {hud.mag === 0 && hud.reserve === 0 && <div className="text-red-400">Out of ammo!</div>}
      </div>
    </div>
  );
};

export default Hud;
