// Vị trí các đảo trên hải đồ — client và server tính giống hệt nhau (để thời gian đi thuyền khớp).
import { HOME_CELL, WILDS } from './data';
import { BOTS } from './bots';
import { hashStr } from './rng';

export const SEA_COLS = 40;
export const SEA_ROWS = 24;

type Cell = { x: number; y: number };
const far = (a: Cell, b: Cell) => Math.abs(a.x - b.x) >= 6 || Math.abs(a.y - b.y) >= 4;

function place(id: string, taken: Cell[]): Cell {
  let h = hashStr(id);
  for (let i = 0; i < 120; i++) {
    const c = { x: 3 + (h % (SEA_COLS - 6)), y: 3 + ((h >>> 8) % (SEA_ROWS - 6)) };
    if (taken.every((t) => far(t, c))) return c;
    h = hashStr(`${id}#${i}`);
  }
  return { x: 3 + (h % (SEA_COLS - 6)), y: 3 + ((h >>> 8) % (SEA_ROWS - 6)) };
}

let fixed: { cells: Cell[]; bots: Map<string, Cell> } | null = null;
/** Đảo hoang, đảo nhà, đảo máy: chỗ cố định, không chồng lên nhau. */
function fixedCells() {
  if (fixed) return fixed;
  const cells: Cell[] = [...WILDS.map((w) => ({ x: w.sx, y: w.sy })), HOME_CELL];
  const bots = new Map<string, Cell>();
  for (const b of BOTS) {
    const c = place(b.id, cells);
    cells.push(c);
    bots.set(b.id, c);
  }
  fixed = { cells, bots };
  return fixed;
}

/** Ô hải đồ của một đảo (đảo máy hoặc người chơi). */
export function islandCell(id: string): Cell {
  const f = fixedCells();
  return f.bots.get(id) ?? place(id, f.cells);
}
