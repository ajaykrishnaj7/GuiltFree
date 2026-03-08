import { POST } from './route';
import { generateJsonText, generateJsonVision } from '@/lib/aiClient';

jest.mock('@/lib/aiClient', () => ({
  generateJsonText: jest.fn(),
  generateJsonVision: jest.fn(),
}));
jest.mock('cheerio', () => {
  return {
    load: (html: string) => {
      let doc: any;
      try {
        doc = new DOMParser().parseFromString(html, 'text/html');
      } catch (e) {
        doc = { querySelectorAll: () => [] };
      }
      const $ = (selector: any) => {
        if (typeof selector !== 'string') {
          return {
             attr: (name: string) => selector.getAttribute ? selector.getAttribute(name) || '' : '',
             parent: () => $(selector.parentElement || { textContent: '' }),
             text: () => selector.textContent || '',
             html: () => selector.innerHTML || ''
          };
        }
        let nodes: any[] = [];
        try {
          nodes = Array.from(doc.querySelectorAll(selector));
        } catch(e) {}
        
        return {
          remove: () => nodes.forEach(n => n.remove && n.remove()),
          append: (text: string) => nodes.forEach(n => { if (n.innerHTML !== undefined) n.innerHTML += text }),
          text: () => nodes.map(n => n.textContent).join(' '),
          html: () => nodes.map(n => n.innerHTML).join(' '),
          each: (cb: (i: number, el: any) => void) => nodes.forEach((n, i) => cb(i, n)),
          attr: (name: string) => nodes[0] && nodes[0].getAttribute ? nodes[0].getAttribute(name) || '' : ''
        };
      };
      return $;
    }
  };
});

const originalFetch = global.fetch;

describe('POST /api/parse-url', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<html><body>test</body></html>'),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
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
        ok: true,
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

  it('extracts JSON-LD script tags and various img formats', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(`
          <html>
            <body>
              <script type="application/ld+json">
                {"@type": "Recipe", "name": "Test Recipe", "nutrition": { "calories": "100" }}
              </script>
              <script type="application/ld+json">
                {"@type": "Product", "name": "No Nutrition"}
              </script>
              <img src="/img1.jpg" data-a-dynamic-image="yes">
              <img src="/img2.jpg" data-old-hires="yes">
              <div class="product-image-container"><img data-src="/costco1.jpg"></div>
              <img src="https://costco-static.com/item__1.jpg?width=350&height=350&fit=bounds&canvas=350,350">
            </body>
          </html>
        `),
        headers: { get: () => 'text/html' },
      } as any)
      .mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        headers: { get: () => 'image/jpeg' },
      } as any);

    (generateJsonVision as jest.Mock).mockResolvedValueOnce(JSON.stringify({
      name: 'Complex Parsed Product',
      calories: 180,
      source: 'vision',
    }));

    const request = { json: () => Promise.resolve({ url: 'https://example.com/food' }) } as any;
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.name).toBe('Complex Parsed Product');
  });

  it('gracefully falls back when vision fetch fails (ok: false)', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<html><body><img src="https://example.com/nutrition.jpg" alt="nutrition facts"></body></html>'),
        headers: { get: () => 'text/html' },
      } as any)
      .mockResolvedValueOnce({
        ok: false,
        headers: { get: () => 'image/jpeg' },
      } as any);

    (generateJsonText as jest.Mock).mockResolvedValueOnce(JSON.stringify({
      name: 'Text Product Only',
      calories: 200,
      source: 'text',
    }));

    const request = { json: () => Promise.resolve({ url: 'https://example.com/food' }) } as any;
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.name).toBe('Text Product Only');
  });

  it('gracefully handles main fetch error', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network offline'));

    (generateJsonText as jest.Mock).mockResolvedValueOnce(JSON.stringify({
      name: 'Fallback Product',
      calories: 120,
      source: 'text',
    }));

    const request = { json: () => Promise.resolve({ url: 'https://example.com/food' }) } as any;
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.name).toBe('Fallback Product');
  });
});
