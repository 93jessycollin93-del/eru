import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const chunkMessages = (messages, size) => {
  const chunks = [];
  for (let i = 0; i < messages.length; i += size) {
    chunks.push(messages.slice(i, i + size));
  }
  return chunks;
};

const extractKeywords = (text) => {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s/-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => word.length > 3);
  return [...new Set(words)].slice(0, 20);
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const botId = payload.botId;
    const sessionId = payload.sessionId;
    const chunkSize = payload.chunkSize || 20;

    if (!botId) {
      return Response.json({ error: 'botId is required' }, { status: 400 });
    }

    const allMemories = await base44.entities.BotMemory.list('-created_date', 500);
    const targetMemories = allMemories
      .filter((item) => item.bot_id === botId && (!sessionId || item.session_id === sessionId))
      .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

    if (targetMemories.length === 0) {
      return Response.json({ success: true, archived: 0, chunks: [] });
    }

    const groupedChunks = chunkMessages(targetMemories, chunkSize);
    const createdChunks = [];

    for (let index = 0; index < groupedChunks.length; index += 1) {
      const chunk = groupedChunks[index];
      const fullText = chunk.map((item) => `${item.role}: ${item.content}`).join('\n\n');
      const upload = await base44.asServiceRole.integrations.Core.UploadPrivateFile({
        file: new Blob([JSON.stringify(chunk, null, 2)], { type: 'application/json' })
      });
      const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
        file_uri: upload.file_uri,
        expires_in: 604800
      });

      const summary = fullText.length > 500 ? `${fullText.slice(0, 500)}...` : fullText;
      const created = await base44.asServiceRole.entities.BotMemoryChunk.create({
        bot_id: botId,
        user_email: user.email,
        session_id: sessionId || chunk[0]?.session_id || null,
        chunk_key: `${botId}-${sessionId || 'all'}-${index + 1}`,
        summary,
        keywords: extractKeywords(fullText),
        message_count: chunk.length,
        archive_file_uri: upload.file_uri,
        archive_signed_url: signed.signed_url,
        storage_tier: chunk.length >= chunkSize ? 'cold' : 'warm',
        last_message_at: chunk[chunk.length - 1]?.created_date || new Date().toISOString(),
        is_active: true
      });

      createdChunks.push(created);
    }

    return Response.json({ success: true, archived: targetMemories.length, chunks: createdChunks });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});