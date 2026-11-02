// Worker chính của Vạn Linh Đảo (bản chính thức, chỉ chạy web):
// - phục vụ bản web (thư mục dist)
// - /config          → client lấy Google Client ID
// - /auth/google     → đổi ID token Google lấy phiên đăng nhập của game
// - /khu/<số>/ws     → kiểm tra phiên rồi nối vào Durable Object "Hải Khu" của người chơi
import { signSession, verifyGoogleIdToken, verifySession } from './auth';
import type { Env } from './haikhu';
export { HaiKhu } from './haikhu';
export { Directory } from './directory';
export { Cho } from './cho';
import type { Directory } from './directory';
import type { Cho } from './cho';
import { PAY_CODE_RE, SPIN_PACKS } from '../../shared/gacha';

const SESSION_DAYS = 30;
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

function directory(env: Env) {
  const ns = env.DIRECTORY as unknown as DurableObjectNamespace<Directory>;
  return ns.get(ns.idFromName('main'));
}

function cho(env: Env) {
  const ns = env.CHO as unknown as DurableObjectNamespace<Cho>;
  return ns.get(ns.idFromName('world')) as unknown as { credit(player: string, khu: string, good: string, n: number, note: string): Promise<boolean> };
}
const napOpen = (env: Env) => !!(env.NAP_BANK_ID && env.NAP_BANK_ACC && env.NAP_WEBHOOK_KEY);

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
      headers.set('x-khu', m[1]);
      return stub.fetch(new Request(req, { headers }));
    }

    // ---------- MUA GÓI LƯỢT QUAY ----------
    if (p === '/nap/goi') return json({ open: napOpen(env), packs: SPIN_PACKS });
    if ((p === '/nap/tao' || p === '/nap/don') && req.method === 'POST') {
      const body = (await req.json().catch(() => ({}))) as { session?: string; pack?: string };
      const s = await verifySession(String(body.session ?? ''), await sessionSecret(env));
      if (!s) return json({ error: 'Phiên đăng nhập hết hạn' }, 401);
      if (p === '/nap/don') return json({ orders: await directory(env).napList(s.id) });
      if (!napOpen(env)) return json({ error: 'Cửa hàng gói quay chưa mở.' }, 503);
      const pack = SPIN_PACKS.find((x) => x.id === body.pack);
      if (!pack) return json({ error: 'Không có gói này' }, 400);
      const { code } = await directory(env).napCreate(s.id, pack.id, pack.spins + pack.bonus, pack.vnd);
      const qr = `https://img.vietqr.io/image/${encodeURIComponent(env.NAP_BANK_ID!)}-${encodeURIComponent(env.NAP_BANK_ACC!)}-compact2.png?amount=${pack.vnd}&addInfo=${code}&accountName=${encodeURIComponent(env.NAP_BANK_NAME ?? '')}`;
      return json({ code, vnd: pack.vnd, spins: pack.spins + pack.bonus, qr, bank: env.NAP_BANK_ID, acc: env.NAP_BANK_ACC, holder: env.NAP_BANK_NAME ?? '' });
    }
    // SePay báo có tiền vào tài khoản
    if (p === '/nap/sepay' && req.method === 'POST') {
      const auth = req.headers.get('authorization') ?? req.headers.get('x-api-key') ?? '';
      const key = auth.replace(/^(apikey|bearer)\s+/i, '').trim();
      if (!env.NAP_WEBHOOK_KEY || key !== env.NAP_WEBHOOK_KEY) return json({ success: false, error: 'Sai khoá' }, 401);
      const tx = (await req.json().catch(() => ({}))) as { id?: number | string; content?: string; code?: string; transferType?: string; transferAmount?: number; referenceCode?: string };
      if (tx.transferType && tx.transferType !== 'in') return json({ success: true });
      const code = String(tx.code ?? '').toUpperCase().match(PAY_CODE_RE)?.[0] ?? String(tx.content ?? '').toUpperCase().replace(/\s+/g, '').match(PAY_CODE_RE)?.[0];
      if (!code) return json({ success: true, note: 'Không có mã đơn' });
      const r = await directory(env).napPaid(code, Number(tx.transferAmount) || 0, String(tx.referenceCode ?? tx.id ?? ''));
      if ('error' in r) return json({ success: true, note: r.error });
      await cho(env).credit(r.player, r.khu, 'luot', r.lt, `Mua thành công ${r.lt} lượt quay (đơn ${code})`);
      return json({ success: true });
    }
    // Quản trị xác nhận đơn thủ công hoặc tặng lượt quay (đền bù, sự kiện)
    if (p === '/admin/nap' && req.method === 'POST') {
      const b = (await req.json().catch(() => ({}))) as { token?: string; player?: string; luot?: number; note?: string; code?: string };
      if (!env.ADMIN_TOKEN || b.token !== env.ADMIN_TOKEN) return json({ error: 'Cần ADMIN_TOKEN' }, 403);
      if (b.code) {
        const r = await directory(env).napPaid(String(b.code), Number.MAX_SAFE_INTEGER, `admin:${b.code}`);
        if ('error' in r) return json(r, 400);
        await cho(env).credit(r.player, r.khu, 'luot', r.lt, `Mua thành công ${r.lt} lượt quay (đơn ${b.code})`);
        return json({ ok: true, ...r });
      }
      const n = Math.floor(Number(b.luot));
      const khu = await directory(env).khuOf(String(b.player ?? ''));
      if (!khu || !(n > 0 && n <= 1000)) return json({ error: 'Sai người chơi hoặc số lượng' }, 400);
      await cho(env).credit(String(b.player), khu, 'luot', n, String(b.note ?? `Tặng ${n} lượt quay`).slice(0, 80));
      return json({ ok: true });
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
