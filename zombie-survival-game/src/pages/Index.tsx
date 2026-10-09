import { useEffect, useMemo, useRef, useState } from "react";
import { Game } from "@/game/Game";
import type { HudState } from "@/game/types";
import Hud from "@/components/Hud";
import Inventory, { type InventoryActions } from "@/components/Inventory";
import Overlay from "@/components/Overlay";
import ComputerScreen from "@/components/ComputerScreen";
import NoteView from "@/components/NoteView";
import CctvViewer from "@/components/CctvViewer";

const Index = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const game = new Game(canvasRef.current, setHud);
    gameRef.current = game;
    // Debug handle for local testing only; stripped from production builds.
    if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  const actions = useMemo<InventoryActions>(
    () => ({
      use: (uid) => gameRef.current?.useItem(uid),
      drop: (uid) => gameRef.current?.dropItem(uid),
      take: (uid) => gameRef.current?.takeFromContainer(uid),
      takeAll: () => gameRef.current?.takeAll(),
      put: (uid) => gameRef.current?.putInContainer(uid),
      treat: (woundId) => gameRef.current?.treatWound(woundId),
      close: () => gameRef.current?.closeUi(),
    }),
    [],
  );

  const getCanvas = useMemo(() => (ch: number) => gameRef.current?.cctvCanvas(ch) ?? null, []);

  const playing = hud && (hud.status === "playing" || hud.status === "paused");

  return (
    <main className="relative h-full w-full overflow-hidden bg-black">
      <canvas ref={canvasRef} className="block h-full w-full" />
      {hud && playing && <Hud hud={hud} />}
      {hud && hud.status === "playing" && <Inventory hud={hud} actions={actions} />}
      {hud && hud.status === "playing" && hud.cctv && (
        <CctvViewer cctv={hud.cctv} getCanvas={getCanvas} onClose={() => gameRef.current?.closeCctv()} />
      )}
      {hud && hud.status === "playing" && hud.computer && !hud.cctv && (
        <ComputerScreen
          computer={hud.computer}
          onSubmit={(l) => gameRef.current?.computerSubmit(l)}
          onComplete={(l) => gameRef.current?.computerComplete(l) ?? l}
          onClose={() => gameRef.current?.closeUi()}
        />
      )}
      {hud && hud.status === "playing" && hud.reading && <NoteView note={hud.reading} onClose={() => gameRef.current?.closeUi()} />}
      {hud && (
        <Overlay
          hud={hud}
          onStart={() => gameRef.current?.start()}
          onResume={() => gameRef.current?.resume()}
          onQuality={(q) => gameRef.current?.setQuality(q)}
        />
      )}
    </main>
  );
};

export default Index;
