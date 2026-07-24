import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * jackyProxy — eYe Wave 1 server-side bridge to the real Jacky Flask engine.
 *
 * Keeps the jacky host + token server-side (Base44 secrets) and sidesteps CORS,
 * so Eru can show real RTX-3090 telemetry and route real inference through the
 * same engine PC uses. Mirrors the shared jackyClient contract.
 *
 * Secrets: JACKY_API_BASE (jacky host root, e.g. https://sas.example.com) and
 * optional JACKY_API_TOKEN.
 *
 * Invoke (POST) with a JSON body:
 *   { "path": "status" }
 *   { "path": "assessment" }
 *   { "path": "ask", "method": "POST", "body": { "prompt": "…", "task_type": "general" } }
 * Returns: { ok, status, data } — data is the upstream JSON.
 */

const ALLOWED = new Set(['GET', 'POST']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const base = (Deno.env.get('JACKY_API_BASE') || '').replace(/\/+$/, '');
    const token = Deno.env.get('JACKY_API_TOKEN') || '';
    if (!base) {
      return Response.json(
        { error: 'jacky link not configured', detail: 'Set the JACKY_API_BASE secret to your jacky host root.' },
        { status: 503 },
      );
    }

    const payload = await req.json().catch(() => ({}));
    const rawPath = String(payload.path || '').replace(/^\/+/, '');
    if (!rawPath) return Response.json({ error: "missing 'path'" }, { status: 400 });
    const method = String(payload.method || 'GET').toUpperCase();
    if (!ALLOWED.has(method)) return Response.json({ error: `method ${method} not allowed` }, { status: 405 });

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const upstream = await fetch(`${base}/api/${rawPath}`, {
        method,
        headers,
        body: method === 'POST' ? JSON.stringify(payload.body ?? {}) : undefined,
        signal: controller.signal,
      });
      const text = await upstream.text();
      let data: unknown;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      return Response.json({ ok: upstream.ok, status: upstream.status, data }, { status: upstream.ok ? 200 : 502 });
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    return Response.json(
      { error: 'jacky proxy error', detail: String((e as Error)?.message || e) },
      { status: 500 },
    );
  }
});
