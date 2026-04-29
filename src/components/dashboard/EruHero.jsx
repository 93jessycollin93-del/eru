import { Sparkles, Zap, Layers } from 'lucide-react';

/**
 * EruHero — front-page hero for the Dashboard.
 * Mobile-first, glass surface, no business logic.
 */
export default function EruHero() {
  return (
    <section
      aria-label="ERU introduction"
      className="eru-theme-card eru-cta-accent relative overflow-hidden rounded-2xl border border-border p-5 sm:p-7 eru-enter"
    >
      {/* Soft accent glow — purely decorative */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-cyan-500/10 blur-3xl"
      />

      <div className="relative">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
          <Sparkles className="h-3 w-3" />
          ERU
        </div>

        <h1 className="mt-3 text-xl font-bold leading-tight text-foreground sm:text-2xl md:text-3xl">
          Your all-in-one digital toolbox.
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
          Build, control, and explore powerful systems from a single environment—no switching apps, no limitations.
          Access AI tools, manage assets, interact with dynamic systems, and customize your entire experience in real time.
        </p>

        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
          Everything in ERU is modular, meaning it grows with you—add tools, expand features, and shape your environment exactly how you want it.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-[11px] text-foreground">
            <Layers className="h-3 w-3 text-primary" />
            Modular
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-[11px] text-foreground">
            <Zap className="h-3 w-3 text-primary" />
            Real-time
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
            One system. Infinite possibilities.
          </span>
        </div>
      </div>
    </section>
  );
}