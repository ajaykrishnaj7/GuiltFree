const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn();

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: (...args: unknown[]) => mockGetGenerativeModel(...args),
  })),
}));

describe('aiClient', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      GOOGLE_AI_API_KEY: 'system-gemini-key',
      OPENAI_API_KEY: 'system-openai-key',
      ANTHROPIC_API_KEY: 'system-anthropic-key',
      GROQ_API_KEY: 'system-groq-key',
      OPENROUTER_API_KEY: 'system-openrouter-key',
    };

    mockGetGenerativeModel.mockReturnValue({ generateContent: mockGenerateContent });
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('generates JSON text with Gemini and strips markdown fences', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: 'models/gemini-1.5-flash', supportedGenerationMethods: ['generateContent'] }],
        }),
      }) as unknown as typeof fetch;

    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => '```json\n{"ok": true}\n```' },
    });

    const { generateJsonText } = await import('./aiClient');
    const result = await generateJsonText('test prompt');

    expect(result).toBe('{"ok": true}');
    expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: 'models/gemini-1.5-flash' });
  });

  it('falls back to another provider when primary user provider fails', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        headers: { get: () => null },
        json: async () => ({ error: { message: '429 rate limit' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => null },
        json: async () => ({ choices: [{ message: { content: '{"fallback":true}' } }] }),
      }) as unknown as typeof fetch;

    const { generateJsonText } = await import('./aiClient');
    const result = await generateJsonText('fallback test', {
      useUserKey: true,
      provider: 'openai',
      apiKeys: {
        openai: 'user-openai-key',
        groq: 'user-groq-key',
      },
    });

    expect(result).toBe('{"fallback":true}');
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('api.openai.com');
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain('api.groq.com');
  });

  it('returns detailed error with retry window when all providers are limited', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({
        ok: false,
        headers: { get: (k: string) => (k === 'retry-after' ? '9' : null) },
        json: async () => ({ error: { message: '429 Too Many Requests quota exceeded' } }),
      }) as unknown as typeof fetch;

    const { generateJsonText } = await import('./aiClient');

    await expect(
      generateJsonText('limit test', {
        useUserKey: true,
        provider: 'openai',
        apiKeys: {
          openai: 'user-openai-key',
          anthropic: 'user-anthropic-key',
          groq: 'user-groq-key',
          openrouter: 'user-openrouter-key',
          gemini: 'user-gemini-key',
        },
      })
    ).rejects.toThrow('Next retry window in ~9s');
  });

  it('throws when required API key for selected provider is missing', async () => {
    delete process.env.OPENAI_API_KEY;
    const { generateJsonText } = await import('./aiClient');

    await expect(generateJsonText('x', { provider: 'openai' })).rejects.toThrow(
      'Missing API key for provider: openai'
    );
  });

  it('calls OpenAI vision endpoint for image requests', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => null },
        json: async () => ({
          choices: [{ message: { content: '```json\n{"calories":210}\n```' } }],
        }),
      }) as unknown as typeof fetch;

    const { generateJsonVision } = await import('./aiClient');
    const result = await generateJsonVision(
      'vision prompt',
      [{ data: 'abcd', mimeType: 'image/jpeg' }],
      { provider: 'openai', apiKey: 'user-openai-key', useUserKey: true }
    );

    expect(result).toBe('{"calories":210}');
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('api.openai.com');
  });

  it('fails vision requests for groq and falls back to openrouter', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => null },
        json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }),
      }) as unknown as typeof fetch;

    const { generateJsonVision } = await import('./aiClient');
    const result = await generateJsonVision(
      'vision fallback',
      [{ data: 'abcd', mimeType: 'image/png' }],
      {
        provider: 'groq',
        useUserKey: true,
        apiKeys: {
          groq: 'user-groq-key',
          openrouter: 'user-openrouter-key',
        },
      }
    );

    expect(result).toBe('{"ok":true}');
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('openrouter.ai');
  });

  it('uses system provider chain when not in BYOK mode', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        headers: { get: () => null },
        json: async () => ({ error: { message: 'openai down' } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: 'gemini list failed' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => null },
        json: async () => ({ content: [{ type: 'text', text: '{"ok":true}' }] }),
      }) as unknown as typeof fetch;

    const { generateJsonText } = await import('./aiClient');
    const result = await generateJsonText('system chain', { provider: 'openai' });

    expect(result).toBe('{"ok":true}');
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('api.openai.com');
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain('generativelanguage.googleapis.com');
    expect((global.fetch as jest.Mock).mock.calls[2][0]).toContain('api.anthropic.com');
  });

  it('includes model list failure details when Gemini discovery endpoint fails', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: 'bad gemini key' } }),
      }) as unknown as typeof fetch;

    const { generateJsonText } = await import('./aiClient');

    await expect(generateJsonText('gemini fail', { provider: 'gemini' })).rejects.toThrow(
      /bad gemini key/
    );
  });
});
