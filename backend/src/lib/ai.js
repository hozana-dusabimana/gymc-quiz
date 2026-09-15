import { env, aiConfigured } from '../config/env.js';

const TIMEOUT_MS = 45_000;

/**
 * Low-level chat completion against OpenRouter.
 * @param {{system?:string, user:string, json?:boolean, temperature?:number, maxTokens?:number,
 *          model?:string, web?:boolean|number, full?:boolean}} opts
 * @returns {Promise<string|{text:string, citations:{url:string,title:string}[]}>}
 *   assistant text, or `{ text, citations }` when `full` is set.
 */
export async function chat({
  system,
  user,
  json = false,
  temperature = 0.2,
  maxTokens = 1200,
  model,
  web = false,
  full = false,
}) {
  if (!aiConfigured()) throw new Error('AI is not configured (OPENROUTER_API_KEY missing)');

  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: user });

  const body = {
    model: model || (web ? env.ai.webModel : env.ai.model),
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (json) body.response_format = { type: 'json_object' };
  if (web) {
    body.plugins = [{ id: 'web', engine: 'exa', max_results: typeof web === 'number' ? web : 3 }];
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${env.ai.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${env.ai.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': env.ai.appUrl,
          'X-Title': env.ai.appTitle,
        },
        body: JSON.stringify(body),
      });

      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`OpenRouter ${res.status}: ${await safeText(res)}`);
        await sleep(500 * (attempt + 1));
        continue;
      }
      if (!res.ok) {
        clearTimeout(timer);
        throw new Error(`OpenRouter ${res.status}: ${await safeText(res)}`);
      }

      const data = await res.json();
      clearTimeout(timer);
      const message = data?.choices?.[0]?.message || {};
      const text = message.content;
      if (!text) throw new Error('OpenRouter returned an empty completion');
      if (full) {
        const citations = (message.annotations || [])
          .filter((a) => a.type === 'url_citation' && a.url_citation?.url)
          .map((a) => ({ url: a.url_citation.url, title: a.url_citation.title || a.url_citation.url }))
          .filter((c) => /^https?:\/\//i.test(c.url) && !/vertexaisearch\.cloud\.google/.test(c.url));
        return { text, citations };
      }
      return text;
    } catch (err) {
      lastErr = err;
      if (err.name === 'AbortError') break;
      await sleep(400 * (attempt + 1));
    }
  }
  clearTimeout(timer);
  throw lastErr || new Error('OpenRouter request failed');
}

/**
 * Chat completion that must return a JSON object. Tolerates code fences and
 * leading prose; returns the parsed object or throws.
 */
export async function chatJson(opts) {
  const raw = await chat({ ...opts, json: true });
  return parseJsonLoose(raw);
}

export function parseJsonLoose(raw) {
  if (typeof raw !== 'string') return raw;
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  try {
    return JSON.parse(s);
  } catch {
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(s.slice(start, end + 1));
    }
    throw new Error('AI response was not valid JSON');
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function safeText(res) {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return '';
  }
}

export { aiConfigured };
