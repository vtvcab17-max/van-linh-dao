// Durable Object "Hải Khu" — server giữ quyền quyết định.
// Máy người chơi chỉ gửi HÀNH ĐỘNG; server tự chạy đúng luật chơi dùng chung (shared/logic) rồi lưu.
// Ai sửa dữ liệu trên máy cũng không có tác dụng: server so "dấu vân tay" và gửi lại trạng thái đúng.
import { DurableObject } from 'cloudflare:workers';
import { allBots } from '../../shared/bots';
import { GAME } from '../../shared/data';
import { apply, applyRaidAgainstMe, ascend, digest, migrate, newPlayer, publicOf, tick, type Action, type IslandPub, type PlayerState } from '../../shared/logic';
import { ascendSlots, bossPoolMax, weekOf, type BossWorld } from '../../shared/boss';
import { islandCell } from '../../shared/map';
import { giveGood, haveGood, takeGood, goodLabel } from '../../shared/logic';
import { bLevel, GUILD_COST, isGood, marketFee } from '../../shared/economy';
import type { Cho, Mail } from './cho';

/** Các hàm của Chợ gọi được từ Hải Khu (gọi xuyên Durable Object). */
type ChoApi = Pick<Cho, 'search' | 'mine' | 'list' | 'buy' | 'cancel' | 'order' | 'fill' | 'bid' | 'claim' | 'memberOf' | 'gList' | 'gInfo' | 'gCreate' | 'gJoin' | 'gLeave' | 'gDonate' | 'gKick'>;

export interface Env {
  HAI_KHU: DurableObjectNamespace<HaiKhu>;
  DIRECTORY: DurableObjectNamespace;
  CHO: DurableObjectNamespace<Cho>;
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
  private khu = '';
  private dirty = new Set<string>();
  private changedPubs = new Set<string>();
  private onlineDirty = false;
  private lastSave = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    void ctx.blockConcurrencyWhile(async () => {
      this.khu = (await ctx.storage.get<string>('khu')) ?? '';
    });
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
      CREATE TABLE IF NOT EXISTS boss (week INTEGER PRIMARY KEY, hp INTEGER, max INTEGER, slots INTEGER, done INTEGER, winners TEXT);
      CREATE TABLE IF NOT EXISTS boss_dmg (week INTEGER, player TEXT, name TEXT, dmg INTEGER, PRIMARY KEY (week, player));
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

  // ---------- Thủy Tinh: máu chung cả Hải Khu ----------
  private activeCount() {
    return this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM players WHERE updated > ?', Date.now() - 7 * 86_400_000).one().n;
  }
  /** Tình hình Thủy Tinh tuần này (tạo mới khi sang tuần). */
  bossWorld(now = Date.now()): BossWorld {
    const week = weekOf(now);
    let row = this.sql.exec<{ hp: number; max: number; slots: number; done: number; winners: string }>('SELECT hp, max, slots, done, winners FROM boss WHERE week = ?', week).toArray()[0];
    if (!row) {
      const active = this.activeCount();
      const max = bossPoolMax(active);
      row = { hp: max, max, slots: ascendSlots(active), done: 0, winners: '[]' };
      this.sql.exec('INSERT OR IGNORE INTO boss (week, hp, max, slots, done, winners) VALUES (?, ?, ?, ?, 0, ?)', week, row.hp, row.max, row.slots, '[]');
    }
    const top = this.sql.exec<{ player: string; name: string; dmg: number }>('SELECT player, name, dmg FROM boss_dmg WHERE week = ? ORDER BY dmg DESC LIMIT 10', week).toArray().map((r) => ({ id: r.player, name: r.name, dmg: r.dmg }));
    return { week, hp: Math.max(0, row.hp), max: row.max, slots: row.slots, done: !!row.done, top, winners: JSON.parse(row.winners || '[]') };
  }
  /** Cộng sát thương người chơi vừa gây vào máu chung; hạ được thì mở Thiên Môn. */
  private settleBoss(s: PlayerState) {
    if (!s.bossOut?.length) return;
    const now = Date.now();
    const w = this.bossWorld(now);
    for (const o of s.bossOut.splice(0)) {
      if (o.w !== w.week || w.done || !(o.d > 0)) continue;
      const d = Math.min(Math.floor(o.d), 200_000);
      this.sql.exec('INSERT INTO boss_dmg (week, player, name, dmg) VALUES (?, ?, ?, ?) ON CONFLICT(week, player) DO UPDATE SET dmg = dmg + excluded.dmg, name = excluded.name', w.week, s.id, s.name, d);
      this.sql.exec('UPDATE boss SET hp = hp - ? WHERE week = ?', d, w.week);
    }
    this.touch(s);
    const after = this.bossWorld(now);
    if (after.hp <= 0 && !after.done) this.openThienMon(after);
    else this.broadcast({ t: 'boss', boss: after });
  }
  /** Thủy Tinh đã bị hạ: chọn người góp sát thương nhiều nhất (chưa từng phi thăng) cho phi thăng. */
  private openThienMon(w: BossWorld) {
    const rows = this.sql.exec<{ player: string; name: string; dmg: number }>('SELECT player, name, dmg FROM boss_dmg WHERE week = ? ORDER BY dmg DESC', w.week).toArray();
    const winners: { id: string; name: string }[] = [];
    for (const r of rows) {
      if (winners.length >= w.slots) break;
      const p = this.load(r.player);
      if (!p || p.asc > 0) continue;
      tick(p, Date.now());
      const text = ascend(p, winners.length + 1);
      winners.push({ id: p.id, name: p.name });
      this.touch(p);
      this.sendTo(p.id, { t: 'sync', state: p, serverNow: Date.now(), msg: text });
    }
    this.sql.exec('UPDATE boss SET done = 1, hp = 0, winners = ? WHERE week = ?', JSON.stringify(winners), w.week);
    // ai đang online cũng biết Thủy Tinh đã bị hạ tuần này
    for (const id of new Set(this.online().map((o) => o.id))) {
      const p = this.load(id);
      if (!p) continue;
      p.thienMon = { week: w.week, done: true };
      this.touch(p);
    }
    const names = winners.map((x) => x.name).join(', ') || 'chưa ai đủ điều kiện';
    this.broadcast({ t: 'boss', boss: this.bossWorld() });
    this.broadcast({ t: 'info', msg: `Thủy Tinh đã bị cả Hải Khu hạ! Thiên Môn mở cho: ${names}.` });
  }

  /** Thuyền đột kích đã đánh xong → trừ thẳng vào đảo bị đánh và báo cho chủ đảo. */
  private settleRaids(s: PlayerState) {
    this.settleBoss(s);
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

    const khu = req.headers.get('x-khu') ?? '';
    if (khu && khu !== this.khu) {
      this.khu = khu;
      await this.ctx.storage.put('khu', khu);
    }
    const now = Date.now();
    let s = this.load(id);
    if (!s) {
      s = newPlayer(id, name, now);
      this.touch(s);
      this.flushSaves(true);
    }
    tick(s, now);
    this.settleRaids(s);
    const bw = this.bossWorld(now);
    s.thienMon = { week: bw.week, done: bw.done };
    // hàng, tiền từ chợ gửi tới lúc vắng nhà; thương hội
    await this.claimMail(s);
    try {
      s.guild = await this.cho().memberOf(id);
    } catch {
      /* chợ chưa sẵn sàng */
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, [id]);
    server.serializeAttachment({ id, name: s.name, act: 'vừa vào Hải Khu', win: now, n: 0 } satisfies Att);
    this.send(server, { t: 'welcome', state: s, serverNow: Date.now(), islands: [...allBots(now), ...this.pubs().filter((p) => p.id !== id)], chat: this.chatTail(), online: this.online(), version: GAME.version, boss: bw });
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
      case 'm':
        return void this.onMarket(ws, a, m);
      case 'resync': {
        const s = this.load(a.id);
        if (s) this.send(ws, { t: 'sync', state: s, serverNow: Date.now() });
        return;
      }
    }
  }

  private cho(): ChoApi {
    return this.env.CHO.get(this.env.CHO.idFromName('world')) as unknown as ChoApi;
  }

  /** Nhận thư từ chợ (tiền bán hàng, hàng mua được, tiền hoàn) vào đảo. */
  private async claimMail(s: PlayerState): Promise<Mail[]> {
    let mail: Mail[] = [];
    try {
      mail = await this.cho().claim(s.id);
    } catch {
      return [];
    }
    for (const m of mail) giveGood(s, m.good, m.n);
    if (mail.length) this.touch(s);
    return mail;
  }

  /** Chợ gọi sang khi có thư cho người chơi đang online ở Hải Khu này. */
  async deliver(player: string) {
    if (!this.ctx.getWebSockets(player).length) return;
    const s = this.load(player);
    if (!s) return;
    const mail = await this.claimMail(s);
    if (!mail.length) return;
    const note = mail.map((m) => `${m.note}: ${m.good === 'tien' ? `+${m.n} tiền` : `${m.n} ${goodLabel(m.good)}`}`).slice(0, 4).join(' · ');
    this.sendTo(player, { t: 'sync', state: s, serverNow: Date.now(), msg: `Thư từ chợ: ${note}` });
    await this.arm();
  }

  /** Giao dịch chợ thế giới, thương hội: server làm hết, máy chỉ nhận kết quả. */
  private async onMarket(ws: WebSocket, a: Att, m: Record<string, unknown>) {
    const rid = m.rid;
    const s = this.load(a.id);
    if (!s) return;
    const reply = (ok: boolean, msg: string, data?: unknown, changed = false) => {
      if (changed) this.touch(s);
      this.send(ws, { t: 'mr', rid, ok, msg, data });
      if (changed) this.send(ws, { t: 'sync', state: s, serverNow: Date.now() });
    };
    const cho = this.cho();
    const num = (v: unknown) => Math.floor(Number(v));
    const fee = marketFee(bLevel(s.dinh, 'cho'), !!s.guild);
    tick(s, Date.now());
    try {
      switch (m.op) {
        case 'search': {
          const r = await cho.search(String(m.q ?? '').slice(0, 30), String(m.cat ?? 'all'), String(m.sort ?? 'new'));
          return reply(r.ok, r.msg, r.data);
        }
        case 'mine': {
          const mail = await this.claimMail(s);
          const r = await cho.mine(s.id);
          return reply(true, mail.length ? `Nhận ${mail.length} thư từ chợ.` : '', r.data, mail.length > 0);
        }
        case 'list': {
          const good = String(m.good);
          const n = num(m.n);
          const price = num(m.price);
          const kind = m.kind === 'auction' ? 'auction' : 'fixed';
          if (!isGood(good) || !(n > 0) || !(price > 0)) return reply(false, 'Đơn hàng không hợp lệ.');
          if (haveGood(s, good) < n) return reply(false, `Không đủ ${goodLabel(good)}.`);
          takeGood(s, good, n);
          const r = await cho.list(s.id, s.name, this.khu, good, n, price, kind, num(m.hours) || 6, fee);
          if (!r.ok) giveGood(s, good, n);
          return reply(r.ok, r.msg, r.data, true);
        }
        case 'buy': {
          const hold = s.res.tien;
          s.res.tien = 0;
          const r = await cho.buy(String(m.id), s.id, num(m.n) || 1, hold);
          s.res.tien += hold - (r.ok ? r.data!.total : 0);
          if (r.ok) giveGood(s, r.data!.good, r.data!.n);
          return reply(r.ok, r.msg, r.data, true);
        }
        case 'order': {
          const good = String(m.good);
          const n = num(m.n);
          const price = num(m.price);
          if (!isGood(good) || !(n > 0) || !(price > 0)) return reply(false, 'Lệnh mua không hợp lệ.');
          const total = n * price;
          if (s.res.tien < total) return reply(false, `Cần ${total} tiền để ký quỹ lệnh mua.`);
          s.res.tien -= total;
          const r = await cho.order(s.id, s.name, this.khu, good, n, price);
          if (!r.ok) s.res.tien += total;
          return reply(r.ok, r.msg, r.data, true);
        }
        case 'fill': {
          const good = String(m.good);
          const n = num(m.n);
          if (!isGood(good) || !(n > 0) || haveGood(s, good) < n) return reply(false, `Không đủ ${goodLabel(good)} để bán.`);
          takeGood(s, good, n);
          const r = await cho.fill(String(m.id), s.id, n, fee);
          if (r.ok) {
            const sold = r.data!.n;
            if (sold < n) giveGood(s, good, n - sold);
            s.res.tien += r.data!.total;
          } else giveGood(s, good, n);
          return reply(r.ok, r.ok ? `${r.msg} +${r.data!.total} tiền.` : r.msg, r.data, true);
        }
        case 'bid': {
          const amount = num(m.amount);
          if (!(amount > 0) || s.res.tien < amount) return reply(false, 'Không đủ tiền để trả giá.');
          s.res.tien -= amount;
          const r = await cho.bid(String(m.id), s.id, s.name, this.khu, amount);
          if (!r.ok) s.res.tien += amount;
          return reply(r.ok, r.msg, r.data, true);
        }
        case 'cancel': {
          const r = await cho.cancel(String(m.id), s.id);
          await this.claimMail(s);
          return reply(r.ok, r.msg, r.data, true);
        }
        // ----- thương hội -----
        case 'gList':
          return reply(true, '', (await cho.gList()).data);
        case 'gInfo': {
          const r = await cho.gInfo(String(m.id));
          return reply(r.ok, r.msg, r.data);
        }
        case 'gCreate': {
          if (s.res.tien < GUILD_COST) return reply(false, `Lập thương hội cần ${GUILD_COST} tiền.`);
          s.res.tien -= GUILD_COST;
          const r = await cho.gCreate(s.id, s.name, this.khu, String(m.name ?? ''), String(m.tag ?? ''), String(m.about ?? ''));
          if (!r.ok) s.res.tien += GUILD_COST;
          s.guild = await cho.memberOf(s.id);
          return reply(r.ok, r.msg, r.data, true);
        }
        case 'gJoin':
        case 'gLeave':
        case 'gKick':
        case 'gDonate': {
          let r;
          if (m.op === 'gJoin') r = await cho.gJoin(s.id, s.name, this.khu, String(m.id));
          else if (m.op === 'gLeave') r = await cho.gLeave(s.id);
          else if (m.op === 'gKick') r = await cho.gKick(s.id, String(m.who));
          else {
            const n = num(m.n);
            if (!(n > 0) || s.res.tien < n) return reply(false, 'Không đủ tiền.');
            s.res.tien -= n;
            r = await cho.gDonate(s.id, n);
            if (!r.ok) s.res.tien += n;
          }
          s.guild = await cho.memberOf(s.id);
          return reply(r.ok, r.msg, r.data, true);
        }
      }
      reply(false, 'Không rõ yêu cầu.');
    } catch (e) {
      reply(false, 'Chợ đang bận, thử lại sau. ' + String((e as Error).message ?? '').slice(0, 80), undefined, true);
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
