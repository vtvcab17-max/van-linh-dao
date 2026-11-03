// Vẽ quái ngẫu nhiên từ MonsterSpec: tô theo ô, tô sáng-tối theo hướng ánh sáng, viền và bóng đổ chung bộ art2.
import { genMonster, type Cell, type Family, type MonsterSpec } from '../../../shared/monstergen';
import { cnv, lit, outline, P, shadow } from './pal';

const W = 16, H = 16, OX = 2, OY = 3;

export function drawMonsterSpec(m: MonsterSpec): HTMLCanvasElement {
  const [c0, x0] = cnv(W, H);
  const p = new P(x0);
  const { pal } = m;
  const at = (r: number, c: number): Cell => m.cells[r]?.[c] ?? 0;
  m.cells.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (!cell) return;
      let col = pal.mid;
      if (cell === 2) col = pal.accent;
      else if (cell === 4) col = pal.dark;
      else if (cell === 3) col = pal.eye;
      else if (!at(r - 1, c) || !at(r, c - 1)) col = pal.light; // mép trên/trái sáng
      else if (!at(r + 1, c) || !at(r, c + 1)) col = pal.dark; // mép dưới/phải tối
      p.px(OX + c, OY + r, col);
    }),
  );
  // đồng tử cho mắt
  m.cells.forEach((row, r) => row.forEach((cell, c) => cell === 3 && p.px(OX + c, OY + r + (at(r + 1, c) ? 0 : 0), '#2a1a1a')));
  const o = lit(outline(c0));
  const [c, x] = cnv(W, H);
  shadow(new P(x), OX + 6, OY + 10, 5);
  x.drawImage(o, 0, 0);
  return c;
}

export const drawMonster = (seed: number, family?: Family) => drawMonsterSpec(genMonster(seed, family));
