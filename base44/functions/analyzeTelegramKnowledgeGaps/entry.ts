import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Offline by default: this function reaches outside services, so it only runs
// when the owner turns its group on in the ONLINE_FEATURES secret
// (comma-separated, e.g. "cloud_ai,email", or "all"). Empty or unset = offline.
function isOnline(group: string): boolean {
  const on = (Deno.env.get('ONLINE_FEATURES') || '').split(',').map((g) => g.trim().toLowerCase());
  return on.includes('all') || on.includes(group);
}
function offlineResponse(...groups: string[]): Response | null {
  const off = groups.find((g) => !isOnline(g));
  if (!off) return null;
  return Response.json(
    { ok: false, error: 'offline_mode', group: off, message: `Offline mode: "${off}" is turned off. The owner can add it to the ONLINE_FEATURES secret.` },
    { status: 403 },
  );
}

const LOW_CONFIDENCE_PATTERNS = [
  'i do not know',
  "i don't know",
  'not sure',
  'cannot find',
  "can't find",
  'contact human support',
  'do not have enough information',
  'not enough information',
  'say so honestly'
];

Deno.serve(async (req) => {
  const offlineBlock = offlineResponse('cloud_ai');
  if (offlineBlock) return offlineBlock;

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const logs = await base44.asServiceRole.entities.TelegramBotLog.list('-created_date', 150);
    const existing = await base44.asServiceRole.entities.TelegramKnowledgeGap.list('-created_date', 300);
    const existingLogIds = new Set((existing || []).map((item) => item.log_id).filter(Boolean));

    const candidates = (logs || []).filter((log) => {
      if (log.event_type !== 'ai_response') return false;
      if (existingLogIds.has(log.id)) return false;
      const text = `${log.message || ''} ${(log.metadata?.output || '')}`.toLowerCase();
      return LOW_CONFIDENCE_PATTERNS.some((pattern) => text.includes(pattern));
    }).slice(0, 20);

    const created = [];
    for (const log of candidates) {
      const meta = log.metadata || {};
      const userQuestion = String(meta.input || '').slice(0, 500);
      const botReply = String(meta.output || '').slice(0, 700);
      const llm = await base44.integrations.Core.InvokeLLM({
        prompt: `You analyze weak bot answers and propose missing knowledge base coverage.\n\nUser question: ${userQuestion}\nBot reply: ${botReply}\n\nReturn JSON with:\n- title\n- suggested_topic\n- suggested_keywords (3 to 8 short strings)\n- confidence_score (0 to 100)`,
        response_json_schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            suggested_topic: { type: 'string' },
            suggested_keywords: { type: 'array', items: { type: 'string' } },
            confidence_score: { type: 'number' }
          },
          required: ['title', 'suggested_topic', 'suggested_keywords', 'confidence_score']
        }
      });

      const gap = await base44.asServiceRole.entities.TelegramKnowledgeGap.create({
        bot_id: log.bot_id,
        log_id: log.id,
        gap_type: 'low_confidence',
        title: llm.title,
        user_question: userQuestion,
        bot_reply: botReply,
        suggested_topic: llm.suggested_topic,
        suggested_keywords: (llm.suggested_keywords || []).slice(0, 8),
        confidence_score: Number(llm.confidence_score || 0),
        status: 'open',
        detected_at: new Date().toISOString()
      });
      created.push(gap);

      await base44.asServiceRole.entities.AppNotification.create({
        user_email: log.created_by,
        type: 'task_assigned',
        title: 'Telegram knowledge gap detected',
        message: llm.title,
        metadata: {
          gap_id: gap.id,
          bot_id: log.bot_id,
          suggested_topic: llm.suggested_topic,
          suggested_keywords: (llm.suggested_keywords || []).slice(0, 8)
        }
      });
    }

    return Response.json({ success: true, created_count: created.length, gaps: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});