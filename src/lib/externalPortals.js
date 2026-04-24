/**
 * External Portals — owner-configurable registry
 * ----------------------------------------------------------------------------
 * The portal URL is resolved in this order:
 *
 *   1. localStorage override (for quick owner/admin testing in-app)
 *        key:  external_portal_url::<portalId>
 *   2. Environment variable at build time (Vite)
 *        PHOENIX_INVESTOR:  import.meta.env.VITE_PHOENIX_INVESTOR_URL
 *   3. The `defaultUrl` constant below — OWNER: paste the external Lovable app
 *      URL here once it's available. Must be https.
 *
 * Leaving all three blank is safe — the portal UI will show a "Configure URL"
 * state instead of a broken iframe.
 *
 * SECURITY NOTE:
 *   External sites may refuse iframe embedding via CSP `frame-ancestors` or
 *   `X-Frame-Options`. LovableEmbed handles that case with a visible fallback
 *   and an "Open externally" button.
 * --------------------------------------------------------------------------*/

export const EXTERNAL_PORTALS = {
  phoenix_investor: {
    id: 'phoenix_investor',
    name: 'Phoenix Investor',
    description: 'External Lovable storefront/app portal.',
    // OWNER: paste the published Lovable app URL here when ready, e.g.
    //   defaultUrl: 'https://phoenix-investor.lovable.app'
    defaultUrl: '',
  },
};

const STORAGE_PREFIX = 'external_portal_url::';

function readLocalOverride(portalId) {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${portalId}`);
    return raw && raw.trim() ? raw.trim() : '';
  } catch {
    return '';
  }
}

function readEnvOverride(portalId) {
  // Vite exposes only VITE_* prefixed env vars to the client.
  if (portalId === 'phoenix_investor') {
    try {
      return import.meta.env?.VITE_PHOENIX_INVESTOR_URL || '';
    } catch {
      return '';
    }
  }
  return '';
}

export function getPortalUrl(portalId) {
  const portal = EXTERNAL_PORTALS[portalId];
  if (!portal) return '';
  return readLocalOverride(portalId) || readEnvOverride(portalId) || portal.defaultUrl || '';
}

export function setPortalUrlOverride(portalId, url) {
  try {
    if (url && url.trim()) {
      localStorage.setItem(`${STORAGE_PREFIX}${portalId}`, url.trim());
    } else {
      localStorage.removeItem(`${STORAGE_PREFIX}${portalId}`);
    }
  } catch {
    // no-op: localStorage can be unavailable in some WebViews
  }
}