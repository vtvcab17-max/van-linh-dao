// Mặt đất trong đảo (lưới ô vuông 16 điểm ảnh) và biển lục giác ngoài khơi.
import { C, cnv, P } from './pal';

export const TILE = 16;

export function noise(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/**
 * Vẽ cả hòn đảo từ các ô đất: cỏ ô bàn cờ nhạt (dễ nhìn ô), viền cát bo tròn,
 * bọt sóng và dải nước nông quanh bờ.
 */
export function drawIslandGround(cols: number, rows: number, land: (x: number, y: number) => boolean, margin = 2, seed = 1): HTMLCanvasElement {
  const W = (cols + margin * 2) * TILE, H = (rows + margin * 2) * TILE;
  const [c, x] = cnv(W, H);
  const img = x.createImageData(W, H);
  const put = (i: number, hex: string) => {
    const v = parseInt(hex.slice(1), 16);
    img.data[i * 4] = (v >> 16) & 255; img.data[i * 4 + 1] = (v >> 8) & 255; img.data[i * 4 + 2] = v & 255; img.data[i * 4 + 3] = 255;
  };
  const isL = (cx: number, cy: number) => cx >= 0 && cy >= 0 && cx < cols && cy < rows && land(cx, cy);
  // khoảng cách (điểm ảnh) tới ô đất gần nhất / tới mép nước gần nhất, chỉ xét 5x5 ô quanh
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      const gx = px / TILE - margin, gy = py / TILE - margin;
      const cx = Math.floor(gx), cy = Math.floor(gy);
      const inside = isL(cx, cy);
      let best = 99;
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const nx = cx + dx, ny = cy + dy;
          if (isL(nx, ny) === inside) continue;
          // khoảng cách tới hình vuông của ô khác loại
          const qx = Math.max(nx - gx, 0, gx - (nx + 1)), qy = Math.max(ny - gy, 0, gy - (ny + 1));
          best = Math.min(best, Math.hypot(qx, qy) * TILE);
        }
      const i = py * W + px;
      const n = noise(px, py, seed);
      if (inside) {
        // bo tròn góc lồi: đẩy khoảng cách vào trong một chút
        const d = best;
        if (d < 1.2) put(i, C.sand3);
        else if (d < 4.5) put(i, n < 0.06 ? C.sand2 : C.sand);
        else if (d < 5.5) put(i, C.grass2);
        else {
          const chk = (cx + cy) % 2 === 0;
          let col = chk ? C.grass : mix(C.grass, C.grass2, 0.35);
          if (n < 0.012) col = C.grass3;
          put(i, col);
        }
      } else {
        const d = best;
        if (d < 1.5) put(i, C.foam);
        else if (d < 6) put(i, C.shallow);
        else if (d < 7) put(i, mix(C.shallow, C.sea, 0.5));
        else put(i, C.sea);
      }
    }
  x.putImageData(img, 0, 0);
  const p = new P(x);
  // ngọn cỏ, hoa dại, sóng lăn tăn — thưa và nhạt để không rối mắt
  for (let cy = -margin; cy < rows + margin; cy++)
    for (let cx = -margin; cx < cols + margin; cx++) {
      const ox = (cx + margin) * TILE, oy = (cy + margin) * TILE;
      const r = noise(cx, cy, seed + 7);
      if (isL(cx, cy) && isL(cx + 1, cy) && isL(cx - 1, cy) && isL(cx, cy + 1) && isL(cx, cy - 1)) {
        if (r < 0.45) tuft(p, ox + 3 + Math.floor(r * 18), oy + 4 + Math.floor(noise(cx, cy, 3) * 8));
        if (r > 0.9) flower(p, ox + 5 + Math.floor(noise(cx, cy, 5) * 6), oy + 6 + Math.floor(noise(cx, cy, 6) * 6), r > 0.95 ? C.white : C.gold);
      } else if (!isL(cx, cy) && r < 0.35) {
        const wx = ox + Math.floor(noise(cx, cy, 9) * 10), wy = oy + 4 + Math.floor(noise(cx, cy, 11) * 8);
        let near = false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (isL(cx + dx, cy + dy)) near = true;
        if (!near) wave(p, wx, wy);
      }
    }
  return c;
}

export function tuft(p: P, x: number, y: number) {
  p.px(x, y, C.grass3); p.px(x + 2, y, C.grass3); p.px(x + 1, y + 1, C.grass3); p.px(x, y + 1, C.grass4); p.px(x + 2, y + 1, C.grass4);
}
export function flower(p: P, x: number, y: number, c: string) {
  p.px(x, y, c); p.px(x - 1, y, c); p.px(x + 1, y, c); p.px(x, y - 1, c); p.px(x, y + 1, c); p.px(x, y, C.gold2);
}
export function wave(p: P, x: number, y: number) {
  p.h(x, x + 3, y, C.shallow); p.px(x + 1, y - 1, C.foam); p.px(x + 2, y - 1, C.foam);
}

// ============ BIỂN LỤC GIÁC (đỉnh nhọn, cạnh dốc 2:1 cho nét pixel sạch) ============
export const HEX_W = 32;
export const HEX_H = 32;
export const HEX_STEP_Y = 24;

/** Điểm (x, y) trong ô 32x32 có thuộc lục giác không. */
export function inHex(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= 32 || y >= 32) return false;
  const j = y < 8 ? y : y > 23 ? 31 - y : 8;
  if (j >= 8) return true;
  const hw = 2 * j + 1;
  return x >= 16 - hw && x <= 15 + hw;
}

/** Toạ độ điểm ảnh góc trên trái của ô lục giác (cột, hàng), hàng lẻ lệch phải nửa ô. */
export const hexOrigin = (col: number, row: number) => ({ x: col * HEX_W + (row & 1) * 16, y: row * HEX_STEP_Y });

/** 6 hàng xóm theo thứ tự cạnh: Đ, ĐN, TN, T, TB, ĐB (góc tính từ tâm). */
export function hexNeighbors(col: number, row: number): [number, number][] {
  const odd = row & 1;
  return [
    [col + 1, row],
    [col + odd, row + 1],
    [col - 1 + odd, row + 1],
    [col - 1, row],
    [col - 1 + odd, row - 1],
    [col + odd, row - 1],
  ];
}

/** Cạnh của điểm biên thuộc hướng nào (0..5 như hexNeighbors). */
export function hexSide(x: number, y: number): number {
  const a = Math.atan2(y - 15.5, x - 15.5); // 0 = phải, tăng theo chiều kim đồng hồ (y xuống)
  let deg = (a * 180) / Math.PI;
  if (deg < 0) deg += 360;
  // cạnh Đ nằm quanh 0°, ĐN quanh 60°... (lục giác đỉnh nhọn nên cạnh nằm giữa các đỉnh)
  return Math.round(deg / 60) % 6;
}

export type SeaKind = 'sea' | 'deep' | 'shoal';

/** Một ô biển lục giác: nước, gợn sóng thưa, viền ô nhạt cho dễ nhìn lưới. */
export function drawSeaHex(kind: SeaKind, seed: number): HTMLCanvasElement {
  const [c, x] = cnv(32, 32);
  const p = new P(x);
  const base = kind === 'deep' ? C.sea2 : kind === 'shoal' ? C.shallow : C.sea;
  const edge = kind === 'deep' ? mix(C.sea2, C.sea3, 0.5) : kind === 'shoal' ? mix(C.shallow, C.sea, 0.3) : mix(C.sea, C.sea2, 0.55);
  for (let y = 0; y < 32; y++)
    for (let i = 0; i < 32; i++) {
      if (!inHex(i, y)) continue;
      const border = !inHex(i - 1, y) || !inHex(i + 1, y) || !inHex(i, y - 1) || !inHex(i, y + 1);
      p.px(i, y, border ? edge : base);
    }
  const r = noise(seed, 1, 3);
  if (r < 0.7) wave(p, 8 + Math.floor(noise(seed, 2) * 12), 10 + Math.floor(noise(seed, 3) * 10));
  if (kind === 'shoal' && r < 0.5) { p.px(12, 20, C.sand2); p.px(13, 20, C.sand2); p.px(20, 12, C.sand2); }
  return c;
}

/** Ô chưa khám phá: mây trắng xám phủ kín, có cuộn mây. */
export function drawFogHex(seed: number): HTMLCanvasElement {
  const [c, x] = cnv(32, 32);
  const p = new P(x);
  for (let y = 0; y < 32; y++)
    for (let i = 0; i < 32; i++) {
      if (!inHex(i, y)) continue;
      const n = noise(i >> 2, y >> 2, seed);
      p.px(i, y, n < 0.5 ? '#e9eef3' : '#dde4ec');
    }
  // cuộn mây
  const cx = 10 + Math.floor(noise(seed, 5) * 10), cy = 12 + Math.floor(noise(seed, 6) * 6);
  for (const [dx, dy] of [[0, 0], [1, -1], [2, -1], [3, 0], [3, 1], [2, 2], [1, 2], [0, 1]]) p.px(cx + dx, cy + dy, '#c4cfdb');
  p.h(cx + 5, cx + 9, cy + 2, '#c4cfdb');
  p.h(cx - 6, cx - 2, cy + 6, '#ffffff');
  return c;
}

/** Tô màu lãnh thổ: phủ màu nhạt, viền đậm ở các cạnh giáp ô khác chủ. */
export function drawTerritory(color: string, sides: boolean[]): HTMLCanvasElement {
  const [c, x] = cnv(32, 32);
  x.globalAlpha = 0.34;
  x.fillStyle = color;
  for (let y = 0; y < 32; y++) for (let i = 0; i < 32; i++) if (inHex(i, y)) x.fillRect(i, y, 1, 1);
  x.globalAlpha = 1;
  for (let y = 0; y < 32; y++)
    for (let i = 0; i < 32; i++) {
      if (!inHex(i, y)) continue;
      const b1 = !inHex(i - 1, y) || !inHex(i + 1, y) || !inHex(i, y - 1) || !inHex(i, y + 1);
      const b2 = !b1 && (!inHex(i - 2, y) || !inHex(i + 2, y) || !inHex(i, y - 2) || !inHex(i, y + 2));
      if ((b1 || b2) && sides[hexSide(i, y)]) {
        x.fillStyle = b1 ? color : mix(color, '#ffffff', 0.45);
        x.fillRect(i, y, 1, 1);
      }
    }
  return c;
}

/** Đảo nhỏ nằm giữa ô lục giác trên hải đồ. */
export function drawHexIsland(seed: number, size = 1): HTMLCanvasElement {
  const [c, x] = cnv(32, 32);
  const p = new P(x);
  const rx = 9 + size * 2, ry = 6 + size;
  const cx = 16, cy = 17;
  const blob = (i: number, y: number, k: number) => {
    const a = Math.atan2(y - cy, i - cx);
    const wob = 1 + 0.18 * Math.sin(a * 3 + seed) + 0.1 * Math.sin(a * 5 + seed * 2);
    return ((i - cx) / (rx * wob)) ** 2 + ((y - cy) / (ry * wob)) ** 2 < k;
  };
  for (let y = 0; y < 32; y++)
    for (let i = 0; i < 32; i++) {
      if (!inHex(i, y)) continue;
      if (blob(i, y, 0.55)) p.px(i, y, (i + y) % 7 === 0 ? C.grass2 : C.grass);
      else if (blob(i, y, 0.82)) p.px(i, y, C.sand);
      else if (blob(i, y, 1)) p.px(i, y, C.foam);
    }
  // vài khóm cây
  for (let k = 0; k < 2 + size; k++) {
    const tx = cx - 5 + Math.floor(noise(seed, k) * 10), ty = cy - 3 + Math.floor(noise(seed, k + 9) * 4);
    p.ell(tx, ty, 1, 1, C.leaf2);
    p.px(tx - 1, ty - 1, C.leaf);
  }
  return c;
}
