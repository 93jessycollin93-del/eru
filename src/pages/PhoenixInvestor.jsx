import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Flame, ShieldCheck, Settings2, ExternalLink, Check, X } from 'lucide-react';
import LovableEmbed from '@/components/storefront/LovableEmbed';
import { EXTERNAL_PORTALS, getPortalUrl, setPortalUrlOverride } from '@/lib/externalPortals';
import { useAuth } from '@/lib/AuthContext';
import { canManageExternalPortals } from '@/lib/permissions';
import { isSafeEmbedUrl } from '@/lib/safeUrl';
import { logAuditEvent } from '@/lib/auditEvents';

/**
 * Phoenix Investor Portal
 * ----------------------------------------------------------------------------
 * Consumer-facing page that embeds an external Lovable app inside the existing
 * Storefront area. The URL is owner-configurable via:
 *   - lib/externalPortals.js (defaultUrl)
 *   - VITE_PHOENIX_INVESTOR_URL env var
 *   - localStorage override (admin-only inline "Configure" UI below)
 *
 * The embed is performed by <LovableEmbed /> which handles CSP/X-Frame-Options
 * failures with a polished fallback card and an "Open externally" button.
 * --------------------------------------------------------------------------*/

const PORTAL = EXTERNAL_PORTALS.phoenix_investor;

export default function PhoenixInvestor() {
  const { currentUser } = useAuth();
  const canManage = canManageExternalPortals(currentUser);

  const [url, setUrl] = useState(() => getPortalUrl(PORTAL.id));
  const [editing, setEditing] = useState(false);
  const [draftUrl, setDraftUrl] = useState(url);
  const [draftError, setDraftError] = useState('');

  useEffect(() => {
    setDraftUrl(url);
  }, [url]);

  const saveUrl = () => {
    if (!canManage) {
      logAuditEvent(currentUser, {
        action: 'external_portal.update',
        target_type: 'ExternalPortal',
        target_id: PORTAL.id,
        status: 'denied',
        reason: 'missing_admin_permission',
      });
      setDraftError('You don’t have permission to change this portal.');
      return;
    }
    const trimmed = draftUrl.trim();
    if (trimmed && !isSafeEmbedUrl(trimmed)) {
      setDraftError('URL must start with https:// and be a valid address.');
      return;
    }
    const previous = url;
    setPortalUrlOverride(PORTAL.id, trimmed);
    const nextUrl = getPortalUrl(PORTAL.id);
    setUrl(nextUrl);
    setDraftError('');
    setEditing(false);
    logAuditEvent(currentUser, {
      action: 'external_portal.update',
      target_type: 'ExternalPortal',
      target_id: PORTAL.id,
      before: { url: previous || null },
      after: { url: nextUrl || null },
    });
  };

  const clearUrl = () => {
    if (!canManage) return;
    const previous = url;
    setPortalUrlOverride(PORTAL.id, '');
    setUrl(getPortalUrl(PORTAL.id));
    setDraftUrl('');
    setDraftError('');
    setEditing(false);
    logAuditEvent(currentUser, {
      action: 'external_portal.clear',
      target_type: 'ExternalPortal',
      target_id: PORTAL.id,
      before: { url: previous || null },
      after: { url: null },
    });
  };

  return (
    <div
      className="flex flex-col bg-background"
      // Full viewport minus Layout's sticky ticker+nav chrome. Using dvh keeps
      // this correct inside Telegram WebView where the address bar animates.
      style={{ minHeight: 'calc(100dvh - 8rem)' }}
    >
      {/* Header — matches existing Storefront visual language */}
      <div className="px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm flex items-center gap-3 flex-shrink-0">
        <Link
          to="/storefront"
          className="p-1.5 rounded-lg bg-secondary hover:bg-border transition-colors"
          aria-label="Back to storefront"
        >
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </Link>
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-500/20 to-primary/20 border border-primary/30 flex items-center justify-center">
          <Flame className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-foreground truncate">{PORTAL.name}</h1>
          <p className="text-[11px] text-muted-foreground truncate">{PORTAL.description}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] text-primary">
            <ShieldCheck className="w-3 h-3" /> External
          </span>
          {canManage && (
            <button
              onClick={() => setEditing((prev) => !prev)}
              className="p-1.5 rounded-lg bg-secondary hover:bg-border transition-colors"
              aria-label="Configure portal URL"
              title="Configure portal URL"
            >
              <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Admin config row — only rendered when admin opens it */}
      {canManage && editing && (
        <div className="px-4 py-3 border-b border-border bg-secondary/20 flex-shrink-0">
          <p className="text-[11px] text-muted-foreground mb-2">
            Paste the published Lovable app URL (https required). Saved to this browser only — for persistent config, set <code className="text-foreground">defaultUrl</code> in <code className="text-foreground">lib/externalPortals.js</code> or <code className="text-foreground">VITE_PHOENIX_INVESTOR_URL</code>.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={draftUrl}
              onChange={(e) => { setDraftUrl(e.target.value); setDraftError(''); }}
              placeholder="https://your-phoenix-investor.lovable.app"
              className="flex-1 h-10 rounded-xl border border-border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex gap-2">
              <button
                onClick={saveUrl}
                className="h-10 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" /> Save
              </button>
              {url && (
                <button
                  onClick={clearUrl}
                  className="h-10 px-3 rounded-xl border border-border text-xs font-medium text-muted-foreground inline-flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Clear
                </button>
              )}
            </div>
          </div>
          {draftError && <p className="mt-2 text-[11px] text-red-400">{draftError}</p>}
        </div>
      )}

      {/* Embed surface — grows to fill remaining height */}
      <div
        className="flex-1 min-h-0 px-3 sm:px-4 py-3"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        {url ? (
          <LovableEmbed url={url} title={`${PORTAL.name} portal`} />
        ) : (
          <NotConfiguredState isAdmin={canManage} onConfigure={() => setEditing(true)} />
        )}
      </div>
    </div>
  );
}

function NotConfiguredState({ isAdmin, onConfigure }) {
  return (
    <div className="h-full min-h-[60dvh] flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-6 text-center space-y-4 shadow-xl">
        <div className="h-12 w-12 mx-auto rounded-2xl bg-gradient-to-br from-orange-500/20 to-primary/20 border border-primary/30 flex items-center justify-center">
          <Flame className="w-5 h-5 text-primary" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Phoenix Investor</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            This module is powered by an external Lovable app. Once the URL is configured, the portal will open here — or in a new tab if embedding is blocked.
          </p>
        </div>
        {isAdmin ? (
          <button
            onClick={onConfigure}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Settings2 className="w-3.5 h-3.5" /> Configure URL
          </button>
        ) : (
          <p className="text-[11px] text-muted-foreground/70">
            Please check back shortly — an admin is finishing setup.
          </p>
        )}
        <p className="text-[10px] text-muted-foreground/60 inline-flex items-center gap-1 justify-center">
          <ExternalLink className="w-3 h-3" /> Opens securely in a new tab if embedding is blocked.
        </p>
      </div>
    </div>
  );
}