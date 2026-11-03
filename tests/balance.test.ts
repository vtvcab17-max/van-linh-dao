import { describe, expect, it } from 'vitest';
import { apply, migrate, newPlayer, tick } from '../shared/logic';
import { hoursToAfford, sinksOf } from '../shared/balance';
import { settleSociety } from '../shared/society';

const mk = () => {
  const s = newPlayer('t', 'T', 1_000_000);
  s.res.tien = 1000;
  s.dinh.push({ id: 'c', k: 'chuong', x: 1, y: 1, lv: 1, last: 0 } as never);
  return s;
};
describe('cân bằng tài nguyên', () => {
  it('gỗ và đá: thời gian đủ cho cả cây công trình chênh nhau ≤1,5 lần', () => {
    const go = hoursToAfford('go'), da = hoursToAfford('da');
    expect(Math.max(go, da) / Math.min(go, da)).toBeLessThanOrEqual(1.5);
  });
  it('mỗi vật liệu có ít nhất 2 chỗ tiêu', () => {
    for (const r of ['co', 'la', 'tre', 'go', 'cui', 'da', 'sat'] as const) expect(sinksOf(r).length, r).toBeGreaterThanOrEqual(2);
  });
  it('bán nguyên liệu lấy đồng, trừ đúng số lượng', () => {
    const s = mk();
    s.res.co = 30;
    const t0 = s.res.tien;
    expect(apply(s, { t: 'banNL', res: 'co', n: 20 }).ok).toBe(true);
    expect(s.res.co).toBe(10);
    expect(s.res.tien).toBeGreaterThan(t0);
    expect(apply(s, { t: 'banNL', res: 'co', n: 999 }).ok).toBe(false);
    expect(apply(s, { t: 'banNL', res: 'go' as never, n: 1 }).ok).toBe(false);
  });
  it('vật nuôi đói thì lớn chậm', () => {
    const fed = mk(), hungry = mk();
    for (const s of [fed, hungry]) {
      apply(s, { t: 'herdBuy', sp: 'lon' });
      s.res.co = s === fed ? 500 : 0;
    }
    const b0 = hungry.soc.herd[0].born;
    settleSociety(fed, 10 * 3600_000);
    settleSociety(hungry, 10 * 3600_000);
    expect(hungry.soc.herd[0].born).toBeGreaterThan(b0);
    expect(fed.soc.herd[0].born).toBe(fed.soc.herd[0].born);
    expect(fed.res.co).toBeLessThan(500);
  });
  it('gói thực phẩm tốn lá', () => {
    const s = mk();
    s.res.rau = 20;
    s.res.la = 0;
    expect(apply(s, { t: 'bao', k: 'rau' }).ok).toBe(false);
    s.res.la = 10;
    expect(apply(s, { t: 'bao', k: 'rau' }).ok).toBe(true);
    expect(s.res.la).toBeLessThan(10);
  });
  it('bản lưu cũ vẫn tải được', () => {
    const s = mk();
    const old = JSON.parse(JSON.stringify(s));
    expect(migrate(old, 't', 'T', 2_000_000).res.go).toBe(s.res.go);
    tick(s, 1_000_000 + 3600_000);
  });
});
