import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function callOpenAI(prompt, model, fileUrls = []) {
  const safeModel = !model || model === 'automatic' || model === 'gpt-5-mini' ? 'gpt-4o-mini' : model;
  const content = [{ type: 'text', text: prompt }];
  for (const url of fileUrls) {
    content.push({ type: 'image_url', image_url: { url } });
  }
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
    },
    body: JSON.stringify({
      model: safeModel,
      messages: [{ role: 'user', content }],
    }),
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content || data.error?.message || '';
}

async function callAnthropic(prompt, model) {
  const safeModel = !model || model === 'automatic' ? 'claude-3-5-sonnet' : model;
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: safeModel,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await response.json();
  return data.content?.[0]?.text || data.error?.message || '';
}

async function callHuggingFace(prompt, model, token) {
  const safeModel = !model || model === 'automatic' ? 'mistralai/Mistral-7B-Instruct-v0.3' : model;
  const response = await fetch(`https://api-inference.huggingface.co/models/${safeModel}`, {
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
    const fileUrls = Array.isArray(body.file_urls) ? body.file_urls : [];
    let prompt = body.prompt || '';

    if (body.botId && body.dataRequest) {
      const dataResponse = await base44.functions.invoke('botExternalDataAccess', {
        botId: body.botId,
        sourceIndex: body.dataRequest.sourceIndex || 0,
        action: body.dataRequest.action || 'read',
        payload: body.dataRequest.payload || {}
      });
      prompt = `${prompt}\n\nExternal data context:\n${JSON.stringify(dataResponse.data || {}, null, 2)}`;
    };

    if (provider === 'openai') {
      const output = await callOpenAI(prompt, model, fileUrls);
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

    const safeModel = !model || model === 'automatic' ? undefined : model;
    const output = await base44.integrations.Core.InvokeLLM({ prompt, model: safeModel, file_urls: fileUrls });
    return Response.json({ output });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});