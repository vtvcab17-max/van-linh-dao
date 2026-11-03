// Không gian bên trong công trình: tường, sàn, đồ đạc theo từng loại (96x56 điểm ảnh, phóng nguyên lần).
import { C, cnv, outline, P } from './pal';
import { enhance } from '../art/hd';
import type { BKey } from '../../../shared/economy';

const W = 96, H = 56, FLOOR = 34;

function wall(p: P, a: string, b: string, line: string) {
  p.rect(0, 0, W, FLOOR, a);
  for (let x = 0; x < W; x += 8) p.v(x, 0, FLOOR - 1, line);
  for (let y = 4; y < FLOOR; y += 8) for (let x = 0; x < W; x += 16) p.px(x + 3, y, b);
}
function floor(p: P, a: string, b: string, line: string) {
  p.rect(0, FLOOR, W, H - FLOOR, a);
  for (let y = FLOOR; y < H; y += 5) p.h(0, W - 1, y, line);
  for (let y = FLOOR + 2, i = 0; y < H; y += 5, i++) for (let x = (i % 2) * 6; x < W; x += 12) p.v(x, y, y + 2, b);
  p.h(0, W - 1, FLOOR - 1, C.wood3);
  p.h(0, W - 1, FLOOR, C.wood2);
}
function window_(p: P, x: number, y: number, sky = C.sea) {
  p.rect(x - 1, y - 1, 16, 14, C.wood2);
  p.rect(x, y, 14, 12, sky);
  p.rect(x + 1, y + 1, 5, 4, C.foam);
  p.v(x + 7, y, y + 11, C.wood2);
  p.h(x, x + 13, y + 6, C.wood2);
}
function sack(p: P, x: number, y: number, c = C.straw) {
  p.ell(x, y, 4, 5, c);
  p.rect(x - 2, y - 7, 5, 2, C.straw3);
  p.px(x - 1, y - 1, C.white);
}
function barrel(p: P, x: number, y: number) {
  p.rect(x - 4, y - 8, 9, 10, C.wood);
  p.h(x - 4, x + 4, y - 6, C.metal3);
  p.h(x - 4, x + 4, y - 1, C.metal3);
  p.v(x - 2, y - 8, y + 1, C.wood2);
  p.ell(x, y - 8, 4, 1, C.wood2);
}
function hay(p: P, x: number, y: number) {
  p.rect(x - 6, y - 5, 13, 7, C.straw);
  p.h(x - 6, x + 6, y - 3, C.straw2);
  p.h(x - 6, x + 6, y, C.straw2);
  p.v(x - 2, y - 5, y + 1, C.straw3);
  p.v(x + 3, y - 5, y + 1, C.straw3);
}
function lamp(p: P, x: number, y: number) {
  p.v(x, y - 6, y - 3, C.metal3);
  p.rect(x - 2, y - 3, 5, 5, C.gold);
  p.rect(x - 1, y - 2, 3, 3, '#fff6c0');
  p.h(x - 2, x + 2, y + 2, C.gold3);
}
function crate(p: P, x: number, y: number) {
  p.rect(x - 4, y - 7, 9, 8, C.wood);
  p.rect(x - 4, y - 7, 9, 1, C.wood2);
  p.line(x - 4, y - 7, x + 4, y, C.wood2);
  p.rect(x - 4, y, 9, 1, C.wood3);
}

const DRAW: Record<string, (p: P) => void> = {
  field: (p) => {
    p.rect(0, 0, W, H, C.sea);
    p.rect(0, 0, W, 24, '#a8dcf2');
    p.ell(78, 9, 6, 6, C.gold);
    p.ell(78, 9, 4, 4, '#fff6c0');
    for (const [x, y] of [[14, 8], [30, 5], [50, 11]] as [number, number][]) { p.ell(x, y, 6, 2, C.foam); p.ell(x + 4, y - 1, 4, 2, C.foam); }
    p.rect(0, 24, W, H - 24, C.grass2);
    p.rect(0, 24, W, 2, C.grass);
    for (let y = 32; y < H; y += 6) { p.h(0, W - 1, y, C.wood3); p.h(0, W - 1, y + 1, C.wood2); }
    for (let x = 4; x < W; x += 12) p.rect(x, 24, 2, 5, C.wood2);
    p.h(0, W - 1, 25, C.wood); p.h(0, W - 1, 27, C.wood);
    // bù nhìn
    p.v(86, 14, 30, C.wood2); p.h(80, 92, 18, C.wood2);
    p.ell(86, 12, 3, 3, C.straw); p.rect(82, 8, 9, 2, C.brown2);
    p.px(85, 12, '#3d2b2b'); p.px(87, 12, '#3d2b2b');
  },
  barn: (p) => {
    wall(p, C.wood, C.wood2, C.wood2);
    floor(p, C.straw2, C.straw3, C.straw3);
    window_(p, 62, 8, '#a8dcf2');
    // máng ăn
    p.rect(8, 28, 30, 5, C.wood2); p.rect(9, 26, 28, 3, C.wood3); p.rect(10, 27, 26, 1, C.straw);
    hay(p, 52, 42); hay(p, 20, 48); hay(p, 80, 46);
    lamp(p, 46, 12);
    p.rect(78, 20, 10, 12, C.wood3); p.rect(79, 21, 8, 10, C.wood2);
  },
  pond: (p) => {
    p.rect(0, 0, W, H, '#a8dcf2');
    p.rect(0, 22, W, H - 22, C.sea2);
    for (let y = 26; y < H; y += 5) for (let x = (y % 10); x < W; x += 14) p.h(x, x + 5, y, C.shallow);
    p.rect(0, 18, W, 5, C.grass2); p.h(0, W - 1, 18, C.grass);
    for (const x of [8, 20, 70, 86]) { p.v(x, 8, 20, C.green2); p.v(x + 1, 11, 20, C.green3); p.ell(x, 8, 1, 2, C.wood2); }
    p.rect(26, 22, 44, 3, C.wood); p.h(26, 69, 22, C.wood2);
    for (const x of [28, 48, 68]) p.rect(x, 22, 2, 8, C.wood3);
  },
  house: (p) => {
    wall(p, C.straw, C.straw2, C.straw2);
    floor(p, C.wood, C.wood2, C.wood2);
    window_(p, 14, 8, '#a8dcf2');
    // giường
    p.rect(54, 24, 34, 14, C.wood2); p.rect(55, 25, 32, 6, C.white); p.rect(55, 25, 10, 6, C.blue); p.rect(55, 31, 32, 6, C.red);
    // bàn ghế
    p.rect(12, 36, 22, 3, C.wood3); p.v(14, 39, 47, C.wood3); p.v(31, 39, 47, C.wood3);
    p.ell(20, 36, 3, 1, C.white); p.ell(28, 35, 2, 1, C.green2);
    // bếp
    p.rect(40, 18, 10, 16, C.stone3); p.rect(41, 24, 8, 6, '#3d2b2b'); p.px(44, 27, C.gold); p.px(46, 28, C.red);
    lamp(p, 28, 10);
  },
  store: (p) => {
    wall(p, C.wood2, C.wood3, C.wood3);
    floor(p, C.wood, C.wood2, C.wood2);
    for (const y of [10, 22]) { p.rect(6, y, 84, 2, C.wood3); }
    for (let x = 12; x < 84; x += 16) { sack(p, x, 9, C.straw2); crate(p, x + 6, 21); }
    sack(p, 16, 46); sack(p, 28, 48); barrel(p, 60, 48); barrel(p, 72, 45); crate(p, 84, 48);
    lamp(p, 46, 7);
  },
  pier: (p) => {
    p.rect(0, 0, W, 20, '#a8dcf2');
    p.rect(0, 20, W, 14, C.sea);
    for (let y = 22; y < 34; y += 4) for (let x = (y % 8); x < W; x += 12) p.h(x, x + 4, y, C.foam);
    p.ell(14, 8, 8, 2, C.foam);
    p.rect(0, 34, W, 22, C.wood);
    for (let x = 0; x < W; x += 12) p.v(x, 34, H - 1, C.wood2);
    for (let y = 40; y < H; y += 8) p.h(0, W - 1, y, C.wood2);
    for (const x of [6, 46, 88]) { p.rect(x - 1, 26, 3, 10, C.wood3); p.px(x, 25, C.straw); }
    p.line(6, 27, 46, 30, C.straw3); p.line(46, 30, 88, 27, C.straw3);
    p.poly([[58, 28], [86, 28], [82, 33], [62, 33]], C.wood2);
    p.v(72, 14, 28, C.wood3); p.poly([[73, 15], [73, 26], [84, 26]], C.white);
  },
  stall: (p) => {
    p.rect(0, 0, W, FLOOR, C.sand);
    floor(p, C.sand2, C.sand3, C.sand3);
    for (let x = 0; x < W; x += 12) { p.rect(x, 0, 6, 12, C.red); p.rect(x + 6, 0, 6, 12, C.white); p.h(x, x + 11, 12, C.red2); }
    p.rect(8, 26, 80, 6, C.wood2); p.rect(8, 24, 80, 3, C.wood);
    for (const [x, c] of [[16, C.red], [28, C.green2], [40, C.gold], [52, C.blue], [64, C.pink]] as [number, string][]) { p.ell(x, 22, 4, 3, c); p.px(x - 1, 21, C.white); }
    crate(p, 14, 48); crate(p, 80, 48); sack(p, 48, 46);
  },
  tower: (p) => {
    p.rect(0, 0, W, 30, C.sea);
    p.rect(0, 0, W, 16, '#a8dcf2');
    p.ell(70, 8, 5, 5, C.gold);
    for (let x = 0; x < W; x += 12) p.h(x, x + 4, 22, C.foam);
    p.h(0, W - 1, 30, C.sea3);
    p.rect(0, 30, W, 4, C.stone3);
    for (let x = 2; x < W; x += 12) p.rect(x, 30, 8, 4, C.stone2);
    p.rect(0, 34, W, 22, C.stone2);
    for (let y = 36; y < H; y += 6) p.h(0, W - 1, y, C.stone3);
    for (let y = 36, i = 0; y < H; y += 6, i++) for (let x = (i % 2) * 6; x < W; x += 12) p.v(x, y, y + 5, C.stone3);
    // giá vũ khí
    p.rect(10, 40, 24, 2, C.wood2);
    for (const x of [14, 20, 26, 32]) p.line(x, 34, x - 1, 46, C.metal3);
    p.ell(60, 44, 5, 5, C.wood); p.ell(60, 44, 3, 3, C.red); p.px(60, 44, C.gold);
    lamp(p, 80, 42);
  },
  work: (p) => {
    wall(p, C.stone2, C.stone3, C.stone3);
    floor(p, C.stone, C.stone2, C.stone3);
    window_(p, 70, 8, '#a8dcf2');
    // đe / bàn học / bàn thờ chung
    p.rect(14, 32, 26, 6, C.metal3); p.rect(18, 38, 18, 9, C.wood3); p.rect(10, 30, 8, 3, C.metal3);
    p.rect(54, 28, 30, 4, C.wood); p.v(56, 32, 46, C.wood2); p.v(82, 32, 46, C.wood2);
    p.rect(58, 24, 6, 4, C.red); p.rect(66, 25, 6, 3, C.blue); p.rect(74, 24, 6, 4, C.green2);
    lamp(p, 46, 10);
  },
  shrine: (p) => {
    p.rect(0, 0, W, FLOOR, '#7a2f2f');
    for (let x = 0; x < W; x += 8) p.v(x, 0, FLOOR - 1, '#5e2020');
    floor(p, C.wood2, C.wood3, C.wood3);
    p.rect(30, 14, 36, 4, C.gold2); p.rect(32, 18, 32, 14, C.wood3); p.rect(34, 20, 28, 10, C.red2);
    for (const x of [40, 48, 56]) { p.v(x, 6, 12, C.red); p.px(x, 5, C.gold); }
    p.ell(48, 8, 3, 3, C.gold);
    lamp(p, 14, 14); lamp(p, 82, 14);
  },
};
const OF: Record<BKey, string> = {
  ruong: 'field', vuon: 'field', nuongdau: 'field', chuong: 'barn', aoca: 'pond', nhadan: 'house', khothoc: 'store', benthuyen: 'pier',
  cho: 'stall', tramthue: 'pier', thapcanh: 'tower', tuong: 'tower', donbinh: 'tower', xuongren: 'work', hocvien: 'work', coixay: 'work',
  bep: 'house', nhathuoc: 'work', khungcui: 'work', den: 'shrine',
};

const cache = new Map<string, string>();
/** Ảnh không gian bên trong (data URL) cho một loại công trình. */
export function roomUrl(k: BKey | string): string {
  const kind = OF[k as BKey] ?? 'work';
  let u = cache.get(kind);
  if (!u) {
    const [c, x] = cnv(W, H);
    DRAW[kind](new P(x));
    u = enhance(outline(c)).toDataURL();
    cache.set(kind, u);
  }
  return u;
}
