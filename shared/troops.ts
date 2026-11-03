// Quân đội (spec 013): lính luyện ở Trại Lính, quân cơ giới đóng ở Xưởng Cơ Giới, chở bằng thuyền.
// Mỗi lính và mỗi cơ giới đều là 1 đơn vị (1 chỗ ở trại, 1 chỗ trên thuyền). Trong trận mỗi loại quân gộp thành một đội.
import type { ResKey, UnitBase } from './data';

export type TroopKey = 'giao' | 'cung' | 'khien' | 'xenu' | 'xeda' | 'voi';
export type Troops = Partial<Record<TroopKey, number>>;
export interface TroopDef extends UnitBase {
  mech: boolean;
  /** cần Trại Lính (lính) hoặc Xưởng Cơ Giới (cơ giới) cấp mấy */
  need: number;
  cost: Partial<Record<ResKey, number>>;
  desc: string;
  /** chỉ lên được thuyền buồm chiến trở lên */
  heavy?: boolean;
}
export const TROOPS: Record<TroopKey, TroopDef> = {
  giao: { name: 'Lính Giáo', hp: 90, atk: 10, def: 8, spd: 9, skill: 'phandon', row: 'front', mech: false, need: 1, cost: { luong: 2, go: 15, sat: 5 }, desc: 'Cầm giáo xông trước, đâm đau.' },
  cung: { name: 'Cung Thủ', hp: 60, atk: 13, def: 3, spd: 10, skill: 'danhkep', row: 'back', mech: false, need: 1, cost: { luong: 2, go: 20, tre: 10 }, desc: 'Đứng sau bắn hai phát liền.' },
  khien: { name: 'Giáp Binh', hp: 150, atk: 9, def: 14, spd: 7, skill: 'thietcot', row: 'front', mech: false, need: 2, cost: { luong: 3, sat: 25, go: 10 }, desc: 'Khiên sắt, kéo đòn về mình.' },
  xenu: { name: 'Xe Nỏ Liên Châu', hp: 160, atk: 22, def: 8, spd: 8, skill: 'samset', row: 'back', mech: true, need: 1, cost: { go: 120, sat: 40, tre: 40 }, desc: 'Nỏ thần bắn liên hoàn trên xe bánh gỗ.' },
  xeda: { name: 'Xe Bắn Đá', hp: 190, atk: 26, def: 10, spd: 6, skill: 'dapcang', row: 'back', mech: true, need: 2, cost: { go: 150, da: 120, sat: 60 }, desc: 'Ném đá trúng cả hàng địch.' },
  voi: { name: 'Voi Chiến', hp: 420, atk: 24, def: 16, spd: 7, skill: 'cuoploi', row: 'front', mech: true, need: 3, cost: { luong: 20, go: 100, sat: 80, ngoc: 1 }, desc: 'Húc tung hàng trước. Cần thuyền buồm chiến trở lên.', heavy: true },
};
export const TROOP_KEYS = Object.keys(TROOPS) as TroopKey[];
export const isMech = (k: TroopKey) => TROOPS[k].mech;
export const troopCount = (t: Troops | undefined) => Object.values(t ?? {}).reduce((a, b) => a + (b ?? 0), 0);
export const mechCount = (t: Troops | undefined) => TROOP_KEYS.filter(isMech).reduce((a, k) => a + (t?.[k] ?? 0), 0);

/** Sức chứa trại: 10 + 15 mỗi cấp Trại Lính + 10 mỗi cấp Xưởng Cơ Giới. */
export const houseCap = (donbinhLv: number, cgLv: number) => 10 + 15 * donbinhLv + 10 * cgLv;

const SHIP_CARRY: Record<string, number> = { ghe: 6, buom: 10, chien: 16 };
/** Sức chở quân của thuyền chính và hạm đội (thuyền hỏng không chở được). */
export const carryCap = (thuyenTier: number, fleet: { k: string; vo: number }[]) => 8 + 4 * thuyenTier + fleet.filter((x) => x.vo > 0).reduce((t, x) => t + (SHIP_CARRY[x.k] ?? 0), 0);
/** Quân nặng (voi chiến) cần thuyền buồm chiến trở lên còn nguyên. */
export const boardOk = (k: TroopKey, fleet: { k: string; vo: number }[]) => !TROOPS[k].heavy || fleet.some((x) => x.vo > 0 && (x.k === 'buom' || x.k === 'chien'));

/** Xếp quân lên thuyền theo thứ tự muốn mang: không quá sẵn có, sức chở, luật lên thuyền. */
export function fitCargo(want: Troops, have: Troops, cap: number, fleet: { k: string; vo: number }[]): Troops {
  const out: Troops = {};
  let left = cap;
  for (const k of TROOP_KEYS) {
    if (left <= 0) break;
    if (!boardOk(k, fleet)) continue;
    const n = Math.min(Math.max(0, Math.floor(want[k] ?? 0)), Math.max(0, Math.floor(have[k] ?? 0)), left);
    if (n > 0) {
      out[k] = n;
      left -= n;
    }
  }
  return out;
}

/** Một đội quân trong trận: máu nhân n, công nhân n^0.85. */
export function squadUnit(k: TroopKey, n: number): UnitBase {
  const d = TROOPS[k];
  return { name: `${d.name} ×${n}`, hp: d.hp * n, atk: Math.round(d.atk * Math.pow(n, 0.85)), def: d.def, spd: d.spd, skill: d.skill, row: d.row };
}
/** Số còn sống theo máu còn lại của cả đội. */
export function survivors(n: number, hp: number, maxHp: number): number {
  if (hp <= 0 || maxHp <= 0) return 0;
  return Math.min(n, Math.max(1, Math.ceil((n * hp) / maxHp)));
}
export const troopPower = (t: Troops | undefined) => TROOP_KEYS.reduce((p, k) => p + (isMech(k) ? 6 : 2) * (t?.[k] ?? 0), 0);

export function cleanTroops(raw: unknown): Troops {
  const out: Troops = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const k of TROOP_KEYS) {
    const n = Math.max(0, Math.min(99, Math.floor(Number((raw as Record<string, unknown>)[k]) || 0)));
    if (n > 0) out[k] = n;
  }
  return out;
}
