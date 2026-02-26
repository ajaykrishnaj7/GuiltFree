const mockCreateClient = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

describe('supabaseServer', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    mockCreateClient.mockReset();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('creates anon client with public env vars', async () => {
    mockCreateClient.mockReturnValue({});
    const mod = await import('./supabaseServer');

    mod.createSupabaseServerAnonClient();
    expect(mockCreateClient).toHaveBeenCalledWith('https://example.supabase.co', 'anon-key');
  });

  it('creates admin client with auth persistence disabled', async () => {
    mockCreateClient.mockReturnValue({});
    const mod = await import('./supabaseServer');

    mod.createSupabaseServerAdminClient();
    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'service-role-key',
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  });

  it('throws when service role key is missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const mod = await import('./supabaseServer');

    expect(() => mod.createSupabaseServerAdminClient()).toThrow(
      'SUPABASE_SERVICE_ROLE_KEY is required for server admin operations'
    );
  });

  it('extracts bearer token from authorization headers', async () => {
    const mod = await import('./supabaseServer');
    const request = {
      headers: {
        get: (name: string) => (name.toLowerCase() === 'authorization' ? 'Bearer token-123' : null),
      },
    } as unknown as Request;

    expect(mod.getBearerToken(request)).toBe('token-123');
  });

  it('returns null for non-bearer auth header', async () => {
    const mod = await import('./supabaseServer');
    const request = {
      headers: {
        get: (name: string) => (name.toLowerCase() === 'authorization' ? 'Basic abc' : null),
      },
    } as unknown as Request;

    expect(mod.getBearerToken(request)).toBeNull();
  });

  it('returns authenticated user when token is valid', async () => {
    const user = { id: 'user-1', email: 'a@example.com' };
    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
      },
    });
    const mod = await import('./supabaseServer');
    const request = {
      headers: {
        get: (name: string) => (name.toLowerCase() === 'authorization' ? 'Bearer valid-token' : null),
      },
    } as unknown as Request;

    await expect(mod.getAuthenticatedUser(request)).resolves.toEqual(user);
  });

  it('throws for missing auth token', async () => {
    const mod = await import('./supabaseServer');
    const request = {
      headers: {
        get: () => null,
      },
    } as unknown as Request;

    await expect(mod.getAuthenticatedUser(request)).rejects.toThrow('Missing auth token');
  });

  it('throws for invalid auth token', async () => {
    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: { message: 'bad' } }),
      },
    });
    const mod = await import('./supabaseServer');
    const request = {
      headers: {
        get: (name: string) => (name.toLowerCase() === 'authorization' ? 'Bearer invalid-token' : null),
      },
    } as unknown as Request;

    await expect(mod.getAuthenticatedUser(request)).rejects.toThrow('Invalid auth token');
  });
});
