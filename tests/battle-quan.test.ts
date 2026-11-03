import { describe, expect, it } from 'vitest';
import { apply, newPlayer, type PlayerState } from '../shared/logic';
import { makeUnit, simulate, squadReport, teamFromSpec, type BUnit } from '../shared/battle';
import { counterMult, squadUnit } from '../shared/troops';
import { mulberry32 } from '../shared/rng';

const T0 = Date.UTC(2026, 10, 3, 12);
const base = { name: 'x', hp: 5000, atk: 50, def: 5, spd: 5, skill: 'danh' as never, row: 'front' as const };
const solo = (key: string, side: 0 | 1, extra: Partial<BUnit> = {}): BUnit => ({ ...makeUnit(base as never, key, 1, side, 0), ...extra });
const firstHit = (att: BUnit, tgt: BUnit) => {
  const r = simulate([att], [tgt], mulberry32(7), 1);
  return r.events.find((e) => e.a === att.id && (e.k === 'hit' || e.k === 'skill'))!.v![0];
};

describe('khắc chế', () => {
  it('bảng nhân đúng và cặp khác = 1', () => {
    expect(counterMult('tq-giao', 'tq-voi')).toBeCloseTo(1.35);
    expect(counterMult('tq-cung', 'tq-khien')).toBeCloseTo(0.85);
    expect(counterMult('tq-xeda', 'thap')).toBeCloseTo(1.25);
    expect(counterMult('tq-giao', 'tq-cung')).toBe(1);
    expect(counterMult('an', 'tq-voi')).toBe(1);
  });
  it('trong trận giáo đánh voi đau hơn đánh lính thường', () => {
    const a = solo('tq-giao', 0), b = solo('tq-voi', 1);
    const a2 = solo('tq-giao', 0), c = solo('tq-cung', 1);
    expect(firstHit(a, b)).toBeGreaterThan(firstHit(a2, c) * 1.2);
  });
  it('không quân thì đánh y như trước (tất định)', () => {
    const r1 = simulate([solo('an', 0)], [solo('x', 1)], mulberry32(3));
    const r2 = simulate([solo('an', 0)], [solo('x', 1)], mulberry32(3));
    expect(r1.events).toEqual(r2.events);
  });
});

describe('đội hình hàng', () => {
  const rich = (): PlayerState => { const s = newPlayer('a', 'A', T0); s.lv.leu.tier = 3; return s; };
  it('mặc định rỗng; đổi hàng hợp lệ, sai khoá bị từ chối', () => {
    const s = rich();
    expect(s.hang).toEqual({});
    expect(apply(s, { t: 'doiHang', k: 'khien', row: 'back' }).ok).toBe(true);
    expect(s.hang.khien).toBe('back');
    expect(apply(s, { t: 'doiHang', k: 'bay' as never, row: 'back' }).ok).toBe(false);
    expect(apply(s, { t: 'doiHang', k: 'giao', row: 'giua' as never }).ok).toBe(false);
  });
  it('hàng đã chọn áp vào đội quân trong trận', () => {
    const t = teamFromSpec({ comps: [], cuocTier: 1, troops: { khien: 3, cung: 2 }, rows: { khien: 'back', cung: 'front' } } as never, 0);
    expect(t.find((u) => u.key === 'tq-khien')!.row).toBe('back');
    expect(t.find((u) => u.key === 'tq-cung')!.row).toBe('front');
    const d = teamFromSpec({ comps: [], cuocTier: 1, troops: { khien: 3, cung: 2 } } as never, 0);
    expect(d.find((u) => u.key === 'tq-khien')!.row).toBe('front');
  });
});

describe('báo cáo thương vong', () => {
  it('mỗi đội: ra trận, còn sống, mất', () => {
    const spec = { comps: [], cuocTier: 1, troops: { giao: 6, cung: 4 } } as never;
    const a = teamFromSpec(spec, 0);
    const b = [solo('quai', 1, { atk: 90, hp: 900, maxHp: 900 })];
    const res = simulate(a, b, mulberry32(11));
    const rep = squadReport({ giao: 6, cung: 4 }, res);
    expect(rep.map((r) => r.k)).toEqual(['giao', 'cung']);
    for (const r of rep) {
      expect(r.n).toBeGreaterThan(0);
      expect(r.left + r.lost).toBe(r.n);
      expect(r.left).toBeGreaterThanOrEqual(0);
    }
    expect(rep.some((r) => r.lost > 0)).toBe(true);
  });
  it('không quân thì báo cáo rỗng', () => {
    const res = simulate([solo('an', 0)], [solo('x', 1)], mulberry32(1));
    expect(squadReport({}, res)).toEqual([]);
    expect(squadUnit('giao', 1).name).toBeTruthy();
  });
});
