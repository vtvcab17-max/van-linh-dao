// Trạng thái người chơi và mọi hành động. Hàm thuần: client chạy để phản hồi tức thì, server chạy lại để xác nhận.
import {
  BUILD_FACTOR,
  BUILD_MS,
  CHESTS,
  CHEST_INTERVAL_MS,
  COMP_KEYS,
  EFFECTS,
  EVOLVE_COST,
  FEEDABLE,
  FEED_PORTION,
  GRID,
  HOME_CELL,
  HUNGER_PER_MIN,
  LAND_LV,
  LINH_VAT,
  LV_KEYS,
  MOOD_HAPPY_MS,
  MOOD_SULKY_MS,
  NODES,
  QUESTS,
  RAID_COOLDOWN_MS,
  RAID_SHARE,
  RES,
  RES_KEYS,
  TITLES,
  WILDS,
  XP_TO_NEXT,
  type CompKey,
  type LvKey,
  type NodeKind,
  type ResKey,
} from './data';
import { simulate, teamFromMonsters, teamFromSpec, type BattleResult, type TeamSpec } from './battle';
import { hashStr, mulberry32, pick, rint, weighted, type Rng } from './rng';
import { avatarFrom, cleanAvatar, type Avatar } from './avatar';
import { LV_LABEL, ASCEND_REWARD, BOSS_CELL, BOSS_REQ, BOSS_TRAVEL_MUL, bossOf, cleanGear, GEAR, GEAR_KEYS, gearBonus, gearPower, noGear, weekOf, type GearKey, type GearSet } from './boss';
import { teamFromBoss } from './battle';
import { islandCell } from './map';
import { cleanDef } from './economy';
import {
  B_KEYS, BUILDINGS, bLevel, bSum, dayOf, defSpecOf, fortLevel, FORT_NAMES, ITEMS, MAX_VASSALS, PORT_MULT, routePeriod, SHOP_BASE, shopSpecial, tollPerHour, tributePerHour, VASSAL_MS, VASSAL_TOLL_SHARE,
  type BKey, type DefSpec, type Dinh, type GoodKey, type ItemKey, type Lord, type Vassal,
} from './economy';

export type Mood = 'vui' | 'thuong' | 'doi';
export interface LvState {
  tier: number;
  xp: number;
  hunger: number;
  mood: Mood;
  moodUntil: number;
  known: ResKey[];
}
export interface NodeState {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  readyAt: number;
}
export interface ChestState {
  id: string;
  ci: number;
  x: number;
  y: number;
}
export interface CompState {
  lv: number;
  xp: number;
  unlocked: boolean;
}
export interface PlayerState {
  v: 1;
  id: string;
  name: string;
  islandName: string;
  seed: number;
  rngN: number;
  seq: number;
  createdAt: number;
  lastReal: number;
  gt: number; // giờ trong game (ms), chạy nhanh hơn khi bật tốc độ test
  speed: number;
  res: Record<ResKey, number>;
  land: string;
  nodes: NodeState[];
  lv: Record<LvKey, LvState>;
  comps: Record<CompKey, CompState>;
  chests: ChestState[];
  nextChestAt: number;
  wilds: Record<string, { wins: number; readyAt: number }>;
  quests: string[];
  stats: { gathers: number; feeds: number; evolves: number; chests: number; battles: number; wins: number; raids: number; raidWins: number; defended: number; robbed: number };
  log: { t: number; text: string }[];
  applied: string[];
  raidCd: Record<string, number>;
  voyage: Voyage | null;
  /** Công trình đang xây (tiến hóa linh vật). */
  builds: Build[];
  lastBattle: { title: string; o: Outcome; seen: boolean } | null;
  outbox: RaidEvent[];
  /** Dáng vẻ nhân vật chủ đảo (nam/nữ, tóc, áo, nón...). */
  avatar: Avatar;
  /** Đã tự chỉnh nhân vật lần nào chưa (chưa → mời chỉnh khi vào game). */
  avatarSet: boolean;
  /** Kho trang bị đang cất ở nhà (tăng sức cho mọi trận). */
  kho: GearSet;
  /** Thành tích đánh Thủy Tinh trong tuần hiện tại (làm mới mỗi thứ Hai). */
  boss: { week: number; best: number; tries: number; won: boolean };
  /** Số lần phi thăng. */
  asc: number;
  /** Dành sẵn cho Thượng Giới (bản sau). Để trống. */
  thuongGioi: Record<string, unknown>;
  /** Nhà cửa, thành trì đặt trên đảo. */
  dinh: Dinh[];
  /** Túi vật phẩm. */
  bag: Partial<Record<ItemKey, number>>;
  /** Đảo đã thôn tính (chư hầu). */
  chuHau: Vassal[];
  /** Đảo mình đang bị ai thôn tính. */
  chuQuan: Lord | null;
  /** Thuế: phần lẻ đang tích, tổng thu hôm nay. */
  thue: { acc: number; day: number; today: number; rate: number };
  /** Cửa hàng: đã mua trong ngày. */
  shop: { day: number; bought: Record<string, number> };
  /** Đội thợ thêm (Lệnh Bài Thủy Sư). */
  slotsBonus: number;
  /** Thương hội (server ghi). */
  guild: { id: string; name: string; tag: string; lv: number } | null;
}

export interface Build {
  lv: LvKey;
  to: number;
  start: number;
  end: number;
}

/** Một chuyến thuyền: đi (mất thời gian) → đánh khi cập đảo → về bến (mất thời gian) mới nhận chiến lợi phẩm. */
export interface Voyage {
  id: string;
  kind: 'wild' | 'island' | 'boss';
  /** xuất phát từ đâu (đảo nhà hoặc cứ điểm chư hầu) */
  from?: { x: number; y: number };
  /** đánh chiếm thành chư hầu */
  conquer?: boolean;
  /** trang bị chở theo (chỉ khi đánh Thủy Tinh) */
  carry?: GearSet;
  targetId: string;
  targetName: string;
  target?: IslandPub;
  to: { x: number; y: number };
  departAt: number;
  arriveAt: number;
  returnAt: number;
  phase: 'di' | 've';
  loot: Partial<Record<ResKey, number>>;
  win?: boolean;
}

export const LV_POS: Record<LvKey, { x: number; y: number }> = {
  leu: { x: 11, y: 11 },
  cuoc: { x: 12, y: 12 },
  rao: { x: 10, y: 13 },
  thuyen: { x: 14, y: 12 }, // bến mặc định; vị trí thật tính bằng dockPos()
};

export const idx = (x: number, y: number) => y * GRID + x;
export const isLand = (s: PlayerState, x: number, y: number) =>
  x >= 0 && y >= 0 && x < GRID && y < GRID && s.land[idx(x, y)] === '1';
export const landCount = (s: PlayerState) => {
  let n = 0;
  for (let i = 0; i < s.land.length; i++) if (s.land[i] === '1') n++;
  return n;
};

/** Bến thuyền: ô nước sát đảo, gần mép đông nam nhất. */
export function dockPos(s: PlayerState): { x: number; y: number } {
  let best = { x: 14, y: 12 };
  let bd = Infinity;
  for (let y = 1; y < GRID - 1; y++)
    for (let x = 1; x < GRID - 1; x++) {
      if (isLand(s, x, y)) continue;
      if (!(isLand(s, x - 1, y) || isLand(s, x, y - 1) || isLand(s, x + 1, y) || isLand(s, x, y + 1))) continue;
      const d = Math.hypot(x - 16, y - 13);
      if (d < bd) {
        bd = d;
        best = { x, y };
      }
    }
  return best;
}

function setLand(s: PlayerState, x: number, y: number) {
  const i = idx(x, y);
  s.land = s.land.slice(0, i) + '1' + s.land.slice(i + 1);
}

export function rngOf(s: PlayerState): Rng {
  s.rngN++;
  return mulberry32(hashStr(`${s.seed}:${s.rngN}`));
}

function nid(s: PlayerState, p: string) {
  s.seq++;
  return `${p}${s.seq}`;
}

export function newPlayer(id: string, name: string, now: number, seedStr?: string): PlayerState {
  const seed = hashStr(seedStr ?? id);
  let land = '0'.repeat(GRID * GRID);
  const s: PlayerState = {
    v: 1,
    id,
    name,
    islandName: `Đảo của ${name}`,
    seed,
    rngN: 0,
    seq: 0,
    createdAt: now,
    lastReal: now,
    gt: 0,
    speed: 1,
    res: { co: 10, la: 0, tre: 6, go: 0, cui: 0, da: 6, sat: 0, so: 20, ngoc: 0, tien: 50 },
    land,
    nodes: [],
    lv: {
      leu: { tier: 1, xp: 0, hunger: 55, mood: 'thuong', moodUntil: 0, known: [] },
      cuoc: { tier: 1, xp: 0, hunger: 70, mood: 'thuong', moodUntil: 0, known: [] },
      rao: { tier: 1, xp: 0, hunger: 40, mood: 'thuong', moodUntil: 0, known: [] },
      thuyen: { tier: 1, xp: 0, hunger: 50, mood: 'thuong', moodUntil: 0, known: [] },
    },
    comps: {
      an: { lv: 1, xp: 0, unlocked: true },
      ngoc: { lv: 1, xp: 0, unlocked: true },
      ha: { lv: 1, xp: 0, unlocked: false },
      chau: { lv: 1, xp: 0, unlocked: false },
    },
    chests: [],
    nextChestAt: 20_000,
    wilds: {},
    quests: [],
    stats: { gathers: 0, feeds: 0, evolves: 0, chests: 0, battles: 0, wins: 0, raids: 0, raidWins: 0, defended: 0, robbed: 0 },
    log: [],
    applied: [],
    raidCd: {},
    voyage: null,
    builds: [],
    lastBattle: null,
    outbox: [],
    avatar: avatarFrom(id),
    avatarSet: false,
    kho: noGear(),
    boss: { week: weekOf(now), best: 0, tries: 0, won: false },
    asc: 0,
    thuongGioi: {},
    dinh: [],
    bag: {},
    chuHau: [],
    chuQuan: null,
    thue: { acc: 0, day: dayOf(now), today: 0, rate: 0 },
    shop: { day: dayOf(now), bought: {} },
    slotsBonus: 0,
    guild: null,
  };
  // mỗi đảo một hình dạng riêng, sinh từ mã đảo
  const shape = startShape(seed);
  for (const [x, y] of shape.land) setLand(s, x, y);
  const kinds: NodeKind[] = ['palm', 'bamboo', 'drift', 'rock', 'scrap', 'grass', 'grass'];
  kinds.forEach((kind, i) => s.nodes.push({ id: nid(s, 'n'), kind, x: shape.spots[i][0], y: shape.spots[i][1], readyAt: 0 }));
  // hòm đầu tiên dạt vào bờ ngay
  s.chests.push({ id: nid(s, 'c'), ci: 0, x: shape.spots[7][0], y: shape.spots[7][1] });
  return s;
}

/** Các ô luôn là đất lúc mới tới: chỗ của Nhà chính, Cuốc, Lũy tre và lối đi giữa chúng. */
const CORE: [number, number][] = [
  [11, 11], [12, 12], [10, 13], [11, 12], [11, 13], [10, 12], [12, 11], [11, 10],
];
const RESERVED = new Set(['11,11', '11,10', '12,12', '10,13']);

/**
 * Hình dạng đảo lúc khởi đầu: 16 ô đất mọc ngẫu nhiên quanh lõi theo mã đảo
 * (có đảo dài, đảo cong, đảo có mỏm...), cộng 8 chỗ đặt tài nguyên và hòm.
 */
export function startShape(seed: number): { land: [number, number][]; spots: [number, number][] } {
  const r = mulberry32(hashStr(`shape:${seed}`));
  const has = new Set(CORE.map(([x, y]) => `${x},${y}`));
  const land = [...CORE];
  // hướng kéo dài riêng của từng đảo
  const ang = r() * Math.PI * 2;
  const stretch = 0.35 + r() * 0.9;
  const lumpy = r();
  while (land.length < 16) {
    const front: { x: number; y: number; w: number }[] = [];
    for (const [x, y] of land)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 7 || ny < 7 || nx > 16 || ny > 16 || has.has(`${nx},${ny}`)) continue;
        const ox = nx - 11.5, oy = ny - 11.8;
        const along = ox * Math.cos(ang) + oy * Math.sin(ang);
        const across = -ox * Math.sin(ang) + oy * Math.cos(ang);
        const d = Math.hypot(along / (1 + stretch), across);
        let nb = 0;
        for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (has.has(`${nx + ex},${ny + ey}`)) nb++;
        front.push({ x: nx, y: ny, w: Math.exp(-d * 0.9) * (1 + nb * (1.4 - lumpy)) });
      }
    let t = r() * front.reduce((a, f) => a + f.w, 0);
    let pickF = front[front.length - 1];
    for (const f of front) if ((t -= f.w) <= 0) { pickF = f; break; }
    has.add(`${pickF.x},${pickF.y}`);
    land.push([pickF.x, pickF.y]);
  }
  // chỗ đặt tài nguyên: ô trống, xáo theo mã đảo; hòm ưu tiên ô sát biển
  const free = land.filter(([x, y]) => !RESERVED.has(`${x},${y}`));
  for (let i = free.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [free[i], free[j]] = [free[j], free[i]];
  }
  const edge = (p: [number, number]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !has.has(`${p[0] + dx},${p[1] + dy}`));
  const chestAt = free.findIndex(edge);
  const chest = free.splice(chestAt >= 0 ? chestAt : 0, 1)[0];
  return { land, spots: [...free.slice(0, 7), chest] };
}

// ---------- tính toán phụ ----------
export const tierIdx = (s: PlayerState, k: LvKey) => Math.max(0, Math.min(4, s.lv[k].tier - 1));
export const storageCap = (s: PlayerState) => Math.round(EFFECTS.storageCap[tierIdx(s, 'leu')] * (1 + 0.3 * bSum(s.dinh, 'khothoc')));
export const landCap = (s: PlayerState) => EFFECTS.landCap[tierIdx(s, 'leu')];
export const protectAmt = (s: PlayerState) => EFFECTS.protect[tierIdx(s, 'leu')];
export const chestSlots = (s: PlayerState) => EFFECTS.chestSlots[tierIdx(s, 'leu')];

export function moodMult(l: LvState): number {
  let m = l.mood === 'vui' ? 1.2 : l.mood === 'doi' ? 0.7 : 1;
  if (l.hunger > 70) m *= 0.8;
  return m;
}

export function gatherMult(s: PlayerState) {
  return EFFECTS.gatherMult[tierIdx(s, 'cuoc')] * moodMult(s.lv.cuoc);
}

/**
 * Chi phí khai hoang ô đất tiếp theo: càng mở nhiều ô càng đắt (tăng theo bình phương),
 * và cần thêm loại tài nguyên mới: gỗ từ ô thứ 23, sắt vụn từ ô thứ 37. Cuốc tiến hóa giảm giá.
 */
export function expandCost(s: PlayerState): Partial<Record<ResKey, number>> {
  const k = Math.max(0, landCount(s) - 16); // số ô đã khai hoang
  const disc = 1 - EFFECTS.expandDiscount[tierIdx(s, 'cuoc')];
  const v = (x: number) => Math.ceil(x * disc);
  const cost: Partial<Record<ResKey, number>> = { da: v(6 + 2.5 * k + 0.12 * k * k), tre: v(6 + 2.5 * k + 0.12 * k * k) };
  if (k >= 6) cost.go = v(4 + 1.8 * (k - 6) + 0.1 * (k - 6) ** 2);
  if (k >= 20) cost.sat = v(3 + (k - 20) + 0.05 * (k - 20) ** 2);
  return cost;
}

export function canPay(s: PlayerState, cost: Partial<Record<ResKey, number>>) {
  return Object.entries(cost).every(([k, v]) => s.res[k as ResKey] >= (v ?? 0));
}
function pay(s: PlayerState, cost: Partial<Record<ResKey, number>>) {
  for (const [k, v] of Object.entries(cost)) s.res[k as ResKey] -= v ?? 0;
}
export function addRes(s: PlayerState, gain: Partial<Record<ResKey, number>>): Partial<Record<ResKey, number>> {
  const cap = storageCap(s);
  const got: Partial<Record<ResKey, number>> = {};
  for (const [k, v] of Object.entries(gain)) {
    const key = k as ResKey;
    const before = s.res[key];
    const after = RES[key].capped ? Math.min(cap, before + (v ?? 0)) : before + (v ?? 0);
    s.res[key] = after;
    if (after - before > 0) got[key] = after - before;
  }
  return got;
}

/** Công thức sức mạnh dùng chung — server tự tính lại bằng đúng hàm này. */
export function powerFrom(tiers: Partial<Record<LvKey, number>>, team: { lv: number }[], land: number, gear?: Partial<GearSet>, asc = 0): number {
  return Math.round(land + (tiers.leu ?? 1) * 30 + (tiers.cuoc ?? 1) * 25 + (tiers.rao ?? 1) * 25 + (tiers.thuyen ?? 1) * 15 + team.reduce((t, c) => t + c.lv * 12, 0) + gearPower(gear) + asc * 150);
}
export function power(s: PlayerState): number {
  const team = COMP_KEYS.filter((k) => s.comps[k].unlocked).map((k) => s.comps[k]);
  return powerFrom({ leu: s.lv.leu.tier, cuoc: s.lv.cuoc.tier, rao: s.lv.rao.tier, thuyen: s.lv.thuyen.tier }, team, landCount(s), s.kho, s.asc);
}
/** Danh hiệu: đã phi thăng thì là Tiên Nhân. */
export function titleFor(s: PlayerState): string {
  return s.asc > 0 ? (s.asc > 1 ? `Tiên Nhân ×${s.asc}` : 'Tiên Nhân') : titleOf(power(s));
}
export function titleOf(p: number): string {
  let t = TITLES[0][1];
  for (const [min, name] of TITLES) if (p >= min) t = name;
  return t;
}

export function xpForLevel(lv: number) {
  return Math.round(20 * Math.pow(lv, 1.5));
}

export function teamSpec(s: PlayerState, defending: boolean): TeamSpec {
  return {
    comps: COMP_KEYS.filter((k) => s.comps[k].unlocked).map((k) => ({ k, lv: s.comps[k].lv })),
    cuocTier: s.lv.cuoc.tier,
    raoTier: defending ? s.lv.rao.tier : undefined,
    hero: s.name,
    gear: (() => {
      const g = gearBonus(s.kho);
      g.atk += 0.05 * Math.min(3, s.bag.vayrong ?? 0);
      return g;
    })(),
    fort: defending ? defSpecOf(s.dinh) : undefined,
  };
}

function log(s: PlayerState, text: string) {
  s.log.unshift({ t: Date.now(), text });
  if (s.log.length > 40) s.log.length = 40;
}

function doneQuest(s: PlayerState, id: string): string | null {
  if (s.quests.includes(id)) return null;
  const q = QUESTS.find((x) => x.id === id);
  if (!q) return null;
  s.quests.push(id);
  addRes(s, q.reward);
  return q.text;
}

export function currentQuest(s: PlayerState) {
  return QUESTS.find((q) => !s.quests.includes(q.id)) ?? null;
}

export function shoreTiles(s: PlayerState): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      if (!isLand(s, x, y)) continue;
      if (!isLand(s, x + 1, y) || !isLand(s, x - 1, y) || !isLand(s, x, y + 1) || !isLand(s, x, y - 1)) out.push({ x, y });
    }
  return out;
}

export function occupied(s: PlayerState, x: number, y: number): boolean {
  if (LAND_LV.some((k) => LV_POS[k].x === x && LV_POS[k].y === y)) return true;
  if (s.nodes.some((n) => n.x === x && n.y === y)) return true;
  if (s.chests.some((c) => c.x === x && c.y === y)) return true;
  if (s.dinh.some((d) => d.x === x && d.y === y)) return true;
  return false;
}

/** Thu nhập mỗi giờ: nhà dân, thuế thương thuyền, cống nạp của chư hầu; trừ phần phải nộp cho chủ. */
export function incomePerHour(s: PlayerState, now = s.lastReal) {
  const period = routePeriod(now);
  const bonus = (s.bag.trongdong ? 0.25 : 0) + (s.guild ? 0.05 * s.guild.lv : 0);
  const dan = bSum(s.dinh, 'nhadan') * 4;
  const toll = tollPerHour(homeCell(s), period, bLevel(s.dinh, 'tramthue'), bonus);
  let cong = 0;
  for (const v of s.chuHau) if (v.until > now) cong += tributePerHour(v.power) + tollPerHour(v.cell, period, v.port) * VASSAL_TOLL_SHARE;
  const nop = s.chuQuan && s.chuQuan.until > now ? tributePerHour(power(s)) : 0;
  return { dan, toll, cong, nop, total: dan + toll + cong - nop };
}

// ---------- vòng thời gian ----------
export function tick(s: PlayerState, now: number): string[] {
  const notes: string[] = [];
  const dtReal = Math.max(0, Math.min(now - s.lastReal, 7 * 24 * 3600_000));
  s.lastReal = now;
  // thứ Hai: Thủy Tinh hồi sinh, thành tích tuần làm mới (số lần phi thăng giữ nguyên)
  const wk = weekOf(now);
  if (s.boss.week !== wk) s.boss = { week: wk, best: 0, tries: 0, won: false };
  // chư hầu hết hạn: tự do
  s.chuHau = s.chuHau.filter((v) => v.until > now);
  if (s.chuQuan && s.chuQuan.until <= now) {
    notes.push(`Hết thời hạn cống nạp, ${s.islandName} được tự do.`);
    s.chuQuan = null;
  }
  // tiền thuế, cống nạp (tính theo giờ trong game)
  const inc = incomePerHour(s, now);
  s.thue.rate = inc.total;
  const day = dayOf(now);
  if (s.thue.day !== day) s.thue = { acc: 0, day, today: 0, rate: inc.total };
  s.thue.acc += (inc.total * dtReal * s.speed) / 3600_000;
  if (s.thue.acc >= 1 || s.thue.acc <= -1) {
    const whole = Math.trunc(s.thue.acc);
    s.thue.acc -= whole;
    s.res.tien = Math.max(0, s.res.tien + whole);
    if (whole > 0) s.thue.today += whole;
  }
  // nhà cửa, thành trì xây xong
  for (const d of s.dinh)
    if (d.doneAt !== undefined && s.gt + dtReal * s.speed >= d.doneAt) {
      d.lv = d.to ?? d.lv + 1;
      d.to = undefined;
      d.doneAt = undefined;
      notes.push(`Xây xong ${BUILDINGS[d.k].names[d.lv - 1]}.`);
    }
  const dt = dtReal * s.speed;
  s.gt += dt;
  const min = dt / 60_000;
  for (const k of LV_KEYS) {
    const l = s.lv[k];
    l.hunger = Math.min(100, l.hunger + HUNGER_PER_MIN * min * (1 - 0.15 * bLevel(s.dinh, 'den')));
    if (l.mood !== 'thuong' && s.gt >= l.moodUntil) l.mood = 'thuong';
  }
  let guard = 0;
  while (s.gt >= s.nextChestAt && guard++ < 10) {
    if (s.chests.length < chestSlots(s)) {
      const free = shoreTiles(s).filter((p) => !occupied(s, p.x, p.y));
      if (free.length) {
        const r = rngOf(s);
        const p = pick(r, free);
        const ci = CHESTS.indexOf(weighted(r, CHESTS));
        s.chests.push({ id: nid(s, 'c'), ci, x: p.x, y: p.y });
        notes.push(`${CHESTS[ci].name} vừa dạt vào bờ.`);
      }
      s.nextChestAt += CHEST_INTERVAL_MS;
    } else {
      s.nextChestAt = s.gt + CHEST_INTERVAL_MS;
    }
  }
  notes.push(...buildTick(s));
  notes.push(...voyageTick(s));
  return notes;
}

export const buildSlots = (s: PlayerState) => (s.lv.leu.tier >= 3 ? 2 : 1) + Math.min(2, s.slotsBonus);
/** Số đội thợ đang bận (tiến hóa linh vật + xây nhà cửa, thành trì). */
export const busySlots = (s: PlayerState) => s.builds.length + s.dinh.filter((d) => d.doneAt !== undefined).length;

/** Ô của đảo mình trên hải đồ chung. */
export const homeCell = (s: PlayerState) => islandCell(s.id);
/** Nơi thuyền có thể xuất phát: đảo nhà và các chư hầu còn hạn (cứ điểm). */
export function bases(s: PlayerState): { x: number; y: number; name: string }[] {
  return [{ ...homeCell(s), name: s.islandName }, ...s.chuHau.filter((v) => v.until > s.lastReal).map((v) => ({ ...v.cell, name: v.islandName }))];
}
/** Cứ điểm gần đích nhất. */
export function nearestBase(s: PlayerState, to: { x: number; y: number }) {
  return bases(s).reduce((b, c) => (Math.hypot(c.x - to.x, c.y - to.y) < Math.hypot(b.x - to.x, b.y - to.y) ? c : b));
}
export function buildMs(lv: LvKey, fromTier: number): number {
  return Math.round(BUILD_MS[fromTier - 1] * BUILD_FACTOR[lv]);
}
export const buildOf = (s: PlayerState, lv: LvKey) => s.builds.find((b) => b.lv === lv);

function buildTick(s: PlayerState): string[] {
  const notes: string[] = [];
  const done = s.builds.filter((b) => s.gt >= b.end);
  if (!done.length) return notes;
  s.builds = s.builds.filter((b) => s.gt < b.end);
  for (const b of done) {
    const l = s.lv[b.lv];
    const from = LINH_VAT[b.lv].tiers[l.tier - 1];
    l.tier = b.to;
    l.hunger = Math.max(0, l.hunger - 40);
    s.stats.evolves++;
    const txt = `Xây xong: ${from} đã thành ${LINH_VAT[b.lv].tiers[l.tier - 1]}!`;
    notes.push(txt);
    log(s, txt);
    if (b.lv === 'leu' && l.tier >= 2 && !s.comps.ha.unlocked) {
      s.comps.ha.unlocked = true;
      notes.push('Đặng Thu Hà gia nhập đội!');
    }
    if (b.lv === 'cuoc' && l.tier >= 2 && !s.comps.chau.unlocked) {
      s.comps.chau.unlocked = true;
      notes.push('Hồ Minh Châu gia nhập đội!');
    }
    const q = doneQuest(s, 'q_evolve');
    if (q) notes.push(`Xong việc: ${q}`);
  }
  return notes;
}

export function sailMs(s: PlayerState, to: { x: number; y: number }, mul = 1): number {
  const from = nearestBase(s, to);
  const dist = Math.max(1, Math.hypot(to.x - from.x, to.y - from.y));
  return Math.round((dist * EFFECTS.sailSecPerCell[tierIdx(s, 'thuyen')] * 1000 * mul) / moodMult(s.lv.thuyen));
}

/** Điều kiện ra khơi đánh Thủy Tinh; trả về lý do nếu chưa được. */
export function bossCheck(s: PlayerState): string | null {
  if (s.lv.leu.tier < BOSS_REQ.leu) return `Cần Nhà chính bậc ${BOSS_REQ.leu} trở lên.`;
  if (s.lv.thuyen.tier < BOSS_REQ.thuyen) return `Cần thuyền bậc ${BOSS_REQ.thuyen} trở lên mới vượt được vùng bão.`;
  if (s.builds.some((b) => b.lv === 'thuyen')) return 'Thuyền đang được nâng cấp, chưa ra khơi được.';
  if (s.boss.won) return 'Bạn đã phi thăng tuần này. Thủy Tinh sẽ hồi sinh vào thứ Hai.';
  if (s.voyage) return 'Thuyền đang ở ngoài biển.';
  return null;
}

/** Đại chiến Thủy Tinh: đội + trang bị chở theo, đấu tối đa 30 lượt. */
export function fightBoss(s: PlayerState, carry: GearSet): Outcome {
  const week = weekOf(s.lastReal);
  const form = bossOf(week);
  const gb = gearBonus(carry);
  gb.atk += 0.05 * bLevel(s.dinh, 'den') + 0.05 * Math.min(3, s.bag.vayrong ?? 0);
  const spec = { ...teamSpec(s, false), gear: gb };
  const r = rngOf(s);
  const real = simulate(teamFromSpec(spec, 0), teamFromBoss(form, 1), r, 40);
  s.stats.battles++;
  s.boss.tries++;
  const dmg = Math.max(0, form.hp - (real.hpB?.[0] ?? form.hp));
  s.boss.best = Math.max(s.boss.best, dmg);
  const win = real.winner === 0;
  const ups = rewardComps(s, spec, win ? 60 : 15);
  if (win) {
    s.stats.wins++;
    s.boss.won = true;
    s.asc++;
    const relic: ItemKey = s.bag.trongdong ? 'vayrong' : 'trongdong';
    s.bag[relic] = (s.bag[relic] ?? 0) + 1;
    log(s, `PHI THĂNG! Đánh bại ${form.name} · ${form.title}.`);
    return { ok: true, msg: `Đánh bại ${form.name} · ${form.title}! Bạn đã phi thăng.`, battle: real, gained: { ...ASCEND_REWARD }, levelUps: ups, boss: { dmg, win, form: form.key } };
  }
  log(s, `Thua ${form.name}: mất trang bị mang theo, thuyền bị đánh chìm.`);
  return { ok: true, msg: `Thua ${form.name} · ${form.title}. Gây ${dmg} sát thương.`, battle: real, gained: {}, levelUps: ups, boss: { dmg, win, form: form.key } };
}

/** Thuyền bị Thủy Tinh đánh chìm: về Thuyền Thúng, mất hết công sức xây. */
function sinkBoat(s: PlayerState) {
  s.lv.thuyen.tier = 1;
  s.lv.thuyen.xp = 0;
  s.builds = s.builds.filter((b) => b.lv !== 'thuyen');
}

function fmtLoot(g: Partial<Record<ResKey, number>>) {
  return Object.entries(g)
    .map(([k, v]) => `${v} ${RES[k as ResKey].name}`)
    .join(', ');
}

function voyageTick(s: PlayerState): string[] {
  const notes: string[] = [];
  const v = s.voyage;
  if (!v) return notes;
  if (v.phase === 'di' && s.gt >= v.arriveAt) {
    let o: Outcome;
    if (v.kind === 'boss') {
      const carry = cleanGear(v.carry);
      o = fightBoss(s, carry);
      s.lastBattle = { title: 'Đại chiến Thủy Tinh', o, seen: false };
      if (o.boss?.win) {
        // thắng: chở trang bị và phần thưởng về nhà
        v.loot = o.gained ?? {};
        v.win = true;
        v.phase = 've';
        notes.push('THỦY TINH ĐÃ BỊ ĐÁNH BẠI! Bạn đã phi thăng. Bấm "Xem trận".');
      } else {
        // thua: mất sạch trang bị mang theo, thuyền bị đánh chìm, người bơi về đảo
        sinkBoat(s);
        s.voyage = null;
        notes.push(`Thua Thủy Tinh (gây ${o.boss?.dmg ?? 0} sát thương). Mất trang bị mang theo, thuyền bị đánh chìm.`);
        return notes;
      }
    } else if (v.kind === 'wild') {
      const w = WILDS.find((x) => x.id === v.targetId)!;
      o = fightWild(s, w, true);
    } else {
      o = raid(s, v.target!, true, !!v.conquer);
      if (o.event) s.outbox.push(o.event);
    }
    if (v.kind !== 'boss') {
      v.loot = o.gained ?? {};
      v.win = o.battle?.winner === 0;
      v.phase = 've';
      s.lastBattle = { title: v.kind === 'wild' ? `Trận ${v.targetName}` : `Đột kích ${v.targetName}`, o, seen: false };
      notes.push(`Thuyền đã cập ${v.targetName}: ${v.win ? 'thắng trận' : 'thua trận'}. Bấm "Xem trận".`);
      if (o.quest) notes.push(`Xong việc: ${o.quest}`);
    }
  }
  if (v.phase === 've' && s.gt >= v.returnAt) {
    if (v.carry) for (const k of GEAR_KEYS) s.kho[k] = Math.min(GEAR[k].max, s.kho[k] + (v.carry[k] ?? 0));
    const got = addRes(s, v.loot);
    const txt = Object.keys(got).length ? `Thuyền về bến, chở về ${fmtLoot(got)}.` : 'Thuyền về bến tay không.';
    notes.push(txt);
    log(s, txt);
    s.voyage = null;
  }
  return notes;
}

// ---------- hành động ----------
export type Action =
  | { t: 'gather'; node: string }
  | { t: 'listen'; lv: LvKey }
  | { t: 'feed'; lv: LvKey; res: ResKey }
  | { t: 'evolve'; lv: LvKey }
  | { t: 'expand'; x: number; y: number }
  | { t: 'chest'; id: string }
  | { t: 'sail'; kind: 'wild'; id: string }
  | { t: 'sail'; kind: 'island'; target: IslandPub; to: { x: number; y: number }; conquer?: boolean }
  | { t: 'xay'; k: BKey; x: number; y: number }
  | { t: 'nang'; id: string }
  | { t: 'pha'; id: string }
  | { t: 'mua'; offer: string }
  | { t: 'dung'; item: ItemKey }
  | { t: 'sail'; kind: 'boss'; carry: Partial<GearSet> }
  | { t: 'craft'; g: GearKey }
  | { t: 'rename'; name: string; island: string }
  | { t: 'avatar'; av: Avatar }
  | { t: 'speed'; speed: number };

export interface Outcome {
  ok: boolean;
  msg: string;
  line?: string; // tiếng lòng của linh vật
  gained?: Partial<Record<ResKey, number>>;
  quest?: string;
  battle?: BattleResult;
  evolved?: { lv: LvKey; tier: number };
  unlocked?: CompKey;
  chest?: number;
  levelUps?: CompKey[];
  event?: RaidEvent;
  boss?: { dmg: number; win: boolean; form: string };
  item?: ItemKey;
}

const fail = (msg: string): Outcome => ({ ok: false, msg });

export function voiceLine(s: PlayerState, k: LvKey, r: Rng): string {
  const l = s.lv[k];
  const v = LINH_VAT[k].voice;
  if (l.mood === 'doi') return pick(r, v.sulky);
  if (l.hunger > 60) return pick(r, v.hungry);
  if (l.mood === 'vui' && r() < 0.5) return pick(r, v.happy);
  return pick(r, v.idle);
}

export function rewardComps(s: PlayerState, spec: TeamSpec, xp: number): CompKey[] {
  const ups: CompKey[] = [];
  for (const c of spec.comps) {
    const st = s.comps[c.k];
    st.xp += xp;
    while (st.xp >= xpForLevel(st.lv) && st.lv < 30) {
      st.xp -= xpForLevel(st.lv);
      st.lv++;
      ups.push(c.k);
    }
  }
  return ups;
}

export function rollChest(s: PlayerState, ci: number, r: Rng): Partial<Record<ResKey, number>> {
  const c = CHESTS[ci];
  const gain: Partial<Record<ResKey, number>> = {};
  for (let i = 0; i < c.rolls; i++) {
    const k = pick(r, FEEDABLE);
    gain[k] = (gain[k] ?? 0) + rint(r, c.amount[0], c.amount[1]);
  }
  gain.so = rint(r, c.so[0], c.so[1]);
  if (c.ngoc) gain.ngoc = c.ngoc;
  return gain;
}

export function apply(s: PlayerState, a: Action): Outcome {
  switch (a.t) {
    case 'gather': {
      const n = s.nodes.find((x) => x.id === a.node);
      if (!n) return fail('Không thấy chỗ này.');
      if (s.gt < n.readyAt) return fail(`${NODES[n.kind].name} chưa mọc lại.`);
      const mult = gatherMult(s);
      const gain: Partial<Record<ResKey, number>> = {};
      for (const [k, v] of Object.entries(NODES[n.kind].yields)) gain[k as ResKey] = Math.max(1, Math.round((v ?? 0) * mult));
      const got = addRes(s, gain);
      n.readyAt = s.gt + NODES[n.kind].regrowMs;
      s.stats.gathers++;
      const q = n.kind === 'grass' ? doneQuest(s, 'q_gather') : null;
      if (!Object.keys(got).length) return { ok: true, msg: 'Kho đầy rồi. Nâng Nhà chính để chứa thêm.', gained: {} };
      return { ok: true, msg: '', gained: got, quest: q ?? undefined };
    }
    case 'listen': {
      const r = rngOf(s);
      const line = voiceLine(s, a.lv, r);
      const q = a.lv === 'leu' ? doneQuest(s, 'q_listen') : null;
      return { ok: true, msg: '', line, quest: q ?? undefined };
    }
    case 'feed': {
      const l = s.lv[a.lv];
      const def = LINH_VAT[a.lv];
      if (!FEEDABLE.includes(a.res)) return fail('Thứ này không cho ăn được.');
      const like = def.likes[a.res];
      const r = rngOf(s);
      if (!like) {
        if (s.res[a.res] < 1) return fail(`Hết ${RES[a.res].name}.`);
        s.res[a.res] -= 1;
        l.mood = 'doi';
        l.moodUntil = s.gt + MOOD_SULKY_MS;
        return { ok: true, msg: `${def.tiers[l.tier - 1]} không thích ${RES[a.res].name}.`, line: pick(r, def.voice.sulky) };
      }
      if (s.res[a.res] < FEED_PORTION) return fail(`Cần ${FEED_PORTION} ${RES[a.res].name}.`);
      if (l.tier >= 5) return fail('Đã Thành Thần, không cần ăn thêm.');
      const need = XP_TO_NEXT[l.tier - 1];
      if (l.xp >= need) return fail('Linh khí đã đầy. Hãy tiến hóa.');
      s.res[a.res] -= FEED_PORTION;
      const hungerBonus = l.hunger > 60 ? 1.5 : 1;
      const moodF = l.mood === 'doi' ? 0.5 : 1;
      const gainXp = Math.max(1, Math.round(FEED_PORTION * like * hungerBonus * moodF));
      l.xp = Math.min(need, l.xp + gainXp);
      l.hunger = Math.max(0, l.hunger - 30);
      l.mood = 'vui';
      l.moodUntil = s.gt + MOOD_HAPPY_MS;
      if (!l.known.includes(a.res)) l.known.push(a.res);
      s.stats.feeds++;
      let q: string | null = null;
      if (a.lv === 'leu') q = doneQuest(s, 'q_feed');
      if (a.lv === 'cuoc' && a.res === 'sat') q = doneQuest(s, 'q_cuoc');
      if (a.lv === 'thuyen') q = doneQuest(s, 'q_boat');
      return { ok: true, msg: `+${gainXp} linh khí`, line: pick(r, def.voice.happy), quest: q ?? undefined };
    }
    case 'evolve': {
      const l = s.lv[a.lv];
      if (l.tier >= 5) return fail('Đã ở bậc cao nhất.');
      if (buildOf(s, a.lv)) return fail('Công trình này đang xây rồi.');
      if (busySlots(s) >= buildSlots(s)) return fail(buildSlots(s) > 1 ? 'Cả hai đội thợ đều đang bận.' : 'Thợ đang bận xây công trình khác. Nhà chính bậc 3 có thêm đội thợ thứ hai.');
      if (l.xp < XP_TO_NEXT[l.tier - 1]) return fail('Chưa đủ linh khí.');
      const cost = EVOLVE_COST[l.tier - 1];
      if (!canPay(s, cost)) return fail('Chưa đủ nguyên liệu để tiến hóa.');
      pay(s, cost);
      l.xp = 0;
      const ms = buildMs(a.lv, l.tier);
      s.builds.push({ lv: a.lv, to: l.tier + 1, start: s.gt, end: s.gt + ms });
      const name = LINH_VAT[a.lv].tiers[l.tier];
      log(s, `Bắt đầu xây ${name}.`);
      return { ok: true, msg: `Bắt đầu xây ${name}.`, line: pick(rngOf(s), LINH_VAT[a.lv].voice.happy) };
    }
    case 'expand': {
      const { x, y } = a;
      if (x < 1 || y < 1 || x >= GRID - 1 || y >= GRID - 1) return fail('Quá xa bờ.');
      if (isLand(s, x, y)) return fail('Ô này đã là đất.');
      if (!(isLand(s, x + 1, y) || isLand(s, x - 1, y) || isLand(s, x, y + 1) || isLand(s, x, y - 1))) return fail('Chỉ khai hoang được ô sát đảo.');
      if (landCount(s) >= landCap(s)) return fail('Đảo đã chạm giới hạn. Nâng Nhà chính để mở thêm đất.');
      const cost = expandCost(s);
      if (!canPay(s, cost)) return fail('Chưa đủ đá và tre để khai hoang.');
      pay(s, cost);
      setLand(s, x, y);
      const r = rngOf(s);
      if (r() < 0.42) {
        const kinds = (Object.keys(NODES) as NodeKind[]).map((k) => ({ k, weight: NODES[k].weight }));
        const k = weighted(r, kinds).k;
        s.nodes.push({ id: nid(s, 'n'), kind: k, x, y, readyAt: s.gt + 10_000 });
      }
      const q = doneQuest(s, 'q_expand');
      return { ok: true, msg: 'Cuốc bổ xuống, đất nổi lên khỏi mặt nước.', quest: q ?? undefined };
    }
    case 'chest': {
      const i = s.chests.findIndex((c) => c.id === a.id);
      if (i < 0) return fail('Hòm đã trôi mất.');
      const c = s.chests[i];
      s.chests.splice(i, 1);
      const r = rngOf(s);
      const got = addRes(s, rollChest(s, c.ci, r));
      s.stats.chests++;
      const q = doneQuest(s, 'q_chest');
      const drop = rareDrop(r, c.ci);
      if (drop) s.bag[drop] = (s.bag[drop] ?? 0) + 1;
      return { ok: true, msg: `Mở ${CHESTS[c.ci].name}${drop ? `. Có ${ITEMS[drop].name}!` : ''}`, gained: got, chest: c.ci, quest: q ?? undefined, item: drop ?? undefined };
    }
    case 'sail': {
      if (s.voyage) return fail(s.voyage.phase === 'di' ? 'Thuyền đang trên đường đi.' : 'Thuyền đang trên đường về bến.');
      let to: { x: number; y: number };
      let targetId: string;
      let targetName: string;
      let target: IslandPub | undefined;
      if (a.kind === 'boss') {
        const err = bossCheck(s);
        if (err) return fail(err);
        const want = cleanGear(a.carry);
        for (const k of GEAR_KEYS) if (want[k] > s.kho[k]) return fail(`Không đủ ${GEAR[k].name} trong kho.`);
        for (const k of GEAR_KEYS) s.kho[k] -= want[k];
        const form = bossOf(weekOf(s.lastReal));
        const one = sailMs(s, BOSS_CELL, BOSS_TRAVEL_MUL);
        const bf = nearestBase(s, BOSS_CELL);
        s.voyage = { from: { x: bf.x, y: bf.y }, id: nid(s, 'v'), kind: 'boss', targetId: 'thuytinh', targetName: `Mắt Bão · ${form.name}`, to: { ...BOSS_CELL }, departAt: s.gt, arriveAt: s.gt + one, returnAt: s.gt + one * 2, phase: 'di', loot: {}, carry: want };
        log(s, 'Thuyền vượt bão đi đánh Thủy Tinh.');
        return { ok: true, msg: `${LINH_VAT.thuyen.tiers[s.lv.thuyen.tier - 1]} vượt bão ra Mắt Bão. Sống chết có số!` };
      }
      if (a.kind === 'wild') {
        const w = WILDS.find((x) => x.id === a.id);
        if (!w) return fail('Không có đảo này.');
        const st = s.wilds[w.id];
        if (st && s.gt < st.readyAt) return fail('Quái chưa kéo về đảo này.');
        to = { x: w.sx, y: w.sy };
        targetId = w.id;
        targetName = w.name;
      } else {
        const err = raidCheck(s, a.target) ?? (a.conquer ? conquerCheck(s, a.target) : null);
        if (err) return fail(err);
        to = { x: Math.round(a.to.x), y: Math.round(a.to.y) };
        targetId = a.target.id;
        targetName = a.target.islandName;
        target = a.target;
      }
      const one = sailMs(s, to);
      const from = nearestBase(s, to);
      s.voyage = { id: nid(s, 'v'), kind: a.kind, targetId, targetName, target, to, from: { x: from.x, y: from.y }, departAt: s.gt, arriveAt: s.gt + one, returnAt: s.gt + one * 2, phase: 'di', loot: {}, conquer: a.kind === 'island' && !!a.conquer };
      log(s, `Thuyền rời bến đi ${targetName}.`);
      return { ok: true, msg: `${LINH_VAT.thuyen.tiers[s.lv.thuyen.tier - 1]} rời bến đi ${targetName}.` };
    }
    case 'rename': {
      const name = a.name.trim().slice(0, 18);
      const island = a.island.trim().slice(0, 24);
      if (name.length < 2) return fail('Tên cần ít nhất 2 ký tự.');
      s.name = name;
      s.islandName = island || `Đảo của ${name}`;
      return { ok: true, msg: 'Đã đổi tên.' };
    }
    case 'xay': {
      const b = BUILDINGS[a.k];
      if (!b) return fail('Không có công trình này.');
      if (s.lv.leu.tier < b.needLeu) return fail(`Cần Nhà chính bậc ${b.needLeu}.`);
      if (s.dinh.filter((d) => d.k === a.k).length >= b.max) return fail(`Đảo chỉ có chỗ cho ${b.max} ${b.names[0]}.`);
      if (!isLand(s, a.x, a.y) || occupied(s, a.x, a.y)) return fail('Ô này không xây được. Chọn ô đất trống.');
      if (busySlots(s) >= buildSlots(s)) return fail('Thợ đang bận hết. Chờ xây xong hoặc dùng Lệnh Bài Thủy Sư.');
      if (!canPay(s, b.cost[0])) return fail('Chưa đủ vật liệu.');
      pay(s, b.cost[0]);
      s.dinh.push({ id: nid(s, 'd'), k: a.k, x: a.x, y: a.y, lv: 0, to: 1, doneAt: s.gt + b.ms[0] });
      return { ok: true, msg: `Bắt đầu xây ${b.names[0]}.` };
    }
    case 'nang': {
      const d = s.dinh.find((x) => x.id === a.id);
      if (!d) return fail('Không thấy công trình.');
      const b = BUILDINGS[d.k];
      if (d.doneAt !== undefined) return fail('Đang xây dở.');
      if (d.lv >= 3) return fail('Đã cấp cao nhất.');
      if (d.lv + 1 >= 3 && s.lv.leu.tier < Math.min(5, b.needLeu + 2)) return fail(`Cần Nhà chính bậc ${Math.min(5, b.needLeu + 2)} để lên cấp 3.`);
      if (busySlots(s) >= buildSlots(s)) return fail('Thợ đang bận hết.');
      if (!canPay(s, b.cost[d.lv])) return fail('Chưa đủ vật liệu.');
      pay(s, b.cost[d.lv]);
      d.to = d.lv + 1;
      d.doneAt = s.gt + b.ms[d.lv];
      return { ok: true, msg: `Nâng cấp lên ${b.names[d.lv]}.` };
    }
    case 'pha': {
      const i = s.dinh.findIndex((x) => x.id === a.id);
      if (i < 0) return fail('Không thấy công trình.');
      const d = s.dinh[i];
      const back: Partial<Record<ResKey, number>> = {};
      for (const [k, v] of Object.entries(BUILDINGS[d.k].cost[Math.max(0, d.lv - 1)])) back[k as ResKey] = Math.floor((v ?? 0) * 0.3);
      s.dinh.splice(i, 1);
      addRes(s, back);
      return { ok: true, msg: `Đã dỡ ${BUILDINGS[d.k].names[Math.max(0, d.lv - 1)]}, thu hồi một phần vật liệu.` };
    }
    case 'mua': {
      const day = dayOf(s.lastReal);
      if (s.shop.day !== day) s.shop = { day, bought: {} };
      const o = [...SHOP_BASE, shopSpecial(day)].find((x) => x.id === a.offer);
      if (!o) return fail('Món này hết bán rồi.');
      if (o.daily && (s.shop.bought[o.id] ?? 0) >= o.daily) return fail('Hôm nay đã mua đủ món này.');
      const price = shopPrice(s, o.price);
      if (s.res.tien < price) return fail('Không đủ tiền đồng.');
      s.res.tien -= price;
      s.shop.bought[o.id] = (s.shop.bought[o.id] ?? 0) + 1;
      giveGood(s, o.good, o.n);
      return { ok: true, msg: `Đã mua ${o.n > 1 ? o.n + ' ' : ''}${goodLabel(o.good)}.` };
    }
    case 'dung': {
      const it = ITEMS[a.item];
      if (!it || !it.use) return fail('Vật này không dùng được.');
      if ((s.bag[a.item] ?? 0) < 1) return fail('Trong túi không còn.');
      if (a.item === 'haido' && !s.voyage) return fail('Thuyền đang ở bến, chưa cần hải đồ.');
      if (a.item === 'lenhbai' && s.slotsBonus >= 2) return fail('Đã có đủ 2 Lệnh Bài.');
      s.bag[a.item] = (s.bag[a.item] ?? 0) - 1;
      if (a.item === 'banhchung') for (const k of LV_KEYS) s.lv[k].hunger = 0;
      if (a.item === 'ruounep')
        for (const k of LV_KEYS) {
          s.lv[k].mood = 'vui';
          s.lv[k].moodUntil = s.gt + 30 * 60_000;
        }
      if (a.item === 'haido' && s.voyage) {
        const v = s.voyage;
        const end = v.phase === 'di' ? v.arriveAt : v.returnAt;
        const cut = Math.max(0, Math.floor((end - s.gt) / 2));
        if (v.phase === 'di') v.arriveAt -= cut;
        v.returnAt -= cut;
      }
      if (a.item === 'goquy') addRes(s, { go: 150, cui: 80 });
      if (a.item === 'ngoctraiden') addRes(s, { ngoc: 4 });
      if (a.item === 'lenhbai') s.slotsBonus++;
      return { ok: true, msg: `Đã dùng ${it.name}.` };
    }
    case 'craft': {
      const g = GEAR[a.g];
      if (!g) return fail('Không có trang bị này.');
      if (s.lv[g.need.lv].tier < g.need.tier) return fail(`Cần ${LV_LABEL[g.need.lv]} bậc ${g.need.tier} để chế tạo.`);
      if (s.kho[a.g] >= g.max) return fail(`Kho chỉ chứa tối đa ${g.max} ${g.name}.`);
      const cost = craftCost(s, a.g);
      if (!canPay(s, cost)) return fail('Chưa đủ tài nguyên.');
      pay(s, cost);
      s.kho[a.g]++;
      log(s, `Chế tạo ${g.name}.`);
      return { ok: true, msg: `Đã chế tạo ${g.name}.` };
    }
    case 'avatar': {
      const av = cleanAvatar(a.av);
      if (!av) return fail('Dáng vẻ không hợp lệ.');
      // lần đầu miễn phí; sau đó mỗi lần đổi tốn một Thẻ Đổi Giao Diện
      if (s.avatarSet) {
        if ((s.bag.thegd ?? 0) < 1) return fail('Nhân vật chỉ đổi được một lần. Cần Thẻ Đổi Giao Diện (mua ở Chợ).');
        s.bag.thegd = (s.bag.thegd ?? 0) - 1;
      }
      s.avatar = av;
      s.avatarSet = true;
      return { ok: true, msg: 'Đã lưu dáng vẻ nhân vật.' };
    }
    case 'speed': {
      s.speed = Math.max(1, Math.min(20, a.speed));
      return { ok: true, msg: s.speed > 1 ? `Tốc độ test x${s.speed}` : 'Tốc độ thường' };
    }
  }
}

/** Đánh một đảo quái. holdLoot = true: chiến lợi phẩm nằm trên thuyền, về bến mới cộng. */
export function fightWild(s: PlayerState, w: (typeof WILDS)[number], holdLoot = false): Outcome {
  const st = s.wilds[w.id] ?? { wins: 0, readyAt: 0 };
  const spec = teamSpec(s, false);
  const r = rngOf(s);
  const bonusLv = Math.min(5, st.wins); // đánh lại thì quái mạnh dần
  const enemies = w.enemies.map(([k, lv]) => [k, lv + bonusLv] as [typeof k, number]);
  const battle = simulate(teamFromSpec(spec, 0), teamFromMonsters(enemies, 1), r);
  s.stats.battles++;
  const avgLv = enemies.reduce((t, e) => t + e[1], 0) / enemies.length;
  if (battle.winner === 0) {
    s.stats.wins++;
    st.wins++;
    st.readyAt = s.gt + w.respawnMs;
    s.wilds[w.id] = st;
    const gain = { ...w.loot };
    const dropChest = w.chest !== undefined && r() < (w.chestChance ?? 1);
    if (dropChest) {
      const extra = rollChest(s, w.chest!, r);
      for (const [k, v] of Object.entries(extra)) gain[k as ResKey] = (gain[k as ResKey] ?? 0) + (v ?? 0);
    }
    const got = holdLoot ? gain : addRes(s, gain);
    const ups = rewardComps(s, spec, Math.round(8 + 3 * avgLv));
    const q = w.id === 'baicua' ? doneQuest(s, 'q_fight') : null;
    log(s, `Thắng ${w.name}.`);
    return { ok: true, msg: `Thắng ${w.name}!${dropChest ? ' Có rơi hòm.' : ''}`, battle, gained: got, levelUps: ups, chest: dropChest ? w.chest : undefined, quest: q ?? undefined };
  }
  st.readyAt = s.gt + 20_000;
  s.wilds[w.id] = st;
  const ups = rewardComps(s, spec, 4);
  log(s, `Thua ở ${w.name}.`);
  return { ok: true, msg: `Thua ở ${w.name}. Cho linh vật ăn, mạnh lên rồi quay lại.`, battle, gained: {}, levelUps: ups };
}

// ---------- tương tác giữa người chơi ----------
export interface IslandPub {
  id: string;
  name: string;
  islandName: string;
  power: number;
  title: string;
  land: number;
  tiers: Record<LvKey, number>;
  team: { k: CompKey; lv: number }[];
  lootable: Partial<Record<ResKey, number>>;
  updatedAt: number;
  bot?: boolean;
  avatar?: Avatar;
  /** trang bị cất ở nhà (giữ đảo khi bị đột kích) */
  gear?: GearSet;
  /** thành tích Thủy Tinh tuần */
  boss?: { week: number; best: number; won: boolean };
  /** số lần phi thăng */
  asc?: number;
  /** thành trì khi giữ đảo */
  def?: DefSpec;
  /** cấp thành trì, cấp trạm thuế */
  fort?: number;
  port?: number;
  /** đang là chư hầu của ai */
  lord?: { id: string; name: string } | null;
  /** số chư hầu */
  vassals?: number;
  guild?: string;
}

export function publicOf(s: PlayerState): IslandPub {
  const prot = protectAmt(s);
  const lootable: Partial<Record<ResKey, number>> = {};
  for (const k of RES_KEYS) {
    if (k === 'ngoc') continue;
    const v = Math.max(0, s.res[k] - prot);
    if (v > 0) lootable[k] = v;
  }
  return {
    id: s.id,
    name: s.name,
    islandName: s.islandName,
    power: power(s),
    title: titleFor(s),
    land: landCount(s),
    tiers: { leu: s.lv.leu.tier, cuoc: s.lv.cuoc.tier, rao: s.lv.rao.tier, thuyen: s.lv.thuyen.tier },
    team: teamSpec(s, false).comps,
    lootable,
    updatedAt: Date.now(),
    avatar: s.avatar,
    gear: { ...s.kho },
    boss: { week: s.boss.week, best: s.boss.best, won: s.boss.won },
    asc: s.asc,
    def: defSpecOf(s.dinh),
    fort: fortLevel(s.dinh),
    port: bLevel(s.dinh, 'tramthue'),
    lord: s.chuQuan && s.chuQuan.until > s.lastReal ? { id: s.chuQuan.id, name: s.chuQuan.name } : null,
    vassals: s.chuHau.length,
    guild: s.guild?.tag,
  };
}

export interface RaidEvent {
  id: string;
  attackerId: string;
  attackerName: string;
  targetId: string;
  targetName: string;
  win: boolean;
  loot: Partial<Record<ResKey, number>>;
  seed: number;
  t: number;
  /** đánh chiếm thành chư hầu */
  conquer?: boolean;
  /** chư hầu khởi nghĩa đánh thắng chủ */
  liberate?: boolean;
  until?: number;
  attackerIsland?: string;
}

export function raidSeed(attackerId: string, targetId: string, n: number) {
  return hashStr(`raid:${attackerId}:${targetId}:${n}`);
}

/** Tính trận đột kích từ hai bản công khai — server dùng đúng hàm này để kiểm lại. */
export function resolveRaid(att: TeamSpec, target: IslandPub, seed: number): { battle: BattleResult; loot: Partial<Record<ResKey, number>> } {
  const r = mulberry32(seed);
  const defSpec: TeamSpec = { comps: target.team, cuocTier: target.tiers.cuoc, raoTier: target.tiers.rao, hero: target.name, gear: gearBonus(target.gear), fort: target.bot ? undefined : cleanDef(target.def) };
  const battle = simulate(teamFromSpec(att, 0), teamFromSpec(defSpec, 1), r);
  const loot: Partial<Record<ResKey, number>> = {};
  if (battle.winner === 0) {
    for (const [k, v] of Object.entries(target.lootable)) {
      const take = Math.floor((v ?? 0) * RAID_SHARE);
      if (take > 0) loot[k as ResKey] = take;
    }
  }
  return { battle, loot };
}

/** Đánh chiếm: cần Đồn binh, còn chỗ giữ chư hầu. */
export function conquerCheck(s: PlayerState, target: IslandPub): string | null {
  const don = bLevel(s.dinh, 'donbinh');
  if (!don) return 'Cần xây Trại Lính (Đồn binh) để đánh chiếm đảo.';
  if (s.lv.leu.tier < 3) return 'Cần Nhà chính bậc 3 để giữ chư hầu.';
  if (s.chuHau.some((v) => v.id === target.id)) return 'Đảo này đã là chư hầu của bạn.';
  if (s.chuHau.length >= MAX_VASSALS[don]) return `Đồn binh cấp ${don} chỉ giữ được ${MAX_VASSALS[don]} chư hầu.`;
  return null;
}

export function raidCheck(s: PlayerState, target: IslandPub): string | null {
  if (target.id === s.id) return 'Không tự đột kích đảo mình được.';
  if ((s.raidCd[target.id] ?? 0) > s.gt) return 'Vừa đột kích đảo này rồi, để họ nghỉ một chút.';
  if (s.lv.leu.tier < 2 && !target.bot) return 'Nâng Nhà chính lên bậc 2 để mở đột kích người chơi.';
  if (target.tiers.leu < 2 && !target.bot) return 'Đảo này còn được Rùa Vàng che chở vì chủ đảo mới tới.';
  return null;
}

/** Đánh trận đột kích ngay. holdLoot = true: chiến lợi phẩm nằm trên thuyền, về bến mới cộng. */
export function raid(s: PlayerState, target: IslandPub, holdLoot = false, conquer = false): Outcome & { event?: RaidEvent } {
  const err = raidCheck(s, target) ?? (conquer ? conquerCheck(s, target) : null);
  if (err) return fail(err);
  const liberate = !!s.chuQuan && s.chuQuan.id === target.id && s.chuQuan.until > s.lastReal;
  s.stats.raids++;
  const seed = raidSeed(s.id, target.id, s.stats.raids + s.seq);
  const spec = teamSpec(s, false);
  const { battle, loot } = resolveRaid(spec, target, seed);
  s.raidCd[target.id] = s.gt + RAID_COOLDOWN_MS;
  const win = battle.winner === 0;
  const got = win ? (holdLoot ? loot : addRes(s, loot)) : {};
  const ups = rewardComps(s, spec, win ? 20 : 6);
  if (win) s.stats.raidWins++;
  const q = win ? doneQuest(s, 'q_raid') : null;
  log(s, win ? `Đột kích ${target.islandName} thành công.` : `Bị đẩy lui ở ${target.islandName}.`);
  const event: RaidEvent = {
    id: `r${s.id.slice(-6)}${s.stats.raids}${s.seq}`,
    attackerId: s.id,
    attackerName: s.name,
    targetId: target.id,
    targetName: target.islandName,
    win,
    loot: win ? loot : {},
    seed,
    t: Date.now(),
    conquer: conquer && win,
    liberate: liberate && win,
    until: s.lastReal + VASSAL_MS,
    attackerIsland: s.islandName,
  };
  if (win && liberate) {
    s.chuQuan = null;
    log(s, `Khởi nghĩa thắng lợi! ${s.islandName} thoát ách ${target.name}.`);
  }
  if (win && conquer) {
    s.chuHau = s.chuHau.filter((v) => v.id !== target.id);
    s.chuHau.push({ id: target.id, name: target.name, islandName: target.islandName, cell: islandCell(target.id), power: target.power, port: target.port ?? 0, until: s.lastReal + VASSAL_MS, bot: !!target.bot });
    log(s, `Thôn tính ${target.islandName}: thành chư hầu 72 giờ.`);
  }
  return {
    ok: true,
    msg: win ? `Đột kích thành công ${target.islandName}!` : `${target.islandName} giữ đảo thành công.`,
    battle,
    gained: got,
    levelUps: ups,
    quest: q ?? undefined,
    event,
  };
}

export function applyRaidAgainstMe(s: PlayerState, ev: RaidEvent): string | null {
  if (ev.targetId !== s.id || s.applied.includes(ev.id)) return null;
  s.applied.push(ev.id);
  if (s.applied.length > 200) s.applied.splice(0, s.applied.length - 200);
  if (!ev.win) {
    s.stats.defended++;
    addRes(s, { so: 5 });
    const text = `${ev.attackerName} đột kích nhưng ${LINH_VAT.rao.tiers[s.lv.rao.tier - 1]} đã giữ đảo. +5 Vỏ Sò.`;
    log(s, text);
    return text;
  }
  const prot = protectAmt(s);
  const lost: string[] = [];
  for (const [k, v] of Object.entries(ev.loot)) {
    const key = k as ResKey;
    const can = Math.max(0, s.res[key] - prot);
    const take = Math.min(can, v ?? 0);
    if (take > 0) {
      s.res[key] -= take;
      lost.push(`${take} ${RES[key].name}`);
    }
  }
  s.stats.robbed++;
  if (ev.liberate) s.chuHau = s.chuHau.filter((v) => v.id !== ev.attackerId);
  if (ev.conquer) s.chuQuan = { id: ev.attackerId, name: ev.attackerName, islandName: ev.attackerIsland ?? ev.attackerName, until: ev.until ?? s.lastReal + VASSAL_MS };
  const text = ev.liberate
    ? `${ev.attackerName} khởi nghĩa đánh thắng, thoát khỏi ách chư hầu${lost.length ? ` và lấy ${lost.join(', ')}` : ''}.`
    : ev.conquer
      ? `${ev.attackerName} đánh chiếm đảo bạn! Đảo thành chư hầu, phải cống nạp 72 giờ. Đánh thắng họ để khởi nghĩa.${lost.length ? ` Mất ${lost.join(', ')}.` : ''}`
      : `${ev.attackerName} đột kích đảo bạn${lost.length ? `, lấy mất ${lost.join(', ')}` : ''}.`;
  log(s, text);
  return text;
}

/** Dấu vân tay ngắn của trạng thái: client và server so nhau để phát hiện lệch. */
export function digest(s: PlayerState): string {
  const parts = [s.rngN, s.seq, landCount(s), ...RES_KEYS.filter((k) => k !== 'tien').map((k) => s.res[k]), ...LV_KEYS.map((k) => `${s.lv[k].tier}:${s.lv[k].xp}`), s.builds.length, s.voyage?.id ?? '-', s.chests.length];
  return hashStr(parts.join('|')).toString(36);
}

/** Sửa dữ liệu cũ/thiếu khi tải save. */
export function migrate(raw: unknown, id: string, name: string, now: number): PlayerState {
  const fresh = newPlayer(id, name, now);
  if (!raw || typeof raw !== 'object') return fresh;
  const s = raw as PlayerState;
  if (s.v !== 1 || typeof s.land !== 'string' || s.land.length !== GRID * GRID) return fresh;
  const merged: PlayerState = { ...fresh, ...s, id };
  merged.res = { ...fresh.res, ...s.res };
  merged.stats = { ...fresh.stats, ...s.stats };
  merged.comps = { ...fresh.comps, ...s.comps };
  merged.lv = { ...fresh.lv, ...s.lv };
  return merged;
}


// ---------- kinh tế: giá, hàng hóa, rơi đồ ----------
export function craftCost(s: PlayerState, g: GearKey): Partial<Record<ResKey, number>> {
  const k = 1 - 0.1 * bLevel(s.dinh, 'xuongren');
  const out: Partial<Record<ResKey, number>> = {};
  for (const [r, v] of Object.entries(GEAR[g].cost)) out[r as ResKey] = Math.ceil((v ?? 0) * k);
  return out;
}
export const shopPrice = (s: PlayerState, base: number) => Math.ceil(base * (1 - 0.05 * bLevel(s.dinh, 'cho')));

export function goodLabel(g: GoodKey | string): string {
  if (g.startsWith('g_')) return GEAR[g.slice(2) as GearKey].name;
  if (g in ITEMS) return ITEMS[g as ItemKey].name;
  return RES[g as ResKey]?.name ?? g;
}
/** Có bao nhiêu món hàng này trong đảo. */
export function haveGood(s: PlayerState, g: string): number {
  if (g.startsWith('g_')) return s.kho[g.slice(2) as GearKey] ?? 0;
  if (g in ITEMS) return s.bag[g as ItemKey] ?? 0;
  return s.res[g as ResKey] ?? 0;
}
export function takeGood(s: PlayerState, g: string, n: number): boolean {
  if (n <= 0 || haveGood(s, g) < n) return false;
  if (g.startsWith('g_')) s.kho[g.slice(2) as GearKey] -= n;
  else if (g in ITEMS) s.bag[g as ItemKey] = (s.bag[g as ItemKey] ?? 0) - n;
  else s.res[g as ResKey] -= n;
  return true;
}
/** Nhận hàng (trang bị vượt giới hạn kho đổi ra tiền theo giá trị). */
export function giveGood(s: PlayerState, g: string, n: number) {
  if (g.startsWith('g_')) {
    const k = g.slice(2) as GearKey;
    const room = Math.max(0, GEAR[k].max - s.kho[k]);
    s.kho[k] += Math.min(room, n);
  } else if (g in ITEMS) s.bag[g as ItemKey] = (s.bag[g as ItemKey] ?? 0) + n;
  else s.res[g as ResKey] = (s.res[g as ResKey] ?? 0) + n; // hàng mua về không bị giới hạn kho
}

/** Vật phẩm hiếm rơi từ hòm (hòm càng quý càng dễ ra đồ hiếm). */
export function rareDrop(r: Rng, ci: number): ItemKey | null {
  const roll = r();
  if (roll < 0.002 * (ci + 1)) return 'vayrong';
  if (roll < 0.01 * (ci + 1)) return 'lenhbai';
  if (roll < 0.03 * (ci + 1)) return 'ngoctraiden';
  if (roll < 0.06 * (ci + 1)) return 'haido';
  if (roll < 0.1 * (ci + 1)) return 'goquy';
  return null;
}

export const fortName = (s: PlayerState) => FORT_NAMES[fortLevel(s.dinh)];
export { B_KEYS, BUILDINGS, PORT_MULT };
