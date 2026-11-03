// Hệ sinh thái thành bang trên đảo: khí hậu (ngày đêm, mùa, thời tiết, gió), trồng trọt, chăn nuôi,
// chế biến, học viện, quân lương, bệnh trên biển, độ bền trang bị và thân thuyền.
// Mọi thứ tính từ thời gian thật nên client và server ra giống hệt nhau.
import type { ResKey } from './data';
import { hashStr, mulberry32 } from './rng';

export const ECO0 = Date.UTC(2026, 10, 1, 17, 0, 0); // 00:00 02/11/2026 giờ Việt Nam

// ======================= NGÀY ĐÊM, MÙA =======================
/** Một ngày trong game = 2 giờ thật. */
export const GAME_DAY_MS = 2 * 3600_000;
export function dayPhase(now: number) {
  const t = ((((now - ECO0) % GAME_DAY_MS) + GAME_DAY_MS) % GAME_DAY_MS) / GAME_DAY_MS;
  const name = t < 0.06 ? 'Bình minh' : t < 0.56 ? 'Ban ngày' : t < 0.62 ? 'Hoàng hôn' : 'Ban đêm';
  // độ tối 0 (trưa) .. 1 (nửa đêm)
  const dark = t < 0.06 ? 0.6 - t * 10 : t < 0.56 ? 0 : t < 0.62 ? (t - 0.56) * 10 : 0.6 + Math.min(0.4, (t - 0.62) * 2);
  return { t, name, night: t >= 0.62 || t < 0.04, dark: Math.max(0, Math.min(1, dark)), day: Math.floor((now - ECO0) / GAME_DAY_MS) + 1 };
}
/** Mỗi mùa kéo dài 7 ngày thật. */
export const SEASON_MS = 7 * 86_400_000;
export const SEASONS = ['Xuân', 'Hạ', 'Thu', 'Đông'] as const;
export type Season = (typeof SEASONS)[number];
export const seasonOf = (now: number): Season => SEASONS[((Math.floor((now - ECO0) / SEASON_MS) % 4) + 4) % 4];

// ======================= THỜI TIẾT, GIÓ =======================
export type WxKind = 'nang' | 'may' | 'mua' | 'giong' | 'suong' | 'bao';
export interface WxDef {
  name: string;
  icon: string;
  /** cây lớn nhanh/chậm */
  grow: number;
  /** công đánh xa (hàng sau) */
  back: number;
  /** công đánh gần (hàng trước) */
  front: number;
  /** khả năng mắc bệnh trên biển */
  sick: number;
  /** thuyền hao mòn mỗi giờ ngoài biển */
  wear: number;
  /** thời gian đi biển */
  sail: number;
  desc: string;
}
export const WEATHER: Record<WxKind, WxDef> = {
  nang: { name: 'Nắng', icon: '☀', grow: 1, back: 1, front: 1, sick: 0.8, wear: 1, sail: 1, desc: 'Trời quang. Mùa hạ nắng gắt làm lính cận chiến mau mệt.' },
  may: { name: 'Nhiều mây', icon: '⛅', grow: 1, back: 1, front: 1, sick: 1, wear: 1, sail: 1, desc: 'Trời dịu, đi biển dễ chịu.' },
  mua: { name: 'Mưa', icon: '🌧', grow: 1.3, back: 0.8, front: 1, sick: 1.4, wear: 1.3, sail: 1.1, desc: 'Lúa lớn nhanh. Dây cung, dây nỏ ướt: đánh xa yếu đi 20%.' },
  giong: { name: 'Giông', icon: '⛈', grow: 1.1, back: 0.7, front: 0.95, sick: 1.8, wear: 2, sail: 1.25, desc: 'Sấm chớp, sóng lớn. Đánh xa yếu 30%, thuyền hao mòn nhanh.' },
  suong: { name: 'Sương mù', icon: '🌫', grow: 0.9, back: 0.85, front: 1.05, sick: 1.2, wear: 1, sail: 1.15, desc: 'Khó nhìn xa: đánh xa yếu, đánh úp cận chiến lợi hơn.' },
  bao: { name: 'Bão', icon: '🌀', grow: 0.4, back: 0.6, front: 0.85, sick: 2.6, wear: 4, sail: 1.6, desc: 'Bão lớn: mùa màng dập nát, thuyền ngoài khơi hư hại nặng, dễ mắc bệnh.' },
};
const SEASON_WX: Record<Season, Partial<Record<WxKind, number>>> = {
  Xuân: { nang: 30, may: 30, mua: 25, suong: 15 },
  Hạ: { nang: 42, may: 15, mua: 16, giong: 19, bao: 8 },
  Thu: { nang: 28, may: 26, mua: 20, giong: 10, bao: 10, suong: 6 },
  Đông: { nang: 22, may: 34, mua: 12, suong: 26, bao: 6 },
};
/** Thời tiết đổi mỗi 40 phút, mỗi vùng biển 12x12 ô một kiểu. */
export const WX_MS = 40 * 60_000;
export const regionOf = (cell: { x: number; y: number }) => `${Math.floor(cell.x / 12)},${Math.floor(cell.y / 12)}`;
export const WIND_DIRS = ['Đông', 'Đông Nam', 'Tây Nam', 'Tây', 'Tây Bắc', 'Đông Bắc'];
export interface Wx {
  kind: WxKind;
  /** hướng gió thổi tới (0..5 theo 6 cạnh lục giác: Đ, ĐN, TN, T, TB, ĐB) */
  dir: number;
  /** sức gió 0..3 */
  wind: number;
}
export function weatherAt(region: string, now: number): Wx {
  const slot = Math.floor((now - ECO0) / WX_MS);
  const r = mulberry32(hashStr(`wx:${region}:${slot}`));
  const table = SEASON_WX[seasonOf(now)];
  const total = Object.values(table).reduce((t, v) => t + (v ?? 0), 0);
  let roll = r() * total;
  let kind: WxKind = 'may';
  for (const [k, v] of Object.entries(table)) {
    roll -= v ?? 0;
    if (roll < 0) {
      kind = k as WxKind;
      break;
    }
  }
  // gió cùng hướng trong cả một mùa ở mỗi vùng, đổi chút theo giờ
  const base = hashStr(`wind:${region}:${Math.floor((now - ECO0) / SEASON_MS)}`) % 6;
  const dir = (base + (r() < 0.25 ? 1 : 0) + 6) % 6;
  const wind = kind === 'bao' ? 3 : kind === 'giong' ? 2 + Math.floor(r() * 2) : Math.floor(r() * 3);
  return { kind, dir, wind };
}
/** Góc (độ) của hướng i trên hải đồ (y hướng xuống). */
const DIR_DEG = [0, 60, 120, 180, 240, 300];
/** Hệ số thời gian đi thuyền theo gió: xuôi gió nhanh, ngược gió chậm. */
export function windFactor(from: { x: number; y: number }, to: { x: number; y: number }, wx: Wx, compass = 0): number {
  const dx = to.x - from.x, dy = (to.y - from.y) * 0.866;
  if (!dx && !dy) return 1;
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const cos = Math.cos(((ang - DIR_DEG[wx.dir]) * Math.PI) / 180);
  const k = 0.08 * wx.wind * (compass >= 2 && cos < 0 ? 0.5 : 1);
  return Math.max(0.6, Math.min(1.5, 1 - cos * k)) * WEATHER[wx.kind].sail;
}

// ======================= TÀI NGUYÊN NÔNG TRẠI =======================
/** Lúa, rau, thịt... dùng để nấu lương, làm thuốc, dệt vải; bán được ở chợ. */
export const FOOD_KEYS = ['thoc', 'gao', 'rau', 'thit', 'trung', 'ca', 'thaoduoc', 'to', 'luong', 'duoc', 'vai'] as const;
export type FoodKey = (typeof FOOD_KEYS)[number];

// ======================= TRỒNG TRỌT =======================
export type CropKey = 'lua' | 'rau' | 'thaoduoc' | 'dau';
export interface CropDef {
  name: string;
  /** trồng ở công trình nào */
  plot: 'ruong' | 'vuon' | 'nuongdau';
  ms: number;
  out: ResKey;
  /** sản lượng mỗi cấp ruộng */
  per: number;
  seed: Partial<Record<ResKey, number>>;
  /** mùa lớn chậm */
  slow?: Season;
}
export const CROPS: Record<CropKey, CropDef> = {
  lua: { name: 'Lúa', plot: 'ruong', ms: 4 * 3600_000, out: 'thoc', per: 70, seed: { tien: 20 }, slow: 'Đông' },
  rau: { name: 'Rau muống', plot: 'vuon', ms: 45 * 60_000, out: 'rau', per: 30, seed: { tien: 6 } },
  thaoduoc: { name: 'Thảo dược', plot: 'vuon', ms: 2 * 3600_000, out: 'thaoduoc', per: 14, seed: { tien: 15 }, slow: 'Đông' },
  dau: { name: 'Dâu tằm', plot: 'nuongdau', ms: 3 * 3600_000, out: 'to', per: 9, seed: { tien: 12 }, slow: 'Đông' },
};
/** Chín rồi để quá 8 giờ thì hỏng một nửa. */
export const OVERRIPE_MS = 8 * 3600_000;

/** Tiến độ lớn của cây từ lúc trồng tới now (0..1+), tính theo từng khung thời tiết. */
export function cropProgress(k: CropKey, plantedAt: number, now: number, region: string, speedK = 1): { p: number; storms: number } {
  const c = CROPS[k];
  let p = 0, storms = 0;
  let t = plantedAt;
  let guard = 0;
  while (t < now && guard++ < 500) {
    const slotEnd = ECO0 + (Math.floor((t - ECO0) / WX_MS) + 1) * WX_MS;
    const end = Math.min(now, slotEnd);
    const wx = weatherAt(region, t);
    if (wx.kind === 'bao') storms++;
    const season = seasonOf(t) === c.slow ? 0.7 : 1;
    p += ((end - t) / c.ms) * WEATHER[wx.kind].grow * season * speedK;
    t = end;
    if (p >= 1) break;
  }
  return { p, storms };
}

// ======================= CHĂN NUÔI, AO CÁ =======================
export interface PenDef {
  name: string;
  /** mỗi giờ mỗi cấp */
  out: Partial<Record<ResKey, number>>;
  feed: Partial<Record<ResKey, number>>;
}
/** Sản lượng và thức ăn mỗi giờ cho MỘT con giống (một ô trong chuồng/ao). */
export const PENS: Record<'chuong' | 'aoca', PenDef & { buy: Partial<Record<ResKey, number>>; animal: string }> = {
  chuong: { name: 'Chuồng gà lợn', out: { trung: 1.5, thit: 0.75 }, feed: { thoc: 1, rau: 0.5 }, buy: { tien: 12, thoc: 4 }, animal: 'gà giống' },
  aoca: { name: 'Ao cá', out: { ca: 1.75 }, feed: {}, buy: { tien: 10 }, animal: 'lứa cá giống' },
};
/** Mỗi thửa ruộng/luống/gốc dâu cho 40% sản lượng cũ của cả ruộng, giống rẻ bằng một phần tư. */
export const PLOT_YIELD = 0.4;
export const plotSeed = (c: CropDef) => Object.fromEntries(Object.entries(c.seed).map(([k, v]) => [k, Math.ceil((v ?? 0) / 4)])) as Partial<Record<ResKey, number>>;
/** Thuê một thợ cho xưởng chế biến. */
export const HIRE_COST: Partial<Record<ResKey, number>> = { tien: 15 };
/** Mỗi thợ làm được rate/3 mẻ mỗi giờ. */
export const PER_WORKER = 1 / 3;
/** Chuồng, ao, xưởng giữ tối đa 12 giờ sản phẩm. */
export const STORE_H = 12;

// ======================= CHẾ BIẾN =======================
export interface ProcDef {
  name: string;
  /** mỗi lượt chế biến: lấy vào → làm ra */
  take: Partial<Record<ResKey, number>>;
  /** lấy thêm một trong các thứ này (thịt hoặc cá) */
  takeOne?: { keys: ResKey[]; n: number };
  give: Partial<Record<ResKey, number>>;
  /** số lượt mỗi giờ mỗi cấp */
  rate: number;
}
export const PROCS: Record<'coixay' | 'bep' | 'nhathuoc' | 'khungcui', ProcDef> = {
  coixay: { name: 'Cối xay', take: { thoc: 4 }, give: { gao: 3 }, rate: 6 },
  bep: { name: 'Bếp nấu lương', take: { gao: 2, cui: 1 }, takeOne: { keys: ['thit', 'ca', 'trung'], n: 1 }, give: { luong: 3 }, rate: 5 },
  nhathuoc: { name: 'Nhà thuốc', take: { thaoduoc: 3 }, give: { duoc: 1 }, rate: 4 },
  khungcui: { name: 'Khung cửi', take: { to: 2 }, give: { vai: 1 }, rate: 3 },
};

// ======================= HỌC VIỆN =======================
export type TechKey = 'giongLua' | 'thuyLoi' | 'chanNuoi' | 'laBan' | 'dongTau' | 'renSat' | 'quanLuong' | 'namDuoc' | 'binhPhap';
export interface TechDef {
  name: string;
  branch: 'Nông nghiệp' | 'Hàng hải' | 'Quân sự' | 'Y học';
  desc: string;
}
export const TECHS: Record<TechKey, TechDef> = {
  giongLua: { name: 'Giống lúa mới', branch: 'Nông nghiệp', desc: 'Ruộng, vườn cho thêm 20% mỗi cấp.' },
  thuyLoi: { name: 'Thủy lợi', branch: 'Nông nghiệp', desc: 'Cây lớn nhanh hơn 15% mỗi cấp.' },
  chanNuoi: { name: 'Chăn nuôi', branch: 'Nông nghiệp', desc: 'Chuồng, ao cá cho thêm 20% mỗi cấp.' },
  laBan: { name: 'La bàn', branch: 'Hàng hải', desc: 'Thuyền đi nhanh hơn 8% mỗi cấp; cấp 2 thì ngược gió chỉ chậm một nửa.' },
  dongTau: { name: 'Đóng tàu', branch: 'Hàng hải', desc: 'Thân thuyền hao mòn chậm hơn 25% mỗi cấp.' },
  renSat: { name: 'Rèn sắt', branch: 'Quân sự', desc: 'Trang bị hao mòn chậm hơn 25% mỗi cấp, sửa rẻ hơn 20% mỗi cấp.' },
  quanLuong: { name: 'Quân lương', branch: 'Quân sự', desc: 'Quân ăn ít hơn 15% mỗi cấp khi hành quân.' },
  namDuoc: { name: 'Nam dược', branch: 'Y học', desc: 'Ít mắc bệnh hơn 20% mỗi cấp; mỗi liều thuốc chữa được nhiều hơn.' },
  binhPhap: { name: 'Binh pháp', branch: 'Quân sự', desc: 'Cả đội thêm 4% công mỗi cấp.' },
};
export const TECH_KEYS = Object.keys(TECHS) as TechKey[];
export const TECH_MAX = 3;
export const techCost = (lv: number): Partial<Record<ResKey, number>> => ({ tien: 300 * lv * lv, go: 120 * lv, da: 100 * lv, gao: 40 * lv });
export const techMs = (lv: number) => 30 * 60_000 * lv * lv;

// ======================= HÀNH QUÂN: LƯƠNG, BỆNH =======================
/** Mỗi người trong đội ăn 1 lương mỗi giờ trên biển. */
export const RATION_PER_HOUR = 1;
/** Bệnh trên biển. */
export const SICKNESS = ['Say sóng', 'Sốt rét', 'Hoại huyết', 'Kiết lỵ'];
/** Mỗi giờ trên biển: 4% cơ hội có người đổ bệnh (nhân theo thời tiết). */
export const SICK_PER_HOUR = 0.04;

// ======================= ĐỘ BỀN =======================
/** Mỗi trận trang bị mang theo mòn 4%; thuyền mòn 3% mỗi chuyến cộng theo thời tiết. */
export const GEAR_WEAR = 4;
export const HULL_WEAR = 3;
/** Hiệu lực theo độ bền: dưới 40% còn một nửa, hỏng hẳn (0) mất tác dụng. */
export const wearMult = (ben: number) => (ben <= 0 ? 0 : ben < 40 ? 0.5 : 1);
