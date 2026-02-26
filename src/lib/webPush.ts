import { createPrivateKey, createSign } from 'crypto';

const base64UrlEncode = (input: Buffer | string) => {
  const raw = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return raw
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const base64UrlDecode = (input: string) => {
  const padded = input
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(input.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64');
};

const parseAudience = (endpoint: string) => {
  const parsed = new URL(endpoint);
  return `${parsed.protocol}//${parsed.host}`;
};

const toPrivateKeyObject = (publicKey: string, privateKey: string) => {
  const publicBytes = base64UrlDecode(publicKey);
  if (publicBytes.length !== 65 || publicBytes[0] !== 0x04) {
    throw new Error('Invalid VAPID public key format');
  }
  const x = publicBytes.subarray(1, 33);
  const y = publicBytes.subarray(33, 65);

  return createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      d: privateKey,
      x: base64UrlEncode(x),
      y: base64UrlEncode(y),
    },
    format: 'jwk',
  });
};

const buildVapidJwt = ({
  endpoint,
  subject,
  publicKey,
  privateKey,
}: {
  endpoint: string;
  subject: string;
  publicKey: string;
  privateKey: string;
}) => {
  const aud = parseAudience(endpoint);
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const header = base64UrlEncode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = base64UrlEncode(JSON.stringify({ aud, exp, sub: subject }));
  const data = `${header}.${payload}`;

  const signer = createSign('SHA256');
  signer.update(data);
  signer.end();

  const keyObject = toPrivateKeyObject(publicKey, privateKey);
  const signature = signer.sign({ key: keyObject, dsaEncoding: 'ieee-p1363' });
  return `${data}.${base64UrlEncode(signature)}`;
};

export const sendVapidPush = async (endpoint: string) => {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@example.com';

  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys are not configured');
  }

  const token = buildVapidJwt({ endpoint, subject, publicKey, privateKey });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      TTL: '60',
      Urgency: 'normal',
      Authorization: `vapid t=${token}, k=${publicKey}`,
      'Content-Length': '0',
    },
  });

  return response;
};

