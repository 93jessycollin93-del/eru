import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { provider, model, prompt } = await req.json();

    if (!provider || !prompt) {
      return Response.json({ error: 'Missing provider or prompt' }, { status: 400 });
    }

    if (provider === 'openai') {
      const apiKey = Deno.env.get('OPENAI_API_KEY');
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await response.json();
      return Response.json({ content: data.choices?.[0]?.message?.content || '' });
    }

    if (provider === 'anthropic') {
      const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model || 'claude-3-5-sonnet-latest',
          max_tokens: 1200,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await response.json();
      return Response.json({ content: data.content?.[0]?.text || '' });
    }

    return Response.json({ error: 'Unsupported provider' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});