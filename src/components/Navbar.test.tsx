import { render, screen, fireEvent } from '@testing-library/react';
import Navbar from './Navbar';

// Mock AuthProvider
const mockSignOut = jest.fn();
let mockUser: any = null;
let mockLoading = false;
jest.mock('./AuthProvider', () => ({
  useAuth: () => ({
    user: mockUser,
    signOut: mockSignOut,
    loading: mockLoading,
  }),
}));

// Mock AuthModal
jest.mock('./AuthModal', () => {
  return function MockAuthModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    return isOpen ? <div data-testid="auth-modal"><button onClick={onClose}>Close</button></div> : null;
  };
});

// Mock ThemeToggle
jest.mock('./ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">Theme</div>,
}));

describe('Navbar', () => {
  beforeEach(() => {
    mockUser = null;
    mockLoading = false;
    jest.clearAllMocks();
  });

  it('renders GuiltFree logo', () => {
    render(<Navbar />);
    expect(screen.getByText('GuiltFree')).toBeInTheDocument();
  });

  it('renders Sign In button when no user is logged in', () => {
    render(<Navbar />);
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  it('renders nav links even when no user is logged in', () => {
    render(<Navbar />);
    expect(screen.getAllByText('Home').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Kitchen').length).toBeGreaterThan(0);
  });

  it('renders navigation links when user is logged in', () => {
    mockUser = { id: '1', email: 'test@test.com' };
    render(<Navbar />);
    // Mobile nav should have these links
    expect(screen.getAllByText('Home').length).toBeGreaterThan(0);
    expect(screen.getAllByText('History').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Kitchen').length).toBeGreaterThan(0);
  });

  it('renders user email when logged in', () => {
    mockUser = { id: '1', email: 'john@test.com' };
    render(<Navbar />);
    expect(screen.getByText('john')).toBeInTheDocument();
  });

  it('opens auth modal when Sign In is clicked', () => {
    render(<Navbar />);
    fireEvent.click(screen.getByText('Sign In'));
    expect(screen.getByTestId('auth-modal')).toBeInTheDocument();
  });

  it('closes auth modal when modal close is clicked', () => {
    render(<Navbar />);
    fireEvent.click(screen.getByText('Sign In'));
    expect(screen.getByTestId('auth-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByTestId('auth-modal')).not.toBeInTheDocument();
  });

  it('renders ThemeToggle when user is logged in', () => {
    mockUser = { id: '1', email: 'test@test.com' };
    render(<Navbar />);
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
  });

  it('renders nothing for user actions while loading', () => {
    mockLoading = true;
    render(<Navbar />);
    expect(screen.queryByText('Sign In')).not.toBeInTheDocument();
  });
});
