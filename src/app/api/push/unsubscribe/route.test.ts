import { POST } from './route';
import { getAuthenticatedUser } from '@/lib/supabaseServer';

const mockEq = jest.fn();
const mockUpdate = jest.fn(() => ({ eq: mockEq }));

jest.mock('@/lib/supabaseServer', () => ({
  getAuthenticatedUser: jest.fn(),
  createSupabaseServerAdminClient: jest.fn(() => ({
    from: jest.fn(() => ({
      update: mockUpdate,
    })),
  })),
}));

describe('POST /api/push/unsubscribe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthenticatedUser as jest.Mock).mockResolvedValue({ id: 'user-1' });
    mockEq.mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
  });

  it('returns 400 when endpoint missing', async () => {
    const request = { json: () => Promise.resolve({}), headers: new Headers() } as unknown as Request;
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 200 on unsubscribe', async () => {
    const request = {
      json: () => Promise.resolve({ endpoint: 'https://push.example' }),
      headers: new Headers({ Authorization: 'Bearer token' }),
    } as unknown as Request;
    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
