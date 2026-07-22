import { Bot, Flag, Activity, Radio } from 'lucide-react';

const TONES = {
  cyan: 'text-cyan-300',
  emerald: 'text-emerald-300',
  amber: 'text-amber-300',
  fuchsia: 'text-fuchsia-300',
};

export default function FleetStatCard({ icon: Icon, label, value, sub, tone = 'cyan' }) {
  return (
    <div className="eru-neon-card flex flex-col gap-1 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${TONES[tone]}`} />
      </div>
      <span className="font-mono text-2xl font-bold leading-none text-foreground">{value}</span>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  );
}