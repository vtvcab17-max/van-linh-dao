// Boss cuối Thủy Tinh ở Mắt Bão, trang bị và phi thăng. Dùng chung cho client và server.
//
// Mọi thứ nối với nhau:
// - Trang bị chế tạo từ tài nguyên, cần công trình đủ bậc (Cuốc, Lũy tre, Nhà chính).
// - Trang bị cất ở nhà tăng sức cho MỌI trận (đánh đảo hoang, đột kích, giữ đảo khi bị đánh).
// - Muốn đánh Thủy Tinh phải chở trang bị lên thuyền: lúc thuyền đi, đảo nhà yếu hơn khi bị đột kích.
// - Thua Thủy Tinh: mất sạch trang bị mang theo, thuyền bị đánh chìm (về Thuyền Thúng, phải xây lại từ đầu).
// - Thắng: phi thăng (danh hiệu Tiên Nhân, mở cổng Thượng Giới), trang bị theo thuyền về nhà.
// - Thủy Tinh đổi dạng và hồi sinh mỗi thứ Hai 00:00 (giờ Việt Nam); bảng sát thương tuần cũng làm mới.
import type { ResKey, SkillKey, UnitBase } from './data';

/** Tên gọi chung của công trình. */
export const LV_LABEL = { leu: 'Nhà chính', cuoc: 'Cuốc', rao: 'Lũy tre', thuyen: 'Thuyền' } as const;

export type GearKey = 'giao' | 'khien' | 'thuoc' | 'bua';
export const GEAR_KEYS: GearKey[] = ['giao', 'khien', 'thuoc', 'bua'];

export interface GearDef {
  name: string;
  desc: string;
  cost: Partial<Record<ResKey, number>>;
  max: number;
  /** công trình cần đạt bậc để chế tạo */
  need: { lv: 'leu' | 'cuoc' | 'rao'; tier: number };
  bonus: { atk: number; def: number; hp: number };
}

export const GEAR: Record<GearKey, GearDef> = {
  giao: { name: 'Giáo Sắt Thạch Sanh', desc: '+10% công cả đội', cost: { sat: 40, go: 25 }, max: 5, need: { lv: 'cuoc', tier: 2 }, bonus: { atk: 0.1, def: 0, hp: 0 } },
  khien: { name: 'Khiên Mây Thánh Gióng', desc: '+10% thủ cả đội', cost: { tre: 45, da: 35 }, max: 5, need: { lv: 'rao', tier: 2 }, bonus: { atk: 0, def: 0.1, hp: 0 } },
  thuoc: { name: 'Thuốc Nam Bà Đỡ', desc: '+12% máu cả đội', cost: { la: 40, co: 35 }, max: 5, need: { lv: 'leu', tier: 2 }, bonus: { atk: 0, def: 0, hp: 0.12 } },
  bua: { name: 'Bùa Ngọc Lạc Long', desc: '+7% công, thủ và máu', cost: { ngoc: 2, so: 80 }, max: 3, need: { lv: 'cuoc', tier: 4 }, bonus: { atk: 0.07, def: 0.07, hp: 0.07 } },
};

export type GearSet = Record<GearKey, number>;
export const noGear = (): GearSet => ({ giao: 0, khien: 0, thuoc: 0, bua: 0 });

/** Ép số trang bị về khoảng hợp lệ (dữ liệu từ máy khác không được tin). */
export function cleanGear(raw: unknown): GearSet {
  const out = noGear();
  if (!raw || typeof raw !== 'object') return out;
  for (const k of GEAR_KEYS) {
    const n = Math.floor(Number((raw as Record<string, unknown>)[k]));
    out[k] = Number.isFinite(n) ? Math.max(0, Math.min(GEAR[k].max, n)) : 0;
  }
  return out;
}

export function gearBonus(g: Partial<GearSet> | undefined): { atk: number; def: number; hp: number } {
  const c = cleanGear(g);
  const b = { atk: 0, def: 0, hp: 0 };
  for (const k of GEAR_KEYS) {
    b.atk += GEAR[k].bonus.atk * c[k];
    b.def += GEAR[k].bonus.def * c[k];
    b.hp += GEAR[k].bonus.hp * c[k];
  }
  return b;
}

export const gearPower = (g: Partial<GearSet> | undefined) => {
  const c = cleanGear(g);
  return c.giao * 10 + c.khien * 10 + c.thuoc * 10 + c.bua * 25;
};

// ---------- Thủy Tinh ----------
/** Mắt Bão: góc xa nhất của Hải Khu. */
export const BOSS_CELL = { x: 60, y: 40 };
/** Hải trình qua vùng bão: chậm gấp nhiều lần đường thường. */
export const BOSS_TRAVEL_MUL = 5;
/** Điều kiện ra khơi đánh Thủy Tinh. */
export const BOSS_REQ = { leu: 5, thuyen: 5 };
/** Mốc tuần: thứ Hai 02/11/2026 00:00 giờ Việt Nam (UTC+7). */
export const WEEK0 = Date.UTC(2026, 10, 1, 17, 0, 0);
export const WEEK_MS = 7 * 86_400_000;

export const weekOf = (now: number) => Math.floor((now - WEEK0) / WEEK_MS);
export const weekEnd = (now: number) => WEEK0 + (weekOf(now) + 1) * WEEK_MS;

export interface BossForm extends UnitBase {
  key: string;
  title: string;
  lore: string;
  minion: UnitBase;
  minions: number;
}

const THUY_BINH = (skill: SkillKey, hp: number, atk: number): UnitBase => ({ name: 'Thủy Binh', hp, atk, def: 14, spd: 10, skill, row: 'front' });

/** Mỗi tuần Thủy Tinh hiện một dạng (xoay vòng). */
export const BOSS_FORMS: BossForm[] = [
  { key: 'hongthuy', name: 'Thủy Tinh', title: 'Hồng Thủy', lore: 'Dâng nước ngập trời, mỗi đòn phép đánh cả đội.', hp: 4300, atk: 56, def: 26, spd: 9, skill: 'dapcang', row: 'front', minion: THUY_BINH('cuoploi', 260, 22), minions: 2 },
  { key: 'baoto', name: 'Thủy Tinh', title: 'Bão Tố', lore: 'Nhanh như gió giật, ra đòn liên hoàn hai lần.', hp: 3900, atk: 62, def: 22, spd: 15, skill: 'danhkep', row: 'front', minion: THUY_BINH('danhkep', 230, 20), minions: 2 },
  { key: 'thuyquai', name: 'Thủy Tinh', title: 'Thủy Quái Vương', lore: 'Vảy cứng như đá, phản lại một phần đòn đánh.', hp: 4500, atk: 50, def: 28, spd: 7, skill: 'phandon', row: 'front', minion: THUY_BINH('phandon', 300, 18), minions: 2 },
  { key: 'hailong', name: 'Thủy Tinh', title: 'Hải Long', lore: 'Phun độc biển sâu, vết thương rỉ máu nhiều lượt.', hp: 4200, atk: 54, def: 24, spd: 11, skill: 'docto', row: 'front', minion: THUY_BINH('docto', 240, 20), minions: 3 },
];

/** Thủy Tinh được cường hóa: mỗi trận chỉ chịu được một phần nhỏ, không đội nào hạ được một mình. */
const BOSS_HP_K = 2.2;
const BOSS_ATK_K = 1.35;
const BOSS_DEF_K = 1.2;
export const bossOf = (week: number): BossForm => {
  const f = BOSS_FORMS[((week % BOSS_FORMS.length) + BOSS_FORMS.length) % BOSS_FORMS.length];
  return { ...f, hp: Math.round(f.hp * BOSS_HP_K), atk: Math.round(f.atk * BOSS_ATK_K), def: Math.round(f.def * BOSS_DEF_K) };
};

// ---------- Thủy Tinh là trùm chung của cả Hải Khu ----------
/**
 * Máu chung cả tuần: mọi người cùng góp sát thương. Khi máu chung về 0, Thiên Môn mở cho
 * vài người góp nhiều nhất (chưa từng phi thăng). Mỗi tuần mỗi Hải Khu tối đa 3 người,
 * và không quá 5% số người đang chơi ở Hải Khu đó.
 */
export const BOSS_POOL_MIN = 300_000;
export const BOSS_POOL_PER_PLAYER = 12_000;
export const bossPoolMax = (active: number) => Math.max(BOSS_POOL_MIN, Math.round(active * BOSS_POOL_PER_PLAYER));
export const ascendSlots = (active: number) => Math.max(1, Math.min(3, Math.floor(active * 0.05)));

export interface BossWorld {
  week: number;
  hp: number;
  max: number;
  /** số chỗ Thiên Môn tuần này */
  slots: number;
  /** đã bị hạ tuần này */
  done: boolean;
  /** người góp sát thương nhiều nhất */
  top: { id: string; name: string; dmg: number }[];
  /** người được phi thăng tuần này */
  winners: { id: string; name: string }[];
}

/** Phần thưởng phi thăng. */
export const ASCEND_REWARD: Partial<Record<ResKey, number>> = { so: 600, ngoc: 12 };
