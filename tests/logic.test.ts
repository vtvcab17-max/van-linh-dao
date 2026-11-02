import { describe, expect, it } from 'vitest';
import { apply, buildMs, newPlayer, tick, raid, applyRaidAgainstMe, publicOf, landCount, expandCost, resolveRaid, teamSpec } from '../shared/logic';
import { allBots } from '../shared/bots';
import { simulate, teamFromMonsters, teamFromSpec } from '../shared/battle';
import { mulberry32 } from '../shared/rng';
import { WILDS, XP_TO_NEXT } from '../shared/data';

const T0 = Date.UTC(2026, 10, 2, 12);

describe('đảo khởi đầu', () => {
  it('có 16 ô đất, 7 điểm tài nguyên, 1 hòm', () => {
    const s = newPlayer('u1', 'An', T0);
    expect(landCount(s)).toBe(16);
    expect(s.nodes.length).toBe(7);
    expect(s.chests.length).toBe(1);
  });
  it('nhặt tài nguyên rồi phải chờ mọc lại', () => {
    const s = newPlayer('u1', 'An', T0);
    const grass = s.nodes.find((n) => n.kind === 'grass')!;
    const a = apply(s, { t: 'gather', node: grass.id });
    expect(a.ok).toBe(true);
    expect(a.gained?.co).toBe(4);
    expect(apply(s, { t: 'gather', node: grass.id }).ok).toBe(false);
    tick(s, T0 + 41_000);
    expect(apply(s, { t: 'gather', node: grass.id }).ok).toBe(true);
  });
});

describe('linh vật', () => {
  it('ăn đúng món thì vui và có linh khí, ăn sai thì dỗi', () => {
    const s = newPlayer('u1', 'An', T0);
    const ok = apply(s, { t: 'feed', lv: 'leu', res: 'co' });
    expect(ok.ok).toBe(true);
    expect(s.lv.leu.xp).toBeGreaterThan(0);
    expect(s.lv.leu.mood).toBe('vui');
    const bad = apply(s, { t: 'feed', lv: 'cuoc', res: 'co' });
    expect(bad.ok).toBe(true);
    expect(s.lv.cuoc.mood).toBe('doi');
  });
  it('tiến hóa lên bậc 2 mở khóa Thu Hà', () => {
    const s = newPlayer('u1', 'An', T0);
    s.res.la = 200;
    s.res.so = 100;
    while (s.lv.leu.xp < XP_TO_NEXT[0]) apply(s, { t: 'feed', lv: 'leu', res: 'la' });
    const e = apply(s, { t: 'evolve', lv: 'leu' });
    expect(e.ok).toBe(true);
    expect(s.lv.leu.tier).toBe(1); // đang xây
    expect(apply(s, { t: 'evolve', lv: 'cuoc' }).ok).toBe(false); // chỉ một đội thợ
    tick(s, T0 + 30_000);
    expect(s.lv.leu.tier).toBe(1);
    tick(s, T0 + 61_000);
    expect(s.lv.leu.tier).toBe(2);
    expect(s.comps.ha.unlocked).toBe(true);
  });
  it('bậc càng cao xây càng lâu, khai hoang càng nhiều càng đắt', () => {
    expect(buildMs('leu', 4)).toBeGreaterThan(buildMs('leu', 3));
    expect(buildMs('leu', 3)).toBeGreaterThan(buildMs('leu', 2));
    const s = newPlayer('u1', 'An', T0);
    const c0 = expandCost(s);
    let land = s.land.split('');
    for (let x = 4; x < 20; x++) land[9 * 24 + x] = '1';
    s.land = land.join('');
    const c1 = expandCost(s);
    expect((c1.da ?? 0)).toBeGreaterThan((c0.da ?? 0) * 3);
    expect(c1.go).toBeGreaterThan(0);
  });
});

describe('khai hoang', () => {
  it('chỉ khai hoang ô sát đảo và tốn đá + tre', () => {
    const s = newPlayer('u1', 'An', T0);
    s.res.da = 50; s.res.tre = 50; s.quests.push('q_expand');
    expect(apply(s, { t: 'expand', x: 2, y: 2 }).ok).toBe(false);
    const c = expandCost(s);
    expect(apply(s, { t: 'expand', x: 14, y: 11 }).ok).toBe(true);
    expect(s.res.da).toBe(50 - (c.da ?? 0));
    expect(landCount(s)).toBe(17);
  });
});

describe('trận đánh', () => {
  it('cùng hạt giống thì cùng kết quả', () => {
    const s = newPlayer('u1', 'An', T0);
    const spec = teamSpec(s, false);
    const r1 = simulate(teamFromSpec(spec, 0), teamFromMonsters(WILDS[0].enemies, 1), mulberry32(42));
    const r2 = simulate(teamFromSpec(spec, 0), teamFromMonsters(WILDS[0].enemies, 1), mulberry32(42));
    expect(r1.events).toEqual(r2.events);
  });
  it('đội mới thắng được Bãi Cua phần lớn số lần', () => {
    const s = newPlayer('u1', 'An', T0);
    const spec = teamSpec(s, false);
    let wins = 0;
    for (let i = 0; i < 200; i++) {
      const r = simulate(teamFromSpec(spec, 0), teamFromMonsters(WILDS[0].enemies, 1), mulberry32(i));
      if (r.winner === 0) wins++;
    }
    expect(wins).toBeGreaterThan(130);
  });
});

describe('đột kích', () => {
  it('server tính lại ra đúng kết quả client gửi', () => {
    const s = newPlayer('u1', 'An', T0);
    const bot = allBots(T0)[2];
    const out = raid(s, bot);
    expect(out.ok).toBe(true);
    const again = resolveRaid(teamSpec(newPlayer('u1', 'An', T0), false), bot, out.event!.seed);
    expect(again.battle.winner === 0).toBe(out.event!.win);
  });
  it('mất tài nguyên nhưng không đụng phần được bảo vệ, không áp dụng hai lần', () => {
    const s = newPlayer('u2', 'Ba', T0);
    s.res.co = 100;
    const ev = { id: 'r1', attackerId: 'x', attackerName: 'X', targetId: 'u2', targetName: '', win: true, loot: { co: 90 }, seed: 1, t: T0 };
    applyRaidAgainstMe(s, ev);
    expect(s.res.co).toBe(40);
    expect(applyRaidAgainstMe(s, ev)).toBeNull();
  });
  it('bản công khai không lộ phần được bảo vệ', () => {
    const s = newPlayer('u3', 'C', T0);
    s.res.da = 30;
    expect(publicOf(s).lootable.da).toBeUndefined();
  });
});

describe('đi thuyền', () => {
  it('đi mất thời gian, đánh khi cập đảo, về bến mới nhận chiến lợi phẩm', () => {
    const s = newPlayer('u1', 'An', T0);
    expect(apply(s, { t: 'sail', kind: 'wild', id: 'baicua' }).ok).toBe(true);
    expect(apply(s, { t: 'sail', kind: 'wild', id: 'ransua' }).ok).toBe(false);
    const v = s.voyage!;
    const one = v.arriveAt - v.departAt;
    expect(one).toBeGreaterThanOrEqual(60_000);
    tick(s, T0 + one / 2);
    expect(s.stats.battles).toBe(0);
    tick(s, T0 + one + 1000);
    expect(s.stats.battles).toBe(1);
    expect(s.voyage?.phase).toBe('ve');
    const sat = s.res.sat;
    tick(s, T0 + one * 2 + 2000);
    expect(s.voyage).toBeNull();
    if (s.lastBattle!.o.battle!.winner === 0) expect(s.res.sat).toBeGreaterThan(sat);
  });
  it('thuyền tiến hóa thì đi nhanh hơn', () => {
    const a = newPlayer('u1', 'An', T0);
    const b = newPlayer('u2', 'Ba', T0);
    b.lv.thuyen.tier = 3;
    apply(a, { t: 'sail', kind: 'wild', id: 'trailhaitac' });
    apply(b, { t: 'sail', kind: 'wild', id: 'trailhaitac' });
    expect(b.voyage!.arriveAt).toBeLessThan(a.voyage!.arriveAt);
  });
  it('đột kích bằng thuyền gửi sự kiện cho đảo bị đánh', () => {
    const s = newPlayer('u1', 'An', T0);
    const bot = allBots(T0)[2];
    expect(apply(s, { t: 'sail', kind: 'island', target: bot, to: { x: 5, y: 5 } }).ok).toBe(true);
    tick(s, T0 + (s.voyage!.arriveAt - s.voyage!.departAt) + 1000);
    expect(s.outbox.length).toBe(1);
    expect(s.outbox[0].targetId).toBe(bot.id);
  });
});

import { cleanAvatar, avatarFrom } from '../shared/avatar';
import { islandCell } from '../shared/map';

describe('Đảo và nhân vật', () => {
  it('mỗi người một hình đảo, luôn đủ 16 ô và chỗ cho công trình', () => {
    const shapes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const s = newPlayer('p' + i, 'X', T0);
      shapes.add(s.land + s.nodes.map((n) => `${n.x},${n.y}`).join(';'));
      expect(s.land.split('').filter((c) => c === '1').length).toBe(16);
      for (const [x, y] of [[11, 11], [12, 12], [10, 13]]) expect(s.land[y * 24 + x]).toBe('1');
      for (const n of s.nodes) expect(s.land[n.y * 24 + n.x]).toBe('1');
    }
    expect(shapes.size).toBe(100);
  });
  it('dáng vẻ nhân vật: kiểm giá trị, đổi được bằng hành động', () => {
    expect(cleanAvatar({ g: 3 })).toBeNull();
    expect(cleanAvatar(avatarFrom('x'))).toEqual(avatarFrom('x'));
    const s = newPlayer('u9', 'An', T0);
    expect(s.avatarSet).toBe(false);
    expect(apply(s, { t: 'avatar', av: { g: 1, sk: 0, ha: 2, hc: 1, to: 1, tc: 7, hat: 1, it: 0 } }).ok).toBe(true);
    expect(s.avatar.g).toBe(1);
    expect(s.avatarSet).toBe(true);
    expect(apply(s, { t: 'avatar', av: { g: 1, sk: 99 } as never }).ok).toBe(false);
  });
  it('vị trí đảo trên hải đồ cố định theo mã đảo', () => {
    expect(islandCell('abc')).toEqual(islandCell('abc'));
  });
});

import { fightBoss, bossCheck } from '../shared/logic';
import { BOSS_FORMS, WEEK0, WEEK_MS, weekOf, bossOf, ascendSlots, bossPoolMax } from '../shared/boss';
import { ascend } from '../shared/logic';

describe('Thủy Tinh, trang bị, phi thăng', () => {
  const strong = (id: string) => {
    const s = newPlayer(id, 'Lan', WEEK0 + 1000);
    for (const k of ['leu', 'cuoc', 'rao', 'thuyen'] as const) s.lv[k].tier = 5;
    for (const k of ['an', 'ngoc', 'ha', 'chau'] as const) s.comps[k] = { lv: 20, xp: 0, unlocked: true };
    s.res = { ...s.res, co: 9999, la: 9999, tre: 9999, go: 9999, cui: 9999, da: 9999, sat: 9999, so: 9999, ngoc: 99, tien: 9999, lt: 0 };
    return s;
  };
  it('chế tạo trang bị cần công trình đủ bậc và tài nguyên', () => {
    const s = newPlayer('g1', 'An', T0);
    expect(apply(s, { t: 'craft', g: 'giao' }).ok).toBe(false);
    const p = strong('g2');
    expect(apply(p, { t: 'craft', g: 'giao' }).ok).toBe(true);
    expect(p.kho.giao).toBe(1);
  });
  it('chưa đủ bậc thì không ra Mắt Bão được', () => {
    expect(bossCheck(newPlayer('g3', 'An', T0))).not.toBeNull();
    expect(bossCheck(strong('g4'))).toBeNull();
  });
  it('thua Thủy Tinh: mất trang bị mang theo, thuyền về bậc 1', () => {
    const s = strong('g5');
    for (const k of ['an', 'ngoc', 'ha', 'chau'] as const) s.comps[k].lv = 3;
    s.kho = { giao: 2, khien: 1, thuoc: 0, bua: 0 };
    expect(apply(s, { t: 'sail', kind: 'boss', carry: { giao: 2 } }).ok).toBe(true);
    expect(s.kho.giao).toBe(0);
    tick(s, s.lastReal + 3 * 3600_000);
    expect(s.voyage).toBeNull();
    expect(s.lv.thuyen.tier).toBe(1);
    expect(s.kho).toEqual({ giao: 0, khien: 1, thuoc: 0, bua: 0 });
    expect(s.asc).toBe(0);
    expect(s.boss.best).toBeGreaterThan(0);
  });
  it('đội mạnh nhất cũng không hạ nổi Thủy Tinh một mình: chỉ góp sát thương, trụ được thì rút về', () => {
    const s = strong('g6');
    s.kho = { giao: 5, khien: 5, thuoc: 5, bua: 3 };
    apply(s, { t: 'sail', kind: 'boss', carry: { ...s.kho } });
    tick(s, s.lastReal + 6 * 3600_000);
    expect(s.asc).toBe(0);
    expect(s.boss.won).toBe(false);
    expect(s.boss.total).toBeGreaterThan(0);
    expect(s.bossOut.length).toBe(1);
    expect(s.bossOut[0].d).toBe(s.boss.total);
    expect(s.boss.total).toBeLessThan(bossOf(0).hp);
  });
  it('Thiên Môn: server cho phi thăng, tuần sau hồi sinh, đã hạ thì không đánh nữa', () => {
    const s = strong('g7');
    s.kho = { giao: 5, khien: 5, thuoc: 5, bua: 3 };
    ascend(s, 1);
    expect(s.asc).toBe(1);
    expect(s.boss.won).toBe(true);
    expect(bossCheck(s)).not.toBeNull();
    tick(s, WEEK0 + WEEK_MS + 1000);
    expect(s.boss.won).toBe(false);
    expect(s.asc).toBe(1);
    expect(weekOf(s.lastReal)).toBe(1);
    expect(bossCheck(s)).toBeNull();
    s.thienMon = { week: 1, done: true };
    expect(bossCheck(s)).not.toBeNull();
  });
  it('số chỗ Thiên Môn: tối đa 3 người, không quá 5% người chơi', () => {
    expect(ascendSlots(10)).toBe(1);
    expect(ascendSlots(40)).toBe(2);
    expect(ascendSlots(1000)).toBe(3);
    expect(bossPoolMax(10)).toBe(300_000);
    expect(bossPoolMax(100)).toBe(1_200_000);
  });
  it('mỗi tuần một dạng Thủy Tinh', () => {
    expect(new Set(BOSS_FORMS.map((f) => f.title)).size).toBe(4);
    void fightBoss;
  });
});

import { incomePerHour, raid as raidNow, homeCell } from '../shared/logic';
import { routesAt, tollPerHour, routePeriod, ROUTE_MS } from '../shared/economy';

describe('Kinh tế: nhà cửa, thuế, cửa hàng, thôn tính', () => {
  const rich = (id: string) => {
    const s = newPlayer(id, 'Lan', T0);
    for (const k of ['leu', 'cuoc', 'rao', 'thuyen'] as const) s.lv[k].tier = 4;
    for (const k of ['an', 'ngoc', 'ha', 'chau'] as const) s.comps[k] = { lv: 18, xp: 0, unlocked: true };
    s.res = { ...s.res, co: 5000, la: 5000, tre: 5000, go: 5000, cui: 5000, da: 5000, sat: 5000, so: 5000, ngoc: 50, tien: 5000, lt: 0 };
    return s;
  };
  const freeTile = (s: ReturnType<typeof rich>) => {
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) if (s.land[y * 24 + x] === '1' && !s.nodes.some((n) => n.x === x && n.y === y) && !s.chests.some((c) => c.x === x && c.y === y) && !s.dinh.some((d) => d.x === x && d.y === y) && !(x === 11 && y === 11) && !(x === 12 && y === 12) && !(x === 10 && y === 13)) return { x, y };
    return null;
  };
  it('xây nhà dân: tốn thợ, xong thì nộp thuế', () => {
    const s = rich('e1');
    const t = freeTile(s)!;
    expect(apply(s, { t: 'xay', k: 'nhadan', x: t.x, y: t.y }).ok).toBe(true);
    expect(apply(s, { t: 'xay', k: 'nhadan', x: t.x, y: t.y }).ok).toBe(false);
    tick(s, s.lastReal + 3 * 60_000);
    expect(s.dinh[0].lv).toBe(1);
    expect(incomePerHour(s).dan).toBe(4);
    const before = s.res.tien;
    tick(s, s.lastReal + 3600_000);
    expect(s.res.tien).toBeGreaterThanOrEqual(before + 4);
  });
  it('tuyến buôn đổi mỗi 6 giờ, đảo sát tuyến thu thuế', () => {
    const p = routePeriod(T0);
    expect(JSON.stringify(routesAt(p))).not.toBe(JSON.stringify(routesAt(p + 1)));
    const rt = routesAt(p)[0];
    expect(tollPerHour(rt.pts[1], p, 1)).toBeGreaterThan(0);
    expect(routePeriod(T0 + ROUTE_MS)).toBe(p + 1);
  });
  it('cửa hàng bán bằng tiền đồng, vật phẩm dùng được', () => {
    const s = rich('e2');
    expect(apply(s, { t: 'mua', offer: 'bc' }).ok).toBe(true);
    expect(s.bag.banhchung).toBe(1);
    s.lv.leu.hunger = 90;
    expect(apply(s, { t: 'dung', item: 'banhchung' }).ok).toBe(true);
    expect(s.lv.leu.hunger).toBe(0);
  });
  it('thôn tính đảo máy thành chư hầu, nhận cống nạp, làm cứ điểm', () => {
    const s = rich('e3');
    const t = freeTile(s)!;
    s.dinh.push({ id: 'dx', k: 'donbinh', x: t.x, y: t.y, lv: 1 });
    const bot = allBots(T0)[0];
    const o = raidNow(s, bot, false, true);
    expect(o.ok).toBe(true);
    if (o.battle?.winner === 0) {
      expect(s.chuHau.length).toBe(1);
      expect(incomePerHour(s).cong).toBeGreaterThan(0);
      expect(o.event?.conquer).toBe(true);
    }
    void homeCell;
  });
  it('bị chiếm thì thành chư hầu, khởi nghĩa thắng thì tự do', () => {
    const v = rich('e4');
    applyRaidAgainstMe(v, { id: 'r1', attackerId: 'lord', attackerName: 'Chủ', targetId: 'e4', targetName: 'x', win: true, loot: {}, seed: 1, t: 0, conquer: true, until: v.lastReal + 3600_000 });
    expect(v.chuQuan?.id).toBe('lord');
    expect(incomePerHour(v).nop).toBeGreaterThan(0);
    tick(v, v.lastReal + 2 * 3600_000);
    expect(v.chuQuan).toBeNull();
  });
});

describe('nhân vật chỉ đổi một lần', () => {
  it('lần đầu miễn phí, lần sau cần Thẻ Đổi Giao Diện', () => {
    const s = newPlayer('av1', 'Thử', 1000);
    const av = { ...s.avatar, ha: (s.avatar.ha + 1) % 5 };
    expect(apply(s, { t: 'avatar', av }).ok).toBe(true);
    const av2 = { ...av, ha: (av.ha + 1) % 5 };
    expect(apply(s, { t: 'avatar', av: av2 }).ok).toBe(false);
    s.bag.thegd = 1;
    expect(apply(s, { t: 'avatar', av: av2 }).ok).toBe(true);
    expect(s.bag.thegd).toBe(0);
    expect(apply(s, { t: 'avatar', av }).ok).toBe(false);
  });
});

import { addGeneral } from '../shared/logic';
import { PITY, SPIN_COST, WHEEL_TOTAL, LT_BUY_DAILY } from '../shared/gacha';
describe('Linh Thạch, vòng quay, tướng', () => {
  it('bảng giải đủ 10.000 và quay tốn đúng Linh Thạch', () => {
    expect(WHEEL_TOTAL).toBe(10_000);
    const s = newPlayer('lt1', 'An', T0);
    expect(apply(s, { t: 'quay', n: 1 }).ok).toBe(false);
    s.res.lt = SPIN_COST;
    const o = apply(s, { t: 'quay', n: 1 });
    expect(o.ok).toBe(true);
    expect(o.spin?.length).toBe(1);
    expect(s.res.lt).toBeGreaterThanOrEqual(0);
    expect(s.gacha.spins).toBe(1);
  });
  it('bảo hiểm: quay đủ 60 lần chắc chắn ra đồ truyền thuyết', () => {
    const s = newPlayer('lt2', 'An', T0);
    s.res.lt = 50 * 200;
    let gap = 0, maxGap = 0, legs = 0;
    for (let i = 0; i < 200; i++) {
      const o = apply(s, { t: 'quay', n: 1 });
      if (o.spin![0].leg) { legs++; gap = 0; } else gap++;
      maxGap = Math.max(maxGap, gap);
    }
    expect(maxGap).toBeLessThan(PITY);
    expect(legs).toBeGreaterThanOrEqual(3);
  });
  it('tướng trùng lên sao, đủ 5 sao thành mảnh; chủ tướng ra trận', () => {
    const s = newPlayer('lt3', 'An', T0);
    for (let i = 0; i < 6; i++) addGeneral(s, 'giong');
    expect(s.tuong.giong).toBe(5);
    expect(s.manh).toBe(20);
    expect(s.chuTuong).toBe('giong');
    const p0 = teamSpec(s, false);
    expect(p0.gen?.id).toBe('giong');
    expect(publicOf(s).gen?.star).toBe(5);
  });
  it('đổi đồng vàng lấy Linh Thạch có giới hạn ngày, bán lại rẻ hơn', () => {
    const s = newPlayer('lt4', 'An', T0);
    s.res.tien = 100_000;
    expect(apply(s, { t: 'doiLT', dir: 'mua', n: LT_BUY_DAILY }).ok).toBe(true);
    expect(apply(s, { t: 'doiLT', dir: 'mua', n: 1 }).ok).toBe(false);
    expect(s.res.lt).toBe(LT_BUY_DAILY);
    const before = s.res.tien;
    expect(apply(s, { t: 'doiLT', dir: 'ban', n: 5 }).ok).toBe(true);
    expect(s.res.tien - before).toBe(400);
  });
});

import { worldFor } from '../shared/map';
import { pickSpawn } from '../shared/world';
import { hexDist } from '../shared/hex';
import { isSeen, lordLevel, setHome, cellDist } from '../shared/logic';
describe('Hải đồ lục giác, khám phá, chủ quyền đảo', () => {
  it('thế giới sinh giống nhau ở mọi máy, rộng, nhiều đảo và hang quái', () => {
    const a = worldFor('07'), b = worldFor('07');
    expect(a.isles.map((i) => i.id).join()).toBe(b.isles.map((i) => i.id).join());
    expect(a.isles.length).toBeGreaterThan(180);
    expect(a.lairs.length).toBeGreaterThan(80);
    expect(a.isles.some((i) => i.kind === 'bian')).toBe(true);
    // đảo gần Mắt Bão giàu hơn, khó hơn
    const far = a.isles.filter((i) => i.lv === 1)[0], near = a.isles.filter((i) => i.lv >= 8)[0];
    expect(near.needLvl).toBeGreaterThan(far.needLvl);
    expect(near.guard[0][1]).toBeGreaterThan(far.guard[0][1]);
  });
  it('người chơi mới được rải xa nhau', () => {
    const w = worldFor('01');
    const taken: { c: number; r: number }[] = [];
    for (let i = 0; i < 40; i++) taken.push(pickSpawn(w.spawns, taken, 8)!);
    let min = 99;
    for (let i = 0; i < taken.length; i++) for (let j = i + 1; j < taken.length; j++) min = Math.min(min, hexDist(taken[i], taken[j]));
    expect(min).toBeGreaterThanOrEqual(8);
  });
  it('sương mù: thấy quanh nhà, thám hiểm thì mở thêm', () => {
    const s = newPlayer('f1', 'An', T0);
    setHome(s, '01', { x: 10, y: 10 });
    expect(isSeen(s, 10, 10)).toBe(true);
    expect(isSeen(s, 40, 40)).toBe(false);
    expect(apply(s, { t: 'sail', kind: 'scout', to: { x: 25, y: 12 } }).ok).toBe(true);
    tick(s, T0 + (s.voyage!.arriveAt - s.voyage!.departAt) + 1000);
    expect(isSeen(s, 25, 12)).toBe(true);
    expect(isSeen(s, 18, 11)).toBe(true);
  });
  it('đánh quái giữ đảo, đủ cấp thì cắm cờ, thu sản lượng, xây trên đảo cần cấp', () => {
    const s = newPlayer('f2', 'An', T0);
    for (const k of ['leu', 'cuoc', 'rao', 'thuyen'] as const) s.lv[k].tier = 5;
    for (const k of ['an', 'ngoc', 'ha', 'chau'] as const) s.comps[k] = { lv: 20, xp: 0, unlocked: true };
    const w = worldFor('01');
    const isle = w.isles.find((i) => i.lv === 1 && i.kind !== 'bian')!;
    setHome(s, '01', { x: isle.c + 2, y: isle.r });
    expect(lordLevel(s)).toBeGreaterThanOrEqual(isle.needLvl);
    expect(apply(s, { t: 'sail', kind: 'isle', id: isle.id }).ok).toBe(true);
    const one = s.voyage!.arriveAt - s.voyage!.departAt;
    tick(s, T0 + one + 1000);
    expect(s.lastBattle?.o.battle?.winner).toBe(0);
    expect(s.isles.map((o) => o.id)).toContain(isle.id);
    expect(s.claims.length).toBe(1);
    expect(apply(s, { t: 'sail', kind: 'isle', id: isle.id }).ok).toBe(false);
    tick(s, T0 + one * 2 + 3 * 3600_000);
    const before = s.res.da + s.res.go + s.res.so + s.res.co;
    expect(apply(s, { t: 'thuDao', id: isle.id }).ok).toBe(true);
    expect(s.res.da + s.res.go + s.res.so + s.res.co).toBeGreaterThan(before);
    s.res = { ...s.res, go: 9999, da: 9999, tien: 9999, sat: 9999, tre: 9999 };
    expect(apply(s, { t: 'xayDao', id: isle.id, k: 'don' }).ok).toBe(true);
    expect(cellDist({ x: isle.c, y: isle.r }, { x: isle.c, y: isle.r })).toBe(0);
  });
  it('chưa đủ cấp chúa đảo thì không cắm cờ được đảo cấp cao', () => {
    const s = newPlayer('f3', 'An', T0);
    const isle = worldFor('01').isles.find((i) => i.lv >= 6)!;
    expect(lordLevel(s)).toBeLessThan(isle.needLvl);
  });
});

import { weatherAt, dayPhase, seasonOf, cropProgress, WX_MS } from '../shared/eco';
import { cropState, pending } from '../shared/logic';
describe('Hệ sinh thái thành bang', () => {
  const farm = (id: string) => {
    const s = newPlayer(id, 'Nông', T0);
    for (const k of ['leu', 'cuoc', 'rao', 'thuyen'] as const) s.lv[k].tier = 4;
    s.res = { ...s.res, go: 9999, da: 9999, tre: 9999, co: 9999, la: 9999, sat: 9999, tien: 9999, thoc: 500, rau: 200, thaoduoc: 90, to: 40, gao: 100, ca: 20 };
    return s;
  };
  const build = (s: ReturnType<typeof farm>, k: string, x: number, y: number) => {
    s.dinh.push({ id: `t_${k}`, k: k as any, x, y, lv: 1, last: s.lastReal });
    return s.dinh[s.dinh.length - 1];
  };
  it('thời tiết, ngày đêm, mùa: mọi máy ra giống nhau', () => {
    expect(weatherAt('3,2', T0)).toEqual(weatherAt('3,2', T0 + 1000));
    expect(dayPhase(T0).name).toBeTruthy();
    expect(seasonOf(T0)).toBe(seasonOf(T0 + 3600_000));
    const kinds = new Set<string>();
    for (let i = 0; i < 200; i++) kinds.add(weatherAt('1,1', T0 + i * WX_MS).kind);
    expect(kinds.size).toBeGreaterThanOrEqual(3);
  });
  it('trồng lúa, chờ chín, gặt ra thóc', () => {
    const s = farm('e1');
    const d = build(s, 'ruong', 1, 1);
    expect(apply(s, { t: 'trong', id: d.id, k: 'rau' }).ok).toBe(false);
    expect(apply(s, { t: 'trong', id: d.id, k: 'lua' }).ok).toBe(true);
    expect(apply(s, { t: 'gat', id: d.id }).ok).toBe(false);
    tick(s, T0 + 10 * 3600_000);
    expect(cropState(s, d)!.ripe).toBe(true);
    const before = s.res.thoc;
    expect(apply(s, { t: 'gat', id: d.id }).ok).toBe(true);
    expect(s.res.thoc).toBeGreaterThan(before);
    expect(cropProgress('lua', T0, T0 + 3600_000, '0,0').p).toBeGreaterThan(0);
  });
  it('chuồng ăn thóc, rau ra trứng, thịt; cối xay ra gạo; bếp nấu lương; nhà thuốc ra thuốc', () => {
    const s = farm('e2');
    const ch = build(s, 'chuong', 1, 1), cx = build(s, 'coixay', 2, 1), bep = build(s, 'bep', 3, 1), nt = build(s, 'nhathuoc', 4, 1);
    tick(s, T0 + 3 * 3600_000);
    const th = s.res.thoc;
    expect(apply(s, { t: 'thuNT', id: ch.id }).ok).toBe(true);
    expect(s.res.trung).toBeGreaterThan(0);
    expect(s.res.thoc).toBeLessThan(th);
    expect(apply(s, { t: 'thuNT', id: cx.id }).ok).toBe(true);
    expect(s.res.gao).toBeGreaterThan(100);
    const l0 = s.res.luong;
    expect(apply(s, { t: 'thuNT', id: bep.id }).ok).toBe(true);
    expect(s.res.luong).toBeGreaterThan(l0);
    expect(apply(s, { t: 'thuNT', id: nt.id }).ok).toBe(true);
    expect(s.res.duoc).toBeGreaterThan(3);
    expect(pending(s, ch).h).toBe(0);
  });
  it('học viện nghiên cứu mất thời gian, xong thì có tác dụng', () => {
    const s = farm('e3');
    expect(apply(s, { t: 'hoc', k: 'laBan' }).ok).toBe(false);
    build(s, 'hocvien', 1, 1);
    expect(apply(s, { t: 'hoc', k: 'laBan' }).ok).toBe(true);
    expect(apply(s, { t: 'hoc', k: 'binhPhap' }).ok).toBe(false);
    tick(s, T0 + 2 * 3600_000);
    expect(s.tech.laBan).toBe(1);
    expect(apply(s, { t: 'hoc', k: 'laBan' }).ok).toBe(false); // cần học viện cấp 2
  });
  it('đi biển tốn lương; thiếu lương thì đánh yếu; trang bị và thuyền mòn, sửa được', () => {
    const s = farm('e4');
    s.kho = { giao: 2, khien: 0, thuoc: 0, bua: 0 };
    s.res.luong = 0; s.res.gao = 0; s.res.ca = 0; s.res.thit = 0;
    expect(apply(s, { t: 'sail', kind: 'wild', id: 'trailhaitac' }).ok).toBe(true);
    expect(s.voyage!.need).toBeGreaterThan(0);
    expect(s.voyage!.food).toBe(0);
    tick(s, T0 + (s.voyage!.returnAt - s.voyage!.departAt) + 2000);
    expect(s.voyage).toBeNull();
    expect(s.ben.giao).toBeLessThan(100);
    expect(s.vo).toBeLessThan(100);
    expect(apply(s, { t: 'suaDo' }).ok).toBe(false);
    build(s, 'xuongren', 5, 5);
    expect(apply(s, { t: 'suaDo' }).ok).toBe(true);
    expect(s.ben.giao).toBe(100);
    build(s, 'benthuyen', 6, 5);
    s.res.vai = 50;
    expect(apply(s, { t: 'suaThuyen' }).ok).toBe(true);
    expect(s.vo).toBe(100);
  });
});

import { raidCheck, scoutReport } from '../shared/logic';
describe('Khiên bảo hộ, thám thính', () => {
  it('người mới có khiên 24 giờ: không bị đột kích, bên trong đảo bị che', () => {
    const a = newPlayer('k1', 'A', T0), b = newPlayer('k2', 'B', T0);
    for (const s of [a, b]) for (const k of ['leu', 'cuoc', 'rao', 'thuyen'] as const) s.lv[k].tier = 3;
    expect(raidCheck(a, publicOf(b))).toMatch(/khiên/);
    expect(publicOf(b).team.length).toBe(0);
    tick(b, T0 + 25 * 3600_000);
    tick(a, T0 + 25 * 3600_000);
    expect(raidCheck(a, publicOf(b))).toBeNull();
    expect(publicOf(b).team.length).toBeGreaterThan(0);
    expect(scoutReport(b).land.length).toBe(576);
  });
  it('ra quân đánh người khác thì khiên vỡ; dùng Khiên Bảo Hộ 8 giờ', () => {
    const a = newPlayer('k3', 'A', T0), b = newPlayer('k4', 'B', T0);
    for (const s of [a, b]) for (const k of ['leu', 'cuoc', 'rao', 'thuyen'] as const) s.lv[k].tier = 3;
    b.shield = 0;
    expect(a.shield).toBeGreaterThan(T0);
    expect(apply(a, { t: 'sail', kind: 'island', target: publicOf(b), to: { x: 5, y: 5 } }).ok).toBe(true);
    expect(a.shield).toBe(0);
    b.bag.khien8 = 1;
    expect(apply(b, { t: 'dung', item: 'khien8' }).ok).toBe(true);
    expect(b.shield).toBeGreaterThan(b.lastReal + 7 * 3600_000);
  });
});
