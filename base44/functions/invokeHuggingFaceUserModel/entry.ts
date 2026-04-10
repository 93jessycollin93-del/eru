import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const CONNECTOR_ID = '69d912f9261810057ced4675';

Deno.serve(async (req) => {
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