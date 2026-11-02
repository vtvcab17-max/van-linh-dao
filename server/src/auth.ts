// Đăng nhập bằng Google: kiểm tra ID token Google bằng khoá công khai của Google (JWKS),
// rồi cấp "phiên" của riêng game (ký HMAC) để mở kết nối Hải Khu.
// Game chỉ dùng mã tài khoản (sub) và tên hiển thị; không đọc Gmail, không lưu email.

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

type Fetcher = (url: string) => Promise<Response>;
let jwksCache: { keys: (JsonWebKey & { kid?: string })[]; exp: number } | null = null;

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function bytesToB64url(b: Uint8Array): string {
  let bin = '';
  for (const x of b) bin += String.fromCharCode(x);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getJwks(fetcher: Fetcher, force = false) {
  if (!force && jwksCache && jwksCache.exp > Date.now()) return jwksCache.keys;
  const r = await fetcher(JWKS_URL);
  if (!r.ok) throw new Error('Không lấy được khoá Google');
  const j = (await r.json()) as { keys: (JsonWebKey & { kid?: string })[] };
  const maxAge = Number(/max-age=(\d+)/.exec(r.headers.get('cache-control') ?? '')?.[1] ?? 3600);
  jwksCache = { keys: j.keys, exp: Date.now() + Math.min(maxAge, 86400) * 1000 };
  return j.keys;
}

export interface GoogleUser {
  sub: string;
  name: string;
}

/** Kiểm tra ID token do nút "Đăng nhập bằng Google" trả về. Sai ở bất kỳ bước nào → ném lỗi. */
export async function verifyGoogleIdToken(token: string, clientId: string, fetcher: Fetcher = (u) => fetch(u)): Promise<GoogleUser> {
  if (!clientId) throw new Error('Server chưa cấu hình GOOGLE_CLIENT_ID');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Token không hợp lệ');
  const [h, p, sig] = parts;
  const header = JSON.parse(dec.decode(b64urlToBytes(h))) as { alg?: string; kid?: string };
  const payload = JSON.parse(dec.decode(b64urlToBytes(p))) as Record<string, unknown>;
  if (header.alg !== 'RS256') throw new Error('Sai thuật toán ký');
  let keys = await getJwks(fetcher);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    keys = await getJwks(fetcher, true); // Google vừa xoay khoá
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) throw new Error('Không tìm thấy khoá ký');
  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(sig), enc.encode(`${h}.${p}`));
  if (!ok) throw new Error('Chữ ký không đúng');
  const now = Date.now() / 1000;
  if (!ISSUERS.includes(String(payload.iss))) throw new Error('Không phải token của Google');
  if (payload.aud !== clientId) throw new Error('Token không dành cho game này');
  if (typeof payload.exp !== 'number' || payload.exp < now - 60) throw new Error('Token đã hết hạn');
  if (payload.email_verified === false) throw new Error('Email Google chưa xác minh');
  const sub = String(payload.sub ?? '');
  if (!/^\d{5,30}$/.test(sub)) throw new Error('Thiếu mã tài khoản');
  const name = String(payload.given_name || payload.name || 'Người lưu lạc')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .slice(0, 18);
  return { sub, name };
}

export interface Session {
  id: string; // mã người chơi trong game, ví dụ g_1234...
  name: string;
  khu: string;
  exp: number; // ms
}

async function hmacKey(secret: string) {
  if (!secret || secret.length < 16) throw new Error('Server chưa cấu hình SESSION_SECRET (ít nhất 16 ký tự)');
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signSession(s: Session, secret: string): Promise<string> {
  const body = bytesToB64url(enc.encode(JSON.stringify(s)));
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body)));
  return `${body}.${bytesToB64url(mac)}`;
}

export async function verifySession(token: string, secret: string): Promise<Session | null> {
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), b64urlToBytes(mac), enc.encode(body));
  if (!ok) return null;
  const s = JSON.parse(dec.decode(b64urlToBytes(body))) as Session;
  if (!s.id || !s.khu || s.exp < Date.now()) return null;
  return s;
}

/** Chỉ dùng cho kiểm thử: xoá bộ nhớ khoá Google. */
export function _resetJwksCache() {
  jwksCache = null;
}
