import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditMealModal from './EditMealModal';

// Mock supabase
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockInsert = jest.fn();
let mockKitchenRows: any[] = [];
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => Promise.resolve({ data: table === 'kitchen_items' ? mockKitchenRows : [] }),
      update: (data: any) => ({
        eq: () => {
          mockUpdate(table, data);
          return Promise.resolve({ error: null });
        },
      }),
      delete: () => ({
        eq: () => {
          mockDelete(table);
          return Promise.resolve({ error: null });
        },
      }),
      insert: (data: any) => {
        mockInsert(table, data);
        return Promise.resolve({ error: null });
      },
    }),
  },
}));

const mockMeal = {
  id: 'meal-1',
  name: 'Test Lunch',
  type: 'Lunch',
  description: 'A test meal',
  created_at: '2026-02-20T12:00:00Z',
  total_calories: 500,
  total_protein: 30,
  total_carbs: 50,
  total_fats: 20,
  total_fiber: 5,
  total_sugars_total: 10,
};

const mockItems = [
  {
    id: 'item-1',
    name: 'Chicken',
    display_name: 'Grilled Chicken',
    quantity: 1,
    unit: 'serving',
    calories: 300,
    protein: 25,
    carbs: 0,
    fats_total: 10,
    fiber: 0,
    sugars_total: 0,
    rationale: 'Grilled chicken breast',
  },
  {
    id: 'item-2',
    name: 'Rice',
    display_name: 'White Rice',
    quantity: 1,
    unit: 'cup',
    calories: 200,
    protein: 5,
    carbs: 50,
    fats_total: 0,
    fiber: 1,
    sugars_total: 0,
    rationale: 'Steamed white rice',
  },
];

describe('EditMealModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    mockKitchenRows = [];
  });

  it('renders the modal with meal data', () => {
    render(
      <EditMealModal meal={mockMeal} items={mockItems} onClose={mockOnClose} onSave={mockOnSave} />
    );
    expect(screen.getByText('Edit Meal')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Lunch')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A test meal')).toBeInTheDocument();
  });

  it('renders all item ingredients', () => {
    render(
      <EditMealModal meal={mockMeal} items={mockItems} onClose={mockOnClose} onSave={mockOnSave} />
    );
    expect(screen.getByDisplayValue('Grilled Chicken')).toBeInTheDocument();
    expect(screen.getByDisplayValue('White Rice')).toBeInTheDocument();
  });

  it('allows editing meal name', () => {
    render(
      <EditMealModal meal={mockMeal} items={mockItems} onClose={mockOnClose} onSave={mockOnSave} />
    );
    const nameInput = screen.getByDisplayValue('Test Lunch');
    fireEvent.change(nameInput, { target: { value: 'Updated Lunch' } });
    expect(screen.getByDisplayValue('Updated Lunch')).toBeInTheDocument();
  });

  it('allows adding a new ingredient', () => {
    render(
      <EditMealModal meal={mockMeal} items={mockItems} onClose={mockOnClose} onSave={mockOnSave} />
    );
    fireEvent.click(screen.getByText('Add Ingredient'));
    expect(screen.getAllByDisplayValue('New Item').length).toBe(1);
  });

  it('allows removing an ingredient', () => {
    render(
      <EditMealModal meal={mockMeal} items={mockItems} onClose={mockOnClose} onSave={mockOnSave} />
    );
    // Verify we have items initially
    expect(screen.getByDisplayValue('Grilled Chicken')).toBeInTheDocument();
  });

  it('allows editing item macro values', () => {
    render(
      <EditMealModal meal={mockMeal} items={mockItems} onClose={mockOnClose} onSave={mockOnSave} />
    );
    // Find a calorie input and change it
    const calorieInputs = screen.getAllByDisplayValue('300');
    if (calorieInputs.length > 0) {
      fireEvent.change(calorieInputs[0], { target: { value: '350' } });
      expect(screen.getByDisplayValue('350')).toBeInTheDocument();
    }
  });

  it('recalculates macros when quantity changes', () => {
    render(
      <EditMealModal meal={mockMeal} items={mockItems} onClose={mockOnClose} onSave={mockOnSave} />
    );

    // First quantity input belongs to first item (starts at 1)
    const qtyInputs = screen.getAllByDisplayValue('1');
    fireEvent.change(qtyInputs[0], { target: { value: '2' } });

    // First item calories/protein should scale 300->600 and 25->50
    expect(screen.getByDisplayValue('600')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('50').length).toBeGreaterThan(0);
  });

  it('allows clearing item macro values and coerces on blur', () => {
    render(
      <EditMealModal meal={mockMeal} items={mockItems} onClose={mockOnClose} onSave={mockOnSave} />
    );
    const calorieInputs = screen.getAllByDisplayValue('300');
    if (calorieInputs.length > 0) {
      fireEvent.change(calorieInputs[0], { target: { value: '' } });
      fireEvent.blur(calorieInputs[0], { target: { value: '' } });
    }
  });

  it('handles save submission', async () => {
    render(
      <EditMealModal meal={mockMeal} items={mockItems} onClose={mockOnClose} onSave={mockOnSave} />
    );
    fireEvent.click(screen.getByText('Save Changes'));
    
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockDelete).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  it('saves updated quantity and unit in meal_items', async () => {
    render(
      <EditMealModal meal={mockMeal} items={mockItems} onClose={mockOnClose} onSave={mockOnSave} />
    );

    const qtyInputs = screen.getAllByDisplayValue('1');
    fireEvent.change(qtyInputs[0], { target: { value: '2' } });

    const unitInputs = screen.getAllByDisplayValue('serving');
    fireEvent.change(unitInputs[0], { target: { value: 'piece' } });

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      const insertCall = mockInsert.mock.calls.find((call: any[]) => call[0] === 'meal_items');
      expect(insertCall).toBeTruthy();
      expect(insertCall[1][0].quantity).toBe(2);
      expect(insertCall[1][0].unit).toBe('piece');
      expect(insertCall[1][0].calories).toBe(600);
    });
  });

  it('closes when backdrop is clicked', () => {
    render(
      <EditMealModal meal={mockMeal} items={mockItems} onClose={mockOnClose} onSave={mockOnSave} />
    );
    const backdrop = document.querySelector('.bg-zinc-950\\/60');
    if (backdrop) fireEvent.click(backdrop);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('allows editing description', () => {
    render(
      <EditMealModal meal={mockMeal} items={mockItems} onClose={mockOnClose} onSave={mockOnSave} />
    );
    const descInput = screen.getByDisplayValue('A test meal');
    fireEvent.change(descInput, { target: { value: 'Updated description' } });
    expect(screen.getByDisplayValue('Updated description')).toBeInTheDocument();
  });

  it('supports dish ingredient editing and recalculates from kitchen item references', async () => {
    mockKitchenRows = [
      {
        id: 'k-1',
        name: 'Royal Basmati Rice',
        calories: 160,
        protein: 3,
        carbs: 35,
        fats_total: 0.5,
        fiber: 0.2,
        sugars_total: 0,
        serving_amount: 45,
        serving_unit: 'g',
      },
    ];

    const dishItems = [
      {
        ...mockItems[1],
        name: 'Rice',
        display_name: 'Rice',
        unit: 'dish',
        quantity: 1,
        calories: 160,
        protein: 3,
        carbs: 35,
        fats_total: 0.5,
        fiber: 0.2,
        sugars_total: 0,
        rationale: 'Built from kitchen items: 45g Royal Basmati Rice',
      },
    ];

    render(
      <EditMealModal meal={mockMeal} items={dishItems} onClose={mockOnClose} onSave={mockOnSave} />
    );

    await waitFor(() => {
      expect(screen.getByText('Dish Ingredients (editable)')).toBeInTheDocument();
    });

    const qtyModeButtons = screen.getAllByRole('button', { name: 'Qty' });
    fireEvent.click(qtyModeButtons[0]);

    const qtyInputs = screen.getAllByRole('spinbutton');
    const ingredientQtyInput = qtyInputs.find((input) => (input as HTMLInputElement).value === '1');
    expect(ingredientQtyInput).toBeTruthy();
    fireEvent.change(ingredientQtyInput!, { target: { value: '2' } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('320')).toBeInTheDocument();
    });
  });

  it('handles save failures and resets saving state', async () => {
    const errorMessage = 'update failed';
    const failingSupabase = require('@/lib/supabase').supabase;
    jest.spyOn(failingSupabase, 'from').mockImplementation((table: string) => ({
      select: () => Promise.resolve({ data: table === 'kitchen_items' ? mockKitchenRows : [] }),
      update: () => ({
        eq: () => Promise.resolve({ error: { message: errorMessage } }),
      }),
      delete: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
      insert: () => Promise.resolve({ error: null }),
    }));
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => undefined);

    render(
      <EditMealModal meal={mockMeal} items={mockItems} onClose={mockOnClose} onSave={mockOnSave} />
    );

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to save changes'));
    });
    expect(mockOnSave).not.toHaveBeenCalled();
  });
});
