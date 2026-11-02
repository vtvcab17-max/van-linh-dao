// Bộ sinh số ngẫu nhiên có hạt giống (deterministic) — client và server cho ra cùng kết quả.
export function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = ReturnType<typeof mulberry32>;

export const rint = (r: Rng, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
export const pick = <T>(r: Rng, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];
export function weighted<T extends { weight: number }>(r: Rng, arr: readonly T[]): T {
  const total = arr.reduce((s, x) => s + x.weight, 0);
  let roll = r() * total;
  for (const x of arr) {
    roll -= x.weight;
    if (roll < 0) return x;
  }
  return arr[arr.length - 1];
}
