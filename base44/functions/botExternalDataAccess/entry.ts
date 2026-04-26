import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const APP_USER_CONNECTOR_IDS = {
  googlesheets: '69d3600598df7cb56812ae75',
  airtable: '69d36163467d4a87fc6fd322',
  salesforce: '69d361fcaf4b1c7e12df9999',
};

async function getConnection(base44, source) {
  if (source.mode === 'shared') {
    return base44.asServiceRole.connectors.getConnection(source.service);
  }
  const connectorId = APP_USER_CONNECTOR_IDS[source.service];
  if (!connectorId) {
    throw new Error(`No app-user connector configured for ${source.service}`);
  }
  return base44.asServiceRole.connectors.getCurrentAppUserConnection(connectorId);
}

async function handleGoogleSheets(source, accessToken, action, payload) {
  const spreadsheetId = source.resource_id;
  const sheetName = source.sheet_name || 'Sheet1';
  if (!spreadsheetId) throw new Error('Spreadsheet ID is required.');

  if (action === 'read') {
    const range = payload?.range || `${sheetName}!A:Z`;
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await response.json();
    return { service: 'googlesheets', action, data: data.values || [] };
  }

  if (action === 'write') {
    const range = payload?.range || `${sheetName}!A1`;
    const values = Array.isArray(payload?.values) ? payload.values : [];
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values })
    });
    const data = await response.json();
    return { service: 'googlesheets', action, data };
  }

  throw new Error('Unsupported action for Google Sheets');
}

async function handleAirtable(source, accessToken, action, payload) {
  const resourceId = source.resource_id || '';
  const [baseId, tableId] = resourceId.split('/');
  if (!baseId || !tableId) throw new Error('Airtable resource ID must be in the format baseId/tableId.');

  if (action === 'read') {
    const response = await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}?maxRecords=${payload?.maxRecords || 20}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await response.json();
    return { service: 'airtable', action, data: data.records || [] };
  }

  if (action === 'write') {
    const records = Array.isArray(payload?.records) ? payload.records : [];
    const response = await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ records })
    });
    const data = await response.json();
    return { service: 'airtable', action, data };
  }

  throw new Error('Unsupported action for Airtable');
}

async function handleSalesforce(source, accessToken, connectionConfig, action, payload) {
  const instanceUrl = connectionConfig?.instance_url || connectionConfig?.instanceUrl;
  const apiVersion = payload?.apiVersion || 'v61.0';
  const objectName = source.resource_id;
  if (!instanceUrl || !objectName) throw new Error('Salesforce instance URL and object API name are required.');

  if (action === 'read') {
    const fields = payload?.fields || 'Id,Name';
    const limit = payload?.limit || 10;
    const query = encodeURIComponent(`SELECT ${fields} FROM ${objectName} LIMIT ${limit}`);
    const response = await fetch(`${instanceUrl}/services/data/${apiVersion}/query?q=${query}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await response.json();
    return { service: 'salesforce', action, data: data.records || [] };
  }

  if (action === 'write') {
    const fields = payload?.fields || {};
    const response = await fetch(`${instanceUrl}/services/data/${apiVersion}/sobjects/${objectName}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(fields)
    });
    const data = await response.json();
    return { service: 'salesforce', action, data };
  }

  throw new Error('Unsupported action for Salesforce');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { botId, sourceIndex = 0, action = 'read', payload = {} } = body;
    if (!botId) {
      return Response.json({ error: 'botId is required' }, { status: 400 });
    }

    const bot = await base44.entities.UserBot.get(botId);
    if (!bot) {
      return Response.json({ error: 'Bot not found' }, { status: 404 });
    }
    if (bot.created_by !== user.email && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const source = (bot.data_sources || [])[sourceIndex];
    if (!source) {
      return Response.json({ error: 'Configured data source not found' }, { status: 404 });
    }

    const { accessToken, connectionConfig } = await getConnection(base44, source);

    if (source.service === 'googlesheets') {
      return Response.json(await handleGoogleSheets(source, accessToken, action, payload));
    }

    if (source.service === 'airtable') {
      return Response.json(await handleAirtable(source, accessToken, action, payload));
    }

    if (source.service === 'salesforce') {
      return Response.json(await handleSalesforce(source, accessToken, connectionConfig, action, payload));
    }

    return Response.json({ error: 'Unsupported service' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});