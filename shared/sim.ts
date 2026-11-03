// Người chơi máy: chạy bằng chính luật trong logic.ts để đo nhịp tiến triển (spec 006).
import { apply, isLand, newPlayer, storageCap, tick, type PlayerState } from './logic';
import { BUILDINGS, type BKey } from './economy';
import { LINH_VAT, XP_TO_NEXT, type ResKey } from './data';

export interface SimReport {
  /** giờ game đạt mốc (null nếu chưa đạt) */
  nhaDan: number | null;
  leu2: number | null;
  leu3: number | null;
  leu4: number | null;
  leu5: number | null;
  /** giờ game khi có ít nhất 25 công trình đạt cấp 3 (null nếu chưa) */
  allLv3: number | null;
  /** quãng dài nhất (giờ) không có việc xây/nâng/tiến hóa nào được bắt đầu khi người chơi đang hoạt động */
  maxGapH: number;
  /** tỉ lệ thời gian hoạt động mà kho đầy ≥95% của từng vật liệu chính */
  full: Record<string, number>;
  built: number;
  final: PlayerState;
}

const ORDER: BKey[] = ['nhadan', 'ruong', 'khothoc', 'chuong', 'cho', 'benthuyen', 'thapcanh', 'tuong', 'coixay', 'bep'];
const MAIN: ResKey[] = ['go', 'da', 'tre', 'sat'];
const STEP = 2 * 60_000;

export function runSim(days: number, t0 = 1_000_000): SimReport {
  const s = newPlayer('sim', 'Sim', t0);
  s.shield = 0;
  const rep: SimReport = { nhaDan: null, leu2: null, leu3: null, leu4: null, leu5: null, allLv3: null, maxGapH: 0, full: {}, built: 0, final: s };
  const cells: { x: number; y: number }[] = [];
  for (let y = 2; y < 22; y++) for (let x = 2; x < 22; x++) if (isLand(s, x, y)) cells.push({ x, y });
  let ci = 0;
  let lastProgress = 0;
  let activeSteps = 0;
  const fullSteps: Record<string, number> = Object.fromEntries(MAIN.map((k) => [k, 0]));
  const total = days * 24 * 60;
  for (let m = 0; m < total; m += 2) {
    const now = t0 + m * 60_000;
    tick(s, now);
    const hourOfDay = (m / 60) % 24;
    const active = hourOfDay < 16;
    const hGame = s.gt / 3600_000;
    const dinhDone = s.dinh.some((d) => d.k === 'nhadan' && d.lv >= 1);
    if (rep.nhaDan === null && dinhDone) rep.nhaDan = (m / 60);
    for (const [tier, key] of [[2, 'leu2'], [3, 'leu3'], [4, 'leu4'], [5, 'leu5']] as const) if (rep[key] === null && s.lv.leu.tier >= tier) rep[key] = m / 60;
    if (rep.allLv3 === null && s.dinh.filter((d) => d.lv >= 3).length >= 25) rep.allLv3 = m / 60;
    if (!active) continue;
    const building = rep.allLv3 === null; // chỉ đo độ đầy kho khi còn đang xây dựng
    if (building) activeSteps++;
    // nhặt mọi điểm đã mọc lại
    for (const n of s.nodes) if (s.gt >= n.readyAt) apply(s, { t: 'gather', node: n.id });
    // mở hòm báu (nguồn vỏ sò chính)
    for (const c of [...s.chests]) apply(s, { t: 'chest', id: c.id });
    let progressed = false;
    if (apply(s, { t: 'evolve', lv: 'leu' }).ok) progressed = true;
    for (const k of ORDER) {
      const have = s.dinh.filter((d) => d.k === k);
      if (have.length < BUILDINGS[k].max) {
        for (let tries = 0; tries < 6 && ci < cells.length; tries++) {
          const c = cells[ci];
          const o = apply(s, { t: 'xay', k, x: c.x, y: c.y });
          if (o.ok) { ci++; progressed = true; rep.built++; break; }
          if (/Ô này không xây/.test(o.msg)) ci++;
          else break;
        }
      }
      for (const d of have) if (apply(s, { t: 'nang', id: d.id }).ok) progressed = true;
    }
    // cho Nhà chính ăn món nó thích
    const l = s.lv.leu;
    if (l.tier < 5 && l.xp < XP_TO_NEXT[l.tier - 1]) {
      const likes = Object.entries(LINH_VAT.leu.likes).filter(([, v]) => (v as number) > 0).map(([k]) => k as ResKey);
      likes.sort((a, b) => s.res[b] - s.res[a]);
      for (let i = 0; i < 6 && s.res[likes[0]] >= 5 + 40; i++) apply(s, { t: 'feed', lv: 'leu', res: likes[0] });
    }
    if (apply(s, { t: 'evolve', lv: 'leu' }).ok) progressed = true;
    if (progressed) {
      rep.maxGapH = Math.max(rep.maxGapH, (hGame - lastProgress));
      lastProgress = hGame;
    }
    const cap = storageCap(s);
    if (building) for (const k of MAIN) if (s.res[k] >= cap * 0.95) fullSteps[k]++;
  }
  rep.maxGapH = Math.max(rep.maxGapH, s.gt / 3600_000 - lastProgress);
  for (const k of MAIN) rep.full[k] = activeSteps ? fullSteps[k] / activeSteps : 0;
  return rep;
}
