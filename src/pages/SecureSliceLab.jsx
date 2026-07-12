import { useEffect, useMemo, useState } from 'react';
import PermissionGate from '@/components/PermissionGate';
import { isAdmin } from '@/lib/permissions';
import {
  getOperationalStatus,
  subscribeOperationalStatus,
  getBatteryOptimizationEnabled,
  setBatteryOptimizationEnabled,
  listVaultDocuments,
  readAuditChain,
  verifyAuditChain,
  storeSecureDocument,
  unlockSecureDocument,
  getLockoutState,
  wipeSecureSliceData,
  readWipeEvidence,
  initializeSecureSlice,
} from '@/lib/secureSlice';

export default function SecureSliceLab() {
  return (
    <PermissionGate
      allow={isAdmin}
      deniedTitle="Owner / admin only"
      deniedMessage="Secure Slice Lab is restricted."
    >
      <SecureSliceLabInner />
    </PermissionGate>
  );
}

function SecureSliceLabInner() {
  const [status, setStatus] = useState(getOperationalStatus());
  const [batteryOptimized, setBatteryOptimized] = useState(getBatteryOptimizationEnabled());
  const [docs, setDocs] = useState(listVaultDocuments());
  const [audit, setAudit] = useState(readAuditChain());
  const [auditValid, setAuditValid] = useState(true);
  const [lockState, setLockState] = useState(getLockoutState());
  const [wipeEvidence, setWipeEvidence] = useState(readWipeEvidence());

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [ttlHours, setTtlHours] = useState('24');
  const [selectedDocId, setSelectedDocId] = useState('');
  const [unlockPassphrase, setUnlockPassphrase] = useState('');
  const [decrypted, setDecrypted] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setDocs(listVaultDocuments());
    const nextAudit = readAuditChain();
    setAudit(nextAudit);
    setLockState(getLockoutState());
    setWipeEvidence(readWipeEvidence());
    setAuditValid(await verifyAuditChain());
  };

  useEffect(() => {
    initializeSecureSlice()
      .catch((e) => {
        setError(e.message || 'Secure slice initialization failed.');
      })
      .finally(() => {
        void refresh();
      });

    const unsubscribe = subscribeOperationalStatus(setStatus);
    const timer = setInterval(() => {
      setLockState(getLockoutState());
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  const lockoutSeconds = Math.max(0, Math.floor((lockState.lockoutRemainingMs || 0) / 1000));

  const summary = useMemo(() => {
    return {
      docs: docs.length,
      audit: audit.length,
      failedAttempts: lockState.failedAttempts || 0,
      wipeTriggered: !!lockState.wipeTriggered,
    };
  }, [docs.length, audit.length, lockState.failedAttempts, lockState.wipeTriggered]);

  const onToggleBattery = () => {
    const next = !batteryOptimized;
    setBatteryOptimizationEnabled(next);
    setBatteryOptimized(next);
  };

  const onStore = async () => {
    setError('');
    setDecrypted('');

    if (!title.trim() || !content.trim() || passphrase.length < 8) {
      setError('Title/content/passphrase are required. Passphrase must be 8+ characters.');
      return;
    }

    setBusy(true);
    try {
      await storeSecureDocument({
        title: title.trim(),
        plaintext: content,
        passphrase,
        expiresInHours: Number(ttlHours) > 0 ? Number(ttlHours) : 0,
      });
      setTitle('');
      setContent('');
      setPassphrase('');
      await refresh();
    } catch (e) {
      setError(e.message || 'Failed to store document.');
    } finally {
      setBusy(false);
    }
  };

  const onUnlock = async () => {
    setError('');
    setDecrypted('');

    if (!selectedDocId || !unlockPassphrase) {
      setError('Select a document and provide passphrase.');
      return;
    }

    setBusy(true);
    try {
      const result = await unlockSecureDocument({ docId: selectedDocId, passphrase: unlockPassphrase });
      setDecrypted(result.plaintext);
      await refresh();
    } catch (e) {
      setError(e.message || 'Failed to unlock document.');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const onWipe = async () => {
    setBusy(true);
    setError('');
    setDecrypted('');
    try {
      await wipeSecureSliceData('manual_admin_wipe');
      await refresh();
    } catch (e) {
      setError(e.message || 'Wipe failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 p-4 space-y-4">
      <div className="rounded-2xl border border-border bg-card/80 p-4">
        <h1 className="text-lg font-semibold text-foreground">Secure Slice Lab (v1)</h1>
        <p className="text-xs text-muted-foreground mt-1">Minimum secure slice: encryption + signature + immutable audit + lockout/wipe.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Network" value={status.mode} tone={status.online ? 'text-primary' : 'text-yellow-300'} />
        <Stat label="Battery mode" value={batteryOptimized ? 'low-power' : 'standard'} tone={batteryOptimized ? 'text-primary' : 'text-muted-foreground'} />
        <Stat label="Vault docs" value={String(summary.docs)} tone="text-foreground" />
        <Stat label="Audit chain" value={auditValid ? 'valid' : 'tampered'} tone={auditValid ? 'text-primary' : 'text-destructive'} />
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-3 flex flex-wrap items-center gap-2">
        <button
          onClick={onToggleBattery}
          className="rounded-xl bg-secondary border border-border px-3 py-2 text-xs text-foreground"
        >
          Toggle battery optimization
        </button>

        <button
          onClick={onWipe}
          className="rounded-xl bg-destructive/10 border border-destructive/40 px-3 py-2 text-xs text-destructive"
          disabled={busy}
        >
          Trigger manual cryptographic wipe
        </button>

        <span className="text-[11px] text-muted-foreground ml-auto">
          Failed attempts: {summary.failedAttempts} {lockoutSeconds > 0 ? `· lockout ${lockoutSeconds}s` : ''}
        </span>
      </div>

      {wipeEvidence && (
        <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/5 p-3 text-xs text-yellow-300">
          Wipe evidence: {wipeEvidence.timestamp} · reason: {wipeEvidence.reason}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <section className="rounded-2xl border border-border bg-card/60 p-3 space-y-2">
          <h2 className="text-sm font-medium text-foreground">Store encrypted document</h2>
          <input className="w-full rounded-lg bg-background border border-border px-2 py-1.5 text-xs" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="w-full rounded-lg bg-background border border-border px-2 py-1.5 text-xs min-h-28" placeholder="Classified content" value={content} onChange={(e) => setContent(e.target.value)} />
          <input className="w-full rounded-lg bg-background border border-border px-2 py-1.5 text-xs" type="password" placeholder="Passphrase (8+ chars)" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
          <input className="w-full rounded-lg bg-background border border-border px-2 py-1.5 text-xs" type="number" min="0" placeholder="TTL hours (0 for no expiry)" value={ttlHours} onChange={(e) => setTtlHours(e.target.value)} />
          <button onClick={onStore} disabled={busy} className="rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold">Encrypt + sign + store</button>
        </section>

        <section className="rounded-2xl border border-border bg-card/60 p-3 space-y-2">
          <h2 className="text-sm font-medium text-foreground">Unlock document</h2>
          <select className="w-full rounded-lg bg-background border border-border px-2 py-1.5 text-xs" value={selectedDocId} onChange={(e) => setSelectedDocId(e.target.value)}>
            <option value="">Select document</option>
            {docs.map((doc) => (
              <option key={doc.id} value={doc.id}>{doc.title} {doc.expiresAt ? `expires ${new Date(doc.expiresAt).toLocaleString()}` : ''}</option>
            ))}
          </select>
          <input className="w-full rounded-lg bg-background border border-border px-2 py-1.5 text-xs" type="password" placeholder="Unlock passphrase" value={unlockPassphrase} onChange={(e) => setUnlockPassphrase(e.target.value)} />
          <button onClick={onUnlock} disabled={busy} className="rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold">Decrypt + verify signature</button>
          <textarea className="w-full rounded-lg bg-background border border-border px-2 py-1.5 text-xs min-h-28" readOnly value={decrypted} placeholder="Decrypted content appears here" />
        </section>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{error}</div>
      )}

      <section className="rounded-2xl border border-border bg-card/60 p-3">
        <h2 className="text-sm font-medium text-foreground mb-2">Immutable audit tail</h2>
        <ul className="space-y-1 max-h-60 overflow-auto">
          {audit.slice(-25).reverse().map((entry) => (
            <li key={entry.id} className="rounded-lg border border-border bg-background/60 px-2 py-1.5">
              <p className="text-[11px] text-foreground font-mono">{entry.timestamp} · {entry.event?.type}</p>
              <p className="text-[10px] text-muted-foreground font-mono truncate">hash: {entry.hash}</p>
              <p className="text-[10px] text-muted-foreground font-mono truncate">prev: {entry.prevHash || 'GENESIS'}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-border bg-card/70 px-3 py-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-semibold ${tone}`}>{value}</p>
    </div>
  );
}
