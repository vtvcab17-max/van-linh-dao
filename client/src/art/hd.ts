// Nâng đồ họa lên kiểu 32-bit: mọi hình vẽ được làm mịn gấp đôi độ chi tiết (Scale2x),
// viền đen đổi thành viền cùng tông màu (selective outline), thêm ánh sáng từ trên-trái và bóng dưới-phải.
import type { Canvas } from './pixel';

/** Hệ số chi tiết: 1 điểm ảnh gốc = 2x2 điểm ảnh khi vẽ. */
export const HD = 2;

const luma = (c: number) => 0.299 * (c & 255) + 0.587 * ((c >>> 8) & 255) + 0.114 * ((c >>> 16) & 255);
const alphaOf = (c: number) => c >>> 24;
const isLine = (c: number) => alphaOf(c) > 200 && (c & 255) < 72 && ((c >>> 8) & 255) < 64 && ((c >>> 16) & 255) < 76;

function mixRgb(c: number, t: number, to: number) {
  const r = c & 255,
    g = (c >>> 8) & 255,
    b = (c >>> 16) & 255;
  const tr = to & 255,
    tg = (to >>> 8) & 255,
    tb = (to >>> 16) & 255;
  return (
    ((alphaOf(c) << 24) |
      (Math.round(b + (tb - b) * t) << 16) |
      (Math.round(g + (tg - g) * t) << 8) |
      Math.round(r + (tr - r) * t)) >>>
    0
  );
}
const WHITE = 0xffffffff;
const BLACK = 0xff2a1b1d; // #1d1b2a (thứ tự byte ABGR)
const SHADE = 0xff4a2a3a; // bóng ngả tím ấm

function scale2x(src: Uint32Array, w: number, h: number): Uint32Array {
  const W = w * 2;
  const out = new Uint32Array(W * h * 2);
  const P = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[y * w + x]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = src[y * w + x];
      const A = P(x, y - 1),
        B = P(x + 1, y),
        C = P(x - 1, y),
        D = P(x, y + 1);
      const o = y * 2 * W + x * 2;
      // con ngươi, nét mảnh cạnh vùng trắng: giữ nguyên, không làm mịn mất
      if (isLine(p) && (luma(A) > 228 || luma(B) > 228 || luma(C) > 228 || luma(D) > 228)) {
        out[o] = out[o + 1] = out[o + W] = out[o + W + 1] = p;
        continue;
      }
      out[o] = C === A && C !== D && A !== B ? A : p;
      out[o + 1] = A === B && A !== C && B !== D ? B : p;
      out[o + W] = D === C && D !== B && C !== A ? C : p;
      out[o + W + 1] = B === D && B !== A && D !== C ? D : p;
    }
  return out;
}

export interface EnhanceOpts {
  /** đổi viền đen thành viền cùng tông */
  selout?: boolean;
  /** ánh sáng trên-trái, bóng dưới-phải, chuyển sắc theo chiều cao */
  light?: boolean;
}

/** Trả về canvas gấp đôi kích thước, đã làm mịn và đánh bóng. */
export function enhance(src: Canvas, o: EnhanceOpts = {}): Canvas {
  const selout = o.selout ?? true;
  const light = o.light ?? true;
  const w = src.width,
    h = src.height;
  const c = document.createElement('canvas');
  c.width = w * HD;
  c.height = h * HD;
  if (!w || !h) return c;
  const data = src.getContext('2d')!.getImageData(0, 0, w, h);
  const s32 = new Uint32Array(data.data.buffer);
  const px = scale2x(s32, w, h);
  const W = w * 2,
    H = h * 2;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : px[y * W + x]);
  const out = new Uint32Array(px);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = px[y * W + x];
      if (alphaOf(p) < 200) continue;
      if (isLine(p)) {
        if (!selout) continue;
        // viền: lấy màu phổ biến nhất của các điểm kề không phải viền
        const counts = new Map<number, number>();
        let lightN = 0,
          total = 0,
          edge = false;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const q = at(x + dx, y + dy);
            if (alphaOf(q) < 120) {
              if (!dx || !dy) edge = true;
              continue;
            }
            if (isLine(q)) continue;
            total++;
            if (luma(q) > 228) lightN++;
            counts.set(q, (counts.get(q) ?? 0) + 1);
          }
        if (!total || lightN * 2 >= total) continue; // con ngươi, chữ: giữ đen
        let best = 0,
          bn = -1;
        for (const [q, n] of counts) if (n > bn) ((best = q), (bn = n));
        out[y * W + x] = edge ? mixRgb(mixRgb(best, 0.62, BLACK), 0.25, SHADE) : mixRgb(best, 0.5, BLACK);
        continue;
      }
      if (!light) continue;
      let q = p;
      // ánh sáng hướng trên-trái
      const tl = alphaOf(at(x - 2, y - 2)) < 120 || isLine(at(x - 1, y - 1));
      const br = alphaOf(at(x + 2, y + 2)) < 120 || isLine(at(x + 1, y + 1));
      if (tl && !br) q = mixRgb(q, 0.22, WHITE);
      else if (br && !tl) q = mixRgb(q, 0.2, SHADE);
      // chuyển sắc theo chiều cao (trên sáng, dưới tối) cho cảm giác khối
      const t = y / H;
      q = t < 0.5 ? mixRgb(q, (0.5 - t) * 0.12, WHITE) : mixRgb(q, (t - 0.5) * 0.18, SHADE);
      out[y * W + x] = q;
    }
  const img = new ImageData(new Uint8ClampedArray(out.buffer), W, H);
  c.getContext('2d')!.putImageData(img, 0, 0);
  return c;
}
