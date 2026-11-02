// Bạn bè, nhắn riêng, liên minh thương hội.
import type { UI } from './ui';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
interface Friend {
  id: string;
  name: string;
  khu: string;
  online?: boolean;
}
interface Dm {
  fr: string;
  frName: string;
  too: string;
  t: number;
  body: string;
}
let dmOpenWith = '';
let bound = false;

/** Gắn một lần: tin nhắn riêng và lời mời tới thì báo. */
function bind(ui: UI) {
  if (bound) return;
  bound = true;
  ui.store.net.on('dm', (d) => {
    const m = d as Dm;
    if (dmOpenWith === m.fr && ui.sheetKindPublic() === 'dm') {
      const box = document.getElementById('dmList');
      if (box) {
        box.insertAdjacentHTML('beforeend', line(ui, m));
        box.scrollTop = box.scrollHeight;
      }
      return;
    }
    ui.toast(`✉ ${m.frName}: ${m.body.slice(0, 60)}`, 'gold', 5000);
    document.querySelector('#nav [data-tab="chat"]')?.classList.add('badge');
  });
  ui.store.net.on('social', (d) => {
    const m = d as { kind: string; from: string };
    ui.toast(m.kind === 'req' ? `${m.from} muốn kết bạn với bạn.` : `${m.from} đã đồng ý kết bạn.`, 'gold', 5000);
  });
}

const line = (ui: UI, m: Dm) =>
  `<div class="msg ${m.fr === ui.store.net.meId ? 'me' : ''}"><b>${esc(m.frName)}</b><span>${esc(m.body)}</span><time>${new Date(m.t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time></div>`;

/** Bảng bạn bè: lời mời, danh sách, thêm bạn, liên minh hội. */
export async function openFriends(ui: UI) {
  bind(ui);
  const net = ui.store.net;
  if (!net.market) return ui.openSheet('friends', 'Bạn bè', '<p class="muted">Bạn bè và nhắn riêng chỉ có ở bản chính thức.</p>');
  const tabs = `<div class="seg tabs3"><button type="button" data-ct="world">Thế giới</button><button type="button" data-ct="friends" aria-checked="true">Bạn bè</button><button type="button" data-ct="ally">Liên minh</button></div>`;
  ui.openSheet('friends', 'Bạn bè', `${tabs}<p class="muted">Đang tải...</p>`);
  const r = await net.market('fList');
  if (!r.ok) return ui.toast(r.msg, 'bad');
  const d = r.data as { friends: Friend[]; incoming: Friend[]; outgoing: string[]; unread: Record<string, number> };
  const html = `${tabs}
    ${d.incoming.length ? `<div class="card"><small>Lời mời kết bạn</small>${d.incoming.map((f) => `<div class="isle-b"><span><b>${esc(f.name)}</b> <small>Hải Khu ${esc(f.khu)}</small></span><span><button type="button" class="primary" data-acc="${esc(f.id)}">Đồng ý</button><button type="button" data-rm="${esc(f.id)}">Từ chối</button></span></div>`).join('')}</div>` : ''}
    <div class="card"><small>Bạn bè (${d.friends.length})</small>${d.friends.length ? d.friends.map((f) => `<button type="button" class="friend" data-dm="${esc(f.id)}" data-name="${esc(f.name)}"><i class="${f.online ? 'on' : ''}"></i><b>${esc(f.name)}</b><small>Hải Khu ${esc(f.khu)}</small>${d.unread[f.id] ? `<em>${d.unread[f.id]}</em>` : ''}</button>`).join('') : '<p class="muted small">Chưa có bạn. Ra Hải Khu chạm đảo của ai đó rồi bấm "Kết bạn", hoặc nhập ID bên dưới.</p>'}</div>
    <form class="row" id="addF"><input id="fid" placeholder="ID người chơi (xem trong Cài đặt)" style="flex:1"><button class="primary">Kết bạn</button></form>
    <p class="muted small">ID của bạn: <b class="code">${esc(net.meId)}</b> · Nhắn riêng chỉ giữa bạn bè.</p>`;
  ui.openSheet('friends', 'Bạn bè', html, (body) => {
    body.addEventListener('click', async (e) => {
      const t = (e.target as HTMLElement).closest('button');
      if (!t) return;
      if (t.dataset.ct === 'world') return ui.openChat();
      if (t.dataset.ct === 'ally') return openAlliance(ui);
      if (t.dataset.dm) return openDm(ui, { id: t.dataset.dm, name: t.dataset.name ?? '', khu: '' });
      let o: { ok: boolean; msg: string } | null = null;
      if (t.dataset.acc) o = await net.market!('fAccept', { id: t.dataset.acc });
      else if (t.dataset.rm) o = await net.market!('fRemove', { id: t.dataset.rm });
      if (o) {
        ui.toast(o.msg, o.ok ? 'gold' : 'bad');
        void openFriends(ui);
      }
    });
    body.querySelector('#addF')!.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = (body.querySelector<HTMLInputElement>('#fid')!.value || '').trim();
      if (!id) return;
      const o = await net.market!('fAdd', { id });
      ui.toast(o.msg, o.ok ? 'gold' : 'bad');
    });
  });
}

/** Kết bạn từ bảng đảo người khác. */
export async function addFriend(ui: UI, id: string, name: string) {
  bind(ui);
  if (!ui.store.net.market) return ui.toast('Chỉ có ở bản chính thức.', 'bad');
  const o = await ui.store.net.market('fAdd', { id, name });
  ui.toast(o.msg, o.ok ? 'gold' : 'bad');
}

/** Khung nhắn riêng với một người bạn. */
export async function openDm(ui: UI, f: Friend) {
  bind(ui);
  const net = ui.store.net;
  const r = await net.market!('dmThread', { id: f.id });
  const msgs = (r.data?.msgs as Dm[]) ?? [];
  dmOpenWith = f.id;
  const html = `<div class="chat" id="dmList">${msgs.map((m) => line(ui, m)).join('') || '<p class="muted small">Chưa có tin nào. Chào một câu đi!</p>'}</div>
    <form class="chat-in" id="dmForm"><input id="dmText" maxlength="300" placeholder="Nhắn riêng cho ${esc(f.name)}..." autocomplete="off"><button class="primary">Gửi</button></form>
    <button type="button" class="wide" id="dmBack">← Bạn bè</button>`;
  ui.openSheet('dm', `Nhắn riêng · ${f.name}`, html, (body) => {
    const box = body.querySelector<HTMLElement>('#dmList')!;
    setTimeout(() => (box.scrollTop = box.scrollHeight), 30);
    body.querySelector('#dmBack')!.addEventListener('click', () => {
      dmOpenWith = '';
      void openFriends(ui);
    });
    body.querySelector<HTMLFormElement>('#dmForm')!.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = body.querySelector<HTMLInputElement>('#dmText')!;
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      const o = await net.market!('dmSend', { id: f.id, text });
      if (!o.ok) return ui.toast(o.msg, 'bad');
      if (box.querySelector('p.muted')) box.innerHTML = '';
      box.insertAdjacentHTML('beforeend', line(ui, o.data as Dm));
      box.scrollTop = box.scrollHeight;
    });
  });
}

/** Liên minh thương hội: đồng minh thấy thuyền, lãnh thổ của nhau. */
export async function openAlliance(ui: UI) {
  const net = ui.store.net;
  const s = ui.store.s;
  const tabs = `<div class="seg tabs3"><button type="button" data-ct="world">Thế giới</button><button type="button" data-ct="friends">Bạn bè</button><button type="button" data-ct="ally" aria-checked="true">Liên minh</button></div>`;
  if (!s.guild) return ui.openSheet('ally', 'Liên minh', `${tabs}<p class="muted">Bạn chưa vào thương hội nào. Vào Chợ → Thương hội để lập hoặc gia nhập hội.</p>`, (b) => b.addEventListener('click', (e) => clickTabs(ui, e)));
  const [a, l] = await Promise.all([net.market!('gAllies'), net.market!('gList')]);
  const allies = (a.data?.allies ?? []) as { id: string; name: string; tag: string; members: number }[];
  const asks = (a.data?.asks ?? []) as { from: string; other: string; g: { id: string; name: string; tag: string } | null }[];
  const guilds = ((l.data?.guilds ?? []) as { id: string; name: string; tag: string; members: number; lv: number }[]).filter((g) => g.id !== s.guild!.id && !allies.some((x) => x.id === g.id));
  const html = `${tabs}
    <div class="card"><small>Thương hội của bạn</small><p><b>${esc(s.guild.name)}</b> [${esc(s.guild.tag)}] · cấp ${s.guild.lv}</p>
      <p class="muted small">Đồng minh thấy tên chủ thuyền và lãnh thổ của nhau (màu xanh dương) trên hải đồ. Mỗi hội tối đa 3 đồng minh. Chỉ hội trưởng mới kết hoặc hủy liên minh.</p></div>
    <div class="card"><small>Đồng minh (${allies.length}/3)</small>${allies.map((g) => `<div class="isle-b"><span><b>${esc(g.name)}</b> [${esc(g.tag)}] · ${g.members} người</span><button type="button" data-end="${esc(g.id)}">Hủy</button></div>`).join('') || '<p class="muted small">Chưa có đồng minh.</p>'}</div>
    ${asks.length ? `<div class="card"><small>Lời mời liên minh</small>${asks.map((x) => `<div class="isle-b"><span>${x.from === s.guild!.id ? 'Đã mời' : 'Mời bạn'}: <b>${esc(x.g?.name ?? '?')}</b> [${esc(x.g?.tag ?? '')}]</span>${x.from === s.guild!.id ? '' : `<button type="button" class="primary" data-ally="${esc(x.other)}">Kết liên minh</button>`}</div>`).join('')}</div>` : ''}
    <div class="card"><small>Các thương hội khác</small>${guilds.slice(0, 20).map((g) => `<div class="isle-b"><span><b>${esc(g.name)}</b> [${esc(g.tag)}] · cấp ${g.lv} · ${g.members} người</span><button type="button" data-ally="${esc(g.id)}">Mời liên minh</button></div>`).join('') || '<p class="muted small">Chưa có hội nào khác.</p>'}</div>`;
  ui.openSheet('ally', 'Liên minh', html, (body) => {
    body.addEventListener('click', async (e) => {
      if (clickTabs(ui, e)) return;
      const t = (e.target as HTMLElement).closest('button');
      if (!t) return;
      let o: { ok: boolean; msg: string } | null = null;
      if (t.dataset.ally) o = await net.market!('gAlly', { id: t.dataset.ally });
      else if (t.dataset.end) o = await net.market!('gAllyEnd', { id: t.dataset.end });
      if (o) {
        ui.toast(o.msg, o.ok ? 'gold' : 'bad');
        void openAlliance(ui);
      }
    });
  });
}
function clickTabs(ui: UI, e: Event): boolean {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-ct]');
  if (!t) return false;
  if (t.dataset.ct === 'world') ui.openChat();
  else if (t.dataset.ct === 'friends') void openFriends(ui);
  else void openAlliance(ui);
  return true;
}
