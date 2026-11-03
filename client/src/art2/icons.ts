// Biểu tượng nhỏ cho menu (16x16, viền nâu sẫm như bộ art2).
import { C, cnv, outline, P, scaleUp } from './pal';
import { enhance } from '../art/hd';

type Draw = (p: P) => void;
const ICONS: Record<string, Draw> = {
  // xẻng khai hoang
  expand: (p) => {
    p.line(3, 3, 10, 10, C.wood);
    p.line(4, 3, 11, 10, C.wood2);
    p.rect(2, 2, 3, 2, C.wood3);
    p.poly([[9, 11], [12, 8], [15, 12], [12, 15]], C.metal2);
    p.poly([[10, 11], [12, 9], [13, 11], [11, 13]], C.metal);
  },
  // búa xây dựng
  build: (p) => {
    p.line(4, 13, 10, 7, C.wood);
    p.line(5, 13, 11, 7, C.wood2);
    p.poly([[7, 3], [11, 1], [15, 5], [11, 9]], C.metal3);
    p.poly([[8, 3], [11, 2], [13, 4], [10, 6]], C.metal);
  },
  // bánh xe vòng quay
  wheel: (p) => {
    p.ell(8, 8, 7, 7, C.gold2);
    p.ell(8, 8, 6, 6, C.red);
    for (const [a, b] of [[8, 2], [14, 8], [8, 14], [2, 8]] as [number, number][]) p.line(8, 8, a, b, C.gold);
    p.poly([[8, 8], [8, 2], [12, 4]], C.straw);
    p.poly([[8, 8], [14, 8], [12, 12]], C.straw);
    p.poly([[8, 8], [8, 14], [4, 12]], C.straw);
    p.poly([[8, 8], [2, 8], [4, 4]], C.straw);
    p.ell(8, 8, 1, 1, C.wood3);
  },
  // mũ trụ tướng
  tuong: (p) => {
    p.ell(8, 9, 5, 5, C.gold);
    p.rect(3, 9, 11, 5, C.gold2);
    p.h(2, 14, 13, C.gold3);
    p.rect(6, 10, 5, 3, '#4a2c1c');
    p.v(8, 1, 4, C.red);
    p.px(7, 2, C.red2);
    p.px(5, 6, '#fff6c0');
  },
  // hải đồ cuộn
  map: (p) => {
    p.rect(2, 3, 12, 10, C.straw);
    p.rect(2, 3, 12, 1, C.straw3);
    p.rect(2, 12, 12, 1, C.straw3);
    p.v(1, 2, 13, C.wood2);
    p.v(14, 2, 13, C.wood2);
    for (const [x, y] of [[4, 10], [5, 9], [7, 9], [8, 8], [9, 7]] as [number, number][]) p.px(x, y, C.red);
    p.px(11, 5, C.red2);
    p.px(10, 6, C.red2);
    p.px(12, 6, C.red2);
    p.px(11, 7, C.red2);
    p.ell(5, 6, 1, 1, C.green2);
  },
  // mảnh tướng: miếng ghép vàng có sao
  manh: (p) => {
    p.rect(2, 4, 10, 10, C.gold2);
    p.rect(3, 5, 8, 8, C.gold);
    p.ell(7, 3, 2, 2, C.gold);
    p.ell(13, 9, 2, 2, C.gold);
    p.ell(7, 2, 1, 1, '#fff6c0');
    for (const [x, y] of [[7, 7], [6, 8], [7, 8], [8, 8], [7, 9], [5, 8], [9, 8], [6, 10], [8, 10]] as [number, number][]) p.px(x, y, C.red);
  },
  // kho vật liệu: bó gỗ, đá, tre
  vatlieu: (p) => {
    p.rect(1, 9, 9, 5, C.wood);
    for (const y of [9, 11, 13]) p.ell(1, y, 1, 0, C.straw2);
    p.h(1, 9, 11, C.wood2);
    p.ell(12, 11, 3, 3, C.stone2);
    p.ell(11, 10, 2, 2, C.stone);
    p.v(4, 2, 8, C.green);
    p.v(5, 1, 8, C.green2);
    p.v(7, 3, 8, C.green);
    p.px(5, 4, C.green3);
  },
  // gà mái trắng
  ga: (p) => {
    p.ell(7, 10, 5, 4, C.white);
    p.ell(11, 6, 2, 2, C.white);
    p.px(12, 3, C.red); p.px(11, 3, C.red); p.px(12, 4, C.red);
    p.px(14, 6, C.gold2);
    p.px(11, 6, '#3d2b2b');
    p.h(3, 6, 8, C.white2);
    p.v(6, 14, 15, C.gold2); p.v(9, 14, 15, C.gold2);
    p.px(2, 7, C.white2); p.px(1, 6, C.white2);
  },
  // bát hương có khói
  huong: (p) => {
    p.ell(8, 12, 5, 2, C.gold2);
    p.rect(3, 11, 11, 2, C.gold2);
    p.h(4, 12, 14, C.gold3);
    for (const x of [6, 8, 10]) { p.v(x, 5, 10, C.red2); p.px(x, 4, C.gold); }
    p.px(7, 2, '#dcd6cc'); p.px(9, 1, '#f4f1ea'); p.px(11, 2, '#dcd6cc');
  },
  // đồng hồ cát (tốc độ)
  speed: (p) => {
    p.h(3, 12, 1, C.wood2);
    p.h(3, 12, 14, C.wood2);
    p.poly([[4, 2], [12, 2], [8, 8]], C.sea);
    p.poly([[8, 8], [12, 14], [4, 14]], C.sand2);
    p.v(8, 7, 11, C.sand2);
  },
};

const cache = new Map<string, string>();
/** Ảnh biểu tượng (data URL) đã qua bộ lọc 32-bit. */
export function menuIcon(k: keyof typeof ICONS | string): string {
  let u = cache.get(k);
  if (!u) {
    const [c, x] = cnv(18, 18);
    x.translate(1, 1);
    (ICONS[k] ?? (() => undefined))(new P(x));
    u = scaleUp(enhance(outline(c)), 1).toDataURL();
    cache.set(k, u);
  }
  return u;
}
