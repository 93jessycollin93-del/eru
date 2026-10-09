import { useEffect, useRef, useState } from "react";
import { Game } from "@/game/engine";
import type { HudState } from "@/game/types";
import Hud from "@/components/Hud";
import Overlay from "@/components/Overlay";

const Index = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const game = new Game(canvasRef.current, setHud);
    gameRef.current = game;
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  return (
    <main className="relative h-full w-full">
      <canvas ref={canvasRef} className="block h-full w-full cursor-crosshair" />
      {hud && hud.status !== "menu" && <Hud hud={hud} />}
      {hud && (
        <Overlay
          hud={hud}
          onStart={() => gameRef.current?.start()}
          onResume={() => gameRef.current?.togglePause()}
        />
      )}
    </main>
  );
};

export default Index;
