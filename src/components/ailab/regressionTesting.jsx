import { base44 } from '@/api/base44Client';
import { invokeSelectedModel } from './modelRouting';

export async function scoreSimilarity(expectedOutput, actualOutput) {
  return await base44.integrations.Core.InvokeLLM({
    prompt: `You are grading a bot response.\nExpected output:\n${expectedOutput}\n\nActual output:\n${actualOutput}\n\nScore the semantic similarity from 0 to 1, where 1 means the actual output fully satisfies the expected output in meaning and logic. Return a short reason.`,
    response_json_schema: {
      type: 'object',
      properties: {
        similarity_score: { type: 'number' },
        reason: { type: 'string' }
      },
      required: ['similarity_score', 'reason']
    }
  });
}

export function buildRegressionPrompt(bot, instructions, input, globalPolicy) {
  const policyBlock = globalPolicy?.is_active
    ? `\nGlobal instructions: ${globalPolicy.shared_instructions || 'None'}\nSafety guardrails: ${globalPolicy.safety_guardrails || 'None'}`
    : '';

  return `You are ${bot.name}. ${instructions || ''}\nPersonality: ${bot.personality || 'helpful'}\nResponse style: ${bot.response_style || 'detailed'}${policyBlock}\n\nUser: ${input}\n\n${bot.name}:`;
}

export async function runRegressionSuite({ bot, instructions, globalPolicy }) {
  const cases = await base44.entities.BotTestCase.filter({ bot_id: bot.id }, '-created_date', 100);
  const activeCases = cases.filter((item) => item.is_active !== false);
  const runGroup = `regression_${Date.now()}`;
  const results = [];

  for (const testCase of activeCases) {
    const prompt = buildRegressionPrompt(bot, instructions, testCase.input, globalPolicy);
    const actualOutput = await invokeSelectedModel({ provider: bot.model_provider, model: bot.model_name, prompt }).catch(() => 'Model unavailable');
    const scored = await scoreSimilarity(testCase.expected_output, actualOutput);
    const similarity = Number(scored.similarity_score || 0);
    const passed = similarity >= Number(testCase.min_similarity_score || 0.75);

    const run = {
      bot_id: bot.id,
      bot_name: bot.name,
      test_case_id: testCase.id,
      test_title: testCase.title,
      input: testCase.input,
      expected_output: testCase.expected_output,
      actual_output: actualOutput,
      similarity_score: similarity,
      passed,
      pass_rate_snapshot: passed ? 100 : 0,
      regression_flag: false,
      regression_reason: scored.reason,
      run_group: runGroup,
    };

    await base44.entities.BotTestRun.create(run);
    results.push(run);
  }

  return results;
}