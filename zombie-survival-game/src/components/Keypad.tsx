import { useEffect } from "react";
import type { HudState } from "@/game/types";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "#"];

const STATUS: Record<NonNullable<HudState["keypad"]>["status"], string> = {
  idle: "ENTER CODE",
  granted: "ACCESS GRANTED",
  denied: "ACCESS DENIED",
  lockout: "LOCKED OUT",
  dark: "",
};

/** A wall keypad by an electrically locked door: a small LCD and twelve rubber keys. */
const Keypad = ({ keypad, onKey, onClose }: { keypad: NonNullable<HudState["keypad"]>; onKey: (k: string) => void; onClose: () => void }) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (/^[0-9]$/.test(e.key)) onKey(e.key);
      else if (e.key === "Enter" || e.key === "#") onKey("#");
      else if (e.key === "Backspace" || e.key.toLowerCase() === "c") onKey("C");
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKey, onClose]);

  const dark = keypad.status === "dark";
  const tone = keypad.status === "granted" ? "text-lime-300" : keypad.status === "denied" || keypad.status === "lockout" ? "text-red-400" : "text-lime-200/80";
  const line = keypad.status === "lockout" && keypad.lockout > 0 ? `LOCKED OUT ${keypad.lockout}s` : STATUS[keypad.status];

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/55 p-4 font-ui" onClick={onClose}>
      <section
        className="w-64 rounded-md bg-gradient-to-b from-stone-700 to-stone-800 p-4 shadow-2xl ring-1 ring-black/60"
        onClick={(e) => e.stopPropagation()}
        aria-label="Door keypad"
      >
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.25em] text-stone-400">
          <span>VistaGuard</span>
          <span>{keypad.label}</span>
        </div>
        <div className={`mt-2 h-14 rounded-sm px-2 py-1.5 font-mono ring-1 ring-black/70 ${dark ? "bg-stone-950" : "bg-[#1d2a1c]"}`}>
          {!dark && (
            <>
              <div className={`text-xs tracking-[0.15em] ${tone}`}>{line}</div>
              <div className="mt-0.5 text-xl tracking-[0.4em] text-lime-200">{"*".repeat(keypad.entered) || " "}</div>
            </>
          )}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {KEYS.map((k) => (
            <button
              key={k}
              onClick={() => onKey(k)}
              className="h-11 rounded bg-stone-900 text-lg font-bold text-stone-200 shadow-[inset_0_-2px_0_rgba(0,0,0,0.6)] transition active:translate-y-px active:shadow-none hover:bg-stone-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              {k === "#" ? "ENT" : k === "C" ? "CLR" : k}
            </button>
          ))}
        </div>
        <p className="mt-3 text-center text-[11px] uppercase tracking-[0.15em] text-stone-500">Type the code · Enter · Esc to step back</p>
      </section>
    </div>
  );
};

export default Keypad;
