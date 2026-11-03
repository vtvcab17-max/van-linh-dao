// Chợ Vạn Đảo — một Durable Object chung cho cả thế giới (mọi Hải Khu):
// đăng bán giá cố định, đấu giá, đặt giá mua, lịch sử giá, thương hội, hộp thư giao hàng.
// Hàng và tiền luôn được giữ (ký quỹ) trước khi vào chợ nên không thể bán khống hay mua chịu.
import { DurableObject } from 'cloudflare:workers';
import { goodLabel } from '../../shared/logic';
import { GUILD_COST, guildLevel, guildMax, isGood, ITEMS, MERCHANTS, routePeriod, goodRarity, type GoodKey } from '../../shared/economy';
import { hashStr, mulberry32 } from '../../shared/rng';
import type { Env } from './haikhu';

export type Listing = {
  id: string;
  seller: string;
  sellerName: string;
  khu: string;
  good: string;
  n: number;
  price: number;
  kind: 'fixed' | 'auction';
  bidder: string | null;
  bidderName: string | null;
  bidderKhu: string | null;
  ends: number;
  fee: number;
  npc: number;
  created: number;
};
export type Order = {
  id: string;
  buyer: string;
  buyerName: string;
  khu: string;
  good: string;
  n: number;
  price: number;
  npc: number;
  created: number;
};
export type Mail = {
  id: number;
  good: string;
  n: number;
  note: string;
};
export type Guild = {
  id: string;
  name: string;
  tag: string;
  leader: string;
  leaderName: string;
  fund: number;
  about: string;
  members: number;
  lv: number;
};

type R<T = unknown> = { ok: boolean; msg: string; data?: T };
const ok = <T>(data?: T, msg = ''): R<T> => ({ ok: true, msg, data });
const no = (msg: string): R<never> => ({ ok: false, msg });
const FIXED_MS = 72 * 3600_000;
const SWEEP_MS = 60_000;

export class Cho extends DurableObject<Env> {
  sql: SqlStorage;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS listings (id TEXT PRIMARY KEY, seller TEXT, sellerName TEXT, khu TEXT, good TEXT, n INTEGER, price INTEGER, kind TEXT, bidder TEXT, bidderName TEXT, bidderKhu TEXT, ends INTEGER, fee REAL, npc INTEGER DEFAULT 0, created INTEGER);
      CREATE INDEX IF NOT EXISTS listings_good ON listings(good);
      CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, buyer TEXT, buyerName TEXT, khu TEXT, good TEXT, n INTEGER, price INTEGER, npc INTEGER DEFAULT 0, created INTEGER);
      CREATE TABLE IF NOT EXISTS mail (id INTEGER PRIMARY KEY AUTOINCREMENT, player TEXT, khu TEXT, good TEXT, n INTEGER, note TEXT, t INTEGER);
      CREATE INDEX IF NOT EXISTS mail_player ON mail(player);
      CREATE TABLE IF NOT EXISTS trades (id INTEGER PRIMARY KEY AUTOINCREMENT, good TEXT, n INTEGER, price INTEGER, t INTEGER);
      CREATE TABLE IF NOT EXISTS guilds (id TEXT PRIMARY KEY, name TEXT UNIQUE, tag TEXT UNIQUE, leader TEXT, leaderName TEXT, fund INTEGER DEFAULT 0, about TEXT, created INTEGER);
      CREATE TABLE IF NOT EXISTS gmembers (player TEXT PRIMARY KEY, guild TEXT, name TEXT, khu TEXT, joined INTEGER, donated INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS friend_req (fr TEXT, too TEXT, frName TEXT, frKhu TEXT, t INTEGER, PRIMARY KEY (fr, too));
      CREATE TABLE IF NOT EXISTS friends (a TEXT, b TEXT, aName TEXT, bName TEXT, aKhu TEXT, bKhu TEXT, t INTEGER, PRIMARY KEY (a, b));
      CREATE TABLE IF NOT EXISTS dm (id INTEGER PRIMARY KEY AUTOINCREMENT, fr TEXT, too TEXT, frName TEXT, t INTEGER, body TEXT, seen INTEGER DEFAULT 0);
      CREATE INDEX IF NOT EXISTS dm_too ON dm(too);
      CREATE TABLE IF NOT EXISTS gally (a TEXT, b TEXT, status TEXT, t INTEGER, PRIMARY KEY (a, b));
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
    `);
  }

  private nid(p: string) {
    return `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  }
  private async arm() {
    if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + SWEEP_MS);
  }

  /** Nạp Linh Thạch thành công (hoặc quản trị cộng tay): gửi vào hộp thư người chơi. */
  async credit(player: string, khu: string, good: string, n: number, note: string) {
    this.mail(player, khu, good, n, note);
    return true;
  }

  /** Gửi vào hộp thư rồi báo Hải Khu của người nhận để giao ngay nếu họ đang online. */
  private mail(player: string, khu: string, good: string, n: number, note: string) {
    if (!player || player.startsWith('npc:') || n <= 0) return;
    this.sql.exec('INSERT INTO mail (player, khu, good, n, note, t) VALUES (?, ?, ?, ?, ?, ?)', player, khu, good, Math.floor(n), note, Date.now());
    this.ctx.waitUntil(this.ping(player, khu));
  }
  private async ping(player: string, khu: string) {
    try {
      const stub = this.env.HAI_KHU.get(this.env.HAI_KHU.idFromName(khu)) as unknown as { deliver(p: string): Promise<void> };
      await stub.deliver(player);
    } catch {
      /* người nhận nhận lúc vào lại */
    }
  }
  private trade(good: string, n: number, unit: number) {
    this.sql.exec('INSERT INTO trades (good, n, price, t) VALUES (?, ?, ?, ?)', good, n, unit, Date.now());
    this.sql.exec('DELETE FROM trades WHERE id < (SELECT MAX(id) FROM trades) - 2000');
  }

  // ---------- xem chợ ----------
  async search(q: string, cat: string, sort: string): Promise<R> {
    await this.ensureNpc();
    const rows = this.sql.exec<Listing>('SELECT * FROM listings ORDER BY created DESC LIMIT 600').toArray();
    const ords = this.sql.exec<Order>('SELECT * FROM orders ORDER BY price DESC LIMIT 400').toArray();
    const qq = q.trim().toLowerCase();
    const match = (g: string) => {
      if (cat === 'res' && (g.startsWith('g_') || g in ITEMS)) return false;
      if (cat === 'item' && !(g in ITEMS)) return false;
      if (cat === 'gear' && !g.startsWith('g_')) return false;
      if (cat === 'rare' && goodRarity(g) === 'thường') return false;
      return !qq || goodLabel(g).toLowerCase().includes(qq) || g.includes(qq);
    };
    let list = rows.filter((l) => match(l.good));
    if (sort === 'price') list.sort((a, b) => a.price - b.price);
    else if (sort === 'ending') list = list.filter((l) => l.kind === 'auction').sort((a, b) => a.ends - b.ends);
    const prices: Record<string, { avg: number; n: number }> = {};
    for (const t of this.sql.exec<{ good: string; price: number }>('SELECT good, price FROM trades ORDER BY id DESC LIMIT 600').toArray()) {
      const p = (prices[t.good] ??= { avg: 0, n: 0 });
      if (p.n < 20) {
        p.avg = (p.avg * p.n + t.price) / (p.n + 1);
        p.n++;
      }
    }
    return ok({ listings: list.slice(0, 80), orders: ords.filter((o) => match(o.good)).slice(0, 60), prices, now: Date.now() });
  }

  async mine(player: string): Promise<R> {
    return ok({
      listings: this.sql.exec<Listing>('SELECT * FROM listings WHERE seller = ? OR bidder = ? ORDER BY created DESC', player, player).toArray(),
      orders: this.sql.exec<Order>('SELECT * FROM orders WHERE buyer = ? ORDER BY created DESC', player).toArray(),
      now: Date.now(),
    });
  }

  // ---------- đăng bán, mua ----------
  async list(seller: string, sellerName: string, khu: string, good: string, n: number, price: number, kind: 'fixed' | 'auction', hours: number, fee: number): Promise<R<{ id: string }>> {
    if (!isGood(good) || n < 1 || n > 100000 || price < 1 || price > 10_000_000) return no('Đơn hàng không hợp lệ.');
    const mineN = this.sql.exec<{ c: number }>('SELECT COUNT(*) AS c FROM listings WHERE seller = ?', seller).one().c;
    if (mineN >= 20) return no('Mỗi người đăng tối đa 20 món cùng lúc.');
    const id = this.nid('L');
    const ends = Date.now() + (kind === 'auction' ? Math.max(1, Math.min(48, hours)) * 3600_000 : FIXED_MS);
    this.sql.exec('INSERT INTO listings (id, seller, sellerName, khu, good, n, price, kind, bidder, bidderName, bidderKhu, ends, fee, npc, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, 0, ?)', id, seller, sellerName, khu, good, Math.floor(n), Math.floor(price), kind, ends, fee, Date.now());
    await this.arm();
    return ok({ id }, kind === 'auction' ? 'Đã mở phiên đấu giá.' : 'Đã bày hàng lên chợ.');
  }

  /** Mua giá cố định. n: số lượng muốn mua (mua lẻ được). Trả tổng tiền phải trả, không quá maxTotal. */
  async buy(id: string, buyer: string, n: number, maxTotal: number): Promise<R<{ good: string; n: number; total: number }>> {
    const l = this.sql.exec<Listing>('SELECT * FROM listings WHERE id = ?', id).toArray()[0];
    if (!l) return no('Món hàng đã có người mua hoặc đã gỡ.');
    if (l.kind !== 'fixed') return no('Món này đang đấu giá.');
    if (l.seller === buyer) return no('Không tự mua hàng của mình.');
    const take = Math.max(1, Math.min(l.n, Math.floor(n)));
    const total = take * l.price;
    if (total > maxTotal) return no('Không đủ tiền đồng.');
    if (take === l.n) this.sql.exec('DELETE FROM listings WHERE id = ?', id);
    else this.sql.exec('UPDATE listings SET n = n - ? WHERE id = ?', take, id);
    this.mail(l.seller, l.khu, 'tien', Math.floor(total * (1 - l.fee)), `Bán ${take} ${goodLabel(l.good)}`);
    this.trade(l.good, take, l.price);
    return ok({ good: l.good, n: take, total }, `Đã mua ${take} ${goodLabel(l.good)}.`);
  }

  async cancel(id: string, player: string): Promise<R> {
    const l = this.sql.exec<Listing>('SELECT * FROM listings WHERE id = ? AND seller = ?', id, player).toArray()[0];
    if (l) {
      if (l.kind === 'auction' && l.bidder) return no('Phiên đấu giá đã có người trả, không gỡ được.');
      this.sql.exec('DELETE FROM listings WHERE id = ?', id);
      this.mail(l.seller, l.khu, l.good, l.n, 'Gỡ hàng khỏi chợ');
      return ok(undefined, 'Đã gỡ hàng, hàng về hộp thư.');
    }
    const o = this.sql.exec<Order>('SELECT * FROM orders WHERE id = ? AND buyer = ?', id, player).toArray()[0];
    if (o) {
      this.sql.exec('DELETE FROM orders WHERE id = ?', id);
      this.mail(o.buyer, o.khu, 'tien', o.n * o.price, 'Hủy đặt mua');
      return ok(undefined, 'Đã hủy đặt mua, tiền về hộp thư.');
    }
    return no('Không thấy đơn này.');
  }

  // ---------- đặt giá mua (lệnh mua) ----------
  async order(buyer: string, buyerName: string, khu: string, good: string, n: number, price: number): Promise<R<{ id: string }>> {
    if (!isGood(good) || n < 1 || price < 1) return no('Lệnh mua không hợp lệ.');
    const c = this.sql.exec<{ c: number }>('SELECT COUNT(*) AS c FROM orders WHERE buyer = ?', buyer).one().c;
    if (c >= 20) return no('Mỗi người đặt tối đa 20 lệnh mua.');
    const id = this.nid('O');
    this.sql.exec('INSERT INTO orders (id, buyer, buyerName, khu, good, n, price, npc, created) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)', id, buyer, buyerName, khu, good, Math.floor(n), Math.floor(price), Date.now());
    return ok({ id }, `Đã đặt mua ${n} ${goodLabel(good)} giá ${price}.`);
  }

  /** Bán vào lệnh mua của người khác. Trả số tiền người bán nhận (đã trừ phí). */
  async fill(id: string, seller: string, n: number, fee: number): Promise<R<{ good: string; n: number; total: number }>> {
    const o = this.sql.exec<Order>('SELECT * FROM orders WHERE id = ?', id).toArray()[0];
    if (!o) return no('Lệnh mua đã hết.');
    if (o.buyer === seller) return no('Không tự bán cho mình.');
    const take = Math.max(1, Math.min(o.n, Math.floor(n)));
    if (take === o.n) this.sql.exec('DELETE FROM orders WHERE id = ?', id);
    else this.sql.exec('UPDATE orders SET n = n - ? WHERE id = ?', take, id);
    this.mail(o.buyer, o.khu, o.good, take, `Mua được từ chợ`);
    this.trade(o.good, take, o.price);
    return ok({ good: o.good, n: take, total: Math.floor(take * o.price * (1 - fee)) }, `Đã bán ${take} ${goodLabel(o.good)}.`);
  }

  // ---------- đấu giá ----------
  async bid(id: string, bidder: string, bidderName: string, khu: string, amount: number): Promise<R> {
    const l = this.sql.exec<Listing>('SELECT * FROM listings WHERE id = ?', id).toArray()[0];
    if (!l || l.kind !== 'auction') return no('Phiên đấu giá không còn.');
    if (l.ends <= Date.now()) return no('Phiên đấu giá đã kết thúc.');
    if (l.seller === bidder) return no('Không tự trả giá hàng của mình.');
    const min = l.bidder ? Math.ceil(l.price * 1.05) : l.price;
    if (amount < min) return no(`Phải trả ít nhất ${min}.`);
    if (l.bidder) this.mail(l.bidder, l.bidderKhu ?? khu, 'tien', l.price, `Bị trả giá cao hơn: ${goodLabel(l.good)}`);
    // trả giá phút chót thì gia hạn 2 phút cho công bằng
    const ends = Math.max(l.ends, Date.now() + 120_000);
    this.sql.exec('UPDATE listings SET price = ?, bidder = ?, bidderName = ?, bidderKhu = ?, ends = ? WHERE id = ?', Math.floor(amount), bidder, bidderName, khu, ends, id);
    await this.arm();
    return ok(undefined, `Bạn đang giữ giá cao nhất: ${amount}.`);
  }

  // ---------- hộp thư ----------
  async claim(player: string): Promise<Mail[]> {
    const rows = this.sql.exec<Mail>('SELECT id, good, n, note FROM mail WHERE player = ? ORDER BY id LIMIT 200', player).toArray();
    if (rows.length) this.sql.exec(`DELETE FROM mail WHERE id IN (${rows.map((r) => r.id).join(',')})`);
    return rows;
  }

  // ---------- thương hội ----------
  private guildOf(id: string): Guild | null {
    const g = this.sql.exec<Omit<Guild, 'members' | 'lv'>>('SELECT id, name, tag, leader, leaderName, fund, about FROM guilds WHERE id = ?', id).toArray()[0];
    if (!g) return null;
    const members = this.sql.exec<{ c: number }>('SELECT COUNT(*) AS c FROM gmembers WHERE guild = ?', id).one().c;
    return { ...g, members, lv: guildLevel(g.fund) };
  }
  async memberOf(player: string): Promise<{ id: string; name: string; tag: string; lv: number; allies: string[]; allyTags: string[] } | null> {
    const m = this.sql.exec<{ guild: string }>('SELECT guild FROM gmembers WHERE player = ?', player).toArray()[0];
    const g = m && this.guildOf(m.guild);
    return g ? { id: g.id, name: g.name, tag: g.tag, lv: g.lv, allies: this.alliesOf(g.id), allyTags: this.alliesOf(g.id).map((x) => this.guildOf(x)?.tag ?? '').filter(Boolean) } : null;
  }
  async gList(): Promise<R> {
    const ids = this.sql.exec<{ id: string }>('SELECT id FROM guilds ORDER BY fund DESC LIMIT 50').toArray();
    return ok({ guilds: ids.map((r) => this.guildOf(r.id)).filter(Boolean) });
  }
  async gInfo(id: string): Promise<R> {
    const g = this.guildOf(id);
    if (!g) return no('Không có thương hội này.');
    const members = this.sql.exec('SELECT player, name, joined, donated FROM gmembers WHERE guild = ? ORDER BY donated DESC', id).toArray();
    return ok({ guild: g, members });
  }
  async gCreate(player: string, pname: string, khu: string, name: string, tag: string, about: string): Promise<R> {
    name = name.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24);
    tag = tag.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase().slice(0, 4);
    if (name.length < 3 || tag.length < 2) return no('Tên hội ít nhất 3 chữ, ký hiệu 2–4 chữ.');
    if (await this.memberOf(player)) return no('Bạn đang ở một thương hội khác.');
    if (this.sql.exec('SELECT 1 FROM guilds WHERE name = ? OR tag = ?', name, tag).toArray().length) return no('Tên hoặc ký hiệu đã có hội dùng.');
    const id = this.nid('G');
    this.sql.exec('INSERT INTO guilds (id, name, tag, leader, leaderName, fund, about, created) VALUES (?, ?, ?, ?, ?, 0, ?, ?)', id, name, tag, player, pname, about.slice(0, 140), Date.now());
    this.sql.exec('INSERT INTO gmembers (player, guild, name, khu, joined, donated) VALUES (?, ?, ?, ?, ?, 0)', player, id, pname, khu, Date.now());
    return ok({ id }, `Đã lập thương hội ${name} [${tag}] (tốn ${GUILD_COST} tiền).`);
  }
  async gJoin(player: string, pname: string, khu: string, id: string): Promise<R> {
    if (await this.memberOf(player)) return no('Rời hội cũ trước đã.');
    const g = this.guildOf(id);
    if (!g) return no('Không có thương hội này.');
    if (g.members >= guildMax(g.lv)) return no('Hội đã đủ người.');
    this.sql.exec('INSERT INTO gmembers (player, guild, name, khu, joined, donated) VALUES (?, ?, ?, ?, ?, 0)', player, id, pname, khu, Date.now());
    return ok(undefined, `Đã vào thương hội ${g.name}.`);
  }
  async gLeave(player: string): Promise<R> {
    const m = this.sql.exec<{ guild: string }>('SELECT guild FROM gmembers WHERE player = ?', player).toArray()[0];
    if (!m) return no('Bạn chưa vào hội nào.');
    this.sql.exec('DELETE FROM gmembers WHERE player = ?', player);
    const g = this.guildOf(m.guild);
    if (g && g.members === 0) this.sql.exec('DELETE FROM guilds WHERE id = ?', g.id);
    else if (g && g.leader === player) {
      const next = this.sql.exec<{ player: string; name: string }>('SELECT player, name FROM gmembers WHERE guild = ? ORDER BY donated DESC LIMIT 1', g.id).toArray()[0];
      if (next) this.sql.exec('UPDATE guilds SET leader = ?, leaderName = ? WHERE id = ?', next.player, next.name, g.id);
    }
    return ok(undefined, 'Đã rời thương hội.');
  }
  async gDonate(player: string, n: number): Promise<R> {
    const m = this.sql.exec<{ guild: string }>('SELECT guild FROM gmembers WHERE player = ?', player).toArray()[0];
    if (!m) return no('Bạn chưa vào hội nào.');
    this.sql.exec('UPDATE guilds SET fund = fund + ? WHERE id = ?', Math.floor(n), m.guild);
    this.sql.exec('UPDATE gmembers SET donated = donated + ? WHERE player = ?', Math.floor(n), player);
    return ok(undefined, `Đã góp ${n} tiền vào quỹ hội.`);
  }
  async gKick(leader: string, who: string): Promise<R> {
    const m = this.sql.exec<{ guild: string }>('SELECT guild FROM gmembers WHERE player = ?', leader).toArray()[0];
    const g = m && this.guildOf(m.guild);
    if (!g || g.leader !== leader) return no('Chỉ hội trưởng mới mời người ra.');
    if (who === leader) return no('Hội trưởng muốn đi thì bấm Rời hội.');
    this.sql.exec('DELETE FROM gmembers WHERE player = ? AND guild = ?', who, g.id);
    return ok(undefined, 'Đã mời ra khỏi hội.');
  }

  // ---------- bạn bè, nhắn riêng ----------
  private pair(x: string, y: string): [string, string] {
    return x < y ? [x, y] : [y, x];
  }
  private isFriend(x: string, y: string) {
    const [a, b] = this.pair(x, y);
    return this.sql.exec('SELECT 1 FROM friends WHERE a = ? AND b = ?', a, b).toArray().length > 0;
  }
  private async notify(player: string, khu: string, msg: unknown) {
    try {
      const stub = this.env.HAI_KHU.get(this.env.HAI_KHU.idFromName(khu)) as unknown as { push(p: string, m: unknown): Promise<void> };
      await stub.push(player, msg);
    } catch {
      /* người nhận xem lúc vào lại */
    }
  }
  /** Gửi lời mời kết bạn; nếu người kia đã mời mình thì thành bạn luôn. */
  async fAdd(me: string, meName: string, meKhu: string, other: string, otherName: string, otherKhu: string): Promise<R> {
    if (!other || other === me) return no('Không kết bạn với chính mình được.');
    if (this.isFriend(me, other)) return no('Hai người đã là bạn.');
    const back = this.sql.exec('SELECT 1 FROM friend_req WHERE fr = ? AND too = ?', other, me).toArray().length > 0;
    if (back) return this.fAccept(me, meName, meKhu, other);
    const n = this.sql.exec<{ c: number }>('SELECT COUNT(*) AS c FROM friend_req WHERE fr = ?', me).one().c;
    if (n >= 30) return no('Bạn đang chờ quá nhiều lời mời.');
    this.sql.exec('INSERT OR REPLACE INTO friend_req (fr, too, frName, frKhu, t) VALUES (?, ?, ?, ?, ?)', me, other, meName, meKhu, Date.now());
    if (otherKhu) this.ctx.waitUntil(this.notify(other, otherKhu, { t: 'social', kind: 'req', from: meName }));
    return ok(undefined, `Đã gửi lời mời kết bạn tới ${otherName || other}.`);
  }
  async fAccept(me: string, meName: string, meKhu: string, other: string): Promise<R> {
    const r = this.sql.exec<{ frName: string; frKhu: string }>('SELECT frName, frKhu FROM friend_req WHERE fr = ? AND too = ?', other, me).toArray()[0];
    if (!r) return no('Không có lời mời này.');
    this.sql.exec('DELETE FROM friend_req WHERE (fr = ? AND too = ?) OR (fr = ? AND too = ?)', other, me, me, other);
    const [a, b] = this.pair(me, other);
    const aIsMe = a === me;
    this.sql.exec('INSERT OR REPLACE INTO friends (a, b, aName, bName, aKhu, bKhu, t) VALUES (?, ?, ?, ?, ?, ?, ?)', a, b, aIsMe ? meName : r.frName, aIsMe ? r.frName : meName, aIsMe ? meKhu : r.frKhu, aIsMe ? r.frKhu : meKhu, Date.now());
    this.ctx.waitUntil(this.notify(other, r.frKhu, { t: 'social', kind: 'friend', from: meName }));
    return ok(undefined, `${r.frName} và bạn đã là bạn bè.`);
  }
  async fRemove(me: string, other: string): Promise<R> {
    const [a, b] = this.pair(me, other);
    this.sql.exec('DELETE FROM friends WHERE a = ? AND b = ?', a, b);
    this.sql.exec('DELETE FROM friend_req WHERE (fr = ? AND too = ?) OR (fr = ? AND too = ?)', other, me, me, other);
    return ok(undefined, 'Đã xóa.');
  }
  async fList(me: string): Promise<R> {
    const friends = this.sql
      .exec<{ a: string; b: string; aName: string; bName: string; aKhu: string; bKhu: string }>('SELECT a, b, aName, bName, aKhu, bKhu FROM friends WHERE a = ? OR b = ?', me, me)
      .toArray()
      .map((f) => (f.a === me ? { id: f.b, name: f.bName, khu: f.bKhu } : { id: f.a, name: f.aName, khu: f.aKhu }));
    const incoming = this.sql.exec<{ fr: string; frName: string; frKhu: string }>('SELECT fr, frName, frKhu FROM friend_req WHERE too = ?', me).toArray().map((r) => ({ id: r.fr, name: r.frName, khu: r.frKhu }));
    const outgoing = this.sql.exec<{ too: string }>('SELECT too FROM friend_req WHERE fr = ?', me).toArray().map((r) => r.too);
    const unread = this.sql.exec<{ fr: string; c: number }>('SELECT fr, COUNT(*) AS c FROM dm WHERE too = ? AND seen = 0 GROUP BY fr', me).toArray();
    return ok({ friends, incoming, outgoing, unread: Object.fromEntries(unread.map((u) => [u.fr, u.c])) });
  }
  /** Nhắn riêng: chỉ giữa bạn bè (chống làm phiền). */
  async dmSend(me: string, meName: string, other: string, body: string): Promise<R> {
    body = body.replace(/[ -]/g, ' ').trim().slice(0, 300);
    if (!body) return no('Chưa có nội dung.');
    if (!this.isFriend(me, other)) return no('Chỉ nhắn riêng được với bạn bè. Gửi lời mời kết bạn trước.');
    const t = Date.now();
    this.sql.exec('INSERT INTO dm (fr, too, frName, t, body, seen) VALUES (?, ?, ?, ?, ?, 0)', me, other, meName, t, body);
    const [a, b] = this.pair(me, other);
    const f = this.sql.exec<{ a: string; aKhu: string; bKhu: string }>('SELECT a, aKhu, bKhu FROM friends WHERE a = ? AND b = ?', a, b).toArray()[0];
    const khu = f ? (f.a === other ? f.aKhu : f.bKhu) : '';
    if (khu) this.ctx.waitUntil(this.notify(other, khu, { t: 'dm', msg: { fr: me, frName: meName, too: other, t, body } }));
    // giữ 200 tin gần nhất mỗi cặp
    this.sql.exec('DELETE FROM dm WHERE id IN (SELECT id FROM dm WHERE (fr = ? AND too = ?) OR (fr = ? AND too = ?) ORDER BY id DESC LIMIT -1 OFFSET 200)', me, other, other, me);
    return ok({ fr: me, frName: meName, too: other, t, body });
  }
  async dmThread(me: string, other: string): Promise<R> {
    const rows = this.sql.exec<{ fr: string; frName: string; too: string; t: number; body: string }>('SELECT fr, frName, too, t, body FROM dm WHERE (fr = ? AND too = ?) OR (fr = ? AND too = ?) ORDER BY id DESC LIMIT 60', me, other, other, me).toArray().reverse();
    this.sql.exec('UPDATE dm SET seen = 1 WHERE fr = ? AND too = ?', other, me);
    return ok({ msgs: rows });
  }

  // ---------- liên minh thương hội ----------
  private leaderGuild(player: string): Guild | null {
    const m = this.sql.exec<{ guild: string }>('SELECT guild FROM gmembers WHERE player = ?', player).toArray()[0];
    const g = m && this.guildOf(m.guild);
    return g && g.leader === player ? g : null;
  }
  /** Các hội đã kết liên minh với hội này. */
  alliesOf(guild: string): string[] {
    return this.sql
      .exec<{ a: string; b: string }>("SELECT a, b FROM gally WHERE (a = ? OR b = ?) AND status = 'dong'", guild, guild)
      .toArray()
      .map((r) => (r.a === guild ? r.b : r.a));
  }
  async gAlly(player: string, target: string): Promise<R> {
    const g = this.leaderGuild(player);
    if (!g) return no('Chỉ hội trưởng mới kết liên minh.');
    if (g.id === target || !this.guildOf(target)) return no('Không có thương hội này.');
    const [a, b] = this.pair(g.id, target);
    const cur = this.sql.exec<{ status: string }>('SELECT status FROM gally WHERE a = ? AND b = ?', a, b).toArray()[0];
    if (cur?.status === 'dong') return no('Hai hội đã là đồng minh.');
    if (cur && cur.status === `xin:${target}`) {
      this.sql.exec("UPDATE gally SET status = 'dong', t = ? WHERE a = ? AND b = ?", Date.now(), a, b);
      return ok(undefined, 'Đã kết liên minh!');
    }
    if (this.alliesOf(g.id).length >= 3) return no('Mỗi hội tối đa 3 đồng minh.');
    this.sql.exec('INSERT OR REPLACE INTO gally (a, b, status, t) VALUES (?, ?, ?, ?)', a, b, `xin:${g.id}`, Date.now());
    return ok(undefined, 'Đã gửi lời mời liên minh. Hội trưởng bên kia bấm Kết liên minh để đồng ý.');
  }
  async gAllyEnd(player: string, target: string): Promise<R> {
    const g = this.leaderGuild(player);
    if (!g) return no('Chỉ hội trưởng mới hủy liên minh.');
    const [a, b] = this.pair(g.id, target);
    this.sql.exec('DELETE FROM gally WHERE a = ? AND b = ?', a, b);
    return ok(undefined, 'Đã hủy liên minh.');
  }
  async gAllies(guild: string): Promise<R> {
    const allies = this.alliesOf(guild).map((id) => this.guildOf(id)).filter(Boolean);
    const asks = this.sql
      .exec<{ a: string; b: string; status: string }>("SELECT a, b, status FROM gally WHERE (a = ? OR b = ?) AND status LIKE 'xin:%'", guild, guild)
      .toArray()
      .map((r) => ({ from: r.status.slice(4), other: r.a === guild ? r.b : r.a }))
      .map((x) => ({ ...x, g: this.guildOf(x.other) }));
    return ok({ allies, asks });
  }

  // ---------- thương buôn NPC ----------
  /** Mỗi khung 6 giờ, các thương hội NPC bày hàng và đặt mua tài nguyên theo tuyến buôn của mình. */
  private async ensureNpc() {
    const period = routePeriod(Date.now());
    const cur = this.sql.exec<{ v: string }>("SELECT v FROM meta WHERE k = 'npc'").toArray()[0]?.v;
    if (cur === String(period)) return;
    this.sql.exec("INSERT OR REPLACE INTO meta (k, v) VALUES ('npc', ?)", String(period));
    // phiên đấu giá của thương buôn cũ: ai đang giữ giá cao nhất thì nhận hàng
    for (const l of this.sql.exec<Listing>('SELECT * FROM listings WHERE npc = 1 AND bidder IS NOT NULL').toArray()) this.mail(l.bidder!, l.bidderKhu ?? '', l.good, l.n, `Thắng đấu giá ${goodLabel(l.good)}`);
    this.sql.exec('DELETE FROM listings WHERE npc = 1');
    this.sql.exec('DELETE FROM orders WHERE npc = 1');
    const now = Date.now();
    for (const m of MERCHANTS) {
      const r = mulberry32(hashStr(`npcmarket:${m.id}:${period}`));
      for (const g of m.goods) {
        const isItem = g in ITEMS;
        const n = isItem ? 1 + Math.floor(r() * (ITEMS[g as keyof typeof ITEMS].rarity === 'huyền thoại' ? 1 : 3)) : 150 + Math.floor(r() * 250);
        const unit = isItem ? Math.round(ITEMS[g as keyof typeof ITEMS].value * (1.05 + r() * 0.35)) : g === 'ngoc' ? 140 : g === 'so' ? 2 : 1 + Math.round(r() * 0.6);
        // món huyền thoại chỉ thỉnh thoảng mới có
        if (isItem && ITEMS[g as keyof typeof ITEMS].rarity === 'huyền thoại' && r() > 0.35) continue;
        this.sql.exec('INSERT INTO listings (id, seller, sellerName, khu, good, n, price, kind, bidder, bidderName, bidderKhu, ends, fee, npc, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, 0, 1, ?)', this.nid('N'), `npc:${m.id}`, m.name, '', g, isItem && g === 'vayrong' ? 1 : n, unit, isItem && r() < 0.4 ? 'auction' : 'fixed', now + 6 * 3600_000, now);
      }
      // thương buôn thu mua tài nguyên: người chơi bán lấy tiền
      const wants: GoodKey[] = ['co', 'la', 'tre', 'go', 'cui', 'da', 'sat'];
      for (let i = 0; i < 2; i++) {
        const g = wants[Math.floor(r() * wants.length)];
        this.sql.exec('INSERT INTO orders (id, buyer, buyerName, khu, good, n, price, npc, created) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)', this.nid('M'), `npc:${m.id}`, m.name, '', g, 300 + Math.floor(r() * 500), g === 'sat' ? 2 : 1, now);
      }
    }
    void MERCHANTS;
  }

  /** Mỗi phút: chốt phiên đấu giá hết giờ, trả hàng bày quá hạn. */
  async alarm() {
    const now = Date.now();
    for (const l of this.sql.exec<Listing>('SELECT * FROM listings WHERE ends <= ?', now).toArray()) {
      this.sql.exec('DELETE FROM listings WHERE id = ?', l.id);
      if (l.kind === 'auction' && l.bidder) {
        this.mail(l.bidder, l.bidderKhu ?? '', l.good, l.n, `Thắng đấu giá ${goodLabel(l.good)}`);
        this.mail(l.seller, l.khu, 'tien', Math.floor(l.price * (1 - l.fee)), `Đấu giá xong ${goodLabel(l.good)}`);
        this.trade(l.good, l.n, Math.floor(l.price / l.n));
      } else this.mail(l.seller, l.khu, l.good, l.n, l.kind === 'auction' ? 'Đấu giá không ai trả' : 'Hàng bày quá hạn');
    }
    await this.ensureNpc();
    const left = this.sql.exec<{ c: number }>('SELECT COUNT(*) AS c FROM listings WHERE npc = 0 OR bidder IS NOT NULL').one().c;
    if (left) await this.ctx.storage.setAlarm(now + SWEEP_MS);
  }
}
