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

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const inactivityHours = payload.inactivityHours || 24;
    const chunkSize = payload.chunkSize || 20;
    const cutoffDate = new Date(Date.now() - inactivityHours * 60 * 60 * 1000);

    const allMemories = await base44.asServiceRole.entities.BotMemory.list('-created_date', 1000);
    const groupedBySession = new Map();

    for (const memory of allMemories) {
      const sessionKey = `${memory.bot_id}::${memory.user_email}::${memory.session_id || 'default'}`;
      if (!groupedBySession.has(sessionKey)) {
        groupedBySession.set(sessionKey, []);
      }
      groupedBySession.get(sessionKey).push(memory);
    }

    const archivedSessions = [];

    for (const [, sessionMessages] of groupedBySession.entries()) {
      const sortedMessages = [...sessionMessages].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      const lastMessage = sortedMessages[sortedMessages.length - 1];
      const lastMessageDate = new Date(lastMessage.created_date);

      if (lastMessageDate > cutoffDate) {
        continue;
      }

      const botId = lastMessage.bot_id;
      const userEmail = lastMessage.user_email;
      const sessionId = lastMessage.session_id || 'default';
      const groupedChunks = chunkMessages(sortedMessages, chunkSize);
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
          user_email: userEmail,
          session_id: sessionId,
          chunk_key: `${botId}-${sessionId}-${Date.parse(lastMessage.created_date)}-${index + 1}`,
          summary,
          keywords: extractKeywords(fullText),
          message_count: chunk.length,
          archive_file_uri: upload.file_uri,
          archive_signed_url: signed.signed_url,
          storage_tier: chunk.length >= chunkSize ? 'cold' : 'warm',
          last_message_at: chunk[chunk.length - 1]?.created_date || lastMessage.created_date,
          is_active: true
        });
        createdChunks.push(created.id);
      }

      for (const memory of sortedMessages) {
        await base44.asServiceRole.entities.BotMemory.delete(memory.id);
      }

      archivedSessions.push({
        bot_id: botId,
        user_email: userEmail,
        session_id: sessionId,
        archived_messages: sortedMessages.length,
        chunk_count: createdChunks.length
      });
    }

    return Response.json({
      success: true,
      archived_sessions: archivedSessions.length,
      sessions: archivedSessions
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});