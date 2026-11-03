import { describe, expect, it } from 'vitest';
import { simulate, teamFromSpec, type TeamSpec } from '../shared/battle';
import { mulberry32 } from '../shared/rng';

const spec = (fort?: TeamSpec['fort'], rao?: number): TeamSpec => ({ comps: [{ k: 'an', lv: 3 }], cuocTier: 1, raoTier: rao, fort });
describe('trận thành bang', () => {
  it('đội phòng thủ có tháp, đồn và tường khi có công trình', () => {
    const t = teamFromSpec(spec({ thap: [1, 2], don: [1], tuongHp: 50 }, 2), 1);
    const kinds = t.map((u) => u.key);
    expect(kinds.filter((k) => k === 'thap')).toHaveLength(2);
    expect(kinds).toContain('don');
    expect(t.length).toBeGreaterThanOrEqual(5);
  });
  it('trận tất định: cùng đầu vào, cùng kết quả', () => {
    const run = () => simulate(teamFromSpec(spec(), 0), teamFromSpec(spec({ thap: [3, 3], don: [], tuongHp: 0 }, 2), 1), mulberry32(7));
    const a = run(), b = run();
    expect(a.winner).toBe(b.winner);
    expect(a.events.length).toBe(b.events.length);
  });
});

import { sideHp } from '../shared/battle';
describe('bảng trực tiếp', () => {
  it('tổng máu bên không tính tường', () => {
    const t = teamFromSpec(spec({ thap: [1], don: [], tuongHp: 0 }, 2), 1);
    const w = t.find((u) => u.wall)!;
    const { hp, max } = sideHp(t);
    expect(hp).toBe(max);
    expect(max).toBe(t.filter((u) => !u.wall).reduce((a, u) => a + u.maxHp, 0));
    expect(w.maxHp).toBeGreaterThan(0);
  });
});
