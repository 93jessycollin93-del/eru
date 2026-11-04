import { useEffect, useRef, useState } from "react";

export interface TouchApi {
  key: (code: string, down: boolean) => void;
  look: (dx: number, dy: number) => void;
  mouse: (button: "left" | "right", down: boolean) => void;
}

const STICK_R = 54;
/** Pushing the stick this far out (share of its radius) sprints. */
const SPRINT_AT = 0.85;
/** Finger travel is a little stronger than mouse travel: a thumb sweeps less distance. */
const LOOK_GAIN = 1.6;

/**
 * On-screen controls for phones and tablets: a move stick on the left, drag anywhere else to look,
 * buttons on the right. Native listeners, not React's: React attaches touch handlers as passive, and a
 * passive handler can't stop the browser turning taps into mouse clicks (a tap to look would also swing).
 */
const TouchControls = ({ api, asleep }: { api: TouchApi; asleep: boolean }) => {
  const look = useRef<HTMLDivElement>(null);
  const stick = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState<{ x: number; y: number } | null>(null);
  const [aiming, setAiming] = useState(false);

  useEffect(() => {
    const lookEl = look.current!;
    const stickEl = stick.current!;
    let lookId: number | null = null;
    let lastX = 0;
    let lastY = 0;
    let stickId: number | null = null;
    let cx = 0;
    let cy = 0;
    const held = new Set<string>();
    const hold = (code: string, on: boolean) => {
      if (on === held.has(code)) return;
      if (on) held.add(code);
      else held.delete(code);
      api.key(code, on);
    };
    const moveStick = (x: number, y: number) => {
      let dx = x - cx;
      let dy = y - cy;
      const d = Math.hypot(dx, dy);
      if (d > STICK_R) {
        dx = (dx / d) * STICK_R;
        dy = (dy / d) * STICK_R;
      }
      setKnob({ x: dx, y: dy });
      const dead = STICK_R * 0.25;
      hold("KeyW", dy < -dead);
      hold("KeyS", dy > dead);
      hold("KeyA", dx < -dead);
      hold("KeyD", dx > dead);
      hold("ShiftLeft", d >= STICK_R * SPRINT_AT && dy < -dead);
    };
    const releaseStick = () => {
      stickId = null;
      setKnob(null);
      for (const k of ["KeyW", "KeyS", "KeyA", "KeyD", "ShiftLeft"]) hold(k, false);
    };

    const onLookStart = (e: TouchEvent) => {
      e.preventDefault();
      if (lookId !== null) return;
      const t = e.changedTouches[0];
      lookId = t.identifier;
      lastX = t.clientX;
      lastY = t.clientY;
    };
    const onStickStart = (e: TouchEvent) => {
      e.preventDefault();
      if (stickId !== null) return;
      const t = e.changedTouches[0];
      const r = stickEl.getBoundingClientRect();
      stickId = t.identifier;
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      moveStick(t.clientX, t.clientY);
    };
    const onMove = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === lookId) {
          e.preventDefault();
          api.look((t.clientX - lastX) * LOOK_GAIN, (t.clientY - lastY) * LOOK_GAIN);
          lastX = t.clientX;
          lastY = t.clientY;
        } else if (t.identifier === stickId) {
          e.preventDefault();
          moveStick(t.clientX, t.clientY);
        }
      }
    };
    const onEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === lookId) lookId = null;
        if (t.identifier === stickId) releaseStick();
      }
    };
    lookEl.addEventListener("touchstart", onLookStart, { passive: false });
    stickEl.addEventListener("touchstart", onStickStart, { passive: false });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      lookEl.removeEventListener("touchstart", onLookStart);
      stickEl.removeEventListener("touchstart", onStickStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
      for (const k of held) api.key(k, false);
    };
  }, [api]);

  // Leaving the controls (a menu opened) must not leave the aim held.
  useEffect(() => () => api.mouse("right", false), [api]);

  return (
    <div className="pointer-events-none absolute inset-0 select-none font-ui">
      <div ref={look} className="pointer-events-auto absolute inset-0" style={{ touchAction: "none" }} />
      <div
        ref={stick}
        aria-label="Move"
        className="pointer-events-auto absolute rounded-full bg-white/10 ring-2 ring-white/25"
        style={{ left: "calc(env(safe-area-inset-left) + 24px)", bottom: 140, width: STICK_R * 2 + 16, height: STICK_R * 2 + 16, touchAction: "none" }}
      >
        <div
          className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full bg-white/40"
          style={{ transform: `translate(calc(-50% + ${knob?.x ?? 0}px), calc(-50% + ${knob?.y ?? 0}px))` }}
        />
      </div>

      <div className="absolute flex flex-col items-end gap-2" style={{ right: "calc(env(safe-area-inset-right) + 14px)", bottom: 64 }}>
        <div className="flex gap-2">
          <Pad label="Reload" onDown={() => api.key("KeyR", true)} onUp={() => api.key("KeyR", false)} />
          <Pad label="Crouch" onDown={() => api.key("KeyC", true)} onUp={() => api.key("KeyC", false)} />
          <Pad label="Jump" onDown={() => api.key("Space", true)} onUp={() => api.key("Space", false)} />
          <Pad label="Swap" onDown={() => api.key("SwapItem", true)} onUp={() => api.key("SwapItem", false)} />
        </div>
        <div className="flex items-end gap-2">
          <Pad label="Use" onDown={() => api.key("KeyE", true)} onUp={() => api.key("KeyE", false)} />
          <Pad
            label={aiming ? "Aiming" : "Aim"}
            active={aiming}
            onDown={() => {
              const next = !aiming;
              setAiming(next);
              api.mouse("right", next);
            }}
          />
          <Pad big label="Attack" onDown={() => api.mouse("left", true)} onUp={() => api.mouse("left", false)} />
        </div>
      </div>

      <div className="absolute flex gap-2" style={{ right: "calc(env(safe-area-inset-right) + 176px)", top: 10 }}>
        {asleep && <Pad label="Wake" onDown={() => api.key("KeyZ", true)} onUp={() => api.key("KeyZ", false)} />}
        <Pad small label="Light" onDown={() => api.key("KeyF", true)} onUp={() => api.key("KeyF", false)} />
        <Pad small label="Bag" onDown={() => api.key("Tab", true)} onUp={() => api.key("Tab", false)} />
        <Pad small label="Pause" onDown={() => api.key("Escape", true)} onUp={() => api.key("Escape", false)} />
      </div>
    </div>
  );
};

/** A button that reports press and release, with taps kept from turning into mouse clicks. */
const Pad = ({ label, onDown, onUp, big, small, active }: { label: string; onDown: () => void; onUp?: () => void; big?: boolean; small?: boolean; active?: boolean }) => {
  const ref = useRef<HTMLButtonElement>(null);
  const handlers = useRef({ onDown, onUp });
  handlers.current = { onDown, onUp };
  useEffect(() => {
    const el = ref.current!;
    const down = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handlers.current.onDown();
    };
    const up = (e: TouchEvent) => {
      e.preventDefault();
      handlers.current.onUp?.();
    };
    el.addEventListener("touchstart", down, { passive: false });
    el.addEventListener("touchend", up, { passive: false });
    el.addEventListener("touchcancel", up, { passive: false });
    return () => {
      el.removeEventListener("touchstart", down);
      el.removeEventListener("touchend", up);
      el.removeEventListener("touchcancel", up);
    };
  }, []);
  const size = big ? "h-20 w-20 text-sm" : small ? "h-10 px-3 text-xs" : "h-14 w-14 text-[11px]";
  return (
    <button
      ref={ref}
      aria-label={label}
      className={`pointer-events-auto rounded-full font-semibold uppercase tracking-wider ring-2 ${size} ${
        active ? "bg-amber-300/80 text-black ring-amber-200" : "bg-black/35 text-stone-100 ring-white/30"
      }`}
      style={{ touchAction: "none" }}
    >
      {label}
    </button>
  );
};

export default TouchControls;
