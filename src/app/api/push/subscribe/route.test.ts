import { POST } from './route';
import { createSupabaseServerAdminClient, getAuthenticatedUser } from '@/lib/supabaseServer';

const mockUpsert = jest.fn();

jest.mock('@/lib/supabaseServer', () => ({
  getAuthenticatedUser: jest.fn(),
  createSupabaseServerAdminClient: jest.fn(() => ({
    from: jest.fn(() => ({ upsert: mockUpsert })),
  })),
}));

describe('POST /api/push/subscribe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthenticatedUser as jest.Mock).mockResolvedValue({ id: 'user-1' });
    mockUpsert.mockResolvedValue({ error: null });
  });

  it('returns 400 when endpoint missing', async () => {
    const request = { json: () => Promise.resolve({ subscription: {} }), headers: new Headers() } as unknown as Request;
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 200 when subscription saved', async () => {
    const request = {
      json: () => Promise.resolve({ subscription: { endpoint: 'https://push.example', keys: { p256dh: 'a', auth: 'b' } } }),
      headers: new Headers({ Authorization: 'Bearer token' }),
    } as unknown as Request;
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(createSupabaseServerAdminClient).toHaveBeenCalled();
  });
});
