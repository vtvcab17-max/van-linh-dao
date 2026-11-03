import { describe, expect, it } from 'vitest';
import { leaderBonus, makeUnit, simulate, teamFromSpec, teamFromMonsters, type BUnit } from '../shared/battle';
import { mulberry32 } from '../shared/rng';

const spec = (withGen: boolean) => ({
  comps: [{ k: 'an' as const, lv: 3 }, { k: 'ngoc' as const, lv: 3 }],
  cuocTier: 1,
  ...(withGen ? { gen: { id: 'giong' as const, star: 1, w: null } } : {}),
});

describe('tướng dẫn đầu', () => {
  it('tướng từ spec.gen có cờ lead, đồng đội thì không', () => {
    const t = teamFromSpec(spec(true), 0);
    expect(t.filter((u) => u.lead).length).toBe(1);
    expect(t.find((u) => u.lead)!.key).toBe('giong');
    expect(teamFromSpec(spec(false), 0).some((u) => u.lead)).toBe(false);
  });

  it('leaderBonus: +10% cho đồng đội khi tướng sống, không cho chính tướng, hết khi tướng chết', () => {
    const t = teamFromSpec(spec(true), 0);
    const lead = t.find((u) => u.lead)!;
    const mate = t.find((u) => !u.lead && !u.wall)!;
    expect(leaderBonus(t, mate)).toEqual({ atk: 1.1, def: 1.1 });
    expect(leaderBonus(t, lead)).toEqual({ atk: 1, def: 1 });
    lead.hp = 0;
    expect(leaderBonus(t, mate)).toEqual({ atk: 1, def: 1 });
  });

  it('đầu trận có sự kiện buff từ tướng, không kỹ năng', () => {
    const r = simulate(teamFromSpec(spec(true), 0), teamFromMonsters([['cuagai', 3]], 1), mulberry32(7));
    const ev = r.events[0];
    expect(ev.k).toBe('buff');
    expect(ev.s).toBeUndefined();
    expect(r.a.find((u) => u.id === ev.a)!.lead).toBe(true);
    expect(ev.t!.length).toBeGreaterThanOrEqual(2);
  });

  it('đội không có tướng đánh tất định, không có sự kiện dẫn đầu', () => {
    const run = () => simulate(teamFromSpec(spec(false), 0), teamFromMonsters([['cuagai', 3], ['khida', 3]], 1), mulberry32(5));
    const a = run(), b = run();
    expect(a.events).toEqual(b.events);
    expect(a.events.some((e) => e.k === 'buff' && e.s === undefined)).toBe(false);
  });

  it('cùng đội và hạt giống, có hào quang dẫn đầu gây nhiều sát thương hơn cho đồng đội', () => {
    const mk = (lead: boolean): BUnit[] => {
      const t = teamFromSpec(spec(false), 0);
      const g = makeUnit({ name: 'T', hp: 400, atk: 20, def: 10, spd: 1, skill: 'chan', row: 'back' }, 'giong', 1, 0, 9);
      g.lead = lead;
      return [...t, g];
    };
    const dmg = (lead: boolean) => {
      const r = simulate(mk(lead), teamFromMonsters([['cuada', 5]], 1), mulberry32(11));
      return r.events.filter((e) => e.k === 'hit' && e.a !== '09' && e.a.startsWith('0')).reduce((s, e) => s + (e.v?.[0] ?? 0), 0);
    };
    expect(dmg(true)).toBeGreaterThan(dmg(false));
  });
});
