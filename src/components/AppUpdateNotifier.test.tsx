import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AppUpdateNotifier from './AppUpdateNotifier';

describe('AppUpdateNotifier', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Date, 'now').mockReturnValue(123456);
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('does not render prompt on first successful version check', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: '1.0.0' }),
    }) as unknown as typeof fetch;

    render(<AppUpdateNotifier />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('New update available')).not.toBeInTheDocument();
  });

  it('renders update prompt when a newer version is detected', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ version: '1.0.0' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ version: '1.1.0' }) }) as unknown as typeof fetch;

    render(<AppUpdateNotifier />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    await act(async () => {
      jest.advanceTimersByTime(60000);
    });

    expect(await screen.findByText('New update available')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.queryByText('New update available')).not.toBeInTheDocument();
  });

  it('swallows network failures without crashing', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    render(<AppUpdateNotifier />);

    await act(async () => {
      jest.advanceTimersByTime(60000);
    });

    expect(screen.queryByText('New update available')).not.toBeInTheDocument();
  });

  it('skips polling when tab is hidden', async () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ version: '1.0.0' }) }) as unknown as typeof fetch;

    render(<AppUpdateNotifier />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    await act(async () => {
      jest.advanceTimersByTime(120000);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
