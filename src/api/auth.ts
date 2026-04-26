import { SignJWT, jwtVerify } from 'jose';

const PASSWORD = process.env.DASHBOARD_PASSWORD ?? 'admin';
const SECRET_RAW = process.env.JWT_SECRET ?? PASSWORD + '_jwt_secret_solo_founder';
const SECRET = new TextEncoder().encode(SECRET_RAW.padEnd(32, '_').slice(0, 32));
const EXPIRY = '7d';

export async function createToken(): Promise<string> {
  return new SignJWT({ sub: 'founder' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, SECRET);
    return true;
  } catch {
    return false;
  }
}

export function checkPassword(password: string): boolean {
  return password === PASSWORD;
}
