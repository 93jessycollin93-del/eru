/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const chunkMessages = (messages, size) => {
  const chunks = [];
  for (let i = 0; i < messages.length; i += size) {
    chunks.push(messages.slice(i, i + size));
  }
  return chunks;
};

const extractKeywords = (text) => {
  const words = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s/-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => word.length > 3);
  return [...new Set(words)].slice(0, 20);
};

const calculateHealthScore = ({ hotCount, chunkCount, pinnedCount, avgImportance }) => {
  return Math.max(40, Math.min(100, Math.round(55 + (pinnedCount * 4) + Math.min(chunkCount, 10) + (avgImportance - 50) / 2 - Math.max(0, hotCount - 80) / 3)));
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

    const [allMemories, allChunks, allBots] = await Promise.all([
      base44.asServiceRole.entities.BotMemory.list('-created_date', 1000),
      base44.asServiceRole.entities.BotMemoryChunk.list('-created_date', 1000),
      base44.asServiceRole.entities.UserBot.list('-updated_date', 500)
    ]);

    const groupedBySession = new Map();
    for (const memory of allMemories) {
      const sessionKey = `${memory.bot_id}::${memory.user_email}::${memory.session_id || 'default'}`;
      if (!groupedBySession.has(sessionKey)) groupedBySession.set(sessionKey, []);
      groupedBySession.get(sessionKey).push(memory);
    }

    const archivedSessions = [];

    for (const [, sessionMessages] of groupedBySession.entries()) {
      const sortedMessages = [...sessionMessages].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      const lastMessage = sortedMessages[sortedMessages.length - 1];
      const lastMessageDate = new Date(lastMessage.created_date);

      if (lastMessageDate > cutoffDate) continue;

      const botId = lastMessage.bot_id;
      const userEmail = lastMessage.user_email;
      const sessionId = lastMessage.session_id || 'default';
      const groupedChunks = chunkMessages(sortedMessages, chunkSize);
      const createdChunks = [];
      const chunkIdMap = new Map();

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
        const keywords = extractKeywords(fullText);
        const avgImportance = Math.round(chunk.reduce((sum, item) => sum + Number(item.importance_score || 50), 0) / chunk.length);
        const created = await base44.asServiceRole.entities.BotMemoryChunk.create({
          bot_id: botId,
          user_email: userEmail,
          session_id: sessionId,
          chunk_key: `${botId}-${sessionId}-${Date.parse(lastMessage.created_date)}-${index + 1}`,
          summary,
          keywords,
          message_count: chunk.length,
          archive_file_uri: upload.file_uri,
          archive_signed_url: signed.signed_url,
          storage_tier: chunk.length >= chunkSize ? 'cold' : 'warm',
          last_message_at: chunk[chunk.length - 1]?.created_date || lastMessage.created_date,
          is_active: true,
          retrieval_score: avgImportance,
          memory_category: chunk.some((item) => item.memory_category === 'strategy') ? 'strategy' : (chunk[0]?.memory_category || 'conversation'),
          source_memory_ids: chunk.map((item) => item.id),
          compression_ratio: Number((Math.max(fullText.length, 1) / Math.max(summary.length, 1)).toFixed(2)),
          quality_score: Math.max(60, avgImportance)
        });
        createdChunks.push(created.id);
        chunk.forEach((item) => chunkIdMap.set(item.id, created.id));
      }

      await Promise.all(sortedMessages.map((memory) =>
        base44.asServiceRole.entities.BotMemory.update(memory.id, {
          superseded_by_chunk_id: chunkIdMap.get(memory.id) || null,
          last_accessed_at: memory.last_accessed_at || memory.updated_date || memory.created_date
        })
      ));

      archivedSessions.push({
        bot_id: botId,
        user_email: userEmail,
        session_id: sessionId,
        archived_messages: sortedMessages.length,
        chunk_count: createdChunks.length
      });
    }

    const profileResults = [];
    for (const bot of allBots) {
      const botMemories = allMemories.filter((item) => item.bot_id === bot.id);
      const botChunks = allChunks.filter((item) => item.bot_id === bot.id);
      const topKeywords = [...new Set(botChunks.flatMap((item) => item.keywords || []).filter(Boolean))].slice(0, 12);
      const strategyChunks = botChunks.filter((item) => item.memory_category === 'strategy').slice(0, 8);
      const avgImportance = botMemories.length
        ? Math.round(botMemories.reduce((sum, item) => sum + Number(item.importance_score || 50), 0) / botMemories.length)
        : 50;
      const pinnedCount = botMemories.filter((item) => item.is_pinned).length;
      const memoryHealthScore = calculateHealthScore({
        hotCount: botMemories.length,
        chunkCount: botChunks.length,
        pinnedCount,
        avgImportance
      });
      const promptBlock = [
        bot.instructions || '',
        topKeywords.length ? `Top recalled topics: ${topKeywords.join(', ')}` : '',
        strategyChunks[0]?.summary ? `Strong past strategy: ${strategyChunks[0].summary}` : ''
      ].filter(Boolean).join('\n\n');

      const existingProfiles = await base44.asServiceRole.entities.BotMemoryProfile.filter({ bot_id: bot.id }, '-updated_date', 1);
      const payloadProfile = {
        bot_id: bot.id,
        bot_name: bot.name,
        identity_summary: bot.description || bot.instructions?.slice(0, 240) || 'Bot memory profile',
        historical_strategies: strategyChunks.map((item) => ({
          goal: item.summary?.slice(0, 120) || 'Archived strategy',
          keywords: (item.keywords || []).slice(0, 8),
          strategy_summary: item.summary,
          source_squad_name: bot.name,
          captured_at: item.last_message_at || item.created_date
        })),
        present_state_summary: `${botMemories.length} hot memories and ${botChunks.length} archived chunks available.`,
        memory_prompt_block: promptBlock,
        last_retrained_at: new Date().toISOString(),
        memory_health_score: memoryHealthScore,
        hot_memory_count: botMemories.length,
        archived_chunk_count: botChunks.length,
        top_keywords: topKeywords,
        preferred_response_patterns: [bot.response_style || 'detailed', bot.role || 'assistant'],
        retrieval_strategy: botChunks.length > botMemories.length ? 'archive_heavy' : 'balanced'
      };

      if (existingProfiles[0]) {
        await base44.asServiceRole.entities.BotMemoryProfile.update(existingProfiles[0].id, payloadProfile);
      } else {
        await base44.asServiceRole.entities.BotMemoryProfile.create(payloadProfile);
      }

      profileResults.push({ bot_id: bot.id, bot_name: bot.name, memory_health_score: memoryHealthScore });
    }

    return Response.json({
      success: true,
      archived_sessions: archivedSessions.length,
      sessions: archivedSessions,
      updated_profiles: profileResults.length,
      profiles: profileResults
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});