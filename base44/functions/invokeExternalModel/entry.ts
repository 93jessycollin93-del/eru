import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function callOpenAI(prompt, model) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callAnthropic(prompt, model) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || 'claude-3-5-sonnet',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await response.json();
  return data.content?.[0]?.text || '';
}

async function callHuggingFace(prompt, model, token) {
  const response = await fetch(`https://api-inference.huggingface.co/models/${model || 'mistralai/Mistral-7B-Instruct-v0.3'}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ inputs: prompt }),
  });
  const data = await response.json();
  if (Array.isArray(data)) {
    return data[0]?.generated_text || '';
  }
  return data.generated_text || data.error || '';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const provider = body.provider || 'base44';
    const model = body.model || 'automatic';
    const prompt = body.prompt || '';

    if (provider === 'openai') {
      const output = await callOpenAI(prompt, model);
      return Response.json({ output });
    }

    if (provider === 'anthropic') {
      const output = await callAnthropic(prompt, model);
      return Response.json({ output });
    }

    if (provider === 'huggingface_builder') {
      const token = Deno.env.get('HUGGINGFACE_API_KEY') || '';
      const output = await callHuggingFace(prompt, model, token);
      return Response.json({ output });
    }

    if (provider === 'huggingface_user') {
      const token = await base44.asServiceRole.connectors.getCurrentAppUserAccessToken('69d912f9261810057ced4675');
      const output = await callHuggingFace(prompt, model, token);
      return Response.json({ output });
    }

    const output = await base44.integrations.Core.InvokeLLM({ prompt, model: model === 'automatic' ? undefined : model });
    return Response.json({ output });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});