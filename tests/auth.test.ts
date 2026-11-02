// Kiểm tra đăng nhập Google và phiên chơi (dùng khoá RSA tự tạo thay cho khoá của Google).
import { beforeAll, describe, expect, it } from 'vitest';
import { _resetJwksCache, bytesToB64url, signSession, verifyGoogleIdToken, verifySession } from '../server/src/auth';

const CLIENT = 'test-client.apps.googleusercontent.com';
let priv: CryptoKey;
let jwk: JsonWebKey & { kid: string };
const fetcher = async () => new Response(JSON.stringify({ keys: [jwk] }), { headers: { 'cache-control': 'max-age=3600' } });

const enc = (o: unknown) => bytesToB64url(new TextEncoder().encode(JSON.stringify(o)));
async function token(payload: Record<string, unknown>, kid = 'k1') {
  const head = enc({ alg: 'RS256', kid, typ: 'JWT' });
  const body = enc(payload);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', priv, new TextEncoder().encode(`${head}.${body}`)));
  return `${head}.${body}.${bytesToB64url(sig)}`;
}
const good = () => ({ iss: 'https://accounts.google.com', aud: CLIENT, sub: '109876543210987654321', exp: Math.floor(Date.now() / 1000) + 600, email_verified: true, given_name: 'Lan', email: 'khong-luu@example.com' });

beforeAll(async () => {
  const kp = (await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  priv = kp.privateKey;
  jwk = { ...(await crypto.subtle.exportKey('jwk', kp.publicKey)), kid: 'k1' };
  _resetJwksCache();
});

describe('Đăng nhập Google', () => {
  it('nhận token hợp lệ, chỉ lấy mã tài khoản và tên', async () => {
    const u = await verifyGoogleIdToken(await token(good()), CLIENT, fetcher);
    expect(u).toEqual({ sub: '109876543210987654321', name: 'Lan' });
  });
  it('từ chối token của ứng dụng khác', async () => {
    await expect(verifyGoogleIdToken(await token({ ...good(), aud: 'khac' }), CLIENT, fetcher)).rejects.toThrow();
  });
  it('từ chối token hết hạn', async () => {
    await expect(verifyGoogleIdToken(await token({ ...good(), exp: Math.floor(Date.now() / 1000) - 3600 }), CLIENT, fetcher)).rejects.toThrow();
  });
  it('từ chối token bị sửa nội dung', async () => {
    const t = await token(good());
    const [h, , sig] = t.split('.');
    await expect(verifyGoogleIdToken(`${h}.${enc({ ...good(), sub: '1234567890' })}.${sig}`, CLIENT, fetcher)).rejects.toThrow();
  });
  it('từ chối token không phải do Google cấp', async () => {
    await expect(verifyGoogleIdToken(await token({ ...good(), iss: 'https://evil.example' }), CLIENT, fetcher)).rejects.toThrow();
  });
});

describe('Phiên chơi', () => {
  const secret = 'mot-chuoi-bi-mat-du-dai-de-ky-phien';
  it('ký rồi kiểm lại được', async () => {
    const s = { id: 'g_1', name: 'Lan', khu: '01', exp: Date.now() + 60_000 };
    expect(await verifySession(await signSession(s, secret), secret)).toEqual(s);
  });
  it('phiên bị sửa hoặc hết hạn thì vô hiệu', async () => {
    const t = await signSession({ id: 'g_1', name: 'Lan', khu: '01', exp: Date.now() + 60_000 }, secret);
    const [, mac] = t.split('.');
    expect(await verifySession(`${enc({ id: 'g_2', name: 'X', khu: '01', exp: Date.now() + 60_000 })}.${mac}`, secret)).toBeNull();
    expect(await verifySession(await signSession({ id: 'g_1', name: 'Lan', khu: '01', exp: Date.now() - 1 }, secret), secret)).toBeNull();
    expect(await verifySession(t, 'mot-bi-mat-khac-hoan-toan-123456')).toBeNull();
  });
});
