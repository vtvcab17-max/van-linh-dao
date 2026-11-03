import { describe, expect, it } from 'vitest';
import { apply, newPlayer, tick, migrate } from '../shared/logic';
import { isAdult, stageIdx, prosperity } from '../shared/society';

const mk = () => {
  const s = newPlayer('t', 'T', 1_000_000);
  s.res.tien = 5000;
  s.dinh.push({ id: 'c', k: 'chuong', x: 1, y: 1, lv: 1, last: 0 } as never, { id: 'h', k: 'nhadan', x: 2, y: 2, lv: 1, last: 0 } as never);
  return s;
};
describe('xã hội thu nhỏ', () => {
  it('vật nuôi qua từng giai đoạn, không quá nhanh', () => {
    const s = mk();
    expect(apply(s, { t: 'herdBuy', sp: 'bo' }).ok).toBe(true);
    const a = s.soc.herd[0];
    expect(stageIdx(a, s.gt)).toBe(0);
    s.gt += 4 * 24 * 3600_000;
    expect(stageIdx(a, s.gt)).toBe(1);
    expect(isAdult(a, s.gt)).toBe(false);
    s.gt += 4 * 24 * 3600_000;
    expect(isAdult(a, s.gt)).toBe(true);
  });
  it('lợn con chưa mổ được; trưởng thành mổ được thịt', () => {
    const s = mk();
    apply(s, { t: 'herdBuy', sp: 'lon' });
    expect(apply(s, { t: 'herdUse', id: s.soc.herd[0].id }).ok).toBe(false);
    s.gt += 6 * 24 * 3600_000;
    expect(apply(s, { t: 'herdUse', id: s.soc.herd[0].id }).ok).toBe(true);
    expect(s.res.thit).toBeGreaterThan(0);
  });
  it('gà mái đẻ trứng: ăn hoặc ấp', () => {
    const s = mk();
    apply(s, { t: 'herdBuy', sp: 'ga' });
    s.soc.herd[0].born = s.gt - 3 * 24 * 3600_000;
    s.lastReal = 1_000_000;
    tick(s, 1_000_000 + 3600_000 * 1); // 1 giờ thật = 1 giờ game
    s.soc.eggs = 5;
    expect(apply(s, { t: 'egg', use: 'hatch' }).ok).toBe(true);
    expect(s.soc.herd.length).toBe(2);
    expect(apply(s, { t: 'egg', use: 'food' }).ok).toBe(true);
    expect(s.res.trung).toBe(2);
  });
  it('thực phẩm tươi hỏng, đồ muối thì không', () => {
    const s = mk();
    s.res.thit = 100;
    s.lastReal = 1_000_000;
    tick(s, 1_000_000 + 10 * 3600_000);
    expect(s.res.thit).toBeLessThan(100);
    s.res.rau = 20;
    s.res.la = 10;
    expect(apply(s, { t: 'bao', k: 'rau' }).ok).toBe(true);
    expect(s.soc.kho.rau).toBe(12);
    expect(apply(s, { t: 'banBQ' }).ok).toBe(true);
  });
  it('câu cá có thời gian chờ', () => {
    const s = mk();
    expect(apply(s, { t: 'fish', how: 'can' }).ok).toBe(true);
    expect(apply(s, { t: 'fish', how: 'can' }).ok).toBe(false);
    expect(apply(s, { t: 'fish', how: 'luoi' }).ok).toBe(false);
  });
  it('phồn vinh, quá tải và di cư save cũ', () => {
    const s = mk();
    const p = prosperity(s);
    expect(p.total).toBeGreaterThanOrEqual(0);
    s.soc.pop = 40;
    expect(prosperity(s).overload).toBeLessThan(1);
    const old = JSON.parse(JSON.stringify(s));
    delete old.soc;
    expect(migrate(old, 't', 'T', 2_000_000).soc.pop).toBe(2);
  });
});
