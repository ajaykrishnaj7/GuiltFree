import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ProfileSettings from './ProfileSettings';

let mockUser: any = { id: 'user-1', email: 'test@test.com' };
const mockUseAuth = jest.fn(() => ({
  user: mockUser,
  signOut: jest.fn(),
  loading: false,
}));

const mockProfileUpdate = jest.fn();
const mockMeasurementInsert = jest.fn();
const mockMeasurementUpdate = jest.fn();
const mockSessionGetter = jest.fn();
const today = new Date().toISOString().split('T')[0];

const dbState: {
  profile: any;
  usage: { data: any; error: any };
  measurements: any[];
} = {
  profile: {
    daily_calorie_goal: 2200,
    daily_protein_goal_g: 160,
    daily_carbs_goal_g: 250,
    daily_fats_goal_g: 70,
    daily_fiber_goal_g: 35,
    daily_sugars_total_goal_g: 45,
    goal_focus: 'fat_loss_general',
  },
  usage: { data: { request_count: 0 }, error: null },
  measurements: [],
};

jest.mock('./AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/lib/aiSettings', () => ({
  loadAISettings: jest.fn(() => ({ useUserKey: false, provider: 'gemini', model: 'gemini-1.5-flash', apiKey: '' })),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockSessionGetter(),
    },
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: dbState.profile }),
            }),
          }),
          update: (data: any) => ({
            eq: () => {
              mockProfileUpdate(data);
              return Promise.resolve({ error: null });
            },
          }),
        };
      }

      if (table === 'goal_suggestion_usage') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve(dbState.usage),
              }),
            }),
          }),
        };
      }

      if (table === 'goal_measurements') {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                order: () => Promise.resolve({ data: dbState.measurements, error: null }),
              }),
            }),
          }),
          update: (data: any) => ({
            eq: () => {
              mockMeasurementUpdate(data);
              return Promise.resolve({ error: null });
            },
          }),
          insert: (data: any) => {
            mockMeasurementInsert(data);
            return Promise.resolve({ error: null });
          },
        };
      }

      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      };
    },
  },
}));

describe('ProfileSettings', () => {
  const mockOnClose = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    mockUser = { id: 'user-1', email: 'test@test.com' };
    dbState.profile = {
      daily_calorie_goal: 2200,
      daily_protein_goal_g: 160,
      daily_carbs_goal_g: 250,
      daily_fats_goal_g: 70,
      daily_fiber_goal_g: 35,
      daily_sugars_total_goal_g: 45,
      goal_focus: 'fat_loss_general',
    };
    dbState.usage = { data: { request_count: 0 }, error: null };
    dbState.measurements = [];
    mockSessionGetter.mockResolvedValue({ data: { session: { access_token: 'token-123' } } });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        daily_calorie_goal: 2000,
        daily_protein_goal_g: 150,
        daily_carbs_goal_g: 220,
        daily_fats_goal_g: 60,
        daily_fiber_goal_g: 30,
        rationale: 'Balanced recommendation',
        remaining: 4,
      }),
    }) as unknown as typeof fetch;
    window.alert = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('returns null when closed and not in page mode', () => {
    const { container } = render(<ProfileSettings isOpen={false} onClose={mockOnClose} />);
    expect(container.firstChild).toBeNull();
  });

  it('loads and saves macro targets', async () => {
    render(<ProfileSettings isOpen onClose={mockOnClose} />);
    expect(await screen.findByDisplayValue('2200')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Save Targets'));
    await waitFor(() => {
      expect(mockProfileUpdate).toHaveBeenCalled();
      expect(window.alert).toHaveBeenCalledWith('Macro targets saved successfully!');
    });
  });

  it('prompts sign-in and stores pending goals when saving while logged out', async () => {
    mockUser = null;
    const openAuthSpy = jest.fn();
    window.addEventListener('open-auth-modal', openAuthSpy as EventListener);

    render(<ProfileSettings isOpen onClose={mockOnClose} />);
    fireEvent.click(await screen.findByText('Save Targets'));

    expect(window.localStorage.getItem('guiltfree.pending-goals')).toBeTruthy();
    expect(window.alert).toHaveBeenCalledWith('Please sign in to save goals.');
    window.removeEventListener('open-auth-modal', openAuthSpy as EventListener);
  });

  it('generates AI suggestions and applies them', async () => {
    render(<ProfileSettings isOpen onClose={mockOnClose} />);
    fireEvent.click(await screen.findByText('2. AI Coach'));
    fireEvent.click(screen.getByRole('button', { name: /Generate Plan/i }));

    expect(await screen.findByText(/Balanced recommendation/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Accept & Save/i }));

    await waitFor(() => {
      expect(screen.getByText('1. Targets')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2000')).toBeInTheDocument();
    });
  });

  it('disables AI generation when limit is reached', async () => {
    dbState.usage = { data: { request_count: 5 }, error: null };
    render(<ProfileSettings isOpen onClose={mockOnClose} />);
    fireEvent.click(await screen.findByText('2. AI Coach'));
    const generateButton = screen.getByRole('button', { name: /Generate Plan/i });
    expect(generateButton).toBeDisabled();
    expect(screen.getByText('0/5 Left')).toBeInTheDocument();
  });

  it('shows auth error when AI generation has no access token', async () => {
    mockSessionGetter.mockResolvedValue({ data: { session: null } });
    render(<ProfileSettings isOpen onClose={mockOnClose} />);
    fireEvent.click(await screen.findByText('2. AI Coach'));
    fireEvent.click(screen.getByRole('button', { name: /Generate Plan/i }));
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Please sign in again to use goal suggestions.');
    });
  });

  it('logs new tracker measurement', async () => {
    render(<ProfileSettings isOpen onClose={mockOnClose} />);
    fireEvent.click(await screen.findByText('3. Progress Tracker'));
    const input = await screen.findByPlaceholderText("Today's Body Weight");
    fireEvent.change(input, { target: { value: '81.2' } });
    const metricSection = input.closest('.border-b') as HTMLElement;
    fireEvent.click(within(metricSection).getByRole('button', { name: 'Log' }));

    await waitFor(() => {
      expect(mockMeasurementInsert).toHaveBeenCalled();
      expect(window.alert).toHaveBeenCalledWith('Measurement logged successfully!');
    });
  });

  it('updates existing tracker measurement for today', async () => {
    dbState.measurements = [
      { id: 'm1', metric_type: 'weight', date: today, value: 82, unit: 'lbs' },
      { id: 'm2', metric_type: 'weight', date: '2026-01-01', value: 85, unit: 'lbs' },
    ];
    render(<ProfileSettings isOpen onClose={mockOnClose} />);
    fireEvent.click(await screen.findByText('3. Progress Tracker'));
    const input = await screen.findByPlaceholderText("Today's Body Weight");
    fireEvent.change(input, { target: { value: '80.5' } });
    const metricSection = input.closest('.border-b') as HTMLElement;
    fireEvent.click(within(metricSection).getByRole('button', { name: 'Log' }));

    await waitFor(() => {
      expect(mockMeasurementUpdate).toHaveBeenCalled();
      expect(window.alert).toHaveBeenCalledWith('Measurement logged successfully!');
    });
  });

  it('supports AI discard and retry actions', async () => {
    render(<ProfileSettings isOpen onClose={mockOnClose} />);
    fireEvent.click(await screen.findByText('2. AI Coach'));
    fireEvent.click(screen.getByRole('button', { name: /Generate Plan/i }));
    expect(await screen.findByText(/Balanced recommendation/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Discard/i }));
    expect(await screen.findByRole('button', { name: /Generate Plan/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Generate Plan/i }));
    expect(await screen.findByText(/Balanced recommendation/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Retry Suggestion/i }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('closes modal when backdrop is clicked', async () => {
    const { container } = render(<ProfileSettings isOpen onClose={mockOnClose} />);
    await screen.findByText('Your Goals');
    const backdrop = container.querySelector('.bg-zinc-950\\/40');
    expect(backdrop).toBeTruthy();
    if (backdrop) fireEvent.click(backdrop);
    expect(mockOnClose).toHaveBeenCalled();
  });
});
