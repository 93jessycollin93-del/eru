import type { ReactNode } from "react";
import { ITEMS, type ItemStack } from "@/sim/items";
import type { HudState } from "@/game/types";
import HealthPanel from "./HealthPanel";

export interface InventoryActions {
  use: (uid: number) => void;
  drop: (uid: number) => void;
  take: (uid: number) => void;
  takeAll: () => void;
  put: (uid: number) => void;
  treat: (woundId: number) => void;
  close: () => void;
}

const categoryLabel: Record<string, string> = {
  food: "Food",
  drink: "Drink",
  medical: "Medical",
  melee: "Melee",
  firearm: "Firearm",
  ammo: "Ammo",
  tool: "Tool",
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
  const detail =
    def.category === "firearm"
      ? `${stack.loaded ?? 0}/${def.magSize} loaded`
      : stack.count > 1
        ? `×${stack.count}`
        : "";
  return (
    <li className="flex items-center gap-3 border-b border-white/5 px-3 py-2 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-base font-semibold text-stone-100">{def.name}</span>
          {detail && <span className="text-sm tabular-nums text-stone-400">{detail}</span>}
        </div>
        <div className="truncate text-xs text-stone-500">
          {categoryLabel[def.category]} · {(def.weight * stack.count).toFixed(2)} kg · {def.description}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">{children}</div>
    </li>
  );
};

const Panel = ({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) => (
  <section className="flex max-h-[70vh] min-w-0 flex-1 flex-col rounded-sm bg-stone-950/90 ring-1 ring-white/10">
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

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 p-4 font-ui">
      <div className="flex w-full max-w-4xl flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row">
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
              aside={hud.container.items.length > 1 ? <Btn onClick={actions.takeAll}>Take all</Btn> : undefined}
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
        <div className="flex items-center justify-between text-sm text-stone-400">
          <span>Zombies keep moving while you rummage.</span>
          <Btn onClick={actions.close}>Close (Tab)</Btn>
        </div>
      </div>
    </div>
  );
};

export default Inventory;
