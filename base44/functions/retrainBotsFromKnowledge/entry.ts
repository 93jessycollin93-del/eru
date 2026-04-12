import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function uniqueByGoal(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.goal}|${item.source_squad_name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const knowledge = await base44.entities.SquadKnowledge.list('-updated_date', 200);
    const bots = await base44.entities.UserBot.list('-updated_date', 200);
    const profiles = await base44.entities.BotMemoryProfile.list('-updated_date', 500);
    const now = new Date().toISOString();

    const updatedBots = [];

    for (const bot of bots) {
      const relatedKnowledge = uniqueByGoal(
        knowledge.filter((item) => (item.bot_ids || []).includes(bot.id)).slice(0, 12)
      );

      if (relatedKnowledge.length === 0) continue;

      const historicalStrategies = relatedKnowledge.map((item) => ({
        goal: item.goal,
        keywords: item.keywords || [],
        strategy_summary: item.result_summary,
        source_squad_name: item.source_squad_name,
        captured_at: item.updated_date || item.created_date || now,
      }));

      const identitySummary = `${bot.name} is a ${bot.role} bot with a ${bot.response_style || 'detailed'} response style.`;
      const presentStateSummary = [
        bot.description ? `Current purpose: ${bot.description}` : null,
        bot.personality ? `Current personality: ${bot.personality}` : null,
        `Current level: ${bot.level || 1}`,
        `Current XP: ${bot.xp || 0}`,
      ].filter(Boolean).join(' ');

      const memoryPromptBlock = [
        'MEMORY AWARENESS BLOCK',
        `Past identity: ${identitySummary}`,
        `Present state: ${presentStateSummary}`,
        'Historical winning strategies:',
        ...historicalStrategies.map((item, index) => `${index + 1}. Goal: ${item.goal} | Squad: ${item.source_squad_name} | Keywords: ${(item.keywords || []).join(', ')} | Strategy: ${item.strategy_summary}`),
        'When relevant, reuse these successful patterns so the bot stays aware of its past and present self.',
      ].join('\n');

      const nextInstructions = `${bot.instructions || ''}\n\n${memoryPromptBlock}`.slice(-12000);
      await base44.entities.UserBot.update(bot.id, {
        instructions: nextInstructions,
      });

      const existingProfile = profiles.find((profile) => profile.bot_id === bot.id);
      const profilePayload = {
        bot_id: bot.id,
        bot_name: bot.name,
        identity_summary: identitySummary,
        historical_strategies: historicalStrategies,
        present_state_summary: presentStateSummary,
        memory_prompt_block: memoryPromptBlock,
        last_retrained_at: now,
      };

      if (existingProfile?.id) {
        await base44.entities.BotMemoryProfile.update(existingProfile.id, profilePayload);
      } else {
        await base44.entities.BotMemoryProfile.create(profilePayload);
      }

      updatedBots.push(bot.name);
    }

    return Response.json({ success: true, updated_bots: updatedBots, count: updatedBots.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});