// Mô phỏng cân bằng: một "người chơi chăm" do máy điều khiển chơi liên tục N giờ (tính theo giờ game),
// ghi lại các mốc tiến triển, đường tài nguyên, và tỉ lệ thắng từng đảo quái. Không cần trình duyệt.
// Dùng: npx tsx tools/balance-sim.mts [số giờ] [số người chơi mô phỏng]
import fs from 'fs';
import { CHESTS, FEEDABLE, LINH_VAT, LV_KEYS, WILDS, XP_TO_NEXT, EVOLVE_COST, type LvKey, type ResKey } from '../shared/data';
import { apply, canPay, expandCost, isLand, landCap, landCount, newPlayer, power, teamSpec, tick, type PlayerState } from '../shared/logic';
import { simulate, teamFromMonsters, teamFromSpec } from '../shared/battle';
import { mulberry32 } from '../shared/rng';

const HOURS = Number(process.argv[2] ?? 8);
const PLAYERS = Number(process.argv[3] ?? 20);
const STEP = 30_000; // người chơi thao tác mỗi 30 giây
const T0 = Date.UTC(2026, 10, 2);

function feedPlan(s: PlayerState): void {
  for (const k of LV_KEYS) {
    const l = s.lv[k];
    if (l.tier >= 5) continue;
    const need = XP_TO_NEXT[l.tier - 1];
    if (l.xp >= need) continue;
    if (k === 'thuyen' && l.tier >= 3) continue; // người chơi ưu tiên nhà và cuốc trước
    const likes = Object.entries(LINH_VAT[k].likes).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).map(([r]) => r as ResKey);
    // giữ lại đá + tre để khai hoang và tiến hóa
    for (const r of likes) {
      const reserve = r === 'da' || r === 'tre' ? 12 : 0;
      if (s.res[r] >= 5 + reserve) {
        apply(s, { t: 'feed', lv: k, res: r });
        break;
      }
    }
  }
}

function runOne(seed: number) {
  const s = newPlayer(`sim${seed}`, `Sim ${seed}`, T0, `sim-seed-${seed}`);
  const ms: Record<string, number> = {};
  const mark = (k: string) => (ms[k] ??= Math.round(s.gt / 60_000));
  const curve: { h: number; power: number; land: number; tiers: string; so: number }[] = [];
  let now = T0;
  const end = T0 + HOURS * 3600_000;
  let nextCurve = 0;
  while (now < end) {
    now += STEP;
    const before = Object.fromEntries(LV_KEYS.map((k) => [k, s.lv[k].tier]));
    tick(s, now);
    for (const k of LV_KEYS) if (s.lv[k].tier !== before[k]) mark(`${k}${s.lv[k].tier}`);
    for (const n of s.nodes) if (s.gt >= n.readyAt) apply(s, { t: 'gather', node: n.id });
    for (const c of [...s.chests]) apply(s, { t: 'chest', id: c.id });
    feedPlan(s);
    for (const k of LV_KEYS) {
      const l = s.lv[k];
      if (l.tier < 5 && l.xp >= XP_TO_NEXT[l.tier - 1] && canPay(s, EVOLVE_COST[l.tier - 1])) {
        apply(s, { t: 'evolve', lv: k });
      }
    }
    const cost = expandCost(s);
    if (landCount(s) < landCap(s) && (s.res.da ?? 0) >= (cost.da ?? 0) + 15 && (s.res.tre ?? 0) >= (cost.tre ?? 0) + 10 && (s.res.go ?? 0) >= (cost.go ?? 0)) {
      outer: for (let y = 1; y < 23; y++)
        for (let x = 1; x < 23; x++)
          if (!isLand(s, x, y) && (isLand(s, x + 1, y) || isLand(s, x - 1, y) || isLand(s, x, y + 1) || isLand(s, x, y - 1))) {
            if (apply(s, { t: 'expand', x, y }).ok) break outer;
          }
    }
    // ghi nhận trận vừa đánh khi thuyền cập đảo
    if (s.lastBattle && !s.lastBattle.seen) {
      s.lastBattle.seen = true;
      if (s.lastBattle.o.battle?.winner === 0) mark(`thang_${s.voyage?.targetId ?? s.lastBattle.title}`);
    }
    // thuyền ở bến thì chở đội ra đảo quái đầu tiên đã có quái (thử từ thấp lên)
    if (!s.voyage)
      for (const w of WILDS) {
        const st = s.wilds[w.id];
        if (st && s.gt < st.readyAt) continue;
        apply(s, { t: 'sail', kind: 'wild', id: w.id });
        break;
      }
    if (s.comps.ha.unlocked) mark('mo_thu_ha');
    if (s.comps.chau.unlocked) mark('mo_minh_chau');
    if (s.gt >= nextCurve) {
      curve.push({ h: Math.round(s.gt / 3600_000 * 10) / 10, power: power(s), land: landCount(s), tiers: `${s.lv.leu.tier}/${s.lv.cuoc.tier}/${s.lv.rao.tier}`, so: s.res.so });
      nextCurve += 3600_000;
    }
  }
  return { ms, curve, final: { power: power(s), land: landCount(s), tiers: { leu: s.lv.leu.tier, cuoc: s.lv.cuoc.tier, rao: s.lv.rao.tier }, comps: Object.fromEntries(Object.entries(s.comps).map(([k, c]) => [k, c.lv])), stats: s.stats } };
}

const runs = Array.from({ length: PLAYERS }, (_, i) => runOne(i + 1));
const median = (xs: number[]) => {
  const a = xs.filter((x) => Number.isFinite(x)).sort((p, q) => p - q);
  return a.length ? a[Math.floor(a.length / 2)] : null;
};
const keys = [...new Set(runs.flatMap((r) => Object.keys(r.ms)))].sort();
const milestones = Object.fromEntries(keys.map((k) => [k, { phut_trung_vi: median(runs.map((r) => r.ms[k] ?? NaN)), dat: runs.filter((r) => r.ms[k] !== undefined).length + '/' + PLAYERS }]));

// tỉ lệ thắng từng đảo quái theo cấp đội
const winMatrix: Record<string, Record<string, number>> = {};
for (const lv of [1, 3, 5, 8, 12]) {
  const row: Record<string, number> = {};
  for (const w of WILDS) {
    let win = 0;
    for (let i = 0; i < 200; i++) {
      const comps = [{ k: 'an' as const, lv }, { k: 'ngoc' as const, lv }, ...(lv >= 3 ? [{ k: 'ha' as const, lv }] : []), ...(lv >= 5 ? [{ k: 'chau' as const, lv }] : [])];
      const r = simulate(teamFromSpec({ comps, cuocTier: Math.min(5, 1 + Math.floor(lv / 3)) }, 0), teamFromMonsters(w.enemies, 1), mulberry32(i * 7919 + lv));
      if (r.winner === 0) win++;
    }
    row[w.name] = Math.round((win / 200) * 100);
  }
  winMatrix[`Đội cấp ${lv}`] = row;
}

// kỳ vọng phẩm hòm
const totalW = CHESTS.reduce((t, c) => t + c.weight, 0);
const chestOdds = Object.fromEntries(CHESTS.map((c) => [c.name, `${((c.weight / totalW) * 100).toFixed(1)}%`]));

const report = { gio_mo_phong: HOURS, so_nguoi: PLAYERS, moc_tien_trien_phut: milestones, duong_suc_manh_nguoi_dau: runs[0].curve, ket_thuc_trung_vi: { power: median(runs.map((r) => r.final.power)), land: median(runs.map((r) => r.final.land)), leu: median(runs.map((r) => r.final.tiers.leu)), cuoc: median(runs.map((r) => r.final.tiers.cuoc)), rao: median(runs.map((r) => r.final.tiers.rao)) }, ti_le_thang_dao_quai_phan_tram: winMatrix, ti_le_pham_hom: chestOdds };
fs.mkdirSync('/tmp/claude-0/shots', { recursive: true });
fs.writeFileSync('/tmp/claude-0/shots/balance.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));
