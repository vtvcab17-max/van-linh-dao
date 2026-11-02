// Kiểm thử server bản chính thức (chạy local bằng `wrangler dev` có bật DEV_LOGIN=1):
//   npm run build && npx wrangler dev --port 8787 --var DEV_LOGIN:1
//   npx tsx tools/server-test.mts http://127.0.0.1:8787
import { apply, digest, migrate, tick, type Action, type PlayerState } from '../shared/logic';

const base = (process.argv[2] ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const results: { name: string; ok: boolean; detail?: string }[] = [];
const check = (name: string, ok: boolean, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ĐẠT ' : 'LỖI '} ${name}${detail ? ' — ' + detail : ''}`);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Msg = { t: string; [k: string]: unknown };
interface Sess { session: string; id: string; name: string; khu: string }

async function devLogin(name: string): Promise<Sess> {
  const r = await fetch(`${base}/auth/dev`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) });
  return r.json();
}

function connect(s: Sess): Promise<{ ws: WebSocket; wait: (t: string, ms?: number) => Promise<Msg | null>; send: (m: unknown) => void }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/khu/${s.khu}/ws?session=${encodeURIComponent(s.session)}`);
    const inbox: Msg[] = [];
    const waiters: { t: string; r: (m: Msg | null) => void }[] = [];
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data)) as Msg;
      const w = waiters.find((x) => x.t === m.t);
      if (w) {
        waiters.splice(waiters.indexOf(w), 1);
        w.r(m);
      } else inbox.push(m);
    };
    ws.onerror = () => reject(new Error('Không mở được WebSocket'));
    const wait = (t: string, ms = 4000) =>
      new Promise<Msg | null>((r) => {
        const i = inbox.findIndex((m) => m.t === t);
        if (i >= 0) return r(inbox.splice(i, 1)[0]);
        const w = { t, r };
        waiters.push(w);
        setTimeout(() => {
          const k = waiters.indexOf(w);
          if (k >= 0) {
            waiters.splice(k, 1);
            r(null);
          }
        }, ms);
      });
    ws.onopen = () => resolve({ ws, wait, send: (m) => ws.send(JSON.stringify(m)) });
  });
}

const health = await fetch(`${base}/health`).then((r) => r.json());
check('Server sống, có credit Beta Holding', health.ok === true && health.studio === 'Beta Holding');
const cfg = await fetch(`${base}/config`).then((r) => r.json());
check('Có cấu hình đăng nhập', typeof cfg.googleClientId === 'string' && cfg.devLogin === true, cfg.devLogin ? '' : 'cần chạy wrangler dev với --var DEV_LOGIN:1');

const bad = await fetch(`${base}/auth/google`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ credential: 'a.b.c' }) });
check('Token Google giả bị từ chối', bad.status === 401);

const tag = Math.floor(Math.random() * 1e6);
const sa = await devLogin(`Tester A${tag}`);
const sb = await devLogin(`Tester B${tag}`);
check('Đăng nhập thử cấp phiên + Hải Khu', !!sa.session && /^\d+$/.test(sa.khu), `khu ${sa.khu}`);

const forged = sa.session.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
const rf = await fetch(`${base}/khu/${sa.khu}/ws?session=${encodeURIComponent(forged)}`);
check('Phiên bị sửa không vào được', rf.status === 401);

const A = await connect(sa);
const wA = await A.wait('welcome');
check('A vào Hải Khu, nhận dữ liệu đảo từ server', !!wA?.state);
let s = migrate(wA!.state, sa.id, sa.name, Date.now()) as PlayerState;
const off = Number(wA!.serverNow) - Date.now();
const now = () => Date.now() + off;

// hành động hợp lệ: server chạy cùng luật nên không gửi sync
const doAct = (a: Action) => {
  const at = now();
  tick(s, at);
  const o = apply(s, a);
  if (o.ok) A.send({ t: 'a', a, at, h: digest(s) });
  return o;
};
const node = s.nodes.find((n) => s.gt >= n.readyAt)!;
doAct({ t: 'gather', node: node.id });
doAct({ t: 'listen', lv: 'cuoc' });
doAct({ t: 'avatar', av: { g: 1, sk: 2, ha: 1, hc: 0, to: 1, tc: 1, hat: 1, it: 2 } });
check('Hành động hợp lệ khớp với server (không bị sửa)', !(await A.wait('sync', 1500)));

// gian lận: báo kết quả sai → server gửi lại trạng thái đúng
A.send({ t: 'a', a: { t: 'listen', lv: 'leu' }, at: now(), h: 'gian-lan' });
const sy = await A.wait('sync');
check('Kết quả sai bị server sửa lại', !!sy?.state);
if (sy?.state) s = migrate(sy.state, sa.id, sa.name, Date.now()) as PlayerState;

A.send({ t: 'a', a: { t: 'speed', speed: 20 }, at: now(), h: '' });
const sp = await A.wait('sync');
check('Không tăng tốc được ở bản chính thức', !!sp && (sp.state as PlayerState).speed === 1);

A.send({ t: 'a', a: { t: 'avatar', av: { g: 9 } }, at: now(), h: '' });
const av = await A.wait('sync');
check('Dáng vẻ không hợp lệ bị từ chối', !!av && String(av.msg).length > 0, String(av?.msg ?? ''));

const B = await connect(sb);
const wB = await B.wait('welcome');
check('B vào cùng Hải Khu', !!wB && sb.khu === sa.khu);
const seesA = ((wB?.islands as { id: string; avatar?: { g: number } }[]) ?? []).find((p) => p.id === sa.id);
check('B thấy đảo và nhân vật của A', !!seesA && seesA.avatar?.g === 1);

A.send({ t: 'chat', text: 'Chào Hải Khu!' });
const ch = await B.wait('chat');
check('Chat tới người khác', (ch?.msg as { text?: string })?.text === 'Chào Hải Khu!');

// tải lại: dữ liệu vẫn còn trên server
A.ws.close();
await sleep(600);
const A2 = await connect(sa);
const w2 = await A2.wait('welcome');
const s2 = w2?.state as PlayerState;
check('Vào lại: đảo còn nguyên trên server', !!s2 && s2.res.co === s.res.co && s2.avatar.hat === 1, `cỏ ${s2?.res.co}/${s.res.co}`);

const adm = await fetch(`${base}/admin/stats`);
check('Thống kê cần mật khẩu quản trị', adm.status === 403);

A2.ws.close();
B.ws.close();
const ok = results.filter((r) => r.ok).length;
console.log(`\n${ok}/${results.length} mục đạt`);
process.exit(ok === results.length ? 0 : 1);
