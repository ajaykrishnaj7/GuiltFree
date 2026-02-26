import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIProvider } from './aiSettings';

export interface RequestAIConfig {
  useUserKey?: boolean;
  provider?: AIProvider;
  model?: string;
  apiKey?: string;
  apiKeys?: Partial<Record<AIProvider, string>>;
}

interface ResolvedConfig {
  useUserKey: boolean;
  provider: AIProvider;
  model: string;
  apiKey: string;
}

interface VisionImage {
  data: string;
  mimeType: string;
}

interface GeminiModelInfo {
  name: string;
  supportedGenerationMethods?: string[];
}

const DEFAULT_MODELS: Record<AIProvider, string> = {
  gemini: 'gemini-1.5-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-latest',
  groq: 'llama-3.1-8b-instant',
  openrouter: 'openrouter/auto',
};

const geminiModelCache = new Map<string, string[]>();

const cleanJsonText = (raw: string) =>
  raw
    .trim()
    .replace(/^```json/i, '')
    .replace(/^```/, '')
    .replace(/```$/, '')
    .trim();

const getEnvKeyForProvider = (provider: AIProvider) =>
  provider === 'gemini'
    ? process.env.GOOGLE_AI_API_KEY || ''
    : provider === 'openai'
      ? process.env.OPENAI_API_KEY || ''
      : provider === 'anthropic'
        ? process.env.ANTHROPIC_API_KEY || ''
        : provider === 'groq'
          ? process.env.GROQ_API_KEY || ''
          : process.env.OPENROUTER_API_KEY || '';

const resolveConfig = (config?: RequestAIConfig): ResolvedConfig => {
  const useUserKey = Boolean(config?.useUserKey);
  const provider: AIProvider = config?.provider || 'gemini';
  const model = config?.model || DEFAULT_MODELS[provider];
  const selectedProviderKey = useUserKey
    ? (
      config?.apiKeys?.[provider]
      || config?.apiKey
      || ''
    )
    : '';
  const apiKey = useUserKey
    ? selectedProviderKey.trim()
    : getEnvKeyForProvider(provider);

  if (!apiKey) {
    throw new Error(`Missing API key for provider: ${provider}`);
  }

  return { useUserKey, provider, model, apiKey };
};

const pickBestGeminiModel = (models: GeminiModelInfo[], preferred?: string) => {
  const supported = models.filter((model) =>
    Array.isArray(model.supportedGenerationMethods) &&
    model.supportedGenerationMethods.includes('generateContent')
  );

  if (supported.length === 0) {
    throw new Error('No Gemini models with generateContent support are available for this API key.');
  }

  const byName = (needle: string) => supported.find((model) => model.name.includes(needle));
  const preferredMatch = preferred ? byName(preferred.replace(/^models\//, '')) : undefined;

  return preferredMatch
    || byName('gemini-2.0-flash')
    || byName('gemini-1.5-flash')
    || byName('gemini-1.5-pro')
    || supported[0];
};

const discoverGeminiModelNames = async (apiKey: string, preferred?: string) => {
  const cacheKey = `${apiKey}:${preferred || ''}`;
  const cached = geminiModelCache.get(cacheKey);
  if (cached) return cached;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(apiKey)}`);
  const payload = await response.json().catch(() => null) as { models?: GeminiModelInfo[]; error?: { message?: string } } | null;

  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Failed to list Gemini models for this API key.');
  }

  const models = payload?.models || [];
  const best = pickBestGeminiModel(models, preferred);
  const supported = models
    .filter((model) =>
      Array.isArray(model.supportedGenerationMethods) &&
      model.supportedGenerationMethods.includes('generateContent')
    )
    .map((model) => model.name);

  const ordered = [best.name, ...supported.filter((name) => name !== best.name)];
  geminiModelCache.set(cacheKey, ordered);
  return ordered;
};

const callGeminiText = async (cfg: ResolvedConfig, prompt: string) => {
  const genAI = new GoogleGenerativeAI(cfg.apiKey);
  const candidates = await discoverGeminiModelNames(cfg.apiKey, cfg.model);
  const failures: string[] = [];

  for (const modelName of candidates) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${modelName}: ${message}`);
    }
  }

  throw new Error(`Gemini failed across available models. ${failures.join(' | ')}`);
};

const callGeminiVision = async (cfg: ResolvedConfig, prompt: string, images: VisionImage[]) => {
  const genAI = new GoogleGenerativeAI(cfg.apiKey);
  const candidates = await discoverGeminiModelNames(cfg.apiKey, cfg.model);
  const failures: string[] = [];

  for (const modelName of candidates) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([
        prompt,
        ...images.map((image) => ({
          inlineData: {
            data: image.data,
            mimeType: image.mimeType || 'image/jpeg',
          },
        })),
      ]);
      return result.response.text();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${modelName}: ${message}`);
    }
  }

  throw new Error(`Gemini vision failed across available models. ${failures.join(' | ')}`);
};

const callOpenAIText = async (cfg: ResolvedConfig, prompt: string) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  });
  const json = await response.json();
  if (!response.ok) {
    const retryAfter = response.headers.get('retry-after');
    throw new Error(`${json?.error?.message || 'OpenAI request failed'}${retryAfter ? ` Retry-After: ${retryAfter}s` : ''}`);
  }
  return json?.choices?.[0]?.message?.content || '';
};

const callOpenAIVision = async (cfg: ResolvedConfig, prompt: string, images: VisionImage[]) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...images.map((image) => ({
              type: 'image_url',
              image_url: {
                url: `data:${image.mimeType || 'image/jpeg'};base64,${image.data}`,
              },
            })),
          ],
        },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  const json = await response.json();
  if (!response.ok) {
    const retryAfter = response.headers.get('retry-after');
    throw new Error(`${json?.error?.message || 'OpenAI vision request failed'}${retryAfter ? ` Retry-After: ${retryAfter}s` : ''}`);
  }
  return json?.choices?.[0]?.message?.content || '';
};

const callAnthropicText = async (cfg: ResolvedConfig, prompt: string) => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 2000,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const json = await response.json();
  if (!response.ok) {
    const retryAfter = response.headers.get('retry-after');
    throw new Error(`${json?.error?.message || 'Anthropic request failed'}${retryAfter ? ` Retry-After: ${retryAfter}s` : ''}`);
  }
  return json?.content?.find((part: { type: string }) => part.type === 'text')?.text || '';
};

const callAnthropicVision = async (cfg: ResolvedConfig, prompt: string, images: VisionImage[]) => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 2000,
      temperature: 0.2,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...images.map((image) => ({
            type: 'image',
            source: {
              type: 'base64',
              media_type: image.mimeType || 'image/jpeg',
              data: image.data,
            },
          })),
        ],
      }],
    }),
  });
  const json = await response.json();
  if (!response.ok) {
    const retryAfter = response.headers.get('retry-after');
    throw new Error(`${json?.error?.message || 'Anthropic vision request failed'}${retryAfter ? ` Retry-After: ${retryAfter}s` : ''}`);
  }
  return json?.content?.find((part: { type: string }) => part.type === 'text')?.text || '';
};

const callGroqText = async (cfg: ResolvedConfig, prompt: string) => {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const json = await response.json();
  if (!response.ok) {
    const retryAfter = response.headers.get('retry-after');
    throw new Error(`${json?.error?.message || 'Groq request failed'}${retryAfter ? ` Retry-After: ${retryAfter}s` : ''}`);
  }
  return json?.choices?.[0]?.message?.content || '';
};

const callGroqVision = async () => {
  throw new Error('Groq vision is not configured in this app yet.');
};

const callOpenRouterText = async (cfg: ResolvedConfig, prompt: string) => {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
      'HTTP-Referer': 'https://guiltfree.app',
      'X-Title': 'GuiltFree',
    },
    body: JSON.stringify({
      model: cfg.model || 'openrouter/auto',
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
      route: 'fallback',
      models: ['*/*:free'],
    }),
  });
  const json = await response.json();
  if (!response.ok) {
    const retryAfter = response.headers.get('retry-after');
    throw new Error(`${json?.error?.message || 'OpenRouter request failed'}${retryAfter ? ` Retry-After: ${retryAfter}s` : ''}`);
  }
  return json?.choices?.[0]?.message?.content || '';
};

const callOpenRouterVision = async (cfg: ResolvedConfig, prompt: string, images: VisionImage[]) => {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
      'HTTP-Referer': 'https://guiltfree.app',
      'X-Title': 'GuiltFree',
    },
    body: JSON.stringify({
      model: cfg.model || 'openrouter/auto',
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...images.map((image) => ({
              type: 'image_url',
              image_url: {
                url: `data:${image.mimeType || 'image/jpeg'};base64,${image.data}`,
              },
            })),
          ],
        },
      ],
      route: 'fallback',
      models: ['*/*:free'],
    }),
  });
  const json = await response.json();
  if (!response.ok) {
    const retryAfter = response.headers.get('retry-after');
    throw new Error(`${json?.error?.message || 'OpenRouter vision request failed'}${retryAfter ? ` Retry-After: ${retryAfter}s` : ''}`);
  }
  return json?.choices?.[0]?.message?.content || '';
};

const extractRetryAfterSeconds = (message: string) => {
  const patterns = [
    /retry(?:\s+in|\s+after)?\s+([0-9]+(?:\.[0-9]+)?)s/i,
    /"retryDelay":"([0-9]+)s"/i,
    /retry-after:\s*([0-9]+(?:\.[0-9]+)?)/i,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value > 0) return Math.ceil(value);
    }
  }
  return null;
};

const isLimitError = (message: string) => {
  const lower = message.toLowerCase();
  return lower.includes('429') ||
    lower.includes('too many requests') ||
    lower.includes('quota') ||
    lower.includes('rate limit');
};

const callTextForProvider = async (cfg: ResolvedConfig, prompt: string) =>
  cfg.provider === 'gemini'
    ? callGeminiText(cfg, prompt)
    : cfg.provider === 'openai'
      ? callOpenAIText(cfg, prompt)
      : cfg.provider === 'anthropic'
        ? callAnthropicText(cfg, prompt)
        : cfg.provider === 'groq'
          ? callGroqText(cfg, prompt)
          : callOpenRouterText(cfg, prompt);

const callVisionForProvider = async (cfg: ResolvedConfig, prompt: string, images: VisionImage[]) =>
  cfg.provider === 'gemini'
    ? callGeminiVision(cfg, prompt, images)
    : cfg.provider === 'openai'
      ? callOpenAIVision(cfg, prompt, images)
      : cfg.provider === 'anthropic'
        ? callAnthropicVision(cfg, prompt, images)
        : cfg.provider === 'groq'
          ? callGroqVision()
          : callOpenRouterVision(cfg, prompt, images);

const USER_PROVIDER_ORDER: AIProvider[] = ['gemini', 'openai', 'anthropic', 'groq', 'openrouter'];
const SERVER_PROVIDER_ORDER: AIProvider[] = ['gemini', 'openai', 'anthropic', 'groq', 'openrouter'];

const buildFallbackProviderChain = (
  primary: ResolvedConfig,
  requestConfig?: RequestAIConfig
): ResolvedConfig[] => {
  if (primary.useUserKey) {
    const apiKeys = requestConfig?.apiKeys || {};
    const ordered: AIProvider[] = [
      primary.provider,
      ...USER_PROVIDER_ORDER.filter((provider) => provider !== primary.provider),
    ];
    const chain: ResolvedConfig[] = [];
    for (const provider of ordered) {
      const key = String(apiKeys[provider] || '').trim();
      if (!key) continue;
      chain.push({
        useUserKey: true,
        provider,
        model: provider === primary.provider ? primary.model : DEFAULT_MODELS[provider],
        apiKey: key,
      });
    }
    const userChain = chain.length > 0 ? chain : [primary];

    // BYOK mode can still fall back to system Gemini as last resort.
    const systemGeminiKey = getEnvKeyForProvider('gemini');
    if (!systemGeminiKey) return userChain;

    const alreadyIncludedSystemGemini = userChain.some(
      (cfg) => cfg.provider === 'gemini' && cfg.apiKey === systemGeminiKey
    );
    if (alreadyIncludedSystemGemini) return userChain;

    return [
      ...userChain,
      {
        useUserKey: false,
        provider: 'gemini',
        model: DEFAULT_MODELS.gemini,
        apiKey: systemGeminiKey,
      },
    ];
  }

  const others: ResolvedConfig[] = [];
  for (const provider of SERVER_PROVIDER_ORDER) {
    if (provider === primary.provider) continue;
    const apiKey = getEnvKeyForProvider(provider);
    if (!apiKey) continue;
    others.push({
      useUserKey: false,
      provider,
      model: DEFAULT_MODELS[provider],
      apiKey,
    });
  }
  return [primary, ...others];
};

const executeWithProviderFallback = async (
  executor: (cfg: ResolvedConfig) => Promise<string>,
  primary: ResolvedConfig,
  requestConfig?: RequestAIConfig
) => {
  const chain = buildFallbackProviderChain(primary, requestConfig);
  const failures: string[] = [];
  let bestRetryAfter: number | null = null;
  let sawLimit = false;

  for (const cfg of chain) {
    try {
      return await executor(cfg);
    } catch (error: unknown) {
      const details = error instanceof Error ? error.message : String(error);
      failures.push(`${cfg.provider}: ${details}`);
      if (isLimitError(details)) sawLimit = true;
      const retryAfter = extractRetryAfterSeconds(details);
      if (retryAfter && (!bestRetryAfter || retryAfter < bestRetryAfter)) {
        bestRetryAfter = retryAfter;
      }
    }
  }

  const retryText = bestRetryAfter ? ` Next retry window in ~${bestRetryAfter}s.` : '';
  const prefix = sawLimit
    ? 'All available AI providers/models are currently rate-limited or quota-limited.'
    : 'All available AI providers failed.';
  throw new Error(`${prefix}${retryText} ${failures.join(' | ')}`.trim());
};

export const generateJsonText = async (prompt: string, config?: RequestAIConfig) => {
  const cfg = resolveConfig(config);
  const raw = await executeWithProviderFallback((resolved) => callTextForProvider(resolved, prompt), cfg, config);
  return cleanJsonText(raw);
};

export const generateJsonVision = async (
  prompt: string,
  images: VisionImage[],
  config?: RequestAIConfig
) => {
  const cfg = resolveConfig(config);
  const raw = await executeWithProviderFallback((resolved) => callVisionForProvider(resolved, prompt, images), cfg, config);
  return cleanJsonText(raw);
};
