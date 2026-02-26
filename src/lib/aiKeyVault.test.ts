describe('aiKeyVault', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('encrypts and decrypts JSON payloads', async () => {
    process.env.AI_KEYS_ENCRYPTION_SECRET = 'super-secret';
    const { encryptJson, decryptJson } = await import('./aiKeyVault');

    const payload = { provider: 'groq', key: 'gsk_123', enabled: true };
    const encrypted = encryptJson(payload);

    expect(typeof encrypted).toBe('string');
    expect(encrypted).not.toContain('gsk_123');
    expect(decryptJson<typeof payload>(encrypted)).toEqual(payload);
  });

  it('throws when encryption secret is missing', async () => {
    delete process.env.AI_KEYS_ENCRYPTION_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { encryptJson } = await import('./aiKeyVault');
    expect(() => encryptJson({ a: 1 })).toThrow('AI key encryption secret is not configured');
  });

  it('falls back to service role key for encryption secret', async () => {
    delete process.env.AI_KEYS_ENCRYPTION_SECRET;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret';

    const { encryptJson, decryptJson } = await import('./aiKeyVault');
    const encrypted = encryptJson({ ok: true });

    expect(decryptJson<{ ok: boolean }>(encrypted)).toEqual({ ok: true });
  });
});
