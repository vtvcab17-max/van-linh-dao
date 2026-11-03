// Biểu tượng vật phẩm trong túi (dùng chung cho cửa hàng, túi đồ, vòng quay).
import type { ItemKey } from '../../../shared/economy';
import { canvas, Pen } from './pixel';

/** Biểu tượng vật phẩm. */
export function drawItemIcon(k: ItemKey) {
  const [c, ctx] = canvas(12, 12);
  const p = new Pen(ctx);
  switch (k) {
    case 'banhchung':
      p.rect(2, 2, 8, 8, 'G');
      p.rect(2, 2, 8, 8, 'H');
      p.rect(3, 3, 6, 6, 'G');
      p.hline(2, 9, 6, 'y');
      p.vline(6, 2, 9, 'y');
      break;
    case 'ruounep':
      p.ellipse(6, 8, 4, 3, 'u');
      p.rect(5, 1, 2, 4, 'u');
      p.rect(4, 0, 4, 1, 'e');
      p.px(4, 7, 'w');
      break;
    case 'haido':
      p.rect(1, 2, 10, 8, 'y');
      p.line(2, 8, 5, 4, 'E');
      p.line(5, 4, 9, 6, 'E');
      p.px(9, 6, 'e');
      p.vline(1, 2, 9, 'z');
      p.vline(10, 2, 9, 'z');
      break;
    case 'goquy':
      p.rect(1, 4, 10, 4, 'T');
      p.hline(1, 10, 4, 'u');
      p.ellipse(10, 6, 1, 2, 'u');
      p.px(4, 2, 'q');
      p.px(7, 1, 'q');
      break;
    case 'ngoctraiden':
      p.ellipse(6, 6, 4, 4, 'K');
      p.ellipse(5, 5, 2, 2, 'v');
      p.px(4, 4, 'i');
      break;
    case 'lenhbai':
      p.rect(3, 1, 6, 10, 'l');
      p.rect(4, 2, 4, 8, 'L');
      p.hline(4, 7, 5, 'E');
      p.vline(6, 3, 8, 'E');
      p.px(6, 0, 'e');
      break;
    case 'vayrong':
      p.poly([[6, 0], [11, 6], [6, 11], [1, 6]], 'x');
      p.poly([[6, 2], [9, 6], [6, 9], [3, 6]], 'X');
      p.px(5, 4, 'i');
      break;
    case 'trongdong':
      p.ellipse(6, 5, 5, 3, 'L');
      p.ellipse(6, 5, 3, 2, 'l');
      p.px(6, 5, 'i');
      p.rect(2, 6, 8, 4, 'L');
      p.hline(2, 9, 9, 'z');
      break;
    case 'thegd':
      // thẻ có hình mặt người
      p.rect(2, 1, 8, 10, 'k');
      p.rect(3, 2, 6, 8, 'w');
      p.ellipse(6, 5, 2, 2, 'q');
      p.hline(4, 8, 3, 'T');
      p.rect(4, 8, 5, 2, 'E');
      break;
    case 'khien8':
      p.poly([[1, 1], [11, 1], [11, 6], [6, 11], [1, 6]], 'L');
      p.poly([[3, 3], [9, 3], [9, 6], [6, 9], [3, 6]], 'l');
      p.vline(6, 3, 8, 'E');
      break;
  }
  return c;
}
