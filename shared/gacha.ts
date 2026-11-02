// Linh Thạch, Vòng Quay Vạn Linh, tướng truyền thuyết, vũ khí truyền thuyết, quy đổi đồng vàng.
// Tên tướng lấy từ truyền thuyết dân gian Việt Nam.
import type { ResKey, UnitBase } from './data';
import type { ItemKey } from './economy';
import { weighted, type Rng } from './rng';

// ======================= TƯỚNG =======================
export type Rarity = 'Truyền Thuyết' | 'Sử Thi' | 'Hiếm';
export const RARITY_ORDER: Rarity[] = ['Truyền Thuyết', 'Sử Thi', 'Hiếm'];
export const RARITY_COLOR: Record<Rarity, string> = { 'Truyền Thuyết': '#ffb02e', 'Sử Thi': '#c07cff', Hiếm: '#5fb0ff' };

export type GenId = 'giong' | 'sontinh' | 'lac' | 'auco' | 'caolo' | 'nuthuy' | 'nghiaquan' | 'ngudan' | 'thaylang';
export interface GenDef extends UnitBase {
  id: GenId;
  title: string;
  rarity: Rarity;
  lore: string;
}
export const GENERALS: Record<GenId, GenDef> = {
  giong: { id: 'giong', name: 'Thánh Gióng', title: 'Phù Đổng Thiên Vương', rarity: 'Truyền Thuyết', lore: 'Ba tuổi chưa biết nói, nghe giặc đến thì vươn vai thành tráng sĩ. Nhổ tre quét sạch quân thù.', hp: 680, atk: 46, def: 22, spd: 12, skill: 'dapcang', row: 'front' },
  sontinh: { id: 'sontinh', name: 'Sơn Tinh', title: 'Thần Núi Tản Viên', rarity: 'Truyền Thuyết', lore: 'Nước dâng bao nhiêu, núi cao bấy nhiêu. Kẻ thù truyền kiếp của Thủy Tinh.', hp: 820, atk: 34, def: 32, spd: 8, skill: 'thietcot', row: 'front' },
  lac: { id: 'lac', name: 'Lạc Long Quân', title: 'Vua Biển Cả', rarity: 'Truyền Thuyết', lore: 'Nòi rồng ở biển sâu, diệt Ngư Tinh, trừ Hồ Tinh, dạy dân trồng lúa.', hp: 640, atk: 44, def: 24, spd: 13, skill: 'samset', row: 'front' },
  auco: { id: 'auco', name: 'Âu Cơ', title: 'Mẹ Tiên', rarity: 'Sử Thi', lore: 'Mẹ của trăm trứng. Ở đâu có bà, ở đó vết thương lành lại.', hp: 420, atk: 22, def: 16, spd: 11, skill: 'lalanh', row: 'back' },
  caolo: { id: 'caolo', name: 'Cao Lỗ', title: 'Thần Nỏ', rarity: 'Sử Thi', lore: 'Người làm ra nỏ thần, một phát bắn ra mười mũi tên.', hp: 380, atk: 38, def: 12, spd: 12, skill: 'samset', row: 'back' },
  nuthuy: { id: 'nuthuy', name: 'Nữ Tướng Hải Âu', title: 'Thủy Quân Đô Đốc', rarity: 'Hiếm', lore: 'Lớn lên trên ghe bầu, đọc gió như đọc chữ.', hp: 340, atk: 27, def: 12, spd: 14, skill: 'danhkep', row: 'front' },
  nghiaquan: { id: 'nghiaquan', name: 'Thủ Lĩnh Nghĩa Quân', title: 'Áo Vải Cờ Đào', rarity: 'Hiếm', lore: 'Dựng cờ từ một làng chài nhỏ, theo sau là cả vùng biển.', hp: 380, atk: 25, def: 14, spd: 10, skill: 'cuoploi', row: 'front' },
  ngudan: { id: 'ngudan', name: 'Lão Ngư Mắt Bão', title: 'Người Nghe Sóng', rarity: 'Hiếm', lore: 'Sống sót ba lần qua Mắt Bão, biết khi nào biển nổi giận.', hp: 330, atk: 22, def: 13, spd: 11, skill: 'thinhhon', row: 'back' },
  thaylang: { id: 'thaylang', name: 'Thầy Lang Đảo', title: 'Nam Dược Thần Hiệu', rarity: 'Hiếm', lore: 'Một gùi thuốc nam, chữa đủ bệnh trên biển.', hp: 300, atk: 16, def: 11, spd: 10, skill: 'lalanh', row: 'back' },
};
export const GEN_IDS = Object.keys(GENERALS) as GenId[];
export const MAX_STAR = 5;
/** Mỗi sao thêm 20% chỉ số. */
export const starMult = (star: number) => 1 + 0.2 * (Math.max(1, Math.min(MAX_STAR, star)) - 1);

// ======================= VŨ KHÍ TRUYỀN THUYẾT =======================
export type LegWeaponId = 'nothan' | 'roisat' | 'dinhba' | 'gaytan';
export interface LegWeapon {
  id: LegWeaponId;
  name: string;
  desc: string;
  atk: number;
  def: number;
  hp: number;
  /** tướng hợp vũ khí: hiệu lực gấp rưỡi */
  fit: GenId;
}
export const LEG_WEAPONS: Record<LegWeaponId, LegWeapon> = {
  nothan: { id: 'nothan', name: 'Nỏ Thần Kim Quy', desc: 'Lẫy làm từ móng Rùa Vàng. +30% công.', atk: 0.3, def: 0, hp: 0, fit: 'caolo' },
  roisat: { id: 'roisat', name: 'Roi Sắt Phù Đổng', desc: 'Roi sắt của tráng sĩ làng Gióng. +25% công, +10% máu.', atk: 0.25, def: 0, hp: 0.1, fit: 'giong' },
  dinhba: { id: 'dinhba', name: 'Đinh Ba Lạc Long', desc: 'Ba mũi rẽ sóng. +20% công, +15% thủ.', atk: 0.2, def: 0.15, hp: 0, fit: 'lac' },
  gaytan: { id: 'gaytan', name: 'Gậy Thần Tản Viên', desc: 'Gậy gọi núi dâng cao. +30% thủ, +15% máu.', atk: 0, def: 0.3, hp: 0.15, fit: 'sontinh' },
};
export const LEG_IDS = Object.keys(LEG_WEAPONS) as LegWeaponId[];

/** Chỉ số tướng ra trận: theo sao và vũ khí đang đeo. */
export function generalUnit(id: GenId, star: number, weapon?: LegWeaponId | null): UnitBase {
  const g = GENERALS[id];
  const k = starMult(star);
  const w = weapon ? LEG_WEAPONS[weapon] : null;
  const fit = w && w.fit === id ? 1.5 : 1;
  return {
    name: g.name,
    hp: Math.round(g.hp * k * (1 + (w?.hp ?? 0) * fit)),
    atk: Math.round(g.atk * k * (1 + (w?.atk ?? 0) * fit)),
    def: Math.round(g.def * k * (1 + (w?.def ?? 0) * fit)),
    spd: g.spd,
    skill: g.skill,
    row: g.row,
  };
}

// ======================= LINH THẠCH VÀ QUY ĐỔI =======================
export const SPIN_COST = 50;
export const SPIN10_COST = 450;
/** Quay 60 lần chưa ra đồ truyền thuyết thì lần thứ 60 chắc chắn ra. */
export const PITY = 60;
/** Đổi đồng vàng lấy Linh Thạch: 150 đồng = 1 LT, mỗi ngày tối đa 20 LT. */
export const LT_BUY_PRICE = 150;
export const LT_BUY_DAILY = 20;
/** Bán Linh Thạch lấy đồng vàng: 1 LT = 80 đồng. */
export const LT_SELL_PRICE = 80;
/** Mảnh tướng truyền thuyết đủ bao nhiêu thì ghép được một tướng. */
export const FRAG_PER_GENERAL = 80;
/** Tướng trùng khi đã 5 sao: đổi thành mảnh. */
export const DUP_FRAGS = 20;

/** Rơi Linh Thạch theo việc làm. */
export function ltDrop(r: Rng, kind: 'conquer' | 'bian' | 'wild' | 'chest'): number {
  const roll = r();
  switch (kind) {
    case 'conquer':
      return roll < 0.3 ? 1 + Math.floor(r() * 3) : 0;
    case 'bian':
      return roll < 0.6 ? 3 + Math.floor(r() * 6) : 0;
    case 'wild':
      return roll < 0.05 ? 1 : 0;
    case 'chest':
      return roll < 0.5 ? 2 + Math.floor(r() * 4) : 0;
  }
}

// ======================= VÒNG QUAY =======================
export type Prize =
  | { k: 'gen'; pool: Rarity }
  | { k: 'weapon' }
  | { k: 'frag'; n: number }
  | { k: 'item'; item: ItemKey; n: number }
  | { k: 'res'; res: Partial<Record<ResKey, number>> };

export interface Slot {
  id: string;
  label: string;
  weight: number;
  leg?: boolean;
  prize: Prize;
}

/** Bảng giải (trọng số trên 10.000) — được công khai ngay trên vòng quay. */
export const WHEEL: Slot[] = [
  { id: 'tuong_tt', label: 'Tướng Truyền Thuyết', weight: 60, leg: true, prize: { k: 'gen', pool: 'Truyền Thuyết' } },
  { id: 'vk_tt', label: 'Vũ Khí Truyền Thuyết', weight: 80, leg: true, prize: { k: 'weapon' } },
  { id: 'tuong_st', label: 'Tướng Sử Thi', weight: 260, prize: { k: 'gen', pool: 'Sử Thi' } },
  { id: 'tuong_h', label: 'Tướng Hiếm', weight: 650, prize: { k: 'gen', pool: 'Hiếm' } },
  { id: 'manh', label: '10 Mảnh Tướng Truyền Thuyết', weight: 700, prize: { k: 'frag', n: 10 } },
  { id: 'vay', label: 'Vảy Rồng Lạc Long', weight: 150, prize: { k: 'item', item: 'vayrong', n: 1 } },
  { id: 'trong', label: 'Trống Đồng Đông Sơn', weight: 100, prize: { k: 'item', item: 'trongdong', n: 1 } },
  { id: 'lenh', label: 'Lệnh Bài Thủy Sư', weight: 300, prize: { k: 'item', item: 'lenhbai', n: 1 } },
  { id: 'the', label: 'Thẻ Đổi Giao Diện', weight: 300, prize: { k: 'item', item: 'thegd', n: 1 } },
  { id: 'ngocden', label: 'Ngọc Trai Đen', weight: 500, prize: { k: 'item', item: 'ngoctraiden', n: 1 } },
  { id: 'haido', label: '2 Hải Đồ Cổ', weight: 600, prize: { k: 'item', item: 'haido', n: 2 } },
  { id: 'vang', label: '2.000 Đồng Vàng', weight: 1500, prize: { k: 'res', res: { tien: 2000 } } },
  { id: 'lt', label: '20 Linh Thạch', weight: 1000, prize: { k: 'res', res: { lt: 20 } } },
  { id: 'vatlieu', label: 'Kho vật liệu lớn', weight: 2300, prize: { k: 'res', res: { go: 400, da: 400, tre: 300, sat: 150 } } },
  { id: 'banh', label: '3 Bánh Chưng', weight: 1500, prize: { k: 'item', item: 'banhchung', n: 3 } },
];
export const WHEEL_TOTAL = WHEEL.reduce((t, x) => t + x.weight, 0);

/** Chọn một ô trên vòng quay; đủ bảo hiểm thì chỉ chọn trong các ô truyền thuyết. */
export function rollWheel(r: Rng, pity: number): Slot {
  const pool = pity >= PITY - 1 ? WHEEL.filter((x) => x.leg) : WHEEL;
  return weighted(r, pool);
}

/** Tỉ lệ phần trăm của từng ô (để công khai). */
export const wheelOdds = () => WHEEL.map((x) => ({ label: x.label, pct: (x.weight / WHEEL_TOTAL) * 100, leg: !!x.leg }));

// ======================= GÓI LƯỢT QUAY =======================
// Người chơi trả tiền thật mua thẳng lượt quay. Lượt quay không phải tiền trong game:
// không đổi ra Linh Thạch hay đồng vàng, không cho, không bán được, chỉ dùng để quay.
export interface SpinPack {
  id: string;
  name: string;
  spins: number;
  /** tặng thêm */
  bonus: number;
  /** giá (đồng Việt Nam) */
  vnd: number;
}
/** Gói lượt quay (giá đặt tạm, chủ game sửa tại đây). */
export const SPIN_PACKS: SpinPack[] = [
  { id: 'q1', name: 'Một Lượt Quay', spins: 1, bonus: 0, vnd: 20_000 },
  { id: 'q10', name: 'Mười Lượt Quay', spins: 10, bonus: 0, vnd: 180_000 },
  { id: 'q30', name: 'Ba Mươi Lượt Quay', spins: 30, bonus: 3, vnd: 500_000 },
];
/** Mã đơn in trong nội dung chuyển khoản: VLD + 8 ký tự. */
export const PAY_CODE_RE = /VLD[A-Z0-9]{8}/;
