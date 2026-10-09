import crypto from 'node:crypto';

/**
 * Scrypt-based password hashing (memory-hard, resistant to GPU/ASIC attacks).
 * Follows OWASP recommendations for server-side password storage.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      64,
      { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 },
      (err, derivedKey) => {
        if (err) return reject(err);
        resolve(`scrypt$16384$8$1$${salt}$${derivedKey.toString('hex')}`);
      }
    );
  });
}

/**
 * Constant-time password verification preventing timing side-channel attacks.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }

  const salt = parts[4]!;
  const originalKeyHex = parts[5]!;
  const originalKey = Buffer.from(originalKeyHex, 'hex');

  return new Promise((resolve) => {
    crypto.scrypt(
      password,
      salt,
      64,
      { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 },
      (err, derivedKey) => {
        if (err) return resolve(false);
        try {
          const match = crypto.timingSafeEqual(originalKey, derivedKey);
          resolve(match);
        } catch {
          resolve(false);
        }
      }
    );
  });
}

export interface TokenPayload {
  userId: string;
  orgId: string;
  role: 'admin' | 'manager' | 'advisor';
  storeId?: string;
  email: string;
  exp: number; // UNIX timestamp seconds
}

/**
 * Lightweight, zero-dependency signed JWT generator using HMAC-SHA256.
 */
export function signToken(payload: TokenPayload, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

/**
 * Verifies and decodes a signed JWT token in constant time.
 */
export function verifyToken(token: string, secret: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  if (!header || !body || !signature) return null;

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');

  if (signature.length !== expectedSig.length) return null;
  const isMatch = crypto.timingSafeEqual(
    Buffer.from(signature, 'utf8'),
    Buffer.from(expectedSig, 'utf8')
  );
  if (!isMatch) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload;
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp < nowSec) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}
