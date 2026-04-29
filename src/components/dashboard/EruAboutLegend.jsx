import { useState } from 'react';
import { ChevronDown, BookOpen, Bot, Coins, Gamepad2, Settings2, CheckCircle2 } from 'lucide-react';

/**
 * EruAboutLegend — collapsible "About / Legend" section explaining ERU.
 * Mobile-first, glass surface, purely informational.
 */
const CAPABILITIES = [
  { icon: Bot,        text: 'Use AI to assist, automate, and create' },
  { icon: Coins,      text: 'Manage digital assets and currencies' },
  { icon: Gamepad2,   text: 'Access interactive systems like marketplaces and games' },
  { icon: Settings2,  text: 'Customize your interface, layout, and environment' },
  { icon: CheckCircle2, text: 'Build workflows that adapt to your needs' },
];

const DIFFERENTIATORS = [
  'Everything exists in one place',
  'Fully customizable experience',
  'Modular system that grows over time',
  'Designed for both simplicity and advanced control',
];

const AUDIENCE = [
  'Builders and creators',
  'Traders and collectors',
  'Gamers and system explorers',
  'Anyone who wants more control over their digital environment',
];

export default function EruAboutLegend() {
  const [open, setOpen] = useState(false);

  return (
    <section
      aria-label="About ERU"
      className="eru-theme-card relative overflow-hidden rounded-2xl border border-border eru-enter eru-enter-delay-2"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5 sm:py-4"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BookOpen className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground sm:text-base">About ERU</p>
            <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
              What it is, how it works, and what you can do
            </p>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="space-y-5 border-t border-border px-4 py-4 sm:px-5 sm:py-5">
          <Block title="What is ERU?">
            ERU is a modular digital platform that combines tools, AI, assets, and interactive systems into one unified space.
            Instead of using multiple apps, ERU brings everything together so you can build, manage, and operate more efficiently.
          </Block>

          <Block title="How it works">
            ERU is structured as a collection of connected modules ("rooms"), each designed for a specific purpose—tools, AI systems,
            marketplaces, games, and more. These modules can expand, evolve, and integrate with each other over time.
          </Block>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">What you can do</h3>
            <ul className="space-y-1.5">
              {CAPABILITIES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-2 text-sm text-foreground">
                  <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
                  <span className="text-muted-foreground">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ListBlock title="Why ERU is different" items={DIFFERENTIATORS} />
            <ListBlock title="Who it's for" items={AUDIENCE} />
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 sm:p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-primary">In one line</p>
            <p className="mt-1 text-sm font-medium leading-relaxed text-foreground">
              ERU is a customizable digital ecosystem designed to help you build, manage, and explore everything in one place.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function Block({ title, children }) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

function ListBlock({ title, items }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-primary" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}