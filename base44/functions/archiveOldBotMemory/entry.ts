/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const keepRecentCount = payload.keepRecentCount || 100;
    const chunkSize = payload.chunkSize || 20;

    const memories = await base44.asServiceRole.entities.BotMemory.list('-created_date', 2000);
    const botIds = [...new Set((memories || []).map((item) => item.bot_id).filter(Boolean))];
    const processed = [];

    for (const botId of botIds) {
      const botMemories = memories.filter((item) => item.bot_id === botId);
      if (botMemories.length <= keepRecentCount) continue;

      const response = await base44.asServiceRole.functions.invoke('archiveBotMemory', {
        botId,
        keepRecentCount,
        chunkSize
      });

      processed.push({
        bot_id: botId,
        archived: response.data?.archived || 0,
        remaining_hot_memories: response.data?.remaining_hot_memories || keepRecentCount
      });
    }

    return Response.json({ success: true, processed_bots: processed.length, bots: processed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});