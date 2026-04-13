import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { bot, currentInstructions, candidateInstructions, goldens = [], results = [] } = payload || {};

    if (!bot?.name) {
      return Response.json({ error: 'Missing bot context' }, { status: 400 });
    }

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert AI training analyst helping improve a production bot safely.

Bot profile:\n${JSON.stringify({
        name: bot.name,
        role: bot.role,
        personality: bot.personality,
        response_style: bot.response_style,
        model_provider: bot.model_provider,
        model_name: bot.model_name,
      }, null, 2)}

Current instructions:\n${currentInstructions || ''}

Candidate instructions:\n${candidateInstructions || ''}

Golden tests:\n${JSON.stringify(goldens.map((item) => ({
        title: item.title,
        input: item.input,
        expected_output: item.expected_output,
        min_similarity_score: item.min_similarity_score,
      })), null, 2)}

Training results:\n${JSON.stringify(results, null, 2)}

Return:
1. 4-6 diverse new test cases that cover edge cases, adversarial prompts, ambiguity, and realistic user asks.
2. Recommended training parameters for this bot.
3. Deep performance analysis covering strengths, weaknesses, failure patterns, and the biggest risk areas.
4. A short publish recommendation.

Be specific, practical, and concise.`,
      response_json_schema: {
        type: 'object',
        properties: {
          generated_test_cases: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                input: { type: 'string' },
                expected_output: { type: 'string' },
                min_similarity_score: { type: 'number' },
                focus_area: { type: 'string' }
              },
              required: ['title', 'input', 'expected_output', 'min_similarity_score', 'focus_area']
            }
          },
          recommended_parameters: {
            type: 'object',
            properties: {
              target_test_count: { type: 'number' },
              recommended_similarity_threshold: { type: 'number' },
              iteration_strategy: { type: 'string' },
              prompt_style_adjustment: { type: 'string' },
              rollout_risk: { type: 'string' }
            },
            required: ['target_test_count', 'recommended_similarity_threshold', 'iteration_strategy', 'prompt_style_adjustment', 'rollout_risk']
          },
          performance_analysis: {
            type: 'object',
            properties: {
              strengths: { type: 'array', items: { type: 'string' } },
              weaknesses: { type: 'array', items: { type: 'string' } },
              failure_patterns: { type: 'array', items: { type: 'string' } },
              priority_fixes: { type: 'array', items: { type: 'string' } },
              summary: { type: 'string' }
            },
            required: ['strengths', 'weaknesses', 'failure_patterns', 'priority_fixes', 'summary']
          },
          publish_recommendation: {
            type: 'object',
            properties: {
              decision: { type: 'string' },
              reason: { type: 'string' }
            },
            required: ['decision', 'reason']
          }
        },
        required: ['generated_test_cases', 'recommended_parameters', 'performance_analysis', 'publish_recommendation']
      }
    });

    return Response.json(response);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});