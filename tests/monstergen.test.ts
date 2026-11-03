import { describe, expect, it } from 'vitest';
import { FAMILIES, genMonster, monsterPower } from '../shared/monstergen';

describe('quái ngẫu nhiên', () => {
  it('cùng hạt giống ra cùng quái (tất định)', () => {
    expect(genMonster(12345)).toEqual(genMonster(12345));
  });
  it('khác hạt giống ra nhiều quái khác nhau', () => {
    const set = new Set<string>();
    for (let i = 1; i <= 200; i++) set.add(JSON.stringify(genMonster(i).cells) + genMonster(i).pal.mid);
    expect(set.size).toBeGreaterThan(150);
  });
  it('đối xứng trái phải, đúng cỡ 12x10, luôn có mắt và thân đủ lớn', () => {
    for (let i = 1; i <= 300; i++) {
      const m = genMonster(i * 7919, FAMILIES[i % 3]);
      expect(m.cells.length).toBe(10);
      for (const row of m.cells) {
        expect(row.length).toBe(12);
        expect([...row].reverse()).toEqual(row);
      }
      expect(m.cells.flat().filter((c) => c === 3).length).toBeGreaterThanOrEqual(2);
      expect(monsterPower(m)).toBeGreaterThanOrEqual(30);
    }
  });
  it('màu hợp lệ dạng #rrggbb', () => {
    const m = genMonster(99);
    for (const c of Object.values(m.pal)) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });
});
