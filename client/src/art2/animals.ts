// Vật nuôi chibi theo giai đoạn (con, tơ, trưởng thành), 20x16 điểm ảnh, bộ art2.
import { C, cnv, outline, P } from './pal';
import { enhance } from '../art/hd';
import type { Sp } from '../../../shared/society';

const COL: Record<Sp, { body: string; shade: string; spot?: string }> = {
  ga: { body: C.white, shade: C.white2 },
  lon: { body: C.pink, shade: C.pink2 },
  bo: { body: C.white, shade: C.white2, spot: C.brown2 },
  trau: { body: '#8a7a78', shade: '#625452' },
};

function chicken(p: P, st: number) {
  const k = [0.6, 0.85, 1][st];
  const c = COL.ga;
  const rx = Math.round(4 * k), ry = Math.round(3 * k);
  const bx = 9, by = 11;
  for (const lx of [-1, 1]) p.v(bx + lx, by + ry - 1, by + ry + 1, C.gold2);
  p.ell(bx, by, rx, ry, c.body);
  p.h(bx - rx + 1, bx + rx - 1, by + ry, c.shade);
  const hr = Math.round(2 * (st === 0 ? 1.3 : k));
  const hx = bx + rx - 1, hy = by - ry + (st === 0 ? 0 : -1);
  p.ell(hx, hy, hr, hr, c.body);
  p.px(hx + 1, hy - 1, '#3d2b2b');
  p.px(hx + hr + 1, hy, C.gold2);
  if (st >= 1) { p.px(hx, hy - hr - 1, C.red); p.px(hx - 1, hy - hr, C.red); p.px(hx + 1, hy + hr, C.red); }
  p.h(bx - rx - 1, bx - rx + 1, by - 1, c.shade);
  if (st === 0) p.rect(bx - 1, by - 1, 3, 1, C.straw);
}

/** Gia súc bốn chân: thân chữ nhật bo góc, bốn chân tách rời, đầu nhô phía trước. */
function quad(p: P, sp: 'lon' | 'bo' | 'trau', st: number) {
  const k = [0.62, 0.84, 1][st];
  const c = COL[sp];
  const bodyW = Math.round((sp === 'lon' ? 10 : 12) * k) + 2;
  const bodyH = Math.round((sp === 'lon' ? 5 : 6) * k) + 1;
  const legH = Math.max(2, Math.round((sp === 'lon' ? 2 : 3) * k));
  const gy = 14; // mặt đất
  const x0 = 3, top = gy - legH - bodyH;
  // chân (tối hơn thân, đủ 4 chân)
  const legCols = [x0 + 1, x0 + 3, x0 + bodyW - 4, x0 + bodyW - 2];
  for (const lx of legCols) p.rect(lx, gy - legH, 1, legH, c.shade);
  for (const lx of legCols) p.px(lx, gy, '#4a3a3a'); // móng
  // thân
  p.rect(x0, top, bodyW, bodyH, c.body);
  p.px(x0, top, 'rgba(0,0,0,0)');
  p.h(x0, x0 + bodyW - 1, top + bodyH - 1, c.shade);
  if (c.spot) { p.rect(x0 + 2, top + 1, Math.max(2, Math.round(3 * k)), Math.max(1, Math.round(2 * k)), c.spot); p.rect(x0 + bodyW - 4, top + 2, 2, 2, c.spot); }
  // đầu
  const hs = Math.max(3, Math.round(5 * (st === 0 ? 0.85 : k) + 1));
  const hx = x0 + bodyW, hy = top + (sp === 'trau' ? 1 : 0);
  p.rect(hx - 1, hy, hs, hs, c.body);
  p.px(hx + 1, hy + 1, '#3d2b2b');
  if (sp === 'lon') {
    p.rect(hx + hs - 1, hy + hs - 3, 2, 3, C.pink2); // mõm
    p.px(hx + hs - 1, hy + hs - 2, '#3d2b2b'); // lỗ mũi
    p.px(hx, hy - 1, c.shade); p.px(hx + 1, hy - 1, c.shade); // tai
    p.px(x0 - 1, top + 1, c.shade); p.px(x0 - 2, top, c.shade); // đuôi xoăn
  } else if (sp === 'bo') {
    p.rect(hx + hs - 2, hy + hs - 2, 3, 2, C.pink); // mõm hồng
    p.px(hx - 1, hy - 1, C.straw3); p.px(hx + hs - 2, hy - 1, C.straw3); // sừng
    p.rect(hx - 2, hy + 1, 1, 2, c.shade); // tai
    if (st === 2) p.rect(x0 + bodyW - 4, top + bodyH, 3, 1, C.pink); // bầu sữa
    p.v(x0 - 1, top + 1, top + bodyH, c.shade); p.px(x0 - 1, top + bodyH + 1, '#3d2b2b'); // đuôi
  } else {
    // trâu: bướu vai, sừng cong dài
    p.rect(x0 + bodyW - 4, top - 1, 4, 1, c.body);
    const hh = st === 2 ? 2 : 1;
    p.rect(hx - 2, hy - hh, 1, hh, C.metal2); p.rect(hx + hs - 1, hy - hh, 1, hh, C.metal2);
    p.px(hx - 3, hy - hh, C.metal2); p.px(hx + hs, hy - hh, C.metal2);
    p.rect(hx + hs - 2, hy + hs - 2, 3, 2, c.shade);
    p.rect(hx - 2, hy + 1, 1, 2, c.shade);
    p.v(x0 - 1, top + 1, top + bodyH, c.shade);
  }
}

function draw(p: P, sp: Sp, st: number) {
  if (sp === 'ga') chicken(p, Math.min(2, st));
  else quad(p, sp, Math.min(2, st));
}

const cache = new Map<string, string>();
/** Hình (data URL) của một giống ở giai đoạn st (0 con, 1 tơ, 2 trưởng thành). */
export function animalUrl(sp: Sp, st: number): string {
  const key = sp + st;
  let u = cache.get(key);
  if (!u) {
    const [c, x] = cnv(22, 16);
    draw(new P(x), sp, st);
    u = enhance(outline(c)).toDataURL();
    cache.set(key, u);
  }
  return u;
}
