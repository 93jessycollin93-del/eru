import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import VaultLogin from '@/components/vault/VaultLogin';

export default function Vault() {
  return (
    <div className="flex min-h-screen flex-col bg-background pb-28 md:pb-12">
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pt-4">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Home
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Personal Vault</span>
        </div>

        {/* Hero */}
        <div className="eru-neon-foundation relative overflow-hidden rounded-2xl p-4">
          <div className="eru-neon-grid-bg" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-primary/40 bg-primary/15">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="eru-neon-glow-text text-lg font-bold leading-tight">Personal Vault Login</h1>
              <p className="text-[11px] leading-tight text-muted-foreground">Three nested vaults protect your private area</p>
            </div>
          </div>
        </div>

        <VaultLogin />
      </div>
    </div>
  );
}