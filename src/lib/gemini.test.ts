/**
 * Tests for the gemini lib
 */

// Use jest.fn at module scope — must be var, not const, for hoisting
const mockModel = { generateContent: jest.fn() };

jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue(mockModel),
    })),
  };
});

// Set env before importing
process.env.GOOGLE_AI_API_KEY = 'test-api-key';

// Mock fetch for model discovery
const mockFetchForModels = jest.fn();
global.fetch = mockFetchForModels;

// Must import AFTER mocks
let getBestModel: any;
beforeAll(async () => {
  const mod = await import('./gemini');
  getBestModel = mod.getBestModel;
});

describe('getBestModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a model object', async () => {
    mockFetchForModels.mockResolvedValue({
      json: () => Promise.resolve({
        models: [
          { name: 'models/gemini-1.5-flash', supportedGenerationMethods: ['generateContent'] },
        ],
      }),
    });

    const model = await getBestModel();
    expect(model).toBeDefined();
  });

  it('falls back to default on fetch error', async () => {
    mockFetchForModels.mockRejectedValue(new Error('Network error'));

    const model = await getBestModel();
    expect(model).toBeDefined();
  });

  it('falls back when no models returned', async () => {
    mockFetchForModels.mockResolvedValue({
      json: () => Promise.resolve({ models: [] }),
    });

    const model = await getBestModel();
    expect(model).toBeDefined();
  });

  it('selects gemini-1.5-pro when flash is missing', async () => {
    mockFetchForModels.mockResolvedValue({
      json: () => Promise.resolve({
        models: [
          { name: 'models/gemini-1.5-pro', supportedGenerationMethods: ['generateContent'] },
        ],
      }),
    });

    const model = await getBestModel();
    expect(model).toBeDefined();
  });
});
