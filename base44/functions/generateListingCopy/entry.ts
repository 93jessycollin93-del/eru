import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const mediaUrls = Array.isArray(payload.mediaUrls) ? payload.mediaUrls.filter(Boolean) : [];

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a marketplace listing copy assistant.
Create high-conversion but truthful listing copy.
Follow these rules strictly:
- Do not invent specs, brand claims, certifications, rarity, authenticity, or condition details not provided.
- Avoid prohibited language like guaranteed profit, best ever, #1, perfect, or misleading urgency.
- Keep copy compliant for general online marketplaces.
- Emphasize clarity, buyer trust, condition transparency, and search relevance.
- If details are missing, keep wording specific but cautious.
- Return one title, one description, one tag list, and short compliance notes.

Listing context:
- Asset type: ${payload.assetType || 'item'}
- Sale mode: ${payload.saleMode || 'sell'}
- Condition score: ${payload.conditionScore || 'unknown'} / 10
- Existing title: ${payload.existingTitle || ''}
- Existing description: ${payload.existingDescription || ''}
- Existing tags: ${payload.existingTags || ''}
- User prompt: ${payload.prompt || ''}

If media is attached, use it only to describe clearly visible details. Do not guess hidden facts.`,
      file_urls: mediaUrls.length ? mediaUrls : undefined,
      response_json_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          compliance_notes: { type: 'string' }
        },
        required: ['title', 'description', 'tags', 'compliance_notes']
      }
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});