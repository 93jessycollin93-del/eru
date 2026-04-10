import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bots = await base44.entities.TelegramBot.list('-updated_date', 100);
    const conversations = await base44.entities.TelegramConversation.list('-updated_date', 200);
    const logs = await base44.entities.TelegramMessageLog.list('-created_date', 200);

    const enriched = bots.map((bot) => {
      const botConversations = conversations.filter((item) => item.bot_id === bot.id);
      const botLogs = logs.filter((item) => item.bot_id === bot.id);
      return {
        ...bot,
        conversation_count: botConversations.length,
        recent_logs: botLogs.slice(0, 10),
      };
    });

    return Response.json({ bots: enriched });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});