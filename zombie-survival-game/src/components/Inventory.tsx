import { useState, type ReactNode } from "react";
import { ITEMS, type ItemStack } from "@/sim/items";
import { freshStage } from "@/sim/freshness";
import { itemOrigin } from "@/sim/lineage";
import type { HudState } from "@/game/types";
import HealthPanel from "./HealthPanel";

export interface InventoryActions {
  use: (uid: number) => void;
  drop: (uid: number) => void;
  take: (uid: number) => void;
  takeAll: () => void;
  put: (uid: number) => void;
  treat: (woundId: number) => void;
  siphon: () => void;
  fillTank: () => void;
  repairCar: (id: string) => void;
  fillBottles: () => void;
  craft: (id: string) => void;
  close: () => void;
}

const FRESH_STYLE = { fresh: "text-emerald-400", stale: "text-amber-300", spoiled: "text-orange-500", rotten: "text-red-500" } as const;

const categoryLabel: Record<string, string> = {
  food: "Food",
  drink: "Drink",
  medical: "Medical",
  melee: "Melee",
  firearm: "Firearm",
  ammo: "Ammo",
  tool: "Tool",
  note: "Note",
};

const useLabel = (s: ItemStack, equippedUid: number | null) => {
  const def = ITEMS[s.id];
  switch (def.category) {
    case "food":
      return "Eat";
    case "drink":
      return "Drink";
    case "medical":
      return "Use";
    case "note":
      return "Read";
    case "tool":
      return def.generator ? "Place" : null;
    case "melee":
    case "firearm":
      return s.uid === equippedUid ? "Unequip" : "Equip";
    default:
      return null;
  }
};

const Btn = ({ onClick, children, quiet }: { onClick: () => void; children: ReactNode; quiet?: boolean }) => (
  <button
    onClick={onClick}
    className={`rounded-sm px-2 py-0.5 text-sm font-semibold uppercase tracking-wider transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
      quiet ? "text-stone-400 hover:bg-white/10 hover:text-stone-100" : "bg-stone-200 text-black hover:bg-white"
    }`}
  >
    {children}
  </button>
);

const ItemRow = ({ stack, children }: { stack: ItemStack; children: ReactNode }) => {
  const def = ITEMS[stack.id];
  const [showOrigin, setShowOrigin] = useState(false);
  const origin = showOrigin ? itemOrigin(stack.id) : null;
  const detail =
    def.fuelCapacity !== undefined
      ? `${(stack.fuel ?? 0).toFixed(1)} / ${def.fuelCapacity} L`
      : def.generator
        ? `${(stack.fuel ?? 0).toFixed(1)} L in tank`
        : def.category === "firearm"
      ? `${stack.loaded ?? 0}/${def.magSize} loaded`
      : stack.id === "camping_stove"
        ? `${Math.round(stack.charge ?? 0)} min of gas fitted`
      : stack.id === "car_battery"
        ? `${Math.round(stack.charge ?? 0)}% charge`
      : stack.id === "spare_tyre"
        ? `${Math.round(stack.charge ?? 0)}% tread`
      : stack.count > 1
        ? `×${stack.count}`
        : "";
  const stage = stack.fresh === undefined ? null : freshStage(stack.fresh);
  return (
    <li className="flex items-center gap-3 border-b border-white/5 px-3 py-2 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <button
            type="button"
            title="Where this came from"
            onClick={() => setShowOrigin((v) => !v)}
            className="truncate text-left text-base font-semibold text-stone-100 underline decoration-white/20 decoration-dotted underline-offset-4"
          >
            {def.name}
          </button>
          {detail && <span className="text-sm tabular-nums text-stone-400">{detail}</span>}
          {stage && <span className={`text-xs font-semibold uppercase tracking-wider ${FRESH_STYLE[stage]}`}>{stage}</span>}
        </div>
        <div className="truncate text-xs text-stone-500">
          {categoryLabel[def.category]} · {(def.weight * stack.count + (stack.fuel ?? 0) * 0.74).toFixed(2)} kg · {stack.id === "car_keys" && stack.text ? stack.text : def.description}
        </div>
        {origin && (
          <div className="mt-1 text-xs leading-snug text-amber-200/80">
            <div>{origin.line}</div>
            <div className="italic text-stone-400">{origin.note}</div>
          </div>
        )}
      </div>
      <div className="flex shrink-0 gap-1">{children}</div>
    </li>
  );
};

const Panel = ({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) => (
  <section className="flex max-h-[70vh] min-w-0 flex-1 flex-col rounded-sm bg-stone-950/90 ring-1 ring-white/10 [@media(max-height:500px)]:max-h-[38vh]">
    <header className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
      <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-stone-200">{title}</h2>
      {aside}
    </header>
    <ul className="min-h-24 overflow-y-auto">{children}</ul>
  </section>
);

const Inventory = ({ hud, actions }: { hud: HudState; actions: InventoryActions }) => {
  if (!hud.inventoryOpen && !hud.container) return null;
  const overloaded = hud.carryWeight > hud.maxWeight;
  const car = hud.carInspect;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4 font-ui [@media(max-height:500px)]:p-2">
      <div className="flex max-h-full w-full max-w-4xl flex-col gap-3 overflow-y-auto [@media(max-height:500px)]:gap-2">
        <div className="flex flex-col gap-3 md:flex-row [@media(max-height:500px)]:flex-row [@media(max-height:500px)]:gap-2">
          <Panel
            title="Inventory"
            aside={
              <span className={`text-sm tabular-nums ${overloaded ? "text-amber-400" : "text-stone-400"}`}>
                {hud.carryWeight.toFixed(1)} / {hud.maxWeight} kg
              </span>
            }
          >
            {hud.inventory.length === 0 && <li className="px-3 py-4 text-stone-500">You're carrying nothing.</li>}
            {hud.inventory.map((s) => {
              const label = useLabel(s, hud.equippedUid);
              return (
                <ItemRow key={s.uid} stack={s}>
                  {label && <Btn onClick={() => actions.use(s.uid)}>{label}</Btn>}
                  {hud.container ? (
                    <Btn quiet onClick={() => actions.put(s.uid)}>
                      Put
                    </Btn>
                  ) : (
                    <Btn quiet onClick={() => actions.drop(s.uid)}>
                      Drop
                    </Btn>
                  )}
                </ItemRow>
              );
            })}
          </Panel>

          {!hud.container && <HealthPanel hud={hud} onTreat={actions.treat} />}

          {hud.container && (
            <Panel
              title={hud.container.name}
              aside={
                <div className="flex gap-1">
                  {hud.tap && (
                    <Btn quiet onClick={actions.fillBottles}>
                      {hud.tap.running ? "Fill bottles at tap" : "Tap is dry"}
                    </Btn>
                  )}
                  {hud.containerFuel !== null && (
                    <Btn quiet onClick={actions.siphon}>
                      Siphon fuel ({hud.containerFuel.toFixed(1)} L)
                    </Btn>
                  )}
                  {hud.canFillTank && (
                    <Btn quiet onClick={actions.fillTank}>
                      Fill tank from jerry can
                    </Btn>
                  )}
                  {hud.container.items.length > 1 && <Btn onClick={actions.takeAll}>Take all</Btn>}
                </div>
              }
            >
              {hud.container.items.length === 0 && <li className="px-3 py-4 text-stone-500">Nothing useful here.</li>}
              {hud.container.items.map((s) => (
                <ItemRow key={s.uid} stack={s}>
                  <Btn onClick={() => actions.take(s.uid)}>Take</Btn>
                </ItemRow>
              ))}
            </Panel>
          )}
        </div>
        {car && (
          <section className="rounded-sm bg-stone-950/90 ring-1 ring-white/10">
            <header className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
              <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-stone-200">{car.name}</h2>
              <span className="text-sm text-stone-400">{car.keys}</span>
            </header>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-3 py-2 sm:grid-cols-3">
              {car.parts.map((p) => (
                <div key={p.label} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-2 text-xs uppercase tracking-[0.12em]">
                    <span className="truncate text-stone-400">{p.label}</span>
                    <span className={`shrink-0 tabular-nums ${p.value < 30 ? "text-orange-400" : "text-stone-300"}`}>{p.text}</span>
                  </div>
                  <div className="mt-0.5 h-1 overflow-hidden rounded-sm bg-black/60">
                    <div className={`h-full ${p.value < 30 ? "bg-orange-500" : p.value < 60 ? "bg-amber-300" : "bg-stone-300"}`} style={{ width: `${Math.max(0, Math.min(100, p.value))}%` }} />
                  </div>
                </div>
              ))}
            </div>
            {car.repairs.length > 0 && (
              <ul className="max-h-48 overflow-y-auto border-t border-white/10">
                {car.repairs.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 border-b border-white/5 px-3 py-1.5 last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-stone-100">
                        {r.label} <span className="font-normal text-stone-400">· {r.minutes} min</span>
                      </div>
                      {r.why && <div className="truncate text-xs text-stone-500">Needs {r.why.replace(/^needs /, "")}</div>}
                    </div>
                    {r.ok && <Btn onClick={() => actions.repairCar(r.id)}>Do it</Btn>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        {!hud.container && !car && hud.recipes.length > 0 && (
          <section className="rounded-sm bg-stone-950/90 ring-1 ring-white/10">
            <h2 className="border-b border-white/10 px-3 py-2 text-lg font-bold uppercase tracking-[0.2em] text-stone-200">Cook & craft</h2>
            <ul>
              {hud.recipes.map((r) => (
                <li key={r.id} className="flex items-center gap-3 border-b border-white/5 px-3 py-2 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-semibold text-stone-100">
                      {r.name} <span className="text-sm font-normal text-stone-400">· {r.minutes} min</span>
                    </div>
                    <div className={`truncate text-xs ${r.missing.length ? "text-stone-500" : "text-emerald-400"}`}>
                      {r.missing.length ? `Needs ${r.missing.join(", ")}` : "You have everything. Stay put while you work."}
                    </div>
                  </div>
                  {!r.missing.length && <Btn onClick={() => actions.craft(r.id)}>Make</Btn>}
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="flex items-center justify-between text-sm text-stone-400">
          <span>Zombies keep moving while you rummage.</span>
          <Btn onClick={actions.close}>Close (Tab)</Btn>
        </div>
      </div>
    </div>
  );
};

export default Inventory;
