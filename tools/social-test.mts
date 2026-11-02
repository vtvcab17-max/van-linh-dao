// Kiểm thử kết bạn, nhắn riêng trên server chạy local (DEV_LOGIN=1):
//   npx tsx tools/social-test.mts http://127.0.0.1:8787
import { WebSocket } from 'ws';
const base = (process.argv[2] ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
let pass = 0, total = 0;
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
  let ready = false;
  let rid = 0;
  const waits = new Map<number, (m: Msg) => void>();
  ws.on('message', (raw) => {
    const m = JSON.parse(String(raw)) as Msg;
    if (m.t === 'welcome') ready = true;
    if (m.t === 'mr') waits.get(m.rid)?.(m);
    inbox.push(m);
  });
  await new Promise((r) => ws.on('open', r));
  while (!ready) await sleep(50);
  const m = (op: string, args: Record<string, unknown> = {}) =>
    new Promise<Msg>((done) => {
      const id = ++rid;
      waits.set(id, done);
      ws.send(JSON.stringify({ t: 'm', op, rid: id, ...args }));
    });
  return { id: sess.id as string, ws, m, inbox };
}
const tag = Date.now() % 100000;
const A = await player(`Ban A ${tag}`);
const B = await player(`Ban B ${tag}`);
const add = await A.m('fAdd', { id: B.id });
check('A gửi lời mời kết bạn', add.ok, add.msg);
await sleep(400);
check('B được báo có lời mời', B.inbox.some((x) => x.t === 'social' && x.kind === 'req'));
const lb = await B.m('fList');
check('B thấy lời mời trong danh sách', lb.ok && lb.data.incoming.some((f: any) => f.id === A.id));
const no = await A.m('dmSend', { id: B.id, text: 'chưa là bạn' });
check('Chưa là bạn thì không nhắn riêng được', !no.ok, no.msg);
const acc = await B.m('fAccept', { id: A.id });
check('B đồng ý kết bạn', acc.ok, acc.msg);
const la = await A.m('fList');
check('A thấy B trong danh sách bạn, đang online', la.ok && la.data.friends.some((f: any) => f.id === B.id && f.online));
const dm = await A.m('dmSend', { id: B.id, text: 'Chào bạn, liên minh không?' });
check('A nhắn riêng cho B', dm.ok, dm.msg);
await sleep(400);
check('B nhận tin riêng ngay', B.inbox.some((x) => x.t === 'dm' && x.msg?.body?.includes('liên minh')));
const th = await B.m('dmThread', { id: A.id });
check('B xem lại cuộc trò chuyện', th.ok && th.data.msgs.length === 1);
const lb2 = await B.m('fList');
check('Đã đọc thì hết báo tin chưa đọc', lb2.ok && !lb2.data.unread[A.id]);
const self = await A.m('fAdd', { id: A.id });
check('Không tự kết bạn với mình', !self.ok);
A.ws.close();
B.ws.close();
console.log(`\n${pass}/${total} mục đạt`);
process.exit(pass === total ? 0 : 1);
