import * as crypto from 'crypto';

/**
 * BE-03: tự triển khai ký/xác thực JWT (HS256) bằng module `crypto` của Node — không dùng
 * @nestjs/jwt hay thư viện `jsonwebtoken` để sign/verify. Chỉ tuân theo cấu trúc chuẩn JWT
 * (header.payload.signature, base64url, HMAC-SHA256) để token vẫn đọc được bởi mọi công cụ
 * debug JWT thông thường (vd jwt.io) — nhưng phần lõi ký và xác thực là code tự viết.
 */

interface JwtHeader {
  alg: 'HS256';
  typ: 'JWT';
}

const HEADER: JwtHeader = { alg: 'HS256', typ: 'JWT' };

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input, 'base64url');
}

function sign(headerAndPayload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(headerAndPayload).digest('base64url');
}

/** Chuỗi kiểu "15m" / "1d" / "30s" / "2h" → số giây. Không đơn vị thì hiểu là giây. */
export function parseExpiresIn(value: string): number {
  const match = /^(\d+)\s*(s|m|h|d)?$/i.exec(value.trim());
  if (!match) {
    throw new Error(`JWT_EXPIRES_IN không hợp lệ: "${value}"`);
  }
  const amount = Number(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();
  const secondsPerUnit: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return amount * secondsPerUnit[unit];
}

export function signJwt(payload: object, secret: string, expiresInSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresInSeconds };

  const encodedHeader = base64UrlEncode(JSON.stringify(HEADER));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = sign(`${encodedHeader}.${encodedPayload}`, secret);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export class JwtVerificationError extends Error {}

export function verifyJwt<T extends object>(token: string, secret: string): T {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new JwtVerificationError('Token sai định dạng');
  }
  const [encodedHeader, encodedPayload, signature] = parts;

  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`, secret);
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  // So sánh timing-safe — tránh lộ thông tin chữ ký qua thời gian phản hồi (timing attack).
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    throw new JwtVerificationError('Chữ ký không hợp lệ');
  }

  let payload: T & { exp?: number };
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8'));
  } catch {
    throw new JwtVerificationError('Payload không hợp lệ');
  }

  if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
    throw new JwtVerificationError('Token đã hết hạn');
  }

  return payload;
}
