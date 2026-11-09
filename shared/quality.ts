// Chế độ hình ảnh: quyết định độ phân giải vẽ, FPS mục tiêu và khi nào tự hạ mức (hàm thuần, dễ kiểm thử).
export type Quality = 'auto' | 'cao' | 'tietkiem';
export const QUALITIES: Quality[] = ['auto', 'cao', 'tietkiem'];

export function parseQuality(v: unknown): Quality {
  return v === 'cao' || v === 'tietkiem' || v === 'auto' ? v : 'auto';
}
/** Hệ số giảm độ phân giải (2 = vẽ nửa độ phân giải rồi phóng to bằng CSS). */
export function rsFor(q: Quality, w: number, h: number): 1 | 2 {
  if (q === 'tietkiem') return 2;
  return w >= 900 && h >= 560 ? 2 : 1;
}
export function fpsFor(q: Quality): number {
  return q === 'tietkiem' ? 30 : 60;
}
/** Chỉ hạ mức khi đang Tự động, đủ mẫu (≥ minSamples) và FPS trung bình thấp. */
export function shouldDegrade(q: Quality, fpsSamples: number[], opt: { below?: number; minSamples?: number } = {}): boolean {
  const below = opt.below ?? 35;
  const min = opt.minSamples ?? 6;
  if (q !== 'auto' || fpsSamples.length < min) return false;
  const recent = fpsSamples.slice(-min);
  return recent.every((f) => f > 0 && f < below);
}
