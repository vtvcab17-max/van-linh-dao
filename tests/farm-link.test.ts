import { describe, expect, it } from 'vitest';
import { mealBuff, PROCS, CROPS } from '../shared/eco';
import { BUILDINGS } from '../shared/economy';
import { apply, migrate, newPlayer, tick } from '../shared/logic';
import { COMP_KEYS, COMPANIONS } from '../shared/data';

describe('bữa ăn thành buff', () => {
  it('toàn thịt: +12% công, không buff máu', () => {
    const b = mealBuff({ thit: 10 });
    expect(b.atk).toBeCloseTo(1.12);
    expect(b.hp).toBeCloseTo(1);
  });
  it('toàn cá: +12% máu', () => {
    const b = mealBuff({ ca: 4 });
    expect(b.hp).toBeCloseTo(1.12);
    expect(b.atk).toBeCloseTo(1);
  });
  it('lương nấu: +8% cả hai; trộn theo tỉ lệ; gạo không buff', () => {
    expect(mealBuff({ luong: 5 })).toEqual({ atk: 1.08, hp: 1.08 });
    const m = mealBuff({ thit: 1, gao: 1 });
    expect(m.atk).toBeCloseTo(1.06);
    expect(mealBuff({}).atk).toBe(1);
  });
});

describe('gộp chế biến, bớt tài nguyên', () => {
  it('Bếp nấu thẳng từ thóc', () => {
    expect(PROCS.bep.take.thoc).toBeGreaterThan(0);
    expect(PROCS.bep.take.gao).toBeUndefined();
  });
  it('Cối xay, Khung cửi, Nhà thuốc không cho xây mới', () => {
    for (const k of ['coixay', 'khungcui', 'nhathuoc'] as const) expect(BUILDINGS[k].hidden).toBe(true);
    const s = newPlayer('t', 'T', 1000);
    s.lv.leu.tier = 5;
    s.res.go = s.res.da = s.res.tre = 9999;
    expect(apply(s, { t: 'xay', k: 'coixay', x: 20, y: 20 }).ok).toBe(false);
  });
  it('dâu cho vải, thảo dược cho thuốc', () => {
    expect(CROPS.dau.out).toBe('vai');
    expect(CROPS.thaoduoc.out).toBe('duoc');
  });
  it('save cũ: tơ và thảo dược đổi sang vải và thuốc', () => {
    const s = newPlayer('t', 'T', 1000);
    s.res.to = 10;
    s.res.thaoduoc = 9;
    const m = migrate(JSON.parse(JSON.stringify(s)), 't', 'T', 1000);
    expect(m.res.to).toBe(0);
    expect(m.res.vai).toBe(5);
    expect(m.res.thaoduoc).toBe(0);
    expect(m.res.duoc).toBe(s.res.duoc + 3);
  });
});

describe('đơn vị phụ từ nông trại', () => {
  it('có Trâu Chiến và Ngư Phủ, khóa lúc đầu', () => {
    expect(COMP_KEYS).toContain('trau');
    expect(COMP_KEYS).toContain('ngu');
    expect(COMPANIONS.trau.row).toBe('front');
    expect(COMPANIONS.ngu.row).toBe('back');
    const s = newPlayer('t', 'T', 1000);
    expect(s.comps.trau.unlocked).toBe(false);
    expect(s.comps.ngu.unlocked).toBe(false);
  });
  it('Ao Cá xong thì mở Ngư Phủ; Chuồng lên cấp 2 thì mở Trâu', () => {
    const s = newPlayer('t', 'T', 1000);
    s.dinh.push({ id: 'd1', k: 'aoca', x: 20, y: 20, lv: 0, to: 1, doneAt: s.gt + 1, n: 2 });
    s.dinh.push({ id: 'd2', k: 'chuong', x: 21, y: 20, lv: 0, to: 1, doneAt: s.gt + 1, n: 2 });
    tick(s, s.lastReal + 5000);
    expect(s.comps.ngu.unlocked).toBe(true);
    expect(s.comps.trau.unlocked).toBe(false);
    s.dinh[1].to = 2;
    s.dinh[1].doneAt = s.gt + 1;
    tick(s, s.lastReal + 5000);
    expect(s.comps.trau.unlocked).toBe(true);
  });
});
