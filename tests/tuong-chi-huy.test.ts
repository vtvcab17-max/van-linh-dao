import { describe, expect, it } from 'vitest';
import { teamFromSpec } from '../shared/battle';
import { GEN_ARM, GEN_IDS, commandBonus } from '../shared/gacha';
import { TROOP_KEYS } from '../shared/troops';

const spec = (gen?: { id: never; star: number; w: null }) => ({ comps: [], cuocTier: 1, troops: { giao: 6, cung: 4, xenu: 2 }, gen }) as never;

describe('tướng chỉ huy quân', () => {
  it('mọi tướng có binh chủng sở trường hợp lệ', () => {
    for (const id of GEN_IDS) expect(TROOP_KEYS).toContain(GEN_ARM[id]);
  });
  it('thưởng chỉ huy theo sao', () => {
    expect(commandBonus('lac', 1)).toBeCloseTo(0.14);
    expect(commandBonus('lac', 5)).toBeCloseTo(0.22);
    expect(commandBonus('lac', 9)).toBeCloseTo(0.22);
  });
  it('đúng loại quân thì mạnh hơn, loại khác không đổi', () => {
    const base = teamFromSpec(spec(), 0);
    const led = teamFromSpec(spec({ id: 'lac' as never, star: 3, w: null }), 0); // Lạc Long Quân chỉ huy giáo
    const g0 = base.find((u) => u.key === 'tq-giao')!, g1 = led.find((u) => u.key === 'tq-giao')!;
    expect(g1.maxHp).toBe(Math.round(g0.maxHp * 1.18));
    expect(g1.hp).toBe(g1.maxHp);
    expect(g1.atk).toBe(Math.round(g0.atk * 1.18));
    for (const k of ['tq-cung', 'tq-xenu']) {
      const a = base.find((u) => u.key === k)!, b = led.find((u) => u.key === k)!;
      expect([b.maxHp, b.atk]).toEqual([a.maxHp, a.atk]);
    }
  });
  it('tướng mà không mang đúng quân thì không ai được thưởng', () => {
    const base = teamFromSpec({ comps: [], cuocTier: 1, troops: { cung: 4 } } as never, 0);
    const led = teamFromSpec({ comps: [], cuocTier: 1, troops: { cung: 4 }, gen: { id: 'giong', star: 5, w: null } } as never, 0); // Gióng chỉ huy voi
    expect(led.find((u) => u.key === 'tq-cung')!.atk).toBe(base.find((u) => u.key === 'tq-cung')!.atk);
  });
});
