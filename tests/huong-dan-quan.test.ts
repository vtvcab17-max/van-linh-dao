import { describe, expect, it } from 'vitest';
import { apply, currentQuest, newPlayer, tick, type PlayerState } from '../shared/logic';
import { QUESTS } from '../shared/data';

const T0 = Date.UTC(2026, 10, 3, 12);
const mk = (): PlayerState => {
  const s = newPlayer('a', 'A', T0);
  s.shield = 0;
  s.lv.leu.tier = 3;
  for (const k of ['go', 'da', 'sat', 'tre', 'luong', 'so']) (s.res as Record<string, number>)[k] = 3000;
  for (const q of QUESTS.slice(0, 10)) s.quests.push(q.id);
  return s;
};

describe('nhiệm vụ quân đội', () => {
  it('chuỗi có ba nhiệm vụ mới sau đột kích', () => {
    expect(QUESTS.slice(10).map((q) => q.id)).toEqual(['q_don', 'q_luyen', 'q_ra']);
    expect(QUESTS.find((q) => q.id === 'q_don')!.text).toMatch(/Nhà chính/);
  });
  it('xong chuỗi cũ thì nhiệm vụ hiện tại là xây Trại Lính', () => {
    expect(currentQuest(mk())!.id).toBe('q_don');
  });
  it('đặt xây Trại Lính xong nhiệm vụ, nhận thưởng một lần', () => {
    const s = mk();
    const so = s.res.so;
    let o = apply(s, { t: 'xay', k: 'donbinh', x: 0, y: 0 });
    for (let y = 0; y < 32 && !o.ok; y++) for (let x = 0; x < 32 && !o.ok; x++) o = apply(s, { t: 'xay', k: 'donbinh', x, y });
    expect(o.ok).toBe(true);
    expect(o.quest).toBeTruthy();
    expect(s.quests).toContain('q_don');
    expect(s.res.so).toBeGreaterThan(so - 0); // thưởng đã cộng (vỏ sò không bị trừ vì xây tốn gỗ/đá/sắt)
    expect(currentQuest(s)!.id).toBe('q_luyen');
  });
  it('luyện lính xong nhiệm vụ luyện', () => {
    const s = mk();
    s.dinh.push({ id: 'd', k: 'donbinh', x: 5, y: 8, lv: 1 });
    const o = apply(s, { t: 'luyen', k: 'giao', n: 2 });
    expect(o.ok).toBe(true);
    expect(s.quests).toContain('q_luyen');
    expect(o.quest).toBeTruthy();
    const again = apply(s, { t: 'luyen', k: 'giao', n: 1 });
    expect(again.quest).toBeFalsy();
  });
  it('ra khơi chở quân xong nhiệm vụ ra khơi, kể cả làm trước thứ tự', () => {
    const s = mk();
    s.quests = s.quests.filter((q) => !['q_don', 'q_luyen', 'q_ra'].includes(q));
    s.dinh.push({ id: 'd', k: 'donbinh', x: 5, y: 8, lv: 1 });
    apply(s, { t: 'luyen', k: 'giao', n: 3 });
    apply(s, { t: 'mangQuan', troops: { giao: 3 } });
    const o = apply(s, { t: 'sail', kind: 'wild', id: 'baicua' });
    expect(o.ok).toBe(true);
    expect(s.voyage!.troops).toBeTruthy();
    expect(s.quests).toContain('q_ra');
    expect(o.quest).toBeTruthy();
    expect(tick).toBeDefined();
  });
});
