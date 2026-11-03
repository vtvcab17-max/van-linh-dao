// Bộ đồ họa mới (art2): một cỡ pixel duy nhất, bảng màu sáng dịu, viền nâu sẫm 1 điểm ảnh.
// Mọi hình vẽ bằng code trên lưới 16 điểm ảnh/ô, phóng nguyên lần khi hiển thị.

export const OUT = '#3d2b2b'; // viền nâu sẫm, không dùng đen thuần
export const SHADOW = 'rgba(61,43,43,0.22)';

export const C = {
  skin: '#ffdcb8', skin2: '#eeb08a', blush: '#f79a8c',
  hair: '#4d3529', hair2: '#6e4c39',
  straw: '#f8df92', straw2: '#dcb560', straw3: '#b28a40',
  metal: '#eef1f5', metal2: '#bcc4cf', metal3: '#838e9d',
  red: '#ee5d4a', red2: '#bc3c31',
  green: '#86cf70', green2: '#55a456', green3: '#367a40',
  blue: '#68a0e6', blue2: '#4270bb',
  indigo: '#5468b8', indigo2: '#3a4a8a',
  brown: '#cf9563', brown2: '#a06a45',
  white: '#fbf6ea', white2: '#ddd0b8',
  gold: '#ffd955', gold2: '#e3a52e', gold3: '#a8742a',
  wood: '#c28552', wood2: '#94603a', wood3: '#6c4229',
  pants: '#5d4c62', shoe: '#6b4a3a',
  pink: '#f7a8c0', pink2: '#d97898',
  teal: '#62bfc0', teal2: '#3e939c', teal3: '#2c6d78',
  roof: '#e46a4c', roof2: '#b84a36',
  stone: '#efe9da', stone2: '#cfc5af', stone3: '#a49a84',
  grass: '#bfe07a', grass2: '#a6d063', grass3: '#86b84e', grass4: '#679a3e',
  sand: '#f7e8b4', sand2: '#ead293', sand3: '#cfb072',
  sea: '#62c4e4', sea2: '#4aaed8', sea3: '#3b93c9', foam: '#eafcff', shallow: '#8ddcec',
  leaf: '#7cc45c', leaf2: '#4f9a45', leaf3: '#356f37',
};

export function cnv(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  return [c, x];
}

/** Bút vẽ điểm ảnh, nhận mã màu trực tiếp. */
export class P {
  constructor(public x: CanvasRenderingContext2D) {}
  px(x: number, y: number, c: string) {
    this.x.fillStyle = c;
    this.x.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  rect(x: number, y: number, w: number, h: number, c: string) {
    if (w <= 0 || h <= 0) return;
    this.x.fillStyle = c;
    this.x.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  h(x0: number, x1: number, y: number, c: string) {
    this.rect(Math.min(x0, x1), y, Math.abs(x1 - x0) + 1, 1, c);
  }
  v(x: number, y0: number, y1: number, c: string) {
    this.rect(x, Math.min(y0, y1), 1, Math.abs(y1 - y0) + 1, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: string) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  ell(cx: number, cy: number, rx: number, ry: number, c: string) {
    for (let y = -ry; y <= ry; y++)
      for (let x = -rx; x <= rx; x++) if ((x * x) / ((rx + 0.5) ** 2) + (y * y) / ((ry + 0.5) ** 2) <= 1) this.px(cx + x, cy + y, c);
  }
  poly(pts: [number, number][], c: string) {
    const ys = pts.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const xs: number[] = [];
      const yc = y + 0.5;
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const a = Math.round(xs[i]), b = Math.round(xs[i + 1]) - 1;
        if (b >= a) this.h(a, b, y, c);
      }
    }
  }
  /** Vẽ theo bản đồ ký tự; ký tự không có trong bảng thì bỏ qua. */
  map(ox: number, oy: number, rows: string[], pal: Record<string, string>) {
    rows.forEach((r, y) => [...r].forEach((ch, x) => pal[ch] && this.px(ox + x, oy + y, pal[ch])));
  }
}

/** Viền 1 điểm ảnh quanh mọi phần có màu (chỉ 4 hướng → nét gọn, bo tròn). */
export function outline(src: HTMLCanvasElement, col = OUT): HTMLCanvasElement {
  const w = src.width, h = src.height;
  const [c, x] = cnv(w, h);
  const d = src.getContext('2d')!.getImageData(0, 0, w, h).data;
  const a = (i: number, j: number) => (i < 0 || j < 0 || i >= w || j >= h ? 0 : d[(j * w + i) * 4 + 3]);
  x.fillStyle = col;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++)
      if (a(i, j) < 128 && (a(i - 1, j) >= 128 || a(i + 1, j) >= 128 || a(i, j - 1) >= 128 || a(i, j + 1) >= 128)) x.fillRect(i, j, 1, 1);
  x.drawImage(src, 0, 0);
  return c;
}

/** Bóng đổ dưới chân. */
export function shadow(p: P, cx: number, cy: number, rx: number) {
  p.x.fillStyle = SHADOW;
  for (let y = -1; y <= 1; y++) {
    const half = Math.round(rx * Math.sqrt(1 - (y * y) / 2.2));
    p.x.fillRect(cx - half, cy + y, half * 2 + 1, 1);
  }
}

/** Lật ngang (quân địch quay mặt sang trái). */
export function flip(src: HTMLCanvasElement): HTMLCanvasElement {
  const [c, x] = cnv(src.width, src.height);
  x.translate(src.width, 0);
  x.scale(-1, 1);
  x.drawImage(src, 0, 0);
  return c;
}

export function scaleUp(src: HTMLCanvasElement, k: number): HTMLCanvasElement {
  const [c, x] = cnv(src.width * k, src.height * k);
  x.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

const OUT_RGB = [0x3d, 0x2b, 0x2b];
const isEdge = (d: Uint8ClampedArray, w: number, h: number, i: number, j: number) => {
  if (i < 0 || j < 0 || i >= w || j >= h) return true;
  const k = (j * w + i) * 4;
  return d[k + 3] < 128 || (d[k] === OUT_RGB[0] && d[k + 1] === OUT_RGB[1] && d[k + 2] === OUT_RGB[2]);
};

/** Ánh sáng thống nhất từ góc trên-trái: mép sáng phía sáng, mép tối phía khuất (sửa tại chỗ). */
export function shadeEdges(d: Uint8ClampedArray, w: number, h: number): void {
  const src = new Uint8ClampedArray(d);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const k = (j * w + i) * 4;
      if (src[k + 3] < 128 || isEdge(src, w, h, i, j)) continue;
      const lit = isEdge(src, w, h, i - 1, j) || isEdge(src, w, h, i, j - 1);
      const dark = isEdge(src, w, h, i + 1, j) || isEdge(src, w, h, i, j + 1);
      if (lit === dark) continue;
      for (let c = 0; c < 3; c++) d[k + c] = lit ? Math.min(255, src[k + c] + (255 - src[k + c]) * 0.28) : src[k + c] * 0.82;
    }
}

/** Áp shadeEdges cho một canvas đã có viền. */
export function lit(src: HTMLCanvasElement): HTMLCanvasElement {
  const x = src.getContext('2d')!;
  const im = x.getImageData(0, 0, src.width, src.height);
  shadeEdges(im.data, src.width, src.height);
  x.putImageData(im, 0, 0);
  return src;
}
