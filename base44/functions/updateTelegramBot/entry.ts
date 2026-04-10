import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    if (!payload.botId) {
      return Response.json({ error: 'botId is required' }, { status: 400 });
    }

    const updated = await base44.entities.TelegramBot.update(payload.botId, {
      system_prompt: payload.system_prompt,
      greeting_message: payload.greeting_message,
      flow_blocks: payload.flow_blocks,
      memory_enabled: payload.memory_enabled,
      max_memory_messages: payload.max_memory_messages,
      tool_modules: payload.tool_modules,
      status: payload.status,
    });

    return Response.json({ bot: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});