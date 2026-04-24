import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Google Sheets → ERU sync (StudyModule or Resource)
// Uses the app user's own Google connection ("sheets" connector).
const CONNECTOR_ID = '69d3600598df7cb56812ae75';

const extractSpreadsheetId = (input) => {
  if (!input) return null;
  const match = String(input).match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  // Allow raw IDs too
  if (/^[a-zA-Z0-9-_]{20,}$/.test(input)) return input;
  return null;
};

const normalizeHeader = (h) => String(h || '').trim().toLowerCase().replace(/\s+/g, '_');

const rowsToObjects = (values) => {
  if (!Array.isArray(values) || values.length < 2) return [];
  const headers = values[0].map(normalizeHeader);
  return values.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = (row[i] ?? '').toString().trim();
    });
    return obj;
  }).filter((obj) => Object.values(obj).some((v) => v));
};

const asArray = (value) => {
  if (!value) return [];
  return String(value).split(/[,;]/).map((s) => s.trim()).filter(Boolean);
};

const asNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const mapStudyModule = (row) => ({
  title: row.title,
  chapter_number: asNumber(row.chapter_number ?? row.chapter) ?? 1,
  description: row.description || '',
  category: row.category || 'foundations',
  difficulty: row.difficulty || 'beginner',
  content_narrative: row.content_narrative || row.content || '',
  key_concepts: asArray(row.key_concepts || row.concepts),
  tools_used: asArray(row.tools_used || row.tools),
  estimated_time_minutes: asNumber(row.estimated_time_minutes || row.time),
});

const mapResource = (row) => ({
  title: row.title,
  type: row.type || 'reference',
  description: row.description || '',
  url: row.url || '',
  content: row.content || '',
  tags: asArray(row.tags),
  platform: row.platform || undefined,
});

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { spreadsheet, range = 'Sheet1', target = 'study_module', dryRun = false } = await req.json();
    const spreadsheetId = extractSpreadsheetId(spreadsheet);
    if (!spreadsheetId) return Response.json({ error: 'Invalid spreadsheet URL or ID' }, { status: 400 });
    if (!['study_module', 'resource'].includes(target)) {
      return Response.json({ error: 'target must be study_module or resource' }, { status: 400 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection(CONNECTOR_ID);
    if (!accessToken) return Response.json({ error: 'Google Sheets not connected' }, { status: 403 });

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
    const sheetRes = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!sheetRes.ok) {
      const errText = await sheetRes.text();
      return Response.json({ error: 'Google Sheets fetch failed', detail: errText }, { status: sheetRes.status });
    }
    const sheetData = await sheetRes.json();
    const objects = rowsToObjects(sheetData.values || []);

    if (objects.length === 0) {
      return Response.json({ imported: 0, preview: [], message: 'No data rows found' });
    }

    const mapped = objects
      .map((row) => (target === 'study_module' ? mapStudyModule(row) : mapResource(row)))
      .filter((r) => r.title);

    if (dryRun) {
      return Response.json({ imported: 0, preview: mapped.slice(0, 10), total: mapped.length, dryRun: true });
    }

    let imported = 0;
    if (target === 'study_module') {
      const created = await base44.entities.StudyModule.bulkCreate(mapped);
      imported = Array.isArray(created) ? created.length : mapped.length;
    } else {
      const created = await base44.entities.Resource.bulkCreate(mapped);
      imported = Array.isArray(created) ? created.length : mapped.length;
    }

    return Response.json({ imported, total: mapped.length, preview: mapped.slice(0, 5) });
  } catch (error) {
    return Response.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
});