// Công trình nhìn chéo từ trên xuống (3/4), kiến trúc Việt: đình mái cong, nhà tranh, tường đá ong,
// cổng thành, tháp canh, bến thuyền, xưởng đóng tàu; thuyền và chiến hạm có mắt thuyền.
import { C, cnv, outline, P, shadow } from './pal';

/** Viền xong rồi mới vẽ bọt sóng (bọt không có viền). */
const done = (c: HTMLCanvasElement, after?: (p: P) => void) => {
  const o = outline(c);
  if (after) after(new P(o.getContext('2d')!));
  return o;
};

/** Mái ngói cong có đầu đao vểnh hai bên. */
function curvedRoof(p: P, x0: number, x1: number, top: number, bottom: number, c1: string, c2: string, c3: string, inset = 5) {
  const h = bottom - top;
  for (let y = top; y <= bottom; y++) {
    const t = (y - top) / h;
    // mái thắt ở giữa, loe ra ở vành dưới (độ cong)
    const shrink = Math.round(inset * (1 - t) ** 1.6);
    const a = x0 + shrink, b = x1 - shrink;
    p.h(a, b, y, (y - top) % 2 === 0 ? c1 : c2);
    p.px(b, y, c3);
    p.px(b - 1, y, c2);
  }
  p.h(x0, x1, bottom, c3);
  // đầu đao vểnh
  p.px(x0 - 1, bottom - 1, c1); p.px(x0 - 2, bottom - 2, c1); p.px(x0 - 2, bottom - 3, C.gold);
  p.px(x1 + 1, bottom - 1, c2); p.px(x1 + 2, bottom - 2, c2); p.px(x1 + 2, bottom - 3, C.gold);
}

/** Đình làng / phủ chúa đảo (2x2 ô). Bậc 1..5 càng lên càng to đẹp. */
export function drawHall(tier = 3): HTMLCanvasElement {
  const [c, x] = cnv(40, 46);
  const p = new P(x);
  shadow(p, 20, 42, 17);
  // nền đá hai bậc
  p.rect(3, 32, 34, 4, C.stone);
  p.rect(3, 36, 34, 5, C.stone2);
  for (let i = 5; i < 36; i += 6) p.v(i, 37, 40, C.stone3);
  p.h(3, 36, 36, C.stone3);
  p.rect(15, 36, 10, 5, C.stone); // bậc thềm
  p.h(15, 24, 38, C.stone2);
  // tường gỗ, cột đỏ, cửa
  p.rect(7, 22, 26, 10, C.wood);
  for (let i = 9; i < 32; i += 4) p.v(i, 23, 31, C.wood2);
  for (const cx of [7, 14, 25, 32]) { p.v(cx, 21, 31, C.red); p.v(cx + (cx > 20 ? -1 : 1), 21, 31, C.red2); }
  p.rect(16, 24, 8, 8, C.wood3);
  p.v(20, 24, 31, C.gold3);
  p.px(18, 28, C.gold); p.px(21, 28, C.gold);
  // cửa sổ song gỗ
  for (const wx of [9, 27]) { p.rect(wx, 25, 4, 3, C.wood3); p.v(wx + 1, 25, 27, C.wood); p.v(wx + 3, 25, 27, C.wood); }
  // biển hiệu
  p.rect(17, 19, 6, 3, C.gold2); p.h(18, 21, 20, C.red2);
  // mái lớn
  const roof = tier >= 4 ? [C.teal, C.teal2, C.teal3] : tier >= 2 ? [C.roof, C.roof2, '#8e3326'] : [C.straw, C.straw2, C.straw3];
  curvedRoof(p, 2, 37, 9, 21, roof[0], roof[1], roof[2], 6);
  // bờ nóc và lưỡng long chầu nguyệt
  p.h(8, 31, 8, roof[2]);
  p.h(9, 30, 7, roof[0]);
  if (tier >= 3) {
    p.ell(20, 5, 1, 1, C.gold); p.px(20, 3, C.red);
    for (const s of [-1, 1]) { p.px(20 + s * 3, 6, C.gold2); p.px(20 + s * 4, 5, C.gold); p.px(20 + s * 5, 5, C.gold2); p.px(20 + s * 6, 6, C.gold); }
  }
  // mái tầng hai (bậc cao)
  if (tier >= 5) {
    curvedRoof(p, 8, 31, 1, 7, roof[0], roof[1], roof[2], 3);
    p.ell(20, 0, 1, 0, C.gold);
  }
  return done(c);
}

/** Nhà tranh vách đất (1 ô). */
export function drawHut(): HTMLCanvasElement {
  const [c, x] = cnv(20, 24);
  const p = new P(x);
  shadow(p, 10, 21, 8);
  p.rect(3, 12, 14, 8, '#ecd7b0');
  p.h(3, 16, 19, '#cdb48a');
  p.v(16, 12, 19, '#d4bc93');
  p.rect(8, 14, 4, 6, C.wood3);
  p.rect(13, 14, 2, 2, C.wood2);
  p.poly([[1, 13], [10, 3], [19, 13]], C.straw);
  p.poly([[10, 3], [19, 13], [12, 13]], C.straw2);
  for (let y = 6; y < 13; y += 2) p.h(Math.max(2, 10 - (y - 3)), Math.min(17, 10 + (y - 3)), y, C.straw2);
  p.h(1, 18, 13, C.straw3);
  p.px(9, 4, '#fff6cf'); p.px(8, 5, '#fff6cf');
  return done(c);
}

/** Tháp canh gỗ cao (1 ô, cao 2 ô). */
export function drawTower(): HTMLCanvasElement {
  const [c, x] = cnv(20, 34);
  const p = new P(x);
  shadow(p, 10, 31, 7);
  for (const lx of [4, 15]) { p.v(lx, 14, 30, C.wood); p.v(lx + 1, 14, 30, C.wood2); }
  p.line(5, 18, 14, 26, C.wood2); p.line(14, 18, 5, 26, C.wood2);
  p.rect(2, 12, 16, 4, C.wood); p.h(2, 17, 15, C.wood3);
  for (let i = 3; i < 17; i += 3) p.v(i, 9, 11, C.wood2);
  p.h(2, 17, 9, C.wood);
  p.poly([[1, 9], [10, 2], [19, 9]], C.straw);
  p.poly([[10, 2], [19, 9], [12, 9]], C.straw2);
  p.h(1, 18, 9, C.straw3);
  // cờ
  p.v(10, -2 + 2, 2, C.wood3);
  p.rect(11, 0, 4, 2, C.red);
  return done(c);
}

/** Một đoạn tường đá ong có lỗ châu mai (ghép liền theo hàng). */
export function drawWall(): HTMLCanvasElement {
  const [c, x] = cnv(18, 22);
  const p = new P(x);
  p.rect(1, 9, 16, 4, C.stone);
  p.rect(1, 13, 16, 7, '#d88b5a');
  for (let y = 14; y < 20; y += 2) p.h(1, 16, y, '#c07447');
  for (let y = 14; y < 20; y += 2) for (let i = (y % 4 ? 3 : 7); i < 17; i += 8) p.v(i, y, y + 1, '#c07447');
  for (const mx of [1, 7, 13]) { p.rect(mx, 5, 4, 4, C.stone); p.h(mx, mx + 3, 8, C.stone2); }
  p.h(1, 16, 12, C.stone2);
  return done(c);
}

/** Cổng thành có lầu (2 ô). */
export function drawGate(): HTMLCanvasElement {
  const [c, x] = cnv(38, 36);
  const p = new P(x);
  shadow(p, 19, 33, 16);
  p.rect(2, 16, 34, 16, '#d88b5a');
  for (let y = 18; y < 32; y += 3) p.h(2, 35, y, '#c07447');
  p.rect(13, 21, 12, 11, C.wood3);
  p.ell(18, 21, 5, 3, C.wood3);
  p.v(18, 19, 31, '#4a2c1c');
  p.px(16, 26, C.gold); p.px(20, 26, C.gold);
  p.rect(2, 13, 34, 3, C.stone); p.h(2, 35, 15, C.stone2);
  // lầu trên cổng
  p.rect(10, 7, 18, 6, C.wood);
  for (const cx of [10, 18, 27]) p.v(cx, 7, 12, C.red);
  curvedRoof(p, 6, 31, 1, 7, C.roof, C.roof2, '#8e3326', 3);
  return done(c);
}

/** Bến thuyền: cầu gỗ chìa ra nước, cọc tre. */
export function drawPier(): HTMLCanvasElement {
  const [c, x] = cnv(36, 20);
  const p = new P(x);
  p.rect(1, 5, 34, 7, C.wood);
  for (let i = 1; i < 35; i += 3) p.v(i, 5, 11, C.wood2);
  p.h(1, 34, 11, C.wood3);
  for (const px of [3, 14, 25, 33]) { p.v(px, 12, 16, C.wood3); p.v(px + 1, 12, 15, C.wood2); }
  p.rect(28, 2, 3, 3, C.wood2); // cột buộc thuyền
  return done(c, (q) => { q.h(4, 8, 17, C.foam); q.h(18, 22, 17, C.foam); });
}

/** Xưởng đóng tàu: mái che trên cột, khung sườn thuyền đang đóng. */
export function drawShipyard(): HTMLCanvasElement {
  const [c, x] = cnv(40, 36);
  const p = new P(x);
  shadow(p, 20, 33, 18);
  p.rect(3, 26, 34, 6, C.wood2);
  p.h(3, 36, 26, C.wood);
  // sườn thuyền
  for (let i = 9; i <= 31; i += 4) {
    p.v(i, 18, 26, C.wood);
    p.px(i, 17, C.wood2);
  }
  p.line(7, 22, 34, 22, C.wood3);
  p.line(7, 25, 34, 25, C.wood);
  p.line(7, 22, 5, 18, C.wood);
  // cột và mái
  for (const cx of [3, 36]) p.v(cx, 12, 31, C.wood3);
  p.poly([[0, 13], [8, 4], [32, 4], [40, 13]], C.straw);
  p.poly([[32, 4], [40, 13], [30, 13]], C.straw2);
  for (let y = 6; y < 13; y += 2) p.h(9 - (y - 4), 31 + (y - 4), y, C.straw2);
  p.h(0, 39, 13, C.straw3);
  // búa, gỗ xếp
  p.rect(30, 28, 6, 2, C.wood);
  p.rect(30, 30, 6, 1, C.wood3);
  return done(c);
}

// ======================= THUYỀN =======================
export type BoatTier = 'thung' | 'ghe' | 'buom' | 'chien';

function hull(p: P, x0: number, x1: number, deck: number, keel: number, c1: string, c2: string, eye = true) {
  // thân thuyền cong, mũi nhọn vểnh, có mắt thuyền đỏ trắng ở mũi
  for (let y = deck; y <= keel; y++) {
    const t = (y - deck) / Math.max(1, keel - deck);
    const a = x0 + Math.round(3 * t * t) + 1, b = x1 - Math.round(6 * t * t);
    p.h(a, b, y, y - deck < 2 ? c1 : c2);
  }
  p.h(x0, x1 + 1, deck, C.wood);
  p.px(x1 + 1, deck - 1, C.wood); p.px(x1 + 2, deck - 2, C.wood2);
  p.h(x0 + 2, x1 - 4, keel, '#5a3624');
  if (eye) {
    const ex = x1 - 4, ey = deck + 2;
    p.px(ex, ey, '#ffffff'); p.px(ex + 1, ey, '#ffffff'); p.px(ex, ey + 1, C.red); p.px(ex + 1, ey + 1, '#3d2b2b');
  }
}

/** Buồm cánh dơi có nẹp tre ngang. */
function batSail(p: P, mx: number, top: number, bottom: number, w: number, c1: string, c2: string) {
  for (let y = top; y <= bottom; y++) {
    const t = (y - top) / (bottom - top);
    const a = mx - Math.round(w * (0.35 + 0.65 * t)), b = mx + Math.round(w * 0.25 * t) + 1;
    p.h(a, b, y, (y - top) % 4 === 0 ? c2 : c1);
  }
  p.v(mx, top - 2, bottom + 4, C.wood3);
}

export interface BoatGear {
  /** nỏ lớn ở mũi */
  no?: boolean;
  /** máy bắn đá giữa thuyền */
  da?: boolean;
  /** mũi đâm bọc đồng */
  dam?: boolean;
}

export function drawBoat(tier: BoatTier, gear: BoatGear = {}, flag = C.red): HTMLCanvasElement {
  if (tier === 'thung') {
    const [c, x] = cnv(18, 14);
    const p = new P(x);
    p.ell(9, 8, 7, 3, C.straw2);
    p.ell(9, 7, 6, 2, C.straw3);
    for (let i = 3; i < 16; i += 2) p.px(i, 10, C.straw3);
    p.line(12, 4, 16, 1, C.wood2);
    return done(c, (q) => q.h(1, 4, 12, C.foam));
  }
  if (tier === 'ghe') {
    const [c, x] = cnv(32, 22);
    const p = new P(x);
    hull(p, 2, 26, 12, 17, C.wood, C.wood2);
    batSail(p, 15, 2, 11, 9, '#e8a560', '#c4743c');
    for (let i = 6; i < 24; i += 5) p.line(i, 17, i - 2, 20, C.wood3);
    if (gear.dam) { p.px(28, 15, C.gold2); p.px(29, 15, C.gold2); p.px(30, 16, C.gold3); }
    return done(c, (q) => { q.h(1, 5, 20, C.foam); q.h(18, 24, 20, C.foam); });
  }
  const big = tier === 'chien';
  const W = big ? 50 : 40, H = big ? 40 : 34;
  const [c, x] = cnv(W, H);
  const p = new P(x);
  const deck = big ? 26 : 22, keel = big ? 34 : 29, x1 = W - 8;
  hull(p, 2, x1, deck, keel, big ? '#a8603c' : C.wood, big ? '#7e4428' : C.wood2);
  // sơn sọc mạn và khiên dọc mạn (chiến hạm)
  if (big) {
    p.h(5, x1 - 6, deck + 3, C.red2);
    for (let i = 7; i < x1 - 6; i += 5) { p.ell(i, deck - 1, 1, 1, C.straw2); p.px(i, deck - 1, C.gold3); }
  }
  // lầu sau lái
  p.rect(3, deck - 6, 8, 6, C.wood2);
  p.h(2, 11, deck - 7, C.roof2);
  p.h(3, 10, deck - 8, C.roof);
  batSail(p, big ? 22 : 19, 3, deck - 4, big ? 12 : 11, '#f0b26a', '#c97a3e');
  if (big) batSail(p, 35, 8, deck - 4, 8, '#f0b26a', '#c97a3e');
  // cờ đuôi nheo trên cột buồm
  const mx = big ? 22 : 19;
  p.h(mx + 1, mx + 5, 1, flag); p.h(mx + 1, mx + 3, 2, flag);
  if (gear.no) {
    // nỏ lớn ở mũi
    p.h(x1 - 9, x1 - 2, deck - 3, C.wood3);
    p.v(x1 - 3, deck - 6, deck, C.wood2);
    p.px(x1 - 1, deck - 3, C.metal);
  }
  if (gear.da) {
    // máy bắn đá: cần gỗ và gầu đá
    p.line(mx + 3, deck - 1, mx + 9, deck - 9, C.wood3);
    p.ell(mx + 9, deck - 10, 1, 1, C.stone3);
    p.rect(mx + 2, deck - 3, 5, 3, C.wood2);
  }
  if (gear.dam) { p.h(x1 + 1, x1 + 4, deck + 3, C.gold2); p.px(x1 + 5, deck + 3, C.gold3); p.h(x1, x1 + 3, deck + 4, C.gold3); }
  return done(c, (q) => { q.h(1, 7, keel + 2, C.foam); q.h(W - 22, W - 12, keel + 2, C.foam); });
}
