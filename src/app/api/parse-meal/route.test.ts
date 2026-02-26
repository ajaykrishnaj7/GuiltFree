import { POST } from './route';
import { generateJsonText } from '@/lib/aiClient';

jest.mock('@/lib/aiClient', () => ({
  generateJsonText: jest.fn(),
}));

describe('POST /api/parse-meal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when text is missing', async () => {
    const request = { json: () => Promise.resolve({}) } as any;
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 200 and parsed meal on success', async () => {
    (generateJsonText as jest.Mock).mockResolvedValueOnce(JSON.stringify({
      meal_name: 'Lunch',
      meal_type: 'Lunch',
      items: [{ name: 'Chicken', calories: 300 }],
    }));

    const request = { json: () => Promise.resolve({ text: 'Chicken' }) } as any;
    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.meal_name).toBe('Lunch');
  });

  it('returns 500 on parse error', async () => {
    (generateJsonText as jest.Mock).mockResolvedValueOnce('Invalid JSON');

    const request = { json: () => Promise.resolve({ text: 'test' }) } as any;
    const response = await POST(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Failed to parse AI response');
  });

  it('returns 500 on AI general error', async () => {
    (generateJsonText as jest.Mock).mockRejectedValueOnce(new Error('AI failed'));

    const request = { json: () => Promise.resolve({ text: 'test' }) } as any;
    const response = await POST(request);

    expect(response.status).toBe(500);
  });
});
