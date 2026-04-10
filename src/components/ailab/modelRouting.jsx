import { base44 } from '@/api/base44Client';

export async function invokeSelectedModel({ provider = 'base44', model = '', prompt }) {
  const response = await base44.functions.invoke('invokeExternalModel', {
    provider,
    model,
    prompt,
  });

  return response.data?.output || '';
}