import { useState } from 'react';
import { Lock, Unlock, ShieldCheck, KeyRound, Eye, EyeOff } from 'lucide-react';
// Aliased: the component's own `pin` state setter is also called setPin and
// would otherwise shadow this, so the PIN was never actually saved.
import { isPinConfigured, setPin as savePin, verifyPin } from '@/lib/secretAreaPin';

/**
 * VaultLayer
 * ----------------------------------------------------------------------------
 * A single PIN-gated layer. Each layer tracks its OWN local unlock state
 * (independent of the global secretAreaPin session) so nested layers each
 * require their own unlock. All layers share the same stored PIN.
 *
 * Props:
 *  - level       number   1-based depth (for the "Vault X of N" badge)
 *  - total       number   Total vault layers
 *  - title       string
 *  - description string
 *  - children    node     Revealed once this layer is unlocked
 */
function VaultLayer({ level, total, title, description, children }) {
  const [unlocked, setUnlocked] = useState(false);
  const [configured, setConfigured] = useState(isPinConfigured());
  const [mode, setMode] = useState('idle'); // 'idle' | 'set' | 'verify'
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => { setPin(''); setConfirm(''); setError(''); setShowPin(false); };

  const handleSet = async () => {
    setError('');
    if (pin.length < 4) { setError('PIN must be at least 4 characters.'); return; }
    if (pin !== confirm) { setError('PINs do not match.'); return; }
    setBusy(true);
    try {
      await savePin(pin);
      setConfigured(true);
      setUnlocked(true);
      setMode('idle');
      reset();
    } catch (err) {
      setError(err?.message || 'Could not save PIN.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    setError('');
    setBusy(true);
    try {
      const ok = await verifyPin(pin);
      if (!ok) { setError('Incorrect PIN.'); return; }
      setUnlocked(true);
      setMode('idle');
      reset();
    } finally {
      setBusy(false);
    }
  };

  // -------- Locked --------
  if (!unlocked) {
    const setting = mode === 'set' || !configured;
    return (
      <div className="eru-neon-card relative overflow-hidden rounded-2xl p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Lock className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground sm:text-base">{title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-primary/70">
              Vault {level} of {total}
            </p>
          </div>
        </div>

        {mode === 'idle' && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setMode(configured ? 'verify' : 'set')}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
            >
              <KeyRound className="h-3.5 w-3.5" />
              {configured ? 'Unlock Vault' : 'Set PIN'}
            </button>
          </div>
        )}

        {(mode === 'set' || mode === 'verify') && (
          <div className="mt-4 space-y-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {setting ? 'Choose a PIN (min 4 chars)' : 'Enter your PIN'}
              </span>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete="off"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-border bg-secondary px-3 py-2 pr-10 text-sm outline-none focus:border-primary"
                  placeholder="••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                  className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-card"
                >
                  {showPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </label>

            {setting && (
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Confirm PIN
                </span>
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete="off"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
                  placeholder="••••"
                />
              </label>
            )}

            {error && <p className="text-[11px] text-red-400">{error}</p>}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={setting ? handleSet : handleVerify}
                disabled={busy || !pin}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {busy ? 'Working…' : setting ? 'Save PIN & unlock' : 'Unlock'}
              </button>
              <button
                type="button"
                onClick={() => { setMode('idle'); reset(); }}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-medium text-muted-foreground"
              >
                Cancel
              </button>
            </div>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Your PIN is hashed and stored only on this device. Each vault layer must be unlocked in turn.
            </p>
          </div>
        )}
      </div>
    );
  }

  // -------- Unlocked --------
  return (
    <div className="eru-neon-card relative overflow-hidden rounded-2xl border border-primary/30 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Unlock className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground sm:text-base">{title}</p>
            <p className="mt-0.5 text-[11px] text-primary">Vault {level} of {total} unlocked</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setUnlocked(false)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          <Lock className="h-3 w-3" /> Lock
        </button>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

/**
 * VaultLogin
 * ----------------------------------------------------------------------------
 * Three nested PIN vaults. The user must unlock each layer in sequence to
 * reach the personal login area at the center. All layers share one device
 * PIN; each layer gates independently.
 */
export default function VaultLogin() {
  const total = 3;
  return (
    <div className="space-y-3">
      <VaultLayer
        level={1}
        total={total}
        title="Outer Vault"
        description="First security layer. Enter your PIN to descend deeper."
      >
        <VaultLayer
          level={2}
          total={total}
          title="Middle Vault"
          description="Second security layer. One more gate remains."
        >
          <VaultLayer
            level={3}
            total={total}
            title="Inner Vault"
            description="Final security layer. Your personal area lies beyond."
          >
            {/* Personal login area */}
            <div className="eru-neon-card rounded-2xl p-5 text-center">
              <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/40 bg-primary/15">
                <ShieldCheck className="h-7 w-7 text-primary" />
              </span>
              <h3 className="mt-3 text-lg font-bold eru-neon-glow-text">Personal Area</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                All three vaults unlocked. You are inside your private space.
              </p>
              <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                Anything you save here stays behind your device PIN. Lock a vault to re-secure a layer.
              </p>
            </div>
          </VaultLayer>
        </VaultLayer>
      </VaultLayer>
    </div>
  );
}