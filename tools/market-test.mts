// Kiểm thử chợ thế giới, đặt mua, đấu giá, thương hội trên server chạy local (DEV_LOGIN=1):
//   npm run build && npx wrangler dev --port 8787 --var DEV_LOGIN:1
//   npx tsx tools/market-test.mts http://127.0.0.1:8787
import type { PlayerState } from '../shared/logic';

const base = (process.argv[2] ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
let pass = 0,
  total = 0;
const check = (name: string, ok: boolean, detail = '') => {
  total++;
  if (ok) pass++;
  console.log(`${ok ? 'ĐẠT ' : 'LỖI '} ${name}${detail ? ' — ' + detail : ''}`);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Msg = { t: string; [k: string]: any };

async function player(name: string) {
  const sess = await (await fetch(`${base}/auth/dev`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) })).json();
  const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/khu/${sess.khu}/ws?session=${encodeURIComponent(sess.session)}`);
  const inbox: Msg[] = [];
  let state: PlayerState | null = null;
  let rid = 0;
  const waits = new Map<number, (m: Msg) => void>();
  ws.onmessage = (e) => {
    const m = JSON.parse(String(e.data)) as Msg;
    if (m.state) state = m.state;
    if (m.t === 'mr') waits.get(m.rid)?.(m);
    inbox.push(m);
  };
  await new Promise((r) => (ws.onopen = r));
  while (!state) await sleep(50);
  const m = (op: string, args: Record<string, unknown> = {}) =>
    new Promise<Msg>((done) => {
      const id = ++rid;
      waits.set(id, done);
      ws.send(JSON.stringify({ t: 'm', op, rid: id, ...args }));
    });
  return { sess, ws, m, get s() { return state!; }, inbox };
}

const tag = Date.now() % 100000;
const A = await player(`Chủ Sạp ${tag}`);
const B = await player(`Khách ${tag}`);
check('Hai người vào chung chợ', !!A.s && !!B.s);

const npc = await A.m('search', { cat: 'all' });
check('Thương buôn NPC bày hàng và thu mua', npc.ok && npc.data.listings.some((l: any) => l.npc) && npc.data.orders.some((o: any) => o.npc), `${npc.data?.listings?.length} món, ${npc.data?.orders?.length} lệnh mua`);

const co0 = A.s.res.co;
const L = await A.m('list', { good: 'co', n: 5, price: 3, kind: 'fixed' });
await sleep(200);
check('Đăng bán: hàng bị giữ ở chợ', L.ok && A.s.res.co === co0 - 5, L.msg);

const tienB = B.s.res.tien;
const buy = await B.m('buy', { id: L.data.id, n: 2 });
await sleep(300);
check('Mua lẻ: trừ tiền, nhận hàng', buy.ok && B.s.res.tien === tienB - 6 && buy.data.n === 2, buy.msg);
await sleep(800);
check('Người bán nhận tiền qua hộp thư (trừ phí 5%)', A.s.res.tien >= 50 + 5, `tiền A ${A.s.res.tien}`);

const self = await A.m('buy', { id: L.data.id, n: 1 });
check('Không tự mua hàng của mình', !self.ok, self.msg);

const tienB2 = B.s.res.tien;
const O = await B.m('order', { good: 'tre', n: 3, price: 2 });
await sleep(200);
check('Đặt giá mua: ký quỹ tiền', O.ok && B.s.res.tien === tienB2 - 6, O.msg);
const tre0 = B.s.res.tre;
const F = await A.m('fill', { id: O.data.id, good: 'tre', n: 3 });
await sleep(900);
check('Bán vào lệnh mua: người bán nhận tiền, người mua nhận hàng', F.ok && B.s.res.tre === tre0 + 3, F.msg);

const AU = await A.m('list', { good: 'da', n: 2, price: 4, kind: 'auction', hours: 1 });
const low = await B.m('bid', { id: AU.data.id, amount: 3 });
check('Đấu giá: trả thấp hơn khởi điểm bị từ chối', !low.ok, low.msg);
const tienB3 = B.s.res.tien;
const bid = await B.m('bid', { id: AU.data.id, amount: 5 });
await sleep(200);
check('Đấu giá: trả giá, tiền bị giữ', bid.ok && B.s.res.tien === tienB3 - 5, bid.msg);
const cancel = await A.m('cancel', { id: AU.data.id });
check('Phiên đã có người trả thì không gỡ được', !cancel.ok, cancel.msg);

const mine = await A.m('mine');
check('Xem đơn của tôi', mine.ok && mine.data.listings.length >= 2);

const g = await A.m('gCreate', { name: 'Hội Thử', tag: 'HT' });
await sleep(200);
check('Lập thương hội cần đủ 1000 tiền, thiếu thì hoàn lại', !g.ok && A.s.res.tien > 0, g.msg);
const gl = await A.m('gList');
check('Xem danh sách thương hội', gl.ok && Array.isArray(gl.data.guilds));

A.ws.close();
B.ws.close();
console.log(`\n${pass}/${total} mục đạt`);
process.exit(pass === total ? 0 : 1);
