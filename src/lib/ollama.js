/**
 * ollama — thin client-side HTTP client for a user-configured Ollama host.
 * ----------------------------------------------------------------------------
 * The phone reaches the user's Ollama instance over HTTP. CORS must be enabled
 * on the host (OLLAMA_ORIGINS) and the host must be reachable from this device.
 * All errors are translated to friendly, actionable messages.
 */

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

export function getOllamaUrl() {
  try {
    return localStorage.getItem('ollama_base_url') || DEFAULT_OLLAMA_URL;
  } catch {
    return DEFAULT_OLLAMA_URL;
  }
}

export function setOllamaUrl(url) {
  const clean = (url || '').trim().replace(/\/+$/, '') || DEFAULT_OLLAMA_URL;
  try {
    localStorage.setItem('ollama_base_url', clean);
  } catch {}
  return clean;
}

export function friendlyOllamaError(err) {
  const msg = (err && (err.message || err.toString())) || 'Unknown error';
  if (/Failed to fetch|NetworkError|TypeError|Load failed/i.test(msg)) {
    return "Can't reach Ollama. Make sure it's running, reachable from this device, and CORS is enabled (set OLLAMA_ORIGINS to include this app's origin).";
  }
  if (/abort|timeout/i.test(msg)) {
    return 'Connection timed out — Ollama may be busy or unreachable.';
  }
  return msg;
}

/** Probe the host and list installed models. Returns { ok, models, error }. */
export async function testConnection(baseUrl) {
  const url = (baseUrl || getOllamaUrl()).replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${url}/api/tags`, { signal: controller.signal });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { ok: true, models: (data.models || []).map((m) => m.name) };
  } catch (err) {
    return { ok: false, error: friendlyOllamaError(err) };
  } finally {
    clearTimeout(timer);
  }
}

/** Stream a chat completion (OpenAI-compatible endpoint). onToken(delta). */
export async function streamChat({
  baseUrl,
  model,
  messages,
  temperature = 0.7,
  top_p = 0.9,
  max_tokens = 2048,
  signal,
  onToken,
}) {
  const url = (baseUrl || getOllamaUrl()).replace(/\/+$/, '');
  const supportsStream = typeof window !== 'undefined' && 'ReadableStream' in window;

  const body = JSON.stringify({
    model,
    messages,
    temperature,
    top_p,
    max_tokens,
    stream: supportsStream,
  });

  const res = await fetch(`${url}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Ollama HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }

  // Non-streaming fallback (older Safari without ReadableStream).
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
      } catch {
        /* ignore malformed partial */
      }
    }
  }
  return full;
}

/** Summarize raw notes into a compact summary using the active model. */
export async function summarizeNotes({ baseUrl, model, notes }) {
  const prompt = [
    'Compress the following notes into a tight, factual summary. Keep key facts,',
    'drop fluff. Reply with only the summary.\n\nNOTES:\n' + (notes || '').slice(0, 8000),
  ].join('\n');
  return streamChat({
    baseUrl,
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 512,
  });
}

export function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}