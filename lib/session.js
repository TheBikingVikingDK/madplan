import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
export const SESSION = '__Host-madplan-session';
export const OTP = '__Host-madplan-otp';
function key() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error('Login er ikke konfigureret på serveren.');
  return createHash('sha256').update(process.env.SESSION_SECRET).digest();
}
export function seal(value, seconds) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify({ ...value, exp: Date.now() + seconds*1000 })), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}
export function unseal(value) {
  try {
    const data = Buffer.from(value,'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key(), data.subarray(0,12));
    decipher.setAuthTag(data.subarray(12,28));
    const result = JSON.parse(Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString());
    return result.exp > Date.now() ? result : null;
  } catch { return null; }
}
export function readCookie(req, name) {
  const cookie = String(req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(name+'='));
  return cookie ? unseal(cookie.slice(name.length+1)) : null;
}
export function cookie(name, value, seconds) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${seconds}`;
}
