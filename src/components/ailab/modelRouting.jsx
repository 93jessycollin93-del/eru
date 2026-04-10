import { base44 } from '@/api/base44Client';

export async function invokeSelectedModel({ provider, model, prompt }) {
  if (!provider || provider === 'base44') {
    return await base44.integrations.Core.InvokeLLM({ prompt });
  }

  if (provider === 'openai' || provider === 'anthropic') {
    const response = await base44.functions.invoke('invokeExternalModel', { provider, model, prompt });
    return response.data?.content || '';
  }

  if (provider === 'huggingface_user') {
    const response = await base44.functions.invoke('invokeHuggingFaceUserModel', { model, prompt });
    return response.data?.content || '';
  }

  return '';
}