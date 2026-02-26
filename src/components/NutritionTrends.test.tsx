import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NutritionTrends from './NutritionTrends';

let mockUser: any = { id: 'user-1' };
let mockSession: any = { access_token: 'token-123' };
let mockAuthLoading = false;
let mockMealsData: any[] = [];
let mockProfileData: any = null;
let mockLatestSuggestion: any = null;

jest.mock('./AuthProvider', () => ({
  useAuth: () => ({ user: mockUser, session: mockSession, loading: mockAuthLoading }),
}));

jest.mock('@/lib/aiSettings', () => ({
  loadAISettings: jest.fn(() => ({ useUserKey: false, provider: 'gemini', model: 'gemini-1.5-flash', apiKey: '' })),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'meals') {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                order: () => Promise.resolve({ data: mockMealsData }),
              }),
            }),
          }),
        };
      }

      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: mockProfileData }),
            }),
          }),
        };
      }

      if (table === 'daily_goal_suggestions') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: mockLatestSuggestion ? [mockLatestSuggestion] : [] }),
              }),
            }),
          }),
        };
      }

      return {
        select: () => ({
          eq: () => ({
            gte: () => ({
              order: () => Promise.resolve({ data: [] }),
            }),
          }),
        }),
      };
    },
  },
}));

const todayIso = new Date().toISOString();
const yesterdayIso = new Date(Date.now() - 86400000).toISOString();

const defaultMeals = [
  {
    id: 'm1',
    name: 'Breakfast Bowl',
    type: 'Breakfast',
    created_at: todayIso,
    total_calories: 520,
    total_protein: 35,
    total_fiber: 8,
    total_carbs: 55,
    total_fats: 18,
    total_sugars_total: 11,
  },
  {
    id: 'm2',
    name: 'Lunch Plate',
    type: 'Lunch',
    created_at: yesterdayIso,
    total_calories: 640,
    total_protein: 44,
    total_fiber: 7,
    total_carbs: 70,
    total_fats: 22,
    total_sugars_total: 10,
  },
];

const defaultProfile = {
  daily_calorie_goal: 2000,
  daily_protein_goal_g: 150,
  daily_carbs_goal_g: 220,
  daily_fats_goal_g: 70,
  daily_fiber_goal_g: 30,
  daily_sugars_total_goal_g: 45,
  goal_focus: 'fat_loss',
};

describe('NutritionTrends', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    window.localStorage.clear();
    mockUser = { id: 'user-1' };
    mockSession = { access_token: 'token-123' };
    mockAuthLoading = false;
    mockMealsData = [...defaultMeals];
    mockProfileData = { ...defaultProfile };
    mockLatestSuggestion = null;

    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: {
        permission: 'default',
        requestPermission: jest.fn().mockResolvedValue('denied'),
      },
    });

    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: {
        register: jest.fn(),
        ready: Promise.resolve({
          pushManager: { getSubscription: jest.fn().mockResolvedValue(null) },
        }),
      },
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ title: 'Great work', message: 'Keep going' }),
    }) as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('renders summary cards and timeline data', async () => {
    render(<NutritionTrends />);

    expect(await screen.findByText('Weekly Average')).toBeInTheDocument();
    expect(screen.getByText('Monthly Average')).toBeInTheDocument();
    expect(screen.getByText('Timeline')).toBeInTheDocument();
    expect(screen.getByText('Meals Breakdown')).toBeInTheDocument();
  });

  it('supports switching timeframe and selected date detail', async () => {
    render(<NutritionTrends />);

    await screen.findByText('Timeline');
    fireEvent.click(screen.getByRole('button', { name: '30D' }));

    await waitFor(() => {
      expect(screen.getAllByText(/Goal Reach:/i).length).toBeGreaterThan(0);
    });
  });

  it('generates AI suggestion and displays fallback notice details', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: 'Fiber needs attention',
        message: 'Add more veggies tomorrow.',
        source: 'fallback',
        details: 'quota exceeded',
        next_available_at: new Date(Date.now() + 60000).toISOString(),
        action_plan: ['Add a salad'],
        foods_to_add: ['spinach'],
        foods_to_limit: ['desserts'],
      }),
    }) as unknown as typeof fetch;

    render(<NutritionTrends />);

    const generateButton = await screen.findByRole('button', { name: 'Generate' });
    fireEvent.click(generateButton);

    expect(await screen.findByText('Fiber needs attention')).toBeInTheDocument();
    expect(screen.getByText(/Using local fallback suggestion/i)).toBeInTheDocument();
    expect(screen.getByText('Add a salad')).toBeInTheDocument();
    expect(screen.getByText(/spinach/i)).toBeInTheDocument();
  });

  it('shows server suggestion error notice when day suggestion API fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Service unavailable' }),
    }) as unknown as typeof fetch;

    render(<NutritionTrends />);

    const generateButton = await screen.findByRole('button', { name: 'Generate' });
    fireEvent.click(generateButton);

    expect(await screen.findByText('Service unavailable')).toBeInTheDocument();
  });

  it('allows generating suggestion for selected (non-today) detail date', async () => {
    mockMealsData = [
      {
        ...defaultMeals[1],
        created_at: yesterdayIso,
      },
    ];

    render(<NutritionTrends />);

    expect(await screen.findByText('No suggestion yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate' })).toBeEnabled();
  });

  it('handles push toggle click when push is unsupported', async () => {
    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: undefined,
    });

    render(<NutritionTrends />);

    const pushButton = await screen.findByRole('button', { name: 'Enable Push' });
    fireEvent.click(pushButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Enable Push' })).toBeInTheDocument();
    });
  });

  it('shows anonymous trends preview instead of spinner when logged out', async () => {
    mockUser = null;
    mockSession = null;
    mockAuthLoading = false;

    render(<NutritionTrends />);

    expect(await screen.findByText('Your trends dashboard is waiting')).toBeInTheDocument();
    expect(screen.getByText(/Sign in to unlock weekly and monthly macro averages/i)).toBeInTheDocument();
    expect(screen.queryByText('Generating...')).not.toBeInTheDocument();
  });
});
