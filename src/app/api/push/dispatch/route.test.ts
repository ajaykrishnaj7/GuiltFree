import { POST } from './route';
import { getAuthenticatedUser } from '@/lib/supabaseServer';
import { generateJsonText } from '@/lib/aiClient';
import { sendVapidPush } from '@/lib/webPush';

const mockMealsSelect = jest.fn();
const mockProfileSingle = jest.fn();
const mockSuggestionUpsert = jest.fn();
const mockSubsSelect = jest.fn();
const mockInvalidUpdateIn = jest.fn();

jest.mock('@/lib/supabaseServer', () => ({
  getAuthenticatedUser: jest.fn(),
  createSupabaseServerAdminClient: jest.fn(() => ({
    from: jest.fn((table: string) => {
      if (table === 'meals') {
        return { select: () => ({ eq: () => ({ gte: () => ({ lte: mockMealsSelect }) }) }) };
      }
      if (table === 'profiles') {
        return { select: () => ({ eq: () => ({ single: mockProfileSingle }) }) };
      }
      if (table === 'daily_goal_suggestions') {
        return { upsert: mockSuggestionUpsert };
      }
      return {
        select: () => ({ eq: () => ({ eq: mockSubsSelect }) }),
        update: () => ({ in: mockInvalidUpdateIn }),
      };
    }),
  })),
}));

jest.mock('@/lib/aiClient', () => ({
  generateJsonText: jest.fn(),
}));

jest.mock('@/lib/webPush', () => ({
  sendVapidPush: jest.fn(),
}));

describe('POST /api/push/dispatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthenticatedUser as jest.Mock).mockResolvedValue({ id: 'user-1' });
    mockMealsSelect.mockResolvedValue({ data: [{ total_calories: 500, total_protein: 30, total_carbs: 40, total_fats: 10, total_fiber: 5, total_sugars_total: 4 }] });
    mockProfileSingle.mockResolvedValue({ data: { daily_calorie_goal: 2000, daily_protein_goal_g: 150, daily_carbs_goal_g: 225, daily_fats_goal_g: 65, daily_fiber_goal_g: 30, daily_sugars_total_goal_g: 50 } });
    mockSuggestionUpsert.mockResolvedValue({ error: null });
    mockSubsSelect.mockResolvedValue({ data: [{ endpoint: 'https://push.example' }] });
    (generateJsonText as jest.Mock).mockResolvedValue(JSON.stringify({ title: 'Nice work', message: 'Keep protein consistent.' }));
    (sendVapidPush as jest.Mock).mockResolvedValue({ status: 201 });
    mockInvalidUpdateIn.mockResolvedValue({ error: null });
  });

  it('dispatches push and returns suggestion', async () => {
    const request = {
      json: () => Promise.resolve({}),
      headers: new Headers({ Authorization: 'Bearer token' }),
    } as unknown as Request;
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.title).toBe('Nice work');
    expect(sendVapidPush).toHaveBeenCalled();
  });
});
