import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const SLACK_CONNECTOR_ID = '69db73abc7ef44b228d18b2b';
const NOTION_CONNECTOR_ID = '69db736f69df0c20be35bfae';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { squadId, squadName, goal, finalOutput, deliveryTargets } = await req.json();
    const results = [];

    for (const target of deliveryTargets || []) {
      if (target === 'slack') {
        const accessToken = await base44.asServiceRole.connectors.getCurrentAppUserAccessToken(SLACK_CONNECTOR_ID);
        const channelsRes = await fetch('https://slack.com/api/conversations.list?limit=1', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const channelsData = await channelsRes.json();
        const channelId = channelsData.channels?.[0]?.id;
        if (channelId) {
          await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              channel: channelId,
              text: `Squad: ${squadName}\nGoal: ${goal}\n\n${finalOutput}`
            })
          });
          await base44.entities.SquadDeliveryLog.create({
            squad_id: squadId,
            squad_name: squadName,
            goal,
            target: 'slack',
            status: 'sent',
            message: 'Delivered to Slack',
            delivered_at: new Date().toISOString()
          });
          results.push({ target: 'slack', status: 'sent' });
        }
      }

      if (target === 'notion') {
        const accessToken = await base44.asServiceRole.connectors.getCurrentAppUserAccessToken(NOTION_CONNECTOR_ID);
        await fetch('https://api.notion.com/v1/pages', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
          },
          body: JSON.stringify({
            parent: { type: 'workspace', workspace: true },
            properties: {
              title: {
                title: [{ type: 'text', text: { content: `${squadName} delivery` } }]
              }
            },
            children: [{
              object: 'block',
              type: 'paragraph',
              paragraph: { rich_text: [{ type: 'text', text: { content: `Goal: ${goal}\n\n${finalOutput}` } }] }
            }]
          })
        });
        await base44.entities.SquadDeliveryLog.create({
          squad_id: squadId,
          squad_name: squadName,
          goal,
          target: 'notion',
          status: 'sent',
          message: 'Delivered to Notion',
          delivered_at: new Date().toISOString()
        });
        results.push({ target: 'notion', status: 'sent' });
      }
    }

    return Response.json({ results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});