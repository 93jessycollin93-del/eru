import { base44 } from '@/api/base44Client';
import { isLocalProvider, streamProviderChat } from '@/lib/localModelProviders';

export async function renderPromptTemplate({ templateId, variables = {}, context = '' }) {
  if (!templateId) return '';
  const response = await base44.functions.invoke('renderPromptTemplate', {
    templateId,
    variables,
    context,
  });
  return response.data?.rendered_prompt || '';
}

export async function invokeSelectedModel({ provider = 'base44', model = '', prompt, botId = '', dataRequest = null, file_urls = [], messages, onToken }) {
  // Local providers (Ollama, LM Studio, Bionic) run on the user's machine —
  // call them client-side since the backend function can't reach localhost.
  if (isLocalProvider(provider)) {
    const chatMessages = messages && messages.length
      ? messages
      : [{ role: 'user', content: prompt }];
    return streamProviderChat({
      provider,
      model: model || 'automatic',
      messages: chatMessages,
      onToken,
    });
  }

  const response = await base44.functions.invoke('invokeExternalModel', {
    provider,
    model,
    prompt,
    botId,
    dataRequest,
    file_urls,
  });

  if (response.data?.error) {
    throw new Error(response.data.error);
  }

  return response.data?.output || '';
}