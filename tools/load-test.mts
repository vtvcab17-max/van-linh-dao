// Thử chịu tải: nhiều người chơi giả vào cùng lúc, thao tác như người thật, đo độ trễ và lỗi.
//   npx wrangler dev --port 8790 --var DEV_LOGIN:1 --var ADMIN_TOKEN:thu-nghiem
//   npx tsx tools/load-test.mts http://127.0.0.1:8790 [số người=30] [giây=20] [ADMIN_TOKEN]
import { apply, digest, migrate, tick, type Action, type PlayerState } from '../shared/logic';

const base = (process.argv[2] ?? 'http://127.0.0.1:8790').replace(/\/$/, '');
const N = Number(process.argv[3] ?? 30);
const SECS = Number(process.argv[4] ?? 20);
const ADMIN = process.argv[5] ?? '';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pct = (a: number[], p: number) => (a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((a.length * p) / 100))] : 0);

interface Stat { connectMs: number; welcomeMs: number; rtt: number[]; acts: number; syncs: number; errs: number; closed: boolean }

async function player(i: number, tag: number): Promise<Stat> {
  const st: Stat = { connectMs: 0, welcomeMs: 0, rtt: [], acts: 0, syncs: 0, errs: 0, closed: false };
  const t0 = Date.now();
  const sess = await fetch(`${base}/auth/dev`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: `Tai${tag}x${i}` }) }).then((r) => r.json() as Promise<{ session: string; id: string; name: string; khu: string }>);
  const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/khu/${sess.khu}/ws?session=${encodeURIComponent(sess.session)}`);
  let state: PlayerState | null = null;
  let off = 0;
  const pings: number[] = [];
  let bye = false;
  await new Promise<void>((res, rej) => {
    ws.onopen = () => { st.connectMs = Date.now() - t0; };
    ws.onerror = () => rej(new Error('ws lỗi'));
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data));
      if (m.t === 'welcome') {
        st.welcomeMs = Date.now() - t0;
        state = migrate(m.state, sess.id, sess.name, Date.now());
        off = Number(m.serverNow) - Date.now();
        res();
      }
    };
  });
  ws.onmessage = (e) => {
    const m = JSON.parse(String(e.data));
    if (m.t === 'pong') {
      const at = pings.shift();
      if (at) st.rtt.push(Date.now() - at);
    } else if (m.t === 'sync') {
      st.syncs++;
      if (m.state) state = migrate(m.state, sess.id, sess.name, Date.now());
    } else if (m.t === 'error') st.errs++;
  };
  ws.onclose = () => { if (!bye) st.closed = true; };
  const end = Date.now() + SECS * 1000;
  let n = 0;
  while (Date.now() < end && state && !st.closed) {
    const s = state as PlayerState;
    const at = Date.now() + off;
    tick(s, at);
    const node = s.nodes.find((x) => s.gt >= x.readyAt);
    const a: Action = node && n % 3 === 0 ? { t: 'gather', node: node.id } : n % 3 === 1 ? { t: 'listen', lv: 'cuoc' } : { t: 'listen', lv: 'leu' };
    const o = apply(s, a);
    if (o.ok) {
      ws.send(JSON.stringify({ t: 'a', a, at, h: digest(s) }));
      st.acts++;
    }
    n++;
    pings.push(Date.now());
    ws.send(JSON.stringify({ t: 'ping' }));
    await sleep(400 + Math.random() * 600);
  }
  bye = true;
  ws.close();
  return st;
}

console.log(`Thử tải: ${N} người chơi giả trong ${SECS} giây → ${base}`);
const tag = Math.floor(Math.random() * 1e6);
const t0 = Date.now();
const all = await Promise.allSettled(Array.from({ length: N }, async (_, i) => { await sleep(i * 60); return player(i, tag); }));
const ok = all.filter((r): r is PromiseFulfilledResult<Stat> => r.status === 'fulfilled').map((r) => r.value);
const failed = all.length - ok.length;
const rtt = ok.flatMap((s) => s.rtt);
console.log(`Vào được: ${ok.length}/${N} (lỗi kết nối ${failed}) · tổng ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`Vào game (welcome) p50 ${pct(ok.map((s) => s.welcomeMs), 50)}ms · p95 ${pct(ok.map((s) => s.welcomeMs), 95)}ms`);
console.log(`Ping p50 ${pct(rtt, 50)}ms · p95 ${pct(rtt, 95)}ms · tối đa ${Math.max(0, ...rtt)}ms (${rtt.length} lần đo)`);
console.log(`Lệnh gửi ${ok.reduce((t, s) => t + s.acts, 0)} · sync lệch ${ok.reduce((t, s) => t + s.syncs, 0)} · báo lỗi ${ok.reduce((t, s) => t + s.errs, 0)} · rớt kết nối ${ok.filter((s) => s.closed).length}`);

// giới hạn tốc độ: một người gửi dồn 300 lệnh trong 1 giây phải bị chặn bớt
{
  const sess = await fetch(`${base}/auth/dev`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: `Flood${tag}` }) }).then((r) => r.json() as Promise<{ session: string; khu: string }>);
  const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/khu/${sess.khu}/ws?session=${encodeURIComponent(sess.session)}`);
  let throttled = 0;
  ws.onmessage = (e) => { const m = JSON.parse(String(e.data)); if ((m.t === 'sync' || m.t === 'error') && /nhanh quá/.test(String(m.msg ?? ''))) throttled++; };
  await new Promise<void>((r) => (ws.onopen = () => r()));
  await sleep(500);
  for (let i = 0; i < 300; i++) ws.send(JSON.stringify({ t: 'a', a: { t: 'listen', lv: 'leu' }, at: Date.now(), h: 'x' }));
  await sleep(1500);
  console.log(`Gửi dồn 300 lệnh: bị chặn ${throttled} lần ${throttled > 0 ? '(ĐẠT)' : '(LỖI: không chặn)'}`);
  ws.close();
}

if (ADMIN) {
  const sess = await fetch(`${base}/auth/dev`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: `Tai${tag}x0` }) }).then((r) => r.json() as Promise<{ khu: string }>);
  const r = await fetch(`${base}/khu/${sess.khu}/state?token=${encodeURIComponent(ADMIN)}`);
  const j = (await r.json()) as { players?: number; funnel?: { total: number; steps: { id: string; n: number; stuck: number }[] } };
  console.log(`Phễu: ${r.status} · ${j.players} người · bước 1 xong ${j.funnel?.steps[0]?.n}/${j.funnel?.total}`);
}
process.exit(0);
