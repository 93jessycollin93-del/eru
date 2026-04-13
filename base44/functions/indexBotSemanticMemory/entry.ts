/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function extractKeywords(text) {
  return Array.from(new Set(String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s/-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3)))
    .slice(0, 18);
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value || 0)));
}

function buildSearchText(parts) {
  return parts.filter(Boolean).join(' \n ').slice(0, 4000);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [outputs, maintenanceLogs, chunks, squadKnowledge, existing] = await Promise.all([
      base44.entities.BotFarmOutputLog.list('-updated_date', 150),
      base44.entities.BotFarmMaintenanceLog.list('-updated_date', 150),
      base44.entities.BotMemoryChunk.list('-updated_date', 150),
      base44.entities.SquadKnowledge.list('-updated_date', 150),
      base44.entities.BotSemanticMemory.list('-updated_date', 500),
    ]);

    const existingMap = new Map(existing.map((item) => [`${item.source_type}:${item.source_id}`, item]));
    const upserts = [];

    for (const item of outputs || []) {
      const successScore = clamp(((item.value_score || 0) * 0.45) + ((item.quality_score || 0) * 0.45) + ((item.assignment_quality || 0) * 0.1));
      const searchText = buildSearchText([item.output_type, item.summary, `quality ${item.quality_score || 0}`, `value ${item.value_score || 0}`]);
      upserts.push({
        key: `bot_farm_output:${item.id}`,
        payload: {
          source_type: 'bot_farm_output',
          source_id: item.id,
          bot_id: item.bot_id,
          squad_id: item.squad_id,
          mission_id: item.mission_id,
          title: `${String(item.output_type || 'output').replaceAll('_', ' ')} outcome`,
          summary: item.summary || 'Bot Farm output',
          search_text: searchText,
          keywords: extractKeywords(searchText),
          memory_category: 'mission_outcome',
          success_score: successScore,
          quality_score: clamp(item.quality_score || 0),
          retrieval_score: successScore,
          metadata: {
            value_score: item.value_score || 0,
            assignment_quality: item.assignment_quality || 0,
            specialization_fit: item.specialization_fit || 0
          }
        }
      });
    }

    for (const item of maintenanceLogs || []) {
      const quality = clamp((item.recovery_gain || 0) * 3.5);
      const searchText = buildSearchText([item.maintenance_type, item.impact, `recovery ${item.recovery_gain || 0}`]);
      upserts.push({
        key: `bot_farm_maintenance:${item.id}`,
        payload: {
          source_type: 'bot_farm_maintenance',
          source_id: item.id,
          bot_id: item.bot_id,
          title: `${String(item.maintenance_type || 'maintenance').replaceAll('_', ' ')} pattern`,
          summary: item.impact || 'Bot maintenance log',
          search_text: searchText,
          keywords: extractKeywords(searchText),
          memory_category: 'maintenance_pattern',
          success_score: quality,
          quality_score: quality,
          retrieval_score: quality,
          metadata: {
            status: item.status,
            recovery_gain: item.recovery_gain || 0
          }
        }
      });
    }

    for (const item of chunks || []) {
      const quality = clamp(((item.quality_score || 0) * 0.6) + ((item.retrieval_score || 0) * 0.4));
      const searchText = buildSearchText([item.summary, ...(item.keywords || [])]);
      upserts.push({
        key: `bot_memory_chunk:${item.id}`,
        payload: {
          source_type: 'bot_memory_chunk',
          source_id: item.id,
          bot_id: item.bot_id,
          title: `${String(item.memory_category || 'memory').replaceAll('_', ' ')} memory chunk`,
          summary: item.summary || 'Archived bot memory',
          search_text: searchText,
          keywords: extractKeywords(searchText),
          memory_category: item.memory_category === 'strategy' ? 'strategy' : 'conversation',
          success_score: quality,
          quality_score: clamp(item.quality_score || 0),
          retrieval_score: clamp(item.retrieval_score || 0),
          usage_count: item.access_count || 0,
          last_retrieved_at: item.last_accessed_at,
          metadata: {
            storage_tier: item.storage_tier,
            message_count: item.message_count || 0
          }
        }
      });
    }

    for (const item of squadKnowledge || []) {
      const text = buildSearchText([item.goal, item.result_summary, item.final_output, ...(item.keywords || [])]);
      const quality = clamp(78 + Math.min(18, (item.bot_ids || []).length * 2));
      upserts.push({
        key: `squad_knowledge:${item.id}`,
        payload: {
          source_type: 'squad_knowledge',
          source_id: item.id,
          bot_id: (item.bot_ids || [])[0],
          squad_id: item.source_squad_id,
          title: item.goal || 'Squad knowledge',
          summary: item.result_summary || 'Successful squad outcome',
          search_text: text,
          keywords: extractKeywords(text),
          memory_category: 'knowledge',
          success_score: quality,
          quality_score: quality,
          retrieval_score: quality,
          metadata: {
            source_squad_name: item.source_squad_name,
            bot_ids: item.bot_ids || []
          }
        }
      });
    }

    const results = [];
    for (const item of upserts) {
      const existingRow = existingMap.get(item.key);
      if (existingRow?.id) {
        await base44.entities.BotSemanticMemory.update(existingRow.id, item.payload);
        results.push({ action: 'updated', key: item.key });
      } else {
        await base44.entities.BotSemanticMemory.create(item.payload);
        results.push({ action: 'created', key: item.key });
      }
    }

    return Response.json({ success: true, indexed: results.length, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});