import { POST } from './route';
import { generateJsonText } from '@/lib/aiClient';

jest.mock('@/lib/aiClient', () => ({
  generateJsonText: jest.fn(),
}));

describe('POST /api/day-suggestion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when totals or goals are missing', async () => {
    const request = { json: () => Promise.resolve({}) } as any;
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns suggestion payload on success', async () => {
    (generateJsonText as jest.Mock).mockResolvedValueOnce(JSON.stringify({
      title: 'Great progress',
      message: 'Add fiber at dinner tomorrow to close the gap.',
    }));

    const request = {
      json: () => Promise.resolve({
        date: '2026-02-24',
        totals: { calories: 1800 },
        goals: { calories: 2000 },
      }),
    } as any;

    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.title).toBe('Great progress');
  });

  it('returns fallback suggestion on AI failure', async () => {
    (generateJsonText as jest.Mock).mockRejectedValueOnce(new Error('AI failure'));

    const request = {
      json: () => Promise.resolve({
        totals: { calories: 1800 },
        goals: { calories: 2000 },
      }),
    } as any;

    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.source).toBe('fallback');
  });
});
