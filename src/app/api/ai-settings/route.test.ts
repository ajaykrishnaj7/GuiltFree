import { GET, PUT } from './route';
import { createSupabaseServerAdminClient, getAuthenticatedUser } from '@/lib/supabaseServer';
import { decryptJson, encryptJson } from '@/lib/aiKeyVault';

const mockSingle = jest.fn();
const mockUpsert = jest.fn();

jest.mock('@/lib/supabaseServer', () => ({
  getAuthenticatedUser: jest.fn(),
  createSupabaseServerAdminClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: () => ({ eq: () => ({ single: mockSingle }) }),
      upsert: mockUpsert,
    })),
  })),
}));

jest.mock('@/lib/aiKeyVault', () => ({
  encryptJson: jest.fn(),
  decryptJson: jest.fn(),
}));

describe('AI settings route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthenticatedUser as jest.Mock).mockResolvedValue({ id: 'user-1' });
    (encryptJson as jest.Mock).mockReturnValue('encrypted');
  });

  it('GET returns defaults when row does not exist', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
    const res = await GET({ headers: new Headers({ Authorization: 'Bearer token' }) } as unknown as Request);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.settings.provider).toBe('gemini');
  });

  it('GET returns decrypted settings when row exists', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        use_user_key: true,
        primary_provider: 'groq',
        primary_model: 'llama-3.1-8b-instant',
        encrypted_payload: 'encrypted',
      },
      error: null,
    });
    (decryptJson as jest.Mock).mockReturnValue({
      apiKeys: { groq: 'gsk_test' },
    });

    const res = await GET({ headers: new Headers({ Authorization: 'Bearer token' }) } as unknown as Request);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.settings.provider).toBe('groq');
    expect(data.settings.apiKey).toBe('gsk_test');
  });

  it('PUT validates payload', async () => {
    const res = await PUT({
      json: () => Promise.resolve({}),
      headers: new Headers({ Authorization: 'Bearer token' }),
    } as unknown as Request);
    expect(res.status).toBe(400);
  });

  it('PUT stores encrypted settings', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
    mockUpsert.mockResolvedValueOnce({ error: null });
    const res = await PUT({
      json: () => Promise.resolve({
        settings: {
          useUserKey: true,
          provider: 'openrouter',
          model: 'openrouter/auto',
          apiKeys: { openrouter: 'sk-or-test' },
        },
      }),
      headers: new Headers({ Authorization: 'Bearer token' }),
    } as unknown as Request);
    expect(res.status).toBe(200);
    expect(createSupabaseServerAdminClient).toHaveBeenCalled();
    expect(encryptJson).toHaveBeenCalled();
  });
});
