/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function tokenize(text) {
  return Array.from(new Set(String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s/-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2)));
}

function scoreMatch(item, queryTokens) {
  const haystack = `${item.title || ''} ${item.summary || ''} ${item.search_text || ''} ${(item.keywords || []).join(' ')}`.toLowerCase();
  const keywordSet = new Set((item.keywords || []).map((word) => String(word).toLowerCase()));
  let score = Number(item.retrieval_score || 0) * 0.45 + Number(item.success_score || 0) * 0.25 + Number(item.quality_score || 0) * 0.2;
  for (const token of queryTokens) {
    if (keywordSet.has(token)) score += 18;
    if ((item.title || '').toLowerCase().includes(token)) score += 12;
    if (haystack.includes(token)) score += 7;
  }
  return Math.round(score + Math.min(10, Number(item.usage_count || 0)));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const query = String(payload.query || '').trim();
    const botId = payload.botId;
    const category = payload.category;
    const limit = Math.min(20, Math.max(1, Number(payload.limit || 8)));

    if (!query) {
      return Response.json({ results: [] });
    }

    const queryTokens = tokenize(query);
    const allItems = await base44.entities.BotSemanticMemory.list('-updated_date', 500);
    const filtered = (allItems || []).filter((item) => {
      const botMatch = !botId || item.bot_id === botId;
      const categoryMatch = !category || category === 'all' || item.memory_category === category;
      return botMatch && categoryMatch;
    });

    const ranked = filtered
      .map((item) => ({ ...item, semantic_score: scoreMatch(item, queryTokens) }))
      .filter((item) => item.semantic_score > 0)
      .sort((a, b) => b.semantic_score - a.semantic_score)
      .slice(0, limit);

    const now = new Date().toISOString();
    await Promise.all(ranked.map((item) => base44.entities.BotSemanticMemory.update(item.id, {
      usage_count: Number(item.usage_count || 0) + 1,
      last_retrieved_at: now
    })));

    return Response.json({ results: ranked });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});