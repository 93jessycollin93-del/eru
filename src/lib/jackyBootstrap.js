/**
 * Wires the shared `jackyClient` to Eru's platform.
 *
 * `jackyClient.ts` is byte-identical in all four fleet repos, so it carries no
 * knowledge of Base44. This file is the seam: it hands the client an invoker
 * that routes every engine call through the `jackyProxy` serverless function,
 * which holds the engine URL and token in Base44 secrets and inherits Base44
 * auth. See `base44/functions/jackyProxy/entry.ts`.
 *
 * Import once, as early as possible — `src/main.jsx` or `src/App.jsx`:
 *
 *     import '@/lib/jackyBootstrap';
 *
 * Idempotent, so a stray second import is harmless.
 */

import { base44 } from '@/api/base44Client';
import { jackyClient } from '@/lib/jackyClient';

let wired = false;

export function bootstrapJacky() {
  if (wired) return jackyClient;
  wired = true;

  jackyClient.setProxyInvoker(async (path, init) => {
    // The SDK can only issue POSTs, so the engine path and method ride in the
    // body. `path` arrives as `/api/status`; jackyProxy also accepts the bare
    // `status` spelling JackyLive uses and normalizes both.
    let raw;
    try {
      raw = await base44.functions.invoke('jackyProxy', {
        path,
        method: init.method,
        body: init.body,
      });
    } catch (err) {
      // invoke() is axios-based: it REJECTS on any non-2xx, so every deliberate
      // error jackyProxy returns (403 not allowlisted, 503 missing secret, 504
      // timeout) arrives here rather than in the success path. Without this,
      // those messages are replaced by a generic "status code 403".
      const relayed = err?.response?.data;
      throw new Error(relayed?.error || relayed?.detail || err?.message || 'jackyProxy invoke failed');
    }

    if (raw?.error) throw new Error(raw.error.message || 'jackyProxy invoke failed');

    // Unwrap to the engine payload. Base44 may hand back the function body
    // directly or nested under `data`, and the function itself answers with a
    // { ok, status, data } envelope — so peel at most two layers, the same way
    // JackyLive.jsx does.
    let env = raw?.data ?? raw;
    if (env?.data && (env.data.ok !== undefined || env.data.data !== undefined)) {
      env = env.data;
    }

    // Surface engine-level failures as thrown errors so jackyClient flips the
    // link state rather than handing a bad payload to a dashboard.
    if (env?.ok === false) {
      throw new Error(env.error || `jacky ${path} → HTTP ${env.status || '??'}`);
    }
    return env?.data ?? env;
  });

  return jackyClient;
}

export default bootstrapJacky();
