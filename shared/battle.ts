// Mô phỏng trận đánh tự động theo lượt. Thuần logic, có hạt giống → server tính lại được y hệt.
import { counterMult, squadUnit, survivors, TROOP_KEYS, type TroopRows, type Troops } from './troops';
import { COMPANIONS, EFFECTS, enemyBase, LINH_VAT, type CompKey, type EnemyKey, type SkillKey, type UnitBase } from './data';
import { shipUnit, type ShipKind, type ShipWeapon } from './navy';
import { GENERALS, generalUnit, type GenId, type LegWeaponId } from './gacha';
import type { Rng } from './rng';

export interface BUnit {
  id: string;
  side: 0 | 1;
  key: string; // khoá sprite
  name: string;
  lv: number;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  skill: SkillKey;
  row: 'front' | 'back';
  thorns: number;
  wall?: boolean;
  /** tướng dẫn đầu: đồng đội +10% công và thủ khi tướng còn sống */
  lead?: boolean;
  acted: number;
  atkUp: number;
  defUp: number;
  taunt: number;
  burn: number;
  poison: number;
}

export type BEventKind = 'hit' | 'skill' | 'heal' | 'dot' | 'die' | 'buff' | 'thorns';
export interface BEvent {
  r: number;
  a: string;
  k: BEventKind;
  s?: SkillKey;
  t?: string[];
  v?: number[];
  crit?: boolean;
}

export interface BattleResult {
  winner: 0 | 1;
  rounds: number;
  events: BEvent[];
  a: BUnit[];
  b: BUnit[];
  /** máu còn lại của bên 1 khi hết trận (tính sát thương lên boss) */
  hpB?: number[];
  /** máu còn lại của bên 0 (không tính tường) khi hết trận */
  hpA?: number[];
}

const scale = (lv: number) => 1 + 0.12 * (lv - 1);

export function makeUnit(base: UnitBase, key: string, lv: number, side: 0 | 1, idx: number, atkBonus = 0): BUnit {
  const m = scale(lv);
  return {
    id: `${side}${idx}`,
    side,
    key,
    name: base.name,
    lv,
    maxHp: Math.round(base.hp * m),
    hp: Math.round(base.hp * m),
    atk: Math.round(base.atk * m + atkBonus),
    def: Math.round(base.def * m),
    spd: base.spd + 0.2 * (lv - 1),
    skill: base.skill,
    row: base.row,
    thorns: base.skill === 'phandon' ? 0.2 : 0,
    acted: 0,
    atkUp: 0,
    defUp: 0,
    taunt: 0,
    burn: 0,
    poison: 0,
  };
}

export function makeWall(tier: number, side: 0 | 1, idx: number): BUnit {
  const t = Math.max(1, Math.min(5, tier));
  return {
    id: `${side}${idx}`,
    side,
    key: `rao${t}`,
    name: LINH_VAT.rao.tiers[t - 1],
    lv: t,
    maxHp: EFFECTS.wallHp[t - 1],
    hp: EFFECTS.wallHp[t - 1],
    atk: 0,
    def: 8 + t * 4,
    spd: 0,
    skill: 'chan',
    row: 'front',
    thorns: EFFECTS.wallThorns[t - 1],
    wall: true,
    acted: 0,
    atkUp: 0,
    defUp: 0,
    taunt: 999,
    burn: 0,
    poison: 0,
  };
}

export interface TeamSpec {
  comps: { k: CompKey; lv: number }[];
  cuocTier: number;
  raoTier?: number; // có → thêm lũy tre chắn (khi phòng thủ)
  hero?: string; // tên chủ đảo (nhân vật "an" mang tên người chơi)
  /** sức mạnh cộng thêm từ trang bị (0.1 = +10%) */
  gear?: { atk: number; def: number; hp: number };
  /** thành trì khi giữ đảo: cấp các tháp canh, đồn binh, máu tường thêm */
  fort?: { thap: number[]; don: number[]; tuongHp: number };
  /** chủ tướng ra trận cùng đội */
  gen?: { id: GenId; star: number; w: LegWeaponId | null };
  /** quân (lính và cơ giới) đi cùng: mỗi loại gộp thành một đội */
  troops?: Troops;
  /** hàng trước/sau người chơi chọn cho từng loại quân (mặc định theo loại) */
  rows?: TroopRows;
  /** thuyền chiến theo đội */
  ships?: { k: ShipKind; w: Partial<Record<ShipWeapon, boolean>>; vo: number }[];
  /** điều kiện trận: lương, bệnh, thời tiết (nhân vào công/máu theo hàng) */
  mod?: { atk: number; hp: number; front: number; back: number };
}

const THAP: UnitBase = { name: 'Xạ Thủ Tháp Canh', hp: 70, atk: 15, def: 6, spd: 9, skill: 'samset', row: 'back' };
const DON: UnitBase = { name: 'Lính Đồn', hp: 150, atk: 12, def: 13, spd: 8, skill: 'thietcot', row: 'front' };

function applyGear(u: BUnit, g?: { atk: number; def: number; hp: number }) {
  if (!g || u.wall) return u;
  u.atk = Math.round(u.atk * (1 + g.atk));
  u.def = Math.round(u.def * (1 + g.def));
  u.maxHp = u.hp = Math.round(u.maxHp * (1 + g.hp));
  return u;
}

function applyMod(u: BUnit, m?: TeamSpec['mod']) {
  if (!m || u.wall) return u;
  u.atk = Math.max(1, Math.round(u.atk * m.atk * (u.row === 'back' ? m.back : m.front)));
  u.maxHp = u.hp = Math.max(1, Math.round(u.maxHp * m.hp));
  return u;
}

export function teamFromSpec(spec: TeamSpec, side: 0 | 1): BUnit[] {
  return teamFromSpec0(spec, side).map((u) => applyMod(u, spec.mod));
}
function teamFromSpec0(spec: TeamSpec, side: 0 | 1): BUnit[] {
  const out: BUnit[] = [];
  spec.comps.forEach((c, i) => {
    const bonus = c.k === 'an' ? EFFECTS.anAtkBonus[Math.max(0, spec.cuocTier - 1)] : 0;
    const base = c.k === 'an' && spec.hero ? { ...COMPANIONS.an, name: spec.hero } : COMPANIONS[c.k];
    out.push(applyGear(makeUnit(base, c.k, c.lv, side, i, bonus), spec.gear));
  });
  for (const k of TROOP_KEYS) {
    const n = spec.troops?.[k] ?? 0;
    if (n > 0) {
      const u = makeUnit(squadUnit(k, n), `tq-${k}`, 1, side, out.length);
      if (spec.rows?.[k]) u.row = spec.rows[k]!;
      out.push(applyGear(u, spec.gear));
    }
  }
  for (const sh of spec.ships ?? []) out.push(applyGear(makeUnit(shipUnit({ id: '', ...sh }), `tau-${sh.k}${sh.w.no ? 'n' : ''}${sh.w.da ? 'd' : ''}${sh.w.dam ? 'm' : ''}`, 1, side, out.length), spec.gear));
  if (spec.gen && GENERALS[spec.gen.id]) {
    const g = applyGear(makeUnit(generalUnit(spec.gen.id, spec.gen.star, spec.gen.w), spec.gen.id, 1, side, out.length), spec.gear);
    g.lead = true;
    out.push(g);
  }
  if (spec.fort) {
    for (const lv of spec.fort.don.slice(0, 2)) out.push(makeUnit(DON, 'don', 1 + (lv - 1) * 6, side, out.length));
    for (const lv of spec.fort.thap.slice(0, 4)) out.push(makeUnit(THAP, 'thap', 1 + (lv - 1) * 6, side, out.length));
  }
  if (spec.raoTier) {
    const w = makeWall(spec.raoTier, side, out.length);
    if (spec.fort?.tuongHp) w.maxHp = w.hp = w.maxHp + spec.fort.tuongHp;
    out.push(w);
  }
  return out;
}

/** Thủy Tinh (giữa hàng trước) và Thủy Binh hộ vệ. */
export function teamFromBoss(form: UnitBase & { minion: UnitBase; minions: number }, side: 0 | 1): BUnit[] {
  const out = [makeUnit(form, 'thuytinh', 1, side, 0)];
  for (let i = 0; i < form.minions; i++) out.push(makeUnit(form.minion, 'thuybinh', 1, side, i + 1));
  return out;
}

export function teamFromMonsters(list: [EnemyKey, number][], side: 0 | 1): BUnit[] {
  return list.map(([k, lv], i) => makeUnit(enemyBase(k), k, lv, side, i));
}

export const LEAD_BONUS = 1.1;
/** Hào quang dẫn đầu của đội mình lên một đơn vị: có tướng còn sống (không phải chính nó) thì +10%. */
export function leaderBonus(team: BUnit[], u: BUnit): { atk: number; def: number } {
  if (u.wall || u.lead) return { atk: 1, def: 1 };
  const on = team.some((x) => x.side === u.side && x.lead && x.hp > 0);
  return on ? { atk: LEAD_BONUS, def: LEAD_BONUS } : { atk: 1, def: 1 };
}

function damage(att: BUnit, def: BUnit, mult: number, rng: Rng, ab = 1, db = 1): { dmg: number; crit: boolean } {
  const atk = att.atk * mult * ab * (att.atkUp > 0 ? 1.25 : 1);
  const d = def.def * db * (def.defUp > 0 ? 1.6 : 1);
  const crit = rng() < 0.1;
  let dmg = atk * counterMult(att.key, def.key) * (100 / (100 + d * 5)) * (0.9 + rng() * 0.2);
  if (crit) dmg *= 1.5;
  return { dmg: Math.max(1, Math.round(dmg)), crit };
}

export function simulate(a: BUnit[], b: BUnit[], rng: Rng, maxRounds = 20): BattleResult {
  const snapA = a.map((u) => ({ ...u }));
  const snapB = b.map((u) => ({ ...u }));
  const all = [...a, ...b];
  const events: BEvent[] = [];
  const alive = (side: 0 | 1) => all.filter((u) => u.side === side && u.hp > 0);
  const over = () => alive(0).length === 0 || alive(1).length === 0;

  const pickTarget = (side: 0 | 1): BUnit | undefined => {
    const foes = alive(side === 0 ? 1 : 0);
    if (!foes.length) return undefined;
    const taunting = foes.filter((f) => f.taunt > 0);
    if (taunting.length) return taunting[Math.floor(rng() * taunting.length)];
    const front = foes.filter((f) => f.row === 'front');
    const pool = front.length ? front : foes;
    return pool[Math.floor(rng() * pool.length)];
  };

  const hit = (r: number, att: BUnit, tgt: BUnit, mult: number, skill?: SkillKey) => {
    const { dmg, crit } = damage(att, tgt, mult, rng, leaderBonus(all, att).atk, leaderBonus(all, tgt).def);
    tgt.hp = Math.max(0, tgt.hp - dmg);
    events.push({ r, a: att.id, k: skill ? 'skill' : 'hit', s: skill, t: [tgt.id], v: [dmg], crit });
    if (tgt.thorns > 0 && att.hp > 0) {
      const back = Math.max(1, Math.round(dmg * tgt.thorns));
      att.hp = Math.max(0, att.hp - back);
      events.push({ r, a: tgt.id, k: 'thorns', t: [att.id], v: [back] });
      if (att.hp === 0) events.push({ r, a: att.id, k: 'die' });
    }
    if (tgt.hp === 0) events.push({ r, a: tgt.id, k: 'die' });
  };

  // tướng dẫn đầu ra hiệu lệnh đầu trận (không tốn lượt)
  for (const side of [0, 1] as const) {
    const lead = all.find((u) => u.side === side && u.lead && u.hp > 0);
    if (lead) events.push({ r: 1, a: lead.id, k: 'buff', t: all.filter((u) => u.side === side && !u.wall && u !== lead).map((u) => u.id) });
  }

  let round = 0;
  while (!over() && round < maxRounds) {
    round++;
    const order = all
      .filter((u) => u.hp > 0 && !u.wall)
      .map((u) => ({ u, tie: rng() }))
      .sort((x, y) => y.u.spd - x.u.spd || x.tie - y.tie)
      .map((x) => x.u);
    for (const u of order) {
      if (u.hp <= 0 || over()) continue;
      // sát thương theo thời gian
      if (u.burn > 0 || u.poison > 0) {
        const pct = (u.burn > 0 ? 0.06 : 0) + (u.poison > 0 ? 0.05 : 0);
        const v = Math.max(1, Math.round(u.maxHp * pct));
        u.hp = Math.max(0, u.hp - v);
        events.push({ r: round, a: u.id, k: 'dot', v: [v] });
        if (u.hp === 0) {
          events.push({ r: round, a: u.id, k: 'die' });
          continue;
        }
      }
      const useSkill = u.acted % 3 === 2;
      u.acted++;
      const allies = alive(u.side);
      if (!useSkill) {
        const t = pickTarget(u.side);
        if (t) hit(round, u, t, 1);
        continue;
      }
      switch (u.skill) {
        case 'thinhhon': {
          allies.forEach((x) => (x.atkUp = 2));
          events.push({ r: round, a: u.id, k: 'buff', s: u.skill, t: allies.map((x) => x.id) });
          const t = pickTarget(u.side);
          if (t) hit(round, u, t, 1);
          break;
        }
        case 'thietcot': {
          u.taunt = 2;
          u.defUp = 2;
          events.push({ r: round, a: u.id, k: 'buff', s: u.skill, t: [u.id] });
          break;
        }
        case 'lalanh': {
          const low = allies.filter((x) => !x.wall).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
          if (low) {
            const v = Math.round(low.maxHp * 0.28);
            low.hp = Math.min(low.maxHp, low.hp + v);
            low.burn = 0;
            low.poison = 0;
            events.push({ r: round, a: u.id, k: 'heal', s: u.skill, t: [low.id], v: [v] });
          }
          break;
        }
        case 'samset': {
          const foes = alive(u.side === 0 ? 1 : 0).sort(() => rng() - 0.5).slice(0, 2);
          for (const f of foes) if (u.hp > 0) hit(round, u, f, 1.15, 'samset');
          break;
        }
        case 'dot': {
          const t = pickTarget(u.side);
          if (t) {
            hit(round, u, t, 1, 'dot');
            if (t.hp > 0) t.burn = 2;
          }
          break;
        }
        case 'docto': {
          const t = pickTarget(u.side);
          if (t) {
            hit(round, u, t, 1, 'docto');
            if (t.hp > 0) t.poison = 3;
          }
          break;
        }
        case 'danhkep': {
          for (let i = 0; i < 2; i++) {
            const t = pickTarget(u.side);
            if (t && u.hp > 0) hit(round, u, t, 0.7, 'danhkep');
          }
          break;
        }
        case 'dapcang': {
          for (const f of alive(u.side === 0 ? 1 : 0)) if (u.hp > 0) hit(round, u, f, 0.65, 'dapcang');
          break;
        }
        case 'cuoploi': {
          const t = pickTarget(u.side);
          if (t) hit(round, u, t, 1.4, 'cuoploi');
          break;
        }
        default: {
          const t = pickTarget(u.side);
          if (t) hit(round, u, t, 1.2, u.skill);
        }
      }
    }
    for (const u of all) {
      if (u.atkUp > 0) u.atkUp--;
      if (u.defUp > 0) u.defUp--;
      if (u.taunt > 0 && u.taunt < 999) u.taunt--;
      if (u.burn > 0) u.burn--;
      if (u.poison > 0) u.poison--;
    }
  }
  const winner: 0 | 1 = alive(1).length === 0 && alive(0).length > 0 ? 0 : 1;
  return { winner, rounds: round, events, a: snapA, b: snapB, hpB: all.filter((u) => u.side === 1).map((u) => u.hp), hpA: all.filter((u) => u.side === 0 && !u.wall).map((u) => u.hp) };
}

/** Tổng máu hiện có và tối đa của một bên (không tính tường), dùng cho bảng trực tiếp. */
export function sideHp(units: BUnit[]): { hp: number; max: number } {
  let hp = 0, max = 0;
  for (const u of units) {
    if (u.wall) continue;
    hp += Math.max(0, u.hp);
    max += u.maxHp;
  }
  return { hp, max };
}

/** Báo cáo thương vong từng đội quân của bên 0: ra trận, còn sống, mất. */
export function squadReport(troops: Troops | undefined, res: BattleResult): { k: (typeof TROOP_KEYS)[number]; n: number; left: number; lost: number }[] {
  const mine = res.a.filter((u) => !u.wall);
  const out: { k: (typeof TROOP_KEYS)[number]; n: number; left: number; lost: number }[] = [];
  for (const k of TROOP_KEYS) {
    const n = troops?.[k] ?? 0;
    if (n <= 0) continue;
    const i = mine.findIndex((u) => u.key === `tq-${k}`);
    const hp = i >= 0 ? (res.hpA?.[i] ?? 0) : 0;
    const left = i >= 0 ? survivors(n, hp, mine[i].maxHp) : 0;
    out.push({ k, n, left, lost: n - left });
  }
  return out;
}

/** Số quân từng loại bên 0 mang ra trận, đọc lại từ kết quả (đội tên "… ×n"). */
export function troopsOf(res: BattleResult): Troops {
  const t: Troops = {};
  for (const u of res.a) {
    if (!u.key.startsWith('tq-')) continue;
    const k = u.key.slice(3) as (typeof TROOP_KEYS)[number];
    const n = Number(/×(\d+)/.exec(u.name)?.[1] ?? 0);
    if (TROOP_KEYS.includes(k) && n > 0) t[k] = n;
  }
  return t;
}
