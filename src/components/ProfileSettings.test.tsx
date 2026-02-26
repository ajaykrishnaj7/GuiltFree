import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ProfileSettings from './ProfileSettings';

let mockUser: any = { id: 'user-1', email: 'test@test.com' };
jest.mock('./AuthProvider', () => ({
  useAuth: () => ({
    user: mockUser,
    signOut: jest.fn(),
    loading: false,
  }),
}));

const mockSelect = jest.fn();
const mockUpdate = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: { request_count: 0 }, error: { code: 'PGRST116' } }),
          }),
          single: () => {
            mockSelect();
            return Promise.resolve({
              data: {
                daily_calorie_goal: 2200,
                daily_protein_goal_g: 160,
                daily_carbs_goal_g: 250,
                daily_fats_goal_g: 70,
                daily_fiber_goal_g: 35,
                daily_sugars_total_goal_g: 45,
              },
            });
          },
        }),
      }),
      update: (data: any) => ({
        eq: () => {
          mockUpdate(data);
          return Promise.resolve({ error: null });
        },
      }),
    }),
  },
}));

describe('ProfileSettings', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: 'user-1', email: 'test@test.com' };
    window.alert = jest.fn();
    window.localStorage.clear();
  });

  it('returns null when not open', () => {
    const { container } = render(<ProfileSettings isOpen={false} onClose={mockOnClose} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders goals form when open', async () => {
    render(<ProfileSettings isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => {
      expect(screen.getByText('Your Goals')).toBeInTheDocument();
    });
  });

  it('loads and displays goal values from supabase', async () => {
    render(<ProfileSettings isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('2200')).toBeInTheDocument();
      expect(screen.getByDisplayValue('160')).toBeInTheDocument();
    });
  });

  it('allows editing calorie goal', async () => {
    render(<ProfileSettings isOpen={true} onClose={mockOnClose} />);
    const calorieInput = await screen.findByDisplayValue('2200');
    
    fireEvent.change(calorieInput, { target: { value: '2500' } });
    expect(screen.getByDisplayValue('2500')).toBeInTheDocument();
  });

  it('saves goals and shows alert', async () => {
    render(<ProfileSettings isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByDisplayValue('2200'));
    
    fireEvent.click(screen.getByText('Save Goals'));
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalled();
      expect(window.alert).toHaveBeenCalledWith('Goals updated!');
    });
  });

  it('renders as page mode without close button', async () => {
    render(<ProfileSettings isOpen={true} onClose={mockOnClose} isPage={true} />);
    await waitFor(() => {
      expect(screen.getByText('Your Goals')).toBeInTheDocument();
    });
  });

  it('renders macro goal labels', async () => {
    render(<ProfileSettings isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('Your Goals'));
    expect(screen.getByText('Protein (g)')).toBeInTheDocument();
    expect(screen.getByText('Carbs (g)')).toBeInTheDocument();
    expect(screen.getByText('Fats (g)')).toBeInTheDocument();
    expect(screen.getByText('Fiber (g)')).toBeInTheDocument();
    expect(screen.getByText('Sugars (g)')).toBeInTheDocument();
  });

  it('restores unsaved draft values from localStorage', async () => {
    window.localStorage.setItem('guiltfree.profile-goals-draft.user-1', JSON.stringify({
      goals: {
        daily_calorie_goal: 1999,
        daily_protein_goal_g: 140,
        daily_carbs_goal_g: 210,
        daily_fats_goal_g: 60,
        daily_fiber_goal_g: 28,
        daily_sugars_total_goal_g: 44,
        goal_focus: 'fat_loss_general',
      },
      goalSuggestionForm: {
        age: '30',
        heightCm: '',
        weightKg: '',
        country: '',
        sex: '',
        activityLevel: 'moderate',
        goalIntent: 'maintain_weight',
        mealsPerDay: '3',
      },
    }));

    render(<ProfileSettings isOpen={true} onClose={mockOnClose} />);
    expect(await screen.findByDisplayValue('1999')).toBeInTheDocument();
  });
});
