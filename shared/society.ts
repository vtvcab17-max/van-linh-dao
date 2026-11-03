// Xã hội thu nhỏ: vật nuôi theo giai đoạn, thực phẩm hỏng, câu cá, phồn vinh và dân số.
// Thuần & tất định: dùng chung cho client và máy chủ. Thời gian tính theo s.gt (mili giây trong game).
import type { PlayerState } from './logic';
import { bLevel, slotSum } from './economy';
import { FEED_CO_PER_HOUR } from './balance';

const H = 3600_000;
const D = 24 * H;

export type Sp = 'ga' | 'lon' | 'bo' | 'trau';
export interface SpDef {
  name: string;
  /** tên các giai đoạn và mốc bắt đầu (ms kể từ lúc sinh) */
  stages: [string, number][];
  /** giai đoạn trưởng thành (chỉ số trong stages) */
  adult: number;
  buy: number; // đồng
  /** sản phẩm của con trưởng thành */
  use: string;
}
export const SPECIES: Record<Sp, SpDef> = {
  ga: { name: 'Gà', stages: [['Gà con', 0], ['Gà tơ', 1 * D], ['Gà mái', 2 * D]], adult: 2, buy: 15, use: 'đẻ trứng (làm thức ăn hoặc ấp)' },
  lon: { name: 'Lợn', stages: [['Heo con', 0], ['Heo choai', 2 * D], ['Heo thịt', 5 * D]], adult: 2, buy: 40, use: 'lấy thịt' },
  bo: { name: 'Bò', stages: [['Bê', 0], ['Bò tơ', 3 * D], ['Bò sữa', 7 * D]], adult: 2, buy: 90, use: 'cho sữa' },
  trau: { name: 'Trâu', stages: [['Nghé', 0], ['Trâu tơ', 4 * D], ['Trâu cày', 9 * D]], adult: 2, buy: 110, use: 'cày ruộng (+20% sản lượng mỗi con, tối đa +60%)' },
};
export const SP_KEYS = Object.keys(SPECIES) as Sp[];
export const EGG_MS = 8 * H; // gà mái đẻ một trứng
export const MILK_MS = 6 * H; // bò sữa cho một phần sữa
export const HATCH_EGGS = 3;
export const SELL_MEAT = 12; // thịt khi mổ lợn
export const FISH = {
  can: { name: 'Cần câu', cd: 10 * 60_000, ca: 3, need: '' },
  luoi: { name: 'Giăng lưới', cd: 1 * H, ca: 12, need: 'Cần Bến thuyền' },
  thuyen: { name: 'Thuyền đánh cá', cd: 3 * H, ca: 40, need: 'Cần Bến và một chiếc ghe' },
} as const;
export type FishHow = keyof typeof FISH;
/** Hỏng mỗi giờ của thực phẩm tươi (tỉ lệ). */
export const SPOIL: Record<string, number> = { rau: 0.02, thit: 0.03, trung: 0.015, ca: 0.04, sua: 0.06 };
export const PRESERVED = { thit: 'Thịt muối', rau: 'Dưa muối', ca: 'Cá khô', sua: 'Phô mai' } as const;
export type PKey = keyof typeof PRESERVED;
export const PRES_YIELD = 0.6;
export const PRES_PRICE = 4;
export const PERSON_PER_SLOT = 2;

export interface Animal { id: string; sp: Sp; born: number }
export interface Society {
  herd: Animal[];
  eggs: number; // trứng chưa nhặt
  eggAcc: number;
  sua: number;
  suaAcc: number;
  kho: Partial<Record<PKey, number>>; // đồ đã chế biến, không hỏng
  rot: Record<string, number>; // phần dư hỏng
  fishAt: Partial<Record<FishHow, number>>;
  pop: number;
  prosp: number;
  nid: number;
  note?: string;
}
export const newSociety = (): Society => ({ herd: [], eggs: 0, eggAcc: 0, sua: 0, suaAcc: 0, kho: {}, rot: {}, fishAt: {}, pop: 2, prosp: 0, nid: 1 });

export const stageIdx = (a: Animal, gt: number) => {
  const age = Math.max(0, gt - a.born);
  const st = SPECIES[a.sp].stages;
  let i = 0;
  for (let k = 0; k < st.length; k++) if (age >= st[k][1]) i = k;
  return i;
};
export const isAdult = (a: Animal, gt: number) => stageIdx(a, gt) >= SPECIES[a.sp].adult;
export const nextStageIn = (a: Animal, gt: number) => {
  const st = SPECIES[a.sp].stages;
  const i = stageIdx(a, gt);
  return i + 1 < st.length ? a.born + st[i + 1][1] - gt : 0;
};
/** Sức chứa chuồng cho đàn gia súc (mỗi ô một con). */
export const herdCap = (s: PlayerState) => slotSum(s.dinh, 'chuong');
export const popCap = (s: PlayerState) => slotSum(s.dinh, 'nhadan') * PERSON_PER_SLOT;
export const preserveRate = (s: PlayerState) => Math.min(0.8, 0.04 * slotSum(s.dinh, 'khothoc'));
export const trauBonus = (s: PlayerState) => 0.2 * Math.min(3, s.soc.herd.filter((a) => a.sp === 'trau' && isAdult(a, s.gt)).length);

const FOODS = ['thoc', 'gao', 'rau', 'thit', 'trung', 'ca', 'luong'] as const;
export function foodStock(s: PlayerState) {
  let n = 0;
  for (const k of FOODS) n += s.res[k] ?? 0;
  n += s.soc.sua;
  for (const v of Object.values(s.soc.kho)) n += (v ?? 0) * 2;
  return n;
}

export interface Prosperity {
  total: number;
  parts: { k: string; name: string; v: number; w: number }[];
  cap: number;
  overload: number; // 1 = không quá tải
  eff: number; // hệ số hiệu suất lao động
  merchants: number; // đồng/giờ từ thương nhân ghé
}
export function prosperity(s: PlayerState): Prosperity {
  const pop = s.soc.pop;
  const cap = popCap(s);
  const homes = cap > 0 ? Math.min(1, cap / Math.max(6, pop * 1.5)) : 0;
  const food = Math.min(1, foodStock(s) / Math.max(20, pop * 12));
  const market = Math.min(1, (bLevel(s.dinh, 'cho') + 0.5 * bLevel(s.dinh, 'tramthue')) / 3);
  const port = Math.min(1, bLevel(s.dinh, 'benthuyen') / 2);
  const land = Math.min(1, s.land.split('1').length / 60);
  const safe = Math.min(1, (bLevel(s.dinh, 'thapcanh') + bLevel(s.dinh, 'tuong') + bLevel(s.dinh, 'donbinh') + bLevel(s.dinh, 'den')) / 6);
  const fish = Object.values(s.soc.fishAt).some((t) => t !== undefined && s.gt - t < 2 * D) ? 1 : 0;
  const parts = [
    { k: 'nha', name: 'Nhà ở', v: homes, w: 20 },
    { k: 'an', name: 'Thức ăn đủ', v: food, w: 25 },
    { k: 'cho', name: 'Chợ & thuế', v: market, w: 15 },
    { k: 'ben', name: 'Bến thuyền', v: port, w: 10 },
    { k: 'dat', name: 'Đất đai', v: land, w: 10 },
    { k: 'an2', name: 'An ninh', v: safe, w: 10 },
    { k: 'ca', name: 'Nghề cá', v: fish, w: 10 },
  ];
  const total = Math.round(parts.reduce((a, p) => a + p.v * p.w, 0));
  const overload = cap > 0 ? Math.min(1, cap / Math.max(1, pop)) : 1;
  const eff = (1 + Math.max(0, total - 50) / 100) * overload;
  const merchants = total >= 60 ? Math.floor((total - 50) / 10) * (1 + bLevel(s.dinh, 'cho')) : 0;
  return { total, parts, cap, overload, eff, merchants };
}

/** Cập nhật xã hội sau `dt` mili giây game: vật nuôi sinh sản phẩm, thực phẩm hỏng, dân số tiến về mức phù hợp. */
export function settleSociety(s: PlayerState, dt: number) {
  const so = s.soc;
  if (dt <= 0) return;
  const hours = dt / H;
  const adults = (sp: Sp) => so.herd.filter((a) => a.sp === sp && isAdult(a, s.gt)).length;
  const eggCap = 50;
  so.eggAcc += (adults('ga') * dt) / EGG_MS;
  const e = Math.floor(so.eggAcc);
  so.eggAcc -= e;
  so.eggs = Math.min(eggCap, so.eggs + e);
  so.suaAcc += (adults('bo') * dt) / MILK_MS;
  const m = Math.floor(so.suaAcc);
  so.suaAcc -= m;
  so.sua = Math.min(60, so.sua + m);
  // vật nuôi ăn cỏ; thiếu cỏ thì lớn chậm lại (tuổi lùi theo tỉ lệ thiếu)
  if (so.herd.length) {
    const need = so.herd.length * FEED_CO_PER_HOUR * hours;
    const eat = Math.min(need, s.res.co);
    s.res.co = Math.max(0, Math.round((s.res.co - eat) * 1000) / 1000);
    const short = need > 0 ? (need - eat) / need : 0;
    if (short > 0) for (const a of so.herd) a.born += dt * short;
  }
  // thực phẩm tươi hỏng dần; kho tốt thì hỏng chậm
  const keep = 1 - preserveRate(s);
  const lose = (k: string, have: number) => {
    const f = 1 - Math.pow(1 - SPOIL[k] * keep, hours);
    so.rot[k] = (so.rot[k] ?? 0) + have * f;
    const w = Math.min(have, Math.floor(so.rot[k]));
    so.rot[k] -= w;
    return w;
  };
  for (const k of ['rau', 'thit', 'trung', 'ca'] as const) s.res[k] = Math.max(0, s.res[k] - lose(k, s.res[k]));
  so.sua = Math.max(0, so.sua - lose('sua', so.sua));
  // phồn vinh & dân số: mỗi giờ nhập cư/rời đi một người (tối thiểu 2 người)
  const p = prosperity(s);
  so.prosp = p.total;
  const cap = p.cap;
  const target = cap > 0 ? Math.max(2, Math.round((cap * p.total) / 80)) : 2;
  const step = hours * 1;
  if (so.pop < target && p.total >= 40) so.pop = Math.min(target, so.pop + step);
  else if (so.pop > target || (cap > 0 && so.pop > cap)) so.pop = Math.max(Math.min(target, cap || 2), so.pop - step);
  so.pop = Math.max(2, Math.round(so.pop * 100) / 100);
}
