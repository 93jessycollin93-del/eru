import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function tokenize(text) {
  return Array.from(new Set(String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s/-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2)));
}

function toVector(tokens) {
  return tokens.slice(0, 64).map((token) => {
    let sum = 0;
    for (let i = 0; i < token.length; i += 1) sum += token.charCodeAt(i);
    return Number((sum / 1000).toFixed(4));
  });
}

// SSRF guard: refuse fetches that target private / link-local / loopback
// addresses, or non-https schemes. Resolves the host first so an attacker
// can't bypass the literal IPv4 check via a hostname pointing at metadata.
async function assertSafeUrl(rawUrl) {
  let parsed;
  try { parsed = new URL(rawUrl); }
  catch { throw new Error('Invalid URL'); }

  if (parsed.protocol !== 'https:') {
    throw new Error('Only https:// URLs are allowed');
  }
  const host = parsed.hostname;
  if (!host) throw new Error('URL has no hostname');

  // Reject hostnames that look like raw IPs in private/loopback ranges. We
  // also pin to the resolved IP via Deno.resolveDns where available so a
  // hostname → metadata IP can't slip past.
  const isPrivateIp = (ip) => {
    if (!ip) return false;
    if (ip === '::1' || ip === '0.0.0.0' || ip.startsWith('127.')) return true;
    if (ip.startsWith('169.254.') || ip.startsWith('10.')) return true;
    if (ip.startsWith('192.168.')) return true;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
    if (ip.startsWith('fc') || ip.startsWith('fd')) return true; // fc00::/7
    if (ip.startsWith('fe80:')) return true; // link-local v6
    return false;
  };
  if (isPrivateIp(host)) {
    throw new Error('Private / link-local addresses are not allowed');
  }

  // Best-effort DNS pinning. Deno.resolveDns may not be permitted in all
  // Base44 runtimes; if it throws, we still reject the literal-IP cases above.
  try {
    const records = await Promise.all([
      Deno.resolveDns(host, 'A').catch(() => []),
      Deno.resolveDns(host, 'AAAA').catch(() => []),
    ]);
    const all = records.flat();
    if (all.length > 0 && all.every((ip) => isPrivateIp(ip))) {
      throw new Error('Hostname resolves only to private addresses');
    }
    if (all.some((ip) => isPrivateIp(ip))) {
      throw new Error('Hostname resolves to a private address');
    }
  } catch (err) {
    if (err && err.message && err.message.includes('private')) throw err;
    // Resolver disabled or threw — proceed with the literal-IP guard above.
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const botId = String(payload.botId || '').trim();
    const sourceType = String(payload.sourceType || '').trim();
    const titleInput = String(payload.title || '').trim();
    const url = String(payload.url || '').trim();
    const fileUrl = String(payload.fileUrl || '').trim();
    const fileName = String(payload.fileName || '').trim();
    const mimeType = String(payload.mimeType || '').trim();

    if (!botId || !sourceType) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let rawText = '';
    let file_url = fileUrl;
    let file_name = fileName;
    let mime_type = mimeType;
    let sourceLabel = sourceType;

    if (sourceType === 'url') {
      if (!url) {
        return Response.json({ error: 'Missing URL' }, { status: 400 });
      }
      try {
        await assertSafeUrl(url);
      } catch (err) {
        return Response.json({ error: `URL rejected: ${err.message || 'unsafe URL'}` }, { status: 400 });
      }
      const response = await fetch(url, { redirect: 'manual' });
      // If the upstream tries to redirect us into a private network we
      // rejected, fail closed rather than follow blindly.
      if (response.status >= 300 && response.status < 400) {
        return Response.json({ error: 'URL redirects are not followed' }, { status: 400 });
      }
      const html = await response.text();
      rawText = html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 24000);
      sourceLabel = url;
    }

    if (sourceType === 'file') {
      if (!fileUrl) {
        return Response.json({ error: 'Missing file URL' }, { status: 400 });
      }
      const extractResponse = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: fileUrl,
        json_schema: {
          type: 'object',
          properties: {
            content: { type: 'string' }
          },
          required: ['content']
        }
      });

      if (extractResponse.status !== 'success' || !extractResponse.output?.content) {
        return Response.json({ error: 'Could not extract text from file' }, { status: 400 });
      }

      rawText = String(extractResponse.output.content).slice(0, 24000);
      sourceLabel = fileName || 'Uploaded file';
    }

    if (!rawText.trim()) {
      return Response.json({ error: 'No readable content found' }, { status: 400 });
    }

    const summary = await base44.integrations.Core.InvokeLLM({
      prompt: `You are preparing training context for a Telegram support and assistant bot.

Source label: ${sourceLabel}
Raw source content:
${rawText}

Return JSON with:
- title: short document title
- summary: concise summary for the bot
- keywords: array of important retrieval keywords
- faq_items: up to 5 FAQ style question-answer pairs extracted from the content`,
      response_json_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          keywords: { type: 'array', items: { type: 'string' } },
          faq_items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                question: { type: 'string' },
                answer: { type: 'string' }
              },
              required: ['question', 'answer']
            }
          }
        },
        required: ['title', 'summary', 'keywords', 'faq_items']
      }
    });

    const normalizedKeywords = Array.from(new Set((summary.keywords || []).map((item) => String(item).trim()).filter(Boolean))).slice(0, 20);
    const content = `${summary.summary}\n\n${rawText}`.slice(0, 24000);
    const searchText = [summary.title, summary.summary, rawText, ...normalizedKeywords].filter(Boolean).join(' ').toLowerCase();
    const retrievalTerms = tokenize(searchText);

    const document = await base44.entities.KnowledgeBaseDocument.create({
      title: titleInput || summary.title || sourceLabel,
      source_type: 'document',
      file_name: file_name || (sourceType === 'url' ? url : ''),
      file_url: file_url || url,
      mime_type: mime_type || (sourceType === 'url' ? 'text/html' : 'text/plain'),
      content,
      faq_items: summary.faq_items || [],
      keywords: normalizedKeywords,
      linked_bot_ids: [botId],
      search_text: searchText,
      retrieval_terms: retrievalTerms,
      embedding_hint: toVector(retrievalTerms),
      status: 'active'
    });

    return Response.json({
      success: true,
      document,
      summary: summary.summary,
      keywords: normalizedKeywords,
      faq_count: (summary.faq_items || []).length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});