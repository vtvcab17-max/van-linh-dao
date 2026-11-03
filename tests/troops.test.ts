import { describe, expect, it } from 'vitest';
import { TROOPS, TROOP_KEYS, boardOk, carryCap, cleanTroops, fitCargo, houseCap, squadUnit, survivors, troopCount, troopPower, isMech } from '../shared/troops';

describe('quân', () => {
  it('có 3 lính và 3 cơ giới, cơ giới nhận diện đúng', () => {
    expect(TROOP_KEYS.length).toBe(6);
    expect(TROOP_KEYS.filter(isMech)).toEqual(['xenu', 'xeda', 'voi']);
    expect(TROOPS.giao.cost.luong).toBeGreaterThan(0);
  });
  it('sức chứa trại và sức chở thuyền', () => {
    expect(houseCap(0, 0)).toBe(10);
    expect(houseCap(2, 1)).toBe(10 + 30 + 10);
    expect(carryCap(1, [])).toBe(12);
    expect(carryCap(3, [{ k: 'buom', vo: 80 }, { k: 'ghe', vo: 0 }, { k: 'chien', vo: 50 }])).toBe(8 + 12 + 10 + 16);
  });
  it('voi chiến chỉ lên thuyền buồm trở lên', () => {
    expect(boardOk('voi', [{ k: 'ghe', vo: 100 }])).toBe(false);
    expect(boardOk('voi', [{ k: 'buom', vo: 100 }])).toBe(true);
    expect(boardOk('voi', [{ k: 'chien', vo: 0 }])).toBe(false);
    expect(boardOk('xenu', [])).toBe(true);
  });
  it('xếp quân lên thuyền: không quá sẵn có, không quá sức chở, bỏ voi nếu không lên được', () => {
    const have = { giao: 10, cung: 10, xenu: 4, voi: 2 };
    const c = fitCargo({ giao: 10, cung: 10, xenu: 4, voi: 2 }, have, 12, [{ k: 'ghe', vo: 100 }]);
    expect(troopCount(c)).toBe(12);
    expect(c.voi).toBeUndefined();
    expect(fitCargo({ giao: 99 }, { giao: 5 }, 12, [])).toEqual({ giao: 5 });
  });
  it('đội hình: máu nhân n^0.6, công nhân n^0.5, một người thì đúng chỉ số gốc', () => {
    const one = squadUnit('giao', 1);
    const ten = squadUnit('giao', 10);
    expect(one.hp).toBe(TROOPS.giao.hp);
    expect(ten.hp).toBe(Math.round(TROOPS.giao.hp * Math.pow(10, 0.6)));
    expect(ten.atk).toBe(Math.round(TROOPS.giao.atk * Math.pow(10, 0.5)));
    expect(ten.name).toContain('×10');
  });
  it('còn sống theo máu còn lại', () => {
    expect(survivors(10, 0, 900)).toBe(0);
    expect(survivors(10, 450, 900)).toBe(5);
    expect(survivors(10, 1, 900)).toBe(1);
    expect(survivors(10, 900, 900)).toBe(10);
  });
  it('làm sạch dữ liệu lạ và tính sức mạnh', () => {
    expect(cleanTroops({ giao: 5.7, zzz: 3, cung: -2, voi: 9999 })).toEqual({ giao: 5, voi: 99 });
    expect(cleanTroops(null)).toEqual({});
    expect(troopPower({ giao: 10, xenu: 2 })).toBe(10 * 2 + 2 * 6);
  });
});
