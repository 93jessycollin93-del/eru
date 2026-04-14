/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function tokenize(text) {
  return Array.from(new Set(String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s/-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2)));
}

function buildSearchText(document) {
  const faqText = (document.faq_items || []).map((item) => `${item.question} ${item.answer}`).join(' ');
  return [document.title, document.content, document.file_name, faqText, ...(document.keywords || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .slice(0, 12000);
}

function toVector(tokens) {
  return tokens.slice(0, 64).map((token) => {
    let sum = 0;
    for (let i = 0; i < token.length; i += 1) sum += token.charCodeAt(i);
    return Number((sum / 1000).toFixed(4));
  });
}

function cosineScore(a, b) {
  const length = Math.min(a.length, b.length);
  if (!length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (!magA || !magB) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function scoreDocument(document, queryTokens, queryVector) {
  const terms = document.retrieval_terms || tokenize(document.search_text || '');
  const termSet = new Set(terms);
  const searchText = document.search_text || buildSearchText(document);
  let lexical = 0;
  for (const token of queryTokens) {
    if (termSet.has(token)) lexical += 10;
    if ((document.title || '').toLowerCase().includes(token)) lexical += 8;
    if (searchText.includes(token)) lexical += 4;
  }
  const similarity = cosineScore(queryVector, document.embedding_hint || []);
  return lexical + Math.round(similarity * 100) + Math.min(12, Number(document.usage_count || 0));
}

function buildSnippet(document, queryTokens) {
  if (document.source_type === 'faq') {
    const bestFaq = (document.faq_items || []).find((item) => queryTokens.some((token) => `${item.question} ${item.answer}`.toLowerCase().includes(token)));
    if (bestFaq) return `Q: ${bestFaq.question}\nA: ${bestFaq.answer}`;
  }

  const text = document.content || document.search_text || document.file_name || '';
  if (!text) return document.title || 'Knowledge source';
  const lower = text.toLowerCase();
  const firstMatch = queryTokens.find((token) => lower.includes(token));
  if (!firstMatch) return text.slice(0, 500);
  const index = lower.indexOf(firstMatch);
  const start = Math.max(0, index - 180);
  const end = Math.min(text.length, index + 320);
  return text.slice(start, end).trim();
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
    const botId = String(payload.botId || '').trim();
    const limit = Math.min(8, Math.max(1, Number(payload.limit || 5)));

    if (!query) {
      return Response.json({ results: [], context: '' });
    }

    const documents = await base44.entities.KnowledgeBaseDocument.list('-updated_date', 200);
    const activeDocs = (documents || []).filter((document) => {
      if (document.status && document.status !== 'active') return false;
      if (!botId) return true;
      const linked = document.linked_bot_ids || [];
      return linked.length === 0 || linked.includes(botId);
    });

    const hydrated = activeDocs.map((document) => {
      const searchText = document.search_text || buildSearchText(document);
      const retrievalTerms = (document.retrieval_terms || []).length > 0 ? document.retrieval_terms : tokenize(searchText);
      const embeddingHint = (document.embedding_hint || []).length > 0 ? document.embedding_hint : toVector(retrievalTerms);
      return { ...document, search_text: searchText, retrieval_terms: retrievalTerms, embedding_hint: embeddingHint };
    });

    const queryTokens = tokenize(query);
    const queryVector = toVector(queryTokens);

    const ranked = hydrated
      .map((document) => ({
        ...document,
        similarity_score: scoreDocument(document, queryTokens, queryVector),
        snippet: buildSnippet(document, queryTokens),
      }))
      .filter((document) => document.similarity_score > 0)
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, limit);

    const now = new Date().toISOString();
    await Promise.all(ranked.map((document) => base44.entities.KnowledgeBaseDocument.update(document.id, {
      search_text: document.search_text,
      retrieval_terms: document.retrieval_terms,
      embedding_hint: document.embedding_hint,
      retrieval_score: document.similarity_score,
      usage_count: Number(document.usage_count || 0) + 1,
      last_retrieved_at: now,
    })));

    const context = ranked.map((document, index) => `Source ${index + 1}: ${document.title}\nType: ${document.source_type}\nSnippet: ${document.snippet}`).join('\n\n');

    return Response.json({
      results: ranked.map((document) => ({
        id: document.id,
        title: document.title,
        source_type: document.source_type,
        similarity_score: document.similarity_score,
        snippet: document.snippet,
        linked_bot_ids: document.linked_bot_ids || [],
      })),
      context,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});