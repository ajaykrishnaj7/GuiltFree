import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';
jest.unmock('./AuthProvider');

// Mock supabase
const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockSignOut = jest.fn();
let authStateCallback: any = null;

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (cb: any) => {
        mockOnAuthStateChange(cb);
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      },
      signOut: () => mockSignOut(),
    },
  },
}));

import { AuthProvider, useAuth } from './AuthProvider';

// Test consumer component
function TestConsumer() {
  const { user, loading, signOut } = useAuth();
  return (
    <div>
      <span data-testid="loading">{loading.toString()}</span>
      <span data-testid="user">{user?.email || 'none'}</span>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { session: null } });
    authStateCallback = null;
    mockOnAuthStateChange.mockImplementation((cb: any) => {
      authStateCallback = cb;
    });
  });

  it('provides auth context to children', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('none');
    });
  });

  it('sets user from session', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { email: 'test@test.com' } } },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@test.com');
    });
  });

  it('sets loading to false after session check', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });
  });

  it('calls supabase signOut', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockSignOut.mockResolvedValue({ error: null });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });
    
    const btn = screen.getByText('Sign Out');
    btn.click();
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('updates user on auth state change callback', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(authStateCallback).toBeTruthy();
    });

    act(() => {
      authStateCallback('SIGNED_IN', { user: { email: 'event@test.com' } });
    });

    expect(screen.getByTestId('user')).toHaveTextContent('event@test.com');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });
});

describe('useAuth', () => {
  it('returns default context when used outside provider', () => {
    function Standalone() {
      const { user, loading } = useAuth();
      return <div>{user ? 'has user' : 'no user'} {loading.toString()}</div>;
    }
    render(<Standalone />);
    expect(screen.getByText(/no user/)).toBeInTheDocument();
  });
});
