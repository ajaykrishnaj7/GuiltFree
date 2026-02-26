export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'groq' | 'openrouter';

export interface AISettings {
  useUserKey: boolean;
  provider: AIProvider;
  model: string;
  apiKey: string;
  apiKeys: Partial<Record<AIProvider, string>>;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  useUserKey: false,
  provider: 'gemini',
  model: 'gemini-1.5-flash',
  apiKey: '',
  apiKeys: {},
};

export const PROVIDER_MODELS: Record<AIProvider, string[]> = {
  gemini: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'],
  openai: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4o'],
  anthropic: ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest'],
  groq: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
  openrouter: ['openrouter/auto'],
};

const buildStorageKey = (userId: string) => `guiltfree.ai-settings.${userId}`;

export const loadAISettings = (userId: string): AISettings => {
  if (typeof window === 'undefined') return DEFAULT_AI_SETTINGS;
  const raw = window.localStorage.getItem(buildStorageKey(userId));
  if (!raw) return DEFAULT_AI_SETTINGS;

  try {
    const parsed = JSON.parse(raw) as Partial<AISettings>;
    const provider = parsed.provider && PROVIDER_MODELS[parsed.provider]
      ? parsed.provider
      : DEFAULT_AI_SETTINGS.provider;
    const model = parsed.model && PROVIDER_MODELS[provider].includes(parsed.model)
      ? parsed.model
      : PROVIDER_MODELS[provider][0];
    const parsedApiKeys = (parsed.apiKeys && typeof parsed.apiKeys === 'object')
      ? parsed.apiKeys
      : {};

    // Backward compatibility: old shape had one `apiKey` only.
    const mergedKeys: Partial<Record<AIProvider, string>> = {
      ...parsedApiKeys,
      ...(parsed.apiKey ? { [provider]: parsed.apiKey } : {}),
    };

    return {
      useUserKey: Boolean(parsed.useUserKey),
      provider,
      model,
      apiKey: (mergedKeys[provider] || '').toString(),
      apiKeys: mergedKeys,
    };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
};

export const saveAISettings = (userId: string, settings: AISettings) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(buildStorageKey(userId), JSON.stringify(settings));
};
