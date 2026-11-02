// Hạm đội: đóng thêm thuyền chiến ở Xưởng Đóng Tàu, lắp nỏ lớn, máy bắn đá, mũi đâm.
// Thuyền chiến theo thuyền chính ra trận (và giữ bến khi ở nhà), có độ bền riêng.
import type { ResKey, UnitBase } from './data';

export type ShipKind = 'ghe' | 'buom' | 'chien';
export type ShipWeapon = 'no' | 'da' | 'dam';
export interface Ship {
  id: string;
  k: ShipKind;
  w: Partial<Record<ShipWeapon, boolean>>;
  /** độ bền 0..100 */
  vo: number;
}
export interface ShipDef extends UnitBase {
  /** cần Xưởng Đóng Tàu (Bến Thuyền) cấp mấy */
  need: number;
  cost: Partial<Record<ResKey, number>>;
  desc: string;
}
export const SHIPS: Record<ShipKind, ShipDef> = {
  ghe: { name: 'Ghe Chiến', hp: 260, atk: 18, def: 14, spd: 11, skill: 'cuoploi', row: 'front', need: 1, cost: { go: 300, tre: 150, vai: 10 }, desc: 'Nhẹ, nhanh, xông lên đầu. Hợp với mũi đâm.' },
  buom: { name: 'Thuyền Buồm Chiến', hp: 360, atk: 22, def: 12, spd: 9, skill: 'samset', row: 'back', need: 2, cost: { go: 600, sat: 60, vai: 40 }, desc: 'Buồm cánh dơi, bắn từ xa. Hợp với nỏ lớn.' },
  chien: { name: 'Chiến Hạm Lâu Thuyền', hp: 620, atk: 30, def: 20, spd: 7, skill: 'dapcang', row: 'back', need: 3, cost: { go: 1200, sat: 200, vai: 100, tien: 2000 }, desc: 'Thuyền lầu to lớn, đánh cả hàng địch. Hợp với máy bắn đá.' },
};
export const WEAPONS: Record<ShipWeapon, { name: string; desc: string; cost: Partial<Record<ResKey, number>>; atk: number }> = {
  no: { name: 'Nỏ Lớn', desc: '+30% công, bắn xa', cost: { go: 100, sat: 60 }, atk: 0.3 },
  da: { name: 'Máy Bắn Đá', desc: '+15% công, ném đá trúng cả hàng', cost: { go: 200, da: 200 }, atk: 0.15 },
  dam: { name: 'Mũi Đâm Bọc Đồng', desc: '+25% công, húc thẳng vào thuyền địch', cost: { sat: 120, go: 60 }, atk: 0.25 },
};
export const SHIP_KINDS = Object.keys(SHIPS) as ShipKind[];
export const WEAPON_KEYS = Object.keys(WEAPONS) as ShipWeapon[];
/** Số thuyền chiến tối đa theo cấp Xưởng Đóng Tàu. */
export const fleetCap = (benthuyen: number) => benthuyen;
/** Mỗi trận thuyền chiến mòn 5%. */
export const SHIP_WEAR = 5;

/** Thuyền chiến thành đơn vị trong trận (độ bền thấp thì yếu đi). */
export function shipUnit(sh: Ship): UnitBase {
  const d = SHIPS[sh.k];
  let atk = 1;
  for (const w of WEAPON_KEYS) if (sh.w[w]) atk += WEAPONS[w].atk;
  const worn = sh.vo < 40 ? 0.6 : 1;
  return {
    name: d.name,
    hp: Math.round(d.hp * worn),
    atk: Math.round(d.atk * atk * worn),
    def: d.def,
    spd: d.spd,
    skill: sh.w.da ? 'dapcang' : d.skill,
    row: sh.w.dam ? 'front' : d.row,
  };
}
export function cleanShips(raw: unknown): { k: ShipKind; w: Partial<Record<ShipWeapon, boolean>>; vo: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 3).filter((x) => x && typeof x === 'object' && (x as Ship).k in SHIPS).map((x) => {
    const sh = x as Ship;
    const w: Partial<Record<ShipWeapon, boolean>> = {};
    for (const k of WEAPON_KEYS) if (sh.w?.[k]) w[k] = true;
    return { k: sh.k, w, vo: Math.max(0, Math.min(100, Number(sh.vo) || 0)) };
  });
}
