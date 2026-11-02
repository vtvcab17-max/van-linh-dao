// Bảng mẫu phong cách đồ họa mới (art2) — chỉ dùng khi phát triển.
import { drawUnit, GENERALS, TROOPS } from '../../client/src/art2/units';
import { flip, scaleUp } from '../../client/src/art2/pal';

const root = document.getElementById('root')!;
const sec = (title: string) => {
  const h = document.createElement('h2');
  h.textContent = title;
  root.appendChild(h);
  const d = document.createElement('div');
  d.className = 'row';
  root.appendChild(d);
  return d;
};
const put = (parent: HTMLElement, c: HTMLCanvasElement, k: number, label?: string) => {
  const w = document.createElement('figure');
  const s = scaleUp(c, k);
  w.appendChild(s);
  if (label) {
    const f = document.createElement('figcaption');
    f.textContent = label;
    w.appendChild(f);
  }
  parent.appendChild(w);
};
const mode = location.hash.slice(1) || 'units';
await Promise.all(['900 30px Handjet', '700 30px Handjet'].map((f) => document.fonts.load(f)));
if (mode === 'units') {
  const r = sec('Binh chủng');
  for (const t of TROOPS) put(r, drawUnit(t.look), 5, t.name);
  const r2 = sec('Quân địch (lật ngang)');
  for (const t of TROOPS) put(r2, flip(drawUnit(t.look)), 5, t.name);
  const r3 = sec('Tướng');
  for (const g of GENERALS) put(r3, drawUnit(g.look), 5, g.name);
}
import { drawBoat, drawGate, drawHall, drawHut, drawPier, drawShipyard, drawTower, drawWall } from '../../client/src/art2/builds';
if (mode === 'builds') {
  const r = sec('Phủ chúa đảo theo bậc');
  for (const t of [1, 2, 3, 4, 5]) put(r, drawHall(t), 4, `Bậc ${t}`);
  const r2 = sec('Công trình');
  put(r2, drawHut(), 4, 'Nhà tranh');
  put(r2, drawTower(), 4, 'Tháp canh');
  put(r2, drawWall(), 4, 'Tường đá ong');
  put(r2, drawGate(), 4, 'Cổng thành');
  put(r2, drawPier(), 4, 'Bến thuyền');
  put(r2, drawShipyard(), 4, 'Xưởng đóng tàu');
  const r3 = sec('Thuyền và trang bị');
  put(r3, drawBoat('thung'), 4, 'Thuyền thúng');
  put(r3, drawBoat('ghe', { dam: true }), 4, 'Ghe chiến + mũi đâm');
  put(r3, drawBoat('buom', { no: true }), 4, 'Thuyền buồm + nỏ lớn');
  put(r3, drawBoat('chien', { no: true, da: true, dam: true }), 4, 'Chiến hạm đủ đồ');
}
import { drawFogHex, drawHexIsland, drawIslandGround, drawSeaHex, drawTerritory, hexNeighbors, hexOrigin, inHex, TILE } from '../../client/src/art2/terrain';
import { C as CC, cnv as mk, P as Pen2 } from '../../client/src/art2/pal';

/** Chữ viền dày trên bản đồ (vẽ trên canvas đã phóng to). */
function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill = '#ffffff') {
  ctx.font = `900 ${size}px Handjet`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(4, size / 4);
  ctx.strokeStyle = '#3d2b2b';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}
function board(w: number, h: number, k: number, draw: (x: CanvasRenderingContext2D) => void, after?: (x: CanvasRenderingContext2D) => void) {
  const [c, x] = mk(w, h);
  draw(x);
  const [big, bx] = mk(w * k, h * k);
  bx.drawImage(c, 0, 0, w * k, h * k);
  after?.(bx);
  return big;
}
const at = (x: CanvasRenderingContext2D, img: HTMLCanvasElement, cx: number, bottom: number) => x.drawImage(img, Math.round(cx - img.width / 2), Math.round(bottom - img.height));

if (mode === 'island') {
  const cols = 14, rows = 10, m = 2;
  const shape = [
    '....xxxxxx....',
    '..xxxxxxxxxx..',
    '.xxxxxxxxxxxx.',
    'xxxxxxxxxxxxx.',
    'xxxxxxxxxxxxxx',
    'xxxxxxxxxxxxxx',
    '.xxxxxxxxxxxx.',
    '.xxxxxxxxxxx..',
    '..xxxxxxxxx...',
    '....xxxxx.....',
  ];
  const land = (x: number, y: number) => shape[y]?.[x] === 'x';
  const cell = (cx: number, cy: number) => ({ x: (cx + m) * TILE + 8, y: (cy + m) * TILE + 15 });
  const W = (cols + m * 2) * TILE, H = (rows + m * 2) * TILE;
  const items: [number, () => void][] = [];
  const big = board(W, H, 3, (x) => {
    x.drawImage(drawIslandGround(cols, rows, land, m, 4), 0, 0);
    const p = new Pen2(x);
    // ô đang chọn để xây (viền xanh)
    const sel = cell(9, 6);
    p.x.strokeStyle = '#3fbf5f';
    p.x.lineWidth = 1;
    p.x.strokeRect(sel.x - 8 + 0.5, sel.y - 15 + 0.5, 15, 15);
    p.x.fillStyle = 'rgba(120,255,150,0.25)';
    p.x.fillRect(sel.x - 7, sel.y - 14, 14, 14);
    const place = (img: HTMLCanvasElement, cx: number, cy: number, wcells = 1) => {
      const c0 = cell(cx, cy);
      items.push([c0.y, () => at(x, img, c0.x + (wcells - 1) * 8, c0.y + 3)]);
    };
    place(drawHall(4), 5, 3, 2);
    place(drawHut(), 2, 4); place(drawHut(), 3, 6); place(drawHut(), 9, 2);
    place(drawTower(), 11, 3); place(drawTower(), 1, 6);
    for (let i = 3; i <= 8; i++) if (i !== 5 && i !== 6) place(drawWall(), i, 8);
    place(drawGate(), 5, 8, 2);
    place(drawShipyard(), 10, 6, 2);
    place(drawUnit(TROOPS[0].look), 7, 5); place(drawUnit(TROOPS[2].look), 8, 5); place(drawUnit(GENERALS[0].look), 6, 5);
    place(drawUnit(TROOPS[1].look), 4, 6);
    items.sort((a, b) => a[0] - b[0]).forEach(([, f]) => f());
    // bến và thuyền ngoài nước
    const pier = drawPier();
    x.drawImage(pier, (14 + m) * TILE - 4, (4 + m) * TILE + 6);
    x.drawImage(drawBoat('chien', { no: true, da: true }), (15 + m) * TILE - 6, (2 + m) * TILE + 2);
    x.drawImage(drawBoat('ghe'), (14 + m) * TILE, (6 + m) * TILE + 4);
  }, (bx) => {
    label(bx, 'Đảo Vạn Linh · Lv 12', W * 1.5, 3 * 30, 34, '#ffe27a');
  });
  root.appendChild(big);
}

if (mode === 'sea') {
  const cols = 15, rows = 11;
  const W = cols * 32 + 16, H = rows * 24 + 8;
  const own = new Map<string, string>();
  const key = (c: number, r: number) => `${c},${r}`;
  const claim = (c0: number, r0: number, color: string, extra: [number, number][] = []) => {
    own.set(key(c0, r0), color);
    for (const [c, r] of hexNeighbors(c0, r0)) own.set(key(c, r), color);
    for (const [c, r] of extra) own.set(key(c, r), color);
  };
  claim(4, 5, '#4fd06a', [[6, 5], [6, 6], [7, 6]]); // của mình
  claim(10, 3, '#f0554a', [[11, 5]]); // địch
  claim(10, 8, '#5aa8ff'); // đồng minh
  const fog = (c: number, r: number) => c <= 0 || r <= 0 || c >= cols - 1 || r >= rows - 1 || (c >= 12 && r >= 6) || (c <= 2 && r >= 8);
  const islands: [number, number, string, number][] = [[4, 5, 'Lãnh Địa Vạn Linh', 2], [10, 3, '???', 1], [10, 8, 'Hội Bạch Đằng', 1], [7, 2, '', 0], [2, 3, '', 0], [13, 4, '', 0]];
  const big = board(W, H, 3, (x) => {
    x.fillStyle = CC.sea;
    x.fillRect(0, 0, W, H);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const o = hexOrigin(c, r);
        const deep = (c * 7 + r * 3) % 11 === 0;
        x.drawImage(drawSeaHex(deep ? 'deep' : (c + r) % 9 === 0 ? 'shoal' : 'sea', c * 31 + r), o.x, o.y);
      }
    for (const [c, r, , s] of islands) {
      const o = hexOrigin(c, r);
      x.drawImage(drawHexIsland(c * 13 + r, s), o.x, o.y);
    }
    // phủ lãnh thổ
    for (const [k, color] of own) {
      const [c, r] = k.split(',').map(Number);
      const sides = hexNeighbors(c, r).map(([nc, nr]) => own.get(key(nc, nr)) !== color);
      const o = hexOrigin(c, r);
      x.drawImage(drawTerritory(color, sides), o.x, o.y);
    }
    // nhà chính trên đảo của mình
    const home = hexOrigin(4, 5);
    const hall = drawHall(4);
    x.drawImage(hall, 0, 0, 40, 46, home.x + 6, home.y - 2, 20, 23);
    const enemy = hexOrigin(10, 3);
    x.drawImage(drawHall(2), 0, 0, 40, 46, enemy.x + 6, enemy.y - 2, 20, 23);
    const ally = hexOrigin(10, 8);
    x.drawImage(drawHall(3), 0, 0, 40, 46, ally.x + 6, ally.y - 2, 20, 23);
    // mũi tên hành quân (chấm chevron) từ đảo mình tới đảo địch
    const pa = hexOrigin(5, 4), pb = hexOrigin(9, 3);
    const n = 9;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const px = pa.x + 16 + (pb.x - pa.x) * t, py = pa.y + 14 + (pb.y - pa.y) * t;
      x.fillStyle = '#ffffff';
      x.fillRect(Math.round(px), Math.round(py), 2, 2);
      x.fillStyle = '#3fbf5f';
      x.fillRect(Math.round(px) + 1, Math.round(py) + 1, 1, 1);
    }
    // thuyền lạ (không biết của ai) và thuyền đồng minh
    const boat = drawBoat('buom', { no: true }, '#9aa3ad');
    x.drawImage(boat, 0, 0, boat.width, boat.height, pa.x + 40, pa.y + 2, boat.width / 2, boat.height / 2);
    const b2 = drawBoat('ghe', {}, '#5aa8ff');
    const o2 = hexOrigin(8, 7);
    x.drawImage(b2, o2.x + 4, o2.y + 6);
    const b3 = drawBoat('chien', { no: true, da: true }, '#9aa3ad');
    const o3 = hexOrigin(12, 2);
    x.drawImage(b3, 0, 0, b3.width, b3.height, o3.x, o3.y + 4, b3.width / 2, b3.height / 2);
    // sương mù ô chưa mở
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) if (fog(c, r)) {
        const o = hexOrigin(c, r);
        x.drawImage(drawFogHex(c * 5 + r * 3), o.x, o.y);
      }
  }, (bx) => {
    for (const [c, r, name] of islands) {
      if (!name) continue;
      const o = hexOrigin(c, r);
      label(bx, name, (o.x + 16) * 3, (o.y - 1) * 3, 30, name === '???' ? '#ffb3a8' : name.startsWith('Hội') ? '#bfe0ff' : '#ffffff');
    }
    const o2 = hexOrigin(8, 7);
    label(bx, 'Hội Bạch Đằng', (o2.x + 18) * 3, (o2.y + 6) * 3, 22, '#bfe0ff');
    const pa = hexOrigin(5, 4);
    label(bx, 'Thuyền lạ', (pa.x + 50) * 3, (pa.y + 3) * 3, 22, '#e9eef3');
    const o3 = hexOrigin(12, 2);
    label(bx, 'Thuyền lạ', (o3.x + 12) * 3, (o3.y + 5) * 3, 22, '#e9eef3');
  });
  root.appendChild(big);
}

if (mode === 'battle') {
  const cols = 12, rows = 7, T2 = 18;
  const W = cols * T2 + 8, H = rows * T2 + 30;
  const big = board(W, H, 4, (x) => {
    x.fillStyle = '#ead9a8';
    x.fillRect(0, 0, W, H);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        x.fillStyle = (r + c) % 2 ? '#f6ebc6' : '#efe0b2';
        x.fillRect(4 + c * T2, 22 + r * T2, T2, T2);
      }
    const us: [number, number, number][] = [[3, 1, 0], [3, 2, 1], [3, 3, 1], [3, 4, 1], [3, 5, 0], [2, 2, 2], [2, 3, 2], [2, 4, 2], [1, 3, 3], [4, 3, -1]];
    const them: [number, number, number][] = [[7, 1, 4], [7, 2, 1], [7, 3, 4], [7, 4, 1], [7, 5, 4], [8, 2, 2], [8, 4, 2], [9, 3, 5], [6, 3, 0]];
    const draw = (c: number, r: number, img: HTMLCanvasElement, hp: number, color: string) => {
      const cx = 4 + c * T2 + T2 / 2, by = 22 + (r + 1) * T2 - 1;
      at(x, img, cx, by + 3);
      x.fillStyle = '#3d2b2b';
      x.fillRect(cx - 7, by - 24, 14, 3);
      x.fillStyle = color;
      x.fillRect(cx - 6, by - 23, Math.round(12 * hp), 1);
    };
    for (const [c, r, t] of us) draw(c, r, t < 0 ? drawUnit(GENERALS[2].look) : drawUnit(TROOPS[t].look), 0.6 + ((c + r) % 4) * 0.1, '#4fd06a');
    for (const [c, r, t] of them) draw(c, r, flip(drawUnit(TROOPS[t].look)), 0.4 + ((c * r) % 5) * 0.12, '#f0554a');
    // vệt chém và mũi tên bay
    const p = new Pen2(x);
    const sx = 4 + 5 * T2 + 9, sy = 22 + 3 * T2 + 4;
    for (let a = -1.1; a <= 1.1; a += 0.08) { p.px(sx + Math.round(Math.cos(a) * 9), sy + Math.round(Math.sin(a) * 9), '#ffffff'); p.px(sx + Math.round(Math.cos(a) * 8), sy + Math.round(Math.sin(a) * 8), '#9fd4ff'); }
    p.h(4 + 4 * T2 + 4, 4 + 4 * T2 + 12, 22 + 1 * T2 + 9, CC.wood2);
    p.px(4 + 4 * T2 + 13, 22 + 1 * T2 + 9, CC.metal3);
    // thanh trên
    x.fillStyle = 'rgba(61,43,43,0.85)';
    x.fillRect(4, 3, W - 8, 15);
  }, (bx) => {
    label(bx, '-68', (4 + 6 * 18 + 6) * 4, (22 + 3 * 18 - 2) * 4, 40, '#ff6a55');
    label(bx, '-35', (4 + 7 * 18 + 9) * 4, (22 + 1 * 18 - 2) * 4, 32, '#ff6a55');
    bx.font = '700 34px Handjet';
    bx.textAlign = 'left';
    bx.fillStyle = '#ffe27a';
    bx.fillText('Lượt 4  ·  00:02:20', 40, 58);
    bx.textAlign = 'right';
    bx.fillStyle = '#ffffff';
    bx.fillText('Trận người chơi: không tua', (W - 10) * 4, 58);
  });
  root.appendChild(big);
}
import { enhance } from '../../client/src/art/hd';
import { drawLeu, drawCuoc, drawRao, drawThuyen } from '../../client/src/art/buildings';
import { drawDinh } from '../../client/src/art/dinh';
if (mode === 'mix') {
  const r = sec('Lính mới + bộ lọc 32-bit cũ');
  for (const t of TROOPS) put(r, enhance(drawUnit(t.look)), 3);
  for (const g of GENERALS.slice(0, 3)) put(r, enhance(drawUnit(g.look)), 3);
  const r2 = sec('Công trình mới + bộ lọc cũ');
  put(r2, enhance(drawHall(4)), 2); put(r2, enhance(drawHut()), 2); put(r2, enhance(drawTower()), 2); put(r2, enhance(drawGate()), 2); put(r2, enhance(drawBoat('chien', { no: true, da: true })), 2);
  const r3 = sec('Đồ cũ (linh vật)');
  put(r3, enhance(drawLeu(3, false, 'vui')), 2); put(r3, enhance(drawCuoc(3, false, 'thuong')), 2); put(r3, enhance(drawRao(3, false, 'thuong')), 2); put(r3, enhance(drawThuyen(4, false, 'thuong')), 2);
  put(r3, enhance(drawDinh('nhadan', 3)), 3); put(r3, enhance(drawDinh('den', 3)), 3); put(r3, enhance(drawDinh('thapcanh', 3)), 3);
}
import { drawIsland } from '../../client/src/art/islands';
import { drawNode, drawWater } from '../../client/src/art/sprites';
import { GRID } from '../../shared/data';
if (mode === 'mixisland') {
  const shape = [
    '....xxxxxx....',
    '..xxxxxxxxxx..',
    '.xxxxxxxxxxxx.',
    'xxxxxxxxxxxxx.',
    'xxxxxxxxxxxxxx',
    'xxxxxxxxxxxxxx',
    '.xxxxxxxxxxxx.',
    '.xxxxxxxxxxx..',
    '..xxxxxxxxx...',
    '....xxxxx.....',
  ];
  const OXc = 5, OYc = 7;
  const landArr = new Array(GRID * GRID).fill('0');
  shape.forEach((r, y) => [...r].forEach((ch, x) => ch === 'x' && (landArr[(y + OYc) * GRID + x + OXc] = '1')));
  const land = landArr.join('');
  const K = 2;
  const x0 = (OXc - 3) * 16, y0 = (OYc - 3) * 16, Wc = (14 + 6) * 16, Hc = (10 + 5) * 16;
  const [c, x] = mk(Wc * K, Hc * K);
  // nước kiểu cũ
  const wt = drawWater(0);
  for (let y = 0; y < Hc * K; y += 64) for (let i = 0; i < Wc * K; i += 64) x.drawImage(wt, i, y, 64, 64);
  x.drawImage(drawIsland(land, 8, K), -x0 * K, -y0 * K);
  // lưới ô nhạt trên đất (kiểu 9 Vạn Mẫu)
  for (let cy = 0; cy < 10; cy++)
    for (let cx = 0; cx < 14; cx++) {
      if (shape[cy][cx] !== 'x') continue;
      const inner = [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => shape[cy + dy]?.[cx + dx] === 'x');
      if (!inner) continue;
      x.fillStyle = (cx + cy) % 2 ? 'rgba(255,255,230,0.10)' : 'rgba(40,80,20,0.05)';
      x.fillRect((cx + 3) * 16 * K, (cy + 3) * 16 * K, 16 * K, 16 * K);
    }
  const items: [number, () => void][] = [];
  const cellPx = (cx: number, cy: number) => ({ x: (cx + 3) * 16 * K + 8 * K, y: (cy + 3) * 16 * K + 15 * K });
  const place = (img: HTMLCanvasElement, cx: number, cy: number, wcells = 1, enh = true) => {
    const e = enh ? enhance(img) : img;
    const p0 = cellPx(cx, cy);
    items.push([p0.y, () => at(x, e, p0.x + (wcells - 1) * 8 * K, p0.y + 3 * K)]);
  };
  place(drawLeu(3, false, 'vui'), 5, 3, 2);
  place(drawHall(4), 8, 2, 2);
  place(drawHut(), 2, 4); place(drawHut(), 3, 6);
  place(drawTower(), 11, 3); place(drawTower(), 1, 6);
  for (let i = 3; i <= 8; i++) if (i !== 5 && i !== 6) place(drawWall(), i, 8);
  place(drawGate(), 5, 8, 2);
  place(drawShipyard(), 10, 6, 2);
  place(drawCuoc(3, false, 'thuong'), 4, 4);
  place(drawRao(3, false, 'thuong'), 8, 6);
  for (const [k, cx, cy] of [['palm', 0, 3], ['palm', 12, 5], ['bamboo', 1, 2], ['bamboo', 12, 2], ['rock', 9, 8], ['grass', 3, 2]] as [string, number, number][]) place(drawNode(k), cx, cy);
  place(drawUnit(TROOPS[0].look), 7, 5); place(drawUnit(TROOPS[2].look), 6, 6); place(drawUnit(GENERALS[0].look), 6, 5);
  place(drawUnit(TROOPS[1].look), 4, 6);
  items.sort((a, b) => a[0] - b[0]).forEach(([, f]) => f());
  const pier = enhance(drawPier());
  x.drawImage(pier, (14 + 3) * 16 * K - 8 * K, (4 + 3) * 16 * K + 4 * K);
  x.drawImage(enhance(drawBoat('chien', { no: true, da: true })), (15 + 3) * 16 * K - 10 * K, (2 + 3) * 16 * K - 4 * K);
  // ô đang chọn
  const sel = cellPx(9, 6);
  x.strokeStyle = '#7cff9a';
  x.lineWidth = 2;
  x.strokeRect(sel.x - 8 * K + 2, sel.y - 15 * K + 2, 16 * K - 4, 16 * K - 4);
  const big = scaleUp(c, 2);
  label(big.getContext('2d')!, 'Đảo Vạn Linh', Wc * K, 2.6 * 16 * K * 2, 40, '#ffe27a');
  root.appendChild(big);
}
