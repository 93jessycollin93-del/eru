import type { HudState } from "@/game/types";

interface HudProps {
  hud: HudState;
}

const formatClock = (minutes: number) => {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/** A labelled vertical stat bar, DayZ-style, that turns red as it runs low. */
const Stat = ({ label, value, warnAt = 30 }: { label: string; value: number; warnAt?: number }) => {
  const low = value <= warnAt;
  const critical = value <= warnAt / 2;
  return (
    <div className="flex w-9 flex-col items-center gap-1">
      <div className="relative h-16 w-2.5 overflow-hidden rounded-sm bg-black/50 ring-1 ring-white/10">
        <div
          className={`absolute bottom-0 left-0 right-0 transition-[height] duration-300 ${
            critical ? "bg-red-600 animate-pulse-red" : low ? "bg-amber-500" : "bg-stone-200/80"
          }`}
          style={{ height: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      <span className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${low ? "text-amber-400" : "text-stone-400"}`}>
        {label}
      </span>
    </div>
  );
};

const toneClass: Record<string, string> = {
  info: "text-stone-200",
  warn: "text-amber-300",
  danger: "text-red-400",
  good: "text-lime-300",
};

const Hud = ({ hud }: HudProps) => {
  const lowHealth = hud.health < 30;
  const firearm = hud.equipped.magSize !== undefined;

  return (
    <div className="pointer-events-none absolute inset-0 select-none font-ui">
      {/* Damage and low-health vignettes */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 45%, rgba(120,0,0,0.85) 100%)",
          opacity: Math.max(hud.damageFlash * 0.9, lowHealth ? 0.35 + (30 - hud.health) / 60 : 0),
        }}
      />

      {/* Messages */}
      <div className="absolute left-4 top-4 flex max-w-sm flex-col gap-1">
        {hud.messages.map((m) => (
          <div key={m.id} className={`text-base font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] ${toneClass[m.tone]}`}>
            {m.text}
          </div>
        ))}
      </div>

      {/* Clock */}
      <div className="absolute right-4 top-4 rounded-sm bg-black/30 px-2.5 py-1.5 text-right drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
        <div className="text-2xl font-semibold tabular-nums tracking-wider text-stone-100">
          {formatClock(hud.timeOfDay)}
        </div>
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-200">
          Day {hud.day} · {hud.kills} killed
        </div>
        <div className="text-sm tabular-nums text-stone-300">
          {Math.round(hud.airTemp)}°C {hud.sheltered ? "· indoors" : ""}
        </div>
        <div className="max-w-[16rem] truncate text-sm text-stone-300">{hud.location ?? hud.townName}</div>
        {hud.power && (
          <div className={`text-xs uppercase tracking-[0.2em] ${hud.power === "none" ? "text-stone-500" : hud.power === "ups" ? "text-amber-300/80" : "text-lime-300/80"}`}>
            {hud.power === "grid" ? "Mains power" : hud.power === "generator" ? "Generator power" : hud.power === "ups" ? "Battery backup" : "No power"}
          </div>
        )}
        {!hud.gridOn && !hud.power && <div className="text-xs uppercase tracking-[0.2em] text-amber-300/80">Grid down</div>}
        {hud.flashlight && <div className="text-xs uppercase tracking-[0.2em] text-amber-200/80">Flashlight on</div>}
      </div>

      {/* Moodles: status effects, most urgent first */}
      <div className="absolute right-4 top-32 flex w-44 flex-col items-end gap-1">
        {hud.moodles.map((m) => (
          <div
            key={m.id}
            className={`flex items-center gap-2 rounded-sm px-2 py-0.5 text-sm font-semibold uppercase tracking-[0.1em] ring-1 ${
              m.tone === "good"
                ? "bg-lime-950/60 text-lime-300 ring-lime-400/30"
                : m.level >= 3
                  ? "bg-red-950/70 text-red-300 ring-red-500/50"
                  : "bg-black/50 text-amber-200 ring-amber-300/25"
            } ${m.level >= 4 ? "animate-pulse-red" : ""}`}
            title={m.detail}
          >
            {m.label}
            <span className="flex gap-0.5" aria-label={`level ${m.level}`}>
              {[1, 2, 3, 4].map((i) => (
                <span key={i} className={`h-2 w-1 rounded-[1px] ${i <= m.level ? "bg-current" : "bg-white/10"}`} />
              ))}
            </span>
          </div>
        ))}
      </div>

      {/* Sleep */}
      {hud.asleep && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90">
          <div className="font-note text-2xl text-stone-300">Sleeping…</div>
          <div className="mt-2 text-4xl font-semibold tabular-nums text-stone-100">{formatClock(hud.timeOfDay)}</div>
          <div className="mt-4 text-sm uppercase tracking-[0.2em] text-stone-500">Press Z to get up</div>
        </div>
      )}

      {/* Crosshair */}
      {hud.crosshair && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className={`rounded-full bg-white/90 shadow ${hud.aiming ? "h-1 w-1" : "h-1.5 w-1.5 opacity-70"}`} />
        </div>
      )}

      {/* Interaction prompt */}
      {hud.prompt && (
        <div className="absolute left-1/2 top-[58%] -translate-x-1/2 rounded bg-black/55 px-3 py-1.5 text-base text-stone-100 ring-1 ring-white/10">
          <span className="mr-2 rounded-sm bg-stone-200 px-1.5 font-bold text-black">E</span>
          {hud.prompt}
        </div>
      )}

      {/* Hunted warning */}
      {hud.hunted && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 text-sm font-semibold uppercase tracking-[0.3em] text-red-500 animate-pulse-red drop-shadow">
          Hunted
        </div>
      )}

      {/* Status */}
      <div className="absolute bottom-4 left-4 flex items-end gap-1.5 rounded bg-black/35 px-2 pb-1.5 pt-2.5 ring-1 ring-white/5">
        <Stat label="HP" value={hud.health} />
        <Stat label="Blood" value={hud.blood} warnAt={60} />
        <Stat label="Food" value={hud.hunger} warnAt={25} />
        <Stat label="Water" value={hud.thirst} warnAt={25} />
        <Stat label="Stam" value={hud.stamina} warnAt={20} />
        <div className="ml-1 flex flex-col justify-end gap-1 pb-5 text-xs font-semibold uppercase tracking-[0.15em]">
          {hud.crouching && <span className="text-stone-300">Crouched</span>}
          {hud.carryWeight > hud.maxWeight && <span className="text-amber-400">Overloaded</span>}
          <span className="text-stone-500">
            Noise
            <span className="ml-1.5 inline-block h-1.5 w-10 overflow-hidden rounded-sm bg-black/50 align-middle">
              <span
                className={`block h-full ${hud.noise > 0.6 ? "bg-red-500" : hud.noise > 0.25 ? "bg-amber-400" : "bg-stone-300"}`}
                style={{ width: `${hud.noise * 100}%` }}
              />
            </span>
          </span>
        </div>
      </div>

      {/* Hotbar */}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1">
        {[1, 2, 3, 4, 5].map((slot) => {
          const item = hud.hotbar.find((h) => h.slot === slot);
          return (
            <div
              key={slot}
              className={`flex h-12 w-24 flex-col justify-between rounded-sm px-1.5 py-1 text-left ring-1 max-sm:w-14 ${
                item?.active ? "bg-stone-200/20 ring-stone-200/70" : "bg-black/45 ring-white/10"
              }`}
            >
              <span className="text-[11px] font-bold text-stone-400">{slot}</span>
              <span className="truncate text-sm leading-tight text-stone-200">{item?.name ?? ""}</span>
            </div>
          );
        })}
      </div>

      {/* Equipped weapon */}
      <div className="absolute bottom-4 right-4 rounded-sm bg-black/30 px-2.5 py-1.5 text-right drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-200">{hud.equipped.name}</div>
        {firearm && (
          <div className="text-3xl font-semibold tabular-nums text-stone-100">
            {hud.equipped.reloading ? (
              <span className="text-amber-300">Reloading</span>
            ) : (
              <>
                <span className={hud.equipped.loaded ? "" : "text-red-500"}>{hud.equipped.loaded ?? 0}</span>
                <span className="text-stone-500"> / {hud.equipped.reserve ?? 0}</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Hud;
