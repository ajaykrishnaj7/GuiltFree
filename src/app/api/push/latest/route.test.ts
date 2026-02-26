import { POST } from './route';
import { createSupabaseServerAdminClient } from '@/lib/supabaseServer';

const mockSubSingle = jest.fn();
const mockSuggestionSingle = jest.fn();

jest.mock('@/lib/supabaseServer', () => ({
  createSupabaseServerAdminClient: jest.fn(() => ({
    from: jest.fn((table: string) => {
      if (table === 'push_subscriptions') {
        return {
          select: () => ({ eq: () => ({ single: mockSubSingle }) }),
        };
      }
      return {
        select: () => ({ eq: () => ({ eq: () => ({ single: mockSuggestionSingle }) }) }),
      };
    }),
  })),
}));

describe('POST /api/push/latest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubSingle.mockResolvedValue({ data: { user_id: 'user-1' }, error: null });
    mockSuggestionSingle.mockResolvedValue({ data: { title: 'T', message: 'M' }, error: null });
  });

  it('returns 400 when endpoint missing', async () => {
    const request = { json: () => Promise.resolve({}) } as unknown as Request;
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns suggestion when found', async () => {
    const request = { json: () => Promise.resolve({ endpoint: 'https://push.example' }) } as unknown as Request;
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.title).toBe('T');
    expect(createSupabaseServerAdminClient).toHaveBeenCalled();
  });
});
