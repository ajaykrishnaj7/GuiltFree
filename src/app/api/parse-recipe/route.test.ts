/**
 * Tests for parse-recipe API route
 */

import { POST } from './route';
import { generateJsonText } from '@/lib/aiClient';

jest.mock('@/lib/aiClient', () => ({
  generateJsonText: jest.fn(),
}));

describe('POST /api/parse-recipe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when text is missing', async () => {
    const request = { json: () => Promise.resolve({}) } as any;
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Text is required');
  });

  it('returns parsed ingredients on success', async () => {
    const mockResult = {
      ingredients: [
        { name: 'Egg', quantity: 2, unit: 'pcs', calories: 155 },
        { name: 'Flour', quantity: 1, unit: 'cup', calories: 455 },
      ],
    };

    (generateJsonText as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockResult));

    const request = { json: () => Promise.resolve({ text: '2 eggs, 1 cup flour' }) } as any;
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ingredients).toHaveLength(2);
  });

  it('returns 500 on invalid JSON from AI', async () => {
    (generateJsonText as jest.Mock).mockResolvedValueOnce('not json');

    const request = { json: () => Promise.resolve({ text: 'test' }) } as any;
    const response = await POST(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Invalid AI response format');
  });

  it('returns 500 on AI error', async () => {
    (generateJsonText as jest.Mock).mockRejectedValueOnce(new Error('AI error'));
    const request = { json: () => Promise.resolve({ text: 'test' }) } as any;
    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});
