import { useEffect, useRef, useState } from "react";
import type { HudState } from "@/game/types";

interface Props {
  cctv: NonNullable<HudState["cctv"]>;
  getCanvas: (channel: number) => HTMLCanvasElement | null;
  onClose: () => void;
}

/** Mounts the game's live channel canvas into the page. */
const Feed = ({ channel, getCanvas, big }: { channel: number; getCanvas: Props["getCanvas"]; big?: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const canvas = getCanvas(channel);
    const host = ref.current;
    if (!canvas || !host) return;
    canvas.className = "block h-full w-full object-contain";
    canvas.style.imageRendering = "pixelated";
    host.appendChild(canvas);
    return () => {
      if (canvas.parentElement === host) host.removeChild(canvas);
    };
  }, [channel, getCanvas]);
  return <div ref={ref} className={`aspect-[4/3] w-full overflow-hidden bg-black ${big ? "" : "cursor-zoom-in"}`} />;
};

/** VistaGuard NVR remote viewer: 2x2 live grid, click a feed to enlarge. */
const CctvViewer = ({ cctv, getCanvas, onClose }: Props) => {
  const [focus, setFocus] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (focus !== null) setFocus(null);
        else onClose();
      }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= cctv.channels.length) setFocus(cctv.channels[n - 1].channel);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, onClose, cctv.channels]);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
      <div
        className="flex w-full flex-col rounded-md bg-[#1c1e20] p-3 shadow-2xl ring-1 ring-black"
        style={{ maxWidth: "min(64rem, calc((100vh - 8rem) * 4 / 3))" }}
      >
        <div className="mb-2 flex items-center justify-between font-mono text-xs text-[#9fb0ad]">
          <span>VistaGuard NVR-8 · Live View · {cctv.nvr}</span>
          <span>
            {cctv.channels.filter((c) => c.online).length}/{cctv.channels.length} online
          </span>
        </div>
        {focus === null ? (
          <div className="grid grid-cols-2 gap-1.5">
            {cctv.channels.map((c) => (
              <button key={c.channel} onClick={() => setFocus(c.channel)} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300" aria-label={`Enlarge channel ${c.channel}, ${c.label}`}>
                <Feed channel={c.channel} getCanvas={getCanvas} />
              </button>
            ))}
          </div>
        ) : (
          <button onClick={() => setFocus(null)} className="focus:outline-none" aria-label="Back to all channels">
            <Feed channel={focus} getCanvas={getCanvas} big />
          </button>
        )}
        <div className="mt-2 flex justify-between font-ui text-sm text-stone-400">
          <span>{focus === null ? "Click a feed or press 1–4 to enlarge" : "Click or Esc for all channels"}</span>
          <span>Esc to return to the terminal</span>
        </div>
      </div>
    </div>
  );
};

export default CctvViewer;
