import type { ReactNode } from "react";
import type { HudState } from "@/game/types";

interface OverlayProps {
  hud: HudState;
  onStart: () => void;
  onResume: () => void;
}

const Controls = () => (
  <ul className="mx-auto mt-6 grid max-w-xs grid-cols-2 gap-x-6 gap-y-1 text-left font-mono text-sm text-neutral-300">
    <li className="text-neutral-500">Move</li>
    <li>WASD / Arrows</li>
    <li className="text-neutral-500">Aim</li>
    <li>Mouse</li>
    <li className="text-neutral-500">Shoot</li>
    <li>Left click (hold)</li>
    <li className="text-neutral-500">Reload</li>
    <li>R</li>
    <li className="text-neutral-500">Pause</li>
    <li>Esc / P</li>
  </ul>
);

const Button = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button
    onClick={onClick}
    className="mt-8 rounded bg-red-700 px-8 py-3 font-display text-2xl tracking-wider text-white shadow-lg shadow-red-900/50 transition hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400"
  >
    {children}
  </button>
);

const Overlay = ({ hud, onStart, onResume }: OverlayProps) => {
  if (hud.status === "playing") return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="text-center">
        {hud.status === "menu" && (
          <>
            <h1 className="font-display text-6xl text-red-600 drop-shadow-[0_0_12px_rgba(220,38,38,0.6)] sm:text-8xl">
              Zombie Survival
            </h1>
            <p className="mt-3 text-neutral-400">The dead are coming. Hold out as long as you can.</p>
            <Controls />
            <Button onClick={onStart}>Start</Button>
            {hud.highScore > 0 && (
              <p className="mt-4 font-mono text-sm text-neutral-500">High score: {hud.highScore.toLocaleString()}</p>
            )}
          </>
        )}

        {hud.status === "paused" && (
          <>
            <h2 className="font-display text-6xl text-neutral-200">Paused</h2>
            <Controls />
            <Button onClick={onResume}>Resume</Button>
          </>
        )}

        {hud.status === "over" && (
          <>
            <h2 className="font-display text-7xl text-red-600 drop-shadow-[0_0_12px_rgba(220,38,38,0.6)]">
              You Died
            </h2>
            <div className="mt-6 space-y-1 font-mono text-neutral-300">
              <p>Survived to wave {hud.wave}</p>
              <p>{hud.kills} zombies killed</p>
              <p className="text-2xl text-amber-300">Score: {hud.score.toLocaleString()}</p>
              {hud.score > 0 && hud.score >= hud.highScore ? (
                <p className="text-green-400">New high score!</p>
              ) : (
                <p className="text-neutral-500">High score: {hud.highScore.toLocaleString()}</p>
              )}
            </div>
            <Button onClick={onStart}>Play Again</Button>
          </>
        )}
      </div>
    </div>
  );
};

export default Overlay;
