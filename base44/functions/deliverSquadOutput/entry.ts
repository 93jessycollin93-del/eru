import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SLACK_CONNECTOR_ID = '69db73abc7ef44b228d18b2b';
const NOTION_CONNECTOR_ID = '69db736f69df0c20be35bfae';

function extractChartPoints(text) {
  const lines = String(text || '').split('\n');
  const points = [];

  for (const line of lines) {
    const match = line.match(/([A-Za-z0-9][A-Za-z0-9\s\-_/]+?)\s*[:\-]\s*(\d+(?:\.\d+)?)/);
    if (match) {
      points.push({ label: match[1].trim(), value: Number(match[2]) });
    }
  }

  return points.slice(0, 8);
}

function buildSlackBlocks({ squadName, goal, summary, chartPoints }) {
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${squadName} run complete` }
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Goal*\n${goal}` },
        { type: 'mrkdwn', text: `*Summary*\n${summary}` }
      ]
    }
  ];

  if (chartPoints.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Chart data*\n${chartPoints.map((point) => `• ${point.label}: ${point.value}`).join('\n')}`
      }
    });
  }

  return blocks;
}

function buildNotionChildren({ goal, summary, chartPoints }) {
  const children = [
    {
      object: 'block',
      type: 'heading_2',
      heading_2: { rich_text: [{ type: 'text', text: { content: 'Execution summary' } }] }
    },
    {
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: [{ type: 'text', text: { content: `Goal: ${goal}` } }] }
    },
    {
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: [{ type: 'text', text: { content: summary } }] }
    }
  ];

  if (chartPoints.length > 0) {
    children.push({
      object: 'block',
      type: 'heading_2',
      heading_2: { rich_text: [{ type: 'text', text: { content: 'Chart points' } }] }
    });

    chartPoints.forEach((point) => {
      children.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ type: 'text', text: { content: `${point.label}: ${point.value}` } }]
        }
      });
    });
  }

  return children;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { squadId, squadName, goal, finalOutput, deliveryTargets } = await req.json();
    const summary = String(finalOutput || '').slice(0, 1800);
    const chartPoints = extractChartPoints(finalOutput);
    const results = [];

    for (const target of deliveryTargets || []) {
      if (target === 'slack') {
        const { accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection(SLACK_CONNECTOR_ID);
        const channelsRes = await fetch('https://slack.com/api/conversations.list?limit=1', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const channelsData = await channelsRes.json();
        const channelId = channelsData.channels?.[0]?.id;

        if (!channelId) {
          await base44.asServiceRole.entities.SquadDeliveryLog.create({
            squad_id: squadId,
            squad_name: squadName,
            goal,
            target: 'slack',
            status: 'failed',
            message: 'No Slack channel available for delivery',
            delivered_at: new Date().toISOString()
          });
          results.push({ target: 'slack', status: 'failed' });
        } else {
          await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              channel: channelId,
              text: `${squadName} run complete`,
              blocks: buildSlackBlocks({ squadName, goal, summary, chartPoints })
            })
          });

          await base44.asServiceRole.entities.SquadDeliveryLog.create({
            squad_id: squadId,
            squad_name: squadName,
            goal,
            target: 'slack',
            status: 'sent',
            message: 'Execution summary synced to Slack',
            delivered_at: new Date().toISOString()
          });
          results.push({ target: 'slack', status: 'sent' });
        }
      }

      if (target === 'notion') {
        const { accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection(NOTION_CONNECTOR_ID);
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
                title: [{ type: 'text', text: { content: `${squadName} run` } }]
              }
            },
            children: buildNotionChildren({ goal, summary, chartPoints })
          })
        });

        await base44.asServiceRole.entities.SquadDeliveryLog.create({
          squad_id: squadId,
          squad_name: squadName,
          goal,
          target: 'notion',
          status: 'sent',
          message: 'Execution summary synced to Notion',
          delivered_at: new Date().toISOString()
        });
        results.push({ target: 'notion', status: 'sent' });
      }
    }

    return Response.json({ results, chart_points: chartPoints });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});