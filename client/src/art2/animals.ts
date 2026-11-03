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

function draw(p: P, sp: Sp, st: number) {
  const k = [0.62, 0.82, 1][Math.min(2, st)];
  const c = COL[sp];
  const bx = 9, by = 11;
  const rx = Math.round((sp === 'ga' ? 4 : 6) * k), ry = Math.round((sp === 'ga' ? 3 : 4) * k);
  // chân
  const legH = sp === 'ga' ? 2 : Math.max(2, Math.round(3 * k));
  const legs = sp === 'ga' ? [-1, 1] : [-rx + 1, -1, 1, rx - 2];
  for (const lx of legs) p.rect(bx + lx, by + ry - 1, 1, legH, sp === 'ga' ? C.gold2 : c.shade);
  // thân
  p.ell(bx, by, rx, ry, c.body);
  p.h(bx - rx + 1, bx + rx - 1, by + ry, c.shade);
  if (c.spot) { p.ell(bx - 1, by - 1, Math.max(1, Math.round(2 * k)), 1, c.spot); p.px(bx + 2, by + 1, c.spot); }
  // đầu: con non có đầu to hơn
  const hr = Math.round((sp === 'ga' ? 2 : 3) * (st === 0 ? 1.25 : k));
  const hx = bx + rx - 1, hy = by - ry + (st === 0 ? 0 : -1);
  p.ell(hx, hy, hr, hr, c.body);
  p.px(hx + 1, hy - 1, '#3d2b2b');
  if (sp === 'ga') {
    p.px(hx + hr + 1, hy, C.gold2);
    if (st >= 1) { p.px(hx, hy - hr - 1, C.red); p.px(hx - 1, hy - hr, C.red); }
    p.h(bx - rx - 1, bx - rx + 1, by - 1, c.shade); // đuôi
    if (st === 0) p.rect(bx - 1, by - 1, 3, 1, C.straw);
  } else if (sp === 'lon') {
    p.rect(hx + hr - 1, hy, 2, 2, c.shade); // mõm
    p.px(hx - 1, hy - hr, c.shade); // tai
    p.px(bx - rx - 1, by - 1, c.shade); // đuôi
  } else if (sp === 'bo') {
    p.px(hx - 1, hy - hr - 1, C.straw3); p.px(hx + 1, hy - hr - 1, C.straw3); // sừng ngắn
    p.rect(hx + hr - 1, hy + 1, 2, 2, C.pink);
    p.v(bx - rx - 1, by - 1, by + 2, c.shade);
  } else {
    const h = st === 2 ? 2 : 1; // sừng cong, lớn thì dài hơn
    p.rect(hx - 2, hy - hr - h, 1, h, C.metal2); p.rect(hx + 1, hy - hr - h, 1, h, C.metal2);
    p.px(hx - 3, hy - hr - h, C.metal2); p.px(hx + 2, hy - hr - h, C.metal2);
    p.rect(hx + hr - 1, hy + 1, 2, 2, c.shade);
    p.v(bx - rx - 1, by - 1, by + 2, c.shade);
  }
}

const cache = new Map<string, string>();
/** Hình (data URL) của một giống ở giai đoạn st (0 con, 1 tơ, 2 trưởng thành). */
export function animalUrl(sp: Sp, st: number): string {
  const key = sp + st;
  let u = cache.get(key);
  if (!u) {
    const [c, x] = cnv(20, 16);
    draw(new P(x), sp, st);
    u = enhance(outline(c)).toDataURL();
    cache.set(key, u);
  }
  return u;
}
