import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bots = await base44.entities.TelegramBot.list('-updated_date', 50);
    const messages = await base44.entities.TelegramBotMessage.list('-created_date', 200);
    const logs = await base44.entities.TelegramBotLog.list('-created_date', 200);
    const sessions = await base44.entities.TelegramBotSession.list('-updated_date', 200);

    return Response.json({
      bots,
      messages,
      logs,
      sessions
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});