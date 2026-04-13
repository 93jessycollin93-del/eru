import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function average(items, key) {
  if (!items.length) return 0;
  return items.reduce((sum, item) => sum + Number(item?.[key] || 0), 0) / items.length;
}

function buildRunSummary(runs) {
  return runs.map((run, index) => ({
    index: index + 1,
    title: run.test_title,
    input: String(run.input || '').slice(0, 300),
    expected_output: String(run.expected_output || '').slice(0, 300),
    actual_output: String(run.actual_output || '').slice(0, 400),
    similarity_score: Number(run.similarity_score || 0),
    passed: !!run.passed,
    regression_flag: !!run.regression_flag,
    regression_reason: run.regression_reason || ''
  }));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const targetBotId = payload?.bot_id;

    const bots = targetBotId
      ? await base44.entities.UserBot.filter({ id: targetBotId }, '-updated_date', 1)
      : await base44.entities.UserBot.list('-updated_date', 100);

    const allImprovements = await base44.entities.BotImprovement.list('-created_date', 300);
    const allRatings = await base44.entities.BotRating.list('-created_date', 300);
    const allRuns = await base44.entities.BotTestRun.list('-created_date', 500);

    const updatedBots = [];

    for (const bot of bots) {
      const botRuns = allRuns.filter((item) => item.bot_id === bot.id).slice(0, 12);
      if (botRuns.length < 3) continue;

      const passedRuns = botRuns.filter((item) => item.passed);
      const failedRuns = botRuns.filter((item) => !item.passed);
      const ratings = allRatings.filter((item) => item.bot_id === bot.id);
      const improvements = allImprovements.filter((item) => item.bot_id === bot.id).slice(0, 20);

      const performanceSnapshot = {
        avg_similarity: Number(average(botRuns, 'similarity_score').toFixed(2)),
        pass_rate: Math.round((passedRuns.length / Math.max(1, botRuns.length)) * 100),
        regression_count: botRuns.filter((item) => item.regression_flag).length,
        avg_user_rating: Number(average(ratings, 'rating').toFixed(1)),
        recent_improvement_score: Number(average(improvements, 'score').toFixed(1)),
        usage_count: bot.usage_count || 0,
        connected_bot_count: (bot.connected_bot_ids || []).length,
      };

      const insight = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an adaptive AI operations analyst.

Analyze this bot's past performance and produce a compact strategy update that improves future task execution, delegation, and resource allocation without changing the bot's core identity.

Bot:
${JSON.stringify({
          id: bot.id,
          name: bot.name,
          role: bot.role,
          description: bot.description,
          personality: bot.personality,
          response_style: bot.response_style,
          instructions: String(bot.instructions || '').slice(-4000),
          connected_bot_ids: bot.connected_bot_ids || []
        }, null, 2)}

Performance snapshot:
${JSON.stringify(performanceSnapshot, null, 2)}

Successful runs:
${JSON.stringify(buildRunSummary(passedRuns.slice(0, 6)), null, 2)}

Failed runs:
${JSON.stringify(buildRunSummary(failedRuns.slice(0, 6)), null, 2)}

Improvement notes:
${JSON.stringify(improvements.map((item) => ({
          goal: item.goal,
          analysis: item.analysis,
          improvement: item.improvement,
          score: item.score
        })), null, 2)}

Return:
- strategy_block: short instruction block to append to the bot
- resource_allocation: 3-5 concrete rules for when to work solo vs delegate, and how much effort/detail to spend
- strengths: key winning patterns
- weaknesses: repeat failure patterns
- recommendations: highest-priority next adjustments
- confidence_score: 0-100`,
        response_json_schema: {
          type: 'object',
          properties: {
            strategy_block: { type: 'string' },
            resource_allocation: { type: 'array', items: { type: 'string' } },
            strengths: { type: 'array', items: { type: 'string' } },
            weaknesses: { type: 'array', items: { type: 'string' } },
            recommendations: { type: 'array', items: { type: 'string' } },
            confidence_score: { type: 'number' }
          },
          required: ['strategy_block', 'resource_allocation', 'strengths', 'weaknesses', 'recommendations', 'confidence_score']
        }
      });

      const adaptiveBlock = [
        'ADAPTIVE PERFORMANCE LEARNING',
        `Pass rate: ${performanceSnapshot.pass_rate}%`,
        `Average similarity: ${performanceSnapshot.avg_similarity}`,
        `Confidence score: ${Math.round(Number(insight.confidence_score || 0))}`,
        'Strengths:',
        ...(insight.strengths || []).map((item) => `- ${item}`),
        'Weaknesses:',
        ...(insight.weaknesses || []).map((item) => `- ${item}`),
        'Resource allocation rules:',
        ...(insight.resource_allocation || []).map((item) => `- ${item}`),
        'Adaptive strategy:',
        insight.strategy_block,
      ].join('\n');

      const strippedInstructions = String(bot.instructions || '')
        .replace(/\n\nADAPTIVE PERFORMANCE LEARNING[\s\S]*$/m, '')
        .trim();

      const nextInstructions = `${strippedInstructions}\n\n${adaptiveBlock}`.slice(-12000);

      await base44.entities.UserBot.update(bot.id, {
        instructions: nextInstructions,
      });

      await base44.entities.BotImprovement.create({
        goal: `Adaptive learning update for ${bot.name}`,
        plan: 'Performance-driven strategy refinement',
        execution: (insight.resource_allocation || []).join(' | ').slice(0, 900),
        analysis: `Strengths: ${(insight.strengths || []).join('; ')} | Weaknesses: ${(insight.weaknesses || []).join('; ')}`.slice(0, 900),
        improvement: (insight.recommendations || []).join(' | ').slice(0, 900),
        score: Math.max(1, Math.min(10, Math.round((performanceSnapshot.pass_rate / 10 + Number(insight.confidence_score || 0) / 20) / 2))),
        bot_id: bot.id,
        user_email: user.email,
      });

      updatedBots.push({
        bot_id: bot.id,
        bot_name: bot.name,
        pass_rate: performanceSnapshot.pass_rate,
        confidence_score: Math.round(Number(insight.confidence_score || 0)),
        recommendations: insight.recommendations || []
      });
    }

    return Response.json({ success: true, updated_bots: updatedBots, count: updatedBots.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});