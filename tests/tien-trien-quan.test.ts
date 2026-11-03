import { describe, expect, it } from 'vitest';
import { apply, migrate, newPlayer, type PlayerState } from '../shared/logic';
import { teamFromSpec } from '../shared/battle';
import { TECHS, TECH_KEYS } from '../shared/eco';
import { lenhView } from '../shared/logic';

const T0 = Date.UTC(2026, 10, 3, 12);
const DAY = 24 * 3600_000;
const mk = (): PlayerState => {
  const s = newPlayer('a', 'A', T0);
  s.lv.leu.tier = 5;
  for (const k of ['go', 'da', 'sat', 'tre', 'luong', 'tien', 'thoc']) (s.res as Record<string, number>)[k] = 9000;
  s.dinh.push({ id: 'don', k: 'donbinh', x: 5, y: 8, lv: 3 });
  for (let i = 0; i < 5; i++) s.dinh.push({ id: 'n' + i, k: 'nhadan', x: i, y: 1, lv: 1 });
  return s;
};

describe('nghiên cứu quân', () => {
  it('có ba môn mới ở nhánh Quân sự', () => {
    for (const k of ['giapQuan', 'vuKhiQuan', 'coKhi'] as const) {
      expect(TECH_KEYS).toContain(k);
      expect(TECHS[k].branch).toBe('Quân sự');
    }
  });
  it('môn quân làm đội quân mạnh hơn, không đụng đơn vị khác', () => {
    const spec = { comps: [{ k: 'an', lv: 1 }], cuocTier: 1, troops: { giao: 5, xenu: 2 } } as never;
    const base = teamFromSpec(spec, 0);
    const up = teamFromSpec({ ...(spec as object), tq: { giap: 3, vukhi: 3, cokhi: 3 } } as never, 0);
    const g0 = base.find((u) => u.key === 'tq-giao')!, g1 = up.find((u) => u.key === 'tq-giao')!;
    expect(g1.maxHp).toBe(Math.round(g0.maxHp * 1.24));
    expect(g1.atk).toBe(Math.round(g0.atk * 1.18));
    const x0 = base.find((u) => u.key === 'tq-xenu')!, x1 = up.find((u) => u.key === 'tq-xenu')!;
    expect(x1.maxHp).toBe(Math.round(x0.maxHp * 1.24));
    expect(x1.atk).toBe(Math.round(x0.atk * 1.24));
    expect(up.find((u) => u.key === 'an')!.maxHp).toBe(base.find((u) => u.key === 'an')!.maxHp);
  });
});

describe('lệnh hằng ngày', () => {
  it('ban đầu rỗng, đủ ba lệnh', () => {
    const s = mk();
    expect(lenhView(s).map((x) => x.id)).toEqual(['luyen', 'thang', 'ra']);
    expect(lenhView(s).every((x) => x.have === 0 && !x.done && !x.claimed)).toBe(true);
  });
  it('luyện đủ 10 quân → nhận được 80 Vỏ Sò, chỉ một lần', () => {
    const s = mk();
    apply(s, { t: 'luyen', k: 'giao', n: 5 });
    expect(apply(s, { t: 'nhanLenh', id: 'luyen' }).ok).toBe(false);
    apply(s, { t: 'luyen', k: 'giao', n: 5 });
    expect(lenhView(s)[0].done).toBe(true);
    const so = s.res.so;
    expect(apply(s, { t: 'nhanLenh', id: 'luyen' }).ok).toBe(true);
    expect(s.res.so).toBe(so + 80);
    expect(apply(s, { t: 'nhanLenh', id: 'luyen' }).ok).toBe(false);
    expect(s.res.so).toBe(so + 80);
  });
  it('lệnh thắng 2 trận theo mốc đầu ngày', () => {
    const s = mk();
    apply(s, { t: 'luyen', k: 'giao', n: 1 }); // mở lệnh hôm nay, chốt mốc
    s.stats.wins += 1;
    expect(lenhView(s)[1].have).toBe(1);
    s.stats.raidWins += 1;
    expect(lenhView(s)[1].done).toBe(true);
    const ngoc = s.res.ngoc;
    expect(apply(s, { t: 'nhanLenh', id: 'thang' }).ok).toBe(true);
    expect(s.res.ngoc).toBe(ngoc + 1);
  });
  it('id lạ bị từ chối', () => {
    expect(apply(mk(), { t: 'nhanLenh', id: 'xxx' as never }).ok).toBe(false);
  });
  it('sang ngày mới làm lại, lệnh đã nhận được nhận tiếp', () => {
    const s = mk();
    apply(s, { t: 'luyen', k: 'giao', n: 5 });
    apply(s, { t: 'luyen', k: 'giao', n: 5 });
    apply(s, { t: 'nhanLenh', id: 'luyen' });
    s.lastReal += DAY;
    expect(lenhView(s)[0]).toMatchObject({ have: 0, done: false, claimed: false });
    apply(s, { t: 'luyen', k: 'cung', n: 5 });
    expect(lenhView(s)[0].have).toBe(5);
  });
  it('người chơi cũ nâng cấp mượt', () => {
    const s = mk() as Partial<PlayerState>;
    delete s.lenh;
    const m = migrate(s, 'a', 'A', T0);
    expect(m.lenh).toBeTruthy();
  });
});
