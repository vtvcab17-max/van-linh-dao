// Thủy Tinh — boss cuối ở Mắt Bão, và Thủy Binh hộ vệ.
import { canvas, fromMap, noise, Pen, PAL, recolor, type Canvas } from './pixel';

/** Thủy Tinh 36x40: thân rồng nước trồi lên từ sóng, mũ miện rồng, đinh ba. */
export function drawThuyTinh(): Canvas {
  const [c, ctx] = canvas(36, 40);
  const p = new Pen(ctx);
  // tóc sóng dài bay phía sau
  p.poly([[8, 6], [3, 14], [1, 24], [5, 30], [10, 22], [12, 10]], 'X');
  p.poly([[26, 6], [32, 13], [34, 22], [30, 28], [25, 20], [24, 10]], 'X');
  for (let y = 10; y < 28; y += 3) {
    p.px(3 + (y % 2), y, 'x');
    p.px(31 - (y % 2), y, 'x');
  }
  // thân sóng phía dưới (không chân, trồi lên từ nước)
  p.poly([[7, 39], [9, 30], [13, 26], [23, 26], [27, 30], [29, 39]], 'B');
  for (let y = 28; y < 40; y++) for (let x = 7; x < 30; x++) if (noise(x, y, 77) < 0.12) p.px(x, y, 'b');
  for (const [x0, y0] of [[8, 33], [15, 35], [22, 32], [26, 37]]) {
    p.hline(x0, x0 + 4, y0, 'c');
    p.px(x0 + 4, y0 - 1, 'i');
  }
  p.hline(4, 32, 39, 'i');
  p.hline(2, 34, 38, 'c');
  // giáp vảy rồng
  p.poly([[10, 14], [26, 14], [27, 27], [9, 27]], 'X');
  for (let y = 16; y < 27; y += 2) for (let x = 11 + (y % 4 ? 1 : 0); x < 26; x += 3) p.px(x, y, 'x');
  p.hline(10, 26, 14, 'l');
  p.hline(9, 27, 22, 'L');
  p.hline(9, 27, 23, 'l');
  p.rect(16, 21, 4, 4, 'l');
  p.px(17, 22, 'e');
  p.px(18, 23, 'E');
  // vai giáp vây cá
  p.poly([[6, 13], [12, 12], [11, 17], [5, 18]], 'x');
  p.poly([[30, 13], [24, 12], [25, 17], [31, 18]], 'x');
  p.line(6, 13, 5, 18, 'l');
  p.line(30, 13, 31, 18, 'l');
  // tay phải cầm đinh ba
  p.rect(26, 16, 3, 7, 'X');
  p.rect(27, 22, 3, 3, 'h');
  p.vline(29, 1, 37, 'L');
  p.vline(30, 2, 37, 'z');
  p.hline(25, 34, 5, 'l');
  for (const x of [25, 29, 34]) p.vline(x, 0, 5, 'l');
  p.px(25, 0, 'i');
  p.px(29, 0, 'i');
  p.px(34, 0, 'i');
  // tay trái giơ lên gọi nước
  p.rect(7, 16, 3, 6, 'X');
  p.rect(6, 21, 3, 3, 'h');
  p.ellipse(6, 26, 2, 2, 'x');
  p.px(5, 25, 'i');
  // đầu
  p.rect(13, 5, 10, 9, 'h');
  p.rect(13, 5, 10, 2, 'X');
  p.vline(12, 6, 12, 'k');
  p.vline(23, 6, 12, 'k');
  // mắt đỏ giận dữ
  p.hline(14, 16, 8, 'k');
  p.hline(19, 21, 8, 'k');
  p.px(15, 9, 'e');
  p.px(20, 9, 'e');
  p.px(14, 9, 'i');
  p.px(21, 9, 'i');
  // râu trắng như bọt sóng
  p.poly([[13, 11], [23, 11], [21, 17], [18, 20], [15, 17]], 'w');
  p.hline(16, 20, 12, 'R');
  p.px(18, 19, 'i');
  p.px(16, 15, 'F');
  p.px(20, 15, 'F');
  // mũ miện rồng vàng
  p.poly([[12, 5], [24, 5], [23, 2], [20, 3], [18, 0], [16, 3], [13, 2]], 'l');
  p.hline(12, 24, 5, 'L');
  p.px(18, 2, 'e');
  p.line(12, 4, 9, 1, 'l');
  p.line(24, 4, 27, 1, 'l');
  // giọt nước bay quanh
  for (const [x, y] of [[2, 4], [33, 9], [1, 33], [34, 30], [10, 1]]) p.px(x, y, 'x');
  return c;
}

const HAI_TAC_LIKE = [
  '................',
  '.....kkkkkk.....',
  '....kXXXXXXk....',
  '...kXxXXXXxXk...',
  '....khhhhhhk....',
  '....khkhhkhk....',
  '....khhhhhhk....',
  '.....kwwwwk..l..',
  '...kkXXXXXXkkl..',
  '..kXXxXXXXxXkl..',
  '..khXXXXXXXXhl..',
  '...kkBBBBBBkkl..',
  '....kBBkkBBk.l..',
  '....kccmmcck....',
  '....kkk..kkk....',
  '................',
];

/** Thủy Binh: lính nước của Thủy Tinh, cầm giáo. */
export function drawThuyBinh(): Canvas {
  return fromMap(recolor(HAI_TAC_LIKE, {}), PAL);
}
