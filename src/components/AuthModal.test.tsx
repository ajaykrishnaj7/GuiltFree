import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuthModal from './AuthModal';

// Mock supabase
const mockSignIn = jest.fn();
const mockSignUp = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: any[]) => mockSignIn(...args),
      signUp: (...args: any[]) => mockSignUp(...args),
    },
  },
}));

describe('AuthModal', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSignIn.mockResolvedValue({ error: null });
    mockSignUp.mockResolvedValue({ error: null });
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(<AuthModal isOpen={false} onClose={mockOnClose} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders login form when isOpen is true', () => {
    render(<AuthModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('name@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  it('closes when backdrop is clicked', () => {
    render(<AuthModal isOpen={true} onClose={mockOnClose} />);
    // Click the backdrop (first child with the backdrop class)
    const backdrop = document.querySelector('.bg-zinc-950\\/40');
    if (backdrop) fireEvent.click(backdrop);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes when X button is clicked', () => {
    render(<AuthModal isOpen={true} onClose={mockOnClose} />);
    const closeButtons = screen.getAllByRole('button');
    const xButton = closeButtons.find(btn => btn.querySelector('svg'));
    if (xButton) fireEvent.click(xButton);
  });

  it('switches between login and signup mode', () => {
    render(<AuthModal isOpen={true} onClose={mockOnClose} />);
    
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText("Don't have an account? Sign up"));
    expect(screen.getByText('Create account')).toBeInTheDocument();
    expect(screen.getByText('Sign Up')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Already have an account? Sign in'));
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
  });

  it('handles login submission successfully', async () => {
    render(<AuthModal isOpen={true} onClose={mockOnClose} />);
    
    fireEvent.change(screen.getByPlaceholderText('name@example.com'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({ email: 'test@test.com', password: 'password123' });
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('handles signup submission successfully', async () => {
    render(<AuthModal isOpen={true} onClose={mockOnClose} />);
    
    fireEvent.click(screen.getByText("Don't have an account? Sign up"));
    fireEvent.change(screen.getByPlaceholderText('name@example.com'), { target: { value: 'new@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('Sign Up'));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalled();
      expect(screen.getByText('Check your email to confirm your account!')).toBeInTheDocument();
    });
  });

  it('displays error on failed login', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid credentials' } });
    
    render(<AuthModal isOpen={true} onClose={mockOnClose} />);
    
    fireEvent.change(screen.getByPlaceholderText('name@example.com'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('displays error on failed signup', async () => {
    mockSignUp.mockResolvedValue({ error: { message: 'Email taken' } });
    
    render(<AuthModal isOpen={true} onClose={mockOnClose} />);
    
    fireEvent.click(screen.getByText("Don't have an account? Sign up"));
    fireEvent.change(screen.getByPlaceholderText('name@example.com'), { target: { value: 'dup@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'pass123' } });
    fireEvent.click(screen.getByText('Sign Up'));

    await waitFor(() => {
      expect(screen.getByText('Email taken')).toBeInTheDocument();
    });
  });
});
