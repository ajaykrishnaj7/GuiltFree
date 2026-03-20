import { GET } from './route';
import { createSupabaseServerAdminClient, getAuthenticatedUser } from '@/lib/supabaseServer';

const mockMealsLte = jest.fn();
const mockMealsOrder = jest.fn();
const mockItemsIn = jest.fn();
const mealsResult = {
  data: [
    {
      id: 'meal-1',
      created_at: '2026-03-01T12:00:00.000Z',
      name: 'Lunch Bowl',
      type: 'Lunch',
      description: 'notes',
      total_calories: 500,
      total_protein: 35,
      total_fiber: 8,
      total_carbs: 50,
      total_fats: 20,
      total_sugars_total: 12,
    },
  ],
  error: null,
};

jest.mock('@/lib/supabaseServer', () => ({
  getAuthenticatedUser: jest.fn(),
  createSupabaseServerAdminClient: jest.fn(),
}));

describe('GET /api/export/meals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthenticatedUser as jest.Mock).mockResolvedValue({ id: 'user-1' });

    mockMealsLte.mockResolvedValue(mealsResult);

    mockMealsOrder.mockImplementation(() => {
      const base = {
        gte: () => ({
          lte: mockMealsLte,
        }),
        lte: mockMealsLte,
        then: (resolve: (value: typeof mealsResult) => void) => Promise.resolve(resolve(mealsResult)),
      };
      return base;
    });

    mockItemsIn.mockResolvedValue({
      data: [
        {
          meal_id: 'meal-1',
          name: 'rice',
          display_name: 'Rice',
          quantity: 1,
          unit: 'cup',
          calories: 200,
          protein: 4,
          fiber: 1,
          carbs: 44,
          fats_total: 0,
          sugars_total: 0,
          rationale: 'Manual',
        },
      ],
      error: null,
    });

    (createSupabaseServerAdminClient as jest.Mock).mockReturnValue({
      from: (table: string) => {
        if (table === 'meals') {
          return {
            select: () => ({
              eq: () => ({
                order: mockMealsOrder,
              }),
            }),
          };
        }
        return {
          select: () => ({
            in: mockItemsIn,
          }),
        };
      },
    });
  });

  it('exports CSV for month range', async () => {
    const req = new Request('http://localhost/api/export/meals?range=month&tz=America/New_York', {
      headers: { Authorization: 'Bearer token' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');
    expect(res.headers.get('Content-Disposition')).toContain('guiltfree_meals_this-month.csv');
    const text = await res.text();
    expect(text).toContain('meal_created_at');
    expect(text).not.toContain('meal_id,');
    expect(text).not.toContain('item_display_name');
    expect(text).toContain('Lunch Bowl');
    expect(text).toContain('Rice');
    expect(text).toContain('EST');
  });

  it('exports all-time without date bounds', async () => {
    const req = new Request('http://localhost/api/export/meals?range=all', {
      headers: { Authorization: 'Bearer token' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toContain('guiltfree_meals_all-time.csv');
  });

  it('rejects custom range older than 180 days', async () => {
    const req = new Request('http://localhost/api/export/meals?range=custom&from=2020-01-01&to=2020-01-30', {
      headers: { Authorization: 'Bearer token' },
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/180 days/i);
  });

  it('returns 401 when auth token is invalid', async () => {
    (getAuthenticatedUser as jest.Mock).mockRejectedValueOnce(new Error('Invalid auth token'));
    const req = new Request('http://localhost/api/export/meals?range=month', {
      headers: { Authorization: 'Bearer bad-token' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
