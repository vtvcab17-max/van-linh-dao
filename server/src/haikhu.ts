// Durable Object "Hải Khu" — server giữ quyền quyết định.
// Máy người chơi chỉ gửi HÀNH ĐỘNG; server tự chạy đúng luật chơi dùng chung (shared/logic) rồi lưu.
// Ai sửa dữ liệu trên máy cũng không có tác dụng: server so "dấu vân tay" và gửi lại trạng thái đúng.
import { DurableObject } from 'cloudflare:workers';
import { allBots } from '../../shared/bots';
import { GAME } from '../../shared/data';
import { apply, applyRaidAgainstMe, digest, migrate, newPlayer, publicOf, tick, type Action, type IslandPub, type PlayerState } from '../../shared/logic';
import { islandCell } from '../../shared/map';

export interface Env {
  HAI_KHU: DurableObjectNamespace<HaiKhu>;
  DIRECTORY: DurableObjectNamespace;
  GOOGLE_CLIENT_ID?: string;
  SESSION_SECRET?: string;
  ADMIN_TOKEN?: string;
  DEV_LOGIN?: string;
  ALLOW_SPEED?: string;
}

interface Att {
  id: string;
  name: string;
  act: string;
  win: number;
  n: number;
}

const SAVE_EVERY_MS = 10_000; // ghi xuống SQLite theo lô, không ghi từng hành động
const ALARM_MS = 5_000; // nhịp: xử lý thuyền cập đảo, gom cập nhật đảo, lưu
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
const clean = (s: unknown, n: number) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, n);

export class HaiKhu extends DurableObject<Env> {
  sql: SqlStorage;
  private cache = new Map<string, PlayerState>();
  private dirty = new Set<string>();
  private changedPubs = new Set<string>();
  private onlineDirty = false;
  private lastSave = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    // ping giữ kết nối được Cloudflare trả lời tự động, không đánh thức Hải Khu (không tốn tiền)
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
    // Hải Khu tạo từ bản thử nghiệm cũ có cột token bắt buộc → chuyển sang bảng mới, giữ nguyên đảo
    const cols = this.sql.exec<{ name: string }>("SELECT name FROM pragma_table_info('players')").toArray().map((c) => c.name);
    if (cols.includes('token')) {
      this.sql.exec(`
        CREATE TABLE players_v2 (id TEXT PRIMARY KEY, name TEXT, save TEXT, pub TEXT, updated INTEGER);
        INSERT INTO players_v2 (id, name, save, pub, updated) SELECT id, name, save, pub, updated FROM players;
        DROP TABLE players;
        ALTER TABLE players_v2 RENAME TO players;
      `);
    }
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, name TEXT, save TEXT, pub TEXT, updated INTEGER);
      CREATE TABLE IF NOT EXISTS chat (id TEXT PRIMARY KEY, t INTEGER, body TEXT);
      CREATE TABLE IF NOT EXISTS raids (id TEXT PRIMARY KEY, target TEXT, t INTEGER, body TEXT, delivered INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS feedback (n INTEGER PRIMARY KEY AUTOINCREMENT, player TEXT, t INTEGER, body TEXT);
      CREATE TABLE IF NOT EXISTS telemetry (player TEXT PRIMARY KEY, t INTEGER, body TEXT);
    `);
  }

  // ---------- tiện ích ----------
  private sockets(): WebSocket[] {
    return this.ctx.getWebSockets();
  }
  private att(ws: WebSocket): Att {
    return ws.deserializeAttachment() as Att;
  }
  private send(ws: WebSocket, m: unknown) {
    try {
      ws.send(JSON.stringify(m));
    } catch {
      /* đã đóng */
    }
  }
  private sendTo(id: string, m: unknown) {
    for (const ws of this.ctx.getWebSockets(id)) this.send(ws, m);
  }
  private broadcast(m: unknown) {
    const s = JSON.stringify(m);
    for (const ws of this.sockets())
      try {
        ws.send(s);
      } catch {
        /* bỏ qua */
      }
  }
  private online() {
    const seen = new Map<string, string>();
    for (const ws of this.sockets()) {
      const a = this.att(ws);
      if (a?.id) seen.set(a.id, a.act);
    }
    return [...seen].map(([id, act]) => ({ id, act }));
  }

  private load(id: string): PlayerState | null {
    const c = this.cache.get(id);
    if (c) return c;
    const row = this.sql.exec<{ save: string | null; name: string }>('SELECT save, name FROM players WHERE id = ?', id).toArray()[0];
    if (!row?.save) return null;
    const s = migrate(JSON.parse(row.save), id, row.name, Date.now());
    s.speed = this.env.ALLOW_SPEED === '1' ? s.speed : 1;
    this.cache.set(id, s);
    return s;
  }

  private touch(s: PlayerState) {
    this.cache.set(s.id, s);
    this.dirty.add(s.id);
    this.changedPubs.add(s.id);
  }

  private flushSaves(force = false) {
    if (!this.dirty.size) return;
    if (!force && Date.now() - this.lastSave < SAVE_EVERY_MS) return;
    this.lastSave = Date.now();
    for (const id of [...this.dirty]) {
      const s = this.cache.get(id);
      if (!s) {
        this.dirty.delete(id);
        continue;
      }
      try {
        this.sql.exec('INSERT INTO players (id, name, save, pub, updated) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, save = excluded.save, pub = excluded.pub, updated = excluded.updated', id, s.name, JSON.stringify(s), JSON.stringify(publicOf(s)), Date.now());
        this.dirty.delete(id);
      } catch (e) {
        console.error('Lưu đảo lỗi', id, e);
      }
    }
  }

  private pubs(): IslandPub[] {
    const weekAgo = Date.now() - 7 * 86_400_000;
    const rows = this.sql.exec<{ id: string; pub: string }>('SELECT id, pub FROM players WHERE pub IS NOT NULL AND updated > ? ORDER BY updated DESC LIMIT 400', weekAgo).toArray();
    return rows.map((r) => (this.cache.has(r.id) ? publicOf(this.cache.get(r.id)!) : (JSON.parse(r.pub) as IslandPub)));
  }
  private pubOf(id: string): IslandPub | null {
    if (id.startsWith('bot-')) return allBots(Date.now()).find((b) => b.id === id) ?? null;
    const s = this.load(id);
    return s ? publicOf(s) : null;
  }

  private chatTail() {
    return this.sql
      .exec<{ body: string }>('SELECT body FROM (SELECT body, t FROM chat ORDER BY t DESC LIMIT 60) ORDER BY t ASC')
      .toArray()
      .map((r) => JSON.parse(r.body));
  }

  private async arm() {
    const cur = await this.ctx.storage.getAlarm();
    if (!cur) await this.ctx.storage.setAlarm(Date.now() + ALARM_MS);
  }

  /** Thuyền đột kích đã đánh xong → trừ thẳng vào đảo bị đánh và báo cho chủ đảo. */
  private settleRaids(s: PlayerState) {
    if (!s.outbox.length) return;
    for (const ev of s.outbox.splice(0)) {
      if (ev.targetId.startsWith('bot-')) continue;
      const target = this.load(ev.targetId);
      if (!target) continue;
      tick(target, Date.now());
      const text = applyRaidAgainstMe(target, ev);
      if (!text) continue;
      this.touch(target);
      const online = this.ctx.getWebSockets(ev.targetId).length > 0;
      if (online) this.sendTo(ev.targetId, { t: 'raided', ev, text, state: target, serverNow: Date.now() });
      else this.sql.exec('INSERT OR IGNORE INTO raids (id, target, t, body, delivered) VALUES (?, ?, ?, ?, 0)', ev.id, ev.targetId, Date.now(), JSON.stringify({ ev, text }));
    }
    this.touch(s);
  }

  // ---------- kết nối ----------
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.endsWith('/state')) {
      if (!this.env.ADMIN_TOKEN || url.searchParams.get('token') !== this.env.ADMIN_TOKEN) return json({ error: 'Cần ADMIN_TOKEN' }, 403);
      this.flushSaves(true);
      const count = this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM players').one().n;
      const feedback = this.sql.exec<{ player: string; t: number; body: string }>('SELECT player, t, body FROM feedback ORDER BY t DESC LIMIT 100').toArray().map((r) => ({ player: r.player, t: r.t, ...JSON.parse(r.body) }));
      const telemetry = this.sql.exec<{ body: string }>('SELECT body FROM telemetry ORDER BY t DESC LIMIT 100').toArray().map((r) => JSON.parse(r.body));
      return json({ players: count, online: this.online().length, top: this.pubs().sort((a, b) => b.power - a.power).slice(0, 20), feedback, telemetry });
    }
    if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'Cần kết nối WebSocket' }, 426);
    // Worker đã kiểm tra phiên đăng nhập và gắn danh tính vào header
    const id = req.headers.get('x-player-id') ?? '';
    let rawName = req.headers.get('x-player-name') ?? '';
    try {
      rawName = decodeURIComponent(rawName);
    } catch {
      /* giữ nguyên */
    }
    const name = clean(rawName, 18) || 'Người lưu lạc';
    if (!id) return json({ error: 'Chưa đăng nhập' }, 401);

    const now = Date.now();
    let s = this.load(id);
    if (!s) {
      s = newPlayer(id, name, now);
      this.touch(s);
      this.flushSaves(true);
    }
    tick(s, now);
    this.settleRaids(s);

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, [id]);
    server.serializeAttachment({ id, name: s.name, act: 'vừa vào Hải Khu', win: now, n: 0 } satisfies Att);
    this.send(server, { t: 'welcome', state: s, serverNow: Date.now(), islands: [...allBots(now), ...this.pubs().filter((p) => p.id !== id)], chat: this.chatTail(), online: this.online(), version: GAME.version });
    // tin bị đột kích lúc vắng nhà
    const pending = this.sql.exec<{ id: string; body: string }>('SELECT id, body FROM raids WHERE target = ? AND delivered = 0', id).toArray();
    for (const r of pending) {
      const { ev, text } = JSON.parse(r.body);
      this.send(server, { t: 'raided', ev, text, state: s, serverNow: Date.now(), old: true });
      this.sql.exec('UPDATE raids SET delivered = 1 WHERE id = ?', r.id);
    }
    this.onlineDirty = true;
    await this.arm();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const a = this.att(ws);
    if (!a) return ws.close(1008, 'no session');
    const now = Date.now();
    if (now - a.win > 10_000) {
      a.win = now;
      a.n = 0;
    }
    if (++a.n > 60) {
      if (a.n === 61) this.send(ws, { t: 'error', msg: 'Thao tác nhanh quá, chậm lại một chút.' });
      ws.serializeAttachment(a);
      return;
    }
    ws.serializeAttachment(a);
    if (typeof raw !== 'string' || raw.length > 20_000) return;
    let m: Record<string, unknown>;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    switch (m.t) {
      case 'ping':
        return this.send(ws, { t: 'pong', serverNow: Date.now() });
      case 'a':
        return this.onAction(ws, a, m.a as Action, Number(m.at), String(m.h ?? ''));
      case 'chat': {
        const text = clean(m.text, 140);
        if (!text) return;
        const s = this.load(a.id);
        const msg = { id: `${a.id.slice(-6)}-${now}`, from: a.id, name: s?.name ?? a.name, text, t: now };
        this.sql.exec('INSERT INTO chat (id, t, body) VALUES (?, ?, ?)', msg.id, now, JSON.stringify(msg));
        void this.arm();
        this.sql.exec('DELETE FROM chat WHERE t < (SELECT t FROM chat ORDER BY t DESC LIMIT 1 OFFSET 300)');
        return this.broadcast({ t: 'chat', msg });
      }
      case 'fb':
        this.sql.exec('INSERT INTO feedback (player, t, body) VALUES (?, ?, ?)', a.id, now, JSON.stringify(m.fb).slice(0, 4000));
        return this.send(ws, { t: 'info', msg: 'Đã nhận góp ý. Cảm ơn bạn!' });
      case 'tele':
        this.sql.exec('INSERT OR REPLACE INTO telemetry (player, t, body) VALUES (?, ?, ?)', a.id, now, JSON.stringify(m.tele).slice(0, 4000));
        return;
      case 'act':
        a.act = clean(m.act, 60);
        ws.serializeAttachment(a);
        this.onlineDirty = true;
        void this.arm();
        return;
      case 'resync': {
        const s = this.load(a.id);
        if (s) this.send(ws, { t: 'sync', state: s, serverNow: Date.now() });
        return;
      }
    }
  }

  private onAction(ws: WebSocket, a: Att, act: Action, at: number, clientHash: string) {
    const s = this.load(a.id);
    if (!s || !act || typeof act !== 'object') return;
    const now = Date.now();
    // giờ của hành động: tin máy người chơi nhưng không cho đi trước giờ server quá 3 giây, cũng không lùi về quá khứ
    const t = Math.max(s.lastReal, Math.min(Number.isFinite(at) ? at : now, now + 3000));
    if (act.t === 'speed' && this.env.ALLOW_SPEED !== '1') return this.send(ws, { t: 'sync', state: s, serverNow: now, msg: 'Bản chính thức không có tốc độ test.' });
    let action = act;
    if (act.t === 'sail' && act.kind === 'island') {
      // server tự lấy thông tin đảo bị đánh và toạ độ thật, không tin dữ liệu gửi lên
      const target = this.pubOf(String(act.target?.id ?? ''));
      if (!target) return this.send(ws, { t: 'sync', state: s, serverNow: now, msg: 'Không tìm thấy đảo này.' });
      action = { ...act, target, to: islandCell(target.id) };
    }
    tick(s, t);
    const o = apply(s, action);
    this.settleRaids(s);
    if (o.ok) {
      this.touch(s);
      void this.arm();
      if (act.t === 'rename') {
        a.name = s.name;
        ws.serializeAttachment(a);
      }
    }
    // lệch kết quả (máy bị sửa hoặc lệch giờ) → gửi lại trạng thái đúng
    if (!o.ok || (clientHash && clientHash !== digest(s))) this.send(ws, { t: 'sync', state: s, serverNow: Date.now(), msg: o.ok ? '' : o.msg });
  }

  async webSocketClose(ws: WebSocket) {
    try {
      ws.close();
    } catch {
      /* đã đóng */
    }
    this.onlineDirty = true;
    this.flushSaves(true);
    await this.arm();
  }
  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws);
  }

  /** Nhịp 5 giây: thuyền cập đảo, gom cập nhật đảo gửi một lần, lưu theo lô. */
  async alarm() {
    const now = Date.now();
    const ids = new Set(this.online().map((o) => o.id));
    let busy = false;
    // chỉ chạy luật cho người đang có thuyền ngoài biển hoặc công trình đang xây
    for (const id of ids) {
      const s = this.load(id);
      if (!s || (!s.voyage && !s.builds.length)) continue;
      busy = true;
      const before = `${s.voyage?.phase ?? '-'}:${s.builds.length}:${s.outbox.length}`;
      tick(s, now);
      this.settleRaids(s);
      if (`${s.voyage?.phase ?? '-'}:${s.builds.length}:${s.outbox.length}` !== before) this.touch(s);
    }
    if (this.changedPubs.size) {
      const list = [...this.changedPubs].map((id) => this.cache.get(id)).filter(Boolean).map((s) => publicOf(s!));
      this.changedPubs.clear();
      if (list.length) this.broadcast({ t: 'islands', list });
    }
    if (this.onlineDirty) {
      this.onlineDirty = false;
      this.broadcast({ t: 'online', list: this.online() });
    }
    this.flushSaves(!ids.size);
    // không còn ai online: thả bộ nhớ để Hải Khu được ngủ (không tính tiền)
    if (!ids.size && !this.dirty.size) this.cache.clear();
    // còn việc thì hẹn nhịp sau; hết việc thì thôi, có hành động mới sẽ hẹn lại
    if (busy || this.dirty.size || this.changedPubs.size || this.onlineDirty) await this.ctx.storage.setAlarm(Date.now() + ALARM_MS);
  }
}
