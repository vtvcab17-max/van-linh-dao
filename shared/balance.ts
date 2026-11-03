// Cân bằng tài nguyên: hằng số tiêu thụ/bán và các phép đo dùng cho test (spec 005).
import { EVOLVE_COST, FEEDABLE, NODES, type NodeKind, type ResKey } from './data';
import { B_KEYS, BUILDINGS } from './economy';
import { PROCS } from './eco';

/** Số điểm thu hoạch của đảo mới (khớp newPlayer). */
export const NEW_ISLAND_NODES: Record<NodeKind, number> = { palm: 1, bamboo: 1, drift: 1, rock: 1, scrap: 1, grass: 2 };
/** Cỏ mỗi con vật nuôi ăn mỗi giờ. */
export const FEED_CO_PER_HOUR = 0.5;
/** Gói thực phẩm: mỗi 4 phần cần 1 lá. */
export const WRAP_PER_LA = 4;
/** Giá bán ở sạp chợ (đồng mỗi đơn vị), tăng 5% mỗi cấp Chợ. */
export const SELL_PRICE: Partial<Record<ResKey, number>> = { co: 0.1, cui: 0.12, la: 0.2 };
export const SELL_CHO_BONUS = 0.05;

/** Tổng một vật liệu cần cho mọi cấp mọi công trình và các bậc tiến hóa. */
export function totalCost(res: ResKey): number {
  let n = 0;
  for (const c of EVOLVE_COST) n += c[res] ?? 0;
  for (const k of B_KEYS) for (const c of BUILDINGS[k].cost) n += c[res] ?? 0;
  return n;
}
/** Nguồn tối đa mỗi giờ khi nhặt liên tục ở đảo mới. */
export function supplyPerHour(res: ResKey, nodes = NEW_ISLAND_NODES): number {
  let v = 0;
  for (const [k, c] of Object.entries(nodes) as [NodeKind, number][]) {
    const d = NODES[k];
    v += c * (d.yields[res] ?? 0) * (3600_000 / d.regrowMs);
  }
  return v;
}
/** Số giờ để đủ cho toàn bộ cây công trình ở nguồn tối đa. */
export function hoursToAfford(res: ResKey): number {
  const sup = supplyPerHour(res);
  return sup > 0 ? totalCost(res) / sup : Infinity;
}
/** Các chỗ tiêu có ý nghĩa của một tài nguyên. */
export function sinksOf(res: ResKey): string[] {
  const out: string[] = [];
  if (totalCost(res) > 0) out.push('xây dựng');
  if (FEEDABLE.includes(res)) out.push('nuôi linh vật');
  for (const p of Object.values(PROCS)) if ((p.take as Partial<Record<ResKey, number>>)[res]) out.push('chế biến: ' + p.name);
  if (res === 'co') out.push('thức ăn vật nuôi');
  if (res === 'la') out.push('gói thực phẩm');
  if (SELL_PRICE[res]) out.push('bán ở sạp chợ');
  return out;
}
