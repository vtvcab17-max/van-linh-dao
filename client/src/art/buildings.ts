// Kiến trúc của đảo: Nhà chính, Cuốc, Lũy tre và Thuyền — mỗi bậc một kiểu dáng riêng, càng lên bậc càng to và cầu kỳ.
// Tất cả là linh vật nên đều có mắt (chớp mắt, vui, đói).
import { canvas, noise, Pen, type Canvas } from './pixel';

type Mood = 'vui' | 'thuong' | 'doi';

/** Kích thước khung vẽ của từng công trình (neo ở đáy giữa). */
export const LV_SIZE = {
  leu: { w: 40, h: 44 },
  cuoc: { w: 20, h: 28 },
  rao: { w: 24, h: 28 },
  thuyen: { w: 36, h: 30 },
} as const;

const MUD = '#c99a62';
const MUD_D = '#a87a48';
const TILE = '#a8432f';
const TILE_D = '#7a2e22';
const TAR = '#3a2a24';

function shadow(p: Pen, cx: number, y: number, rx: number) {
  p.ellipse(cx, y, rx, 2, 'rgba(0,0,0,0.22)');
}

/** Hàng lá/tranh lợp mái, có mép tua so le. */
function thatchRows(p: Pen, y0: number, y1: number, left: (y: number) => number, right: (y: number) => number, cols: string[], band = 3) {
  for (let y = y0; y <= y1; y++) {
    const a = Math.round(left(y));
    const b = Math.round(right(y));
    const bi = Math.floor((y - y0) / band);
    p.hline(a, b, y, cols[bi % cols.length]);
    // mép tua cuối mỗi lớp
    if ((y - y0) % band === band - 1) for (let x = a + (bi % 2); x <= b; x += 2) p.px(x, y, cols[(bi + 1) % cols.length]);
  }
}

// ======================= NHÀ CHÍNH =======================
export function drawLeu(tier: number, blink: boolean, mood: Mood): Canvas {
  const { w, h } = LV_SIZE.leu;
  const [c, ctx] = canvas(w, h);
  const p = new Pen(ctx);
  if (tier <= 1) leu1(p, blink, mood);
  else if (tier === 2) leu2(p, blink, mood);
  else if (tier === 3) leu3(p, blink, mood);
  else if (tier === 4) leu4(p, blink, mood);
  else leu5(p, blink, mood);
  return c;
}

/** Túp Lều Lá: lều chữ A lợp lá dừa, cửa vén. */
function leu1(p: Pen, blink: boolean, mood: Mood) {
  shadow(p, 20, 41, 13);
  const left = (y: number) => 20 - (y - 21) * 0.62;
  const right = (y: number) => 20 + (y - 21) * 0.62;
  thatchRows(p, 21, 40, left, right, ['G', 'a', 'H', 'a'], 3);
  for (let y = 21; y <= 40; y++) {
    p.px(Math.round(left(y)) - 1, y, 'k');
    p.px(Math.round(right(y)) + 1, y, 'k');
  }
  // gân lá
  p.line(20, 22, 13, 39, 'H');
  p.line(20, 22, 27, 39, 'H');
  // cửa vén
  p.poly([[17, 41], [20, 30], [24, 41]], 'K');
  p.poly([[18, 41], [20, 33], [23, 41]], 'k');
  p.line(20, 30, 25, 37, 'A');
  p.line(21, 31, 25, 36, 'G');
  p.eyes(17, 35, 4, blink, mood);
  // cọc chéo trên đỉnh
  p.line(17, 17, 22, 23, 'T');
  p.line(23, 17, 18, 23, 'T');
  p.px(17, 17, 'u');
  p.px(23, 17, 'u');
  // rơm, sỏi dưới chân
  p.hline(7, 33, 41, 'k');
  for (const x of [9, 12, 28, 31]) p.px(x, 40, 'y');
  p.px(33, 40, 'n');
  p.px(6, 41, 'N');
}

/** Nhà Tranh Vách Đất: vách đất trộn rơm, mái tranh dày, chum nước. */
function leu2(p: Pen, blink: boolean, mood: Mood) {
  shadow(p, 20, 41, 17);
  // vách đất
  p.rect(7, 27, 26, 14, MUD);
  for (let i = 0; i < 40; i++) {
    const x = 7 + Math.floor(noise(i, 1, 21) * 26);
    const y = 27 + Math.floor(noise(i, 2, 21) * 14);
    p.px(x, y, i % 3 ? MUD_D : 'y');
  }
  p.vline(6, 27, 40, 'k');
  p.vline(33, 27, 40, 'k');
  p.vline(7, 27, 40, 'T');
  p.vline(32, 27, 40, 'T');
  p.hline(6, 33, 41, 'k');
  // cửa gỗ ghép ván
  p.rect(17, 31, 7, 10, 'T');
  for (const x of [19, 21]) p.vline(x, 31, 40, 'K');
  p.hline(17, 23, 34, 'u');
  p.rect(16, 30, 9, 1, 'k');
  p.vline(16, 30, 40, 'k');
  p.vline(24, 30, 40, 'k');
  p.eyes(17, 35, 5, blink, mood);
  // cửa sổ song tre
  p.rect(9, 30, 5, 5, 'K');
  for (const x of [10, 12]) p.vline(x, 30, 34, 'a');
  p.rect(8, 29, 7, 1, 'k');
  p.rect(8, 35, 7, 1, 'z');
  // mái tranh dày bốn mái
  const left = (y: number) => 13 - (y - 14) * 0.75;
  const right = (y: number) => 27 + (y - 14) * 0.75;
  thatchRows(p, 14, 27, left, right, ['y', 'Y', 'y', 'z'], 3);
  for (let y = 14; y <= 27; y++) {
    p.px(Math.round(left(y)) - 1, y, 'k');
    p.px(Math.round(right(y)) + 1, y, 'k');
  }
  p.hline(12, 28, 13, 'k');
  p.hline(13, 27, 14, 'z');
  // tua mái rủ
  for (let x = 3; x <= 37; x += 2) p.px(x, 28, 'Y');
  // chum nước
  p.ellipse(35, 37, 3, 4, '#8a4b2a');
  p.ellipse(35, 37, 3, 4, 'k', false);
  p.hline(33, 37, 33, 'k');
  p.px(34, 35, '#c27a4c');
}

/** Nhà Sàn Tre: cột cao, vách tre, mái dốc có sừng, thang lên. */
function leu3(p: Pen, blink: boolean, mood: Mood) {
  shadow(p, 20, 41, 17);
  // cột sàn
  for (const x of [8, 14, 25, 31]) {
    p.vline(x, 29, 41, 'T');
    p.vline(x + 1, 29, 41, 'K');
  }
  // sàn ván
  p.rect(5, 27, 30, 3, 'u');
  p.hline(5, 34, 29, 'T');
  p.hline(4, 35, 26, 'k');
  p.hline(4, 35, 30, 'k');
  // vách tre đứng
  for (let x = 8; x <= 31; x++) p.vline(x, 17, 26, x % 2 ? 'A' : 'a');
  for (let x = 8; x <= 31; x += 4) p.vline(x, 17, 26, 'H');
  p.vline(7, 17, 26, 'k');
  p.vline(32, 17, 26, 'k');
  // lan can trước
  p.hline(5, 34, 24, 'Y');
  for (let x = 5; x <= 34; x += 3) p.vline(x, 24, 26, 'z');
  // cửa
  p.rect(17, 18, 7, 8, 'K');
  p.rect(18, 19, 5, 7, 'k');
  p.eyes(17, 20, 4, blink, mood);
  // mái tranh dốc cao, hai sừng chéo ở nóc
  const left = (y: number) => 15 - (y - 5) * 0.9;
  const right = (y: number) => 25 + (y - 5) * 0.9;
  thatchRows(p, 5, 17, left, right, ['Y', 'y', 'Y', 'z'], 3);
  for (let y = 5; y <= 17; y++) {
    p.px(Math.round(left(y)) - 1, y, 'k');
    p.px(Math.round(right(y)) + 1, y, 'k');
  }
  p.hline(14, 26, 4, 'k');
  p.line(15, 4, 11, 0, 'T');
  p.line(25, 4, 29, 0, 'T');
  p.px(11, 0, 'k');
  p.px(29, 0, 'k');
  // thang
  p.line(25, 30, 29, 41, 'T');
  p.line(27, 30, 31, 41, 'T');
  for (let i = 0; i < 4; i++) p.hline(26 + i, 28 + i, 32 + i * 3, 'u');
  // chuỗi ớt phơi
  p.vline(6, 18, 23, 'k');
  for (let y = 19; y <= 23; y += 2) p.px(6, y, 'e');
}

/** Nhà Rường Gỗ Lim: mái ngói âm dương cong, đầu đao, cửa sơn son, đèn lồng. */
function leu4(p: Pen, blink: boolean, mood: Mood) {
  shadow(p, 20, 42, 19);
  // nền đá, bậc thềm
  p.rect(3, 37, 34, 4, 'n');
  p.hline(3, 36, 39, 'N');
  p.rect(15, 39, 10, 2, 'm');
  p.hline(2, 37, 41, 'k');
  p.vline(2, 37, 41, 'k');
  p.vline(37, 37, 41, 'k');
  // khung gỗ + vách bức bàn
  p.rect(5, 24, 30, 13, 'u');
  for (let y = 25; y < 37; y += 3) for (let x = 6; x < 34; x += 3) p.px(x, y, 'T');
  for (const x of [5, 11, 28, 34]) p.rect(x, 23, 2, 14, 'T');
  for (const x of [5, 11, 28, 34]) p.px(x, 23, 'K');
  // cửa chính sơn son thếp vàng
  p.rect(15, 26, 10, 11, 'E');
  p.rect(16, 27, 8, 10, 'e');
  p.vline(20, 27, 36, 'E');
  for (const [x, y] of [[17, 33], [22, 33], [18, 34], [21, 34]]) p.px(x, y, 'l');
  p.eyes(16, 29, 6, blink, mood);
  // mái ngói cong
  const roofTop = 12;
  const roofBot = 23;
  for (let y = roofTop; y <= roofBot; y++) {
    const t = (y - roofTop) / (roofBot - roofTop);
    const a = Math.round(10 - t * 9);
    const b = Math.round(29 + t * 9);
    p.hline(a, b, y, (y - roofTop) % 2 ? TILE : TILE_D);
    for (let x = a + ((y - roofTop) % 4 < 2 ? 0 : 1); x <= b; x += 2) if ((y - roofTop) % 2) p.px(x, y, TILE_D);
    p.px(a - 1, y, 'k');
    p.px(b + 1, y, 'k');
  }
  p.hline(0, 39, roofBot + 1, 'k');
  // đầu đao cong vút
  for (const [x, d] of [[0, 1], [39, -1]] as const) {
    p.px(x, roofBot, 'k');
    p.px(x, roofBot - 1, TILE);
    p.px(x, roofBot - 2, 'k');
    p.px(x + d, roofBot - 2, TILE);
    p.px(x, roofBot - 3, 'l');
  }
  // bờ nóc + lưỡng long chầu nguyệt
  p.rect(9, 10, 22, 2, TILE_D);
  p.hline(9, 30, 9, 'k');
  p.line(9, 9, 7, 6, 'a');
  p.line(30, 9, 32, 6, 'a');
  p.px(7, 6, 'A');
  p.px(32, 6, 'A');
  p.ellipse(20, 7, 2, 2, 'l');
  p.px(19, 6, 'i');
  p.line(14, 9, 17, 7, 'a');
  p.line(25, 9, 22, 7, 'a');
  // đèn lồng
  for (const x of [8, 31]) {
    p.vline(x, 25, 26, 'k');
    p.ellipse(x, 29, 2, 2, 'e');
    p.px(x, 27, 'l');
    p.px(x - 1, 28, 'o');
    p.px(x, 32, 'l');
  }
  // chậu cây cảnh
  p.rect(0, 35, 3, 2, 'O');
  p.ellipse(1, 33, 2, 2, 'G');
  p.rect(37, 35, 3, 2, 'O');
  p.ellipse(38, 33, 2, 2, 'G');
}

/** Loa Thành Chín Vòng: thành đất xoáy ốc, lầu canh mái cong, nỏ thần trên cổng. */
function leu5(p: Pen, blink: boolean, mood: Mood) {
  shadow(p, 20, 42, 20);
  // ba vòng thành đất (xoáy ốc), mỗi vòng có mặt tường và mặt trên
  const rings: [number, number, number, number][] = [
    [20, 37, 19, 6],
    [20, 33, 14, 5],
    [20, 30, 9, 3],
  ];
  rings.forEach(([cx, cy, rx, ry], i) => {
    p.ellipse(cx, cy + 2, rx, ry, 'u');
    for (let x = cx - rx + 1; x <= cx + rx; x += 3) p.px(x, cy + 1 + Math.round(Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2)) * ry), 'T');
    p.ellipse(cx, cy, rx, ry, i % 2 ? 'S' : 'y');
    p.ellipse(cx, cy, rx - 2, ry - 1, i % 2 ? 'y' : 's');
    p.ellipse(cx, cy, rx, ry, 'z', false);
  });
  // cổng vòng ngoài + nỏ thần
  p.rect(17, 39, 6, 4, 'K');
  p.rect(18, 40, 4, 3, 'k');
  p.hline(16, 23, 38, 'n');
  p.hline(17, 22, 37, 'l');
  p.px(19, 36, 'L');
  p.px(20, 36, 'L');
  // lầu canh trung tâm
  p.rect(15, 16, 10, 14, 'n');
  for (let y = 18; y < 30; y += 3) p.hline(15, 24, y, 'N');
  for (let y = 16; y < 30; y += 3) for (let x = 16 + ((y / 3) % 2 ? 2 : 0); x < 25; x += 4) p.px(x, y + 1, 'N');
  p.vline(14, 16, 29, 'k');
  p.vline(25, 16, 29, 'k');
  p.rect(17, 24, 6, 6, 'K');
  p.rect(18, 25, 4, 5, 'k');
  p.eyes(16, 19, 6, blink, mood);
  // mái dưới
  for (let y = 12; y <= 15; y++) {
    const half = 7 + (y - 12) * 2;
    p.hline(20 - half, 19 + half, y, y % 2 ? 'O' : 'e');
  }
  p.hline(5, 34, 16, 'k');
  p.px(5, 14, 'l');
  p.px(34, 14, 'l');
  p.px(5, 15, 'O');
  p.px(34, 15, 'O');
  // tầng trên
  p.rect(17, 9, 6, 3, 'n');
  p.vline(16, 9, 11, 'k');
  p.vline(23, 9, 11, 'k');
  for (let y = 5; y <= 8; y++) {
    const half = 4 + (y - 5) * 2;
    p.hline(20 - half, 19 + half, y, y % 2 ? 'e' : 'O');
  }
  p.hline(9, 30, 9, 'k');
  p.px(9, 7, 'l');
  p.px(30, 7, 'l');
  // chóp vàng
  p.vline(19, 1, 4, 'l');
  p.vline(20, 1, 4, 'L');
  p.px(19, 0, 'i');
  // cờ đuôi nheo hai bên
  for (const [x, d, col] of [[2, 1, 'e'], [37, -1, 'l']] as const) {
    p.vline(x, 17, 36, 'T');
    p.poly(d > 0 ? [[x + 1, 17], [x + 8, 19], [x + 1, 22]] : [[x, 17], [x - 7, 19], [x, 22]], col);
    p.px(x, 16, 'l');
  }
  // ánh sáng linh thiêng
  for (const [x, y] of [[6, 4], [33, 3], [11, 12], [29, 11], [4, 26], [36, 27]]) p.px(x, y, 'l');
}

// ======================= CUỐC =======================
export function drawCuoc(tier: number, blink: boolean, mood: Mood): Canvas {
  const { w, h } = LV_SIZE.cuoc;
  const [c, ctx] = canvas(w, h);
  const p = new Pen(ctx);
  shadow(p, 10, 26, 8);
  const handle = (col: string, x0 = 6, y0 = 24, x1 = 13, y1 = 6) => {
    p.line(x0 - 1, y0, x1 - 1, y1, 'k');
    p.line(x0, y0, x1, y1, col);
    p.line(x0 + 1, y0, x1 + 1, y1, 'k');
  };
  // lưỡi cuốc bản rủ xuống từ đầu cán (dáng chữ 7)
  const blade = (fill: string, dark: string, light: string, edge: string, wide = 0) => {
    const pts: [number, number][] = [[11, 2], [18 + wide, 3], [18 + wide, 12], [12, 11]];
    p.poly(pts, fill);
    p.vline(17 + wide, 4, 11, dark);
    p.hline(12, 17 + wide, 3, light);
    p.hline(13, 17 + wide, 11, edge);
    for (let i = 0; i < 4; i++) p.line(pts[i][0], pts[i][1], pts[(i + 1) % 4][0], pts[(i + 1) % 4][1], 'k');
    p.rect(9, 2, 3, 4, 'M');
    p.rect(9, 2, 3, 1, 'k');
  };
  if (tier <= 1) {
    // Cuốc Rỉ: mô đất nhỏ, cán nứt buộc dây, lưỡi rỉ mẻ
    p.ellipse(10, 24, 6, 2, 'T');
    p.hline(5, 15, 23, 'u');
    handle('t', 6, 24, 10, 5);
    p.px(8, 16, 'K');
    p.px(9, 13, 'K');
    p.hline(8, 10, 9, 'w');
    p.hline(8, 10, 10, 'F');
    blade('r', 'R', 'o', 'R');
    p.ctx.clearRect(16, 11, 3, 2);
    p.ctx.clearRect(18, 10, 1, 1);
    p.px(15, 11, 'k');
    p.px(16, 10, 'k');
    p.px(17, 10, 'k');
    p.px(14, 8, 'R');
    p.eyes(13, 5, 3, blink, mood);
    p.px(3, 22, 'G');
    p.px(2, 21, 'g');
    p.px(4, 21, 'G');
  } else if (tier === 2) {
    // Cuốc Sắt: luống đất mới xới, lưỡi sắt xám có đinh tán
    p.rect(1, 22, 18, 4, 'T');
    for (const y of [23, 25]) p.hline(1, 18, y, 'K');
    p.hline(1, 18, 22, 'u');
    handle('t', 6, 24, 10, 5);
    blade('N', 'M', 'n', 'm');
    p.px(12, 4, 'm');
    p.px(16, 4, 'm');
    p.eyes(13, 6, 3, blink, mood);
    // mầm non
    p.vline(3, 19, 21, 'G');
    p.px(2, 19, 'g');
    p.px(4, 18, 'g');
  } else if (tier === 3) {
    // Cuốc Thép Ròng: bệ đá, cán quấn da, lưỡi thép sáng loáng
    p.rect(3, 22, 14, 4, 'n');
    p.hline(3, 16, 22, 'm');
    p.hline(3, 16, 25, 'N');
    p.vline(2, 22, 25, 'k');
    p.vline(17, 22, 25, 'k');
    handle('T', 6, 24, 10, 5);
    for (let i = 0; i < 4; i++) p.px(7 + Math.round(i * 0.9), 20 - i * 3, 'R');
    blade('m', 'n', 'i', 'i', 1);
    p.line(13, 4, 13, 9, 'i');
    p.eyes(14, 6, 3, blink, mood);
    // lấp lánh
    p.px(3, 6, 'i');
    p.px(2, 7, 'c');
    p.px(4, 7, 'c');
    p.px(3, 8, 'c');
  } else if (tier === 4) {
    // Cuốc Phá Đá: chẻ đôi tảng đá, đầu cuốc chim hai lưỡi
    p.ellipse(10, 22, 9, 4, 'N');
    p.ellipse(9, 21, 7, 3, 'n');
    p.ellipse(10, 22, 9, 4, 'k', false);
    p.line(10, 18, 8, 25, 'k');
    p.line(10, 18, 13, 25, 'k');
    p.px(2, 25, 'N');
    p.px(17, 25, 'M');
    handle('T', 9, 20, 11, 6);
    for (const y of [10, 15]) p.hline(9, 11, y, 'N');
    // đầu cuốc: mũi chim bên trái, lưỡi bên phải
    p.rect(4, 3, 15, 4, 'M');
    p.hline(4, 18, 3, 'N');
    p.poly([[4, 3], [0, 6], [4, 7]], 'M');
    p.rect(15, 2, 4, 7, 'M');
    p.vline(18, 2, 8, 'n');
    p.hline(3, 19, 2, 'k');
    p.hline(3, 19, 7, 'k');
    p.vline(19, 1, 9, 'k');
    p.px(0, 6, 'k');
    p.eyes(8, 4, 4, blink, mood);
    // đá vụn
    for (const [x, y] of [[1, 18], [18, 17], [15, 15]]) p.px(x, y, 'n');
  } else {
    // Cuốc Dời Non: núi nhỏ dưới chân, lưỡi vàng chạm mây, tua đỏ
    p.poly([[1, 26], [7, 16], [11, 21], [14, 17], [19, 26]], 'a');
    p.poly([[5, 26], [7, 16], [10, 26]], 'H');
    p.poly([[6, 18], [7, 16], [8, 18]], 'w');
    p.poly([[13, 19], [14, 17], [15, 19]], 'w');
    p.hline(1, 19, 26, 'k');
    handle('u', 7, 20, 10, 5);
    for (const y of [11, 16]) p.hline(8, 10, y, 'l');
    blade('l', 'L', 'i', 'L', 1);
    p.line(13, 6, 15, 8, 'L');
    p.line(15, 8, 17, 6, 'L');
    p.rect(9, 2, 3, 4, 'e');
    p.rect(9, 2, 3, 1, 'k');
    p.eyes(13, 4, 3, blink, mood);
    // tua đỏ
    p.vline(9, 8, 12, 'e');
    p.vline(8, 9, 13, 'E');
    p.px(10, 11, 'e');
    // mây
    p.hline(0, 4, 12, 'i');
    p.hline(1, 3, 11, 'c');
    p.hline(15, 19, 13, 'i');
    p.hline(16, 18, 12, 'c');
    for (const [x, y] of [[2, 3], [5, 8], [18, 10]]) p.px(x, y, 'l');
  }
  return c;
}

// ======================= LŨY TRE =======================
export function drawRao(tier: number, blink: boolean, mood: Mood): Canvas {
  const { w, h } = LV_SIZE.rao;
  const [c, ctx] = canvas(w, h);
  const p = new Pen(ctx);
  shadow(p, 12, 26, 11);
  const culm = (x: number, top: number, bot: number, a: string, b: string, node: string) => {
    p.vline(x, top, bot, a);
    p.vline(x + 1, top, bot, b);
    for (let y = top + 3; y < bot; y += 4) p.hline(x, x + 1, y, node);
  };
  if (tier <= 1) {
    // Hàng Rào Tre: ba cọc, hai thanh ngang, tấm ván buộc dây
    for (const x of [2, 11, 20]) {
      culm(x, 11, 25, 'a', 'G', 'H');
      p.px(x, 10, 'A');
      p.vline(x - 1, 11, 25, 'k');
      p.vline(x + 2, 11, 25, 'k');
    }
    for (const y of [14, 22]) {
      p.hline(1, 22, y, 'Y');
      p.hline(1, 22, y + 1, 'z');
    }
    p.rect(6, 16, 12, 5, 'u');
    p.hline(6, 17, 16, 'y');
    p.rect(5, 15, 14, 1, 'k');
    p.rect(5, 21, 14, 1, 'k');
    p.eyes(8, 17, 6, blink, mood);
  } else if (tier === 2) {
    // Rào Tre Gai: cọc vót nhọn đóng chéo, cành gai
    p.rect(0, 22, 24, 3, 'T');
    p.hline(0, 23, 22, 'u');
    p.hline(0, 23, 25, 'k');
    for (const x of [2, 9, 16]) {
      p.line(x, 22, x + 6, 9, 'A');
      p.line(x + 1, 22, x + 7, 9, 'a');
      p.line(x + 6, 22, x, 9, 'a');
      p.line(x + 7, 22, x + 1, 9, 'G');
      p.px(x + 7, 8, 'w');
      p.px(x, 8, 'w');
    }
    for (let i = 0; i < 9; i++) p.px(1 + i * 2.5, 15 + (i % 3), 'k');
    p.line(0, 17, 23, 13, 'H');
    p.eyes(8, 23, 6, blink, mood);
  } else if (tier === 3) {
    // Lũy Tre Làng: bụi tre xanh rậm
    p.ellipse(12, 24, 10, 3, 'T');
    p.ellipse(12, 23, 9, 2, 'u');
    const tops = [6, 2, 0, 3, 7];
    tops.forEach((t, i) => culm(3 + i * 4, t + 2, 23, i % 2 ? 'a' : 'G', 'H', 'A'));
    for (const [cx, cy] of [[4, 6], [10, 3], [16, 2], [21, 6], [7, 11], [17, 10]]) {
      p.ellipse(cx, cy, 3, 2, 'G');
      p.px(cx - 2, cy, 'A');
      p.px(cx + 1, cy - 1, 'A');
    }
    p.rect(7, 18, 10, 5, 'H');
    p.eyes(8, 19, 6, blink, mood);
  } else if (tier === 4) {
    // Lũy Tre Ba Lớp: tre sau, cọc giữa, bờ đất trước
    for (let i = 0; i < 6; i++) culm(1 + i * 4, 1 + (i % 2) * 3, 17, 'H', 'a', 'G');
    for (const [cx, cy] of [[3, 3], [9, 1], [15, 2], [21, 4]]) p.ellipse(cx, cy, 3, 2, 'H');
    for (let x = 1; x < 23; x += 3) {
      p.vline(x, 12, 20, 'A');
      p.px(x, 11, 'w');
      p.vline(x + 1, 13, 20, 'k');
    }
    p.poly([[0, 26], [2, 19], [22, 19], [24, 26]], 'z');
    p.hline(2, 21, 19, 'G');
    p.hline(1, 22, 20, 'g');
    for (let x = 3; x < 22; x += 4) p.px(x, 23, 'T');
    p.hline(0, 23, 26, 'k');
    p.eyes(8, 21, 6, blink, mood);
  } else {
    // Lũy Tre Ngàn Năm: tre vàng cổ thụ, lá phát sáng, bia đá buộc khăn đỏ
    const tops = [3, 0, 0, 1, 4];
    tops.forEach((t, i) => {
      culm(2 + i * 4, t + 2, 22, 'l', 'L', 'a');
      p.px(2 + i * 4, t + 8, 'a');
    });
    for (const [cx, cy] of [[3, 4], [9, 1], [15, 1], [21, 4], [6, 9], [18, 8]]) {
      p.ellipse(cx, cy, 3, 2, 'A');
      p.px(cx, cy - 1, 'i');
    }
    p.hline(5, 9, 13, 'e');
    p.px(9, 14, 'e');
    p.px(9, 15, 'E');
    // bia đá
    p.rect(8, 17, 8, 8, 'n');
    p.hline(8, 15, 17, 'm');
    p.vline(7, 17, 24, 'k');
    p.vline(16, 17, 24, 'k');
    p.hline(8, 15, 16, 'k');
    p.hline(6, 17, 25, 'k');
    p.eyes(9, 19, 4, blink, mood);
    for (const [x, y] of [[0, 2], [23, 1], [1, 15], [22, 14], [12, 6]]) p.px(x, y, 'i');
  }
  return c;
}

// ======================= THUYỀN =======================
/** Thuyền: mũi bên trái, mực nước ở dòng 24. */
export function drawThuyen(tier: number, blink: boolean, mood: Mood): Canvas {
  const { w, h } = LV_SIZE.thuyen;
  const [c, ctx] = canvas(w, h);
  const p = new Pen(ctx);
  // gợn nước quanh thân
  p.ellipse(18, 25, 17, 2, '#a8e6f0');
  p.ellipse(18, 25, 14, 1, '#5fb6d6');
  if (tier <= 1) boat1(p, blink, mood);
  else if (tier === 2) boat2(p, blink, mood);
  else if (tier === 3) boat3(p, blink, mood);
  else if (tier === 4) boat4(p, blink, mood);
  else boat5(p, blink, mood);
  return c;
}

/** Thuyền Thúng: rổ tre tròn đan, quét dầu rái, mái chèo ngắn. */
function boat1(p: Pen, blink: boolean, mood: Mood) {
  p.ellipse(18, 22, 10, 4, TAR);
  p.ellipse(18, 20, 10, 4, 'Y');
  for (let x = 9; x <= 27; x++) for (let y = 19; y <= 23; y++) if ((x + y) % 3 === 0) p.px(x, y, 'y');
  p.ellipse(18, 18, 9, 2, 'z');
  p.ellipse(18, 18, 7, 1, 'K');
  p.ellipse(18, 20, 10, 4, 'k', false);
  p.hline(9, 27, 18, 'T');
  // mái chèo
  p.line(24, 18, 31, 9, 't');
  p.rect(30, 7, 3, 4, 'u');
  p.px(32, 7, 'k');
  p.eyes(12, 20, 4, blink, mood);
}

/** Ghe Nan: thân dài đan tre, đáy trét dầu đen, hai đầu cong. */
function boat2(p: Pen, blink: boolean, mood: Mood) {
  for (let x = 0; x < 32; x++) {
    const k = Math.abs(x - 15.5) / 15.5;
    const top = Math.round(19 + k * k * 0 - (k > 0.85 ? (k - 0.85) * 30 : 0));
    p.vline(2 + x, top, 24, x % 2 ? 'Y' : 'y');
    p.vline(2 + x, 22, 24, TAR);
    p.px(2 + x, top, 'k');
  }
  p.checker(6, 19, 24, 3, 'Y', 'z', 2);
  p.hline(2, 33, 24, 'k');
  p.hline(3, 32, 18, 'T');
  // chiếu cuộn
  p.rect(20, 16, 6, 2, 'y');
  p.hline(20, 25, 15, 'k');
  // mái chèo dài
  p.line(26, 17, 34, 6, 't');
  p.rect(33, 4, 2, 4, 'u');
  p.eyes(5, 19, 3, blink, mood);
}

/** Ghe Bầu: thân gỗ bầu, mui tre cong, mũi sơn đỏ, đai xanh. */
function boat3(p: Pen, blink: boolean, mood: Mood) {
  for (let x = 0; x < 34; x++) {
    const k = (x - 16.5) / 16.5;
    const top = 18 + Math.round(Math.abs(k) * 1.5) - (x < 3 ? 3 - x : 0) - (x > 31 ? x - 31 : 0);
    const bot = 24 - Math.round(k * k * 2);
    p.vline(1 + x, top, bot, 'T');
    p.px(1 + x, top, 'u');
    p.px(1 + x, top + 2, 'p');
    p.px(1 + x, bot, 'k');
  }
  // mũi đỏ
  p.poly([[1, 15], [6, 18], [6, 23], [3, 23]], 'e');
  p.line(1, 15, 3, 23, 'k');
  // mui tre cong
  for (let x = 12; x <= 25; x++) {
    const top = 11 + Math.round(((x - 18.5) / 7) ** 2 * 3);
    p.vline(x, top, 18, (x % 2 ? 'Y' : 'y'));
    p.px(x, top, 'k');
  }
  for (let y = 13; y < 18; y += 2) p.hline(12, 25, y, 'z');
  p.vline(11, 14, 18, 'k');
  p.vline(26, 14, 18, 'k');
  // cột buồm thấp
  p.vline(29, 8, 18, 'T');
  p.hline(28, 30, 8, 'k');
  p.eyes(3, 18, 3, blink, mood);
}

/** Thuyền Buồm Nâu: buồm cánh dơi có sườn tre, bánh lái, cờ đuôi nheo. */
function boat4(p: Pen, blink: boolean, mood: Mood) {
  for (let x = 0; x < 34; x++) {
    const k = (x - 16.5) / 16.5;
    const top = 19 + Math.round(Math.abs(k) * 1) - (x < 3 ? 3 - x : 0) - (x > 30 ? x - 30 : 0);
    const bot = 24 - Math.round(k * k * 2);
    p.vline(1 + x, top, bot, 'K');
    p.px(1 + x, top, 'u');
    p.px(1 + x, top + 1, 'f');
    p.px(1 + x, top + 2, 'p');
    p.px(1 + x, bot, 'k');
  }
  // bánh lái
  p.rect(33, 20, 2, 5, 'T');
  // cột + buồm cánh dơi
  p.vline(17, 1, 19, 'T');
  p.vline(18, 1, 19, 'K');
  p.poly([[19, 2], [32, 6], [33, 17], [19, 18]], 'O');
  p.poly([[16, 3], [6, 8], [5, 16], [16, 17]], 'O');
  for (let i = 0; i < 5; i++) {
    p.line(19, 3 + i * 3.5, 32, 6 + i * 2.7, 'z');
    p.line(16, 4 + i * 3.2, 6, 8 + i * 2, 'z');
  }
  p.line(19, 2, 32, 6, 'k');
  p.line(16, 3, 6, 8, 'k');
  // cờ đuôi nheo
  p.poly([[18, 1], [24, 0], [18, 3]], 'e');
  p.eyes(3, 19, 3, blink, mood);
}

/** Thuyền Rồng Lạc Hồng: thân đỏ viền vàng, đầu rồng ở mũi, đuôi rồng ở lái, buồm đỏ viền vàng. */
function boat5(p: Pen, blink: boolean, mood: Mood) {
  for (let x = 0; x < 30; x++) {
    const k = (x - 14.5) / 14.5;
    const top = 19 + Math.round(Math.abs(k) * 1);
    const bot = 24 - Math.round(k * k * 2);
    p.vline(4 + x, top, bot, 'e');
    p.px(4 + x, top, 'l');
    p.px(4 + x, top + 2, 'L');
    if (x % 4 === 0) p.px(4 + x, top + 3, 'l');
    p.px(4 + x, bot, 'k');
  }
  // cổ + đầu rồng ở mũi
  p.poly([[4, 20], [1, 12], [4, 9], [7, 12], [6, 21]], 'e');
  p.poly([[0, 9], [6, 6], [9, 9], [6, 12], [1, 12]], 'e');
  p.hline(0, 6, 12, 'E');
  p.line(0, 9, 6, 6, 'k');
  p.line(6, 6, 9, 9, 'k');
  p.px(8, 6, 'l');
  p.px(9, 5, 'l');
  p.px(7, 4, 'l');
  p.px(0, 11, 'w');
  p.line(1, 12, 0, 15, 'l');
  for (let y = 13; y < 20; y += 2) p.px(5, y, 'l');
  // đuôi rồng ở lái
  p.poly([[33, 21], [35, 13], [33, 10], [31, 20]], 'e');
  p.px(33, 9, 'l');
  p.px(35, 12, 'l');
  p.px(34, 10, 'L');
  // hai buồm đỏ viền vàng
  for (const [mx, top] of [[14, 3], [24, 6]] as const) {
    p.vline(mx, top, 19, 'T');
    p.poly([[mx + 1, top + 1], [mx + 8, top + 3], [mx + 8, 17], [mx + 1, 17]], 'e');
    p.line(mx + 1, top + 1, mx + 8, top + 3, 'l');
    p.vline(mx + 8, top + 3, 17, 'l');
    p.hline(mx + 1, mx + 8, 17, 'L');
    for (let y = top + 5; y < 17; y += 4) p.hline(mx + 1, mx + 8, y, 'E');
    p.poly([[mx, top], [mx + 4, top - 2], [mx, top + 1]], 'l');
  }
  p.eyes(2, 8, 3, blink, mood);
}

/** Giàn giáo tre phủ lên công trình đang xây. */
export function drawScaffold(w: number, h: number): Canvas {
  const [c, ctx] = canvas(w, h);
  const p = new Pen(ctx);
  const top = Math.round(h * 0.3);
  for (const x of [1, Math.round(w / 2), w - 2]) {
    p.vline(x, top, h - 2, 'a');
    p.vline(x + 1, top, h - 2, 'H');
  }
  for (let y = top + 3; y < h - 2; y += 6) p.hline(1, w - 2, y, 'Y');
  p.line(1, h - 3, Math.round(w / 2), top + 3, 'z');
  p.line(Math.round(w / 2), h - 3, w - 2, top + 3, 'z');
  p.rect(Math.round(w / 2) - 3, top - 4, 7, 4, 'y');
  p.hline(Math.round(w / 2) - 3, Math.round(w / 2) + 3, top - 4, 'z');
  return c;
}

/** Khung bao phần có hình (để vùng chạm vừa khít, không che các ô phía sau). */
export function opaqueBox(c: Canvas): { x: number; y: number; w: number; h: number } {
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width,
    y0 = c.height,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (d[(y * c.width + x) * 4 + 3] > 160) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return { x: 0, y: 0, w: c.width, h: c.height };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
