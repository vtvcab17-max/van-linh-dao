// Nhà cửa, thành trì đặt trên ô đất: 9 loại × 3 cấp, khung 16x24 (neo đáy giữa).
import type { BKey } from '../../../shared/economy';
import { canvas, Pen, type Canvas } from './pixel';

const TILE_R = '#a8432f';
const TILE_D = '#7a2e22';

function roof(p: Pen, x0: number, x1: number, top: number, bot: number, a: string, b: string, curl = false) {
  for (let y = top; y <= bot; y++) {
    const t = (y - top) / Math.max(1, bot - top);
    const l = Math.round(x0 + (1 - t) * 3);
    const r = Math.round(x1 - (1 - t) * 3);
    p.hline(l, r, y, (y - top) % 2 ? a : b);
    p.px(l - 1, y, 'k');
    p.px(r + 1, y, 'k');
  }
  p.hline(x0 + 2, x1 - 2, top - 1, 'k');
  p.hline(x0 - 1, x1 + 1, bot + 1, 'k');
  if (curl) {
    p.px(x0 - 1, bot, 'l');
    p.px(x1 + 1, bot, 'l');
  }
}
function wall(p: Pen, x0: number, x1: number, y0: number, y1: number, col: string, line?: string) {
  p.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, col);
  if (line) for (let y = y0 + 2; y < y1; y += 3) p.hline(x0, x1, y, line);
  p.vline(x0 - 1, y0, y1, 'k');
  p.vline(x1 + 1, y0, y1, 'k');
  p.hline(x0 - 1, x1 + 1, y1 + 1, 'k');
}
const shadow = (p: Pen, w = 6) => p.ellipse(8, 22, w, 1, 'rgba(0,0,0,0.25)');
function flag(p: Pen, x: number, top: number, col: string) {
  p.vline(x, top, top + 9, 'T');
  p.rect(x + 1, top, 4, 3, col);
  p.px(x + 4, top + 3, col);
}

export function drawDinh(k: BKey, lv: number): Canvas {
  const [c, ctx] = canvas(16, 24);
  const p = new Pen(ctx);
  const L = Math.max(1, Math.min(3, lv));
  shadow(p, L === 3 ? 8 : 6);
  switch (k) {
    case 'nhadan':
      if (L === 1) {
        wall(p, 4, 11, 16, 21, '#c99a62', '#a87a48');
        roof(p, 2, 13, 10, 15, 'y', 'Y');
        p.rect(7, 18, 2, 4, 'K');
      } else if (L === 2) {
        wall(p, 2, 13, 15, 21, 'u', 'T');
        roof(p, 1, 14, 9, 14, TILE_D, '#8a3a2a');
        p.rect(7, 17, 2, 5, 'K');
        p.rect(3, 17, 2, 2, 'l');
        p.rect(11, 17, 2, 2, 'l');
      } else {
        wall(p, 1, 14, 14, 21, 'u', 'T');
        for (const x of [1, 5, 10, 14]) p.vline(x, 14, 21, 'T');
        roof(p, 0, 15, 7, 13, TILE_R, TILE_D, true);
        p.rect(7, 16, 2, 6, 'E');
        p.px(8, 6, 'l');
        p.rect(3, 16, 2, 2, 'l');
        p.rect(11, 16, 2, 2, 'l');
      }
      break;
    case 'khothoc':
      if (L === 1) {
        for (const x of [5, 10]) p.vline(x, 17, 21, 'T');
        p.ellipse(8, 13, 6, 5, 'Y');
        p.ellipse(8, 12, 5, 3, 'y');
        p.ellipse(8, 13, 6, 5, 'k', false);
        p.hline(3, 13, 17, 'T');
      } else if (L === 2) {
        wall(p, 2, 13, 13, 21, 't', 'T');
        roof(p, 1, 14, 8, 12, 'Y', 'y');
        p.rect(6, 16, 4, 6, 'K');
        p.line(6, 16, 9, 21, 'u');
        p.line(9, 16, 6, 21, 'u');
      } else {
        wall(p, 1, 14, 12, 21, 'n', 'N');
        roof(p, 0, 15, 6, 11, TILE_D, TILE_R);
        p.rect(6, 15, 4, 7, 'T');
        for (const [x, y] of [[2, 18], [12, 18]]) {
          p.ellipse(x + 1, y + 1, 2, 2, 'F');
          p.px(x + 1, y - 1, 'z');
        }
      }
      break;
    case 'cho':
      if (L === 1) {
        p.vline(3, 12, 21, 'T');
        p.vline(12, 12, 21, 'T');
        for (let x = 2; x <= 13; x++) p.vline(x, 10, 12, x % 2 ? 'e' : 'w');
        p.hline(1, 14, 9, 'k');
        p.rect(3, 17, 10, 2, 'u');
        for (const [x, col] of [[4, 'o'], [7, 'G'], [10, 'l']] as const) p.rect(x, 15, 2, 2, col);
      } else if (L === 2) {
        for (const x0 of [1, 9]) {
          p.vline(x0, 11, 21, 'T');
          p.vline(x0 + 5, 11, 21, 'T');
          for (let x = x0; x <= x0 + 5; x++) p.vline(x, 9, 11, x % 2 ? 'p' : 'w');
          p.rect(x0 + 1, 17, 4, 2, 'u');
          p.rect(x0 + 2, 15, 2, 2, x0 === 1 ? 'q' : 'A');
        }
        for (const x of [4, 12]) {
          p.ellipse(x, 7, 1, 1, 'e');
          p.px(x, 6, 'l');
        }
      } else {
        wall(p, 1, 14, 14, 21, 'u');
        for (const x of [1, 5, 10, 14]) p.vline(x, 14, 21, 'E');
        roof(p, 0, 15, 6, 13, TILE_R, TILE_D, true);
        p.rect(4, 10, 8, 3, 'l');
        p.hline(5, 10, 11, 'E');
        p.rect(3, 17, 10, 2, 'o');
        p.px(8, 5, 'l');
      }
      break;
    case 'tramthue':
      p.rect(0, 19, 16, 3, '#5fb6d6');
      if (L === 1) {
        for (const x of [2, 7, 12]) p.vline(x, 17, 22, 'T');
        p.rect(0, 17, 16, 2, 'u');
        p.hline(0, 15, 17, 't');
        wall(p, 9, 14, 12, 16, 'y');
        p.hline(8, 15, 11, 'z');
      } else if (L === 2) {
        p.rect(0, 16, 16, 4, 'n');
        p.hline(0, 15, 16, 'm');
        p.hline(0, 15, 19, 'N');
        flag(p, 13, 6, 'e');
        wall(p, 2, 9, 11, 15, 'u', 'T');
        roof(p, 1, 10, 8, 10, 'Y', 'y');
      } else {
        p.rect(0, 16, 16, 4, 'n');
        p.hline(0, 15, 19, 'N');
        wall(p, 2, 12, 9, 15, 'u', 'T');
        roof(p, 1, 13, 4, 8, TILE_R, TILE_D, true);
        flag(p, 14, 3, 'l');
        p.ellipse(4, 12, 1, 1, 'e');
        p.rect(6, 12, 3, 4, 'E');
      }
      break;
    case 'thapcanh':
      if (L === 1) {
        for (const x of [4, 11]) p.vline(x, 8, 21, 'a');
        p.line(4, 21, 11, 12, 'H');
        p.line(11, 21, 4, 12, 'H');
        p.rect(3, 7, 10, 2, 'Y');
        roof(p, 3, 12, 3, 6, 'y', 'Y');
      } else if (L === 2) {
        wall(p, 4, 11, 6, 21, '#b15d3a', '#7a3b2a');
        p.rect(3, 4, 10, 2, '#b15d3a');
        for (const x of [3, 6, 9, 12]) p.rect(x, 2, 2, 2, '#b15d3a');
        p.rect(7, 9, 2, 3, 'k');
        p.rect(7, 17, 2, 5, 'K');
      } else {
        wall(p, 4, 11, 7, 21, 'n', 'N');
        roof(p, 2, 13, 1, 5, TILE_R, TILE_D, true);
        p.rect(3, 6, 10, 1, 'k');
        p.line(5, 9, 10, 9, 'l');
        p.vline(7, 8, 11, 'T');
        p.px(11, 9, 'm');
        p.px(8, 0, 'l');
      }
      break;
    case 'tuong':
      if (L === 1) {
        p.ellipse(8, 19, 8, 3, 'z');
        p.ellipse(8, 18, 7, 2, 'T');
        for (const x of [2, 6, 10, 14]) {
          p.vline(x, 11, 18, 'a');
          p.px(x, 10, 'A');
        }
        p.hline(1, 15, 14, 'Y');
      } else if (L === 2) {
        p.rect(0, 12, 16, 9, '#b15d3a');
        for (let y = 13; y < 21; y += 3) for (let x = (y % 2) * 2; x < 16; x += 4) p.px(x, y, '#7a3b2a');
        p.hline(0, 15, 11, 'k');
        p.hline(0, 15, 21, 'k');
      } else {
        p.rect(0, 10, 16, 11, 'n');
        for (let y = 11; y < 21; y += 2) p.hline(0, 15, y, y % 4 === 1 ? 'N' : 'n');
        for (let y = 12; y < 21; y += 4) for (let x = 3; x < 16; x += 6) p.vline(x, y, y + 1, 'N');
        for (const x of [0, 4, 8, 12]) p.rect(x, 7, 3, 3, 'n');
        p.hline(0, 15, 21, 'k');
        p.px(8, 5, 'e');
      }
      break;
    case 'donbinh':
      if (L === 1) {
        p.poly([[1, 21], [8, 9], [15, 21]], 'Y');
        p.line(1, 21, 8, 9, 'z');
        p.line(15, 21, 8, 9, 'z');
        p.poly([[6, 21], [8, 16], [10, 21]], 'K');
        flag(p, 8, 2, 'e');
      } else if (L === 2) {
        wall(p, 1, 14, 13, 21, 't', 'T');
        roof(p, 0, 15, 8, 12, 'z', 'T');
        for (const x of [3, 5, 12]) {
          p.vline(x, 14, 20, 'u');
          p.px(x, 13, 'm');
        }
        p.rect(7, 16, 2, 6, 'K');
        flag(p, 13, 0, 'e');
      } else {
        wall(p, 0, 15, 11, 21, 'n', 'N');
        for (const x of [0, 4, 8, 12]) p.rect(x, 8, 3, 3, 'n');
        p.rect(5, 14, 6, 8, 'K');
        p.rect(6, 15, 4, 7, 'T');
        p.hline(5, 10, 13, 'l');
        flag(p, 2, 0, 'e');
        flag(p, 12, 1, 'l');
      }
      break;
    case 'xuongren':
      if (L === 1) {
        p.rect(3, 17, 6, 3, 'M');
        p.rect(4, 15, 4, 2, 'N');
        p.hline(2, 9, 15, 'm');
        p.ellipse(12, 19, 3, 2, 'n');
        p.ellipse(12, 17, 2, 2, 'o');
        p.px(12, 15, 'l');
        p.px(13, 14, 'e');
      } else if (L === 2) {
        wall(p, 2, 13, 14, 21, 't', 'T');
        roof(p, 1, 14, 9, 13, 'z', 'T');
        p.rect(10, 3, 3, 7, 'n');
        p.ellipse(11, 1, 2, 1, 'rgba(200,200,210,0.7)');
        p.rect(4, 17, 4, 4, 'o');
        p.rect(5, 18, 2, 2, 'l');
      } else {
        wall(p, 1, 14, 13, 21, 'n', 'N');
        roof(p, 0, 15, 8, 12, TILE_D, TILE_R);
        p.rect(11, 1, 3, 8, 'N');
        p.ellipse(12, 0, 2, 1, 'rgba(220,220,230,0.7)');
        p.ellipse(5, 18, 3, 2, 'L');
        p.ellipse(5, 18, 2, 1, 'l');
        p.px(5, 17, 'i');
        p.rect(9, 16, 4, 5, 'o');
        p.rect(10, 17, 2, 3, 'l');
      }
      break;
    case 'den':
      if (L === 1) {
        p.rect(4, 18, 8, 3, 'n');
        wall(p, 5, 10, 12, 17, 'S');
        roof(p, 4, 11, 8, 11, TILE_R, TILE_D, true);
        p.rect(7, 14, 2, 3, 'e');
        p.px(7, 13, 'l');
      } else if (L === 2) {
        p.rect(1, 19, 14, 2, 'n');
        wall(p, 2, 13, 13, 18, 'e', 'E');
        roof(p, 0, 15, 7, 12, TILE_R, TILE_D, true);
        p.rect(6, 14, 4, 5, 'K');
        p.ellipse(8, 5, 1, 1, 'l');
        p.px(8, 15, 'l');
      } else {
        p.rect(0, 19, 16, 2, 'm');
        wall(p, 1, 14, 12, 18, 'e', 'E');
        roof(p, 0, 15, 8, 11, 'l', 'L', true);
        roof(p, 3, 12, 3, 6, TILE_R, TILE_D, true);
        p.rect(6, 14, 4, 5, 'K');
        p.px(8, 1, 'l');
        p.px(8, 2, 'L');
        for (const [x, y] of [[0, 4], [15, 3]]) p.px(x, y, 'l');
      }
      break;
    case 'ruong': {
      // ruộng nước: bờ đất, nước lấp lánh, mạ xanh theo hàng
      p.rect(1, 13, 14, 9, '#8a5a32');
      p.rect(2, 14, 12, 7, L === 1 ? '#5fa8c8' : '#4f9fbf');
      for (let y = 15; y < 21; y += 2) for (let x = 3; x < 14; x += 2) { p.px(x, y, L >= 2 ? '#7cc45c' : '#a6d86e'); p.px(x, y - 1, '#4f9a45'); }
      if (L >= 2) p.hline(2, 13, 17, '#8a5a32');
      if (L === 3) { p.rect(12, 9, 3, 5, '#e8c56e'); p.px(13, 8, '#b98d3e'); }
      p.hline(1, 14, 22, 'k');
      break;
    }
    case 'vuon': {
      p.rect(1, 14, 14, 8, '#7b4a2a');
      for (let y = 15; y < 21; y += 3) { p.hline(2, 13, y, '#5c3620'); for (let x = 3; x < 14; x += 3) { p.px(x, y - 1, '#57a043'); p.px(x + 1, y - 1, '#86c95c'); p.px(x, y - 2, L >= 2 ? '#ef7c98' : '#86c95c'); } }
      for (let x = 1; x <= 14; x += 2) p.vline(x, 12, 14, '#c98f55');
      p.hline(1, 14, 12, '#9b6a3c');
      if (L === 3) { p.ellipse(8, 9, 3, 2, '#57a043'); p.px(8, 8, '#f6d34d'); }
      break;
    }
    case 'nuongdau':
      for (const [x, y] of [[4, 14], [10, 13], [7, 18], [12, 19]]) { p.vline(x, y, y + 3, '#6a4326'); p.ellipse(x, y - 1, 3, 2, '#3f8a3a'); p.px(x - 1, y - 2, '#7cc45c'); if (L >= 2) p.px(x + 1, y, '#7a2e6a'); }
      if (L === 3) { wall(p, 1, 5, 18, 21, '#ecd7b0'); roof(p, 0, 6, 15, 17, 'y', 'Y'); }
      break;
    case 'chuong':
      wall(p, 2, 13, 15, 21, '#c99a62', '#a87a48');
      roof(p, 1, 14, 10, 14, L >= 2 ? TILE_R : 'y', L >= 2 ? TILE_D : 'Y');
      for (let x = 0; x <= 15; x += 2) p.vline(x, 19, 22, '#9b6a3c');
      p.hline(0, 15, 20, '#c98f55');
      p.rect(6, 21, 2, 1, '#fbf3dc'); p.px(6, 20, '#dc4a3e');
      if (L >= 2) { p.rect(10, 21, 3, 1, '#ef9fae'); p.px(12, 20, '#ef9fae'); }
      break;
    case 'aoca':
      p.ellipse(8, 17, 7, 4, '#9aa0a8');
      p.ellipse(8, 17, 6, 3, L >= 2 ? '#3a90c2' : '#5fb6d6');
      p.hline(5, 7, 16, '#a8e6f0'); p.px(10, 18, '#ec9640'); if (L >= 2) p.px(6, 18, '#f7f0e6');
      if (L === 3) { p.ellipse(12, 15, 1, 1, '#57a043'); p.px(12, 14, '#ef7c98'); }
      break;
    case 'coixay':
      wall(p, 3, 12, 15, 21, '#d6b26d', '#b98d3e');
      roof(p, 2, 13, 9, 14, 'y', 'Y');
      p.ellipse(8, 19, 2, 1, '#9aa0a8'); p.px(8, 18, '#4c4e58');
      if (L === 3) { p.ellipse(14, 17, 2, 4, '#9b6a3c'); p.vline(14, 13, 21, '#6a4326'); p.hline(12, 15, 17, '#6a4326'); }
      break;
    case 'bep':
      wall(p, 2, 13, 14, 21, '#c99a62', '#a87a48');
      roof(p, 1, 14, 9, 13, L >= 2 ? TILE_R : 'y', L >= 2 ? TILE_D : 'Y');
      p.rect(6, 17, 4, 4, '#2b201d'); p.rect(7, 19, 2, 2, '#ec9640');
      p.vline(12, 4, 9, '#7b7e88');
      for (const [x, y] of [[12, 2], [13, 1], [11, 0]]) p.px(x, y, '#dbe3ea');
      break;
    case 'nhathuoc':
      wall(p, 2, 13, 14, 21, '#ecd7b0', '#cdb48a');
      roof(p, 1, 14, 9, 13, L >= 2 ? TILE_R : 'y', L >= 2 ? TILE_D : 'Y');
      p.rect(6, 16, 4, 6, 'K');
      p.rect(3, 15, 2, 3, '#57a043'); p.rect(11, 15, 2, 3, '#57a043');
      p.rect(6, 11, 4, 2, '#fbf3dc'); p.px(8, 11, '#dc4a3e'); p.px(7, 12, '#dc4a3e'); p.px(8, 12, '#dc4a3e'); p.px(9, 12, '#dc4a3e');
      break;
    case 'khungcui':
      wall(p, 2, 13, 15, 21, '#c99a62');
      roof(p, 1, 14, 10, 14, 'y', 'Y');
      for (let x = 4; x <= 11; x++) p.vline(x, 16, 20, x % 2 ? '#f7f0e6' : '#ef7c98');
      p.hline(3, 12, 16, '#6a4326'); p.hline(3, 12, 20, '#6a4326');
      break;
    case 'hocvien':
      wall(p, 1, 14, 14, 21, '#ecd7b0', '#cdb48a');
      for (const x of [1, 5, 10, 14]) p.vline(x, 14, 21, '#a8432f');
      roof(p, 0, 15, 7, 13, L >= 2 ? '#3f8a96' : TILE_R, L >= 2 ? '#2c6470' : TILE_D, true);
      p.rect(6, 16, 4, 6, 'K');
      p.rect(5, 10, 6, 2, '#f6d34d'); p.hline(6, 9, 11, '#7a2e22');
      if (L === 3) { p.px(8, 5, 'l'); p.px(8, 4, 'L'); }
      break;
    case 'benthuyen':
      p.rect(0, 18, 16, 4, '#9b6a3c');
      for (let x = 0; x < 16; x += 3) p.vline(x, 18, 21, '#6a4326');
      for (const x of [1, 14]) p.vline(x, 10, 18, '#6a4326');
      roof(p, 0, 15, 8, 11, 'y', 'Y');
      p.line(3, 17, 12, 17, '#c98f55'); p.line(4, 16, 11, 16, '#c98f55'); p.px(12, 16, '#c98f55');
      if (L >= 2) for (let x = 4; x <= 11; x += 2) p.vline(x, 13, 16, '#c98f55');
      break;
  }
  return c;
}

/** Thương thuyền NPC trên hải đồ (cờ theo màu thương hội). */
export function drawMerchant(color: string): Canvas {
  const [c, ctx] = canvas(16, 14);
  const p = new Pen(ctx);
  for (let x = 1; x < 15; x++) {
    const top = 10 + (x < 3 || x > 12 ? 1 : 0);
    p.vline(x, top, 12, 'T');
    p.px(x, top, 'u');
  }
  p.hline(1, 14, 13, 'k');
  p.vline(8, 1, 10, 'T');
  p.poly([[9, 2], [14, 4], [14, 9], [9, 9]], 'F');
  p.poly([[7, 3], [3, 5], [3, 9], [7, 9]], 'w');
  p.rect(8, 0, 4, 2, color);
  return c;
}
