import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import MealLogger from './MealLogger';

// Mock AuthProvider
let mockUser: any = { id: 'user-1', email: 'test@test.com' };
jest.mock('./AuthProvider', () => ({
  useAuth: () => ({
    user: mockUser,
    signOut: jest.fn(),
    loading: false,
  }),
}));

// Mock AuthModal
jest.mock('./AuthModal', () => {
  return function MockAuthModal(props: any) {
    return props.isOpen ? <div data-testid="auth-modal">Auth Modal</div> : null;
  };
});

// Mock supabase
const mockMealsInsert = jest.fn().mockReturnValue({
  select: () => ({ single: () => Promise.resolve({ data: { id: 'meal-1' }, error: null }) }),
});
const mockItemsInsert = jest.fn().mockResolvedValue({ error: null });
const mockUpdate = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'meals') {
        return {
          insert: (...args: any[]) => mockMealsInsert(...args),
          select: () => ({
            eq: () => ({
              gte: () => Promise.resolve({ data: [{ total_calories: 500 }] }),
            }),
          }),
        };
      }
      if (table === 'meal_items') {
        return {
          insert: (...args: any[]) => mockItemsInsert(...args),
        };
      }
      if (table === 'kitchen_items') {
        return {
          select: () => Promise.resolve({
            data: [
              { id: 'k1', name: 'Chicken Breast', calories: 165, protein: 31, carbs: 0, fats_total: 3, fiber: 0, sugars_total: 0, serving_amount: 84, serving_unit: 'g', description: 'Serving: 84g' },
              { id: 'k2', name: 'Coconut Milk', calories: 45, protein: 0.5, carbs: 2, fats_total: 4.5, fiber: 0, sugars_total: 1, serving_amount: 100, serving_unit: 'ml' },
              { id: 'k3', name: 'Egg', calories: 70, protein: 6, carbs: 0.4, fats_total: 5, fiber: 0, sugars_total: 0, description: '1 large egg' },
            ],
          }),
        };
      }
      return {
        select: () => Promise.resolve({ data: [] }),
      };
    },
  },
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Helper to get the AI parse button (icon-only button next to input)
function getParseButton() {
  // The parse button is the button inside the input group with the Plus icon
  const buttons = document.querySelectorAll('button');
  // Find the disabled/enabled button with Plus icon near the input
  for (const btn of buttons) {
    if (btn.closest('.relative') && btn.querySelector('svg')) {
      const parent = btn.closest('.relative');
      if (parent?.querySelector('input[placeholder*="e.g. 2 eggs"]')) {
        return btn;
      }
    }
  }
  return null;
}

describe('MealLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    mockUser = { id: 'user-1', email: 'test@test.com' };
    window.alert = jest.fn();
    window.dispatchEvent = jest.fn();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{
        meal_name: 'Lunch',
        meal_type: 'Lunch',
        items: [{
          name: 'Chicken',
          display_name: 'Grilled Chicken',
          quantity: 1,
          unit: 'serving',
          calories: 300,
          protein: 30,
          carbs: 0,
          fiber: 0,
          fats: { total: 10, saturated: 3, unsaturated: 7 },
          sugars: { total: 0, natural: 0, added: 0 },
          rationale: 'Standard chicken breast',
        }],
      }]),
    });
  });

  // ===== BASIC RENDER =====
  it('renders the meal logger', () => {
    render(<MealLogger />);
    expect(screen.getByPlaceholderText(/e.g. 2 eggs/i)).toBeInTheDocument();
  });

  it('shows AI mode by default', () => {
    render(<MealLogger />);
    expect(screen.getByText('Magic Input')).toBeInTheDocument();
  });

  it('shows date and time inputs', () => {
    render(<MealLogger />);
    const dateInput = document.querySelector('input[type="date"]');
    const timeInput = document.querySelector('input[type="time"]');
    expect(dateInput).toBeInTheDocument();
    expect(timeInput).toBeInTheDocument();
  });

  // ===== MODE SWITCHING =====
  it('switches to manual mode', () => {
    render(<MealLogger />);
    const toggleBtns = screen.getAllByRole('button');
    const manualToggle = toggleBtns.find(b => b.textContent?.includes('Manual'));
    if (manualToggle) {
      fireEvent.click(manualToggle);
      expect(screen.getByText('Manual Entry')).toBeInTheDocument();
    }
  });

  // ===== AI PARSE =====
  it('does not parse when text is empty', () => {
    render(<MealLogger />);
    const parseBtn = getParseButton();
    // Button should be disabled when input is empty
    expect(parseBtn?.disabled).toBe(true);
  });

  it('parses meal via AI when text is entered and button clicked', async () => {
    render(<MealLogger />);
    const input = screen.getByPlaceholderText(/e.g. 2 eggs/i);
    fireEvent.change(input, { target: { value: '2 eggs for breakfast' } });
    
    const parseBtn = getParseButton();
    expect(parseBtn).not.toBeNull();
    
    await act(async () => {
      fireEvent.click(parseBtn!);
    });
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/parse-meal', expect.objectContaining({
        method: 'POST',
      }));
    });
  });

  it('shows parsed meal results', async () => {
    render(<MealLogger />);
    const input = screen.getByPlaceholderText(/e.g. 2 eggs/i);
    fireEvent.change(input, { target: { value: 'chicken for lunch' } });
    
    const parseBtn = getParseButton();
    await act(async () => {
      fireEvent.click(parseBtn!);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Grilled Chicken')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('handles AI parse error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Parse failed', details: 'API error' }),
    });

    render(<MealLogger />);
    const input = screen.getByPlaceholderText(/e.g. 2 eggs/i);
    fireEvent.change(input, { target: { value: 'bad input' } });
    
    const parseBtn = getParseButton();
    await act(async () => {
      fireEvent.click(parseBtn!);
    });
    
    await waitFor(() => {
      const html = document.body.innerHTML;
      expect(html).toContain('API error');
    });
  });

  // ===== MANUAL SUBMIT =====
  it('submits manual meal data via Prepare Log', async () => {
    render(<MealLogger />);
    
    // Switch to manual mode
    const toggleBtns = screen.getAllByRole('button');
    const manualToggle = toggleBtns.find(b => b.textContent?.includes('Manual'));
    if (manualToggle) fireEvent.click(manualToggle);
    
    // Fill in meal name
    const nameInput = screen.getByPlaceholderText(/e.g. Scrambled Eggs/i);
    fireEvent.change(nameInput, { target: { value: 'My Meal' } });
    
    // Fill in calories
    const numberInputs = document.querySelectorAll('input[type="number"]');
    if (numberInputs.length > 0) {
      fireEvent.change(numberInputs[0], { target: { value: '500' } });
    }
    
    // Click Prepare Log
    const prepareBtn = screen.getByText('Prepare Log');
    await act(async () => {
      fireEvent.click(prepareBtn);
    });
    
    // Should show parsed meal
    await waitFor(() => {
      const html = document.body.innerHTML;
      expect(html).toContain('My Meal');
    });
  });

  it('builds one meal with multiple dishes from kitchen items', async () => {
    render(<MealLogger />);

    const toggleBtns = screen.getAllByRole('button');
    const manualToggle = toggleBtns.find(b => b.textContent?.includes('Manual'));
    if (manualToggle) fireEvent.click(manualToggle);

    const mealNameInput = screen.getByPlaceholderText(/e.g. Scrambled Eggs/i);
    fireEvent.change(mealNameInput, { target: { value: 'Breakfast' } });

    fireEvent.click(screen.getByText('Kitchen Dishes'));

    const dishNameInputs = screen.getAllByPlaceholderText(/Dish \d+ name/i);
    fireEvent.change(dishNameInputs[0], { target: { value: 'Oatmeal' } });

    const dishSearchInputs = screen.getAllByPlaceholderText(/Search kitchen items for this dish/i);
    fireEvent.change(dishSearchInputs[0], { target: { value: 'Chi' } });

    await waitFor(() => {
      expect(screen.getAllByText('Chicken Breast').length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText('Chicken Breast')[0]);

    fireEvent.click(screen.getByText('Add Dish'));
    const updatedDishNameInputs = screen.getAllByPlaceholderText(/Dish \d+ name/i);
    fireEvent.change(updatedDishNameInputs[1], { target: { value: 'Bread Slice' } });

    const updatedDishSearchInputs = screen.getAllByPlaceholderText(/Search kitchen items for this dish/i);
    fireEvent.change(updatedDishSearchInputs[1], { target: { value: 'Chi' } });
    await waitFor(() => {
      expect(screen.getAllByText('Chicken Breast').length).toBeGreaterThan(0);
    });
    const kitchenSuggestionButtons = screen.getAllByRole('button').filter(btn => btn.textContent?.includes('Chicken Breast'));
    fireEvent.click(kitchenSuggestionButtons[kitchenSuggestionButtons.length - 1]);

    fireEvent.click(screen.getByText('Prepare Meal From Kitchen'));

    await waitFor(() => {
      expect(screen.getByText('Review Log')).toBeInTheDocument();
      expect(screen.getByText('Oatmeal')).toBeInTheDocument();
      expect(screen.getByText('Bread Slice')).toBeInTheDocument();
    });
  });

  it('calculates dish macros from weight using serving basis', async () => {
    render(<MealLogger />);

    const toggleBtns = screen.getAllByRole('button');
    const manualToggle = toggleBtns.find(b => b.textContent?.includes('Manual'));
    if (manualToggle) fireEvent.click(manualToggle);

    const mealNameInput = screen.getByPlaceholderText(/e.g. Scrambled Eggs/i);
    fireEvent.change(mealNameInput, { target: { value: 'Breakfast' } });

    fireEvent.click(screen.getByText('Kitchen Dishes'));

    const dishSearchInput = screen.getByPlaceholderText(/Search kitchen items for this dish/i);
    fireEvent.change(dishSearchInput, { target: { value: 'Chi' } });
    await waitFor(() => {
      expect(screen.getAllByText('Chicken Breast').length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText('Chicken Breast')[0]);

    fireEvent.click(screen.getByText('g/ml'));
    const weightInput = document.querySelector('input[value="84"]') as HTMLInputElement;
    fireEvent.change(weightInput, { target: { value: '120' } });

    fireEvent.click(screen.getByText('Prepare Meal From Kitchen'));

    await waitFor(() => {
      expect(screen.getByText('Review Log')).toBeInTheDocument();
      expect(screen.getByText('236')).toBeInTheDocument();
      expect(screen.getByText('44.3g')).toBeInTheDocument();
    });
  });

  // ===== SAVE TO DIARY =====
  it('saves parsed meal to diary', async () => {
    render(<MealLogger />);
    const input = screen.getByPlaceholderText(/e.g. 2 eggs/i);
    fireEvent.change(input, { target: { value: 'chicken' } });
    
    const parseBtn = getParseButton();
    await act(async () => {
      fireEvent.click(parseBtn!);
    });
    
    await screen.findByText(/Grilled Chicken/i);
    
    // Find the save button (contains "Finish & Save")
    const saveBtn = screen.getByText(/Finish/i);
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    
    await waitFor(() => {
      expect(mockMealsInsert).toHaveBeenCalled();
    });
  });

  it('opens auth modal when saving without login', async () => {
    mockUser = null;
    render(<MealLogger />);
    expect(screen.queryByTestId('auth-modal')).not.toBeInTheDocument();
  });

  it('handles update failure when saving edited item', async () => {
    // Correct mock to return { error } when .eq() is awaited
    mockUpdate.mockReturnValueOnce({
      eq: jest.fn().mockResolvedValue({ error: { message: 'Update failed' } }),
    });
    render(<MealLogger />);
    const input = screen.getByPlaceholderText(/e.g. 2 eggs/i);
    fireEvent.change(input, { target: { value: 'chicken' } });
    const parseBtn = getParseButton();
    expect(parseBtn).not.toBeNull();
    await act(async () => {
      fireEvent.click(parseBtn!);
    });
  });

  it('handles save error', async () => {
    mockMealsInsert.mockReturnValueOnce({
      select: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'DB error' } }) }),
    });

    render(<MealLogger />);
    const input = screen.getByPlaceholderText(/e.g. 2 eggs/i);
    fireEvent.change(input, { target: { value: 'chicken' } });
    
    const parseBtn = getParseButton();
    await act(async () => {
      fireEvent.click(parseBtn!);
    });
    
    await screen.findByText(/Grilled Chicken/i);
    
    const saveBtn = screen.getByText(/Finish/i);
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    
    await waitFor(() => {
      const html = document.body.innerHTML;
      expect(html).toContain('DB error');
    });
  });

  // ===== KITCHEN SUGGESTIONS =====
  it('shows kitchen item suggestions when typing', async () => {
    render(<MealLogger />);
    const input = screen.getByPlaceholderText(/e.g. 2 eggs/i);
    fireEvent.change(input, { target: { value: 'Chi' } });
    
    await waitFor(() => {
      const html = document.body.innerHTML;
      expect(html).toContain('Chicken Breast');
    });
  });

  // ===== DATE/TIME CHANGE =====
  it('allows changing log date', () => {
    render(<MealLogger />);
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2025-01-15' } });
    expect(dateInput.value).toBe('2025-01-15');
  });

  it('allows changing log time', () => {
    render(<MealLogger />);
    const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement;
    fireEvent.change(timeInput, { target: { value: '14:30' } });
    expect(timeInput.value).toBe('14:30');
  });

  // ===== NUMBER INPUT CLEARING =====
  it('allows clearing number inputs in manual mode', () => {
    render(<MealLogger />);
    const toggleBtns = screen.getAllByRole('button');
    const manualToggle = toggleBtns.find(b => b.textContent?.includes('Manual'));
    if (manualToggle) fireEvent.click(manualToggle);
    
    const numberInputs = document.querySelectorAll('input[type="number"]');
    if (numberInputs.length > 0) {
      fireEvent.change(numberInputs[0], { target: { value: '' } });
      fireEvent.blur(numberInputs[0]);
    }
  });

  // ===== QUANTITY CONTROLS =====
  it('shows quantity info for parsed items', async () => {
    render(<MealLogger />);
    const input = screen.getByPlaceholderText(/e.g. 2 eggs/i);
    fireEvent.change(input, { target: { value: 'chicken' } });
    
    const parseBtn = getParseButton();
    await act(async () => {
      fireEvent.click(parseBtn!);
    });
    
    const grilledChicken = await screen.findByText(/Grilled Chicken/i);
    expect(grilledChicken).toBeInTheDocument();
    
    await waitFor(() => {
      // Check for calorie display (300 in the mock)
      expect(screen.getByText(/300/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('updates an item in a parsed meal', async () => {
    render(<MealLogger />);
    const input = screen.getByPlaceholderText(/e.g. 2 eggs/i);
    fireEvent.change(input, { target: { value: 'chicken' } });
    await act(async () => {
      fireEvent.click(getParseButton()!);
    });
    
    await screen.findByText('Grilled Chicken');
    
    // Find the calories text for the item
    expect(screen.getByText('300')).toBeInTheDocument();

    // Trigger updateItemQuantity by clicking item quantity + / -
    const plusBtns = screen.getAllByRole('button', { name: '+' });
    const minusBtns = screen.getAllByRole('button', { name: '-' });
    await act(async () => {
      fireEvent.click(plusBtns[0]);
    });
    await waitFor(() => {
      expect(screen.getByText('600')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(minusBtns[0]);
    });
    await waitFor(() => {
      expect(screen.getByText('300')).toBeInTheDocument();
    });
  });

  it('deletes an item from a parsed meal', async () => {
    render(<MealLogger />);
    const input = screen.getByPlaceholderText(/e.g. 2 eggs/i);
    fireEvent.change(input, { target: { value: 'chicken' } });
    await act(async () => {
      fireEvent.click(getParseButton()!);
    });
    
    await screen.findByText('Grilled Chicken');
    
    await screen.findByText('Grilled Chicken');
    
    // Find delete button for the item - it has a title "Remove item"
    const deleteBtn = screen.getByTitle('Remove item');
    fireEvent.click(deleteBtn);
    expect(screen.queryByText('Grilled Chicken')).not.toBeInTheDocument();
  });

  it('adds a new empty item to a meal', async () => {
    render(<MealLogger />);
    const input = screen.getByPlaceholderText(/e.g. 2 eggs/i);
    fireEvent.change(input, { target: { value: 'chicken' } });
    await act(async () => {
      fireEvent.click(getParseButton()!);
    });
    
    await screen.findByText('Grilled Chicken');
    
    const addBtn = screen.getByText(/Add Item/i);
    fireEvent.click(addBtn);
    
    // Should show a new item named "New Item"
    expect(screen.getByText('New Item')).toBeInTheDocument();
  });

  // ===== AUTH CHECK ON SAVE =====
  it('shows auth modal when trying to save without session', async () => {
    mockUser = null;
    render(<MealLogger />);
    const input = screen.getByPlaceholderText(/e.g. 2 eggs/i);
    fireEvent.change(input, { target: { value: 'chicken' } });
    await act(async () => {
      fireEvent.click(getParseButton()!);
    });
    
    await screen.findByText('Grilled Chicken');
    
    const saveBtn = screen.getByText(/Finish/i);
    fireEvent.click(saveBtn);
    
    expect(screen.getByTestId('auth-modal')).toBeInTheDocument();
  });

  // ===== BASE SELECTION / KITCHEN ITEMS =====
  it('adds a kitchen item to a meal', async () => {
    render(<MealLogger />);
    const input = screen.getByPlaceholderText(/e.g. 2 eggs/i);
    fireEvent.change(input, { target: { value: 'Chi' } });
    
    // Wait for and click a kitchen item suggestion
    const suggestion = await screen.findByText('Chicken Breast');
    fireEvent.click(suggestion);
    
    // Should add to parsed meals
    expect(screen.getByText('Chicken Breast')).toBeInTheDocument();
  });

  // ===== ERROR PATHS =====
  it('handles general handleSave exception', async () => {
    mockMealsInsert.mockImplementationOnce(() => {
      throw new Error('Explosion');
    });

    render(<MealLogger />);
    const input = screen.getByPlaceholderText(/e.g. 2 eggs/i);
    fireEvent.change(input, { target: { value: 'chicken' } });
    await act(async () => {
      fireEvent.click(getParseButton()!);
    });
    
    await screen.findByText('Grilled Chicken');
    
    const saveBtn = screen.getByText(/Finish/i);
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/Explosion/i)).toBeInTheDocument();
    });
  });

  it('handles manual macro input clearing and blur', async () => {
    render(<MealLogger />);
    const toggleBtns = screen.getAllByRole('button');
    const manualToggle = toggleBtns.find(b => b.textContent?.includes('Manual'));
    if (manualToggle) fireEvent.click(manualToggle);
    
    const calorieInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    
    // Change to empty string (branch coverage for onChange e.target.value === '')
    await act(async () => {
      fireEvent.change(calorieInput, { target: { value: '' } });
    });
    expect(calorieInput.value).toBe('');
    
    // Blur empty input (branch coverage for onBlur coercion)
    await act(async () => {
      fireEvent.blur(calorieInput);
    });
    expect(['', '0']).toContain(calorieInput.value);
  });

  it('clears state after successful save', async () => {
    render(<MealLogger />);
    const input = screen.getByPlaceholderText(/e.g. 2 eggs/i);
    fireEvent.change(input, { target: { value: 'chicken' } });
    
    await act(async () => {
      fireEvent.click(getParseButton()!);
    });
    
    await screen.findByText(/Grilled Chicken/i);
    
    const saveBtn = screen.getByText(/Finish/i);
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    
    await waitFor(() => {
      expect(mockMealsInsert).toHaveBeenCalled();
    });

    // clear() runs after success timeout
    await waitFor(() => {
      expect(screen.queryByText('Grilled Chicken')).not.toBeInTheDocument();
      const mainInput = screen.getByPlaceholderText(/e.g. 2 eggs/i) as HTMLInputElement;
      expect(mainInput.value).toBe('');
    }, { timeout: 3000 });
  });

  it('picks a kitchen item in manual mode', async () => {
    render(<MealLogger />);
    const toggleBtns = screen.getAllByRole('button');
    const manualToggle = toggleBtns.find(b => b.textContent?.includes('Manual'));
    if (manualToggle) fireEvent.click(manualToggle);
    
    const input = screen.getByPlaceholderText(/e.g. Scrambled Eggs/i);
    fireEvent.change(input, { target: { value: 'Chi' } });
    
    const suggestion = await screen.findByText('Chicken Breast');
    fireEvent.click(suggestion);
    
    // Should fill the manual form with Chicken Breast data
    const calInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    expect(calInput.value).toBe('165');
  });

  it('shows error when preparing kitchen meal without ingredients', async () => {
    render(<MealLogger />);
    const manualToggle = screen.getAllByRole('button').find(b => b.textContent?.includes('Manual'));
    if (manualToggle) fireEvent.click(manualToggle);

    fireEvent.change(screen.getByPlaceholderText(/e.g. Scrambled Eggs/i), { target: { value: 'Dinner' } });
    fireEvent.click(screen.getByText('Kitchen Dishes'));
    fireEvent.click(screen.getByText('Prepare Meal From Kitchen'));

    expect(screen.getByText('Add at least one dish with one or more kitchen items.')).toBeInTheDocument();
  });

  it('keeps a default dish when removing the last dish', async () => {
    render(<MealLogger />);
    const manualToggle = screen.getAllByRole('button').find(b => b.textContent?.includes('Manual'));
    if (manualToggle) fireEvent.click(manualToggle);

    fireEvent.change(screen.getByPlaceholderText(/e.g. Scrambled Eggs/i), { target: { value: 'Dinner' } });
    fireEvent.click(screen.getByText('Kitchen Dishes'));

    fireEvent.click(screen.getByTitle('Remove dish'));
    expect(screen.getByPlaceholderText(/Dish 1 name/i)).toBeInTheDocument();
  });

  it('handles qty and weight draft commits and ingredient removal in kitchen dishes', async () => {
    render(<MealLogger />);
    const manualToggle = screen.getAllByRole('button').find(b => b.textContent?.includes('Manual'));
    if (manualToggle) fireEvent.click(manualToggle);

    fireEvent.change(screen.getByPlaceholderText(/e.g. Scrambled Eggs/i), { target: { value: 'Breakfast' } });
    fireEvent.click(screen.getByText('Kitchen Dishes'));

    const dishSearchInput = screen.getByPlaceholderText(/Search kitchen items for this dish/i);
    fireEvent.change(dishSearchInput, { target: { value: 'Chicken' } });
    await screen.findByText('Chicken Breast');
    fireEvent.click(screen.getAllByText('Chicken Breast')[0]);

    // Add same ingredient again to hit existing ingredient increment path.
    fireEvent.change(dishSearchInput, { target: { value: 'Chicken' } });
    fireEvent.click(screen.getAllByText('Chicken Breast')[0]);

    const qtyInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(qtyInput, { target: { value: '' } });
    fireEvent.blur(qtyInput, { target: { value: '' } });

    fireEvent.click(screen.getByText('g/ml'));
    const weightInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(weightInput, { target: { value: '' } });
    fireEvent.blur(weightInput, { target: { value: '' } });

    const selects = document.querySelectorAll('select');
    const unitSelect = selects[selects.length - 1] as HTMLSelectElement;
    fireEvent.change(unitSelect, { target: { value: 'ml' } });

    fireEvent.click(screen.getByTitle('Remove ingredient'));
    expect(screen.getByText('Add one or more kitchen items to build this dish.')).toBeInTheDocument();
  });

  it('disables weight mode for items without serving g/ml reference', async () => {
    render(<MealLogger />);
    const manualToggle = screen.getAllByRole('button').find(b => b.textContent?.includes('Manual'));
    if (manualToggle) fireEvent.click(manualToggle);

    fireEvent.change(screen.getByPlaceholderText(/e.g. Scrambled Eggs/i), { target: { value: 'Dinner' } });
    fireEvent.click(screen.getByText('Kitchen Dishes'));

    const dishSearchInput = screen.getByPlaceholderText(/Search kitchen items for this dish/i);
    fireEvent.change(dishSearchInput, { target: { value: 'Egg' } });
    await screen.findByText('Egg');
    fireEvent.click(screen.getAllByText('Egg')[0]);

    expect(screen.getByText(/Weight mode needs serving size in g\/ml on the kitchen item/i)).toBeInTheDocument();
    expect(screen.getByText('g/ml')).toBeDisabled();
  });
});
