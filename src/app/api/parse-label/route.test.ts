/**
 * Tests for parse-label API route
 */

import { POST } from './route';
import { generateJsonVision } from '@/lib/aiClient';

jest.mock('@/lib/aiClient', () => ({
  generateJsonVision: jest.fn(),
}));

describe('POST /api/parse-label', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when image is missing', async () => {
    const request = { json: () => Promise.resolve({}) } as any;
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Image data is required');
  });

  it('returns nutrition data from label image', async () => {
    const mockResult = { name: 'Protein Bar', calories: 200, protein: 20 };
    (generateJsonVision as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockResult));

    const request = { json: () => Promise.resolve({ image: 'base64data', mimeType: 'image/jpeg' }) } as any;
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.name).toBe('Protein Bar');
    expect(data.calories).toBe(200);
  });

  it('returns 500 on AI error', async () => {
    (generateJsonVision as jest.Mock).mockRejectedValueOnce(new Error('Vision API failed'));
    const request = { json: () => Promise.resolve({ image: 'base64data' }) } as any;
    const response = await POST(request);
    expect(response.status).toBe(500);
  });

  it('returns 500 on invalid JSON from AI', async () => {
    (generateJsonVision as jest.Mock).mockResolvedValueOnce('not valid json');
    const request = { json: () => Promise.resolve({ image: 'base64data' }) } as any;
    const response = await POST(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Failed to parse AI response');
  });
});
