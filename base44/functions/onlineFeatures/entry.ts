import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// onlineFeatures — tells the signed-in app which outside-service groups the
// owner has turned on in the ONLINE_FEATURES secret. Empty or unset = offline.
// Read-only: the secret can only be changed in the Base44 dashboard.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const groups = (Deno.env.get('ONLINE_FEATURES') || '')
      .split(',')
      .map((g) => g.trim().toLowerCase())
      .filter(Boolean);
    return Response.json({ ok: true, groups });
  } catch {
    return Response.json({ ok: false, groups: [] }, { status: 500 });
  }
});
