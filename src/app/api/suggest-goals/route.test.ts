import { POST } from './route';
import { generateJsonText } from '@/lib/aiClient';
import { getAuthenticatedUser } from '@/lib/supabaseServer';

jest.mock('@/lib/aiClient', () => ({
  generateJsonText: jest.fn(),
}));

const mockSingle = jest.fn();
const mockUpsert = jest.fn();
const mockEqSecond = jest.fn(() => ({ single: mockSingle }));
const mockEqFirst = jest.fn(() => ({ eq: mockEqSecond }));
const mockSelect = jest.fn(() => ({ eq: mockEqFirst }));

jest.mock('@/lib/supabaseServer', () => ({
  getAuthenticatedUser: jest.fn(),
  createSupabaseServerAdminClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: mockSelect,
      upsert: mockUpsert,
    })),
  })),
}));

describe('POST /api/suggest-goals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthenticatedUser as jest.Mock).mockResolvedValue({ id: 'user-1' });
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
    mockUpsert.mockResolvedValue({ error: null });
  });

  it('returns 400 when profile is missing', async () => {
    const request = { json: () => Promise.resolve({}) } as unknown as Request;
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 429 when daily limit reached', async () => {
    mockSingle.mockResolvedValueOnce({ data: { request_count: 5 }, error: null });

    const request = {
      json: () => Promise.resolve({ profile: { age: '30' } }),
      headers: new Headers({ Authorization: 'Bearer token' }),
    } as unknown as Request;

    const response = await POST(request);
    expect(response.status).toBe(429);
  });

  it('returns numeric goal suggestions on success', async () => {
    (generateJsonText as jest.Mock).mockResolvedValueOnce(JSON.stringify({
      daily_calorie_goal: 2200,
      daily_protein_goal_g: 160,
      daily_carbs_goal_g: 240,
      daily_fats_goal_g: 70,
      daily_fiber_goal_g: 35,
      daily_sugars_total_goal_g: 45,
    }));

    const request = {
      json: () => Promise.resolve({ profile: { age: '30', weightKg: '70', heightCm: '175' } }),
      headers: new Headers({ Authorization: 'Bearer token' }),
    } as unknown as Request;

    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.daily_calorie_goal).toBe(2200);
    expect(data.daily_protein_goal_g).toBe(160);
    expect(data.remaining).toBe(4);
  });

  it('returns 500 when AI call fails', async () => {
    (generateJsonText as jest.Mock).mockRejectedValueOnce(new Error('AI failure'));

    const request = {
      json: () => Promise.resolve({ profile: { age: '30' } }),
      headers: new Headers({ Authorization: 'Bearer token' }),
    } as unknown as Request;

    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});
