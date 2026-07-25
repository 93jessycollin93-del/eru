import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * jackyProxy — server-side relay to the real `jacky` Flask engine.
 *
 * Eru's browser cannot call the engine directly: the origins differ and the
 * engine ships no CORS headers. This function is the same-origin hop that
 * `src/lib/jackyClient.js` targets when its transport is `proxy`.
 *
 * Relaying rather than calling direct buys two things beyond CORS:
 *   - the engine URL and token stay in Base44 secrets, never in the bundle;
 *   - every call is behind Base44 auth, so an exposed function URL is not an
 *     open tunnel to the host's shell and GPU.
 *
 * Contract (matches supabase/functions/jacky-proxy in ocd-jacky-777, so one
 * client file serves both platforms). Two equivalent request shapes:
 *
 *   1. SDK style — what `base44.functions.invoke('jackyProxy', …)` produces.
 *      Always a POST, so the engine path and method travel in the body:
 *        { path: '/api/status', method: 'GET' }
 *        { path: '/api/ask', method: 'POST', body: { prompt: '…' } }
 *
 *   2. Plain fetch style, for callers not using the SDK:
 *        GET  ?path=/api/status
 *        POST ?path=/api/ask   with the forwarded JSON as the request body
 *
 * The body form wins when both are present.
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

/** Reads default fast; inference needs room to think. */
const READ_TIMEOUT_MS = 8_000;
const INFERENCE_TIMEOUT_MS = 60_000;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const base = Deno.env.get('JACKY_API_BASE')?.replace(/\/+$/, '');
    if (!base) {
      return Response.json(
        {
          error:
            'JACKY_API_BASE not configured. Add it in Base44 → Settings → Secrets, ' +
            'pointing at your Jacky engine (e.g. a Cloudflare tunnel URL).',
          needs_secret: 'JACKY_API_BASE',
        },
        { status: 503 },
      );
    }

    // Read the envelope. A POST always carries JSON here (SDK style); a bare
    // GET carries nothing and falls back to the query string.
    let envelope: { path?: unknown; method?: unknown; body?: unknown } = {};
    if (req.method === 'POST') {
      try {
        envelope = await req.json();
      } catch {
        return Response.json({ error: 'Request body must be valid JSON' }, { status: 400 });
      }
    }

    const path =
      typeof envelope.path === 'string' && envelope.path
        ? envelope.path
        : new URL(req.url).searchParams.get('path');

    if (!path) {
      return Response.json(
        { error: 'Missing engine path — pass { path: "/api/status" } or ?path=/api/status' },
        { status: 400 },
      );
    }
    if (!path.startsWith('/api/')) {
      return Response.json({ error: 'path must start with /api/' }, { status: 400 });
    }
    if (!isAllowed(path)) {
      // Explicit about the reason — a silent 404 here is a debugging trap.
      return Response.json(
        { error: `Path not allowlisted by jackyProxy: ${path}` },
        { status: 403 },
      );
    }

    // The method the ENGINE should see. In SDK style this is always declared in
    // the envelope, because the SDK itself can only issue POSTs.
    const method = envelope.method === 'POST' || (!envelope.path && req.method === 'POST') ? 'POST' : 'GET';

    const headers: Record<string, string> = { Accept: 'application/json' };
    const token = Deno.env.get('JACKY_API_TOKEN');
    if (token) headers.Authorization = `Bearer ${token}`;

    let body: string | undefined;
    if (method === 'POST') {
      headers['Content-Type'] = 'application/json';
      // Envelope style nests the engine payload under `body`; fetch style sends
      // it as the whole request body.
      const payload = envelope.path ? (envelope.body ?? {}) : envelope;
      body = JSON.stringify(payload);
    }

    const timeoutMs = method === 'POST' ? INFERENCE_TIMEOUT_MS : READ_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const upstream = await fetch(base + path, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      const text = await upstream.text();
      // Pass the engine's own status through so the client can distinguish a
      // broken tunnel from an engine that answered with an error.
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { error: 'Engine returned a non-JSON response', raw: text.slice(0, 2_000) };
      }
      return Response.json(payload, { status: upstream.ok ? 200 : upstream.status });
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      return Response.json(
        {
          error: aborted
            ? `Jacky engine timed out after ${timeoutMs}ms`
            : `Jacky engine unreachable: ${(err as Error).message}`,
          offline: true,
        },
        { status: 504 },
      );
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    return Response.json({ error: `jackyProxy failed: ${(err as Error).message}` }, { status: 500 });
  }
});
