// Kinh tế Vạn Đảo: tiền đồng, vật phẩm, cửa hàng, công trình (nhà cửa, thành trì), tuyến buôn NPC và thuế,
// thôn tính đảo (chư hầu, cứ điểm). Dùng chung cho client và server.
//
// Vòng nối:
//   tài nguyên → xây nhà cửa, thành trì → nhà dân nộp thuế, Trạm thuế thu thuế thương thuyền đi ngang đảo
//   → tiền đồng → cửa hàng NPC, chợ thế giới, đấu giá → vật phẩm hiếm, trang bị
//   → đánh chiếm đảo khác thành chư hầu (cống nạp, chia thuế, làm cứ điểm cho thuyền) và đánh Thủy Tinh.
import type { LvKey, ResKey } from './data';
import { hashStr, mulberry32 } from './rng';
import { GEAR, GEAR_KEYS, type GearKey } from './boss';
import { SEA_COLS, SEA_ROWS } from './mapsize';

// ======================= VẬT PHẨM =======================
export type Rarity = 'thường' | 'hiếm' | 'quý' | 'huyền thoại';
export const RARITY_COLOR: Record<Rarity, string> = { thường: '#d8d2c4', hiếm: '#62b356', quý: '#4f90da', 'huyền thoại': '#ec8d3c' };

export type ItemKey = 'banhchung' | 'ruounep' | 'haido' | 'goquy' | 'ngoctraiden' | 'lenhbai' | 'vayrong' | 'trongdong';
export const ITEM_KEYS: ItemKey[] = ['banhchung', 'ruounep', 'haido', 'goquy', 'ngoctraiden', 'lenhbai', 'vayrong', 'trongdong'];

export interface ItemDef {
  name: string;
  rarity: Rarity;
  desc: string;
  /** giá tham khảo (tiền đồng) */
  value: number;
  /** dùng được (mất khi dùng) hay chỉ cần giữ trong túi */
  use: boolean;
}

export const ITEMS: Record<ItemKey, ItemDef> = {
  banhchung: { name: 'Bánh Chưng', rarity: 'thường', desc: 'Cho cả bốn linh vật ăn no căng.', value: 60, use: true },
  ruounep: { name: 'Rượu Nếp Cái Hoa Vàng', rarity: 'thường', desc: 'Cả bốn linh vật vui vẻ, làm việc hăng hơn.', value: 45, use: true },
  haido: { name: 'Hải Đồ Cổ', rarity: 'hiếm', desc: 'Chuyến thuyền đang đi rút ngắn một nửa thời gian còn lại.', value: 260, use: true },
  goquy: { name: 'Gỗ Trầm Hương', rarity: 'hiếm', desc: 'Đổi lấy 150 gỗ và 80 củi.', value: 220, use: true },
  ngoctraiden: { name: 'Ngọc Trai Đen', rarity: 'quý', desc: 'Đổi lấy 4 Ngọc Trai. Thương buôn rất chuộng.', value: 700, use: true },
  lenhbai: { name: 'Lệnh Bài Thủy Sư', rarity: 'quý', desc: 'Thêm vĩnh viễn 1 đội thợ xây (tối đa 2 lệnh bài).', value: 1500, use: true },
  vayrong: { name: 'Vảy Rồng Lạc Long', rarity: 'huyền thoại', desc: 'Giữ trong túi: +5% công mọi trận (tối đa 3 vảy).', value: 4000, use: false },
  trongdong: { name: 'Trống Đồng Đông Sơn', rarity: 'huyền thoại', desc: 'Giữ trong túi: thuế thu được +25%.', value: 6000, use: false },
};

/** Hàng có thể mua bán: tài nguyên, vật phẩm, trang bị ("g_giao"...). */
export type GoodKey = ResKey | ItemKey | `g_${GearKey}`;

export function goodName(g: string, res: Record<string, { name: string }>): string {
  if (g.startsWith('g_')) return GEAR[g.slice(2) as GearKey]?.name ?? g;
  if (g in ITEMS) return ITEMS[g as ItemKey].name;
  return res[g]?.name ?? g;
}
export function goodRarity(g: string): Rarity {
  if (g.startsWith('g_')) return g === 'g_bua' ? 'quý' : 'hiếm';
  if (g in ITEMS) return ITEMS[g as ItemKey].rarity;
  return g === 'ngoc' ? 'hiếm' : 'thường';
}
export function isGood(g: unknown): g is GoodKey {
  if (typeof g !== 'string') return false;
  if (g.startsWith('g_')) return GEAR_KEYS.includes(g.slice(2) as GearKey);
  return g in ITEMS || ['co', 'la', 'tre', 'go', 'cui', 'da', 'sat', 'so', 'ngoc'].includes(g);
}

// ======================= CỬA HÀNG NPC =======================
export interface ShopOffer {
  id: string;
  good: GoodKey;
  n: number;
  price: number;
  /** giới hạn mua mỗi ngày */
  daily?: number;
}

export const SHOP_BASE: ShopOffer[] = [
  { id: 'bc', good: 'banhchung', n: 1, price: 60 },
  { id: 'rn', good: 'ruounep', n: 1, price: 45 },
  { id: 'go', good: 'go', n: 100, price: 120 },
  { id: 'tre', good: 'tre', n: 100, price: 110 },
  { id: 'da', good: 'da', n: 100, price: 110 },
  { id: 'sat', good: 'sat', n: 60, price: 150 },
  { id: 'la', good: 'la', n: 100, price: 90 },
  { id: 'hd', good: 'haido', n: 1, price: 320, daily: 2 },
];

/** Hàng hiếm bày bán theo ngày (đổi mỗi 00:00 giờ Việt Nam), mỗi người mua 1 lần/ngày. */
export function shopSpecial(day: number): ShopOffer {
  const r = mulberry32(hashStr(`shop:${day}`));
  const pool: [GoodKey, number][] = [
    ['goquy', 300],
    ['ngoctraiden', 950],
    ['lenhbai', 2200],
    ['vayrong', 5600],
    ['g_bua', 900],
  ];
  const [good, price] = pool[Math.floor(r() * pool.length)];
  return { id: 'sp', good, n: 1, price, daily: 1 };
}

export const DAY0 = Date.UTC(2026, 10, 1, 17, 0, 0); // 00:00 02/11/2026 giờ VN
export const dayOf = (now: number) => Math.floor((now - DAY0) / 86_400_000);

// ======================= CÔNG TRÌNH =======================
export type BKey = 'nhadan' | 'khothoc' | 'cho' | 'tramthue' | 'thapcanh' | 'tuong' | 'donbinh' | 'xuongren' | 'den';
export const B_KEYS: BKey[] = ['nhadan', 'khothoc', 'cho', 'tramthue', 'thapcanh', 'tuong', 'donbinh', 'xuongren', 'den'];

export interface BDef {
  names: [string, string, string];
  desc: string;
  group: 'nhà cửa' | 'kinh tế' | 'thành trì';
  max: number;
  /** cần Nhà chính bậc mấy */
  needLeu: number;
  cost: Partial<Record<ResKey, number>>[];
  /** thời gian xây (ms) theo cấp 1..3 */
  ms: [number, number, number];
}

const M = 60_000;
export const BUILDINGS: Record<BKey, BDef> = {
  nhadan: { names: ['Lều Ngư Dân', 'Nhà Ba Gian', 'Nhà Ngói Năm Gian'], desc: 'Dân nộp thuế: +4 tiền mỗi giờ mỗi cấp.', group: 'nhà cửa', max: 6, needLeu: 1, cost: [{ go: 30, co: 20 }, { go: 80, da: 40, tre: 40 }, { go: 200, da: 120, sat: 40 }], ms: [2 * M, 15 * M, 90 * M] },
  khothoc: { names: ['Vựa Thóc', 'Kho Lẫm', 'Kho Đụn'], desc: 'Kho chứa tài nguyên +30% mỗi cấp.', group: 'kinh tế', max: 2, needLeu: 1, cost: [{ go: 50, tre: 30 }, { go: 120, da: 80 }, { go: 260, da: 200, sat: 60 }], ms: [3 * M, 20 * M, 2 * 60 * M] },
  cho: { names: ['Sạp Chợ Phiên', 'Chợ Làng', 'Chợ Phố Hội'], desc: 'Cửa hàng rẻ hơn 5% mỗi cấp, phí chợ thế giới giảm 1% mỗi cấp.', group: 'kinh tế', max: 1, needLeu: 2, cost: [{ go: 80, tre: 60, so: 40 }, { go: 160, da: 100, so: 120 }, { go: 320, da: 220, so: 300 }], ms: [10 * M, 45 * M, 3 * 60 * M] },
  tramthue: { names: ['Cầu Tàu Gỗ', 'Bến Cảng Đá', 'Thương Cảng'], desc: 'Thu thuế thương thuyền đi ngang đảo: ×1, ×1,6, ×2,3 (không có chỉ thu ×0,25).', group: 'kinh tế', max: 1, needLeu: 2, cost: [{ go: 100, tre: 80 }, { go: 220, da: 160, sat: 40 }, { go: 400, da: 300, sat: 120, ngoc: 2 }], ms: [10 * M, 60 * M, 4 * 60 * M] },
  thapcanh: { names: ['Chòi Canh', 'Tháp Canh Gạch', 'Vọng Lâu Nỏ Thần'], desc: 'Giữ đảo: thêm một xạ thủ bắn từ trên tháp.', group: 'thành trì', max: 4, needLeu: 2, cost: [{ go: 60, tre: 60 }, { go: 120, da: 120 }, { go: 240, da: 260, sat: 80 }], ms: [5 * M, 30 * M, 2 * 60 * M] },
  tuong: { names: ['Tường Rào Đất', 'Tường Đá Ong', 'Thành Gạch Vồ'], desc: 'Giữ đảo: Lũy tre chắn thêm 150 máu mỗi cấp.', group: 'thành trì', max: 8, needLeu: 2, cost: [{ da: 40, co: 20 }, { da: 100, go: 40 }, { da: 220, sat: 40 }], ms: [3 * M, 20 * M, 90 * M] },
  donbinh: { names: ['Trại Lính', 'Đồn Binh', 'Thủy Trại'], desc: 'Giữ đảo: thêm một lính đồn. Cần có để đánh chiếm đảo khác; cấp càng cao giữ được càng nhiều chư hầu.', group: 'thành trì', max: 2, needLeu: 3, cost: [{ go: 120, da: 80, sat: 30 }, { go: 240, da: 180, sat: 80 }, { go: 480, da: 360, sat: 200, ngoc: 3 }], ms: [15 * M, 90 * M, 5 * 60 * M] },
  xuongren: { names: ['Lò Rèn', 'Xưởng Rèn', 'Lò Đúc Đồng'], desc: 'Chế tạo trang bị rẻ hơn 10% mỗi cấp.', group: 'kinh tế', max: 1, needLeu: 2, cost: [{ da: 80, sat: 40 }, { da: 160, sat: 100 }, { da: 300, sat: 240, ngoc: 2 }], ms: [10 * M, 60 * M, 3 * 60 * M] },
  den: { names: ['Miếu Thổ Thần', 'Đền Sơn Tinh', 'Đền Hùng Thu Nhỏ'], desc: 'Linh vật đói chậm hơn 15% mỗi cấp; đánh Thủy Tinh +5% công mỗi cấp.', group: 'nhà cửa', max: 1, needLeu: 3, cost: [{ go: 100, da: 100, so: 60 }, { go: 200, da: 200, so: 200 }, { go: 400, da: 400, so: 500, ngoc: 4 }], ms: [20 * M, 2 * 60 * M, 6 * 60 * M] },
};

export interface Dinh {
  id: string;
  k: BKey;
  x: number;
  y: number;
  /** cấp đã xong (0 = đang xây lần đầu) */
  lv: number;
  /** đang xây lên cấp này, xong lúc doneAt (giờ trong game) */
  to?: number;
  doneAt?: number;
}

/** Cấp thành trì theo tổng cấp tường, tháp, đồn. */
export const FORT_NAMES = ['Đảo Trống', 'Xóm Đảo', 'Làng Lũy', 'Đồn Lũy', 'Thành Trì', 'Kinh Thành'];
export function fortLevel(d: Dinh[]): number {
  const pts = d.filter((x) => x.lv > 0 && (x.k === 'tuong' || x.k === 'thapcanh' || x.k === 'donbinh')).reduce((t, x) => t + x.lv * (x.k === 'donbinh' ? 3 : x.k === 'thapcanh' ? 2 : 1), 0);
  return pts >= 40 ? 5 : pts >= 24 ? 4 : pts >= 12 ? 3 : pts >= 5 ? 2 : pts >= 1 ? 1 : 0;
}

/** Sức giữ đảo từ thành trì (để ghép vào trận). */
export interface DefSpec {
  thap: number[];
  don: number[];
  tuongHp: number;
}
export function defSpecOf(d: Dinh[]): DefSpec {
  const done = d.filter((x) => x.lv > 0);
  return {
    thap: done.filter((x) => x.k === 'thapcanh').map((x) => x.lv),
    don: done.filter((x) => x.k === 'donbinh').map((x) => x.lv),
    tuongHp: done.filter((x) => x.k === 'tuong').reduce((t, x) => t + x.lv * 150, 0),
  };
}
export function cleanDef(raw: unknown): DefSpec {
  const r = (raw ?? {}) as Partial<DefSpec>;
  const lv = (a: unknown, n: number) => (Array.isArray(a) ? a.slice(0, n).map((v) => Math.max(1, Math.min(3, Math.floor(Number(v)) || 1))) : []);
  return { thap: lv(r.thap, 4), don: lv(r.don, 2), tuongHp: Math.max(0, Math.min(3600, Math.floor(Number(r.tuongHp)) || 0)) };
}

export const bLevel = (d: Dinh[], k: BKey) => d.filter((x) => x.k === k && x.lv > 0).reduce((m, x) => Math.max(m, x.lv), 0);
export const bSum = (d: Dinh[], k: BKey) => d.filter((x) => x.k === k && x.lv > 0).reduce((t, x) => t + x.lv, 0);

// ======================= TUYẾN BUÔN NPC VÀ THUẾ =======================
export const ROUTE_MS = 6 * 3600_000; // thương buôn định lại tuyến mỗi 6 giờ
export const routePeriod = (now: number) => Math.floor((now - DAY0) / ROUTE_MS);

export interface Merchant {
  id: string;
  name: string;
  color: string;
  goods: GoodKey[];
}
export const MERCHANTS: Merchant[] = [
  { id: 'hoian', name: 'Thương thuyền Hội An', color: '#f6d34d', goods: ['ruounep', 'goquy', 'so'] },
  { id: 'phohien', name: 'Thuyền buôn Phố Hiến', color: '#ef7c98', goods: ['banhchung', 'haido', 'sat'] },
  { id: 'cholon', name: 'Thuyền mành Chợ Lớn', color: '#5fd0e0', goods: ['ngoctraiden', 'go', 'da'] },
  { id: 'vando', name: 'Thương cảng Vân Đồn', color: '#a6d86e', goods: ['lenhbai', 'tre', 'la'] },
  { id: 'thinai', name: 'Ghe bầu Thị Nại', color: '#c3a3f0', goods: ['vayrong', 'ngoc', 'cui'] },
];

export interface Route {
  m: Merchant;
  pts: { x: number; y: number }[];
  /** thuế mỗi giờ cho đảo nằm sát tuyến (có Trạm thuế cấp 1) */
  value: number;
}

/** Tuyến buôn của một khung 6 giờ: mỗi thương hội NPC chọn 3–5 điểm ghé khác nhau. */
export function routesAt(period: number): Route[] {
  return MERCHANTS.map((m, i) => {
    const r = mulberry32(hashStr(`route:${m.id}:${period}`));
    const n = 3 + Math.floor(r() * 3);
    const pts: { x: number; y: number }[] = [];
    // vào từ một mép hải đồ, đi ngang qua giữa, ra mép khác
    const side = (i + period) % 4;
    const edge = (sd: number) =>
      sd === 0 ? { x: 1, y: 2 + Math.floor(r() * (SEA_ROWS - 4)) } : sd === 1 ? { x: SEA_COLS - 2, y: 2 + Math.floor(r() * (SEA_ROWS - 4)) } : sd === 2 ? { x: 2 + Math.floor(r() * (SEA_COLS - 4)), y: 1 } : { x: 2 + Math.floor(r() * (SEA_COLS - 4)), y: SEA_ROWS - 2 };
    pts.push(edge(side));
    for (let k = 0; k < n - 2; k++) pts.push({ x: 4 + Math.floor(r() * (SEA_COLS - 8)), y: 3 + Math.floor(r() * (SEA_ROWS - 6)) });
    pts.push(edge((side + 1 + Math.floor(r() * 2)) % 4));
    return { m, pts, value: 18 + Math.floor(r() * 22) };
  });
}

function distSeg(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Đảo cách tuyến tối đa 2,5 ô thì thương thuyền ghé nộp thuế. */
export const TOLL_RANGE = 2.5;
export function routesNear(cell: { x: number; y: number }, period: number): Route[] {
  return routesAt(period).filter((rt) => rt.pts.some((p, i) => i > 0 && distSeg(cell, rt.pts[i - 1], p) <= TOLL_RANGE));
}

export const PORT_MULT = [0.25, 1, 1.6, 2.3];

/** Thuế thương thuyền mỗi giờ của một ô đảo. */
export function tollPerHour(cell: { x: number; y: number }, period: number, portLv: number, bonus = 0): number {
  const base = routesNear(cell, period).reduce((t, r) => t + r.value, 0);
  return base * PORT_MULT[Math.max(0, Math.min(3, portLv))] * (1 + bonus);
}

/** Vị trí thương thuyền trên tuyến lúc now (0..1 dọc tuyến, đi qua lại). */
export function merchantPos(rt: Route, now: number) {
  const len: number[] = [];
  let total = 0;
  for (let i = 1; i < rt.pts.length; i++) {
    const l = Math.hypot(rt.pts[i].x - rt.pts[i - 1].x, rt.pts[i].y - rt.pts[i - 1].y);
    len.push(l);
    total += l;
  }
  const lap = (((now - DAY0) % ROUTE_MS) + ROUTE_MS) % ROUTE_MS / ROUTE_MS;
  let d = (lap < 0.5 ? lap * 2 : 2 - lap * 2) * total;
  for (let i = 0; i < len.length; i++) {
    if (d <= len[i]) {
      const a = rt.pts[i],
        b = rt.pts[i + 1],
        t = d / (len[i] || 1);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, dir: lap < 0.5 ? Math.sign(b.x - a.x) : -Math.sign(b.x - a.x) };
    }
    d -= len[i];
  }
  const e = rt.pts[rt.pts.length - 1];
  return { x: e.x, y: e.y, dir: 1 };
}

// ======================= THÔN TÍNH, CHƯ HẦU =======================
/** Chư hầu bị giữ 72 giờ (giờ thật) rồi tự được tự do. */
export const VASSAL_MS = 72 * 3600_000;
/** Số chư hầu tối đa theo cấp Đồn binh cao nhất. */
export const MAX_VASSALS = [0, 1, 2, 4];
/** Cống nạp mỗi giờ theo sức mạnh của đảo chư hầu. */
export const tributePerHour = (power: number) => Math.round(6 + power / 25);
/** Chủ được hưởng phần này của thuế thương thuyền đi ngang đảo chư hầu. */
export const VASSAL_TOLL_SHARE = 0.5;

export interface Vassal {
  id: string;
  name: string;
  islandName: string;
  cell: { x: number; y: number };
  power: number;
  port: number;
  until: number;
  bot?: boolean;
}
export interface Lord {
  id: string;
  name: string;
  islandName: string;
  until: number;
}

/** Phí chợ thế giới: 5%, giảm theo Chợ phiên, thương hội. */
export function marketFee(choLv: number, inGuild: boolean): number {
  return Math.max(0.02, 0.05 - choLv * 0.01 - (inGuild ? 0.01 : 0));
}

/** Thương hội: cấp theo quỹ đã góp; mỗi cấp +5% thuế cho hội viên, thêm chỗ. */
export const GUILD_COST = 1000;
export const guildLevel = (fund: number) => (fund >= 50000 ? 5 : fund >= 20000 ? 4 : fund >= 8000 ? 3 : fund >= 2500 ? 2 : 1);
export const guildMax = (lv: number) => 10 + lv * 6;

export const LV_NAME: Record<LvKey, string> = { leu: 'Nhà chính', cuoc: 'Cuốc', rao: 'Lũy tre', thuyen: 'Thuyền' };
