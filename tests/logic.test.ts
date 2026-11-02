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
    expect(one).toBeGreaterThan(60_000);
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
    tick(s, T0 + 10 * 60_000);
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
