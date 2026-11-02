// Danh bạ người chơi: mỗi tài khoản thuộc một Hải Khu. Khu đầy thì tự mở khu mới.
import { DurableObject } from 'cloudflare:workers';

export const KHU_CAPACITY = 800; // số người đăng ký tối đa mỗi Hải Khu (khoảng 150–250 người online cùng lúc)

export class Directory extends DurableObject {
  sql: SqlStorage;
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env as never);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, khu TEXT NOT NULL, name TEXT, created INTEGER, seen INTEGER);
      CREATE INDEX IF NOT EXISTS members_khu ON members(khu);`);
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

  async stats(): Promise<{ total: number; khu: { khu: string; n: number }[] }> {
    const khu = this.sql.exec<{ khu: string; n: number }>('SELECT khu, COUNT(*) AS n FROM members GROUP BY khu ORDER BY khu').toArray();
    return { total: khu.reduce((t, k) => t + k.n, 0), khu };
  }
}
