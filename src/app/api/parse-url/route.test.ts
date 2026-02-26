import { POST } from './route';
import { generateJsonText, generateJsonVision } from '@/lib/aiClient';

jest.mock('@/lib/aiClient', () => ({
  generateJsonText: jest.fn(),
  generateJsonVision: jest.fn(),
}));

jest.mock('cheerio', () => {
  const mockAttr = jest.fn((name: string) => {
    if (name === 'src') return 'https://example.com/nutrition.jpg';
    if (name === 'alt') return 'nutrition facts';
    return '';
  });
  const $ = (selector: any) => {
    if (typeof selector !== 'string') {
      return {
        attr: mockAttr,
        parent: () => ({ text: () => '' }),
      };
    }
    if (selector === 'body') {
      return { text: () => 'sample text' };
    }
    return {
      remove: () => undefined,
      each: (cb: (index: number, element: any) => void) => {
        if (selector === 'img') cb(0, {});
      },
    };
  };
  ($ as any).load = jest.fn().mockReturnValue($);
  return $;
});

const originalFetch = global.fetch;

describe('POST /api/parse-url', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<html><body>test</body></html>'),
      headers: { get: () => 'text/html' },
    } as any);
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('returns 400 when url is missing', async () => {
    const request = { json: () => Promise.resolve({}) } as any;
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('URL is required');
  });

  it('returns text-based extraction when vision not available', async () => {
    (generateJsonText as jest.Mock).mockResolvedValueOnce(JSON.stringify({
      name: 'Text Product',
      calories: 200,
      source: 'text',
    }));

    const request = { json: () => Promise.resolve({ url: 'https://example.com/food' }) } as any;
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.name).toBe('Text Product');
  });

  it('prefers vision extraction when available', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<html><body><img src="https://example.com/nutrition.jpg" alt="nutrition facts"></body></html>'),
        headers: { get: () => 'text/html' },
      } as any)
      .mockResolvedValueOnce({
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        headers: { get: () => 'image/jpeg' },
      } as any);

    (generateJsonVision as jest.Mock).mockResolvedValueOnce(JSON.stringify({
      name: 'Vision Product',
      calories: 180,
      source: 'vision',
    }));
    (generateJsonText as jest.Mock).mockResolvedValueOnce(JSON.stringify({
      name: 'Text Product',
      calories: 200,
      source: 'text',
    }));

    const request = { json: () => Promise.resolve({ url: 'https://example.com/food' }) } as any;
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.name).toBe('Vision Product');
  });

  it('returns 500 when AI text extraction fails', async () => {
    (generateJsonText as jest.Mock).mockRejectedValueOnce(new Error('AI failed'));

    const request = { json: () => Promise.resolve({ url: 'https://example.com/food' }) } as any;
    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});
