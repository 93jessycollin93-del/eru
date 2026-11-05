import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Offline by default: this function reaches outside services, so it only runs
// when the owner turns its group on in the ONLINE_FEATURES secret
// (comma-separated, e.g. "cloud_ai,email", or "all"). Empty or unset = offline.
function isOnline(group: string): boolean {
  const on = (Deno.env.get('ONLINE_FEATURES') || '').split(',').map((g) => g.trim().toLowerCase());
  return on.includes('all') || on.includes(group);
}
function offlineResponse(...groups: string[]): Response | null {
  const off = groups.find((g) => !isOnline(g));
  if (!off) return null;
  return Response.json(
    { ok: false, error: 'offline_mode', group: off, message: `Offline mode: "${off}" is turned off. The owner can add it to the ONLINE_FEATURES secret.` },
    { status: 403 },
  );
}

const CONNECTOR_ID = '69d912f9261810057ced4675';

Deno.serve(async (req) => {
  const offlineBlock = offlineResponse('cloud_ai');
  if (offlineBlock) return offlineBlock;

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { model, prompt } = await req.json();
    const accessToken = await base44.asServiceRole.connectors.getCurrentAppUserAccessToken(CONNECTOR_ID);

    const response = await fetch(`https://api-inference.huggingface.co/models/${model || 'google/flan-t5-base'}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    const data = await response.json();
    const content = Array.isArray(data) ? (data[0]?.generated_text || '') : (data.generated_text || JSON.stringify(data));
    return Response.json({ content });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});