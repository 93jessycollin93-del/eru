import { useState, useEffect } from 'react';
import { Lightbulb } from 'lucide-react';
import HomeTour, { hasSeenTour } from './HomeTour';

/**
 * HomeTipsButton — the "Tips & Tricks" call-to-action shown at the top-center
 * of the Home page. Opens the interactive HomeTour overlay, and auto-opens it
 * once for first-time visitors.
 */
export default function HomeTipsButton() {
  const [open, setOpen] = useState(false);

  // Auto-launch the tour for first-time visitors.
  useEffect(() => {
    if (!hasSeenTour()) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary shadow-sm transition-all hover:bg-primary/20 hover:shadow-[0_0_18px_hsl(160_100%_45%/0.35)] active:scale-95"
      >
        <Lightbulb className="h-4 w-4" />
        Tips &amp; Tricks
      </button>

      <HomeTour open={open} onClose={() => setOpen(false)} />
    </>
  );
}