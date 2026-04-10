import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Search Google Drive
async function searchGoogleDrive(accessToken, query) {
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name+contains+'${encodeURIComponent(query)}'&fields=files(id,name,mimeType,modifiedTime,webViewLink)&pageSize=5`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    return (data.files || []).map(f => ({
      id: f.id, title: f.name, subtitle: f.mimeType?.split('.').pop() || 'file',
      url: f.webViewLink, source: 'Google Drive', icon: '📁', type: 'file',
      meta: f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString() : ''
    }));
  } catch { return []; }
}

// Search Dropbox
async function searchDropbox(accessToken, query) {
  try {
    const res = await fetch('https://api.dropboxapi.com/2/files/search_v2', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, options: { max_results: 5 } })
    });
    const data = await res.json();
    return (data.matches || []).map(m => ({
      id: m.metadata?.metadata?.id || m.metadata?.metadata?.path_lower,
      title: m.metadata?.metadata?.name,
      subtitle: m.metadata?.metadata?.['.tag'] || 'file',
      url: `https://www.dropbox.com/home${m.metadata?.metadata?.path_lower}`,
      source: 'Dropbox', icon: '📦', type: 'file',
      meta: ''
    })).filter(r => r.title);
  } catch { return []; }
}

// Search OneDrive
async function searchOneDrive(accessToken, query) {
  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${encodeURIComponent(query)}')?$top=5&$select=id,name,file,lastModifiedDateTime,webUrl`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    return (data.value || []).map(f => ({
      id: f.id, title: f.name, subtitle: 'OneDrive file',
      url: f.webUrl, source: 'OneDrive', icon: '☁️', type: 'file',
      meta: f.lastModifiedDateTime ? new Date(f.lastModifiedDateTime).toLocaleDateString() : ''
    }));
  } catch { return []; }
}

// Search ClickUp tasks
async function searchClickUp(accessToken, query) {
  try {
    const res = await fetch(
      `https://api.clickup.com/api/v2/team`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const teamsData = await res.json();
    const teamId = teamsData.teams?.[0]?.id;
    if (!teamId) return [];
    const searchRes = await fetch(
      `https://api.clickup.com/api/v2/team/${teamId}/task?query=${encodeURIComponent(query)}&page=0`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await searchRes.json();
    return (data.tasks || []).slice(0, 5).map(t => ({
      id: t.id, title: t.name, subtitle: t.status?.status || 'task',
      url: t.url, source: 'ClickUp', icon: '✅', type: 'task',
      meta: t.assignees?.[0]?.username || ''
    }));
  } catch { return []; }
}

// Search Linear issues
async function searchLinear(accessToken, query) {
  try {
    const res = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ issueSearch(query: "${query.replace(/"/g, '')}", first: 5) { nodes { id title state { name } url assignee { name } } } }`
      })
    });
    const data = await res.json();
    return (data.data?.issueSearch?.nodes || []).map(i => ({
      id: i.id, title: i.title, subtitle: i.state?.name || 'issue',
      url: i.url, source: 'Linear', icon: '🔷', type: 'task',
      meta: i.assignee?.name || ''
    }));
  } catch { return []; }
}

// Search Wrike tasks
async function searchWrike(accessToken, query) {
  try {
    const res = await fetch(
      `https://www.wrike.com/api/v4/tasks?title=${encodeURIComponent(query)}&limit=5`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    return (data.data || []).map(t => ({
      id: t.id, title: t.title, subtitle: t.status || 'task',
      url: `https://www.wrike.com/open.htm?id=${t.id}`, source: 'Wrike', icon: '📋', type: 'task',
      meta: ''
    }));
  } catch { return []; }
}

// Search Salesforce contacts
async function searchSalesforce(accessToken, connectionConfig, query) {
  try {
    const instanceUrl = connectionConfig?.instance_url || 'https://login.salesforce.com';
    const soql = `SELECT Id,Name,Email,Title,Account.Name FROM Contact WHERE Name LIKE '%${query.replace(/'/g, '')}%' LIMIT 5`;
    const res = await fetch(
      `${instanceUrl}/services/data/v58.0/query?q=${encodeURIComponent(soql)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    return (data.records || []).map(c => ({
      id: c.Id, title: c.Name, subtitle: c.Title || c['Account.Name'] || 'Contact',
      url: `${instanceUrl}/${c.Id}`, source: 'Salesforce', icon: '☁️', type: 'contact',
      meta: c.Email || ''
    }));
  } catch { return []; }
}

// Search LinkedIn (people search via basic profile)
async function searchLinkedIn(accessToken, query) {
  try {
    const res = await fetch(
      `https://api.linkedin.com/v2/search?q=people&keywords=${encodeURIComponent(query)}&count=5`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    return (data.elements || []).map(p => ({
      id: p.trackingUrn || p.entityUrn,
      title: `${p.firstName?.localized?.en_US || ''} ${p.lastName?.localized?.en_US || ''}`.trim(),
      subtitle: p.headline?.text || 'LinkedIn profile',
      url: `https://linkedin.com`, source: 'LinkedIn', icon: '💼', type: 'contact',
      meta: ''
    })).filter(r => r.title);
  } catch { return []; }
}

// Connector ID map (matches registered app user connectors)
const CONNECTOR_IDS = {
  googledrive: '69d35d7aad616ab7e397c201',
  dropbox: '69d3613f0c9b1936d7c54dae',
  one_drive: '69d35e56fd2f27e82f965085',
  clickup: '69d362fabcfa053049a60923',
  linear: '69d362566b996caef932d206',
  wrike: '69d362843e99c435a093b6cd',
  salesforce: '69d361fcaf4b1c7e12df9999',
  linkedin: '69d35e70d0690805cbf5f36e',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { query } = await req.json();
    if (!query || query.trim().length < 2) return Response.json({ results: [] });

    const searches = [];

    // Try each connector - skip gracefully if not connected
    const tryConnector = async (id, fn) => {
      try {
        const token = await base44.asServiceRole.connectors.getCurrentAppUserAccessToken(id);
        return await fn(token);
      } catch { return []; }
    };

    const tryConnectorWithConfig = async (id, fn) => {
      try {
        const token = await base44.asServiceRole.connectors.getCurrentAppUserAccessToken(id);
        return await fn(token, {});
      } catch { return []; }
    };

    const [drive, dropbox, onedrive, clickup, linear, wrike, salesforce, linkedin] = await Promise.all([
      tryConnector(CONNECTOR_IDS.googledrive, t => searchGoogleDrive(t, query)),
      tryConnector(CONNECTOR_IDS.dropbox, t => searchDropbox(t, query)),
      tryConnector(CONNECTOR_IDS.one_drive, t => searchOneDrive(t, query)),
      tryConnector(CONNECTOR_IDS.clickup, t => searchClickUp(t, query)),
      tryConnector(CONNECTOR_IDS.linear, t => searchLinear(t, query)),
      tryConnector(CONNECTOR_IDS.wrike, t => searchWrike(t, query)),
      tryConnectorWithConfig(CONNECTOR_IDS.salesforce, t => searchSalesforce(t, {}, query)),
      tryConnector(CONNECTOR_IDS.linkedin, t => searchLinkedIn(t, query)),
    ]);

    const results = [...drive, ...dropbox, ...onedrive, ...clickup, ...linear, ...wrike, ...salesforce, ...linkedin];

    return Response.json({ results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});