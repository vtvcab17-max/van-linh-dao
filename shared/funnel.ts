// Phễu nhiệm vụ: người chơi dừng ở bước nào (spec 022). Thuần.
export interface FunnelStep { id: string; text: string; n: number; pct: number; drop: number; stuck: number }

export function funnelOf(doneLists: string[][], chain: { id: string; text: string }[]): { total: number; steps: FunnelStep[] } {
  const total = doneLists.length;
  const sets = doneLists.map((l) => new Set(Array.isArray(l) ? l : []));
  let prev = total;
  const steps = chain.map((q) => {
    const n = sets.filter((s) => s.has(q.id)).length;
    const stuck = sets.filter((s) => {
      const first = chain.find((c) => !s.has(c.id));
      return first?.id === q.id;
    }).length;
    const step: FunnelStep = { id: q.id, text: q.text, n, pct: total ? Math.round((100 * n) / total) : 0, drop: Math.max(0, prev - n), stuck };
    prev = n;
    return step;
  });
  return { total, steps };
}
