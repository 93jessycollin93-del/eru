import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function extractKeywords(text) {
  return Array.from(new Set(String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 4)))
    .slice(0, 12);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const run = payload?.data;

    if (!run?.bot_id || !run?.actual_output) {
      return Response.json({ skipped: true, reason: 'Missing bot test run data' });
    }

    if (!run.passed || Number(run.similarity_score || 0) < 0.9) {
      return Response.json({ skipped: true, reason: 'Run did not meet sync threshold' });
    }

    const keywords = extractKeywords(`${run.test_title || ''} ${run.input || ''} ${run.expected_output || ''} ${run.actual_output || ''}`);
    const resultSummary = String(run.actual_output || '').slice(0, 500);

    await base44.entities.SquadKnowledge.create({
      source_squad_id: `bot_training_${run.bot_id}`,
      source_squad_name: `${run.bot_name || 'Bot'} Training Memory`,
      goal: run.input || run.test_title || 'Golden training case',
      keywords,
      ai_keywords: keywords,
      category: 'general',
      bot_ids: [run.bot_id],
      result_summary: resultSummary,
      final_output: run.actual_output,
    });

    const botSquads = await base44.entities.BotSquad.list('-updated_date', 200);
    const relatedSquads = botSquads.filter((squad) => [
      squad.master_bot_id,
      squad.leader_bot_id,
      ...(squad.member_bot_ids || []),
      ...(squad.commander_bot_ids || []),
      ...(squad.security_bot_ids || []),
      ...((squad.task_groups || []).flatMap((group) => group.bot_ids || [])),
    ].includes(run.bot_id));

    const now = new Date().toISOString();
    for (const squad of relatedSquads) {
      const nextPool = [
        {
          goal: run.input || run.test_title || 'Golden training case',
          keywords,
          bot_ids: [run.bot_id],
          result_summary: resultSummary,
          created_at: now,
        },
        ...(squad.memory_pool || []).slice(0, 14),
      ];

      await base44.entities.BotSquad.update(squad.id, { memory_pool: nextPool });
    }

    return Response.json({ success: true, synced_squads: relatedSquads.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});