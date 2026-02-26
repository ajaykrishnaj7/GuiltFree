/**
 * Tests for estimate-recipe API route
 */

import { POST } from './route';
import { generateJsonText } from '@/lib/aiClient';

jest.mock('@/lib/aiClient', () => ({
  generateJsonText: jest.fn(),
}));

describe('POST /api/estimate-recipe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when instructions are missing', async () => {
    const request = { json: () => Promise.resolve({}) } as any;
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Instructions are required');
  });

  it('returns estimation data on success', async () => {
    const mockResult = { serving_size: '250g', calories: 400, protein: 25 };
    (generateJsonText as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockResult));

    const request = { json: () => Promise.resolve({ name: 'Pasta', instructions: 'boil pasta add sauce' }) } as any;
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.calories).toBe(400);
    expect(data.serving_size).toBe('250g');
  });

  it('returns 500 on invalid JSON from AI', async () => {
    (generateJsonText as jest.Mock).mockResolvedValueOnce('not json');

    const request = { json: () => Promise.resolve({ instructions: 'test' }) } as any;
    const response = await POST(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Invalid AI response format');
  });

  it('returns 500 on AI error', async () => {
    (generateJsonText as jest.Mock).mockRejectedValueOnce(new Error('AI error'));
    const request = { json: () => Promise.resolve({ instructions: 'test' }) } as any;
    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});
