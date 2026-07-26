import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * jackyProxy — server-side bridge to the real `jacky` Flask engine.
 *
 * Eru's browser cannot call the engine directly: the origins differ and the
 * engine ships no CORS headers. This function is the hop that both
 * `src/pages/JackyLive.jsx` and `src/lib/jackyClient.ts` go through.
 *
 * Relaying rather than calling direct buys two things beyond CORS:
 *   - the engine URL and token stay in Base44 secrets, never in the bundle;
 *   - every call is behind Base44 auth, so an exposed function URL is not an
 *     open tunnel to the host's shell and GPU.
 *
 * ---------------------------------------------------------------------------
 * REQUEST — both path styles are accepted
 * ---------------------------------------------------------------------------
 * This file merges two independent implementations of the same bridge, so it
 * deliberately accepts either spelling of the engine path and normalizes them
 * to one canonical form. Neither caller had to change.
 *
 *   Bare path (JackyLive's style):
 *     { path: 'status' }
 *     { path: 'ask', method: 'POST', body: { prompt: '…', task_type: 'general' } }
 *
 *   Full path (jackyClient's style, shared with ocd-jacky-777's jacky-proxy):
 *     { path: '/api/status', method: 'GET' }
 *     { path: '/api/ask', method: 'POST', body: { prompt: '…' } }
 *
 *   Plain fetch, for callers not using the SDK:
 *     GET  ?path=/api/status
 *     POST ?path=/api/ask   with the forwarded JSON as the request body
 *
 * The body form wins when both are present. `method` is the method the ENGINE
 * should see — the Base44 SDK can only issue POSTs, so it must be declared.
 *
 * ---------------------------------------------------------------------------
 * RESPONSE — always the envelope
 * ---------------------------------------------------------------------------
 *   { ok: boolean, status: number, data?: unknown, error?: string, detail?: string }
 *
 * `data` is the upstream JSON. Errors raised before reaching the engine (auth,
 * bad path, not allowlisted, no secret) use the same envelope with `ok: false`,
 * so a caller only needs one check — `if (!env.ok) throw` — rather than one
 * branch per failure mode.
 *
 * Secrets (Base44 → Settings → Secrets):
 *   JACKY_API_BASE   e.g. https://jacky.example.trycloudflare.com   (required)
 *   JACKY_API_TOKEN  bearer token for the engine                    (optional)
 */

/**
 * Engine paths this proxy will relay. An allowlist rather than open forwarding:
 * without it, any authenticated Eru user could reach arbitrary paths on the
 * host — including `/api/shell`, which the engine exposes for whitelisted
 * PowerShell. Read-and-infer only; extend deliberately.
 */
const ALLOWED_EXACT = new Set([
  '/api/status',
  '/api/metrics',
  '/api/assessment',
  '/api/ask',
  '/api/control',
  '/api/squads',
  '/api/ecps/compress',
  '/api/ecps/decompress',
  '/api/ecps/benchmark',
]);

/** Squad routes carry a name segment, so they need a pattern. */
const ALLOWED_PATTERNS = [/^\/api\/squads\/[A-Za-z0-9_-]{1,64}\/(ask|discuss)$/];

function isAllowed(path: string): boolean {
  if (ALLOWED_EXACT.has(path)) return true;
  return ALLOWED_PATTERNS.some((re) => re.test(path));
}

/**
 * Fold both accepted spellings into one canonical `/api/...` path, so the
 * allowlist has a single form to check. Traversal attempts survive
 * normalization unchanged (`../shell` stays `../shell`) and are then rejected
 * by the allowlist rather than being silently resolved by `fetch`.
 */
function canonicalizePath(raw: string): string {
  const trimmed = raw.trim().replace(/^\/+/, '');
  return `/api/${trimmed.replace(/^api\//, '')}`;
}

/** Reads default fast; inference needs room to think. */
const READ_TIMEOUT_MS = 8_000;
const INFERENCE_TIMEOUT_MS = 60_000;

/** Every response — success or failure — uses the same envelope. */
function envelope(
  ok: boolean,
  status: number,
  extra: Record<string, unknown> = {},
): Response {
  return Response.json({ ok, status, ...extra }, { status: ok ? 200 : status });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return envelope(false, 401, { error: 'Unauthorized' });

    const base = (Deno.env.get('JACKY_API_BASE') || '').replace(/\/+$/, '');
    const token = Deno.env.get('JACKY_API_TOKEN') || '';
    if (!base) {
      return envelope(false, 503, {
        error: 'jacky link not configured',
        detail:
          'Set the JACKY_API_BASE secret in Base44 → Settings → Secrets, pointing at your ' +
          'Jacky engine host root (e.g. a Cloudflare tunnel URL).',
        needs_secret: 'JACKY_API_BASE',
      });
    }

    // A POST always carries JSON here (SDK style); a bare GET carries nothing
    // and falls back to the query string.
    let payload: { path?: unknown; method?: unknown; body?: unknown } = {};
    if (req.method === 'POST') {
      try {
        payload = await req.json();
      } catch {
        return envelope(false, 400, { error: 'Request body must be valid JSON' });
      }
    }

    const rawPath =
      typeof payload.path === 'string' && payload.path
        ? payload.path
        : new URL(req.url).searchParams.get('path');

    if (!rawPath) {
      return envelope(false, 400, {
        error: "missing 'path'",
        detail: 'Pass { path: "status" } or { path: "/api/status" }, or ?path=/api/status',
      });
    }

    const enginePath = canonicalizePath(rawPath);
    if (!isAllowed(enginePath)) {
      // Explicit about the reason — a silent 404 here is a debugging trap.
      return envelope(false, 403, {
        error: `Path not allowlisted by jackyProxy: ${enginePath}`,
        detail: 'Add it to ALLOWED_EXACT/ALLOWED_PATTERNS if this endpoint should be reachable.',
      });
    }

    // The method the ENGINE should see, which is not always this request's own.
    const method =
      String(payload.method || '').toUpperCase() === 'POST' ||
      (!payload.path && req.method === 'POST')
        ? 'POST'
        : 'GET';

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let body: string | undefined;
    if (method === 'POST') {
      headers['Content-Type'] = 'application/json';
      // Envelope style nests the engine payload under `body`; plain-fetch style
      // sends it as the whole request body.
      body = JSON.stringify(payload.path ? (payload.body ?? {}) : payload);
    }

    const timeoutMs = method === 'POST' ? INFERENCE_TIMEOUT_MS : READ_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const upstream = await fetch(base + enginePath, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      const text = await upstream.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text.slice(0, 2_000) };
      }
      // Pass the engine's own status through, so a broken tunnel and an engine
      // that answered with an error stay distinguishable.
      return Response.json(
        { ok: upstream.ok, status: upstream.status, data },
        { status: upstream.ok ? 200 : 502 },
      );
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      return envelope(false, 504, {
        error: aborted
          ? `Jacky engine timed out after ${timeoutMs}ms`
          : `Jacky engine unreachable: ${(err as Error).message}`,
        offline: true,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    return envelope(false, 500, {
      error: 'jacky proxy error',
      detail: String((e as Error)?.message || e),
    });
  }
});
