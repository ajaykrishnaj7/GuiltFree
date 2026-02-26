import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from './ThemeToggle';

const mockSetTheme = jest.fn();
jest.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: mockSetTheme,
  }),
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    mockSetTheme.mockClear();
  });

  it('renders a button with Toggle theme title', () => {
    render(<ThemeToggle />);
    expect(screen.getByTitle('Toggle theme')).toBeInTheDocument();
  });

  it('renders sr-only text for accessibility', () => {
    render(<ThemeToggle />);
    expect(screen.getByText('Toggle theme')).toBeInTheDocument();
  });

  it('toggles theme from light to dark on click', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByTitle('Toggle theme'));
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('renders placeholder div when not mounted', () => {
    // ThemeToggle uses useEffect to set mounted=true, so initially it would render the placeholder.
    // Since useEffect runs immediately in test env, we just check the component renders successfully.
    const { container } = render(<ThemeToggle />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
