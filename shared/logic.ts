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
  kind: 'wild' | 'island';
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
    res: { co: 10, la: 0, tre: 6, go: 0, cui: 0, da: 6, sat: 0, so: 20, ngoc: 0 },
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
export const storageCap = (s: PlayerState) => EFFECTS.storageCap[tierIdx(s, 'leu')];
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
export function powerFrom(tiers: Partial<Record<LvKey, number>>, team: { lv: number }[], land: number): number {
  return Math.round(land + (tiers.leu ?? 1) * 30 + (tiers.cuoc ?? 1) * 25 + (tiers.rao ?? 1) * 25 + (tiers.thuyen ?? 1) * 15 + team.reduce((t, c) => t + c.lv * 12, 0));
}
export function power(s: PlayerState): number {
  const team = COMP_KEYS.filter((k) => s.comps[k].unlocked).map((k) => s.comps[k]);
  return powerFrom({ leu: s.lv.leu.tier, cuoc: s.lv.cuoc.tier, rao: s.lv.rao.tier, thuyen: s.lv.thuyen.tier }, team, landCount(s));
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
  return false;
}

// ---------- vòng thời gian ----------
export function tick(s: PlayerState, now: number): string[] {
  const notes: string[] = [];
  const dtReal = Math.max(0, Math.min(now - s.lastReal, 7 * 24 * 3600_000));
  s.lastReal = now;
  const dt = dtReal * s.speed;
  s.gt += dt;
  const min = dt / 60_000;
  for (const k of LV_KEYS) {
    const l = s.lv[k];
    l.hunger = Math.min(100, l.hunger + HUNGER_PER_MIN * min);
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

export const buildSlots = (s: PlayerState) => (s.lv.leu.tier >= 3 ? 2 : 1);
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

export function sailMs(s: PlayerState, to: { x: number; y: number }): number {
  const dist = Math.max(1, Math.hypot(to.x - HOME_CELL.x, to.y - HOME_CELL.y));
  return Math.round((dist * EFFECTS.sailSecPerCell[tierIdx(s, 'thuyen')] * 1000) / moodMult(s.lv.thuyen));
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
    if (v.kind === 'wild') {
      const w = WILDS.find((x) => x.id === v.targetId)!;
      o = fightWild(s, w, true);
    } else {
      o = raid(s, v.target!, true);
      if (o.event) s.outbox.push(o.event);
    }
    v.loot = o.gained ?? {};
    v.win = o.battle?.winner === 0;
    v.phase = 've';
    s.lastBattle = { title: v.kind === 'wild' ? `Trận ${v.targetName}` : `Đột kích ${v.targetName}`, o, seen: false };
    notes.push(`Thuyền đã cập ${v.targetName}: ${v.win ? 'thắng trận' : 'thua trận'}. Bấm "Xem trận".`);
    if (o.quest) notes.push(`Xong việc: ${o.quest}`);
  }
  if (v.phase === 've' && s.gt >= v.returnAt) {
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
  | { t: 'sail'; kind: 'island'; target: IslandPub; to: { x: number; y: number } }
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
      if (s.builds.length >= buildSlots(s)) return fail(buildSlots(s) > 1 ? 'Cả hai đội thợ đều đang bận.' : 'Thợ đang bận xây công trình khác. Nhà chính bậc 3 có thêm đội thợ thứ hai.');
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
      return { ok: true, msg: `Mở ${CHESTS[c.ci].name}`, gained: got, chest: c.ci, quest: q ?? undefined };
    }
    case 'sail': {
      if (s.voyage) return fail(s.voyage.phase === 'di' ? 'Thuyền đang trên đường đi.' : 'Thuyền đang trên đường về bến.');
      let to: { x: number; y: number };
      let targetId: string;
      let targetName: string;
      let target: IslandPub | undefined;
      if (a.kind === 'wild') {
        const w = WILDS.find((x) => x.id === a.id);
        if (!w) return fail('Không có đảo này.');
        const st = s.wilds[w.id];
        if (st && s.gt < st.readyAt) return fail('Quái chưa kéo về đảo này.');
        to = { x: w.sx, y: w.sy };
        targetId = w.id;
        targetName = w.name;
      } else {
        const err = raidCheck(s, a.target);
        if (err) return fail(err);
        to = { x: Math.round(a.to.x), y: Math.round(a.to.y) };
        targetId = a.target.id;
        targetName = a.target.islandName;
        target = a.target;
      }
      const one = sailMs(s, to);
      s.voyage = { id: nid(s, 'v'), kind: a.kind, targetId, targetName, target, to, departAt: s.gt, arriveAt: s.gt + one, returnAt: s.gt + one * 2, phase: 'di', loot: {} };
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
    case 'avatar': {
      const av = cleanAvatar(a.av);
      if (!av) return fail('Dáng vẻ không hợp lệ.');
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
    title: titleOf(power(s)),
    land: landCount(s),
    tiers: { leu: s.lv.leu.tier, cuoc: s.lv.cuoc.tier, rao: s.lv.rao.tier, thuyen: s.lv.thuyen.tier },
    team: teamSpec(s, false).comps,
    lootable,
    updatedAt: Date.now(),
    avatar: s.avatar,
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
}

export function raidSeed(attackerId: string, targetId: string, n: number) {
  return hashStr(`raid:${attackerId}:${targetId}:${n}`);
}

/** Tính trận đột kích từ hai bản công khai — server dùng đúng hàm này để kiểm lại. */
export function resolveRaid(att: TeamSpec, target: IslandPub, seed: number): { battle: BattleResult; loot: Partial<Record<ResKey, number>> } {
  const r = mulberry32(seed);
  const defSpec: TeamSpec = { comps: target.team, cuocTier: target.tiers.cuoc, raoTier: target.tiers.rao, hero: target.name };
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

export function raidCheck(s: PlayerState, target: IslandPub): string | null {
  if (target.id === s.id) return 'Không tự đột kích đảo mình được.';
  if ((s.raidCd[target.id] ?? 0) > s.gt) return 'Vừa đột kích đảo này rồi, để họ nghỉ một chút.';
  if (s.lv.leu.tier < 2 && !target.bot) return 'Nâng Nhà chính lên bậc 2 để mở đột kích người chơi.';
  if (target.tiers.leu < 2 && !target.bot) return 'Đảo này còn được Rùa Vàng che chở vì chủ đảo mới tới.';
  return null;
}

/** Đánh trận đột kích ngay. holdLoot = true: chiến lợi phẩm nằm trên thuyền, về bến mới cộng. */
export function raid(s: PlayerState, target: IslandPub, holdLoot = false): Outcome & { event?: RaidEvent } {
  const err = raidCheck(s, target);
  if (err) return fail(err);
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
  };
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
  const text = `${ev.attackerName} đột kích đảo bạn${lost.length ? `, lấy mất ${lost.join(', ')}` : ''}.`;
  log(s, text);
  return text;
}

/** Dấu vân tay ngắn của trạng thái: client và server so nhau để phát hiện lệch. */
export function digest(s: PlayerState): string {
  const parts = [s.rngN, s.seq, landCount(s), ...RES_KEYS.map((k) => s.res[k]), ...LV_KEYS.map((k) => `${s.lv[k].tier}:${s.lv[k].xp}`), s.builds.length, s.voyage?.id ?? '-', s.chests.length];
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
