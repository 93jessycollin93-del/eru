import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function runTelegramSwarm({ base44, telegramBot, incomingText, userContext, sessionContext }) {
  const routerBot = telegramBot?.router_bot_id
    ? await base44.asServiceRole.entities.UserBot.get(telegramBot.router_bot_id).catch(() => null)
    : null;

  const specialistBots = telegramBot?.specialist_bot_ids?.length
    ? await Promise.all(
        telegramBot.specialist_bot_ids.map((id) =>
          base44.asServiceRole.entities.UserBot.get(id).catch(() => null)
        )
      ).then((rows) => rows.filter(Boolean))
    : [];

  if (!telegramBot?.swarm_enabled || !routerBot || specialistBots.length === 0) {
    return null;
  }

  const maxSpecialists = Math.max(1, Math.min(Number(telegramBot?.max_specialists_per_request || 6), 24));
  const backendSwarmSize = Math.max(specialistBots.length, Number(telegramBot?.backend_swarm_size || specialistBots.length || 0));

  const routerContext = `You are ${routerBot.name}, the master router bot for a Telegram front-door bot.
Router instructions: ${routerBot.instructions || ''}
Front-door role: ${telegramBot.front_door_role || 'general'}
Execution mode: ${telegramBot.swarm_execution_mode || 'targeted'}
Represented backend swarm size: ${backendSwarmSize}
Max specialists to invoke now: ${maxSpecialists}
Telegram routing template: ${telegramBot.swarm_goal_template || 'Route the request to the best specialists and synthesize a final reply.'}
Incoming Telegram message: ${incomingText}
User context: ${userContext}
Session context: ${sessionContext || 'No stored session context.'}
Specialists available: ${specialistBots.map((bot) => `${bot.id} | ${bot.name} | ${bot.role}`).join('\n')}
`;

  const routingPlan = await base44.integrations.Core.InvokeLLM({
    prompt: `${routerContext}

Return JSON with:
- selected_bot_ids: array of specialist bot ids to use
- delegation_notes: object mapping bot id to a short delegated assignment
- final_synthesis_instruction: short instruction for combining specialist results`,
    response_json_schema: {
      type: 'object',
      properties: {
        selected_bot_ids: { type: 'array', items: { type: 'string' } },
        delegation_notes: {
          type: 'object',
          additionalProperties: { type: 'string' }
        },
        final_synthesis_instruction: { type: 'string' }
      },
      required: ['selected_bot_ids', 'delegation_notes', 'final_synthesis_instruction']
    }
  });

  const selectedSpecialists = specialistBots.filter((bot) => routingPlan.selected_bot_ids.includes(bot.id)).slice(0, maxSpecialists);
  const specialistResults = [];

  for (const bot of selectedSpecialists) {
    const specialistContext = `You are ${bot.name}, a ${bot.role} specialist bot.
Instructions: ${bot.instructions || ''}
Incoming Telegram message: ${incomingText}
User context: ${userContext}
Session context: ${sessionContext || 'No stored session context.'}
Delegated assignment: ${routingPlan.delegation_notes?.[bot.id] || 'Contribute your best specialist response.'}
Provide a concise specialist contribution for the router.`;
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: specialistContext
    });
    specialistResults.push({
      bot_id: bot.id,
      bot_name: bot.name,
      delegated_assignment: routingPlan.delegation_notes?.[bot.id] || 'Contribute your best specialist response.',
      prompt_context: specialistContext,
      result
    });
  }

  const finalReply = await base44.integrations.Core.InvokeLLM({
    prompt: `You are ${routerBot.name}, the master router bot.
Incoming Telegram message: ${incomingText}
Synthesis instruction: ${routingPlan.final_synthesis_instruction}
Specialist results:
${specialistResults.map((item) => `${item.bot_name}: ${item.result}`).join('\n\n')}

Write the final Telegram reply in a clear, direct, compact format.`
  });

  return {
    reply: finalReply,
    specialists_used: specialistResults.map((item) => item.bot_name),
    trace: specialistResults,
    routing_plan: routingPlan,
    router_context: routerContext,
    represented_swarm_size: backendSwarmSize,
    invoked_specialist_count: selectedSpecialists.length
  };
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
    const incomingText = String(payload.incomingText || '').trim();
    const userLabel = String(payload.userLabel || 'Sandbox user').trim();
    const sessionContext = String(payload.sessionContext || '').trim();

    if (!botId || !incomingText) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const telegramBot = await base44.entities.TelegramBot.get(botId);
    const swarmResult = await runTelegramSwarm({
      base44,
      telegramBot,
      incomingText,
      userContext: `Simulated Telegram user: ${userLabel}`,
      sessionContext
    });

    if (!swarmResult) {
      return Response.json({ error: 'This bot is not ready for swarm simulation yet.' }, { status: 400 });
    }

    return Response.json({ success: true, ...swarmResult });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});