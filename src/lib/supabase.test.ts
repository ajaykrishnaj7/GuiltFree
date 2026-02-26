const mockCreateClient = jest.fn().mockReturnValue({
  auth: { getSession: jest.fn() },
  from: jest.fn(),
});

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: any[]) => mockCreateClient(...args),
}));

describe('supabase client', () => {
  beforeEach(() => {
    jest.resetModules();
    mockCreateClient.mockClear();
  });

  it('exports a supabase client', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    const { supabase } = require('./supabase');
    expect(supabase).toBeDefined();
  });

  it('creates client with env variables', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    
    require('./supabase');
    
    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key'
    );
  });

  it('client has auth methods', () => {
    const { supabase } = require('./supabase');
    expect(supabase.auth).toBeDefined();
  });

  it('client has from method', () => {
    const { supabase } = require('./supabase');
    expect(supabase.from).toBeDefined();
  });
});
