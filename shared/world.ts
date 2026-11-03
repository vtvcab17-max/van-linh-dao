// Hải đồ lục giác rất rộng của mỗi Hải Khu, sinh theo mã Hải Khu (client và server ra giống hệt nhau).
// Càng vào gần Mắt Bão (tâm bản đồ) đảo càng giàu, quái càng mạnh. Người chơi khởi đầu ở vành ngoài.
import { SEA_COLS, SEA_ROWS } from './mapsize';
import { hexDist, hexKey, hexRange, type Hex } from './hex';
import { hashStr, mulberry32, type Rng } from './rng';
import type { MonsterKey, ResKey, WildDef } from './data';

export const WORLD_W = SEA_COLS;
export const WORLD_H = SEA_ROWS;
export const CENTER: Hex = { c: Math.floor(WORLD_W / 2), r: Math.floor(WORLD_H / 2) };
/** Khoảng cách từ Mắt Bão tới vành ngoài có người ở (chia 10 vùng). */
export const RMAX = 470;
/** Đổi phiên bản khi hải đồ đổi kích thước/cách sinh: dữ liệu toạ độ cũ phải dời chỗ. */
export const WORLD_VERSION = 2;

export const inWorld = (c: number, r: number) => c >= 0 && r >= 0 && c < WORLD_W && r < WORLD_H;

/** Cấp vùng biển 1..10: vành ngoài cấp 1, sát Mắt Bão cấp 10. */
export function zoneLevel(c: number, r: number): number {
  const d = hexDist({ c, r }, CENTER);
  return Math.max(1, Math.min(10, 10 - Math.floor((d - 8) / ((RMAX - 8) / 9))));
}
export const ZONE_NAMES = ['', 'Biển Lặng', 'Biển Lặng', 'Vịnh Gió', 'Vịnh Gió', 'Biển Sóng Bạc', 'Biển Sóng Bạc', 'Biển Sâu', 'Biển Sâu', 'Vùng Xoáy', 'Mắt Bão'];

function noise(x: number, y: number, s: number) {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function smooth(x: number, y: number, s: number, k: number) {
  const fx = x / k, fy = y / k, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = noise(x0, y0, s), b = noise(x0 + 1, y0, s), c = noise(x0, y0 + 1, s), d = noise(x0 + 1, y0 + 1, s);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export type Terrain = 'sea' | 'deep' | 'shoal' | 'reef' | 'storm';
export const TERRAIN_NAME: Record<Terrain, string> = { sea: 'Biển', deep: 'Biển sâu', shoal: 'Bãi cạn', reef: 'Rạn đá ngầm', storm: 'Vùng bão' };
/** Đi qua chậm hơn bao nhiêu lần. Rạn đá ngầm không đi qua được. */
export const TERRAIN_COST: Record<Terrain, number> = { sea: 1, deep: 1, shoal: 1.5, reef: Infinity, storm: 2.5 };

// ======================= ĐẢO TỰ NHIÊN VÀ HANG QUÁI =======================
export type IsleKind = 'go' | 'da' | 'sat' | 'ngoc' | 'ruong' | 'bian';
export const ISLE_KIND: Record<IsleKind, { name: string; desc: string; yields: Partial<Record<ResKey, number>>; guard: MonsterKey[] }> = {
  go: { name: 'Đảo Rừng', desc: 'Rừng gỗ, tre bạt ngàn.', yields: { go: 14, tre: 10, la: 6 }, guard: ['khida', 'khida', 'canoc'] },
  da: { name: 'Đảo Đá', desc: 'Núi đá vôi, mỏ đá lộ thiên.', yields: { da: 16, co: 6 }, guard: ['cuagai', 'cuada', 'cuagai'] },
  sat: { name: 'Đảo Quặng', desc: 'Quặng sắt đỏ quạch dưới chân.', yields: { sat: 9, da: 6 }, guard: ['cuada', 'haitac', 'cuagai'] },
  ngoc: { name: 'Đảo Ngọc Trai', desc: 'Bãi trai, sò dày đặc.', yields: { so: 12, ngoc: 0.15 }, guard: ['sualua', 'canoc', 'sualua'] },
  ruong: { name: 'Đảo Dừa', desc: 'Dừa, cỏ tranh, đất màu.', yields: { co: 12, la: 12, cui: 8 }, guard: ['khida', 'haitac', 'canoc'] },
  bian: { name: 'Đảo Bí Ẩn', desc: 'Không ai biết trên đảo có gì. Người về kể có vàng bạc, có cả quái vật.', yields: { go: 14, da: 14, sat: 8, so: 18, ngoc: 0.3 }, guard: ['baytheo', 'cuada', 'haitac', 'sualua'] },
};

export interface Isle {
  id: string;
  c: number;
  r: number;
  kind: IsleKind;
  lv: number;
  name: string;
  /** cấp chúa đảo tối thiểu để cắm cờ chủ quyền và xây trên đảo này */
  needLvl: number;
  guard: [MonsterKey, number][];
  /** sản lượng mỗi giờ khi đã cắm cờ */
  yields: Partial<Record<ResKey, number>>;
}

export type LairKind = 'haitac' | 'thuyquai' | 'cua' | 'sua' | 'khi';
export const LAIR_KIND: Record<LairKind, { name: string; enemies: MonsterKey[]; loot: Partial<Record<ResKey, number>> }> = {
  haitac: { name: 'Sào Huyệt Hải Tặc', enemies: ['haitac', 'haitac', 'baytheo'], loot: { so: 10, go: 6, sat: 3 } },
  thuyquai: { name: 'Hang Thủy Quái', enemies: ['cuada', 'canoc', 'sualua'], loot: { sat: 5, so: 8, ngoc: 0 } },
  cua: { name: 'Bãi Cua Gai', enemies: ['cuagai', 'cuagai', 'cuada'], loot: { sat: 4, da: 6, so: 5 } },
  sua: { name: 'Rạn Sứa Lửa', enemies: ['sualua', 'sualua', 'canoc'], loot: { la: 6, so: 6, sat: 2 } },
  khi: { name: 'Đảo Khỉ Đá', enemies: ['khida', 'khida', 'canoc'], loot: { go: 8, tre: 6, so: 6 } },
};

const PRE = ['Hòn', 'Cù Lao', 'Đảo', 'Bãi', 'Gành', 'Cồn', 'Hòn'];
const MID = ['Mây', 'Sấu', 'Rùa', 'Tre', 'Đá Đen', 'Trầm', 'Yến', 'Ngọc', 'Gió', 'Sóng', 'Cò', 'Vích', 'Ráng', 'Sao', 'Nghêu', 'Trúc', 'Khói', 'Ốc', 'Lửa', 'Mun', 'Sẻ', 'Chàm', 'Dừa', 'Bạc', 'Đồi Mồi', 'Hạc', 'Cá Voi', 'Mắt Rồng', 'Sư Tử', 'Trống', 'Chuông', 'Hương', 'Lau', 'Sậy', 'Mù U', 'Bàng', 'Phi Lao', 'Sò Huyết', 'Rạng Đông', 'Tịch Dương'];
const BIAN = ['Hòn Ma', 'Đảo Không Tên', 'Hòn Câm', 'Đảo Sương', 'Hòn Mắt Quỷ', 'Đảo Trôi', 'Hòn Xương Cá', 'Đảo Bóng Đêm', 'Hòn Gương', 'Đảo Thần Ngủ'];

export type WorldObj = { kind: 'isle'; v: Isle } | { kind: 'lair'; v: WildDef };
export interface World {
  seed: string;
  /** đảo máy (bot): ô cố định */
  bots: Map<string, Hex>;
  boss: Hex;
  /** đảo hoặc hang quái ở đúng ô này */
  at(c: number, r: number): WorldObj | undefined;
  /** đảo tự nhiên trong một khung (cột c0..c1, hàng r0..r1) */
  islesIn(c0: number, r0: number, c1: number, r1: number): Isle[];
  /** hang quái trong một khung */
  lairsIn(c0: number, r0: number, c1: number, r1: number): WildDef[];
  /** chỗ khởi đầu thứ i (vành ngoài, biển thường, xa đảo/hang) */
  spawn(i: number): Hex;
}

/** Địa hình của một ô (tính trực tiếp, không cần lưu). */
export function terrainAt(seed: string, c: number, r: number): Terrain {
  const s = hashStr(`terrain:${seed}`) % 100000;
  const d = hexDist({ c, r }, CENTER);
  if (d <= 8 && d > 0) return 'storm';
  const reef = smooth(c, r, s + 11, 3.2);
  if (reef > 0.86 && d > 10) return 'reef';
  const deep = smooth(c, r, s + 3, 9);
  if (deep > 0.68) return 'deep';
  if (smooth(c, r, s + 7, 5) > 0.78) return 'shoal';
  return 'sea';
}

// ---------------- sinh từng khối 5x5 khi cần (hải đồ hơn 1 triệu ô, không sinh trước cả) ----------------
const BLK = 5;
interface Block {
  isle?: Isle;
  lair?: WildDef;
}
const blkCache = new Map<string, Block>();
function block(seed: string, gx: number, gy: number): Block {
  const key = `${seed}|${gx}|${gy}`;
  const hit = blkCache.get(key);
  if (hit) return hit;
  const b: Block = {};
  const r: Rng = mulberry32(hashStr(`blk:${seed}:${gx}:${gy}`));
  // rút đủ số ngẫu nhiên theo thứ tự cố định để khối nào cũng ra giống nhau ở client và server
  const want = { isle: r() < 0.6, lair: r() < 0.5 };
  const pos = { isle: [r(), r()], lair: [r(), r()] };
  const pick = [r(), r(), r(), r(), r(), r()];
  for (const what of ['isle', 'lair'] as const) {
    if (!want[what]) continue;
    const c = gx * BLK + 1 + Math.floor(pos[what][0] * (BLK - 2));
    const rr = gy * BLK + 1 + Math.floor(pos[what][1] * (BLK - 2));
    if (!inWorld(c, rr)) continue;
    const t = terrainAt(seed, c, rr);
    if (t === 'storm' || t === 'reef') continue;
    if (hexDist({ c, r: rr }, CENTER) <= 10) continue;
    if (what === 'lair' && b.isle && hexDist({ c, r: rr }, b.isle) <= 1) continue;
    const lv = zoneLevel(c, rr);
    if (what === 'isle') {
      const bianP = 0.06 + lv * 0.03;
      const kinds: IsleKind[] = ['go', 'da', 'sat', 'ngoc', 'ruong'];
      const kind: IsleKind = pick[0] < bianP ? 'bian' : kinds[Math.floor(pick[1] * kinds.length)];
      const K = ISLE_KIND[kind];
      const glv = Math.min(30, lv * 2 + (kind === 'bian' ? 3 : 0));
      const guard: [MonsterKey, number][] = K.guard.map((m) => [m, glv]);
      if (lv >= 5) guard.push([K.guard[0], glv]);
      if (kind === 'bian') guard.push(['baytheo', glv + 2]);
      const name = kind === 'bian' ? BIAN[Math.floor(pick[2] * BIAN.length)] : `${PRE[Math.floor(pick[2] * PRE.length)]} ${MID[Math.floor(pick[3] * MID.length)]}`;
      const mult = lv * (kind === 'bian' ? 2 : 1);
      const yields: Partial<Record<ResKey, number>> = {};
      for (const [k, v] of Object.entries(K.yields)) yields[k as ResKey] = Math.round((v ?? 0) * mult * 100) / 100;
      b.isle = { id: `i${c}_${rr}`, c, r: rr, kind, lv, name, needLvl: Math.max(1, (lv - 1) * 3 + (kind === 'bian' ? 2 : 0)), guard, yields };
    } else {
      const kinds = Object.keys(LAIR_KIND) as LairKind[];
      const kind = kinds[Math.floor(pick[4] * kinds.length)];
      const L = LAIR_KIND[kind];
      const elv = Math.min(30, lv * 2);
      const loot: Partial<Record<ResKey, number>> = {};
      for (const [k, v] of Object.entries(L.loot)) loot[k as ResKey] = Math.round((v ?? 0) * (1 + lv * 0.8));
      if (lv >= 6) loot.ngoc = 1;
      b.lair = {
        id: `l${c}_${rr}`,
        name: `${L.name} cấp ${lv}`,
        level: lv,
        enemies: L.enemies.map((m) => [m, elv] as [MonsterKey, number]),
        loot,
        chest: Math.min(5, Math.floor(lv / 2)),
        chestChance: 0.25 + lv * 0.02,
        respawnMs: (8 + lv * 3) * 60_000,
        sx: c,
        sy: rr,
      };
    }
  }
  if (blkCache.size > 80_000) blkCache.clear();
  blkCache.set(key, b);
  return b;
}

export function objAt(seed: string, c: number, r: number): WorldObj | undefined {
  if (!inWorld(c, r)) return undefined;
  const b = block(seed, Math.floor(c / BLK), Math.floor(r / BLK));
  if (b.isle && b.isle.c === c && b.isle.r === r) return { kind: 'isle', v: b.isle };
  if (b.lair && b.lair.sx === c && b.lair.sy === r) return { kind: 'lair', v: b.lair };
  return undefined;
}
function eachBlock(c0: number, r0: number, c1: number, r1: number, f: (gx: number, gy: number) => void) {
  const gx0 = Math.max(0, Math.floor(Math.min(c0, c1) / BLK)), gx1 = Math.min(Math.ceil(WORLD_W / BLK) - 1, Math.floor(Math.max(c0, c1) / BLK));
  const gy0 = Math.max(0, Math.floor(Math.min(r0, r1) / BLK)), gy1 = Math.min(Math.ceil(WORLD_H / BLK) - 1, Math.floor(Math.max(r0, r1) / BLK));
  for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) f(gx, gy);
}
/** Có đảo/hang nào trong bán kính k quanh ô không. */
function nearObj(seed: string, c: number, r: number, k: number) {
  let hit = false;
  eachBlock(c - k, r - k, c + k, r + k, (gx, gy) => {
    const b = block(seed, gx, gy);
    if (b.isle && hexDist(b.isle, { c, r }) <= k) hit = true;
    if (b.lair && hexDist({ c: b.lair.sx!, r: b.lair.sy! }, { c, r }) <= k) hit = true;
  });
  return hit;
}

/** Chỗ khởi đầu thứ i: rải ngẫu nhiên trên vành ngoài (vùng cấp 1–2), biển thường, cách đảo/hang ít nhất 2 ô. */
function spawnCand(seed: string, i: number): Hex {
  const r = mulberry32(hashStr(`spawn:${seed}:${i}`));
  for (let t = 0; t < 16; t++) {
    const a = r() * Math.PI * 2;
    const rad = RMAX + 30 - r() * 80;
    const c = Math.round(CENTER.c + Math.cos(a) * rad), rr = Math.round(CENTER.r + Math.sin(a) * rad);
    if (c < 4 || rr < 4 || c > WORLD_W - 5 || rr > WORLD_H - 5 || zoneLevel(c, rr) > 2) continue;
    if (terrainAt(seed, c, rr) !== 'sea' || nearObj(seed, c, rr, 2)) continue;
    return { c, r: rr };
  }
  return { c: CENTER.c + RMAX - 40, r: CENTER.r + (i % 50) };
}

const cache = new Map<string, World>();
/** Thế giới của một Hải Khu: sinh dần theo khối khi cần (có bộ nhớ đệm). */
export function worldOf(seed: string, botIds: string[] = []): World {
  const key = `${seed}|${botIds.join(',')}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const w: World = {
    seed,
    bots: new Map(),
    boss: { ...CENTER },
    at: (c, r) => objAt(seed, c, r),
    islesIn: (c0, r0, c1, r1) => {
      const out: Isle[] = [];
      eachBlock(c0, r0, c1, r1, (gx, gy) => {
        const i = block(seed, gx, gy).isle;
        if (i && i.c >= c0 && i.c <= c1 && i.r >= r0 && i.r <= r1) out.push(i);
      });
      return out;
    },
    lairsIn: (c0, r0, c1, r1) => {
      const out: WildDef[] = [];
      eachBlock(c0, r0, c1, r1, (gx, gy) => {
        const l = block(seed, gx, gy).lair;
        if (l && l.sx! >= c0 && l.sx! <= c1 && l.sy! >= r0 && l.sy! <= r1) out.push(l);
      });
      return out;
    },
    spawn: (i) => spawnCand(seed, Math.abs(Math.floor(i)) % 1_000_000),
  };
  // đảo máy rải đều trên vành ngoài như người chơi
  const taken: Hex[] = [];
  botIds.forEach((id, k) => {
    const h = pickSpawn(w, taken, 12, hashStr(`bot:${id}`) + k * 7919) ?? w.spawn(k);
    taken.push(h);
    w.bots.set(id, h);
  });
  cache.set(key, w);
  return w;
}

/** Chọn chỗ khởi đầu cách mọi người đã có ít nhất `gap` ô (nới dần nếu chật). */
export function pickSpawn(w: World, taken: Hex[], gap = 12, start = 0): Hex | null {
  for (let g = gap; g >= 3; g -= 3)
    for (let i = 0; i < 240; i++) {
      const h = w.spawn(start + i);
      if (taken.every((t) => hexDist(t, h) >= g)) return h;
    }
  return null;
}

const parseId = (id: string) => {
  const m = id.match(/^[il](\d+)_(\d+)$/);
  return m ? { c: Number(m[1]), r: Number(m[2]) } : null;
};
export const isleById = (w: World, id: string) => {
  const p = parseId(id);
  const o = p && w.at(p.c, p.r);
  return o?.kind === 'isle' ? o.v : undefined;
};
export const lairById = (w: World, id: string) => {
  const p = parseId(id);
  const o = p && w.at(p.c, p.r);
  return o?.kind === 'lair' ? o.v : undefined;
};

/** Đoàn thuyền thấy trên hải đồ (giờ thật). Chỉ thuyền mình và cùng thương hội mới biết chủ. */
export interface FleetView {
  id: string;
  k: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** rời bến, tới nơi, về bến (giờ thật, ms) */
  d: number;
  a: number;
  r: number;
  /** bậc thuyền (để vẽ) */
  t: number;
  mine: boolean;
  /** tên chủ thuyền ('' = thuyền lạ) */
  who: string;
}
/** Chủ của một đảo tự nhiên. */
export interface IsleOwner {
  p: string;
  n: string;
  g: string;
  don: number;
  thap: number;
}
/** Vị trí đoàn thuyền lúc now (toạ độ ô, có lẻ). */
export function fleetPos(f: FleetView, now: number): { x: number; y: number } | null {
  if (now < f.d || now > f.r) return null;
  const t = now <= f.a ? (now - f.d) / Math.max(1, f.a - f.d) : 1 - (now - f.a) / Math.max(1, f.r - f.a);
  return { x: f.from.x + (f.to.x - f.from.x) * t, y: f.from.y + (f.to.y - f.from.y) * t };
}
