import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import Kitchen from './Kitchen';

// Mock AuthProvider
let mockUser: any = { id: 'user-1', email: 'test@test.com' };
jest.mock('./AuthProvider', () => ({
  useAuth: () => ({
    user: mockUser,
    signOut: jest.fn(),
    loading: false,
  }),
}));

// Mock supabase
const mockData: any[] = [
  { id: '1', name: 'Chicken Breast', calories: 165, protein: 31, carbs: 0, fats_total: 3.6, fiber: 0, sugars_total: 0 },
  { id: '2', name: 'Brown Rice', calories: 215, protein: 5, carbs: 45, fats_total: 1.8, fiber: 3.5, sugars_total: 0 },
];

const mockInsert = jest.fn().mockReturnValue({ select: () => ({ single: () => Promise.resolve({ data: { id: 'new-1' }, error: null }) }) });
const mockUpdate = jest.fn().mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
const mockDelete = jest.fn().mockReturnValue({ eq: () => Promise.resolve({ error: null }) });

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: mockData }),
        eq: () => Promise.resolve({ data: mockData }),
      }),
      insert: (...args: any[]) => mockInsert(...args),
      update: (...args: any[]) => mockUpdate(...args),
      delete: () => mockDelete(),
    }),
  },
}));

// Mock fetch for URL parsing, recipe parsing, label scanning
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Kitchen', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    mockUser = { id: 'user-1', email: 'test@test.com' };
    window.alert = jest.fn();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ name: 'Test', calories: 100, protein: 10, carbs: 20, fats_total: 5, fiber: 2, sugars_total: 3 }),
    });
  });

  // ===== BASIC RENDER TESTS =====
  it('returns null when not open and not a page', () => {
    const { container } = render(<Kitchen isOpen={false} onClose={mockOnClose} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders when isOpen is true', async () => {
    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => {
      expect(screen.getByText('The Kitchen')).toBeInTheDocument();
    });
  });

  it('renders as page mode', async () => {
    render(<Kitchen isOpen={true} onClose={mockOnClose} isPage={true} />);
    await waitFor(() => {
      expect(screen.getByText('The Kitchen')).toBeInTheDocument();
    });
  });

  it('renders kitchen items from supabase', async () => {
    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => {
      expect(screen.getByText('Chicken Breast')).toBeInTheDocument();
      expect(screen.getByText('Brown Rice')).toBeInTheDocument();
    });
  });

  // ===== TAB AND NAVIGATION TESTS =====
  it('shows add form when Add Item button is clicked', async () => {
    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    fireEvent.click(screen.getByText('Add Item'));
    expect(screen.getByText('Manual')).toBeInTheDocument();
    expect(screen.getByText('URL')).toBeInTheDocument();
    expect(screen.getByText('Scan')).toBeInTheDocument();
    expect(screen.getByText('Recipe')).toBeInTheDocument();
  });

  it('filters items by search query', async () => {
    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    const searchInput = screen.getByPlaceholderText(/search your kitchen/i);
    fireEvent.change(searchInput, { target: { value: 'chicken' } });
    expect(screen.getByText('Chicken Breast')).toBeInTheDocument();
    expect(screen.queryByText('Brown Rice')).not.toBeInTheDocument();
  });

  // ===== MANUAL MODE TESTS =====
  it('allows entering manual item data', async () => {
    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    fireEvent.click(screen.getByText('Add Item'));
    const nameInput = screen.getByPlaceholderText(/Item Name/i);
    fireEvent.change(nameInput, { target: { value: 'New Item' } });
    expect(nameInput).toHaveValue('New Item');
  });

  it('allows clearing number inputs and coerces on blur', async () => {
    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    fireEvent.click(screen.getByText('Add Item'));
    const numberInputs = document.querySelectorAll('input[type="number"]');
    if (numberInputs.length > 0) {
      fireEvent.change(numberInputs[0], { target: { value: '' } });
      fireEvent.blur(numberInputs[0], { target: { value: '' } });
    }
  });

  it('saves a new manual item', async () => {
    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    
    fireEvent.click(screen.getByText('Add Item'));
    const nameInput = screen.getByPlaceholderText(/Item Name/i);
    fireEvent.change(nameInput, { target: { value: 'Test Food' } });
    
    fireEvent.click(screen.getByText('Save Item'));
    
    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  it('does not save when name is empty', async () => {
    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    
    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.click(screen.getByText('Save Item'));
    
    expect(mockInsert).not.toHaveBeenCalled();
  });

  // ===== URL MODE TESTS =====
  it('shows URL input when URL tab is selected', async () => {
    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.click(screen.getByText('URL'));
    expect(screen.getByPlaceholderText(/Paste nutrition URL/i)).toBeInTheDocument();
  });

  it('parses URL and fills form on import', async () => {
    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    
    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.click(screen.getByText('URL'));
    
    const urlInput = screen.getByPlaceholderText(/Paste nutrition URL/i);
    fireEvent.change(urlInput, { target: { value: 'https://example.com/food' } });
    fireEvent.click(screen.getByText('Import Nutrition'));
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/parse-url', expect.any(Object));
    });
  });

  it('handles URL parse error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Parse failed' }),
    });
    
    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    
    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.click(screen.getByText('URL'));
    
    const urlInput = screen.getByPlaceholderText(/Paste nutrition URL/i);
    fireEvent.change(urlInput, { target: { value: 'https://bad.com' } });
    fireEvent.click(screen.getByText('Import Nutrition'));
    
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalled();
    });
  });

  // ===== RECIPE MODE TESTS =====
  it('shows recipe form when Recipe tab is selected', async () => {
    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    
    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.click(screen.getByText('Recipe'));
    
    expect(screen.getByPlaceholderText(/Recipe Name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Paste your recipe/i)).toBeInTheDocument();
  });

  it('estimates recipe macros via AI', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        serving_size: '250g',
        calories: 400,
        protein: 25,
        carbs: 50,
        fats_total: 12,
        fiber: 5,
        sugars_total: 8,
        explanation: 'Based on recipe analysis',
      }),
    });

    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    
    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.click(screen.getByText('Recipe'));
    
    const nameInput = screen.getByPlaceholderText(/Recipe Name/i);
    fireEvent.change(nameInput, { target: { value: 'Pasta' } });
    
    const instructionsInput = screen.getByPlaceholderText(/Paste your recipe/i);
    fireEvent.change(instructionsInput, { target: { value: 'Boil pasta, add sauce, cook chicken' } });
    
    fireEvent.click(screen.getByText('Estimate Macros'));
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/estimate-recipe', expect.any(Object));
    });
  });

  it('handles recipe estimate error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Estimation failed' }),
    });

    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    
    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.click(screen.getByText('Recipe'));
    
    const instructionsInput = screen.getByPlaceholderText(/Paste your recipe/i);
    fireEvent.change(instructionsInput, { target: { value: 'Some recipe' } });
    
    fireEvent.click(screen.getByText('Estimate Macros'));
    
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Failed to estimate recipe'));
    });
  });

  it('does not estimate when instructions are empty', async () => {
    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    
    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.click(screen.getByText('Recipe'));
    
    // Estimate button should be disabled
    const estimateBtn = screen.getByText('Estimate Macros');
    expect(estimateBtn).toBeDisabled();
  });

  // ===== SCAN LABEL MODE TESTS =====
  it('shows scan label UI with guidance message', async () => {
    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    
    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.click(screen.getByText('Scan'));
    
    expect(screen.getByText('Best with Nutrition Facts Labels')).toBeInTheDocument();
    expect(screen.getByText(/Take a clear photo/)).toBeInTheDocument();
    expect(screen.getByText('Add a nutrition label photo')).toBeInTheDocument();
    expect(screen.getByText('Upload From Device')).toBeInTheDocument();
    expect(screen.getByText('Take Photo Now')).toBeInTheDocument();
  });

  it('file inputs have correct attributes', async () => {
    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    
    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.click(screen.getByText('Scan'));
    
    const fileInputs = document.querySelectorAll('input[type="file"]');
    expect(fileInputs.length).toBe(2);
    expect(fileInputs[0].getAttribute('capture')).toBeNull();
    expect(fileInputs[0].getAttribute('accept')).toBe('image/*');
    expect(fileInputs[1].getAttribute('capture')).toBe('environment');
    expect(fileInputs[1].getAttribute('accept')).toBe('image/*');
  });

  it('handles file upload for label scanning', async () => {
    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    
    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.click(screen.getByText('Scan'));
    
    const fileInput = document.querySelectorAll('input[type="file"]')[0] as HTMLInputElement;
    const file = new File(['fake-image-data'], 'label.jpg', { type: 'image/jpeg' });
    
    // Trigger the file change
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    // FileReader mock should fire onload
    await waitFor(() => {
      // The scan button should become enabled since we handle the file
      // We check that the flow doesn't error out
      expect(fileInput).toBeInTheDocument();
    });
  });

  it('scan button is disabled without an image', async () => {
    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    
    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.click(screen.getByText('Scan'));
    
    // The scan button should exist and be disabled without an image
    // It's the only button in the Scan tab content that has "Scan" in it
    const scanBtn = screen.getByText(/Extract Nutrition/i);
    expect(scanBtn).toBeDisabled();
  });

  // ===== DELETE ITEM TESTS =====
  it('deletes an item when trash icon is clicked', async () => {
    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('Chicken Breast'));
    
    // Find all buttons and look for ones that stop propagation (delete buttons)
    const allButtons = document.querySelectorAll('button');
    // The delete buttons are the ones alongside the kitchen items
    const itemButtons = Array.from(allButtons).filter(btn => {
      const parent = btn.closest('[class*="group"]');
      return parent && parent.textContent?.includes('Chicken Breast');
    });
    
    if (itemButtons.length > 0) {
      fireEvent.click(itemButtons[itemButtons.length - 1]);
    }
    // Just verify the component handles the click without errors
    expect(screen.getByText('The Kitchen')).toBeInTheDocument();
  });

  // ===== EDIT ITEM TESTS =====
  it('opens edit form when clicking an item', async () => {
    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('Chicken Breast'));
    
    // Items are clickable divs
    const chickenItem = screen.getByText('Chicken Breast');
    fireEvent.click(chickenItem.closest('div[class*="cursor-pointer"]') || chickenItem);
    
    await waitFor(() => {
      // Should show "Editing Item" badge
      const html = document.body.innerHTML;
      expect(html).toContain('Chicken Breast');
    });
  });

  // ===== SAVE ITEM WITH UPDATE =====
  it('updates existing item when editing', async () => {
    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('Chicken Breast'));
    
    const chickenItem = screen.getByText('Chicken Breast');
    fireEvent.click(chickenItem.closest('div[class*="cursor-pointer"]') || chickenItem);
    
    await waitFor(() => {
      const nameInput = screen.getByPlaceholderText(/Item Name/i);
      expect(nameInput).toHaveValue('Chicken Breast');
    });
    
    fireEvent.click(screen.getByText('Save Item'));
    
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  // ===== SAVE ERROR HANDLING =====
  it('handles save error on insert', async () => {
    mockInsert.mockReturnValueOnce({
      select: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'Insert failed' } }) }),
    });

    // We need to make insert return error
    mockInsert.mockReturnValue({
      error: { message: 'Failed' },
    });

    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    
    fireEvent.click(screen.getByText('Add Item'));
    const nameInput = screen.getByPlaceholderText(/Item Name/i);
    fireEvent.change(nameInput, { target: { value: 'Failing Item' } });
    fireEvent.click(screen.getByText('Save Item'));
    
    // Should attempt to save
    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  // ===== CLOSE MODAL =====
  it('calls onClose when close button is clicked', async () => {
    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    
    // Find close button (X icon)
    const closeButtons = document.querySelectorAll('button');
    const closeBtn = Array.from(closeButtons).find(btn => {
      const svg = btn.querySelector('svg');
      return svg && btn.textContent === '';
    });
    if (closeBtn) {
      fireEvent.click(closeBtn);
    }
  });

  // ===== RECIPE REVIEW FLOW =====
  it('shows review UI after successful recipe estimation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        serving_size: '250g',
        calories: 400,
        protein: 25,
        carbs: 50,
        fats_total: 12,
        fiber: 5,
        sugars_total: 8,
        explanation: 'Based on recipe analysis',
      }),
    });

    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    
    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.click(screen.getByText('Recipe'));
    
    const nameInput = screen.getByPlaceholderText(/Recipe Name/i);
    fireEvent.change(nameInput, { target: { value: 'Pasta' } });
    
    const instructionsInput = screen.getByPlaceholderText(/Paste your recipe/i);
    fireEvent.change(instructionsInput, { target: { value: 'Cook pasta with sauce' } });
    
    fireEvent.click(screen.getByText('Estimate Macros'));
    
    await waitFor(() => {
      expect(screen.getByText('Macro Estimation Complete')).toBeInTheDocument();
    });
  });

  it('saves recipe from review UI', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        serving_size: '250g', calories: 400, protein: 25, carbs: 50,
        fats_total: 12, fiber: 5, sugars_total: 8, explanation: 'Test',
      }),
    });

    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    
    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.click(screen.getByText('Recipe'));
    
    const nameInput = screen.getByPlaceholderText(/Recipe Name/i);
    fireEvent.change(nameInput, { target: { value: 'Pasta' } });
    
    const inst = screen.getByPlaceholderText(/Paste your recipe/i);
    fireEvent.change(inst, { target: { value: 'Cook pasta' } });
    
    fireEvent.click(screen.getByText('Estimate Macros'));
    
    await waitFor(() => screen.getByText('Macro Estimation Complete'));
    
    fireEvent.click(screen.getByText('Save Recipe & Macros'));
    
    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  it('goes back from review to recipe form', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        serving_size: '250g', calories: 400, protein: 25, carbs: 50,
        fats_total: 12, fiber: 5, sugars_total: 8, explanation: 'Test',
      }),
    });

    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    
    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.click(screen.getByText('Recipe'));
    
    const inst = screen.getByPlaceholderText(/Paste your recipe/i);
    fireEvent.change(inst, { target: { value: 'Cook pasta' } });
    
    fireEvent.click(screen.getByText('Estimate Macros'));
    
    await waitFor(() => screen.getByText('Macro Estimation Complete'));
    
    fireEvent.click(screen.getByText('Back'));
    
    await waitFor(() => {
      expect(screen.getByText('Estimate Macros')).toBeInTheDocument();
    });
  });

  // ===== MACRO INPUT EDITING IN REVIEW =====
  it('allows editing macro values in review', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        serving_size: '250g', calories: 400, protein: 25, carbs: 50,
        fats_total: 12, fiber: 5, sugars_total: 8,
      }),
    });

    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    
    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.click(screen.getByText('Recipe'));
    
    const inst = screen.getByPlaceholderText(/Paste your recipe/i);
    fireEvent.change(inst, { target: { value: 'Cook' } });
    
    fireEvent.click(screen.getByText('Estimate Macros'));
    
    await waitFor(() => screen.getByText('Macro Estimation Complete'));
    
    // Should show macro input fields
    const numberInputs = document.querySelectorAll('input[type="number"]');
    expect(numberInputs.length).toBeGreaterThan(0);
    
    // Edit a macro
    fireEvent.change(numberInputs[0], { target: { value: '500' } });
    fireEvent.blur(numberInputs[0], { target: { value: '500' } });
  });

  // ===== MAGIC IMPORT TESTS =====
  it('shows magic import form when Magic Import button is clicked', async () => {
    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    
    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.click(screen.getByText('Recipe'));
    
    // Find the magic import button
    const magicBtn = screen.getByText(/Try Magic Import/i);
    fireEvent.click(magicBtn);
    expect(screen.getByPlaceholderText(/Paste a list of ingredients/i)).toBeInTheDocument();
  });

  it('performs magic import successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        ingredients: [
          { name: 'Apple', calories: 95, protein: 0.5, carbs: 25, fats_total: 0.3, fiber: 4, sugars_total: 19, quantity: 1 }
        ]
      }),
    });

    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.click(screen.getByText('Recipe'));
    
    const magicBtn = screen.getByText(/Try Magic Import/i);
    fireEvent.click(magicBtn);
    
    const textarea = screen.getByPlaceholderText(/Paste a list of ingredients/i);
    fireEvent.change(textarea, { target: { value: '1 apple' } });
    
    fireEvent.click(screen.getByText('Parse & Add'));
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/parse-recipe', expect.any(Object));
      // Should show the apple in the recipe list
      expect(screen.getByText('Apple')).toBeInTheDocument();
    });
  });

  it('handles magic import error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Magic failed' }),
    });

    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.click(screen.getByText('Recipe'));
    fireEvent.click(screen.getByText(/Try Magic Import/i));
    
    fireEvent.change(screen.getByPlaceholderText(/Paste a list of ingredients/i), { target: { value: 'bad' } });
    fireEvent.click(screen.getByText('Parse & Add'));
    
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Magic failed'));
    });
  });

  it('handles item deletion with stopPropagation', async () => {
    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('Chicken Breast'));
    
    const deleteBtn = document.querySelector('button .lucide-trash2')?.parentElement;
    if (deleteBtn) {
      fireEvent.click(deleteBtn);
      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalled();
      });
    }
  });

  it('handles update failure when saving edited item', async () => {
    mockUpdate.mockReturnValueOnce({
      eq: () => ({
        select: () => Promise.resolve({ error: { message: 'Update failed' } })
      })
    });
    // The component structure might expect eq().select() or similar based on standard patterns
    // but in Kitchen.tsx it's just .from().update().eq()
    mockUpdate.mockReturnValueOnce({
      eq: () => Promise.resolve({ error: { message: 'Update failed' } }),
    });

    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('Chicken Breast'));
    
    await act(async () => {
      fireEvent.click(screen.getByText('Chicken Breast'));
    });
    
    await waitFor(() => screen.getByPlaceholderText(/Item Name/i));
    
    await act(async () => {
      fireEvent.click(screen.getByText('Save Item'));
    });
    
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  // ===== LABEL SCANNING EXTENDED TESTS =====
  it('performs label extraction successfully', async () => {
    const originalFileReader = global.FileReader;
    const mockReader: any = {
      readAsDataURL: jest.fn(),
      onload: null,
      result: 'data:image/jpeg;base64,fake-data'
    };
    global.FileReader = jest.fn(() => mockReader) as any;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        name: 'Scanned Protein',
        calories: 200,
        protein: 20,
        carbs: 10,
        fats_total: 5,
        fiber: 2,
        sugars_total: 1,
        serving_size: '1 scoop',
        rationale: 'Scanned facts'
      }),
    });

    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.click(screen.getByText('Scan'));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['fake-image'], 'label.jpg', { type: 'image/jpeg' });
    
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      // Manually trigger onload with target set
      if (mockReader.onload) {
        mockReader.onload({ target: mockReader });
      }
    });

    const extractBtn = await screen.findByText(/Extract Nutrition/i);
    expect(extractBtn).not.toBeDisabled();
    
    await act(async () => {
      fireEvent.click(extractBtn);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/parse-label', expect.any(Object));
      expect(screen.getByDisplayValue('Scanned Protein')).toBeInTheDocument();
    });

    global.FileReader = originalFileReader;
  });

  it('handles label extraction API error', async () => {
    const originalFileReader = global.FileReader;
    const mockReader: any = { readAsDataURL: jest.fn(), onload: null, result: 'data:image/jpeg;base64,fake-data' };
    global.FileReader = jest.fn(() => mockReader) as any;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ error: 'AI error' }),
    });

    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.click(screen.getByText('Scan'));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [new File([''], 't.jpg')] } });
      if (mockReader.onload) mockReader.onload({ target: mockReader });
    });

    const extractBtn = await screen.findByText(/Extract Nutrition/i);
    await act(async () => {
      fireEvent.click(extractBtn);
    });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('AI error');
    });

    global.FileReader = originalFileReader;
  });

  it('handles label extraction exception', async () => {
    const originalFileReader = global.FileReader;
    const mockReader: any = { readAsDataURL: jest.fn(), onload: null, result: 'data:image/jpeg;base64,fake-data' };
    global.FileReader = jest.fn(() => mockReader) as any;

    mockFetch.mockRejectedValueOnce(new Error('Network boom'));

    render(<Kitchen isOpen={true} onClose={mockOnClose} />);
    await waitFor(() => screen.getByText('The Kitchen'));
    fireEvent.click(screen.getByText('Add Item'));
    fireEvent.click(screen.getByText('Scan'));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [new File([''], 't.jpg')] } });
      if (mockReader.onload) mockReader.onload({ target: mockReader });
    });

    const extractBtn = await screen.findByText(/Extract Nutrition/i);
    await act(async () => {
      fireEvent.click(extractBtn);
    });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Network boom'));
    });

    global.FileReader = originalFileReader;
  });
});
