import { describe, expect, it } from 'vitest';
import { apply, newPlayer, tick, power, publicOf, type PlayerState } from '../shared/logic';
import { troopCount } from '../shared/troops';

const T0 = Date.UTC(2026, 10, 2, 12);
const rich = (id: string): PlayerState => {
  const s = newPlayer(id, 'T', T0);
  s.shield = 0;
  s.lv.leu.tier = 5;
  for (const k of ['go', 'da', 'sat', 'tre', 'luong'] as const) s.res[k] = 5000;
  s.res.ngoc = 50;
  return s;
};
const put = (s: PlayerState, k: 'donbinh' | 'xuongcg', lv: number, x: number) => s.dinh.push({ id: 'b' + k + x, k, x, y: 8, lv });

describe('luyện quân', () => {
  it('có chỗ ở trạng thái đầu và rỗng', () => {
    const s = newPlayer('a', 'A', T0);
    expect(s.troops).toEqual({});
    expect(s.isleTroops).toEqual({});
    expect(s.mang).toEqual({});
  });
  it('cần Trại Lính mới luyện lính, Xưởng Cơ Giới mới đóng cơ giới', () => {
    const s = rich('a');
    expect(apply(s, { t: 'luyen', k: 'giao', n: 1 }).ok).toBe(false);
    put(s, 'donbinh', 1, 5);
    expect(apply(s, { t: 'luyen', k: 'giao', n: 3 }).ok).toBe(true);
    expect(s.troops.giao).toBe(3);
    expect(apply(s, { t: 'luyen', k: 'khien', n: 1 }).ok).toBe(false); // cần cấp 2
    expect(apply(s, { t: 'luyen', k: 'xenu', n: 1 }).ok).toBe(false);
    put(s, 'xuongcg', 1, 6);
    expect(apply(s, { t: 'luyen', k: 'xenu', n: 2 }).ok).toBe(true);
    expect(s.troops.xenu).toBe(2);
  });
  it('luyện lính tốn lương, thiếu thì không luyện', () => {
    const s = rich('a');
    put(s, 'donbinh', 1, 5);
    s.res.luong = 4;
    expect(apply(s, { t: 'luyen', k: 'giao', n: 2 }).ok).toBe(true);
    expect(s.res.luong).toBe(0);
    s.res.luong = 1;
    expect(apply(s, { t: 'luyen', k: 'giao', n: 1 }).ok).toBe(false);
  });
  it('không vượt sức chứa trại', () => {
    const s = rich('a');
    put(s, 'donbinh', 1, 5); // chứa 10 + 15 = 25
    expect(apply(s, { t: 'luyen', k: 'giao', n: 10 }).ok).toBe(true);
    expect(apply(s, { t: 'luyen', k: 'giao', n: 10 }).ok).toBe(true);
    expect(apply(s, { t: 'luyen', k: 'giao', n: 10 }).ok).toBe(false);
    expect(troopCount(s.troops)).toBe(20);
  });
  it('quân cộng vào sức mạnh', () => {
    const s = rich('a');
    put(s, 'donbinh', 1, 5);
    const p0 = power(s);
    apply(s, { t: 'luyen', k: 'giao', n: 5 });
    expect(power(s)).toBe(p0 + 10);
    expect(publicOf(s).troops).toEqual({ giao: 5 });
  });
});

describe('mang quân ra khơi', () => {
  const army = () => {
    const s = rich('a');
    put(s, 'donbinh', 2, 5);
    put(s, 'xuongcg', 3, 6);
    s.troops = { giao: 10, cung: 10, xenu: 3, voi: 1 };
    return s;
  };
  it('mang theo theo kế hoạch, bị giới hạn sức chở, voi chiến không lên ghe', () => {
    const s = army();
    expect(apply(s, { t: 'mangQuan', troops: { giao: 10, cung: 10, xenu: 3, voi: 1 } }).ok).toBe(true);
    expect(apply(s, { t: 'sail', kind: 'wild', id: 'baicua' }).ok).toBe(true);
    const v = s.voyage!;
    expect(troopCount(v.troops)).toBe(12);
    expect(v.troops!.voi).toBeUndefined();
    expect(s.troops.giao! + s.troops.cung! + s.troops.xenu!).toBe(10 + 10 + 3 - 12);
    expect(s.troops.voi).toBe(1);
  });
  it('quân mang theo ăn thêm lương', () => {
    const a = army();
    const b = army();
    apply(b, { t: 'mangQuan', troops: { giao: 10 } });
    apply(a, { t: 'sail', kind: 'wild', id: 'trailhaitac' });
    apply(b, { t: 'sail', kind: 'wild', id: 'trailhaitac' });
    expect(b.voyage!.need!).toBeGreaterThan(a.voyage!.need!);
  });
  it('về bến thì quân còn sống trở lại đảo nhà, chết bớt thì không đủ', () => {
    const s = army();
    apply(s, { t: 'mangQuan', troops: { giao: 10, cung: 2 } });
    apply(s, { t: 'sail', kind: 'wild', id: 'baicua' });
    const total = 10 + 10 + 3 + 1;
    const one = s.voyage!.arriveAt - s.voyage!.departAt;
    tick(s, T0 + one + 1000);
    tick(s, T0 + one * 2 + 3000);
    expect(s.voyage).toBeNull();
    const after = troopCount(s.troops);
    expect(after).toBeLessThanOrEqual(total);
    expect(after).toBeGreaterThanOrEqual(total - 12);
  });
  it('rút quân khỏi đảo cắm cờ về đảo nhà', () => {
    const s = army();
    s.isles.push({ id: 'dao1', since: T0, last: T0, mo: 0, don: 0, thap: 0 });
    s.isleTroops = { dao1: { giao: 4 } };
    expect(apply(s, { t: 'rutQuan', isle: 'dao1' }).ok).toBe(true);
    expect(s.isleTroops.dao1).toBeUndefined();
    expect(s.troops.giao).toBe(14);
  });
});
