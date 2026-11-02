// Danh bạ người chơi: mỗi tài khoản thuộc một Hải Khu. Khu đầy thì tự mở khu mới.
import { DurableObject } from 'cloudflare:workers';

export const KHU_CAPACITY = 800; // số người đăng ký tối đa mỗi Hải Khu (khoảng 150–250 người online cùng lúc)

export class Directory extends DurableObject {
  sql: SqlStorage;
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env as never);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, khu TEXT NOT NULL, name TEXT, created INTEGER, seen INTEGER);
      CREATE INDEX IF NOT EXISTS members_khu ON members(khu);
      CREATE TABLE IF NOT EXISTS nap (code TEXT PRIMARY KEY, player TEXT, khu TEXT, pack TEXT, lt INTEGER, vnd INTEGER, status TEXT, created INTEGER, paid INTEGER, ref TEXT);
      CREATE INDEX IF NOT EXISTS nap_player ON nap(player);
      CREATE TABLE IF NOT EXISTS nap_tx (ref TEXT PRIMARY KEY, t INTEGER);`);
  }

  /** Trả về Hải Khu của người chơi; người mới được xếp vào khu còn chỗ (hoặc khu mới). */
  async assign(id: string, name: string): Promise<{ khu: string; isNew: boolean }> {
    const now = Date.now();
    const row = this.sql.exec<{ khu: string }>('SELECT khu FROM members WHERE id = ?', id).toArray()[0];
    if (row) {
      this.sql.exec('UPDATE members SET seen = ?, name = ? WHERE id = ?', now, name, id);
      return { khu: row.khu, isNew: false };
    }
    const last = this.sql.exec<{ khu: string; n: number }>('SELECT khu, COUNT(*) AS n FROM members GROUP BY khu ORDER BY CAST(khu AS INTEGER) DESC LIMIT 1').toArray()[0];
    let khu = last?.khu ?? '01';
    if (last && last.n >= KHU_CAPACITY) khu = String(Number(last.khu) + 1).padStart(2, '0');
    this.sql.exec('INSERT INTO members (id, khu, name, created, seen) VALUES (?, ?, ?, ?, ?)', id, khu, name, now, now);
    return { khu, isNew: true };
  }

  /** Khoá ký phiên đăng nhập: tạo ngẫu nhiên một lần rồi giữ mãi (khi chưa đặt SESSION_SECRET). */
  async secret(): Promise<string> {
    let k = await this.ctx.storage.get<string>('sessionSecret');
    if (!k) {
      const b = crypto.getRandomValues(new Uint8Array(48));
      k = btoa(String.fromCharCode(...b));
      await this.ctx.storage.put('sessionSecret', k);
    }
    return k;
  }

  // ---------- nạp Linh Thạch ----------
  /** Tạo đơn nạp mới (mã ngẫu nhiên, không đoán được). */
  async napCreate(player: string, pack: string, lt: number, vnd: number): Promise<{ code: string; khu: string }> {
    const row = this.sql.exec<{ khu: string }>('SELECT khu FROM members WHERE id = ?', player).toArray()[0];
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const b = crypto.getRandomValues(new Uint8Array(8));
    const code = 'VLD' + Array.from(b, (x) => abc[x % abc.length]).join('');
    this.sql.exec('INSERT INTO nap (code, player, khu, pack, lt, vnd, status, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', code, player, row?.khu ?? '01', pack, lt, vnd, 'cho', Date.now());
    return { code, khu: row?.khu ?? '01' };
  }
  async napList(player: string) {
    return this.sql.exec<{ code: string; pack: string; lt: number; vnd: number; status: string; created: number; paid: number | null }>('SELECT code, pack, lt, vnd, status, created, paid FROM nap WHERE player = ? ORDER BY created DESC LIMIT 20', player).toArray();
  }
  /** Ngân hàng báo có tiền vào: khớp mã đơn, đủ tiền, chưa xử lý thì đánh dấu đã trả. Mỗi giao dịch chỉ dùng một lần. */
  async napPaid(code: string, amount: number, ref: string): Promise<{ player: string; khu: string; lt: number } | { error: string }> {
    if (ref && this.sql.exec('SELECT ref FROM nap_tx WHERE ref = ?', ref).toArray().length) return { error: 'Giao dịch đã xử lý' };
    const o = this.sql.exec<{ player: string; khu: string; lt: number; vnd: number; status: string }>('SELECT player, khu, lt, vnd, status FROM nap WHERE code = ?', code).toArray()[0];
    if (!o) return { error: 'Không có đơn' };
    if (o.status !== 'cho') return { error: 'Đơn đã xử lý' };
    if (amount < o.vnd) return { error: 'Thiếu tiền' };
    if (ref) this.sql.exec('INSERT INTO nap_tx (ref, t) VALUES (?, ?)', ref, Date.now());
    this.sql.exec("UPDATE nap SET status = 'xong', paid = ?, ref = ? WHERE code = ?", Date.now(), ref, code);
    return { player: o.player, khu: o.khu, lt: o.lt };
  }
  async khuOf(player: string): Promise<string | null> {
    return this.sql.exec<{ khu: string }>('SELECT khu FROM members WHERE id = ?', player).toArray()[0]?.khu ?? null;
  }

  async stats(): Promise<{ total: number; khu: { khu: string; n: number }[] }> {
    const khu = this.sql.exec<{ khu: string; n: number }>('SELECT khu, COUNT(*) AS n FROM members GROUP BY khu ORDER BY khu').toArray();
    return { total: khu.reduce((t, k) => t + k.n, 0), khu };
  }
}
