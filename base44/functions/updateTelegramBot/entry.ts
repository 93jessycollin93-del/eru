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

    const existing = await base44.entities.TelegramBot.get(payload.botId);
    if (!existing) {
      return Response.json({ error: 'Bot not found' }, { status: 404 });
    }
    if (existing.created_by !== user.email && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = await base44.entities.TelegramBot.update(payload.botId, {
      system_prompt: payload.system_prompt,
      greeting_message: payload.greeting_message,
      flow_blocks: payload.flow_blocks,
      memory_enabled: payload.memory_enabled,
      memory_message_limit: payload.memory_message_limit,
      tool_modules: payload.tool_modules,
      status: payload.status,
      swarm_enabled: payload.swarm_enabled,
      router_bot_id: payload.router_bot_id,
      specialist_bot_ids: payload.specialist_bot_ids,
      swarm_goal_template: payload.swarm_goal_template,
      front_door_role: payload.front_door_role,
      backend_swarm_size: payload.backend_swarm_size,
      swarm_execution_mode: payload.swarm_execution_mode,
      max_specialists_per_request: payload.max_specialists_per_request,
    });

    return Response.json({ bot: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});