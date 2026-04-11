import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's feature analytics
    const analytics = await base44.entities.FeatureAnalytics.filter({
      created_by: user.email
    }, '-interaction_count', 50);

    if (!analytics || analytics.length === 0) {
      return Response.json({
        recommendations: [
          {
            title: 'Explore More Features',
            description: 'Start using different features to get personalized recommendations based on your usage patterns.',
            action: 'Explore Dashboard'
          }
        ]
      });
    }

    // Build usage summary
    const summary = analytics.slice(0, 10).map(a => 
      `${a.feature_name}: ${a.interaction_count} interactions, ${a.time_spent_seconds} seconds`
    ).join('\n');

    const topFeatures = analytics.slice(0, 5).map(a => a.feature_name).join(', ');

    // Generate recommendations via LLM
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze this user's feature usage and provide 3 concise, actionable workflow optimization recommendations:

Usage Summary:
${summary}

Top Features: ${topFeatures}

Return a JSON array with exactly 3 objects, each with: title (string), description (string, max 50 words), action (string).
Focus on productivity gains, feature discovery, and workflow efficiency.`,
      response_json_schema: {
        type: 'object',
        properties: {
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                action: { type: 'string' }
              },
              required: ['title', 'description', 'action']
            }
          }
        },
        required: ['recommendations']
      }
    });

    return Response.json(response);
  } catch (error) {
    const status = error?.status === 429 ? 200 : 500;

    if (error?.status === 429) {
      return Response.json({
        recommendations: [
          {
            title: 'Try Again Shortly',
            description: 'Recommendations are temporarily busy, so please refresh again in a moment.',
            action: 'Refresh Later'
          }
        ]
      }, { status });
    }

    return Response.json({ error: error?.message || 'Unexpected error' }, { status });
  }
});