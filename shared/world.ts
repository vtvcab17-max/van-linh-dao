// Hải đồ lục giác rất rộng của mỗi Hải Khu, sinh theo mã Hải Khu (client và server ra giống hệt nhau).
// Càng vào gần Mắt Bão (tâm bản đồ) đảo càng giàu, quái càng mạnh. Người chơi khởi đầu ở vành ngoài.
import { SEA_COLS, SEA_ROWS } from './mapsize';
import { hexDist, hexKey, hexRange, type Hex } from './hex';
import { hashStr, mulberry32, type Rng } from './rng';
import type { MonsterKey, ResKey, WildDef } from './data';

export const WORLD_W = SEA_COLS;
export const WORLD_H = SEA_ROWS;
export const CENTER: Hex = { c: Math.floor(WORLD_W / 2), r: Math.floor(WORLD_H / 2) };
/** Khoảng cách xa nhất từ tâm tới vành ngoài (dùng chia vùng). */
const RMAX = 60;

export const inWorld = (c: number, r: number) => c >= 0 && r >= 0 && c < WORLD_W && r < WORLD_H;

/** Cấp vùng biển 1..10: vành ngoài cấp 1, sát Mắt Bão cấp 10. */
export function zoneLevel(c: number, r: number): number {
  const d = hexDist({ c, r }, CENTER);
  return Math.max(1, Math.min(10, 10 - Math.floor((d - 4) / ((RMAX - 4) / 9))));
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

export interface World {
  seed: string;
  isles: Isle[];
  lairs: WildDef[];
  /** ô khởi đầu cho người chơi mới (vành ngoài, xa đảo tự nhiên) */
  spawns: Hex[];
  /** đảo máy (bot): ô cố định */
  bots: Map<string, Hex>;
  boss: Hex;
  /** ô có đảo/hang → đối tượng */
  at: Map<string, { kind: 'isle'; v: Isle } | { kind: 'lair'; v: WildDef }>;
}

const cache = new Map<string, World>();

/** Địa hình của một ô (tính trực tiếp, không cần lưu). */
export function terrainAt(seed: string, c: number, r: number): Terrain {
  const s = hashStr(`terrain:${seed}`) % 100000;
  const d = hexDist({ c, r }, CENTER);
  if (d <= 5 && d > 0) return 'storm';
  const reef = smooth(c, r, s + 11, 3.2);
  if (reef > 0.86 && d > 7) return 'reef';
  const deep = smooth(c, r, s + 3, 9);
  if (deep > 0.68) return 'deep';
  if (smooth(c, r, s + 7, 5) > 0.78) return 'shoal';
  return 'sea';
}

/** Sinh cả thế giới của một Hải Khu (có bộ nhớ đệm). */
export function worldOf(seed: string, botIds: string[] = []): World {
  const key = `${seed}|${botIds.join(',')}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const r: Rng = mulberry32(hashStr(`world:${seed}`));
  const at: World['at'] = new Map();
  const isles: Isle[] = [];
  const lairs: WildDef[] = [];
  const used = new Set<string>();
  const near = (c: number, rr: number, k: number) => hexRange({ c, r: rr }, k).some((h) => used.has(hexKey(h.c, h.r)));
  // lưới ô to 5x5, mỗi ô to có thể có một đảo và một hang quái ở chỗ ngẫu nhiên
  const CELL = 5;
  let n = 0;
  for (let gy = 0; gy < Math.ceil(WORLD_H / CELL); gy++)
    for (let gx = 0; gx < Math.ceil(WORLD_W / CELL); gx++) {
      for (const what of ['isle', 'lair'] as const) {
        const chance = what === 'isle' ? 0.62 : 0.55;
        if (r() > chance) continue;
        const c = gx * CELL + 1 + Math.floor(r() * (CELL - 2));
        const rr = gy * CELL + 1 + Math.floor(r() * (CELL - 2));
        if (!inWorld(c, rr) || near(c, rr, 1)) continue;
        const t = terrainAt(seed, c, rr);
        if (t === 'storm' || t === 'reef') continue;
        const d = hexDist({ c, r: rr }, CENTER);
        if (d <= 6) continue;
        const lv = zoneLevel(c, rr);
        used.add(hexKey(c, rr));
        n++;
        if (what === 'isle') {
          const bianP = 0.06 + lv * 0.03;
          const kinds: IsleKind[] = ['go', 'da', 'sat', 'ngoc', 'ruong'];
          const kind: IsleKind = r() < bianP ? 'bian' : kinds[Math.floor(r() * kinds.length)];
          const K = ISLE_KIND[kind];
          const glv = Math.min(30, lv * 2 + (kind === 'bian' ? 3 : 0));
          const guard: [MonsterKey, number][] = K.guard.map((m) => [m, glv]);
          if (lv >= 5) guard.push([K.guard[0], glv]);
          if (kind === 'bian') guard.push(['baytheo', glv + 2]);
          const name = kind === 'bian' ? BIAN[Math.floor(r() * BIAN.length)] : `${PRE[Math.floor(r() * PRE.length)]} ${MID[Math.floor(r() * MID.length)]}`;
          const mult = lv * (kind === 'bian' ? 2 : 1);
          const yields: Partial<Record<ResKey, number>> = {};
          for (const [k, v] of Object.entries(K.yields)) yields[k as ResKey] = Math.round((v ?? 0) * mult * 100) / 100;
          const isle: Isle = { id: `i${c}_${rr}`, c, r: rr, kind, lv, name, needLvl: Math.max(1, (lv - 1) * 3 + (kind === 'bian' ? 2 : 0)), guard, yields };
          isles.push(isle);
          at.set(hexKey(c, rr), { kind: 'isle', v: isle });
        } else {
          const kinds = Object.keys(LAIR_KIND) as LairKind[];
          const kind = kinds[Math.floor(r() * kinds.length)];
          const L = LAIR_KIND[kind];
          const elv = Math.min(30, lv * 2);
          const loot: Partial<Record<ResKey, number>> = {};
          for (const [k, v] of Object.entries(L.loot)) loot[k as ResKey] = Math.round((v ?? 0) * (1 + lv * 0.8));
          if (lv >= 6) loot.ngoc = 1;
          const w: WildDef = {
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
          lairs.push(w);
          at.set(hexKey(c, rr), { kind: 'lair', v: w });
        }
      }
    }
  void n;
  // ô khởi đầu: vành ngoài (cấp 1–2), biển thường, cách đảo/hang ít nhất 2 ô
  // vành ngoài (cấp 1–2) trước, đông người thì lấn vào vùng cấp 3–4
  const rs = mulberry32(hashStr(`spawns:${seed}`));
  const shuffle = (a: Hex[]) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rs() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const ring = (lo: number, hi: number) => {
    const out: Hex[] = [];
    for (let rr = 2; rr < WORLD_H - 2; rr++)
      for (let c = 2; c < WORLD_W - 2; c++) {
        const z = zoneLevel(c, rr);
        if (z < lo || z > hi || terrainAt(seed, c, rr) !== 'sea' || near(c, rr, 2)) continue;
        out.push({ c, r: rr });
      }
    return shuffle(out);
  };
  const spawns: Hex[] = [...ring(1, 2), ...ring(3, 4)];
  const bots = new Map<string, Hex>();
  const taken: Hex[] = [];
  for (const id of botIds) {
    const h = pickSpawn(spawns, taken, 9) ?? spawns[taken.length % spawns.length];
    taken.push(h);
    bots.set(id, h);
  }
  const w: World = { seed, isles, lairs, spawns, bots, boss: { ...CENTER }, at };
  cache.set(key, w);
  return w;
}

/** Chọn ô khởi đầu cách mọi người đã có ít nhất `gap` ô (nới dần nếu chật). */
export function pickSpawn(spawns: Hex[], taken: Hex[], gap = 8, start = 0): Hex | null {
  for (let g = gap; g >= 3; g--)
    for (let i = 0; i < spawns.length; i++) {
      const h = spawns[(i + start) % spawns.length];
      if (taken.every((t) => hexDist(t, h) >= g)) return h;
    }
  return null;
}

export const isleById = (w: World, id: string) => {
  const o = w.at.get(`${id.slice(1).replace('_', ',')}`);
  return o?.kind === 'isle' ? o.v : undefined;
};
export const lairById = (w: World, id: string) => {
  const o = w.at.get(`${id.slice(1).replace('_', ',')}`);
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
