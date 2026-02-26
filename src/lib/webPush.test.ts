import { generateKeyPairSync } from 'crypto';

const toBase64Url = (value: Buffer) =>
  value
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const makeVapidKeys = () => {
  const { publicKey, privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });
  const pubJwk = publicKey.export({ format: 'jwk' }) as JsonWebKey;
  const privJwk = privateKey.export({ format: 'jwk' }) as JsonWebKey;

  const x = Buffer.from(pubJwk.x as string, 'base64url');
  const y = Buffer.from(pubJwk.y as string, 'base64url');
  const uncompressed = Buffer.concat([Buffer.from([0x04]), x, y]);

  return {
    publicKey: toBase64Url(uncompressed),
    privateKey: String(privJwk.d),
  };
};

describe('webPush', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('throws when VAPID keys are missing', async () => {
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;

    const { sendVapidPush } = await import('./webPush');
    await expect(sendVapidPush('https://push.example/send')).rejects.toThrow('VAPID keys are not configured');
  });

  it('sends a push request with VAPID auth headers', async () => {
    const { publicKey, privateKey } = makeVapidKeys();
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = publicKey;
    process.env.VAPID_PRIVATE_KEY = privateKey;
    process.env.VAPID_SUBJECT = 'mailto:test@example.com';

    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 201 }) as unknown as typeof fetch;

    const { sendVapidPush } = await import('./webPush');
    const response = await sendVapidPush('https://fcm.googleapis.com/fcm/send/abc');

    expect(response).toEqual({ ok: true, status: 201 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://fcm.googleapis.com/fcm/send/abc');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toContain('vapid t=');
    expect(init.headers.Authorization).toContain(`, k=${publicKey}`);
  });

  it('throws for invalid public key shape', async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'aW52YWxpZA';
    process.env.VAPID_PRIVATE_KEY = 'private';
    global.fetch = jest.fn() as unknown as typeof fetch;

    const { sendVapidPush } = await import('./webPush');
    await expect(sendVapidPush('https://web.push')).rejects.toThrow('Invalid VAPID public key format');
  });
});
