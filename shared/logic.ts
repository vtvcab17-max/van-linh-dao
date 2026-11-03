// Trạng thái người chơi và mọi hành động. Hàm thuần: client chạy để phản hồi tức thì, server chạy lại để xác nhận.
import {
  BUILD_FACTOR,
  BUILD_MS,
  CHESTS,
  CHEST_INTERVAL_MS,
  COMP_KEYS,
  COMPANIONS,
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
import { islandCell, worldFor } from './map';
import { hexDist, hexLine, hexRange } from './hex';
import { TROOPS, TROOP_KEYS, carryCap, cleanTroops, fitCargo, houseCap, isMech, squadUnit as _sq, survivors, troopCount, troopPower, type TroopKey, type Troops } from './troops';
import { berthsUsed, cleanShips, fleetCap, SHIP_SIZE, SHIP_WEAR, SHIPS, WEAPONS, type Ship, type ShipKind, type ShipWeapon } from './navy';
import {
  CROPS, cropProgress, mealBuff, GEAR_WEAR, HIRE_COST, HULL_WEAR, OVERRIPE_MS, PENS, PER_WORKER, PLOT_YIELD, plotSeed, PROCS, RATION_PER_HOUR, SICK_PER_HOUR, STORE_H, TECH_MAX, TECHS, WEATHER, regionOf, techCost, techMs, wearMult, weatherAt, windFactor,
  type CropKey, type TechKey,
} from './eco';
import { inWorld, isleById, lairById, WORLD_H, WORLD_VERSION, WORLD_W, type Isle } from './world';
import { cleanDef } from './economy';
import { SELL_CHO_BONUS, SELL_PRICE, WRAP_PER_LA } from './balance';
import { FISH, herdCap, HATCH_EGGS, isAdult, newSociety, PRES_PRICE, PRES_YIELD, PRESERVED, prosperity, SELL_MEAT, settleSociety, SPECIES, trauBonus, type FishHow, type PKey, type Society, type Sp } from './society';
import {
  DUP_FRAGS, FRAG_PER_GENERAL, GEN_IDS, GENERALS, LEG_IDS, LEG_WEAPONS, LT_BUY_DAILY, LT_BUY_PRICE, LT_SELL_PRICE, MAX_STAR, PITY, rollWheel, SPIN10_COST, SPIN_COST, starMult, ltDrop,
  type GenId, type LegWeaponId, type Rarity,
} from './gacha';
import {
  B_KEYS, BUILDINGS, bLevel, bSum, dayOf, defSpecOf, fortLevel, FORT_NAMES, ITEMS, MAX_VASSALS, PORT_MULT, routePeriod, SHOP_BASE, shopSpecial, slotsOf, slotSum, tollPerHour, tributePerHour, VASSAL_MS, VASSAL_TOLL_SHARE,
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
  soc: Society;
  v: 1;
  id: string;
  name: string;
  islandName: string;
  seed: number;
  /** Muối bí mật, chỉ server biết (không bao giờ gửi cho client). */
  salt?: number;
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
  boss: { week: number; best: number; tries: number; won: boolean; total: number };
  /** Sát thương lên Thủy Tinh chờ server cộng vào máu chung (server lấy ra rồi xóa). */
  bossOut: { w: number; d: number }[];
  /** Server ghi: Thủy Tinh tuần này đã bị cả Hải Khu hạ chưa. */
  thienMon: { week: number; done: boolean };
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
  guild: { id: string; name: string; tag: string; lv: number; allies?: string[]; allyTags?: string[] } | null;
  /** Tướng đang có: số sao (1..5). */
  tuong: Partial<Record<GenId, number>>;
  /** Tướng ra trận cùng đội. */
  chuTuong: GenId | null;
  /** Vũ khí truyền thuyết trong kho (số lượng). */
  vuKhi: Partial<Record<LegWeaponId, number>>;
  /** Vũ khí đang đeo cho chủ tướng. */
  deo: LegWeaponId | null;
  /** Mảnh tướng truyền thuyết. */
  manh: number;
  /** Vòng quay: số lần liền chưa ra đồ truyền thuyết (bảo hiểm), tổng lượt quay. */
  gacha: { pity: number; spins: number };
  /** Hạm đội: thuyền chiến đóng thêm ở Xưởng Đóng Tàu. */
  fleet: Ship[];
  /** quân đóng ở đảo nhà, ở từng đảo đã cắm cờ, và kế hoạch mang theo khi ra khơi (spec 013) */
  troops: Troops;
  isleTroops: Record<string, Troops>;
  mang: Troops;
  /** Khiên bảo hộ tới lúc này (giờ thật): không ai đột kích, đánh chiếm, thám thính được. */
  shield: number;
  /** Nghiên cứu đã xong ở học viện. */
  tech: Partial<Record<TechKey, number>>;
  /** Đang nghiên cứu (xong lúc end, giờ trong game). */
  research: { k: TechKey; to: number; end: number } | null;
  /** Độ bền trang bị theo loại (0..100). */
  ben: Record<GearKey, number>;
  /** Độ bền thân thuyền (0..100). */
  vo: number;
  /** Hải Khu đang ở (server ghi). */
  khu: string;
  /** Ô đảo nhà trên hải đồ lục giác (server chọn khi vào lần đầu). */
  home: { x: number; y: number } | null;
  /** Vùng biển đã khám phá (bitset base64, mỗi ô một bit). */
  seen: string;
  /** phiên bản hải đồ của toạ độ đang lưu */
  wv?: number;
  /** Đảo tự nhiên đã cắm cờ chủ quyền. */
  isles: OwnedIsle[];
  /** Kết quả đánh đảo chờ server ghi sổ chủ quyền (server lấy ra rồi xóa). */
  claims: { isle: string; win: boolean; at: number }[];
  /** Lượt quay đã mua (không đổi, không bán, không cho được). */
  luot: number;
  /** Đã đổi đồng vàng lấy Linh Thạch hôm nay. */
  ltDay: { day: number; n: number };
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
  kind: 'wild' | 'island' | 'boss' | 'isle' | 'scout';
  /** lương mang theo (khẩu phần), cần cho cả chuyến, thuốc men mang theo */
  food?: number;
  need?: number;
  duoc?: number;
  /** cơ cấu khẩu phần mang theo (quyết định buff bữa ăn) */
  mix?: Partial<Record<ResKey, number>>;
  /** quân mang theo trên thuyền */
  troops?: Troops;
  /** đảo tự nhiên đang có chủ: sức giữ đảo lúc ra khơi */
  isleDef?: IsleDef;
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

/** Ngẫu nhiên có giá trị (quay, hòm, LT rơi): trộn muối bí mật của server. */
export function rngSecret(s: PlayerState): Rng {
  s.rngN++;
  return mulberry32(hashStr(s.salt === undefined ? `${s.seed}:${s.rngN}` : `${s.seed}:${s.salt}:${s.rngN}`));
}
/** Bản sao trạng thái không có muối, dùng khi gửi cho client. */
export function stripSecret<T extends { salt?: number }>(s: T): T {
  if (s.salt === undefined) return s;
  const { salt: _salt, ...rest } = s;
  return rest as T;
}
/** Hành động mà bản chính thức để server quyết định kết quả (client không áp dụng sớm). */
export const SERVER_RNG_ACTIONS: ReadonlySet<string> = new Set(['quay', 'chest']);

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
    res: { co: 10, la: 0, tre: 6, go: 0, cui: 0, da: 6, sat: 0, so: 20, ngoc: 0, tien: 50, lt: 0, thoc: 0, gao: 0, rau: 0, thit: 0, trung: 0, ca: 0, thaoduoc: 0, to: 0, luong: 20, duoc: 3, vai: 0 },
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
      trau: { lv: 1, xp: 0, unlocked: false },
      ngu: { lv: 1, xp: 0, unlocked: false },
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
    boss: { week: weekOf(now), best: 0, tries: 0, won: false, total: 0 },
    bossOut: [],
    tuong: {},
    chuTuong: null,
    vuKhi: {},
    deo: null,
    manh: 0,
    gacha: { pity: 0, spins: 0 },
    ltDay: { day: 0, n: 0 },
    luot: 0,
    khu: '01',
    shield: now + 24 * 3600_000, // người mới được che chở 24 giờ
    fleet: [],
    troops: {},
    isleTroops: {},
    mang: {},
    tech: {},
    research: null,
    ben: { giao: 100, khien: 100, thuoc: 100, bua: 100 },
    vo: 100,
    home: null,
    seen: '',
    wv: WORLD_VERSION,
    soc: newSociety(),
    isles: [],
    claims: [],
    thienMon: { week: weekOf(now), done: false },
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
  reveal(s, [homeCell(s)], homeVision(s));
  return s;
}

/** Server đặt chỗ đảo nhà trên hải đồ (lần đầu vào, hoặc dữ liệu cũ chưa có chỗ). */
export function setHome(s: PlayerState, khu: string, cell: { x: number; y: number }) {
  s.khu = khu;
  s.home = { x: cell.x, y: cell.y };
  reveal(s, [cell], homeVision(s));
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
/** Đảo khởi đầu không nhỏ hơn 48 ô vuông. */
export const START_LAND = 48;
export function startShape(seed: number): { land: [number, number][]; spots: [number, number][] } {
  const r = mulberry32(hashStr(`shape:${seed}`));
  const has = new Set(CORE.map(([x, y]) => `${x},${y}`));
  const land = [...CORE];
  // hướng kéo dài riêng của từng đảo
  const ang = r() * Math.PI * 2;
  const stretch = 0.35 + r() * 0.9;
  const lumpy = r();
  while (land.length < START_LAND) {
    const front: { x: number; y: number; w: number }[] = [];
    for (const [x, y] of land)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 4 || ny < 4 || nx > 19 || ny > 19 || has.has(`${nx},${ny}`)) continue;
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
// mỗi ô kho của Vựa thóc thêm 5% sức chứa
export const storageCap = (s: PlayerState) => Math.round(EFFECTS.storageCap[tierIdx(s, 'leu')] * (1 + 0.05 * slotSum(s.dinh, 'khothoc')));
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
  const k = Math.max(0, landCount(s) - START_LAND); // số ô đã khai hoang
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
  // đảo khởi đầu đã có 48 ô: 32 ô được cho không tính vào sức mạnh (giữ cân bằng như trước)
  return Math.round(Math.max(0, land - 32) + (tiers.leu ?? 1) * 30 + (tiers.cuoc ?? 1) * 25 + (tiers.rao ?? 1) * 25 + (tiers.thuyen ?? 1) * 15 + team.reduce((t, c) => t + c.lv * 12, 0) + gearPower(gear) + asc * 150);
}
export function power(s: PlayerState): number {
  const team = COMP_KEYS.filter((k) => s.comps[k].unlocked).map((k) => s.comps[k]);
  return powerFrom({ leu: s.lv.leu.tier, cuoc: s.lv.cuoc.tier, rao: s.lv.rao.tier, thuyen: s.lv.thuyen.tier }, team, landCount(s), s.kho, s.asc) + genPower(s) + troopPower(s.troops) + Object.values(s.isleTroops).reduce((p, g) => p + troopPower(g), 0) + troopPower(s.voyage?.troops);
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
      const g = gearBonusWorn(s.kho, s.ben);
      g.atk += 0.05 * Math.min(3, s.bag.vayrong ?? 0) + 0.04 * (s.tech.binhPhap ?? 0);
      return g;
    })(),
    mod: defending ? undefined : battleMod,
    fort: defending ? defSpecOf(s.dinh) : undefined,
    ships: s.fleet.filter((x) => x.vo > 0).map((x) => ({ k: x.k, w: { ...x.w }, vo: x.vo })),
    troops: defending ? cleanTroops(s.troops) : cleanTroops(s.voyage?.troops),
    gen: s.chuTuong && s.tuong[s.chuTuong] ? { id: s.chuTuong, star: s.tuong[s.chuTuong]!, w: s.deo && (s.vuKhi[s.deo] ?? 0) > 0 ? s.deo : null } : undefined,
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
/** Bậc Nhà chính tối thiểu để một công trình lên cấp 3 (không dưới bậc 4: cấp 3 là mục tiêu dài hạn). */
export const LV3_TIER = (needLeu: number) => Math.min(5, Math.max(4, needLeu + 2));

export function incomePerHour(s: PlayerState, now = s.lastReal) {
  const period = routePeriod(now);
  const bonus = (s.bag.trongdong ? 0.25 : 0) + (s.guild ? 0.05 * s.guild.lv : 0);
  const pr = prosperity(s);
  const dan = Math.round(slotSum(s.dinh, 'nhadan') * pr.eff); // mỗi gian nhà một hộ, 1 đồng/giờ × hiệu suất (phồn vinh, quá tải)
  const toll = tollPerHour(homeCell(s), period, bLevel(s.dinh, 'tramthue'), bonus);
  let cong = 0;
  for (const v of s.chuHau) if (v.until > now) cong += tributePerHour(v.power) + tollPerHour(v.cell, period, v.port) * VASSAL_TOLL_SHARE;
  const nop = s.chuQuan && s.chuQuan.until > now ? tributePerHour(power(s)) : 0;
  return { dan, toll, cong, nop, thuong: pr.merchants, total: dan + toll + cong - nop + pr.merchants };
}

// ---------- vòng thời gian ----------
export function tick(s: PlayerState, now: number): string[] {
  const notes: string[] = [];
  const dtReal = Math.max(0, Math.min(now - s.lastReal, 7 * 24 * 3600_000));
  s.lastReal = now;
  // thứ Hai: Thủy Tinh hồi sinh, thành tích tuần làm mới (số lần phi thăng giữ nguyên)
  const wk = weekOf(now);
  if (s.boss.week !== wk) s.boss = { week: wk, best: 0, tries: 0, won: false, total: 0 };
  if (s.thienMon.week !== wk) s.thienMon = { week: wk, done: false };
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
  // đảo đã mất hoặc bỏ thì quân đóng ở đó về đảo nhà
  for (const [id, g] of Object.entries(s.isleTroops)) {
    if (s.isles.some((o) => o.id === id)) continue;
    for (const k of TROOP_KEYS) if (g[k]) s.troops[k] = (s.troops[k] ?? 0) + (g[k] ?? 0);
    delete s.isleTroops[id];
  }
  // nhà cửa, thành trì xây xong
  for (const d of s.dinh)
    if (d.doneAt !== undefined && s.gt + dtReal * s.speed >= d.doneAt) {
      if (!d.lv) d.last = now;
      d.lv = d.to ?? d.lv + 1;
      d.to = undefined;
      d.doneAt = undefined;
      notes.push(`Xây xong ${BUILDINGS[d.k].names[d.lv - 1]}.`);
      // nông trại nuôi ra quân: Ao Cá xong → Ngư Phủ, Chuồng cấp 2 → Trâu Chiến
      if (d.k === 'aoca' && !s.comps.ngu.unlocked) {
        s.comps.ngu.unlocked = true;
        notes.push(`${COMPANIONS.ngu.name} xin theo đội ra trận!`);
      }
      if (d.k === 'chuong' && d.lv >= 2 && !s.comps.trau.unlocked) {
        s.comps.trau.unlocked = true;
        notes.push(`${COMPANIONS.trau.name} xin theo đội ra trận!`);
      }
    }
  const dt = dtReal * s.speed;
  s.gt += dt;
  settleSociety(s, dt);
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
  if (s.research && s.gt >= s.research.end) {
    s.tech[s.research.k] = s.research.to;
    notes.push(`Học Viện nghiên cứu xong ${TECHS[s.research.k].name} cấp ${s.research.to}.`);
    s.research = null;
  }
  notes.push(...buildTick(s));
  notes.push(...voyageTick(s));
  return notes;
}

export const buildSlots = (s: PlayerState) => (s.lv.leu.tier >= 3 ? 2 : 1) + Math.min(2, s.slotsBonus);
/** Số đội thợ đang bận (tiến hóa linh vật + xây nhà cửa, thành trì). */
export const busySlots = (s: PlayerState) => s.builds.length + s.dinh.filter((d) => d.doneAt !== undefined).length;

/** Ô của đảo mình trên hải đồ chung. */
export const homeCell = (s: PlayerState) => s.home ?? islandCell(s.id, s.khu);
/** Nơi thuyền có thể xuất phát: đảo nhà và các chư hầu còn hạn (cứ điểm). */
export function bases(s: PlayerState): { x: number; y: number; name: string }[] {
  const w = worldFor(s.khu);
  const outposts = s.isles
    .filter((o) => o.don > 0)
    .map((o) => isleById(w, o.id))
    .filter(Boolean)
    .map((i) => ({ x: i!.c, y: i!.r, name: i!.name }));
  return [{ ...homeCell(s), name: s.islandName }, ...s.chuHau.filter((v) => v.until > s.lastReal).map((v) => ({ ...v.cell, name: v.islandName })), ...outposts];
}
/** Cứ điểm gần đích nhất. */
export function nearestBase(s: PlayerState, to: { x: number; y: number }) {
  return bases(s).reduce((b, c) => (cellDist(c, to) < cellDist(b, to) ? c : b));
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
  const dist = Math.max(1, cellDist(from, to));
  return Math.round((dist * EFFECTS.sailSecPerCell[tierIdx(s, 'thuyen')] * 1000 * mul * sailWind(s, from, to)) / moodMult(s.lv.thuyen));
}

/** Điều kiện ra khơi đánh Thủy Tinh; trả về lý do nếu chưa được. */
export function bossCheck(s: PlayerState): string | null {
  if (s.lv.leu.tier < BOSS_REQ.leu) return `Cần Nhà chính bậc ${BOSS_REQ.leu} trở lên.`;
  if (s.lv.thuyen.tier < BOSS_REQ.thuyen) return `Cần thuyền bậc ${BOSS_REQ.thuyen} trở lên mới vượt được vùng bão.`;
  if (s.builds.some((b) => b.lv === 'thuyen')) return 'Thuyền đang được nâng cấp, chưa ra khơi được.';
  if (s.boss.won) return 'Bạn đã phi thăng tuần này. Thủy Tinh sẽ hồi sinh vào thứ Hai.';
  if (s.thienMon.week === weekOf(s.lastReal) && s.thienMon.done) return 'Thủy Tinh tuần này đã bị cả Hải Khu hạ. Chờ thứ Hai.';
  if (s.voyage) return 'Thuyền đang ở ngoài biển.';
  return null;
}

/**
 * Đại chiến Thủy Tinh: đội + trang bị chở theo, đấu tối đa 40 lượt.
 * Không đội nào hạ được Thủy Tinh một mình: sát thương được cộng vào máu chung của cả Hải Khu.
 * Bị diệt sạch thì mất trang bị mang theo và thuyền; trụ được tới hết trận thì rút về an toàn.
 */
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
  s.boss.total += dmg;
  s.bossOut.push({ w: week, d: dmg });
  const wiped = (real.hpA ?? []).every((hp) => hp <= 0);
  const ups = rewardComps(s, spec, wiped ? 15 : 30);
  if (wiped) log(s, `Bị Thủy Tinh diệt sạch: mất trang bị mang theo, thuyền bị đánh chìm. Gây ${dmg} sát thương.`);
  else log(s, `Trụ vững trước Thủy Tinh, rút về an toàn. Gây ${dmg} sát thương vào máu chung.`);
  return { ok: true, msg: `Gây ${dmg} sát thương cho ${form.name} · ${form.title}.`, battle: real, gained: {}, levelUps: ups, boss: { dmg, win: false, wiped, form: form.key } };
}

/** Server gọi khi Thủy Tinh bị cả Hải Khu hạ và người này được Thiên Môn chọn. */
export function ascend(s: PlayerState, rank: number): string {
  s.boss.won = true;
  s.asc++;
  const relic: ItemKey = s.bag.trongdong ? 'vayrong' : 'trongdong';
  s.bag[relic] = (s.bag[relic] ?? 0) + 1;
  addRes(s, ASCEND_REWARD);
  s.res.lt += 100;
  const text = `PHI THĂNG! Thiên Môn mở cho bạn (hạng ${rank} góp sát thương). Bạn trở thành Tiên Nhân.`;
  log(s, text);
  return text;
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
    // thời tiết nơi đánh, đói, bệnh trên đường: áp vào đội tấn công
    const cond = v.kind === 'scout' ? null : voyageCondition(s, v);
    battleMod = cond?.mod;
    if (cond) notes.push(...cond.notes);
    try {
    if (v.kind === 'boss') {
      const carry = cleanGear(v.carry);
      o = fightBoss(s, carry);
      wearGear(s, carry);
      s.lastBattle = { title: 'Đại chiến Thủy Tinh', o, seen: false };
      if (!o.boss?.wiped) {
        // trụ được hết trận: rút về, trang bị theo thuyền về nhà
        v.loot = {};
        v.win = false;
        v.phase = 've';
        notes.push(`Trụ vững trước Thủy Tinh, gây ${o.boss?.dmg ?? 0} sát thương vào máu chung. Thuyền đang rút về.`);
      } else {
        // thua: mất sạch trang bị mang theo, thuyền bị đánh chìm, người bơi về đảo
        sinkBoat(s);
        abortVoyage(s);
        notes.push(`Bị Thủy Tinh diệt sạch (gây ${o.boss?.dmg ?? 0} sát thương). Mất trang bị mang theo, thuyền bị đánh chìm.`);
        return notes;
      }
    } else if (v.kind === 'wild') {
      const w = wildOf(s, v.targetId);
      if (!w) {
        abortVoyage(s);
        return notes;
      }
      o = fightWild(s, w, true);
      reveal(s, [v.to], 2);
    } else if (v.kind === 'scout') {
      const n = reveal(s, [v.to], 4);
      o = { ok: true, msg: `Thám hiểm xong, mở thêm ${n} ô biển.`, gained: {} };
      v.loot = {};
      v.win = true;
      v.phase = 've';
      notes.push(`Thuyền đã tới ${v.targetName}: mở thêm ${n} ô biển.`);
    } else if (v.kind === 'isle') {
      const isle = isleById(worldFor(s.khu), v.targetId);
      if (!isle) {
        abortVoyage(s);
        return notes;
      }
      o = fightIsle(s, isle, v.isleDef);
    } else {
      o = raid(s, v.target!, true, !!v.conquer);
      if (o.event) s.outbox.push(o.event);
    }
    } finally {
      battleMod = undefined;
    }
    if (v.kind !== 'boss' && v.kind !== 'scout') {
      settleTroops(s, v, o.battle, notes);
      // thắng và cắm cờ đảo tự nhiên: quân còn lại đóng giữ đảo
      if (v.kind === 'isle' && o.battle?.winner === 0 && s.isles.some((x) => x.id === v.targetId) && v.troops && troopCount(v.troops)) {
        const g = (s.isleTroops[v.targetId] ??= {});
        let room = ISLE_HOUSE - troopCount(g);
        for (const k of TROOP_KEYS) {
          const n = Math.min(v.troops[k] ?? 0, Math.max(0, room));
          if (n > 0) {
            g[k] = (g[k] ?? 0) + n;
            v.troops[k] = (v.troops[k] ?? 0) - n;
            room -= n;
          }
        }
        notes.push('Quân còn lại ở lại giữ đảo vừa cắm cờ.');
      }
    }
    if (v.kind !== 'boss' && v.kind !== 'scout') wearGear(s, s.kho);
    if (v.kind !== 'scout') wearFleet(s);
    if (v.kind !== 'boss' && v.kind !== 'scout') {
      v.loot = o.gained ?? {};
      v.win = o.battle?.winner === 0;
      v.phase = 've';
      s.lastBattle = { title: v.kind === 'wild' ? `Trận ${v.targetName}` : `Đột kích ${v.targetName}`, o, seen: false };
      notes.push(`Thuyền đã cập ${v.targetName}: ${v.win ? 'thắng trận' : 'thua trận'}. Bấm "Xem trận".`);
      if (o.quest) notes.push(`Xong việc: ${o.quest}`);
    }
  }
  if (v.phase === 've' && s.gt >= v.returnAt) {
    voyageReturn(s, v);
    if (v.troops) for (const k of TROOP_KEYS) if (v.troops[k]) s.troops[k] = (s.troops[k] ?? 0) + (v.troops[k] ?? 0);
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
  | { t: 'sail'; kind: 'isle'; id: string; def?: IsleDef }
  | { t: 'sail'; kind: 'scout'; to: { x: number; y: number } }
  | { t: 'thuDao'; id: string }
  | { t: 'xayDao'; id: string; k: IsleBuild }
  | { t: 'boDao'; id: string }
  | { t: 'trong'; id: string; k: CropKey; slot?: number }
  | { t: 'gat'; id: string; slot?: number }
  | { t: 'nuoi'; id: string }
  | { t: 'thue'; id: string }
  | { t: 'thuNT'; id: string }
  | { t: 'hoc'; k: TechKey }
  | { t: 'suaDo' }
  | { t: 'suaThuyen' }
  | { t: 'dongTau'; k: ShipKind }
  | { t: 'lapVK'; id: string; w: ShipWeapon }
  | { t: 'phaTau'; id: string }
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
  | { t: 'herdBuy'; sp: Sp }
  | { t: 'herdUse'; id: string }
  | { t: 'egg'; use: 'food' | 'hatch' }
  | { t: 'bao'; k: PKey }
  | { t: 'banBQ' }
  | { t: 'banNL'; res: ResKey; n: number }
  | { t: 'fish'; how: FishHow }
  | { t: 'speed'; speed: number }
  | { t: 'quay'; n: 1 | 10 }
  | { t: 'chuTuong'; id: GenId | null }
  | { t: 'deo'; id: LegWeaponId | null }
  | { t: 'ghep'; id: GenId }
  | { t: 'doiLT'; dir: 'mua' | 'ban'; n: number }
  | { t: 'luyen'; k: TroopKey; n: number }
  | { t: 'mangQuan'; troops: Troops }
  | { t: 'rutQuan'; isle: string };

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
  boss?: { dmg: number; win: boolean; wiped?: boolean; form: string };
  /** kết quả vòng quay */
  spin?: SpinResult[];
  /** trận giữa hai người chơi (xem lại không được tua) */
  pvp?: boolean;
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
      const r = rngSecret(s);
      const got = addRes(s, rollChest(s, c.ci, r));
      s.stats.chests++;
      const q = doneQuest(s, 'q_chest');
      const drop = rareDrop(r, c.ci);
      if (drop) s.bag[drop] = (s.bag[drop] ?? 0) + 1;
      const lt = c.ci >= 4 ? dropLT(s, 'chest') : 0;
      return { ok: true, msg: `Mở ${CHESTS[c.ci].name}${drop ? `. Có ${ITEMS[drop].name}!` : ''}${lt ? ` Có ${lt} Linh Thạch!` : ''}`, gained: got, chest: c.ci, quest: q ?? undefined, item: drop ?? undefined };
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
        if (s.vo <= 0) return fail('Thuyền hư hỏng nặng. Sửa ở Bến Thuyền trước khi ra khơi.');
        s.voyage = { from: { x: bf.x, y: bf.y }, id: nid(s, 'v'), kind: 'boss', targetId: 'thuytinh', targetName: `Mắt Bão · ${form.name}`, to: { ...BOSS_CELL }, departAt: s.gt, arriveAt: s.gt + one, returnAt: s.gt + one * 2, phase: 'di', loot: {}, carry: want };
        provision(s, s.voyage, one);
        log(s, 'Thuyền vượt bão đi đánh Thủy Tinh.');
        return { ok: true, msg: `${LINH_VAT.thuyen.tiers[s.lv.thuyen.tier - 1]} vượt bão ra Mắt Bão. Sống chết có số!` };
      }
      let isleDef: IsleDef | undefined;
      if (a.kind === 'wild') {
        const w = wildOf(s, a.id);
        if (!w) return fail('Không có đảo này.');
        const st = s.wilds[w.id];
        if (st && s.gt < st.readyAt) return fail('Quái chưa kéo về đảo này.');
        to = wildCell(s, w.id);
        targetId = w.id;
        targetName = w.name;
      } else if (a.kind === 'isle') {
        const isle = isleById(worldFor(s.khu), a.id);
        if (!isle) return fail('Không có đảo này.');
        if (s.isles.some((o) => o.id === isle.id)) return fail('Đảo này đã cắm cờ của bạn.');
        to = { x: isle.c, y: isle.r };
        targetId = isle.id;
        targetName = isSeen(s, isle.c, isle.r) || isle.kind !== 'bian' ? isle.name : 'Đảo Bí Ẩn';
        if (a.def && a.def.owner !== s.id) s.shield = 0;
        if (a.def && a.def.owner !== s.id) isleDef = { owner: String(a.def.owner), ownerName: String(a.def.ownerName).slice(0, 24), don: Math.max(0, Math.min(3, Math.floor(a.def.don) || 0)), thap: Math.max(0, Math.min(3, Math.floor(a.def.thap) || 0)) };
      } else if (a.kind === 'scout') {
        const c = { x: Math.round(a.to.x), y: Math.round(a.to.y) };
        if (!inWorld(c.x, c.y)) return fail('Ngoài hải đồ.');
        to = c;
        targetId = `scout:${c.x},${c.y}`;
        targetName = `vùng biển (${c.x}, ${c.y})`;
      } else {
        const err = raidCheck(s, a.target) ?? (a.conquer ? conquerCheck(s, a.target) : null);
        if (err) return fail(err);
        s.shield = 0; // ra quân đánh người khác thì khiên vỡ
        to = { x: Math.round(a.to.x), y: Math.round(a.to.y) };
        targetId = a.target.id;
        targetName = a.target.islandName;
        target = a.target;
      }
      if (s.vo <= 0) return fail('Thuyền hư hỏng nặng. Sửa ở Bến Thuyền trước khi ra khơi.');
      const one = sailMs(s, to);
      const from = nearestBase(s, to);
      s.voyage = { id: nid(s, 'v'), kind: a.kind, targetId, targetName, target, to, from: { x: from.x, y: from.y }, departAt: s.gt, arriveAt: s.gt + one, returnAt: s.gt + one * 2, phase: 'di', loot: {}, conquer: a.kind === 'island' && !!a.conquer, isleDef };
      // đi tới đâu mở sương mù tới đó (dọc đường thấy được 1 ô hai bên)
      reveal(s, voyagePath(from, to), 1);
      provision(s, s.voyage, one);
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
      if (b.hidden) return fail('Công trình này đã được gộp vào Nhà Bếp và Vườn, không xây mới nữa.');
      if (s.lv.leu.tier < b.needLeu) return fail(`Cần Nhà chính bậc ${b.needLeu}.`);
      if (s.dinh.filter((d) => d.k === a.k).length >= b.max) return fail(`Đảo chỉ có chỗ cho ${b.max} ${b.names[0]}.`);
      if (!isLand(s, a.x, a.y) || occupied(s, a.x, a.y)) return fail('Ô này không xây được. Chọn ô đất trống.');
      if (busySlots(s) >= buildSlots(s)) return fail('Thợ đang bận hết. Chờ xây xong hoặc dùng Lệnh Bài Thủy Sư.');
      if (!canPay(s, b.cost[0])) return fail('Chưa đủ vật liệu.');
      pay(s, b.cost[0]);
      // chuồng/ao có sẵn 2 con giống, xưởng chế biến có sẵn 2 thợ
      s.dinh.push({ id: nid(s, 'd'), k: a.k, x: a.x, y: a.y, lv: 0, to: 1, doneAt: s.gt + b.ms[0], ...(a.k in PENS || a.k in PROCS ? { n: 2 } : {}) });
      return { ok: true, msg: `Bắt đầu xây ${b.names[0]}.` };
    }
    case 'nang': {
      const d = s.dinh.find((x) => x.id === a.id);
      if (!d) return fail('Không thấy công trình.');
      const b = BUILDINGS[d.k];
      if (d.doneAt !== undefined) return fail('Đang xây dở.');
      if (d.lv >= 3) return fail('Đã cấp cao nhất.');
      if (d.lv + 1 >= 3 && s.lv.leu.tier < LV3_TIER(b.needLeu)) return fail(`Cần Nhà chính bậc ${LV3_TIER(b.needLeu)} để lên cấp 3.`);
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
      if (s.res.tien < price) return fail('Không đủ đồng vàng.');
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
      if (a.item === 'khien8' && s.shield - s.lastReal > 16 * 3600_000) return fail('Khiên chỉ cộng dồn tối đa 24 giờ.');
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
      if (a.item === 'khien8') s.shield = Math.max(s.shield, s.lastReal) + 8 * 3600_000;
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
    case 'quay': {
      const n = a.n === 10 ? 10 : 1;
      // dùng lượt quay đã mua trước, thiếu thì trả bằng Linh Thạch
      const fromTickets = Math.min(n, s.luot);
      const rest = n - fromTickets;
      const cost = rest === 10 ? SPIN10_COST : rest * SPIN_COST;
      if (s.res.lt < cost) return fail(fromTickets ? `Còn ${fromTickets} lượt quay, cần thêm ${cost} Linh Thạch.` : `Cần ${cost} Linh Thạch để quay ${n} lần.`);
      s.luot -= fromTickets;
      s.res.lt -= cost;
      const r = rngSecret(s);
      const out: SpinResult[] = [];
      for (let i = 0; i < n; i++) out.push(spinOnce(s, r));
      const legs = out.filter((x) => x.leg).length;
      log(s, `Quay Vòng Vạn Linh ${n} lần${legs ? `: ra ${legs} đồ truyền thuyết!` : '.'}`);
      return { ok: true, msg: legs ? `Ra ${out.filter((x) => x.leg).map((x) => x.detail).join(', ')}!` : `Quay ${n} lần xong.`, spin: out };
    }
    case 'luyen': {
      const d = TROOPS[a.k as TroopKey];
      const n = Math.floor(a.n);
      if (!d || !(n >= 1 && n <= 20)) return fail('Số lượng không hợp lệ.');
      const site = isMech(a.k) ? 'xuongcg' : 'donbinh';
      const lvB = bLevel(s.dinh, site);
      if (!lvB) return fail(isMech(a.k) ? 'Cần xây Xưởng Cơ Giới để đóng quân cơ giới.' : 'Cần xây Trại Lính để luyện lính.');
      if (lvB < d.need) return fail(`${d.name} cần ${site === 'xuongcg' ? 'Xưởng Cơ Giới' : 'Trại Lính'} cấp ${d.need}.`);
      const cap = houseCap(bLevel(s.dinh, 'donbinh'), bLevel(s.dinh, 'xuongcg'));
      const have = troopCount(s.troops);
      if (have + n > cap) return fail(`Trại chỉ chứa ${cap} quân (đang có ${have}). Nâng Trại Lính hoặc Xưởng Cơ Giới.`);
      const cost = Object.fromEntries(Object.entries(d.cost).map(([r, v]) => [r, (v ?? 0) * n])) as Partial<Record<ResKey, number>>;
      if (!canPay(s, cost)) return fail('Chưa đủ vật liệu hoặc lương.');
      pay(s, cost);
      s.troops[a.k] = (s.troops[a.k] ?? 0) + n;
      return { ok: true, msg: `${isMech(a.k) ? 'Đóng' : 'Luyện'} ${n} ${d.name}.` };
    }
    case 'mangQuan': {
      s.mang = cleanTroops(a.troops);
      return { ok: true, msg: `Mang theo ${troopCount(s.mang)} quân mỗi chuyến.` };
    }
    case 'rutQuan': {
      const g = s.isleTroops[a.isle];
      if (!g || !troopCount(g)) return fail('Đảo này không có quân đóng.');
      if (s.voyage) return fail('Thuyền đang ngoài khơi, chờ về bến rồi hãy rút quân.');
      for (const k of TROOP_KEYS) if (g[k]) s.troops[k] = (s.troops[k] ?? 0) + (g[k] ?? 0);
      delete s.isleTroops[a.isle];
      return { ok: true, msg: 'Đã rút quân về đảo nhà.' };
    }
    case 'chuTuong': {
      if (a.id === null) {
        s.chuTuong = null;
        return { ok: true, msg: 'Đội ra trận không có chủ tướng.' };
      }
      if (!GENERALS[a.id] || !s.tuong[a.id]) return fail('Chưa có tướng này.');
      s.chuTuong = a.id;
      return { ok: true, msg: `${GENERALS[a.id].name} làm chủ tướng.` };
    }
    case 'deo': {
      if (a.id === null) {
        s.deo = null;
        return { ok: true, msg: 'Đã tháo vũ khí.' };
      }
      if (!LEG_WEAPONS[a.id] || !(s.vuKhi[a.id] ?? 0)) return fail('Chưa có vũ khí này.');
      s.deo = a.id;
      return { ok: true, msg: `Chủ tướng đeo ${LEG_WEAPONS[a.id].name}.` };
    }
    case 'ghep': {
      const g = GENERALS[a.id];
      if (!g || g.rarity !== 'Truyền Thuyết') return fail('Chỉ ghép được tướng truyền thuyết.');
      if (s.manh < FRAG_PER_GENERAL) return fail(`Cần ${FRAG_PER_GENERAL} mảnh tướng truyền thuyết.`);
      s.manh -= FRAG_PER_GENERAL;
      return { ok: true, msg: addGeneral(s, a.id) };
    }
    case 'doiLT': {
      const n = Math.floor(a.n);
      if (!(n >= 1 && n <= 10_000)) return fail('Số lượng không hợp lệ.');
      if (a.dir === 'mua') {
        const day = dayOf(s.lastReal);
        if (s.ltDay.day !== day) s.ltDay = { day, n: 0 };
        if (s.ltDay.n + n > LT_BUY_DAILY) return fail(`Mỗi ngày chỉ đổi được ${LT_BUY_DAILY} Linh Thạch (còn ${LT_BUY_DAILY - s.ltDay.n}).`);
        const price = n * LT_BUY_PRICE;
        if (s.res.tien < price) return fail(`Cần ${price} đồng vàng.`);
        s.res.tien -= price;
        s.res.lt += n;
        s.ltDay.n += n;
        return { ok: true, msg: `Đổi ${price} đồng vàng lấy ${n} Linh Thạch.` };
      }
      if (s.res.lt < n) return fail('Không đủ Linh Thạch.');
      s.res.lt -= n;
      s.res.tien += n * LT_SELL_PRICE;
      return { ok: true, msg: `Bán ${n} Linh Thạch được ${n * LT_SELL_PRICE} đồng vàng.` };
    }
    case 'thuDao': {
      const o = s.isles.find((x) => x.id === a.id);
      const isle = o && isleById(worldFor(s.khu), o.id);
      if (!o || !isle) return fail('Đảo này không thuộc chủ quyền của bạn.');
      const got = isleReady(isle, o, s.lastReal);
      if (!Object.keys(got).length) return fail('Đảo chưa có gì để thu.');
      o.last = s.lastReal;
      const added = addRes(s, got);
      return { ok: true, msg: `Thu hoạch ${isle.name}.`, gained: added };
    }
    case 'xayDao': {
      const o = s.isles.find((x) => x.id === a.id);
      const isle = o && isleById(worldFor(s.khu), o.id);
      const b = ISLE_BUILD[a.k];
      if (!o || !isle || !b) return fail('Đảo này không thuộc chủ quyền của bạn.');
      const lvl = lordLevel(s);
      if (lvl < isle.needLvl) return fail(`Cần cấp chúa đảo ${isle.needLvl} mới xây được trên ${isle.name}.`);
      if (o[a.k] >= 3) return fail('Đã cấp cao nhất.');
      const cost = b.cost(o[a.k] + 1, isle.lv);
      if (!canPay(s, cost)) return fail('Chưa đủ vật liệu.');
      pay(s, cost);
      o[a.k]++;
      if (a.k === 'thap') reveal(s, [{ x: isle.c, y: isle.r }], 3 + o.thap * 2);
      return { ok: true, msg: `${b.name} trên ${isle.name} lên cấp ${o[a.k]}.` };
    }
    case 'boDao': {
      const i = s.isles.findIndex((x) => x.id === a.id);
      if (i < 0) return fail('Đảo này không thuộc chủ quyền của bạn.');
      s.isles.splice(i, 1);
      s.claims.push({ isle: a.id, win: false, at: s.lastReal });
      return { ok: true, msg: 'Đã nhổ cờ, bỏ đảo.' };
    }
    case 'trong': {
      const d = s.dinh.find((x) => x.id === a.id);
      if (!d || d.lv < 1 || d.doneAt !== undefined) return fail('Ruộng chưa xây xong.');
      if (!cropsFor(d.k).includes(a.k)) return fail('Không trồng được cây này ở đây.');
      const plots = plotsOf(d);
      const c = CROPS[a.k];
      const seed = plotSeed(c);
      // trồng một ô (chạm ô trống) hoặc gieo hết các ô trống
      const want = a.slot !== undefined ? [a.slot] : plots.map((p, i) => (p ? -1 : i)).filter((i) => i >= 0);
      if (!want.length) return fail('Không còn ô trống.');
      let n = 0;
      for (const i of want) {
        if (i < 0 || i >= plots.length || plots[i]) continue;
        if (!canPay(s, seed)) break;
        pay(s, seed);
        plots[i] = { k: a.k, at: s.lastReal };
        n++;
      }
      d.plots = plots;
      if (!n) return fail(a.slot !== undefined && plots[a.slot] ? 'Ô này đang có cây.' : 'Không đủ tiền mua giống.');
      return { ok: true, msg: `Đã trồng ${c.name} ở ${n} ô.` };
    }
    case 'gat': {
      const d = s.dinh.find((x) => x.id === a.id);
      if (!d) return fail('Chưa trồng gì.');
      const plots = plotsOf(d);
      const idx = a.slot !== undefined ? [a.slot] : plots.map((_, i) => i);
      const got: Partial<Record<ResKey, number>> = {};
      let n = 0, over = 0, storms = 0, unripe = 0;
      for (const i of idx) {
        const st = plotState(s, d, i);
        if (!st) continue;
        if (!st.ripe) {
          unripe++;
          continue;
        }
        got[st.out] = (got[st.out] ?? 0) + st.n;
        plots[i] = null;
        n++;
        if (st.over) over++;
        if (st.storms) storms++;
      }
      d.plots = plots;
      d.crop = undefined;
      if (!n) return fail(unripe ? 'Chưa có ô nào chín.' : 'Chưa trồng gì.');
      const gained = addRes(s, got);
      return { ok: true, msg: `Gặt ${n} ô: ${Object.entries(got).map(([k, v]) => `${v} ${RES[k as ResKey].name}`).join(', ')}${over ? ' (có ô để quá lâu, hỏng một nửa)' : storms ? ' (bão làm dập mất một phần)' : ''}.`, gained };
    }
    case 'nuoi': {
      const d = s.dinh.find((x) => x.id === a.id);
      if (!d || d.lv < 1 || !(d.k in PENS)) return fail('Chỉ thả giống ở chuồng hoặc ao.');
      const P = PENS[d.k as keyof typeof PENS];
      if (unitsOf(d) >= slotsOf(d.lv)) return fail(`Đã đủ ${slotsOf(d.lv)} ô. Nâng cấp để có thêm ô.`);
      if (!canPay(s, P.buy)) return fail(`Chưa đủ tiền mua ${P.animal}.`);
      // thu sản phẩm đang có trước khi đổi số con (để tính đúng)
      settleProd(s, d);
      pay(s, P.buy);
      d.n = unitsOf(d) + 1;
      return { ok: true, msg: `Thả thêm 1 ${P.animal} (${d.n}/${slotsOf(d.lv)}).` };
    }
    case 'thue': {
      const d = s.dinh.find((x) => x.id === a.id);
      if (!d || d.lv < 1 || !(d.k in PROCS)) return fail('Chỉ thuê thợ ở xưởng chế biến.');
      if (unitsOf(d) >= slotsOf(d.lv)) return fail(`Đã đủ ${slotsOf(d.lv)} thợ. Nâng cấp để có thêm chỗ.`);
      if (!canPay(s, HIRE_COST)) return fail('Chưa đủ tiền thuê thợ.');
      settleProd(s, d);
      pay(s, HIRE_COST);
      d.n = unitsOf(d) + 1;
      return { ok: true, msg: `Thuê thêm 1 thợ (${d.n}/${slotsOf(d.lv)}).` };
    }
    case 'thuNT': {
      const d = s.dinh.find((x) => x.id === a.id);
      if (!d || d.lv < 1) return fail('Công trình chưa xây xong.');
      const pnd = pending(s, d);
      if (!Object.values(pnd.give).some((v) => (v ?? 0) > 0)) return fail(Object.keys(pnd.take).length ? 'Thiếu nguyên liệu hoặc thức ăn.' : 'Chưa có gì để thu.');
      for (const [k, v] of Object.entries(pnd.take)) s.res[k as ResKey] = Math.max(0, s.res[k as ResKey] - (v ?? 0));
      const got = addRes(s, pnd.give);
      d.last = s.lastReal;
      return { ok: true, msg: `Thu ${BUILDINGS[d.k].names[Math.max(0, d.lv - 1)]}.`, gained: got };
    }
    case 'hoc': {
      const T = TECHS[a.k];
      const hv = bLevel(s.dinh, 'hocvien');
      if (!T) return fail('Không có môn này.');
      if (!hv) return fail('Cần xây Học Viện.');
      if (s.research) return fail(`Đang nghiên cứu ${TECHS[s.research.k].name}.`);
      const to = (s.tech[a.k] ?? 0) + 1;
      if (to > TECH_MAX) return fail('Đã nghiên cứu tới cấp cao nhất.');
      if (to > hv) return fail(`Cần Học Viện cấp ${to}.`);
      const cost = techCost(to);
      if (!canPay(s, cost)) return fail('Chưa đủ vật liệu.');
      pay(s, cost);
      s.research = { k: a.k, to, end: s.gt + techMs(to) };
      return { ok: true, msg: `Bắt đầu nghiên cứu ${T.name} cấp ${to}.` };
    }
    case 'suaDo': {
      if (!bLevel(s.dinh, 'xuongren')) return fail('Cần Lò Rèn để sửa trang bị.');
      const k = 1 - 0.2 * (s.tech.renSat ?? 0);
      const cost: Partial<Record<ResKey, number>> = {};
      for (const g of GEAR_KEYS) {
        const miss = (100 - s.ben[g]) * s.kho[g];
        if (miss <= 0) continue;
        cost.sat = (cost.sat ?? 0) + Math.ceil(miss * 0.35 * k);
        cost.go = (cost.go ?? 0) + Math.ceil(miss * 0.25 * k);
      }
      if (!Object.keys(cost).length) return fail('Trang bị còn nguyên.');
      if (!canPay(s, cost)) return fail('Chưa đủ sắt, gỗ để sửa.');
      pay(s, cost);
      for (const g of GEAR_KEYS) s.ben[g] = 100;
      return { ok: true, msg: 'Lò rèn đã sửa xong toàn bộ trang bị.' };
    }
    case 'suaThuyen': {
      if (!bLevel(s.dinh, 'benthuyen')) return fail('Cần Bến Thuyền để sửa thuyền.');
      if (s.voyage) return fail('Thuyền đang ngoài khơi.');
      const cost = repairCost(s);
      if (!cost) return fail('Thuyền còn nguyên.');
      if (!canPay(s, cost)) return fail('Chưa đủ gỗ, vải buồm để sửa.');
      pay(s, cost);
      s.vo = 100;
      for (const sh of s.fleet) sh.vo = 100;
      return { ok: true, msg: 'Thuyền và hạm đội đã được sửa, vá buồm xong.' };
    }
    case 'dongTau': {
      const d = SHIPS[a.k];
      const bt = bLevel(s.dinh, 'benthuyen');
      if (!d) return fail('Không có loại thuyền này.');
      if (bt < d.need) return fail(`Cần Xưởng Đóng Tàu cấp ${d.need}.`);
      if (berthsUsed(s.fleet) + (SHIP_SIZE[a.k] ?? 2) > fleetCap(bt)) return fail(`Bến chỉ còn ${fleetCap(bt) - berthsUsed(s.fleet)}/${fleetCap(bt)} chỗ neo, ${d.name} cần ${SHIP_SIZE[a.k]} chỗ. Nâng Xưởng Đóng Tàu để thêm chỗ.`);
      if (!canPay(s, d.cost)) return fail('Chưa đủ vật liệu đóng thuyền.');
      pay(s, d.cost);
      s.fleet.push({ id: nid(s, 't'), k: a.k, w: {}, vo: 100 });
      return { ok: true, msg: `Hạ thủy ${d.name}!` };
    }
    case 'lapVK': {
      const sh = s.fleet.find((x) => x.id === a.id);
      const W = WEAPONS[a.w];
      if (!sh || !W) return fail('Không có thuyền này.');
      if (sh.w[a.w]) return fail('Đã lắp rồi.');
      if (Object.values(sh.w).filter(Boolean).length >= (sh.k === 'chien' ? 3 : sh.k === 'buom' ? 2 : 1)) return fail('Thuyền này không còn chỗ lắp vũ khí.');
      if (!canPay(s, W.cost)) return fail('Chưa đủ vật liệu.');
      pay(s, W.cost);
      sh.w[a.w] = true;
      return { ok: true, msg: `Lắp ${W.name} lên ${SHIPS[sh.k].name}.` };
    }
    case 'phaTau': {
      const i = s.fleet.findIndex((x) => x.id === a.id);
      if (i < 0) return fail('Không có thuyền này.');
      s.fleet.splice(i, 1);
      return { ok: true, msg: 'Đã tháo dỡ thuyền.' };
    }
    case 'herdBuy': {
      const D = SPECIES[a.sp];
      if (!D) return fail('Không có giống này.');
      if (s.soc.herd.length >= herdCap(s)) return fail(`Chuồng đã đủ ${herdCap(s)} con. Xây thêm chuồng hoặc nâng cấp.`);
      if (s.res.tien < D.buy) return fail(`Cần ${D.buy} đồng mua ${D.stages[0][0].toLowerCase()}.`);
      s.res.tien -= D.buy;
      s.soc.herd.push({ id: 'a' + s.soc.nid++, sp: a.sp, born: s.gt });
      return { ok: true, msg: `Mua 1 ${D.stages[0][0].toLowerCase()}. Phải nuôi lớn qua ${D.stages.length} giai đoạn.` };
    }
    case 'herdUse': {
      const i = s.soc.herd.findIndex((x) => x.id === a.id);
      if (i < 0) return fail('Không thấy con vật này.');
      const an = s.soc.herd[i];
      if (!isAdult(an, s.gt)) return fail('Còn nhỏ, chưa dùng được. Cần nuôi thêm.');
      if (an.sp !== 'lon') return fail(`${SPECIES[an.sp].name} nuôi để ${SPECIES[an.sp].use}, không mổ.`);
      s.soc.herd.splice(i, 1);
      s.res.thit = Math.min(storageCap(s), s.res.thit + SELL_MEAT);
      return { ok: true, msg: `Mổ lợn được ${SELL_MEAT} thịt. Thịt tươi chóng hỏng, hãy muối hoặc ăn sớm.` };
    }
    case 'egg': {
      const n = Math.floor(s.soc.eggs);
      if (n < 1) return fail('Chưa có trứng.');
      if (a.use === 'food') {
        s.soc.eggs = 0;
        s.res.trung = Math.min(storageCap(s), s.res.trung + n);
        return { ok: true, msg: `Nhặt ${n} trứng làm thức ăn.` };
      }
      if (n < HATCH_EGGS) return fail(`Cần ${HATCH_EGGS} trứng để ấp.`);
      if (s.soc.herd.length >= herdCap(s)) return fail('Chuồng đã đầy, chưa có chỗ cho gà con.');
      s.soc.eggs -= HATCH_EGGS;
      s.soc.herd.push({ id: 'a' + s.soc.nid++, sp: 'ga', born: s.gt });
      return { ok: true, msg: `Ấp ${HATCH_EGGS} trứng nở 1 gà con.` };
    }
    case 'bao': {
      const k = a.k;
      if (!(k in PRESERVED)) return fail('Không chế biến được.');
      const have = k === 'sua' ? Math.floor(s.soc.sua) : Math.floor(s.res[k]);
      if (have < 2) return fail('Cần ít nhất 2 phần để chế biến.');
      const la = Math.ceil(have / WRAP_PER_LA);
      if (s.res.la < la) return fail(`Cần ${la} lá để gói ${have} phần.`);
      s.res.la -= la;
      if (k === 'sua') s.soc.sua -= have;
      else s.res[k] -= have;
      const out = Math.max(1, Math.floor(have * PRES_YIELD));
      s.soc.kho[k] = (s.soc.kho[k] ?? 0) + out;
      return { ok: true, msg: `${PRESERVED[k]}: ${out} phần, không bị hỏng.` };
    }
    case 'banNL': {
      const price = SELL_PRICE[a.res];
      const n = Math.floor(a.n);
      if (!price) return fail('Sạp chợ không thu mua thứ này.');
      if (!(n >= 1) || s.res[a.res] < n) return fail('Không đủ để bán.');
      const get = Math.floor(n * price * (1 + SELL_CHO_BONUS * bLevel(s.dinh, 'cho')));
      if (get < 1) return fail('Bán nhiều hơn một chút mới được 1 đồng.');
      s.res[a.res] -= n;
      s.res.tien += get;
      return { ok: true, msg: `Bán ${n} ${RES[a.res].name} được ${get} đồng.` };
    }
    case 'banBQ': {
      let n = 0;
      for (const v of Object.values(s.soc.kho)) n += v ?? 0;
      if (n < 1) return fail('Chưa có đồ chế biến để bán.');
      s.soc.kho = {};
      s.res.tien += n * PRES_PRICE;
      return { ok: true, msg: `Bán ${n} phần đồ chế biến được ${n * PRES_PRICE} đồng.` };
    }
    case 'fish': {
      const F = FISH[a.how];
      if (!F) return fail('Cách câu này chưa có.');
      const last = s.soc.fishAt[a.how];
      if (last !== undefined && s.gt - last < F.cd) return fail(`${F.name}: chưa tới lượt, còn ${Math.ceil((F.cd - (s.gt - last)) / 60_000)} phút.`);
      const ben = bLevel(s.dinh, 'benthuyen');
      if (a.how !== 'can' && ben < 1) return fail('Cần Bến thuyền để giăng lưới hoặc ra khơi.');
      if (a.how === 'thuyen' && !s.fleet.some((x) => x.k === 'ghe')) return fail('Cần một chiếc ghe đậu ở bến.');
      s.soc.fishAt[a.how] = s.gt;
      const n = F.ca * (1 + 0.25 * Math.max(0, ben - 1));
      s.res.ca = Math.min(storageCap(s), s.res.ca + n);
      return { ok: true, msg: `${F.name}: được ${n} cá. Cá tươi chóng hỏng, hãy làm cá khô.` };
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
    const lt = dropLT(s, 'wild');
    return { ok: true, msg: `Thắng ${w.name}!${dropChest ? ' Có rơi hòm.' : ''}${lt ? ` Nhặt ${lt} Linh Thạch.` : ''}`, battle, gained: got, levelUps: ups, chest: dropChest ? w.chest : undefined, quest: q ?? undefined };
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
  boss?: { week: number; best: number; won: boolean; total?: number };
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
  /** chủ tướng giữ đảo */
  gen?: { id: GenId; star: number; w: LegWeaponId | null };
  /** ô đảo nhà trên hải đồ */
  home?: { x: number; y: number };
  /** quân giữ đảo nhà */
  troops?: Troops;
  /** thuyền chiến giữ bến */
  ships?: { k: ShipKind; w: Partial<Record<ShipWeapon, boolean>>; vo: number }[];
  /** khiên bảo hộ tới lúc này: ẩn bên trong đảo */
  shield?: number;
  /** cấp chúa đảo */
  lvl?: number;
}

export function publicOf(s: PlayerState): IslandPub {
  const prot = protectAmt(s);
  const lootable: Partial<Record<ResKey, number>> = {};
  for (const k of RES_KEYS) {
    if (k === 'ngoc') continue;
    const v = Math.max(0, s.res[k] - prot);
    if (v > 0) lootable[k] = v;
  }
  const shielded = (s.shield ?? 0) > s.lastReal;
  return {
    id: s.id,
    name: s.name,
    islandName: s.islandName,
    shield: shielded ? s.shield : undefined,
    power: power(s),
    title: titleFor(s),
    land: landCount(s),
    tiers: { leu: s.lv.leu.tier, cuoc: s.lv.cuoc.tier, rao: s.lv.rao.tier, thuyen: s.lv.thuyen.tier },
    team: shielded ? [] : teamSpec(s, false).comps,
    lootable: shielded ? {} : lootable,
    updatedAt: Date.now(),
    avatar: s.avatar,
    gear: { ...s.kho },
    boss: { week: s.boss.week, best: s.boss.best, won: s.boss.won, total: s.boss.total },
    asc: s.asc,
    def: defSpecOf(s.dinh),
    fort: fortLevel(s.dinh),
    port: bLevel(s.dinh, 'tramthue'),
    lord: s.chuQuan && s.chuQuan.until > s.lastReal ? { id: s.chuQuan.id, name: s.chuQuan.name } : null,
    vassals: s.chuHau.length,
    guild: s.guild?.tag,
    gen: teamSpec(s, true).gen,
    home: s.home ?? undefined,
    lvl: lordLevel(s),
    ships: shielded ? undefined : s.fleet.filter((x) => x.vo > 0).map((x) => ({ k: x.k, w: { ...x.w }, vo: x.vo })),
    troops: shielded ? undefined : cleanTroops(s.troops),
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
  const defSpec: TeamSpec = { comps: target.team, cuocTier: target.tiers.cuoc, raoTier: target.tiers.rao, hero: target.name, gear: gearBonus(target.gear), fort: target.bot ? undefined : cleanDef(target.def), gen: cleanGen(target.gen), ships: target.bot ? undefined : cleanShips(target.ships), troops: target.bot ? undefined : cleanTroops(target.troops) };
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
  if (!target.bot && (target.shield ?? 0) > s.lastReal) return 'Đảo đang có khiên bảo hộ.';
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
    const lt = dropLT(s, 'conquer');
    if (lt) log(s, `Nhặt được ${lt} Linh Thạch trên đảo vừa chiếm.`);
  }
  return {
    ok: true,
    msg: win ? `Đột kích thành công ${target.islandName}!` : `${target.islandName} giữ đảo thành công.`,
    battle,
    pvp: !target.bot,
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
  // vừa bị cướp: được che chở 2 giờ cho khỏi bị đánh hội đồng
  s.shield = Math.max(s.shield ?? 0, s.lastReal + 2 * 3600_000);
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
  const parts = [s.rngN, s.seq, landCount(s), ...RES_KEYS.filter((k) => k !== 'tien' && k !== 'lt').map((k) => s.res[k]), ...LV_KEYS.map((k) => `${s.lv[k].tier}:${s.lv[k].xp}`), s.builds.length, s.voyage?.id ?? '-', s.chests.length, troopCount(s.troops)];
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
  merged.boss = { ...fresh.boss, ...s.boss };
  if (!Array.isArray(merged.bossOut)) merged.bossOut = [];
  merged.gacha = { ...fresh.gacha, ...s.gacha };
  if (!Array.isArray(merged.isles)) merged.isles = [];
  if (!Array.isArray(merged.claims)) merged.claims = [];
  if (typeof merged.seen !== 'string') merged.seen = '';
  merged.ben = { ...fresh.ben, ...s.ben };
  if (typeof merged.shield !== 'number') merged.shield = 0;
  if (!Array.isArray(merged.fleet)) merged.fleet = [];
  merged.troops = cleanTroops(s.troops);
  merged.mang = cleanTroops(s.mang);
  merged.isleTroops = Object.fromEntries(Object.entries(s.isleTroops ?? {}).map(([k, v]) => [k, cleanTroops(v)]));
  merged.tech = { ...s.tech };
  if (typeof merged.vo !== 'number') merged.vo = 100;
  merged.ltDay = { ...fresh.ltDay, ...s.ltDay };
  // gộp tài nguyên (spec 012): tơ → vải (2:1), thảo dược → thuốc (3:1)
  if (merged.res.to > 0) {
    merged.res.vai += Math.floor(merged.res.to / 2);
    merged.res.to = 0;
  }
  if (merged.res.thaoduoc > 0) {
    merged.res.duoc += Math.floor(merged.res.thaoduoc / 3);
    merged.res.thaoduoc = 0;
  }
  merged.comps = { ...fresh.comps, ...s.comps };
  merged.soc = { ...newSociety(), ...(s.soc ?? {}) } as Society;
  // hải đồ mở rộng (hơn 1 triệu ô): toạ độ cũ không còn đúng → dời đảo tới vành ngoài mới, khám phá lại
  if (merged.wv !== WORLD_VERSION) {
    merged.wv = WORLD_VERSION;
    merged.home = null;
    merged.seen = '';
    merged.isles = [];
    merged.claims = [];
  }
  // công trình cũ: chuồng/ao/xưởng đã có thì cho đủ ô; ruộng một cây cả ruộng → ô đầu
  for (const d of merged.dinh ?? []) {
    if ((d.k in PENS || d.k in PROCS) && d.n === undefined) d.n = slotsOf(Math.max(1, d.lv));
    if (d.crop && !d.plots) {
      d.plots = plotsOf(d);
      d.crop = undefined;
    }
  }
  // đảo cũ nhỏ hơn 48 ô: nới thêm đất theo đúng dáng đảo (không mất gì)
  if (landCount(merged) < START_LAND) growLand(merged, START_LAND);
  return merged;
}

/** Mở thêm ô đất sát bờ cho tới khi đủ n ô (theo mã đảo, client và server ra giống nhau). */
function growLand(s: PlayerState, n: number) {
  const r = mulberry32(hashStr(`grow:${s.id}`));
  let guard = 0;
  while (landCount(s) < n && guard++ < 400) {
    const front: [number, number][] = [];
    for (let y = 2; y < GRID - 2; y++)
      for (let x = 2; x < GRID - 2; x++) {
        if (isLand(s, x, y)) continue;
        let nb = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (isLand(s, x + dx, y + dy)) nb++;
        if (nb) for (let k = 0; k < nb * nb; k++) front.push([x, y]);
      }
    if (!front.length) break;
    const [x, y] = front[Math.floor(r() * front.length)];
    setLand(s, x, y);
  }
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
  } else if (g === 'luot') s.luot = (s.luot ?? 0) + n;
  else if (g in ITEMS) s.bag[g as ItemKey] = (s.bag[g as ItemKey] ?? 0) + n;
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


// ---------- tướng, vòng quay, Linh Thạch ----------
export interface SpinResult {
  slot: string;
  label: string;
  detail: string;
  leg: boolean;
  /** mã tướng hoặc vũ khí trúng (để hiện đúng hình) */
  id?: string;
}

/** Nhận một tướng: chưa có thì 1 sao, có rồi thì lên sao, đủ 5 sao thì đổi ra mảnh. */
export function addGeneral(s: PlayerState, id: GenId): string {
  const g = GENERALS[id];
  const cur = s.tuong[id] ?? 0;
  if (!cur) {
    s.tuong[id] = 1;
    if (!s.chuTuong) s.chuTuong = id;
    return `${g.name} (${g.rarity}) gia nhập!`;
  }
  if (cur < MAX_STAR) {
    s.tuong[id] = cur + 1;
    return `${g.name} lên ${cur + 1} sao!`;
  }
  s.manh += DUP_FRAGS;
  return `${g.name} đã đủ 5 sao: đổi thành ${DUP_FRAGS} mảnh tướng.`;
}

function spinOnce(s: PlayerState, r: Rng): SpinResult {
  const slot = rollWheel(r, s.gacha.pity);
  s.gacha.spins++;
  s.gacha.pity = slot.leg ? 0 : s.gacha.pity + 1;
  const p = slot.prize;
  let detail = slot.label;
  let got: string | undefined;
  if (p.k === 'gen') {
    const pool = GEN_IDS.filter((id) => GENERALS[id].rarity === (p.pool as Rarity));
    const id = pick(r, pool);
    detail = addGeneral(s, id);
    got = id;
  } else if (p.k === 'weapon') {
    const id = pick(r, LEG_IDS);
    s.vuKhi[id] = (s.vuKhi[id] ?? 0) + 1;
    if (!s.deo) s.deo = id;
    detail = LEG_WEAPONS[id].name;
    got = id;
  } else if (p.k === 'frag') {
    s.manh += p.n;
  } else if (p.k === 'item') {
    s.bag[p.item] = (s.bag[p.item] ?? 0) + p.n;
  } else {
    // quà từ vòng quay không bị giới hạn kho
    for (const [k, v] of Object.entries(p.res)) s.res[k as ResKey] += v ?? 0;
  }
  return { slot: slot.id, label: slot.label, detail, leg: !!slot.leg, id: got };
}

/** Sức mạnh cộng thêm từ tướng và vũ khí truyền thuyết. */
export function genPower(s: PlayerState): number {
  let p = 0;
  for (const id of GEN_IDS) {
    const st = s.tuong[id];
    if (!st) continue;
    const base = GENERALS[id].rarity === 'Truyền Thuyết' ? 120 : GENERALS[id].rarity === 'Sử Thi' ? 80 : 50;
    p += Math.round(base * starMult(st));
  }
  for (const id of LEG_IDS) p += 60 * Math.min(1, s.vuKhi[id] ?? 0);
  return p;
}

/** Kiểm tra chủ tướng trong dữ liệu công khai (không tin dữ liệu lạ). */
export function cleanGen(raw: unknown): TeamSpec['gen'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const g = raw as { id?: unknown; star?: unknown; w?: unknown };
  if (typeof g.id !== 'string' || !(g.id in GENERALS)) return undefined;
  const star = Math.max(1, Math.min(MAX_STAR, Math.floor(Number(g.star)) || 1));
  const w = typeof g.w === 'string' && g.w in LEG_WEAPONS ? (g.w as LegWeaponId) : null;
  return { id: g.id as GenId, star, w };
}

/** Linh Thạch rơi thêm sau trận (chiếm đảo, hang quái, hòm báu). */
export function dropLT(s: PlayerState, kind: 'conquer' | 'bian' | 'wild' | 'chest'): number {
  const n = ltDrop(rngSecret(s), kind);
  if (n > 0) s.res.lt += n;
  return n;
}


// ---------- hải đồ lục giác: khám phá, chủ quyền đảo ----------
/** Đảo tự nhiên đã cắm cờ: công trình trên đảo và lần thu hoạch cuối. */
export interface OwnedIsle {
  id: string;
  since: number;
  /** lần thu sản lượng gần nhất (giờ thật) */
  last: number;
  /** Xưởng khai thác: +50% sản lượng mỗi cấp */
  mo: number;
  /** Đồn tiền tiêu: thành cứ điểm xuất phát, thêm lính giữ đảo */
  don: number;
  /** Tháp canh: nhìn xa hơn, thêm xạ thủ giữ đảo */
  thap: number;
}
/** Sức giữ của một đảo đã có chủ (lấy lúc ra khơi). */
export interface IsleDef {
  owner: string;
  ownerName: string;
  don: number;
  thap: number;
}

/** Khoảng cách hai ô trên hải đồ lục giác. */
export const cellDist = (a: { x: number; y: number }, b: { x: number; y: number }) => hexDist({ c: a.x, r: a.y }, { c: b.x, r: b.y });

/** Cấp chúa đảo 1..30 theo sức mạnh. */
export const lordLevel = (s: PlayerState) => Math.max(1, Math.min(30, 1 + Math.floor((power(s) - 100) / 90)));
/** Số đảo tự nhiên giữ được. */
export const isleCap = (s: PlayerState) => 1 + Math.floor(lordLevel(s) / 3);

// --- sương mù: hải đồ hơn 1 triệu ô nên chỉ lưu những khoang 32x32 ô đã khám phá ---
// Dạng chuỗi: "khoang:base64;khoang:base64" (khoang = hàng * số khoang mỗi hàng + cột).
const FC = 32;
const NFC = Math.ceil(WORLD_W / FC);
export type SeenMap = Map<number, Uint8Array>;
function seenParse(str: string): SeenMap {
  const m: SeenMap = new Map();
  if (!str || !str.includes(':')) return m; // rỗng hoặc dạng cũ (hải đồ nhỏ): coi như chưa khám phá
  for (const part of str.split(';')) {
    const k = part.indexOf(':');
    if (k < 1) continue;
    const id = Number(part.slice(0, k));
    try {
      const bin = atob(part.slice(k + 1));
      const b = new Uint8Array((FC * FC) / 8);
      for (let i = 0; i < Math.min(bin.length, b.length); i++) b[i] = bin.charCodeAt(i);
      m.set(id, b);
    } catch {
      /* khoang hỏng: bỏ qua */
    }
  }
  return m;
}
let seenMemoKey = '';
let seenMemo: SeenMap = new Map();
/** Sương mù của người chơi (đọc chung, không được sửa trực tiếp). */
export function seenOf(s: PlayerState): SeenMap {
  if (s.seen !== seenMemoKey) {
    seenMemo = seenParse(s.seen);
    seenMemoKey = s.seen;
  }
  return seenMemo;
}
function seenSave(s: PlayerState, m: SeenMap) {
  const parts: string[] = [];
  for (const id of [...m.keys()].sort((a, b) => a - b)) {
    const b = m.get(id)!;
    let bin = '';
    for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
    parts.push(`${id}:${btoa(bin)}`);
  }
  s.seen = parts.join(';');
}
export function isSeen(s: PlayerState, c: number, r: number, m?: SeenMap): boolean {
  if (!inWorld(c, r)) return false;
  const b = (m ?? seenOf(s)).get(Math.floor(r / FC) * NFC + Math.floor(c / FC));
  if (!b) return false;
  const i = (r % FC) * FC + (c % FC);
  return (b[i >> 3] & (1 << (i & 7))) !== 0;
}
/** Khoang 32x32 nào đã có ít nhất một ô khám phá (để vẽ bản đồ thu nhỏ). */
export const seenChunks = (s: PlayerState) => [...seenOf(s).keys()].map((id) => ({ cx: id % NFC, cy: Math.floor(id / NFC), size: FC }));
/** Mở sương mù quanh các ô (bán kính k). */
export function reveal(s: PlayerState, cells: { x: number; y: number }[], k: number): number {
  const m = seenParse(s.seen); // bản riêng để sửa
  let n = 0;
  for (const cell of cells)
    for (const h of hexRange({ c: cell.x, r: cell.y }, k)) {
      if (!inWorld(h.c, h.r)) continue;
      const id = Math.floor(h.r / FC) * NFC + Math.floor(h.c / FC);
      let b = m.get(id);
      if (!b) {
        b = new Uint8Array((FC * FC) / 8);
        m.set(id, b);
      }
      const i = (h.r % FC) * FC + (h.c % FC);
      if (!(b[i >> 3] & (1 << (i & 7)))) {
        b[i >> 3] |= 1 << (i & 7);
        n++;
      }
    }
  if (n) seenSave(s, m);
  return n;
}
/** Tầm nhìn của đảo nhà theo tháp canh. */
export const homeVision = (s: PlayerState) => 5 + bLevel(s.dinh, 'thapcanh');

/** Ô của hang quái riêng quanh đảo nhà (đảo luyện quân của người mới). */
const WILD_OFFSET: Record<string, [number, number]> = { baicua: [3, -2], ransua: [-4, 2], daokhi: [5, 4], vinhcanoc: [-6, -5], hangcuada: [8, -6], trailhaitac: [-10, 7] };
export function wildCell(s: PlayerState, id: string): { x: number; y: number } {
  const h = homeCell(s);
  const o = WILD_OFFSET[id];
  if (o) return { x: Math.max(1, Math.min(WORLD_W - 2, h.x + o[0])), y: Math.max(1, Math.min(WORLD_H - 2, h.y + o[1])) };
  const l = lairById(worldFor(s.khu), id);
  return l ? { x: l.sx, y: l.sy } : h;
}
/** Hang quái theo mã: hang riêng quanh nhà hoặc hang trên hải đồ chung. */
export function wildOf(s: PlayerState, id: string) {
  return WILDS.find((x) => x.id === id) ?? lairById(worldFor(s.khu), id);
}

/** Đội giữ một đảo tự nhiên: quái canh giữ, hoặc quân của chủ đảo (đồn, tháp) đứng cùng quái đã thuần. */
export function isleGuard(isle: Isle, def?: IsleDef) {
  const list = [...isle.guard];
  if (def) for (let i = 0; i < def.don; i++) list.push(['haitac', isle.lv * 2 + 4]);
  return list;
}

/** Điều kiện cắm cờ chủ quyền. */
export function claimCheck(s: PlayerState, isle: Isle): string | null {
  if (s.isles.some((o) => o.id === isle.id)) return null;
  const lvl = lordLevel(s);
  if (lvl < isle.needLvl) return `Cần cấp chúa đảo ${isle.needLvl} (bạn đang cấp ${lvl}).`;
  if (s.isles.length >= isleCap(s)) return `Cấp ${lvl} chỉ giữ được ${isleCap(s)} đảo. Lên cấp để giữ thêm.`;
  return null;
}

/** Sản lượng mỗi giờ của đảo đã cắm cờ. */
export function isleYield(isle: Isle, o: OwnedIsle): Partial<Record<ResKey, number>> {
  const out: Partial<Record<ResKey, number>> = {};
  for (const [k, v] of Object.entries(isle.yields)) out[k as ResKey] = (v ?? 0) * (1 + 0.5 * o.mo);
  return out;
}
/** Thu tối đa 12 giờ sản lượng mỗi lần. */
export const ISLE_STORE_H = 12;
export function isleReady(isle: Isle, o: OwnedIsle, now: number): Partial<Record<ResKey, number>> {
  const h = Math.min(ISLE_STORE_H, Math.max(0, now - o.last) / 3600_000);
  const out: Partial<Record<ResKey, number>> = {};
  for (const [k, v] of Object.entries(isleYield(isle, o))) {
    const n = Math.floor((v ?? 0) * h);
    if (n > 0) out[k as ResKey] = n;
  }
  return out;
}

export type IsleBuild = 'mo' | 'don' | 'thap';
export const ISLE_BUILD: Record<IsleBuild, { name: string; desc: string; cost: (lv: number, isleLv: number) => Partial<Record<ResKey, number>> }> = {
  mo: { name: 'Xưởng Khai Thác', desc: 'Sản lượng đảo +50% mỗi cấp.', cost: (lv, il) => ({ go: 60 * lv * il, da: 40 * lv * il, tien: 150 * lv * il }) },
  don: { name: 'Đồn Tiền Tiêu', desc: 'Đảo thành cứ điểm cho thuyền xuất phát; thêm lính giữ đảo.', cost: (lv, il) => ({ go: 80 * lv * il, da: 80 * lv * il, sat: 20 * lv * il }) },
  thap: { name: 'Tháp Canh Đảo', desc: 'Nhìn xa thêm 2 ô quanh đảo mỗi cấp; thêm xạ thủ giữ đảo.', cost: (lv, il) => ({ go: 50 * lv * il, tre: 60 * lv * il, da: 30 * lv * il }) },
};

/** Đường đi (để vẽ và mở sương mù dọc đường). */
export const voyagePath = (from: { x: number; y: number }, to: { x: number; y: number }) => hexLine({ c: from.x, r: from.y }, { c: to.x, r: to.y }).map((h) => ({ x: h.c, y: h.r }));

/** Đánh quái giữ đảo tự nhiên; thắng thì cắm cờ chủ quyền (nếu đủ cấp, còn chỗ). */
export function fightIsle(s: PlayerState, isle: Isle, def?: IsleDef): Outcome {
  const spec = teamSpec(s, false);
  const r = rngOf(s);
  const guard = isleGuard(isle, def).map(([m, lv]) => [m, lv + (def ? def.thap * 2 : 0)] as [typeof m, number]);
  const battle = simulate(teamFromSpec(spec, 0), teamFromMonsters(guard, 1), r);
  s.stats.battles++;
  const avgLv = guard.reduce((t, e) => t + e[1], 0) / guard.length;
  const win = battle.winner === 0;
  const ups = rewardComps(s, spec, Math.round((win ? 12 : 4) + 3 * avgLv));
  reveal(s, [{ x: isle.c, y: isle.r }], 3);
  if (!win) {
    log(s, `Đánh ${isle.name} thất bại.`);
    return { ok: true, msg: `${isle.name} giữ đảo thành công.`, battle, gained: {}, levelUps: ups, pvp: !!def };
  }
  s.stats.wins++;
  // chiến lợi phẩm: 3 giờ sản lượng của đảo
  const gain: Partial<Record<ResKey, number>> = {};
  for (const [k, v] of Object.entries(isle.yields)) {
    const n = Math.floor((v ?? 0) * 3);
    if (n > 0) gain[k as ResKey] = n;
  }
  const lt = dropLT(s, isle.kind === 'bian' ? 'bian' : 'conquer');
  const err = claimCheck(s, isle);
  let msg = `Hạ quân giữ ${isle.name}!`;
  if (!err) {
    s.isles.push({ id: isle.id, since: s.lastReal, last: s.lastReal, mo: 0, don: 0, thap: 0 });
    s.claims.push({ isle: isle.id, win: true, at: s.lastReal });
    msg += ' Đã cắm cờ chủ quyền.';
    log(s, `Cắm cờ chủ quyền ${isle.name}${def ? ` (giành từ ${def.ownerName})` : ''}.`);
  } else msg += ` Chưa cắm cờ được: ${err}`;
  if (lt) msg += ` Nhặt ${lt} Linh Thạch.`;
  return { ok: true, msg, battle, gained: gain, levelUps: ups, pvp: !!def };
}


// ---------- hệ sinh thái: thời tiết vào trận, lương, bệnh, độ bền, nông trại, học viện ----------
/** Điều kiện của trận đang đánh (do chuyến thuyền đặt, chỉ áp vào bên tấn công). */
let battleMod: TeamSpec['mod'] | undefined;

/** Thưởng trang bị đã tính hao mòn. */
export function gearBonusWorn(kho: GearSet, ben: Record<GearKey, number>) {
  const worn = { ...kho };
  for (const k of GEAR_KEYS) worn[k] = kho[k] * wearMult(ben?.[k] ?? 100);
  return gearBonus(worn);
}
/** Trang bị mòn sau một trận. */
function wearGear(s: PlayerState, keys: Partial<GearSet>) {
  const k0 = 1 - 0.25 * (s.tech.renSat ?? 0);
  for (const k of GEAR_KEYS) if ((keys[k] ?? 0) > 0) s.ben[k] = Math.max(0, Math.round((s.ben[k] - GEAR_WEAR * k0) * 10) / 10);
}
/** Giờ thật ứng với một mốc giờ trong game. */
const realAt = (s: PlayerState, gt: number) => s.lastReal - (s.gt - gt) / Math.max(1, s.speed);
/** Số người ra trận (để tính lương). */
const teamSize = (s: PlayerState) => COMP_KEYS.filter((k) => s.comps[k].unlocked).length + (s.chuTuong ? 1 : 0) + s.fleet.length * 2 + troopCount(s.voyage?.troops);

/** Lương thực cần cho cả chuyến đi về. */
export function rationNeed(s: PlayerState, oneWayMs: number) {
  const h = (oneWayMs * 2) / 3600_000;
  return Math.ceil(h * teamSize(s) * RATION_PER_HOUR * (1 - 0.15 * (s.tech.quanLuong ?? 0)));
}
/** Xuất kho lương thực: lương khô trước, thiếu thì gạo (2 gạo = 1 khẩu phần), rồi cá, thịt. */
function takeRations(s: PlayerState, need: number): { got: number; mix: Partial<Record<ResKey, number>> } {
  let got = 0;
  const mix: Partial<Record<ResKey, number>> = {};
  const take = (k: ResKey, per: number) => {
    if (got >= need) return;
    const n = Math.min(s.res[k], Math.ceil((need - got) * per));
    s.res[k] -= n;
    const g = Math.floor(n / per);
    got += g;
    if (g) mix[k] = (mix[k] ?? 0) + g;
  };
  take('luong', 1);
  take('thit', 1);
  take('ca', 1);
  take('gao', 2);
  return { got, mix };
}
/** Thuốc mang theo: tối đa 2 liều mỗi người. */
function takeMedicine(s: PlayerState): number {
  const n = Math.min(s.res.duoc, teamSize(s) * 2);
  s.res.duoc -= n;
  return n;
}

/** Đi biển tới nơi: thời tiết, đói, bệnh tác động vào đội. Trả về điều kiện trận và lời kể. */
function voyageCondition(s: PlayerState, v: Voyage): { mod: NonNullable<TeamSpec['mod']>; notes: string[] } {
  const notes: string[] = [];
  const tArr = realAt(s, v.arriveAt);
  const wx = weatherAt(regionOf(v.to), tArr);
  const W = WEATHER[wx.kind];
  const mod = { atk: 1, hp: 1, front: W.front, back: W.back };
  if (wx.kind !== 'may' && wx.kind !== 'nang') notes.push(`${W.icon} ${W.name} ở nơi đánh.`);
  // đói: lương mang theo cho nửa đường đi
  if (v.need) {
    const fed = Math.min(1, (v.food ?? 0) / Math.max(1, v.need / 2));
    if (fed < 1) {
      mod.atk *= 0.7 + 0.3 * fed;
      mod.hp *= 0.8 + 0.2 * fed;
      notes.push(fed <= 0 ? 'Hết sạch lương: quân đói lả, đánh yếu hẳn.' : 'Thiếu lương: quân đói, đánh yếu đi.');
    }
  }
  // bữa ăn thành buff: thịt tăng công, cá tăng máu, lương nấu tăng cả hai
  if (v.mix) {
    const mb = mealBuff(v.mix);
    mod.atk *= mb.atk;
    mod.hp *= mb.hp;
    if (mb.atk > 1 || mb.hp > 1) notes.push(`Bữa ăn no nê${mb.atk > 1 ? `: công +${Math.round((mb.atk - 1) * 100)}%` : ''}${mb.hp > 1 ? `${mb.atk > 1 ? ',' : ':'} máu +${Math.round((mb.hp - 1) * 100)}%` : ''}.`);
  }
  // bệnh trên biển
  const hours = Math.max(0, (v.arriveAt - v.departAt) / 3600_000);
  const p = SICK_PER_HOUR * W.sick * (1 - 0.2 * (s.tech.namDuoc ?? 0));
  const r = rngOf(s);
  let sick = 0;
  for (let i = 0; i < Math.ceil(hours); i++) if (r() < p * Math.min(1, hours - i)) sick++;
  if (sick) {
    const per = 1 + (s.tech.namDuoc ?? 0);
    const cured = Math.min(sick, (v.duoc ?? 0) * per);
    v.duoc = Math.max(0, (v.duoc ?? 0) - Math.ceil(cured / per));
    const left = sick - cured;
    if (left) mod.hp *= Math.max(0.6, 1 - 0.08 * left);
    notes.push(`${sick} người đổ bệnh trên biển${cured ? `, ${cured} được chữa bằng thuốc` : ''}${left ? `, ${left} còn ốm yếu` : ''}.`);
  }
  return { mod, notes };
}

/** Thuyền về bến: hao mòn thân thuyền theo thời tiết, trả lại lương và thuốc còn thừa. */
function voyageReturn(s: PlayerState, v: Voyage) {
  const wx = weatherAt(regionOf(v.to), realAt(s, v.arriveAt));
  const k = (1 - 0.25 * (s.tech.dongTau ?? 0)) * (1 - 0.15 * bLevel(s.dinh, 'benthuyen'));
  s.vo = Math.max(0, Math.round((s.vo - HULL_WEAR * WEATHER[wx.kind].wear * k) * 10) / 10);
  const used = Math.ceil((v.need ?? 0) * 1);
  const back = Math.max(0, (v.food ?? 0) - used);
  if (back) s.res.luong += back;
  if (v.duoc) s.res.duoc += v.duoc;
}

/** Thời gian đi biển có tính gió, la bàn, thân thuyền. */
export function sailWind(s: PlayerState, from: { x: number; y: number }, to: { x: number; y: number }) {
  const wx = weatherAt(regionOf(from), s.lastReal);
  const lb = s.tech.laBan ?? 0;
  return windFactor(from, to, wx, lb) * (1 - 0.08 * lb) * (s.vo < 30 ? 1.3 : 1);
}

// --- nông trại ---
const PLOT_OF: Record<string, CropKey[]> = { ruong: ['lua'], vuon: ['rau', 'thaoduoc'], nuongdau: ['dau'] };
export const cropsFor = (k: BKey) => PLOT_OF[k] ?? [];
/** Các ô trồng của ruộng/vườn/nương (đủ số ô theo cấp; dữ liệu cũ một cây cả ruộng thì thành ô đầu). */
export function plotsOf(d: Dinh): ({ k: CropKey; at: number } | null)[] {
  const n = slotsOf(d.lv);
  const out = (d.plots ?? []).slice(0, n);
  if (!d.plots && d.crop) out[0] = d.crop;
  while (out.length < n) out.push(null);
  return out;
}
/** Tình trạng một ô trồng. */
export function plotState(s: PlayerState, d: Dinh, i: number, now = s.lastReal) {
  const p = plotsOf(d)[i];
  if (!p) return null;
  const c = CROPS[p.k];
  const speedK = 1 + 0.15 * (s.tech.thuyLoi ?? 0);
  const { p: prog, storms } = cropProgressCached(p.k, p.at, now, regionOf(homeCell(s)), speedK);
  const ripe = prog >= 1;
  const over = ripe && now - p.at > c.ms * 1.6 + OVERRIPE_MS;
  const n = Math.max(1, Math.round(c.per * PLOT_YIELD * (1 + 0.2 * (s.tech.giongLua ?? 0) + trauBonus(s)) * Math.max(0.4, Math.pow(0.85, storms)) * (over ? 0.5 : 1)));
  return { k: p.k, p: Math.min(1, prog), ripe, over, storms, out: c.out, n, left: ripe ? 0 : Math.max(0, (1 - prog) * c.ms / Math.max(0.2, speedK)) };
}
/** Tóm tắt cả ruộng: ô đầu tiên đang có cây (giữ cho chỗ cũ dùng). */
export function cropState(s: PlayerState, d: Dinh, now = s.lastReal) {
  const ps = plotsOf(d);
  const i = ps.findIndex(Boolean);
  return i < 0 ? null : plotState(s, d, i, now);
}
/** Số con giống (chuồng/ao) hoặc số thợ (xưởng) đang có. */
export const unitsOf = (d: Dinh) => Math.min(slotsOf(d.lv), d.n ?? 2);
/** Thu trước sản phẩm đang chờ (khi đổi số con/thợ thì tính lại từ đầu). */
function settleProd(s: PlayerState, d: Dinh) {
  const p = pending(s, d);
  if (Object.values(p.give).some((v) => (v ?? 0) > 0)) {
    for (const [k, v] of Object.entries(p.take)) s.res[k as ResKey] = Math.max(0, s.res[k as ResKey] - (v ?? 0));
    addRes(s, p.give);
  }
  d.last = s.lastReal;
}
const cpCache = new Map<string, { p: number; storms: number }>();
function cropProgressCached(k: CropKey, at: number, now: number, region: string, speedK: number) {
  // làm tròn tới phút để khỏi tính lại liên tục
  const key = `${k}:${at}:${Math.floor(now / 60_000)}:${region}:${speedK}`;
  const hit = cpCache.get(key);
  if (hit) return hit;
  const v = cropProgress(k, at, Math.floor(now / 60_000) * 60_000, region, speedK);
  if (cpCache.size > 400) cpCache.clear();
  cpCache.set(key, v);
  return v;
}
/** Sản phẩm đang chờ ở chuồng, ao, xưởng chế biến. */
export function pending(s: PlayerState, d: Dinh, now = s.lastReal): { give: Partial<Record<ResKey, number>>; take: Partial<Record<ResKey, number>>; h: number } {
  const h = Math.min(STORE_H, Math.max(0, now - (d.last ?? now)) / 3600_000);
  // mỗi con giống / mỗi thợ là một ô bên trong công trình
  const lv = unitsOf(d);
  const give: Partial<Record<ResKey, number>> = {};
  const take: Partial<Record<ResKey, number>> = {};
  if (d.k === 'chuong' || d.k === 'aoca') {
    const P = PENS[d.k];
    const bonus = 1 + 0.2 * (s.tech.chanNuoi ?? 0);
    let ratio = 1;
    for (const [k, v] of Object.entries(P.feed)) {
      const need = (v ?? 0) * lv * h;
      if (need > 0) ratio = Math.min(ratio, s.res[k as ResKey] / need);
    }
    ratio = Math.max(0, Math.min(1, ratio));
    for (const [k, v] of Object.entries(P.feed)) take[k as ResKey] = Math.ceil((v ?? 0) * lv * h * ratio);
    for (const [k, v] of Object.entries(P.out)) give[k as ResKey] = Math.floor((v ?? 0) * lv * h * ratio * bonus);
  } else if (d.k in PROCS) {
    const P = PROCS[d.k as keyof typeof PROCS];
    let batches = Math.floor(P.rate * PER_WORKER * lv * h);
    for (const [k, v] of Object.entries(P.take)) batches = Math.min(batches, Math.floor(s.res[k as ResKey] / (v ?? 1)));
    let one: ResKey | null = null;
    if (P.takeOne) {
      const avail = P.takeOne.keys.map((k) => ({ k, n: Math.floor(s.res[k] / P.takeOne!.n) })).sort((a, b) => b.n - a.n)[0];
      one = avail.k;
      batches = Math.min(batches, avail.n);
    }
    batches = Math.max(0, batches);
    for (const [k, v] of Object.entries(P.take)) take[k as ResKey] = (v ?? 0) * batches;
    if (one && P.takeOne) take[one] = (take[one] ?? 0) + P.takeOne.n * batches;
    for (const [k, v] of Object.entries(P.give)) give[k as ResKey] = (v ?? 0) * batches;
  }
  return { give, take, h };
}
export const techLv = (s: PlayerState, k: TechKey) => s.tech[k] ?? 0;
export { TECHS, TECH_MAX, techCost, techMs, CROPS, PENS, PROCS };

/** Xếp quân lên thuyền theo kế hoạch mang theo: lấy từ quân ở đảo nhà. */
function loadTroops(s: PlayerState, v: Voyage) {
  const cargo = fitCargo(s.mang, s.troops, carryCap(s.lv.thuyen.tier, s.fleet), s.fleet);
  if (!troopCount(cargo)) return;
  for (const k of TROOP_KEYS) if (cargo[k]) s.troops[k] = (s.troops[k] ?? 0) - (cargo[k] ?? 0);
  v.troops = cargo;
}
const ISLE_HOUSE = 24;
/** Chuyến bị hủy giữa đường (đích không còn): quân trên thuyền về đảo nhà. */
function abortVoyage(s: PlayerState) {
  const tr = s.voyage?.troops;
  if (tr) for (const k of TROOP_KEYS) if (tr[k]) s.troops[k] = (s.troops[k] ?? 0) + (tr[k] ?? 0);
  s.voyage = null;
}
/** Sau trận: quân còn sống theo máu còn lại. Thắng đảo tự nhiên thì quân còn lại đóng ở đảo. */
function settleTroops(s: PlayerState, v: Voyage, battle: BattleResult | undefined, notes: string[]) {
  if (!v.troops || !troopCount(v.troops) || !battle) return;
  const before = troopCount(v.troops);
  const alive: Troops = {};
  const mine = battle.a.filter((u) => !u.wall);
  mine.forEach((u, i) => {
    if (!u.key.startsWith('tq-')) return;
    const k = u.key.slice(3) as TroopKey;
    const n = v.troops![k] ?? 0;
    const left = survivors(n, battle.hpA?.[i] ?? 0, u.maxHp);
    if (left > 0) alive[k] = left;
  });
  v.troops = alive;
  const lost = before - troopCount(alive);
  if (lost > 0) notes.push(`Quân tử trận: ${lost}/${before}.`);
}

/** Xuất lương và thuốc cho chuyến đi. */
function provision(s: PlayerState, v: Voyage, oneWayMs: number) {
  if (v.kind !== 'scout' && v.kind !== 'boss') loadTroops(s, v);
  if (v.kind === 'scout') {
    v.need = Math.ceil(rationNeed(s, oneWayMs) / Math.max(1, teamSize(s)));
    const sc = takeRations(s, v.need);
    v.food = sc.got;
    v.mix = sc.mix;
    return;
  }
  v.need = rationNeed(s, oneWayMs);
  const ra = takeRations(s, v.need);
  v.food = ra.got;
  v.mix = ra.mix;
  v.duoc = takeMedicine(s);
}

/** Báo cáo thám thính: bên trong một đảo (chỉ khi không có khiên). */
export interface ScoutReport {
  id: string;
  name: string;
  islandName: string;
  at: number;
  land: string;
  dinh: { k: BKey; lv: number; x: number; y: number }[];
  tiers: Record<LvKey, number>;
  team: { k: CompKey; lv: number }[];
  gen?: { id: GenId; star: number; w: LegWeaponId | null };
  res: Partial<Record<ResKey, number>>;
  gear: GearSet;
  lvl: number;
  isles: number;
  vo: number;
}
export const SCOUT_COST = 80;
export function scoutReport(s: PlayerState): ScoutReport {
  const res: Partial<Record<ResKey, number>> = {};
  for (const k of RES_KEYS) if (s.res[k] > 0 && k !== 'lt') res[k] = s.res[k];
  return {
    id: s.id,
    name: s.name,
    islandName: s.islandName,
    at: s.lastReal,
    land: s.land,
    dinh: s.dinh.filter((d) => d.lv > 0).map((d) => ({ k: d.k, lv: d.lv, x: d.x, y: d.y })),
    tiers: { leu: s.lv.leu.tier, cuoc: s.lv.cuoc.tier, rao: s.lv.rao.tier, thuyen: s.lv.thuyen.tier },
    team: teamSpec(s, true).comps,
    gen: teamSpec(s, true).gen,
    res,
    gear: { ...s.kho },
    lvl: lordLevel(s),
    isles: s.isles.length,
    vo: s.vo,
  };
}

// ---------- hạm đội ----------
/** Chi phí sửa thuyền chính và các thuyền chiến. */
export function repairCost(s: PlayerState): Partial<Record<ResKey, number>> | null {
  let miss = 100 - s.vo;
  for (const sh of s.fleet) miss += (100 - sh.vo) * (sh.k === 'chien' ? 3 : sh.k === 'buom' ? 2 : 1);
  if (miss <= 0) return null;
  return { go: Math.ceil(miss * 1.2 * s.lv.thuyen.tier), vai: Math.ceil(miss / 12) };
}
/** Thuyền chiến mòn sau trận; mòn hết thì chìm. */
function wearFleet(s: PlayerState) {
  const k = 1 - 0.25 * (s.tech.dongTau ?? 0);
  for (const sh of s.fleet) sh.vo = Math.max(0, Math.round((sh.vo - SHIP_WEAR * k) * 10) / 10);
  const sunk = s.fleet.filter((x) => x.vo <= 0);
  if (sunk.length) {
    s.fleet = s.fleet.filter((x) => x.vo > 0);
    log(s, `${sunk.map((x) => SHIPS[x.k].name).join(', ')} hư hỏng nặng, đã chìm.`);
  }
}
