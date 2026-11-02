// Vị trí các đảo trên hải đồ lục giác — client và server tính giống hệt nhau (để thời gian đi thuyền khớp).
// Đảo người chơi do server chọn chỗ khi vào lần đầu (PlayerState.home / IslandPub.home).
import { BOTS } from './bots';
import { hashStr } from './rng';
import { worldOf } from './world';

import { SEA_COLS, SEA_ROWS } from './mapsize';
export { SEA_COLS, SEA_ROWS };

type Cell = { x: number; y: number };
/** Thế giới của Hải Khu (kèm chỗ đảo máy). Đọc BOTS lúc gọi để tránh vòng import. */
export const worldFor = (khu: string) => worldOf(khu || '01', BOTS.map((b) => b.id));

/** Ô hải đồ của đảo máy; người chơi chưa có chỗ thì tạm lấy một ô khởi đầu theo mã. */
export function islandCell(id: string, khu = '01'): Cell {
  const w = worldFor(khu);
  const b = w.bots.get(id);
  if (b) return { x: b.c, y: b.r };
  const h = w.spawns[hashStr(id) % w.spawns.length];
  return { x: h.c, y: h.r };
}
