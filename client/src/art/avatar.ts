// Nhân vật chủ đảo vẽ theo lớp: thân (trang phục theo giới tính) → mặt → tóc → mũ nón → vật cầm.
// Mỗi lớp là bản đồ ký tự 16x20, tô màu theo lựa chọn của người chơi.
import { HAIR_COLORS, OUTFIT_COLORS, SKINS, avatarKey, type Avatar } from '../../../shared/avatar';
import { canvas, Pen, type Canvas } from './pixel';

const W = 16;
export const AV_H = 20;

type Layer = Record<number, string>; // dòng → chuỗi 16 ký tự

// ---------- trang phục: [nam, nữ], dòng 11..18 ----------
const BODY: [string[], string[]][] = [
  // Áo bà ba
  [
    ['....kCCccCCk....', '...kCCCcCCCCk...', '...kCkCcCCkCk...', '...kCkCcCLkCk...', '...kSkCCCCkSk...', '....kPPPPPPk....', '....kPPkkPPk....', '....kkk..kkk....'],
    ['.....kCccCk.....', '....kCCcCCCk....', '...kCkCcCCkCk...', '...kCkLcLCkCk...', '...kSkCCCCkSk...', '....kPPPPPPk....', '....kPPkkPPk....', '....kkk..kkk....'],
  ],
  // Áo dài
  [
    ['....kCCccCCk....', '...kCCCCCCCCk...', '...kCkCCcCkCk...', '...kCkCCCCkCk...', '...kSkCCCCkSk...', '....kWkCCkWk....', '....kWkcckWk....', '....kkk..kkk....'],
    ['.....kCccCk.....', '....kCCCCCCk....', '...kCkCCcCkCk...', '...kCkCCCCkCk...', '...kSkCCCCkSk...', '....kWCCCCWk....', '....kWCCCCWk....', '....kkcccckk....'],
  ],
  // Áo ngư dân (khăn rằn quàng cổ)
  [
    ['....kKFKFKFk....', '...kSCCCCCCSk...', '...kSkCCCCkSk...', '...kSkCCCCkSk...', '...kSkcccckSk...', '....kcccccck....', '....kSSkkSSk....', '....kkk..kkk....'],
    ['.....kKFKFk.....', '....kSCCCCSk....', '...kSkCCCCkSk...', '...kSkCCCCkSk...', '...kSkcccckSk...', '....kcccccck....', '....kcckkcck....', '....kkk..kkk....'],
  ],
  // Áo thủy thủ (sọc ngang)
  [
    ['....kWCCCCWk....', '...kCWWWWWWCk...', '...kCkCCCCkCk...', '...kWkWWWWkWk...', '...kSkCCCCkSk...', '....kBBBBBBk....', '....kBBkkBBk....', '....kkk..kkk....'],
    ['.....kWCCWk.....', '....kCWWWWCk....', '...kCkCCCCkCk...', '...kWkWWWWkWk...', '...kSkCCCCkSk...', '...kBBBBBBBBk...', '....kSSkkSSk....', '....kkk..kkk....'],
  ],
  // Áo tơi lá
  [
    ['....kYyYyYyk....', '...kYyYCCYyYk...', '..kYyYyCCyYyYk..', '..kyYyYCCYyYyk..', '..kzYzYzYzYzYk..', '....kPPPPPPk....', '....kPPkkPPk....', '....kkk..kkk....'],
    ['.....kYyYyk.....', '...kYyYCCYyYk...', '..kYyYyCCyYyYk..', '..kyYyYCCYyYyk..', '..kzYzYzYzYzYk..', '....kcccccck....', '....kSSkkSSk....', '....kkk..kkk....'],
  ],
];

// ---------- mặt, dòng 3..10 ----------
const HEAD = ['.....kkkkkk.....', '....kSSSSSSk....', '....kSSSSSSk....', '....kSSSSSSk....', '....kSkSSkSk....', '....kSSSSSsk....', '....kSSssSsk....', '.....kkkkkk.....'];

// ---------- tóc (lớp trước) ----------
const HAIR: [Layer[], Layer[]] = [
  [
    // Tóc ngắn
    { 2: '.....kkkkkk.....', 3: '....kHHHHHHk....', 4: '....kHhHHhHk....', 5: '....kh....hk....', 6: '....kh....hk....' },
    // Rẽ ngôi
    { 2: '.....kkkkkk.....', 3: '....kHHHhHHk....', 4: '...kHHHHHhHHk...', 5: '....kHHH..hk....', 6: '....kh....hk....' },
    // Đầu đinh
    { 2: '.....kkkkkk.....', 3: '....khhhhhhk....', 4: '....kh....hk....' },
    // Búi tó
    { 0: '......kkkk......', 1: '......kHHk......', 2: '.....kkeekk.....', 3: '....kHHHHHHk....', 4: '....kHhHHhHk....', 5: '....kh....hk....' },
    // Tóc bồng
    { 1: '.....kkkkkk.....', 2: '...kkHHHHHHkk...', 3: '..kHHhHHHHhHHk..', 4: '..kHHHHHHHHHHk..', 5: '..kHHh....hHHk..', 6: '...kH......Hk...' },
  ],
  [
    // Tóc dài xõa qua vai
    { 2: '.....kkkkkk.....', 3: '....kHHHHHHk....', 4: '...kHHHHHHHHk...', 5: '...kHh....hHk...', 6: '...kH......Hk...', 7: '...kH......Hk...', 8: '...kH......Hk...', 9: '...kH......Hk...', 10: '...kH......Hk...', 11: '...kH......Hk...', 12: '...kH......Hk...', 13: '...kh......hk...' },
    // Tóc tết một bên
    { 2: '.....kkkkkk.....', 3: '....kHHHHHHk....', 4: '....kHhHHHHk....', 5: '....kH....Hk....', 6: '....kH....hHk...', 7: '..........kHk...', 8: '..........khk...', 9: '..........kHk...', 10: '..........khk...', 11: '...........kHk..', 12: '...........khk..', 13: '...........kek..', 14: '...........kHk..', 15: '............k...' },
    // Búi cao cài trâm
    { 0: '......kkkk......', 1: '.....kHHHHk.....', 2: '.....kHHhHkl....', 3: '....kHHHHHHk....', 4: '....kHhHHhHk....', 5: '....kh....hk....' },
    // Đuôi ngựa
    { 2: '.....kkkkkk.....', 3: '....kHHHHHHke...', 4: '....kHhHHHHkHk..', 5: '....kh....hkHHk.', 6: '...........kHHk.', 7: '............kHk.', 8: '............kHk.', 9: '............khk.', 10: '.............k..' },
    // Tóc ngắn ngang vai
    { 2: '.....kkkkkk.....', 3: '....kHHHHHHk....', 4: '...kHHHHHHHHk...', 5: '...kHHh..hHHk...', 6: '...kHh....hHk...', 7: '...kH......Hk...', 8: '...kH......Hk...', 9: '...kh......hk...', 10: '....k......k....' },
  ],
];

// ---------- mũ nón ----------
const HAT: (Layer | null)[] = [
  null,
  // Nón lá
  { 0: '.......kk.......', 1: '......kYYk......', 2: '.....kYyYYk.....', 3: '....kYYyYYYk....', 4: '...kYYYyYYYYk...', 5: '.kkzzzzzzzzzzkk.' },
  // Khăn rằn
  { 2: '.....kkkkkk.....', 3: '....kKFKFKFk....', 4: '....kFKFKFKkKk..', 5: '...........kFKk.', 6: '............kk..' },
  // Khăn vấn
  { 1: '.....kkkkkk.....', 2: '....kcCcCcCk....', 3: '...kCcCcCcCck...', 4: '...kcCcCcCcCk...', 5: '....kkkkkkkk....' },
  // Mũ rơm
  { 0: '.....kkkkkk.....', 1: '....kYYYYYYk....', 2: '....keeeeeek....', 3: '.kkkYYYYYYYYkkk.', 4: '.kyyyyyyyyyyyyk.', 5: '..kkkkkkkkkkkk..' },
  // Băng đô
  { 4: '...kCCCCCCCCk...' },
];
/** Mũ che kín đỉnh đầu → không vẽ phần tóc nhô lên trên. */
const HAT_COVERS = new Set([1, 3, 4]);

function mix(hex: string, to: string, t: number) {
  const a = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const b = [1, 3, 5].map((i) => parseInt(to.slice(i, i + 2), 16));
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

function palette(a: Avatar): Record<string, string> {
  const [S, s] = SKINS[a.sk].c;
  const [H, h] = HAIR_COLORS[a.hc].c;
  const [C, c] = OUTFIT_COLORS[a.tc].c;
  return {
    k: '#1d1b2a',
    S,
    s,
    H,
    h,
    C,
    c,
    L: mix(C, '#ffffff', 0.35),
    W: '#f7f0e6',
    P: a.tc === 3 ? '#4a4452' : '#2d2a33',
    B: '#2c4378',
    Y: '#e8c56e',
    y: '#b98d3e',
    z: '#7f5a22',
    K: '#2b2b33',
    F: '#f0ece4',
    e: '#dc4a3e',
    l: '#f6d34d',
    q: '#ef7c98',
  };
}

function paint(ctx: CanvasRenderingContext2D, pal: Record<string, string>, rows: Layer | string[], y0 = 0, skipAbove = -1) {
  const entries: [number, string][] = Array.isArray(rows) ? rows.map((r, i) => [y0 + i, r]) : Object.entries(rows).map(([k, r]) => [Number(k), r]);
  for (const [y, r] of entries) {
    if (y < skipAbove) continue;
    for (let x = 0; x < r.length && x < W; x++) {
      const ch = r[x];
      if (ch === '.') continue;
      const col = pal[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

/** Vẽ nhân vật 16x20 (neo ở đáy giữa). */
export function drawAvatar(a: Avatar): Canvas {
  const [c, ctx] = canvas(W, AV_H);
  const pal = palette(a);
  const g = a.g;
  // vật cầm phía sau người (mái chèo)
  const p = new Pen(ctx);
  if (a.it === 1) {
    p.vline(14, 4, 15, 'T');
    p.px(14, 3, 'k');
    p.rect(13, 16, 3, 3, 'u');
    p.hline(13, 15, 19, 'k');
    p.vline(15, 16, 18, 't');
  }
  paint(ctx, pal, BODY[a.to][g], 11);
  const head = [...HEAD];
  if (g === 1) head[5] = '....kqSSSSqk....';
  else head[3] = '....kShSShSk....';
  paint(ctx, pal, head, 3);
  paint(ctx, pal, HAIR[g][a.ha % 5], 0, HAT_COVERS.has(a.hat) ? 3 : -1);
  const hat = HAT[a.hat];
  if (hat) paint(ctx, pal, hat);
  // vật cầm phía trước
  if (a.it === 2) {
    // cần câu
    p.line(12, 15, 15, 2, 'T');
    p.px(15, 1, 'k');
    p.vline(15, 3, 9, '#cfe9f2');
    p.px(15, 10, 'e');
  } else if (a.it === 3) {
    // giỏ tre
    p.rect(12, 15, 4, 3, 'Y');
    p.hline(12, 15, 16, 'z');
    p.hline(12, 15, 18, 'k');
    p.vline(12, 13, 15, 'z');
    p.vline(15, 13, 15, 'z');
    p.hline(12, 15, 13, 'z');
    p.px(13, 14, 'G');
  } else if (a.it === 4) {
    // quạt mo
    p.ellipse(14, 10, 2, 3, 'y');
    p.ellipse(14, 10, 2, 3, 'z', false);
    p.vline(13, 12, 15, 'z');
  }
  return c;
}

/** Texture Phaser cho một dáng vẻ (cache theo mã dáng vẻ). */
export function avatarTexKey(a: Avatar): string {
  return `av-${avatarKey(a)}`;
}

const urlCache = new Map<string, string>();
/** Ảnh nhân vật phóng to cho giao diện DOM. head=true: chỉ lấy phần đầu (khung vuông). */
export function avatarUrl(a: Avatar, scale = 3, head = false): string {
  const key = `${avatarKey(a)}:${scale}:${head ? 1 : 0}`;
  let u = urlCache.get(key);
  if (!u) {
    const src = drawAvatar(a);
    const sh = head ? 12 : AV_H;
    const [c, ctx] = canvas(W * scale, sh * scale);
    ctx.drawImage(src, 0, 0, W, sh, 0, 0, W * scale, sh * scale);
    u = c.toDataURL();
    urlCache.set(key, u);
  }
  return u;
}
