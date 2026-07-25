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
    // body — the envelope shape jackyProxy expects.
    const { data, error } = await base44.functions.invoke('jackyProxy', {
      path,
      method: init.method,
      body: init.body,
    });

    if (error) throw new Error(error.message || 'jackyProxy invoke failed');
    // The proxy passes engine-level errors through in the payload rather than
    // as a transport failure; surface them as thrown errors so jackyClient
    // flips the link state instead of handing a bad payload to a dashboard.
    if (data && typeof data === 'object' && 'error' in data && data.error) {
      throw new Error(String(data.error));
    }
    return data;
  });

  return jackyClient;
}

export default bootstrapJacky();
