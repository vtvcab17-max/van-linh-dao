import { describe, expect, it } from 'vitest';
import { applyRaidAgainstMe, newPlayer, publicOf, raid, resolveRaid, teamSpec, type PlayerState } from '../shared/logic';
import { squadReport } from '../shared/battle';
import { troopCount } from '../shared/troops';

const T0 = Date.UTC(2026, 10, 3, 12);
const mk = (id: string): PlayerState => {
  const s = newPlayer(id, id, T0);
  s.shield = 0;
  s.lv.leu.tier = 3;
  for (const k of ['go', 'da', 'sat', 'tre', 'luong', 'co', 'la', 'cui']) (s.res as Record<string, number>)[k] = 3000;
  return s;
};

describe('phòng thủ có quân', () => {
  it('đảo công khai mang hàng quân giữ đảo', () => {
    const d = mk('def');
    d.troops = { khien: 4, cung: 3 };
    d.hang = { khien: 'back', cung: 'front' };
    expect(publicOf(d).rows).toEqual({ khien: 'back', cung: 'front' });
  });
  it('hàng phòng thủ vào trận', () => {
    const d = mk('def');
    d.troops = { khien: 4 };
    d.hang = { khien: 'back' };
    const a = mk('att');
    const r = resolveRaid(teamSpec(a, false), publicOf(d), 5);
    expect(r.battle.b.find((u) => u.key === 'tq-khien')!.row).toBe('back');
  });
  it('trận có quân giữ đảo → sự kiện ghi quân mất, chủ đảo bị trừ quân thật', () => {
    const a = mk('att');
    a.troops = { giao: 10, khien: 8 };
    a.voyage = { troops: { giao: 10, khien: 8 } } as never;
    const d = mk('def');
    d.troops = { giao: 6, cung: 6 };
    const target = publicOf(d);
    const o = raid(a, target);
    expect(o.ok).toBe(true);
    const ev = o.event!;
    expect(ev.defLost).toBeTruthy();
    const total = Object.values(ev.defLost ?? {}).reduce((x, n) => x + (n ?? 0), 0);
    const before = troopCount(d.troops);
    const text = applyRaidAgainstMe(d, ev);
    expect(troopCount(d.troops)).toBe(before - total);
    for (const n of Object.values(d.troops)) expect(n).toBeGreaterThanOrEqual(0);
    if (total > 0) expect(text).toMatch(/mất .*quân|Lính|Cung/);
  });
  it('không bao giờ trừ quá số đang có', () => {
    const d = mk('def');
    d.troops = { giao: 2 };
    const text = applyRaidAgainstMe(d, { id: 'x', attackerId: 'a', attackerName: 'A', targetId: 'def', targetName: 'D', win: true, loot: {}, seed: 1, t: 1, defLost: { giao: 9, cung: 4 } } as never);
    expect(d.troops.giao ?? 0).toBe(0);
    expect(d.troops.cung ?? 0).toBe(0);
    expect(text).toBeTruthy();
  });
  it('đảo không quân: không có defLost, hành vi cũ', () => {
    const a = mk('att');
    const d = mk('def');
    const o = raid(a, publicOf(d));
    expect(o.event!.defLost ?? {}).toEqual({});
  });
  it('squadReport dùng được cho bên 1', () => {
    const a = mk('att');
    const d = mk('def');
    d.troops = { giao: 5 };
    const r = resolveRaid(teamSpec(a, false), publicOf(d), 9);
    const rep = squadReport({ giao: 5 }, r.battle, 1);
    expect(rep).toHaveLength(1);
    expect(rep[0].left + rep[0].lost).toBe(5);
  });
});
