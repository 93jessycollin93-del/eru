import { base44 } from '@/api/base44Client';

export async function renderPromptTemplate({ templateId, variables = {}, context = '' }) {
  if (!templateId) return '';
  const response = await base44.functions.invoke('renderPromptTemplate', {
    templateId,
    variables,
    context,
  });
  return response.data?.rendered_prompt || '';
}

export async function invokeSelectedModel({ provider = 'base44', model = '', prompt, botId = '', dataRequest = null }) {
  const response = await base44.functions.invoke('invokeExternalModel', {
    provider,
    model,
    prompt,
    botId,
    dataRequest,
  });

  return response.data?.output || '';
}