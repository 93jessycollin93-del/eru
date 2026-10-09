import { useEffect, useRef, useState } from "react";
import type { HudState } from "@/game/types";

interface Props {
  computer: NonNullable<HudState["computer"]>;
  onSubmit: (line: string) => void;
  onComplete: (line: string) => string;
  onClose: () => void;
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * A terminal on an in-world monitor. Output lines appear progressively so
 * boot logs and long files scroll in like a real machine.
 */
const ComputerScreen = ({ computer, onSubmit, onComplete, onClose }: Props) => {
  const [line, setLine] = useState("");
  const [shown, setShown] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const total = computer.lines.length;

  // Reveal new output a few lines at a time.
  useEffect(() => {
    if (shown > total || reducedMotion()) {
      setShown(total);
      return;
    }
    if (shown === total) return;
    const t = setTimeout(() => setShown((n) => Math.min(total, n + Math.max(1, Math.ceil((total - n) / 12)))), 18);
    return () => clearTimeout(t);
  }, [shown, total]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [shown, line]);

  const typing = shown < total;
  // The input only exists once output has finished printing; focus it then.
  useEffect(() => {
    if (!typing) inputRef.current?.focus();
  }, [typing]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (typing) return;
      if (line.trim() && !computer.password) setHistory((h) => [...h, line]);
      setHistIdx(null);
      onSubmit(line);
      setLine("");
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (!computer.password) setLine(onComplete(line));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!history.length) return;
      const i = histIdx === null ? history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(i);
      setLine(history[i]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx === null) return;
      const i = histIdx + 1;
      if (i >= history.length) {
        setHistIdx(null);
        setLine("");
      } else {
        setHistIdx(i);
        setLine(history[i]);
      }
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      onSubmit("clear");
    } else if (e.key === "c" && e.ctrlKey) {
      e.preventDefault();
      setLine("");
    }
  };

  const laptop = computer.kind === "laptop";

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4" onMouseDown={() => setTimeout(() => inputRef.current?.focus())}>
      <div className={`flex w-full max-w-4xl flex-col ${laptop ? "" : "rounded-md bg-[#26282a] p-4 pb-6 shadow-2xl ring-1 ring-black"}`}>
        <div
          className={`relative flex h-[min(70vh,560px)] flex-col overflow-hidden bg-[#0a0c0c] font-mono text-[13px] leading-[1.35] text-[#c9d4d0] ${
            laptop ? "rounded-t-lg border-[10px] border-b-[14px] border-[#3b3e42]" : "rounded-sm"
          }`}
          style={{ textShadow: "0 0 6px rgba(170,220,210,0.25)" }}
        >
          <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3">
            {computer.lines.slice(0, shown).map((l, i) => (
              <div key={i} className="min-h-[1.35em] whitespace-pre-wrap break-words">
                {l}
              </div>
            ))}
            {!typing && (
              <label className="flex whitespace-pre">
                <span>{computer.prompt}</span>
                <input
                  ref={inputRef}
                  id="terminal-input"
                  value={line}
                  onChange={(e) => setLine(e.target.value)}
                  onKeyDown={onKeyDown}
                  spellCheck={false}
                  autoComplete="off"
                  aria-label="Terminal input"
                  className={`min-w-0 flex-1 bg-transparent caret-[#c9d4d0] outline-none ${computer.password ? "text-transparent" : ""}`}
                />
              </label>
            )}
          </div>
          {/* Scanlines and screen curvature shading */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 3px), radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.45) 100%)",
            }}
          />
        </div>
        {laptop && <div className="mx-[-3%] h-3 rounded-b-xl bg-[#55595e]" />}
        <div className="mt-2 flex items-center justify-between font-ui text-sm text-stone-400">
          <span>
            {computer.hostname}
            {computer.battery !== null && (
              <span className={`ml-3 tabular-nums ${computer.battery < 15 ? "text-red-400" : ""}`}>Battery {computer.battery}%</span>
            )}
          </span>
          <span>Esc to step away · zombies can still reach you</span>
        </div>
      </div>
    </div>
  );
};

export default ComputerScreen;
