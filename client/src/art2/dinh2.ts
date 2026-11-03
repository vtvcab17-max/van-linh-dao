// Nhà cửa trên đảo theo bộ đồ họa mới (art2): mỗi công trình một ô, nhìn chéo 3/4, viền nâu sẫm.
// Bậc 1 mái tranh, bậc 2 mái ngói đỏ, bậc 3 mái ngói men xanh có đầu đao vàng.
import type { BKey } from '../../../shared/economy';
import { curvedRoof } from './builds';
import { C, cnv, lit, outline, P, shadow } from './pal';

/** Bề ngang và mặt đất chung: ảnh neo đáy giữa ô, chân nhà cách đáy ảnh 3 điểm ảnh. */
export const DW = 22;
const H0 = 32;

type Pal3 = [string, string, string];
const ROOF = (L: number): Pal3 => (L >= 3 ? [C.teal, C.teal2, C.teal3] : L === 2 ? [C.roof, C.roof2, '#8e3326'] : [C.straw, C.straw2, C.straw3]);
const OUTC = '#3d2b2b';
const SMOKE = ['#f4f1ea', '#dcd6cc', '#c4bdb2'];
const PLASTER: Pal3 = ['#f3e4c4', '#dcc69c', '#c7ae82'];
const MUD: Pal3 = ['#ecd7b0', '#d4bc93', '#c2a57a'];
const WOOD: Pal3 = [C.wood, C.wood2, C.wood3];

function make(h = H0) {
  const [c, x] = cnv(DW, h);
  return { c, p: new P(x), G: h - 4 };
}
/** Viền rồi vẽ thêm phần không viền (khói, ánh lửa, bọt nước). */
function fin(c: HTMLCanvasElement, after?: (p: P) => void) {
  const o = lit(outline(c));
  if (after) after(new P(o.getContext('2d')!));
  return o;
}

function walls(p: P, x0: number, x1: number, top: number, G: number, w: Pal3, planks = false) {
  p.rect(x0, top, x1 - x0 + 1, G - top, w[0]);
  if (planks) for (let x = x0 + 2; x < x1; x += 3) p.v(x, top + 1, G - 1, w[1]);
  p.v(x1, top, G - 1, w[1]);
  p.h(x0, x1, G - 1, w[2]);
}
function strawRoof(p: P, x0: number, x1: number, apex: number, eave: number) {
  const cx = (x0 + x1 + 1) / 2;
  p.poly([[x0, eave + 1], [cx, apex], [x1 + 1, eave + 1]], C.straw);
  p.poly([[cx, apex], [x1 + 1, eave + 1], [cx + 1, eave + 1]], C.straw2);
  for (let y = apex + 3; y < eave; y += 2) {
    const half = ((y - apex) * (x1 - x0 + 1)) / 2 / (eave + 1 - apex);
    p.h(Math.round(cx - half) + 1, Math.round(cx + half) - 2, y, C.straw2);
  }
  p.h(x0, x1, eave, C.straw3);
  p.px(Math.round(cx) - 1, apex + 2, '#fff6cf');
  p.px(Math.round(cx) - 2, apex + 3, '#fff6cf');
}
/** Mái theo bậc: tranh / ngói đỏ cong / ngói men xanh có trang trí. */
function roof(p: P, L: number, x0: number, x1: number, top: number, eave: number) {
  if (L <= 1) return strawRoof(p, x0, x1, top, eave);
  const [a, b, c] = ROOF(L);
  curvedRoof(p, x0, x1, top + 1, eave, a, b, c, 3);
  p.h(x0 + 3, x1 - 3, top, c);
  if (L >= 3) {
    const cx = (x0 + x1) >> 1;
    p.px(cx, top - 1, C.gold);
    p.px(cx + 1, top - 1, C.gold);
    p.px(x0 + 3, top - 1, C.gold2);
    p.px(x1 - 3, top - 1, C.gold2);
  }
}
function door(p: P, cx: number, top: number, G: number, col = C.wood3) {
  p.rect(cx - 1, top, 3, G - top - 1, col);
  p.px(cx + 1, top + ((G - top) >> 1), C.gold2);
}
function win(p: P, x: number, y: number, lit = true) {
  p.rect(x, y, 3, 2, C.wood3);
  if (lit) p.px(x + 1, y, '#ffe9a6');
}
function smoke(p: P, x: number, y: number) {
  p.ell(x, y, 1, 1, SMOKE[1]);
  p.ell(x + 1, y - 3, 1, 1, SMOKE[0]);
  p.px(x + 2, y - 5, SMOKE[2]);
  p.px(x - 1, y - 1, SMOKE[0]);
}
function flag(p: P, x: number, y: number, col: string, len = 8) {
  p.v(x, y, y + len, C.wood3);
  p.rect(x + 1, y, 4, 3, col);
  p.px(x + 5, y + 1, col);
  p.h(x + 1, x + 4, y + 2, C.red2);
}
function stoneBase(p: P, x0: number, x1: number, G: number, rows = 2) {
  p.rect(x0, G - rows, x1 - x0 + 1, rows, C.stone);
  p.h(x0, x1, G - 1, C.stone2);
  for (let x = x0 + 2; x < x1; x += 4) p.px(x, G - rows, C.stone2);
}
function pillars(p: P, xs: number[], top: number, G: number) {
  for (const x of xs) p.v(x, top, G - 1, C.red);
}

/** Một công trình theo loại và cấp (1..3). */
export function drawDinh2(k: BKey, lv: number): HTMLCanvasElement {
  const L = Math.max(1, Math.min(3, lv));
  switch (k) {
    case 'nhadan': {
      const { c, p, G } = make();
      shadow(p, 11, G, 9);
      if (L === 1) {
        walls(p, 5, 16, 19, G, MUD);
        door(p, 9, 21, G);
        win(p, 12, 21);
        strawRoof(p, 3, 18, 8, 19);
      } else if (L === 2) {
        walls(p, 4, 17, 18, G, WOOD, true);
        door(p, 10, 20, G);
        win(p, 5, 20);
        win(p, 14, 20);
        roof(p, 2, 3, 18, 10, 18);
      } else {
        walls(p, 4, 17, 17, G, PLASTER);
        pillars(p, [4, 8, 13, 17], 17, G);
        door(p, 10, 19, G);
        win(p, 5, 19);
        win(p, 14, 19);
        stoneBase(p, 3, 18, G, 1);
        roof(p, 3, 3, 18, 8, 17);
      }
      return fin(c, L === 1 ? undefined : (q) => q.px(16, 12, SMOKE[0]));
    }
    case 'khothoc': {
      const { c, p, G } = make();
      shadow(p, 11, G, 9);
      // nhà sàn chứa thóc: cột cao chống ẩm, bao thóc xếp trước
      for (const x of [5, 9, 13, 16]) p.v(x, G - 5, G - 1, C.wood3);
      p.h(4, 17, G - 5, C.wood2);
      walls(p, 5, 16, 14, G - 5, L === 1 ? ['#e0c48a', '#c6a868', '#a8874f'] : WOOD, L > 1);
      for (let y = 15; y < G - 6; y += 2) if (L === 1) p.h(6, 15, y, '#c6a868');
      p.rect(9, 17, 3, 5, C.wood3);
      roof(p, L, 3, 18, L === 1 ? 4 : 6, 14);
      const sacks = L + 1;
      for (let i = 0; i < sacks; i++) {
        const sx = 3 + i * 5 - (i > 2 ? 12 : 0), sy = G - 2 - (i > 2 ? 3 : 0);
        p.ell(sx + 1, sy, 2, 1, C.white2);
        p.px(sx + 1, sy - 2, C.straw3);
      }
      return fin(c);
    }
    case 'cho': {
      const { c, p, G } = make();
      shadow(p, 11, G, 9);
      // quầy hàng và mái che sọc
      for (const x of [4, 17]) p.v(x, 11, G - 1, C.wood3);
      p.rect(4, 21, 14, G - 21, C.wood);
      p.h(4, 17, 21, C.wood2);
      for (let x = 6; x < 17; x += 4) p.v(x, 22, G - 1, C.wood2);
      const goods = [C.red, C.gold, C.green, '#ec9640', C.red, C.green];
      goods.forEach((g, i) => p.ell(6 + i * 2, 19, 1, 1, g));
      if (L < 3) {
        for (let x = 3; x <= 18; x++) for (let y = 9; y <= 13; y++) p.px(x, y, ((x >> 1) & 1) ? (L === 1 ? C.straw : C.red) : C.white);
        for (let x = 3; x <= 18; x += 2) p.px(x, 14, ((x >> 1) & 1) ? (L === 1 ? C.straw2 : C.red2) : C.white2);
        p.h(3, 18, 8, L === 1 ? C.straw3 : C.red2);
      } else {
        roof(p, 2, 3, 18, 7, 14);
      }
      return fin(c, L >= 2 ? (q) => { q.rect(5, 15, 2, 3, C.red); q.px(5, 15, C.gold); q.rect(15, 15, 2, 3, C.red); q.px(15, 15, C.gold); } : undefined);
    }
    case 'tramthue': {
      const { c, p, G } = make();
      // cầu tàu gỗ, nhà thu thuế, thanh chắn sơn đỏ trắng
      p.rect(2, G - 4, 18, 4, C.wood);
      for (let x = 3; x < 20; x += 3) p.v(x, G - 4, G - 1, C.wood2);
      p.h(2, 19, G - 1, C.wood3);
      for (const x of [3, 10, 18]) p.v(x, G, G + 2, C.wood3);
      walls(p, 4, 12, 17, G - 4, L === 1 ? MUD : L === 2 ? WOOD : PLASTER, L === 2);
      door(p, 8, 19, G - 4);
      roof(p, L, 3, 13, L === 1 ? 9 : 11, 17);
      p.v(15, G - 11, G - 5, C.wood3);
      for (let x = 15; x <= 20; x++) p.px(x, G - 10, (x & 1) ? C.red : C.white);
      if (L >= 2) flag(p, 17, 6, C.red, 12);
      return fin(c, (q) => { q.h(4, 7, G + 2, C.foam); q.h(13, 16, G + 2, C.foam); });
    }
    case 'thapcanh': {
      const { c, p, G } = make(40);
      shadow(p, 11, G, 7);
      // chân tháp: gỗ (bậc 1) hoặc gạch (bậc 2, 3)
      if (L === 1) {
        for (const x of [5, 16]) { p.v(x, 17, G - 1, C.wood); p.v(x + 1, 17, G - 1, C.wood2); }
        p.line(6, 21, 15, 30, C.wood2);
        p.line(15, 21, 6, 30, C.wood2);
      } else {
        const br: Pal3 = L === 2 ? ['#d88b5a', '#c07447', '#a35f38'] : ['#cbbcae', '#a8998c', '#857769'];
        p.rect(5, 18, 12, G - 18, br[0]);
        for (let y = 20; y < G; y += 3) p.h(5, 16, y, br[1]);
        p.v(16, 18, G - 1, br[2]);
        p.rect(9, G - 6, 3, 6, C.wood3);
        p.rect(9, 22, 3, 2, C.wood3);
      }
      p.rect(3, 15, 16, 3, C.wood);
      p.h(3, 18, 17, C.wood3);
      for (let x = 4; x < 18; x += 3) p.v(x, 12, 14, C.wood2);
      p.h(3, 18, 12, C.wood);
      if (L === 1) strawRoof(p, 3, 18, 4, 11);
      else roof(p, L, 3, 18, 5, 11);
      if (L === 3) { p.h(13, 20, 14, C.wood3); p.px(20, 13, C.metal); }
      flag(p, 11, 0, C.red, 5);
      return fin(c);
    }
    case 'tuong': {
      // đoạn tường đúng một ô: các đoạn đặt cạnh nhau liền thành thành lũy
      const { c, p, G } = make(26);
      if (L === 1) {
        p.rect(3, 14, 16, G - 14, '#c39463');
        for (let y = 16; y < G; y += 3) p.h(3, 18, y, '#a87a4c');
        p.h(3, 18, G - 1, '#8a6038');
        for (let x = 4; x <= 17; x += 3) { p.v(x, 9, 13, C.straw2); p.px(x, 8, C.straw); }
      } else {
        const br: Pal3 = L === 2 ? ['#d88b5a', '#c07447', '#a35f38'] : ['#cbbcae', '#a8998c', '#857769'];
        p.rect(3, 13, 16, G - 13, br[0]);
        for (let y = 15; y < G; y += 2) p.h(3, 18, y, br[1]);
        for (let y = 15; y < G; y += 2) for (let x = (y % 4 ? 5 : 9); x < 18; x += 8) p.v(x, y, y + 1, br[1]);
        p.h(3, 18, G - 1, br[2]);
        p.rect(3, 11, 16, 2, C.stone);
        p.h(3, 18, 12, C.stone2);
        for (const mx of [3, 9, 15]) { p.rect(mx, 7, 4, 4, C.stone); p.h(mx, mx + 3, 10, C.stone2); }
        if (L === 3) { p.px(11, 6, C.gold); p.h(3, 18, G - 2, br[2]); }
      }
      return fin(c);
    }
    case 'donbinh': {
      const { c, p, G } = make();
      shadow(p, 11, G, 9);
      if (L === 1) {
        // lều trại lính bằng vải
        p.poly([[3, G], [11, 10], [19, G]], C.white);
        p.poly([[11, 10], [19, G], [13, G]], C.white2);
        p.poly([[9, G], [11, 18], [13, G]], C.wood3);
        p.h(3, 18, G - 1, C.stone3);
        flag(p, 11, 3, C.red, 7);
      } else {
        walls(p, 4, 17, 18, G, L === 2 ? WOOD : PLASTER, L === 2);
        if (L === 3) { pillars(p, [4, 17], 18, G); stoneBase(p, 3, 18, G, 1); }
        door(p, 10, 20, G);
        roof(p, L, 3, 18, 9, 18);
        flag(p, 3, 2, C.red, 15);
        if (L === 3) flag(p, 17, 2, C.gold2, 15);
      }
      // giá giáo
      for (const x of [16, 18, 20]) { p.v(x, G - 8, G - 1, C.wood2); p.px(x, G - 9, C.metal); }
      p.h(15, 20, G - 4, C.wood3);
      return fin(c);
    }
    case 'xuongren': {
      const { c, p, G } = make();
      shadow(p, 11, G, 9);
      // ống khói đá
      p.rect(14, 7, 4, 12, C.stone2);
      p.v(17, 7, 18, C.stone3);
      p.h(13, 18, 7, C.stone3);
      walls(p, 3, 15, 18, G, L === 3 ? PLASTER : ['#b9b0a2', '#9d9384', '#80776a']);
      p.rect(6, 20, 5, G - 21, '#4a2c1c');
      p.rect(7, 22, 3, G - 23, C.gold2);
      p.px(8, 23, C.gold);
      roof(p, L, 3, 14, 10, 18);
      // đe sắt ngoài sân
      p.rect(16, G - 4, 5, 2, C.metal3);
      p.rect(17, G - 2, 3, 2, C.metal3);
      p.px(16, G - 4, C.metal2);
      return fin(c, (q) => { smoke(q, 16, 4); q.px(7, 21, '#fff2b0'); });
    }
    case 'den': {
      const { c, p, G } = make();
      shadow(p, 11, G, 10);
      stoneBase(p, 2, 19, G, 3);
      p.rect(8, G - 3, 6, 3, C.stone);
      p.h(8, 13, G - 2, C.stone2);
      const x0 = L === 1 ? 6 : 4, x1 = L === 1 ? 15 : 17;
      walls(p, x0, x1, 17, G - 3, ['#8e4a2e', '#6e3824', '#5a2c1c']);
      pillars(p, [x0, x1], 17, G - 3);
      if (L > 1) pillars(p, [x0 + 3, x1 - 3], 17, G - 3);
      p.rect(9, 19, 4, G - 23, C.wood3);
      p.px(10, 21, C.gold);
      p.px(11, 21, C.gold);
      p.rect(9, 15, 4, 2, C.gold2);
      const rc = L >= 3 ? ROOF(3) : ROOF(2);
      curvedRoof(p, x0 - 1, x1 + 1, L === 1 ? 10 : 9, 16, rc[0], rc[1], rc[2], 3);
      if (L >= 2) {
        const cx = 11;
        p.ell(cx, 8, 1, 1, C.gold);
        p.px(cx, 6, C.red);
        for (const s of [-1, 1]) { p.px(cx + s * 3, 8, C.gold2); p.px(cx + s * 4, 7, C.gold); }
      }
      if (L >= 3) { curvedRoof(p, 7, 14, 3, 7, rc[0], rc[1], rc[2], 2); }
      // lư hương
      p.rect(17, G - 5, 3, 2, C.gold2);
      p.px(18, G - 6, C.gold3);
      return fin(c, (q) => { q.px(18, G - 8, SMOKE[1]); q.px(19, G - 10, SMOKE[0]); q.px(18, G - 12, SMOKE[2]); });
    }
    case 'ruong': {
      const { c, p, G } = make(26);
      // ruộng nước có bờ đất, lúa cấy thành hàng
      const top = L === 1 ? 13 : 10;
      p.rect(2, top, 18, G - top, '#a8743e');
      p.rect(3, top + 1, 16, G - top - 2, L === 3 ? '#b9d36a' : '#8ccfb0');
      if (L >= 2) p.h(2, 19, top + ((G - top) >> 1), '#a8743e');
      for (let y = top + 2; y < G - 1; y += 3)
        for (let x = 4; x < 19; x += 3) {
          if (y === top + ((G - top) >> 1)) continue;
          const ripe = L === 3;
          p.v(x, y - 1, y, ripe ? C.straw2 : C.green2);
          p.px(x - 1, y - 1, ripe ? C.gold : C.green);
          p.px(x + 1, y - 2, ripe ? C.straw : C.grass);
        }
      p.h(2, 19, G - 1, '#8a5e30');
      return fin(c);
    }
    case 'vuon': {
      const { c, p, G } = make(26);
      // luống rau đất nâu, rào tre phía trước
      const beds = L === 1 ? 2 : 3;
      for (let i = 0; i < beds; i++) {
        const y = 10 + i * 5;
        p.rect(3, y, 16, 4, '#9a6a3e');
        p.h(3, 18, y + 3, '#7e532e');
        for (let x = 4; x < 18; x += 3) {
          const col = L === 2 && i === 1 ? C.teal2 : L === 3 && i === 2 ? C.pink : C.green;
          p.ell(x + 1, y + 1, 1, 1, col);
          p.px(x + 1, y, col === C.pink ? C.gold : C.leaf);
        }
      }
      for (let x = 2; x <= 19; x += 2) p.v(x, G - 4, G - 1, C.straw2);
      p.h(2, 19, G - 3, C.straw3);
      if (L === 3) { p.v(9, G - 8, G - 1, C.red); p.v(13, G - 8, G - 1, C.red); p.h(8, 14, G - 8, C.red2); }
      return fin(c);
    }
    case 'nuongdau': {
      const { c, p, G } = make(28);
      shadow(p, 11, G, 9);
      const bushes: [number, number][] = L === 1 ? [[6, 14], [15, 14]] : L === 2 ? [[5, 13], [11, 11], [17, 13]] : [[5, 12], [11, 10], [17, 12], [8, 17], [14, 17]];
      for (const [x, y] of bushes) {
        p.v(x, y + 3, y + 6, C.wood3);
        p.ell(x, y, 3, 3, C.leaf2);
        p.ell(x - 1, y - 1, 2, 2, C.leaf);
        p.px(x - 2, y - 2, '#bfe8a0');
        p.px(x + 1, y + 1, '#7a2e5a');
      }
      // nong tằm tròn
      p.ell(11, G - 2, 5, 2, C.straw2);
      p.ell(11, G - 2, 4, 1, C.straw);
      for (const x of [8, 10, 13]) p.h(x, x + 1, G - 2, C.white);
      return fin(c);
    }
    case 'chuong': {
      const { c, p, G } = make(28);
      shadow(p, 11, G, 9);
      if (L === 3) {
        walls(p, 4, 12, 9, 15, WOOD, true);
        strawRoof(p, 3, 13, 3, 9);
      }
      // rào tre bao quanh
      for (let x = 2; x <= 19; x += 2) { p.v(x, G - 5, G - 1, C.straw2); p.px(x, G - 6, C.straw); }
      p.h(2, 19, G - 4, C.straw3);
      for (const y of [16, 20]) { p.px(2, y, C.straw2); p.px(19, y, C.straw2); }
      p.v(2, 14, G - 6, C.straw2);
      p.v(19, 14, G - 6, C.straw2);
      p.h(2, 19, 14, C.straw3);
      // gà
      const hen = (x: number, y: number) => {
        p.ell(x, y, 2, 1, C.white);
        p.px(x + 2, y - 1, C.white);
        p.px(x + 2, y - 2, C.red);
        p.px(x + 3, y - 1, C.gold2);
        p.px(x - 2, y - 1, C.white2);
      };
      hen(6, 19);
      if (L >= 2) {
        // lợn
        p.ell(14, 19, 3, 2, C.pink);
        p.px(17, 19, C.pink2);
        p.px(16, 18, OUTC);
        p.v(12, 21, 22, C.pink2);
        p.v(16, 21, 22, C.pink2);
      }
      if (L >= 3) hen(9, 22);
      return fin(c);
    }
    case 'aoca': {
      const { c, p, G } = make(26);
      const rx = L === 1 ? 7 : 8, ry = L === 1 ? 4 : 5;
      const cy = G - ry - 2;
      p.ell(11, cy, rx + 1, ry + 1, C.stone2);
      p.ell(11, cy, rx, ry, C.sea2);
      p.ell(10, cy - 1, rx - 2, ry - 2, C.sea);
      p.h(7, 9, cy - 2, C.shallow);
      // cá chép đỏ, lá súng
      p.h(13, 14, cy + 1, '#f08a3c');
      p.px(12, cy + 1, '#ffd2a0');
      p.h(7, 8, cy + 2, '#f08a3c');
      p.ell(15, cy - 2, 1, 0, C.leaf);
      p.ell(6, cy, 1, 0, C.leaf);
      if (L >= 2) for (const x of [3, 4, 18]) { p.v(x, cy - 5, cy, C.green2); p.px(x, cy - 6, C.brown2); }
      if (L >= 3) { p.rect(9, cy - 1, 5, 2, C.red); p.h(9, 13, cy - 2, C.red2); p.v(9, cy, cy + 1, C.wood3); p.v(13, cy, cy + 1, C.wood3); }
      return fin(c, (q) => { q.px(14, cy - 1, C.foam); q.px(8, cy + 1, C.foam); });
    }
    case 'coixay': {
      const { c, p, G } = make();
      shadow(p, 11, G, 9);
      if (L === 3) {
        // cối xay nước: guồng gỗ lớn cạnh lán
        walls(p, 3, 11, 18, G, WOOD, true);
        roof(p, 2, 3, 12, 11, 18);
        p.ell(15, 19, 5, 5, C.wood2);
        p.ell(15, 19, 3, 3, C.sea2);
        for (let a = 0; a < 8; a++) { const t = (a * Math.PI) / 4; p.px(15 + Math.round(Math.cos(t) * 5), 19 + Math.round(Math.sin(t) * 5), C.wood3); }
        p.ell(15, 19, 1, 1, C.wood3);
        p.rect(11, G - 3, 9, 2, C.sea);
      } else {
        if (L === 2) {
          for (const x of [3, 18]) p.v(x, 13, G - 1, C.wood3);
          strawRoof(p, 2, 19, 6, 13);
          // chày giã gạo bập bênh
          p.line(4, 22, 16, 18, C.wood);
          p.v(10, 20, G - 1, C.wood3);
          p.rect(15, 19, 2, 4, C.wood2);
        }
        // cối đá
        p.ell(11 + (L === 2 ? 4 : 0), G - 3, 4, 2, C.stone2);
        p.ell(11 + (L === 2 ? 4 : 0), G - 4, 3, 1, C.stone);
        if (L === 1) { p.rect(10, G - 9, 2, 5, C.wood2); p.px(10, G - 9, C.wood3); }
        p.ell(4, G - 2, 2, 1, C.white2);
      }
      return fin(c, L === 3 ? (q) => { q.h(12, 14, G - 1, C.foam); } : undefined);
    }
    case 'bep': {
      const { c, p, G } = make();
      shadow(p, 11, G, 9);
      walls(p, 4, 13, 18, G, L === 3 ? PLASTER : MUD);
      door(p, 8, 20, G);
      roof(p, L, 3, 14, 9, 18);
      p.rect(12, 6, 3, 8, C.stone2);
      // nồi lương trên bếp lửa ngoài sân
      p.ell(17, G - 4, 3, 2, '#3f3a46');
      p.h(15, 19, G - 6, '#5f5868');
      p.h(15, 19, G - 1, C.wood2);
      return fin(c, (q) => { q.px(16, G - 2, C.gold); q.px(18, G - 2, C.red); q.px(17, G - 3, C.gold2); smoke(q, 13, 4); smoke(q, 17, G - 9); });
    }
    case 'nhathuoc': {
      const { c, p, G } = make();
      shadow(p, 11, G, 9);
      walls(p, 4, 15, 18, G, L === 1 ? MUD : L === 2 ? WOOD : PLASTER, L === 2);
      door(p, 9, 20, G);
      win(p, 12, 20);
      roof(p, L, 3, 16, 9, 18);
      // hồ lô treo trước cửa
      p.ell(6, 20, 1, 1, '#e3a52e');
      p.ell(6, 22, 2, 2, '#e3a52e');
      p.px(6, 19, C.red);
      // nong phơi thuốc
      p.ell(18, G - 3, 3, 1, C.straw2);
      p.px(17, G - 4, C.green);
      p.px(19, G - 4, C.green2);
      p.px(18, G - 4, C.leaf);
      return fin(c);
    }
    case 'khungcui': {
      const { c, p, G } = make();
      shadow(p, 11, G, 9);
      for (const x of [3, 18]) p.v(x, 14, G - 1, C.wood3);
      roof(p, L, 3, 18, 7, 14);
      // khung cửi và tấm vải đang dệt
      p.rect(6, 17, 10, 1, C.wood3);
      p.rect(6, G - 3, 10, 1, C.wood3);
      p.v(6, 17, G - 2, C.wood2);
      p.v(15, 17, G - 2, C.wood2);
      const cloth = L === 3 ? '#9563c9' : L === 2 ? C.pink : C.indigo;
      p.rect(7, 18, 8, G - 21, cloth);
      for (let y = 19; y < G - 3; y += 2) p.h(7, 14, y, C.white);
      p.ell(18, G - 2, 1, 1, C.red);
      return fin(c);
    }
    case 'hocvien': {
      const { c, p, G } = make();
      shadow(p, 11, G, 10);
      if (L >= 3) stoneBase(p, 2, 19, G, 2);
      walls(p, 4, 17, 17, L >= 3 ? G - 2 : G, L === 1 ? WOOD : PLASTER, L === 1);
      pillars(p, L === 1 ? [] : [4, 8, 13, 17], 17, L >= 3 ? G - 2 : G);
      door(p, 10, 19, L >= 3 ? G - 2 : G);
      win(p, 5, 19, false);
      win(p, 14, 19, false);
      roof(p, L, 3, 18, 7, 16);
      // biển hiệu và quyển sách
      p.rect(8, 14, 6, 3, C.gold2);
      p.h(9, 12, 15, C.red2);
      if (L >= 2) { p.rect(17, G - 4, 3, 2, C.white); p.v(18, G - 4, G - 3, C.red); }
      return fin(c);
    }
    case 'benthuyen': {
      const { c, p, G } = make();
      shadow(p, 11, G, 10);
      for (const x of [3, 18]) p.v(x, 13, G - 1, C.wood3);
      p.rect(2, G - 3, 18, 3, C.wood2);
      p.h(2, 19, G - 3, C.wood);
      // sườn thuyền đang đóng
      for (let x = 6; x <= 16; x += 2) { p.v(x, G - 9, G - 4, C.wood); p.px(x, G - 10, C.wood2); }
      p.line(5, G - 6, 17, G - 6, C.wood3);
      roof(p, L, 3, 18, 6, 13);
      if (L >= 2) { p.rect(16, G - 2, 4, 1, C.wood); p.rect(16, G - 1, 4, 1, C.wood3); }
      if (L >= 3) flag(p, 18, 0, C.red, 6);
      return fin(c);
    }
  }
  return fin(make().c);
}

