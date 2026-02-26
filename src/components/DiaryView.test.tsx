import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import DiaryView from './DiaryView';
import { useAuth } from './AuthProvider';
import { supabase } from '@/lib/supabase';

// Mock Supabase with a fresh chain for every call
const createMockChain = (data: any = [], error: any = null) => {
  const filters: { gte?: string; lte?: string; lt?: string } = {};
  const applyDateFilters = (rows: any[]) => {
    return rows.filter((row) => {
      if (!row?.created_at) return true;
      const value = row.created_at;
      if (filters.gte && value < filters.gte) return false;
      if (filters.lte && value > filters.lte) return false;
      if (filters.lt && value >= filters.lt) return false;
      return true;
    });
  };
  const getFilteredData = () => {
    if (!Array.isArray(data)) return data;
    return applyDateFilters(data);
  };

  const chain: any = {
    select: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn((field: string, value: string) => {
      if (field === 'created_at') filters.gte = value;
      return chain;
    }),
    lte: jest.fn((field: string, value: string) => {
      if (field === 'created_at') filters.lte = value;
      return chain;
    }),
    lt: jest.fn((field: string, value: string) => {
      if (field === 'created_at') filters.lt = value;
      return chain;
    }),
    range: jest.fn((from: number, to: number) =>
      Promise.resolve({
        data: Array.isArray(getFilteredData()) ? getFilteredData().slice(from, to + 1) : getFilteredData(),
        error,
        count: Array.isArray(getFilteredData()) ? getFilteredData().length : 0
      })
    ),
    single: jest.fn().mockResolvedValue({
      data: Array.isArray(getFilteredData()) ? getFilteredData()[0] : getFilteredData(),
      error
    }),
    delete: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
  };
  chain.then = (resolve: any) =>
    Promise.resolve({
      data: getFilteredData(),
      error,
      count: Array.isArray(getFilteredData()) ? getFilteredData().length : 0
    }).then(resolve);
  return chain;
};

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

// Mock components
jest.mock('./EditMealModal', () => (props: any) => (
  <div data-testid="edit-meal-modal">
    Edit Meal Modal
    <button onClick={props.onSave}>mock-save</button>
    <button onClick={props.onClose}>mock-close</button>
  </div>
));
jest.mock('./ThemeToggle', () => () => <button>Toggle Theme</button>);

describe('DiaryView', () => {
  const now = new Date();
  
  const mockMeals = [
    { 
      id: 'm1', 
      created_at: now.toISOString(), 
      total_calories: 500, 
      total_protein: 30,
      total_carbs: 50,
      total_fats: 20,
      total_fiber: 10,
      total_sugars_total: 5,
      name: 'Lunch', 
      type: 'Lunch' 
    },
  ];
  const mockProfile = { 
    daily_calorie_goal: 2000,
    daily_protein_goal_g: 150,
    daily_carbs_goal_g: 200,
    daily_fats_goal_g: 70,
    daily_fiber_goal_g: 30,
    daily_sugars_total_goal_g: 50
  };
  const mockItems = [
    { id: 'item-1', name: 'Chicken', calories: 300, protein: 30, carbs: 0, fats_total: 10 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user-1' },
      loading: false,
    });
    window.confirm = jest.fn().mockReturnValue(true);
    window.alert = jest.fn();
    
    // Setup Supabase from() mock
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'meals') return createMockChain(mockMeals);
      if (table === 'profiles') return createMockChain(mockProfile);
      if (table === 'meal_items') return createMockChain(mockItems);
      return createMockChain();
    });
  });

  it('renders loading state when auth is loading', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user-1' },
      loading: true,
    });
    render(<DiaryView />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders auth prompt when not logged in', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: false,
    });
    render(<DiaryView />);
    expect(await screen.findByRole('heading', { name: /Your Diary is waiting/i })).toBeInTheDocument();
  });

  it('renders "No logs yet" when meals list is empty', async () => {
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'meals') return createMockChain([]);
      return createMockChain(mockProfile);
    });
    render(<DiaryView />);
    expect(await screen.findByText('No logs yet')).toBeInTheDocument();
  });

  it('renders meals when logged in', async () => {
    render(<DiaryView />);
    expect(await screen.findByRole('heading', { name: 'Lunch' })).toBeInTheDocument();
    // Use getAllByText because 500 appears in both summary and card
    const calories = await screen.findAllByText('500');
    expect(calories.length).toBeGreaterThanOrEqual(1);
  });

  it('fetches meal details on click', async () => {
    render(<DiaryView />);
    const mealCard = await screen.findByRole('heading', { name: 'Lunch' });
    fireEvent.click(mealCard);
    expect(await screen.findByText('Chicken')).toBeInTheDocument();
  });

  it('handles meal deletion', async () => {
    jest.useFakeTimers();
    const mealChain = createMockChain(mockMeals);
    (supabase.from as jest.Mock).mockReturnValue(mealChain);
    
    render(<DiaryView />);
    await screen.findByRole('heading', { name: 'Lunch' });
    
    const deleteBtn = document.querySelector('button .lucide-trash2')?.parentElement;
    if (deleteBtn) {
      fireEvent.click(deleteBtn);
      expect(mealChain.delete).not.toHaveBeenCalled();
      jest.advanceTimersByTime(30000);
      await waitFor(() => {
        expect(mealChain.delete).toHaveBeenCalled();
      });
    }
    jest.useRealTimers();
  });

  it('calculates totals for today correctly', async () => {
    const specificMeals = [
      { id: 'm1', created_at: now.toISOString(), total_calories: 200, total_protein: 10, total_carbs: 20, total_fats: 5, total_fiber: 2, total_sugars_total: 1, name: 'Breakfast', type: 'Breakfast' },
      { id: 'm2', created_at: now.toISOString(), total_calories: 300, total_protein: 20, total_carbs: 30, total_fats: 10, total_fiber: 3, total_sugars_total: 2, name: 'Lunch', type: 'Lunch' },
      { id: 'm3', created_at: '2020-01-01T00:00:00', total_calories: 1000, total_protein: 50, total_carbs: 100, total_fats: 40, name: 'Old Meal', type: 'Dinner' },
    ];
    
    (supabase.from as jest.Mock).mockImplementation((table) => {
      if (table === 'meals') return createMockChain(specificMeals);
      return createMockChain(mockProfile);
    });
    
    render(<DiaryView />);
    await screen.findByRole('heading', { name: 'Breakfast' });
    const totalCalories = await screen.findAllByText('500');
    expect(totalCalories.length).toBeGreaterThanOrEqual(1);
  });

  it('handles meal-saved event', async () => {
    render(<DiaryView />);
    await screen.findByRole('heading', { name: 'Lunch' });
    
    // Dispatch event
    fireEvent(window, new Event('meal-saved'));
    
    await waitFor(() => {
      // It should have called from('meals') again
      expect(supabase.from).toHaveBeenCalledWith('meals');
    });
  });

  it('supports undo delete within 30 seconds', async () => {
    jest.useFakeTimers();
    const mealChain = createMockChain(mockMeals);
    (supabase.from as jest.Mock).mockReturnValue(mealChain);

    render(<DiaryView />);
    await screen.findByRole('heading', { name: 'Lunch' });

    const deleteBtn = screen.getByTitle('Delete meal');
    fireEvent.click(deleteBtn);

    expect(await screen.findByText(/Undo in 30s/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Undo'));

    act(() => {
      jest.advanceTimersByTime(30000);
    });

    expect(mealChain.delete).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('shows pagination with first and last page controls', async () => {
    const manyMeals = Array.from({ length: 15 }, (_, i) => ({
      id: `m-${i + 1}`,
      created_at: new Date(Date.now() - i * 60_000).toISOString(),
      total_calories: 200 + i,
      total_protein: 10,
      total_carbs: 20,
      total_fats: 5,
      total_fiber: 2,
      total_sugars_total: 1,
      name: `Meal ${i + 1}`,
      type: 'Lunch'
    }));

    (supabase.from as jest.Mock).mockImplementation((table) => {
      if (table === 'meals') return createMockChain(manyMeals);
      if (table === 'profiles') return createMockChain(mockProfile);
      if (table === 'meal_items') return createMockChain(mockItems);
      return createMockChain([]);
    });

    render(<DiaryView />);
    await screen.findByText('Meal 1');

    expect(screen.getByText('1/2')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Last page'));
    await screen.findByText('2/2');
    fireEvent.click(screen.getByLabelText('First page'));
    await screen.findByText('1/2');
  });

  it('resets to first page when page size changes', async () => {
    const manyMeals = Array.from({ length: 25 }, (_, i) => ({
      id: `pm-${i + 1}`,
      created_at: new Date(Date.now() - i * 60_000).toISOString(),
      total_calories: 150,
      total_protein: 10,
      total_carbs: 20,
      total_fats: 5,
      total_fiber: 1,
      total_sugars_total: 1,
      name: `Page Meal ${i + 1}`,
      type: 'Dinner'
    }));

    (supabase.from as jest.Mock).mockImplementation((table) => {
      if (table === 'meals') return createMockChain(manyMeals);
      if (table === 'profiles') return createMockChain(mockProfile);
      if (table === 'meal_items') return createMockChain(mockItems);
      return createMockChain([]);
    });

    render(<DiaryView />);
    await screen.findByText('Page Meal 1');

    fireEvent.click(screen.getByLabelText('Next page'));
    await screen.findByText('2/3');

    const perPageSelect = document.querySelector('select') as HTMLSelectElement;
    fireEvent.change(perPageSelect, { target: { value: '50' } });
    await screen.findByText('1/1');
  });

  it('clamps date filters and keeps from <= to', async () => {
    render(<DiaryView />);
    await screen.findByRole('heading', { name: 'Lunch' });

    const dateInputs = document.querySelectorAll('input[type="date"]');
    const fromInput = dateInputs[0] as HTMLInputElement;
    const toInput = dateInputs[1] as HTMLInputElement;

    fireEvent.change(fromInput, { target: { value: '1900-01-01' } });
    await waitFor(() => {
      expect(fromInput.value).toBe(fromInput.min);
    });

    fireEvent.change(toInput, { target: { value: '1900-01-01' } });
    expect(toInput.value).toBe('1900-01-01');

    fireEvent.click(await screen.findByText('7D'));
    await waitFor(() => {
      expect(screen.getByText(/Filter supports only the last 180 days/i)).toBeInTheDocument();
    });
  });

  it('shows spinner while meal details are loading and supports edit-save callback', async () => {
    const deferred: any = {};
    const pendingPromise = new Promise((resolve) => {
      deferred.resolve = resolve;
    });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'meals') return createMockChain(mockMeals);
      if (table === 'profiles') return createMockChain(mockProfile);
      if (table === 'meal_items') {
        const chain: any = createMockChain(mockItems);
        chain.eq = jest.fn(() => pendingPromise);
        return chain;
      }
      return createMockChain([]);
    });

    render(<DiaryView />);
    const mealCard = await screen.findByRole('heading', { name: 'Lunch' });
    fireEvent.click(mealCard);

    expect(document.querySelector('.animate-spin')).toBeInTheDocument();

    await act(async () => {
      deferred.resolve({ data: mockItems, error: null });
    });

    await screen.findByText('Chicken');
    fireEvent.click(screen.getByTitle('Edit meal'));
    expect(screen.getByTestId('edit-meal-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('mock-save'));
    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('meals');
      expect(supabase.from).toHaveBeenCalledWith('meal_items');
    });
  });

  it('handles delete failure and restores removed meal', async () => {
    jest.useFakeTimers();
    const mealChain: any = createMockChain(mockMeals);
    mealChain.delete = jest.fn().mockReturnThis();
    mealChain.eq = jest.fn().mockResolvedValueOnce({ error: { message: 'Delete failed' } });
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'meals') return mealChain;
      if (table === 'profiles') return createMockChain(mockProfile);
      if (table === 'meal_items') return createMockChain(mockItems);
      return createMockChain([]);
    });

    render(<DiaryView />);
    await screen.findByRole('heading', { name: 'Lunch' });
    fireEvent.click(screen.getByTitle('Delete meal'));

    act(() => {
      jest.advanceTimersByTime(30000);
    });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Delete failed'));
      expect(screen.getByRole('heading', { name: 'Lunch' })).toBeInTheDocument();
    });
    jest.useRealTimers();
  });
});
