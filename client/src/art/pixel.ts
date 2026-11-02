// Bảng màu và công cụ vẽ pixel. Toàn bộ đồ họa được vẽ bằng code → không cần file ảnh, game nhẹ.
export const PAL: Record<string, string> = {
  k: '#1d1b2a', // viền
  K: '#3b2f3a',
  w: '#fbf3dc',
  i: '#ffffff',
  y: '#e8c56e', // rơm
  Y: '#b98d3e',
  z: '#7f5a22',
  t: '#9b6a3c', // gỗ
  T: '#6a4326',
  u: '#c98f55',
  g: '#86c95c', // cỏ
  G: '#57a043',
  H: '#2f6a35',
  a: '#4f9a48', // tre
  A: '#a6d86e',
  b: '#3a90c2', // nước
  B: '#24668f',
  c: '#a8e6f0',
  s: '#f2d99c', // cát
  S: '#d6b26d',
  n: '#b2b5bd', // đá
  N: '#7b7e88',
  M: '#4c4e58',
  m: '#dbe3ea', // kim loại sáng
  r: '#b15d3a', // rỉ
  R: '#7a3b2a',
  o: '#ec9640',
  O: '#c95a2e',
  e: '#dc4a3e',
  E: '#962f2b',
  h: '#f3c39c', // da
  j: '#c98b63',
  d: '#2b201d', // tóc
  p: '#4566b0', // áo xanh
  P: '#2c4378',
  v: '#9563c9',
  V: '#5f3b8a',
  l: '#f6d34d', // vàng
  L: '#c8952a',
  q: '#ef7c98',
  x: '#5fd0e0',
  X: '#2f9fb5',
  f: '#f7f0e6', // áo trắng
  F: '#cfc6ba',
};

export type Canvas = HTMLCanvasElement;

export function canvas(w: number, h: number): [Canvas, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

/** Vẽ sprite từ bản đồ ký tự. '.' = trong suốt. */
export function fromMap(rows: string[], pal: Record<string, string> = PAL, scale = 1): Canvas {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const [c, ctx] = canvas(w * scale, h * scale);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch === '.' || ch === ' ') continue;
      const col = pal[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  return c;
}

export function recolor(rows: string[], swap: Record<string, string>): string[] {
  return rows.map((r) => [...r].map((ch) => swap[ch] ?? ch).join(''));
}

export class Pen {
  ctx: CanvasRenderingContext2D;
  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }
  px(x: number, y: number, col: string) {
    this.ctx.fillStyle = PAL[col] ?? col;
    this.ctx.fillRect(x, y, 1, 1);
  }
  rect(x: number, y: number, w: number, h: number, col: string) {
    this.ctx.fillStyle = PAL[col] ?? col;
    this.ctx.fillRect(x, y, w, h);
  }
  hline(x0: number, x1: number, y: number, col: string) {
    this.rect(Math.min(x0, x1), y, Math.abs(x1 - x0) + 1, 1, col);
  }
  vline(x: number, y0: number, y1: number, col: string) {
    this.rect(x, Math.min(y0, y1), 1, Math.abs(y1 - y0) + 1, col);
  }
  line(x0: number, y0: number, x1: number, y1: number, col: string) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    let dx = Math.abs(x1 - x0),
      dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1,
      sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, col);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, col: string, fill = true) {
    for (let y = -ry; y <= ry; y++)
      for (let x = -rx; x <= rx; x++) {
        const d = (x * x) / (rx * rx + 0.01) + (y * y) / (ry * ry + 0.01);
        if (fill ? d <= 1 : d <= 1 && d > 0.62) this.px(cx + x, cy + y, col);
      }
  }
  /** Tô kín đa giác (quét từng dòng) — dùng cho mái nhà, cánh buồm. */
  poly(pts: [number, number][], col: string) {
    const ys = pts.map((p) => p[1]);
    const y0 = Math.floor(Math.min(...ys));
    const y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const xs: number[] = [];
      const yc = y + 0.5;
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const xa = Math.round(xs[i]);
        const xb = Math.round(xs[i + 1]) - 1;
        if (xb >= xa) this.hline(xa, xb, y, col);
      }
    }
  }
  /** Ô bàn cờ hai màu (đan tre, khăn rằn). */
  checker(x: number, y: number, w: number, h: number, a: string, b: string, size = 1) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, (Math.floor(i / size) + Math.floor(j / size)) % 2 ? b : a);
  }
  /** Mắt linh vật: 2 mắt trắng có con ngươi; nhắm = vạch ngang. */
  eyes(x: number, y: number, gap: number, closed: boolean, mood: 'vui' | 'thuong' | 'doi' = 'thuong') {
    for (const ex of [x, x + gap]) {
      if (closed) {
        this.hline(ex, ex + 1, y + 1, 'k');
        continue;
      }
      this.rect(ex, y, 2, 2, 'i');
      this.px(ex + (mood === 'doi' ? 0 : 1), y + 1, 'k');
      if (mood === 'doi') this.hline(ex, ex + 1, y - 1, 'k');
      if (mood === 'vui') this.px(ex, y + 2, 'q');
    }
  }
}

/** Nhiễu ổn định theo toạ độ — làm hạt cát, ngọn cỏ. */
export function noise(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
