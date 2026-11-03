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

import { enemyBase } from '../shared/data';
import { teamFromMonsters, simulate } from '../shared/battle';
import { isRandKey, randBase, randKey } from '../shared/monstergen';
import { worldOf, WORLD_H, WORLD_W } from '../shared/world';

describe('quái ngẫu nhiên trong thế giới và trận', () => {
  it('chỉ số hợp lệ và tất định theo khóa', () => {
    for (let i = 1; i <= 200; i++) {
      const k = randKey(i * 104729);
      expect(isRandKey(k)).toBe(true);
      const b = randBase(k);
      expect(b).toEqual(randBase(k));
      expect(b.hp).toBeGreaterThanOrEqual(45);
      expect(b.hp).toBeLessThanOrEqual(95);
      expect(b.atk).toBeGreaterThan(5);
      expect(enemyBase(k).name).toBe(b.name);
    }
  });
  it('hang Quái Lạ xuất hiện trên hải đồ và luôn cùng quái', () => {
    const w = worldOf('thu-nghiem');
    const found = w.lairsIn(0, 0, Math.min(WORLD_W, 400) - 1, Math.min(WORLD_H, 400) - 1).filter((l) => l.name.startsWith('Hang Quái Lạ'));
    expect(found.length).toBeGreaterThan(0);
    const again = worldOf('thu-nghiem').lairsIn(found[0].sx, found[0].sy, found[0].sx, found[0].sy)[0];
    expect(again.enemies).toEqual(found[0].enemies);
    expect(found[0].enemies.every(([k]) => isRandKey(k))).toBe(true);
  });
  it('đội quái ngẫu nhiên đánh được một trận hoàn chỉnh', () => {
    const team = teamFromMonsters([[randKey(11), 3], [randKey(22), 3]], 1);
    expect(team.length).toBe(2);
    expect(team[0].maxHp).toBeGreaterThan(0);
    const foe = teamFromMonsters([[randKey(33), 3]], 0);
    const res = simulate(foe, team, () => 0.5);
    expect([0, 1]).toContain(res.winner);
  });
});
