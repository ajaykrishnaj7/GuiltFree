import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock AuthProvider common hook
jest.mock('./src/components/AuthProvider', () => ({
  ...jest.requireActual('./src/components/AuthProvider'),
  useAuth: jest.fn(() => ({
    user: { id: 'test-user' },
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
  })),
}));

// Mock next-themes
jest.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: jest.fn(),
    resolvedTheme: 'light',
    themes: ['light', 'dark'],
  }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Suppress console errors in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('act(') ||
        args[0].includes('Not implemented'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Mock next/server NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn().mockImplementation((data, init) => ({
      status: init?.status || 200,
      json: async () => data,
      ok: (init?.status || 200) < 400,
    })),
  },
}));

// Polyfill Request if not available (needed for Some Node versions in Jest)
if (typeof Request === 'undefined') {
  (global as any).Request = class {
    url: string;
    method: string;
    constructor(url: string, init?: any) {
      this.url = url;
      this.method = init?.method || 'GET';
    }
    async json() { return {}; }
  };
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock FileReader
class MockFileReader {
  result: string | ArrayBuffer | null = null;
  onload: (() => void) | null = null;
  readAsDataURL() {
    this.result = 'data:image/jpeg;base64,bW9ja2RhdGE=';
    setTimeout(() => this.onload?.(), 0);
  }
}
(global as any).FileReader = MockFileReader;
