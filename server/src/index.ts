// Worker chính của Vạn Linh Đảo (bản chính thức, chỉ chạy web):
// - phục vụ bản web (thư mục dist)
// - /config          → client lấy Google Client ID
// - /auth/google     → đổi ID token Google lấy phiên đăng nhập của game
// - /khu/<số>/ws     → kiểm tra phiên rồi nối vào Durable Object "Hải Khu" của người chơi
import { signSession, verifyGoogleIdToken, verifySession } from './auth';
import type { Env } from './haikhu';
export { HaiKhu } from './haikhu';
export { Directory } from './directory';
import type { Directory } from './directory';

const SESSION_DAYS = 30;
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

function directory(env: Env) {
  const ns = env.DIRECTORY as unknown as DurableObjectNamespace<Directory>;
  return ns.get(ns.idFromName('main'));
}

let autoSecret = '';
/** SESSION_SECRET đặt trên Cloudflare nếu có; không thì dùng khoá ngẫu nhiên server tự tạo và giữ. */
async function sessionSecret(env: Env): Promise<string> {
  if (env.SESSION_SECRET && env.SESSION_SECRET.length >= 16) return env.SESSION_SECRET;
  if (!autoSecret) autoSecret = await directory(env).secret();
  return autoSecret;
}

async function issue(env: Env, id: string, name: string) {
  const { khu } = await directory(env).assign(id, name);
  const exp = Date.now() + SESSION_DAYS * 86_400_000;
  const session = await signSession({ id, name, khu, exp }, await sessionSecret(env));
  return json({ session, id, name, khu, exp });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const p = url.pathname;

    if (p === '/health') return json({ ok: true, game: 'Vạn Linh Đảo', studio: 'Beta Holding', time: new Date().toISOString() });
    if (p === '/config') return json({ googleClientId: env.GOOGLE_CLIENT_ID ?? '', devLogin: env.DEV_LOGIN === '1' });

    if (p === '/auth/google' && req.method === 'POST') {
      try {
        const { credential } = (await req.json()) as { credential?: string };
        const user = await verifyGoogleIdToken(String(credential ?? ''), env.GOOGLE_CLIENT_ID ?? '');
        return await issue(env, `g_${user.sub}`, user.name);
      } catch (e) {
        return json({ error: (e as Error).message }, 401);
      }
    }

    // Đăng nhập thử khi chạy local (tắt trên bản chính thức: DEV_LOGIN khác "1")
    if (p === '/auth/dev' && req.method === 'POST' && env.DEV_LOGIN === '1') {
      const { name } = (await req.json()) as { name?: string };
      const n = String(name ?? 'Tester').slice(0, 18);
      const id = 'dev_' + Array.from(new TextEncoder().encode(n)).reduce((h, b) => (Math.imul(h ^ b, 16777619) >>> 0), 2166136261).toString(36);
      return issue(env, id, n);
    }

    const m = p.match(/^\/khu\/([0-9]{1,4})\/(ws|state)$/);
    if (m) {
      const stub = env.HAI_KHU.get(env.HAI_KHU.idFromName(m[1]));
      if (m[2] === 'state') return stub.fetch(req);
      const s = await verifySession(url.searchParams.get('session') ?? '', await sessionSecret(env));
      if (!s) return json({ error: 'Phiên đăng nhập hết hạn, hãy đăng nhập lại' }, 401);
      if (s.khu !== m[1]) return json({ error: 'Sai Hải Khu' }, 403);
      const headers = new Headers(req.headers);
      headers.set('x-player-id', s.id);
      headers.set('x-player-name', encodeURIComponent(s.name));
      return stub.fetch(new Request(req, { headers }));
    }

    // THƯỢNG GIỚI: để trống cho bản sau (xem shared/thuonggioi.ts)
    if (p.startsWith('/thuong-gioi')) return json({ open: false, msg: 'Thượng Giới chưa mở.' }, 501);

    if (p === '/admin/stats') {
      if (!env.ADMIN_TOKEN || url.searchParams.get('token') !== env.ADMIN_TOKEN) return json({ error: 'Cần ADMIN_TOKEN' }, 403);
      return json(await directory(env).stats());
    }

    return new Response('Vạn Linh Đảo · Beta Holding', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  },
} satisfies ExportedHandler<Env>;
