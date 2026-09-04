/**
 * localModelProviders — unified client-side client for local LLM servers.
 * Supports Ollama, LM Studio, and Bionic (LM Studio's agent app).
 * All three expose OpenAI-compatible /v1/chat/completions endpoints.
 * The browser calls them directly; CORS must be enabled on each host.
 */

const STORAGE_KEYS = {
  ollama: 'ollama_base_url',
  lmstudio: 'lmstudio_base_url',
  bionic: 'bionic_base_url',
};

export const LOCAL_PROVIDERS = {
  ollama: {
    value: 'ollama',
    label: 'Ollama',
    defaultBaseUrl: 'http://localhost:11434',
    modelsPath: '/api/tags',
    modelsShape: 'ollama',
    chatPath: '/v1/chat/completions',
    description: 'Local Ollama instance',
  },
  lmstudio: {
    value: 'lmstudio',
    label: 'LM Studio',
    defaultBaseUrl: 'http://localhost:1234',
    modelsPath: '/v1/models',
    modelsShape: 'openai',
    chatPath: '/v1/chat/completions',
    description: 'LM Studio local server',
  },
  bionic: {
    value: 'bionic',
    label: 'Bionic',
    defaultBaseUrl: 'http://localhost:1234',
    modelsPath: '/v1/models',
    modelsShape: 'openai',
    chatPath: '/v1/chat/completions',
    description: 'Bionic agent app (LM Studio)',
  },
};

export function isLocalProvider(providerKey) {
  return Object.prototype.hasOwnProperty.call(LOCAL_PROVIDERS, providerKey);
}

export function getProviderUrl(providerKey) {
  const config = LOCAL_PROVIDERS[providerKey];
  if (!config) return '';
  try {
    return localStorage.getItem(STORAGE_KEYS[providerKey]) || config.defaultBaseUrl;
  } catch {
    return config.defaultBaseUrl;
  }
}

export function setProviderUrl(providerKey, url) {
  const config = LOCAL_PROVIDERS[providerKey];
  if (!config) return '';
  const clean = (url || '').trim().replace(/\/+$/, '') || config.defaultBaseUrl;
  try {
    localStorage.setItem(STORAGE_KEYS[providerKey], clean);
  } catch {}
  return clean;
}

function friendlyError(err) {
  const msg = (err && (err.message || err.toString())) || 'Unknown error';
  if (/Failed to fetch|NetworkError|TypeError|Load failed/i.test(msg)) {
    return "Can't reach the local server. Make sure it's running, reachable from this device, and CORS is enabled.";
  }
  if (/abort|timeout/i.test(msg)) return 'Connection timed out.';
  return msg;
}

/** Probe the host and list installed models. Returns { ok, models, error }. */
export async function testProviderConnection(providerKey) {
  const config = LOCAL_PROVIDERS[providerKey];
  if (!config) return { ok: false, error: 'Unknown provider' };
  const baseUrl = getProviderUrl(providerKey);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${baseUrl}${config.modelsPath}`, { signal: controller.signal });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    const models = config.modelsShape === 'ollama'
      ? (data.models || []).map((m) => m.name)
      : (data.data || []).map((m) => m.id);
    return { ok: true, models };
  } catch (err) {
    return { ok: false, error: friendlyError(err) };
  } finally {
    clearTimeout(timer);
  }
}

/** Stream a chat completion (OpenAI-compatible). onToken(delta). */
export async function streamProviderChat({
  provider: providerKey,
  model,
  messages,
  temperature = 0.7,
  top_p = 0.9,
  max_tokens = 2048,
  signal,
  onToken,
}) {
  const config = LOCAL_PROVIDERS[providerKey];
  if (!config) throw new Error(`Unknown local provider: ${providerKey}`);
  const baseUrl = getProviderUrl(providerKey);
  const supportsStream = typeof window !== 'undefined' && 'ReadableStream' in window;

  const body = JSON.stringify({
    model,
    messages,
    temperature,
    top_p,
    max_tokens,
    stream: supportsStream,
  });

  const res = await fetch(`${baseUrl}${config.chatPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${config.label} HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }

  if (!supportsStream || !res.body || typeof res.body.getReader !== 'function') {
    const data = await res.json();
    const full = data.choices?.[0]?.message?.content || '';
    if (onToken && full) onToken(full);
    return full;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const t = line.trim();
      if (!t || !t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content || '';
        if (delta) {
          full += delta;
          onToken?.(delta);
        }
      } catch { /* ignore malformed partial */ }
    }
  }
  return full;
}