import { DEFAULT_AI_SETTINGS, loadAISettings, saveAISettings, type AISettings } from './aiSettings';

describe('aiSettings', () => {
  const userId = 'user-123';
  const key = `guiltfree.ai-settings.${userId}`;

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns defaults when nothing is saved', () => {
    expect(loadAISettings(userId)).toEqual(DEFAULT_AI_SETTINGS);
  });

  it('saves and loads valid settings', () => {
    const settings: AISettings = {
      useUserKey: true,
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      apiKey: 'groq-key',
      apiKeys: {
        groq: 'groq-key',
        gemini: 'gemini-key',
      },
    };

    saveAISettings(userId, settings);
    expect(loadAISettings(userId)).toEqual(settings);
  });

  it('falls back to provider default model when saved model is invalid', () => {
    window.localStorage.setItem(key, JSON.stringify({
      useUserKey: true,
      provider: 'openai',
      model: 'not-a-real-model',
      apiKeys: { openai: 'sk-test' },
    }));

    const loaded = loadAISettings(userId);
    expect(loaded.provider).toBe('openai');
    expect(loaded.model).toBe('gpt-4o-mini');
    expect(loaded.apiKey).toBe('sk-test');
  });

  it('supports backward compatibility with single apiKey shape', () => {
    window.localStorage.setItem(key, JSON.stringify({
      useUserKey: true,
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      apiKey: 'legacy-key',
    }));

    const loaded = loadAISettings(userId);
    expect(loaded.apiKey).toBe('legacy-key');
    expect(loaded.apiKeys.gemini).toBe('legacy-key');
  });

  it('returns defaults for malformed JSON', () => {
    window.localStorage.setItem(key, '{bad json');
    expect(loadAISettings(userId)).toEqual(DEFAULT_AI_SETTINGS);
  });
});

