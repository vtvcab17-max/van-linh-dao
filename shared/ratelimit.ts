// Thùng token giới hạn tốc độ lệnh theo người chơi (spec 021). Thuần, không phụ thuộc đồng hồ ngoài.
export interface Limiter {
  allow(key: string, cost: number, now: number): boolean;
  prune(now: number, idleMs?: number): void;
  size(): number;
}

export function makeLimiter(o: { cap: number; perSec: number }): Limiter {
  const m = new Map<string, { tokens: number; at: number }>();
  return {
    allow(key, cost, now) {
      const b = m.get(key) ?? { tokens: o.cap, at: now };
      b.tokens = Math.min(o.cap, b.tokens + Math.max(0, now - b.at) * (o.perSec / 1000));
      b.at = now;
      const ok = b.tokens >= cost;
      if (ok) b.tokens -= cost;
      m.set(key, b);
      return ok;
    },
    prune(now, idleMs = 5 * 60_000) {
      for (const [k, b] of m) if (now - b.at > idleMs) m.delete(k);
    },
    size: () => m.size,
  };
}

const HEAVY = new Set(['quay', 'chest', 'sail', 'luyen']);
/** Lệnh nặng tốn 4 điểm, lệnh thường 1 điểm. */
export const actionCost = (t: string) => (HEAVY.has(t) ? 4 : 1);
