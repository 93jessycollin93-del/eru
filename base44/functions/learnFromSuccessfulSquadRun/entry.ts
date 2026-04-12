import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function extractKeywords(text) {
  return Array.from(new Set(String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 4)))
    .slice(0, 12);
}

function uniqueKnowledge(items) {
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

    const payload = await req.json();
    const squad = payload?.data;
    const changedFields = payload?.changed_fields || [];

    if (!squad?.id || !Array.isArray(squad.execution_history) || squad.execution_history.length === 0) {
      return Response.json({ skipped: true, reason: 'Missing squad execution history' });
    }

    if (!changedFields.includes('execution_history')) {
      return Response.json({ skipped: true, reason: 'Execution history not updated' });
    }

    const latestRun = squad.execution_history[0];
    if (!latestRun?.goal || !latestRun?.created_at) {
      return Response.json({ skipped: true, reason: 'Latest run is incomplete' });
    }

    if (Number(latestRun.success_rate || 0) < 80 || Number(latestRun.estimated_roi || 0) < 80) {
      return Response.json({ skipped: true, reason: 'Run did not meet learning threshold' });
    }

    const existingKnowledge = await base44.entities.SquadKnowledge.filter({
      source_squad_id: squad.id,
      goal: latestRun.goal,
    }, '-created_date', 20);

    const duplicateKnowledge = existingKnowledge.some((item) => String(item.created_date || '').slice(0, 19) === String(latestRun.created_at || '').slice(0, 19));
    if (!duplicateKnowledge) {
      const keywords = extractKeywords(`${latestRun.goal} ${latestRun.final_output || ''} ${squad.description || ''}`);
      await base44.entities.SquadKnowledge.create({
        source_squad_id: squad.id,
        source_squad_name: squad.name,
        goal: latestRun.goal,
        keywords,
        ai_keywords: keywords,
        category: 'general',
        bot_ids: latestRun.successful_bot_ids || [],
        result_summary: String(latestRun.final_output || '').slice(0, 500),
        final_output: latestRun.final_output || '',
      });
    }

    const bots = await base44.entities.UserBot.list('-updated_date', 200);
    const profiles = await base44.entities.BotMemoryProfile.list('-updated_date', 500);
    const relatedBotIds = Array.from(new Set(latestRun.successful_bot_ids || [])).filter(Boolean);
    const now = new Date().toISOString();
    const updatedBots = [];

    for (const botId of relatedBotIds) {
      const bot = bots.find((item) => item.id === botId);
      if (!bot) continue;

      const relatedKnowledge = uniqueKnowledge(
        (await base44.entities.SquadKnowledge.filter({}, '-updated_date', 200))
          .filter((item) => (item.bot_ids || []).includes(bot.id))
          .slice(0, 12)
      );

      const learningBlock = [
        'SQUAD LEARNING LOOP',
        `Recent successful squad goal: ${latestRun.goal}`,
        `Winning pattern summary: ${String(latestRun.final_output || '').slice(0, 700)}`,
        `Current squad success rate: ${latestRun.success_rate || 0}%`,
        `Current squad ROI: ${latestRun.estimated_roi || 0}`,
        'Reusable successful patterns:',
        ...relatedKnowledge.slice(0, 6).map((item, index) => `${index + 1}. Goal: ${item.goal} | Strategy: ${item.result_summary}`),
        'When the new task is similar, prioritize these successful patterns while keeping the response concise and role-appropriate.',
      ].join('\n');

      const instructionWithoutOldLoop = String(bot.instructions || '')
        .replace(/\n\nSQUAD LEARNING LOOP[\s\S]*$/m, '')
        .trim();
      const nextInstructions = `${instructionWithoutOldLoop}\n\n${learningBlock}`.slice(-12000);

      await base44.entities.UserBot.update(bot.id, {
        instructions: nextInstructions,
      });

      const existingProfile = profiles.find((profile) => profile.bot_id === bot.id);
      const profilePayload = {
        bot_id: bot.id,
        bot_name: bot.name,
        identity_summary: `${bot.name} is a ${bot.role} bot with a ${bot.response_style || 'detailed'} response style.`,
        historical_strategies: relatedKnowledge.slice(0, 12).map((item) => ({
          goal: item.goal,
          keywords: item.keywords || [],
          strategy_summary: item.result_summary,
          source_squad_name: item.source_squad_name,
          captured_at: item.updated_date || item.created_date || now,
        })),
        present_state_summary: `Current level: ${bot.level || 1}. Current XP: ${bot.xp || 0}. Updated from successful squad learning loop.`,
        memory_prompt_block: learningBlock,
        last_retrained_at: now,
      };

      if (existingProfile?.id) {
        await base44.entities.BotMemoryProfile.update(existingProfile.id, profilePayload);
      } else {
        await base44.entities.BotMemoryProfile.create(profilePayload);
      }

      await base44.asServiceRole.entities.PerformanceMetric.create({
        service: 'squad_learning_loop',
        endpoint: 'learnFromSuccessfulSquadRun',
        latency_ms: Math.max(1, Number(latestRun.pipeline_steps_completed || 1) * 120),
        status_code: 200,
        success: true,
        timestamp: now,
        user_email: user.email,
      });

      await base44.entities.BotImprovement.create({
        goal: latestRun.goal,
        plan: squad.name,
        execution: `Successful squad learning loop applied to ${bot.name}`,
        analysis: `Success rate ${latestRun.success_rate || 0}% · ROI ${latestRun.estimated_roi || 0}`,
        improvement: `Instructions refreshed from successful squad output for ${bot.name}.`,
        score: Math.round(Number(latestRun.success_rate || 0) / 10),
        bot_id: bot.id,
        user_email: user.email,
      });

      updatedBots.push(bot.name);
    }

    return Response.json({ success: true, updated_bots: updatedBots, count: updatedBots.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});