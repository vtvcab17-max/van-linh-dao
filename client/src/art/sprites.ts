import { drawMonster } from '../art2/monsters';
import { isRandKey, randBase, randSeed } from '../../../shared/monstergen';
// Mọi sprite của Vạn Linh Đảo. Nhân vật/quái vẽ bằng bản đồ ký tự; nhà cửa, linh vật, địa hình vẽ bằng thuật toán.
import { canvas, fromMap, noise, Pen, PAL, recolor, type Canvas } from './pixel';
import { CHESTS } from '../../../shared/data';

// ---------------- nhân vật ----------------
const MAI_AN = [
  '................',
  '......kkkk......',
  '.....kddddkk....',
  '....kddddddk....',
  '....kddhhhdk..k.',
  '....kdhkhkhk.krk',
  '....khhhhhhk.kRk',
  '.....khjjhk..tk.',
  '....kppppppkkt..',
  '...kpppppppkt...',
  '...khppppphk....',
  '...kkPPPPPkk....',
  '....kPPkPPk.....',
  '....kTTkTTk.....',
  '....kkk.kkk.....',
  '................',
];
const BAO_NGOC = [
  '.......kk.......',
  '......kddk......',
  '.....kddddk.....',
  '....keeeeeek....',
  '....kdhhhhdk....',
  '....khkhhkhk....',
  '....khhhhhhk....',
  '.....khjjhk.....',
  '...kkffffffkk...',
  '..khffffffffhk..',
  '..khfkkkkkkfhk..',
  '...kkFFFFFFkk...',
  '....kFFkkFFk....',
  '....kFFkkFFk....',
  '....kkk..kkk....',
  '................',
];
const THU_HA = [
  '................',
  '.....kkkkkk.....',
  '....kddddddk....',
  '...kddhhhhddk...',
  '...kdhkhhkhdk...',
  '...kdhhhhhhdk...',
  '...kdkhjjhkdk...',
  '...kdkffffkdk...',
  '...kkffaafffk...',
  '..khfaaaaffhk...',
  '..khffaaffffk...',
  '...kffffffffk...',
  '...kFFFFFFFFk...',
  '....kTk..kTk....',
  '....kkk..kkk....',
  '................',
];
const MINH_CHAU = [
  '................',
  '......kkkk......',
  '.....kddddk.....',
  '....kddddddk....',
  '....kdhhhhdk....',
  '....kkkhkkkk....',
  '....kmkhkmkk....',
  '....khhhhhhk....',
  '.....khjjhk..l..',
  '....kooooook.lk.',
  '...koooooooolk..',
  '...khoOOOOohk...',
  '....kOOOOOOk....',
  '....kPPkkPPk....',
  '....kkk..kkk....',
  '................',
];
const RUA_VANG = [
  '................',
  '................',
  '................',
  '......kkkkk.....',
  '....kklLlLlkk...',
  '...kllLlllLllk..',
  '..klLlllLlllLlkk',
  '..kLllLlllLllkhhk',
  '..kllLlllLllLkhkk',
  '..kkkkkkkkkkkkhhk',
  '...khk.....khk.k.',
  '...kkk.....kkk...',
  '................',
];

// ---------------- quái ----------------
const CUA_GAI = [
  '................',
  '..kk........kk..',
  '.kek........kek.',
  '.keek......keek.',
  '..kekk....kkek..',
  '...kkek..kekk...',
  '..k.kekkkkek.k..',
  '.kOkkeeeeeekkOk.',
  '.keekieekieeeek.',
  '.keeekkeekkeeek.',
  'kOeeeeeeeeeeeeOk',
  '.kEeeOeeeeOeeEk.',
  '..kEEeeeeeeEEk..',
  '.k.kkkkkkkkkk.k.',
  'k.k.k......k.k.k',
  '................',
];
const SUA_LUA = [
  '................',
  '.....kkkkkk.....',
  '...kkooooookk...',
  '..kooooqooooook.',
  '..kooiooooiook..',
  '..kookoooookok..',
  '..kooooooooook..',
  '..kOOOOOOOOOOk..',
  '...kOkOkOkOkk...',
  '...kO.kO.kO.k...',
  '...O..O..O..O...',
  '....O..O..O.....',
  '...o..O..o..O...',
  '....o..o..o.....',
  '................',
  '................',
];
const KHI_DA = [
  '................',
  '....kkkkkk......',
  '...knnnnnnk.....',
  '..knnNNNNnnk....',
  '.kNknhhhhnkNk...',
  '.kNkhkhhkhkNk...',
  '.kkkhhhhhhkkk...',
  '...knhjjhnk.....',
  '..knnnnnnnnk.kk.',
  '.knnknnnnknnknk.',
  '.knk.knnk.knnk..',
  '..k.knNNnk.kk...',
  '....knk.knk.....',
  '....kk...kk.....',
  '................',
  '................',
];
const CA_NOC = [
  '................',
  '................',
  '....k.k.k.k.....',
  '...kLkLkLkLk....',
  '..kLllllllllk...',
  '.kLlliklllllLk..',
  'kLllkkllllllllkk',
  '.kllllllllllLkLk',
  '.kLlllllwwllLkLk',
  '..kLlllllllLk.kk',
  '...kLkLkLkLk....',
  '....k.k.k.k.....',
  '................',
];
const HAI_TAC = [
  '................',
  '.....kkkkkk.....',
  '....kkkkkkkk....',
  '....kdhhhhdkk...',
  '....khkhhKhk....',
  '....khhhhhhk....',
  '.....kdddddk....',
  '....kfkfkfkk..m.',
  '...kkfkfkfkk.mk.',
  '...khfkfkfkhmk..',
  '...kkPPPPPPkk...',
  '....kPPkkPPk....',
  '....kPPkkPPk....',
  '....kkk..kkk....',
  '................',
  '................',
];
const BAY_THEO = [
  '...kkkkkkkkkk...',
  '..kkKKKKKKKKkk..',
  '...kkkkkkkkkk...',
  '....kdhhhhdk....',
  '....khkhheKk....',
  '....khhhhehk....',
  '.....kdddddk..m.',
  '...kkeeeeeekkmk.',
  '..keeeelleeekk..',
  '..kheeeeeeeehk..',
  '...kkEEEEEEkk...',
  '....kTTkkTTk....',
  '....kTTkkTTk....',
  '....kkk..kkk....',
  '................',
  '................',
];

export const CHAR_MAPS: Record<string, string[]> = {
  an: MAI_AN,
  ngoc: BAO_NGOC,
  ha: THU_HA,
  chau: MINH_CHAU,
  rua: RUA_VANG,
  cuagai: CUA_GAI,
  sualua: SUA_LUA,
  khida: KHI_DA,
  canoc: CA_NOC,
  haitac: HAI_TAC,
  baytheo: BAY_THEO,
};

// ---------------- linh vật (kiến trúc theo bậc) ----------------
export { drawLeu, drawCuoc, drawRao, drawThuyen, drawScaffold, opaqueBox, LV_SIZE } from './buildings';
import { drawRao } from './buildings';
import { drawThuyBinh, drawThuyTinh } from './boss';

// ---------------- điểm tài nguyên ----------------
export function drawNode(kind: string): Canvas {
  if (kind === 'palm') {
    const [c, ctx] = canvas(16, 32);
    const p = new Pen(ctx);
    p.ellipse(8, 30, 5, 1, 'rgba(0,0,0,0.22)');
    for (let y = 8; y < 30; y++) {
      const x = 7 + Math.round(Math.sin(y / 6) * 1.5);
      p.hline(x - 1, x + 1, y, y % 3 === 0 ? 'T' : 't');
      p.px(x - 2, y, 'k');
      p.px(x + 2, y, 'k');
    }
    const fr = [[-7, 3], [7, 3], [-5, -2], [5, -2], [-7, 7], [7, 7]];
    for (const [dx, dy] of fr) p.line(7, 8, 7 + dx, 8 + dy, 'G');
    for (const [dx, dy] of fr) p.line(7, 7, 7 + dx, 7 + dy, 'g');
    p.rect(6, 8, 2, 2, 'T');
    p.px(9, 9, 'z');
    return c;
  }
  if (kind === 'bamboo') {
    const [c, ctx] = canvas(16, 24);
    const p = new Pen(ctx);
    p.ellipse(8, 22, 6, 1, 'rgba(0,0,0,0.22)');
    for (const [x, top] of [[4, 4], [8, 1], [11, 6]]) {
      p.vline(x, top, 22, 'a');
      p.vline(x + 1, top, 22, 'G');
      for (let y = top + 4; y < 22; y += 5) p.hline(x, x + 1, y, 'H');
      p.px(x - 1, top + 2, 'A');
      p.px(x + 2, top + 1, 'A');
      p.px(x + 3, top + 3, 'g');
    }
    return c;
  }
  const [c, ctx] = canvas(16, 16);
  const p = new Pen(ctx);
  p.ellipse(8, 14, 6, 1, 'rgba(0,0,0,0.2)');
  if (kind === 'grass') {
    p.ellipse(8, 14, 6, 2, 'H');
    for (let i = 0; i < 10; i++) {
      const x = 2 + i * 1.3;
      const h = 7 + ((i * 7) % 5);
      const tip = Math.round(x + (i % 2 ? 2 : -2));
      p.line(Math.round(x), 14, tip, 14 - h, i % 3 ? 'Y' : 'y');
      p.px(Math.round(x), 13, 'G');
      p.px(tip, 14 - h, 'w');
    }
  } else if (kind === 'rock') {
    p.ellipse(8, 10, 6, 4, 'N');
    p.ellipse(7, 9, 4, 3, 'n');
    p.px(5, 8, 'w');
    p.ellipse(8, 10, 6, 4, 'k', false);
    p.ellipse(12, 12, 2, 2, 'M');
  } else if (kind === 'scrap') {
    p.ellipse(8, 12, 6, 2, 'R');
    p.rect(3, 9, 4, 3, 'r');
    p.rect(9, 7, 4, 4, 'N');
    p.ellipse(11, 9, 2, 2, 'M', false);
    p.line(5, 6, 8, 11, 'm');
    p.px(5, 6, 'n');
    p.rect(6, 10, 3, 2, 'r');
    p.px(12, 12, 'm');
  } else if (kind === 'drift') {
    p.rect(2, 9, 12, 3, 'F');
    p.hline(2, 13, 9, 'w');
    p.hline(2, 13, 12, 'k');
    p.line(10, 9, 13, 5, 'F');
    p.px(13, 5, 'w');
    p.px(4, 10, 'S');
    p.px(8, 11, 'S');
  }
  return c;
}

// ---------------- hòm ----------------
export function drawChest(ci: number, open = false): Canvas {
  const [c, ctx] = canvas(16, 16);
  const p = new Pen(ctx);
  const col = CHESTS[ci].color;
  p.ellipse(8, 14, 6, 1, 'rgba(0,0,0,0.25)');
  p.rect(2, 7, 12, 7, col);
  p.rect(2, open ? 3 : 4, 12, 3, col);
  p.hline(2, 13, open ? 3 : 4, 'w');
  p.rect(2, 10, 12, 1, 'rgba(0,0,0,0.25)');
  p.rect(1, 6, 14, 1, 'k');
  p.rect(1, 13, 14, 1, 'k');
  p.vline(1, open ? 3 : 4, 13, 'k');
  p.vline(14, open ? 3 : 4, 13, 'k');
  p.hline(2, 13, open ? 2 : 3, 'k');
  p.rect(7, 6, 2, 3, ci >= 3 ? 'l' : 'L');
  p.vline(4, 7, 12, ci >= 4 ? 'l' : 'k');
  p.vline(11, 7, 12, ci >= 4 ? 'l' : 'k');
  if (ci >= 3) for (const [x, y] of [[0, 2], [15, 4], [13, 0]]) p.px(x, y, 'l');
  return c;
}

// ---------------- biểu cảm ----------------
export function drawEmote(kind: 'vui' | 'doi' | 'doi_bung' | 'nghe'): Canvas {
  const maps: Record<string, string[]> = {
    vui: ['.kk.kk.', 'kqqkqqk', 'kqqqqqk', '.kqqqk.', '..kqk..', '...k...'],
    doi: ['k.....k', '.k...k.', '..k.k..', '.......', '.eeeee.', 'e.....e'],
    doi_bung: ['.......', '.......', 'k.k.k..', 'k.k.k..', '.......', '.......'],
    nghe: ['..kkk..', '.kwwwk.', 'kwkwkwk', 'kwwwwwk', '.kwwk..', '..kk...'],
  };
  return fromMap(maps[kind]);
}

// ---------------- biểu tượng tài nguyên (cho HUD) ----------------
const ICONS: Record<string, string[]> = {
  thoc: ['....kk....', '...kyk.k..', '..kyYkyk..', '.kyYkyYk..', 'kyYkyYk...', '.kkyYk....', '...kk.....', '..........'],
  gao: ['..kkkkk...', '.kwiwwwk..', 'kwiwwwwFk.', 'kwwwwwwFk.', '.kFFFFFk..', '..kkkkk...'],
  rau: ['...kk.kk..', '..kAGkAGk.', '.kAGGkGGk.', '..kGGGGk..', '...kGGk...', '....kk....'],
  thit: ['..kkkk....', '.keeEEk...', 'keeeeEEkk.', 'kEeeeEkfk.', '.kEEEk.kk.', '..kkk.....'],
  trung: ['...kkk....', '..kwiwk...', '.kwiwwFk..', '.kwwwwFk..', '.kwwwFFk..', '..kkkkk...'],
  ca: ['..........', '.kkk...k..', 'kxXxxk.kk.', 'kxkxxXkXk.', 'kxXxxk.kk.', '.kkk...k..'],
  thaoduoc: ['....kk....', '...kGAk...', '..kGGGAk..', '...kGGk...', '..kTkk....', '..kk......'],
  to: ['..kkkkk...', '.kfiffFk..', 'kfFfFfFfk.', 'kfffFfffk.', '.kfFffFk..', '..kkkkk...'],
  luong: ['.kkkkkkk..', 'kYyyyyyYk.', 'kyYyyyYyk.', 'kyyYYYyyk.', 'kYyyyyyYk.', '.kkkkkkk..'],
  duoc: ['...kkk....', '...kwk....', '..kxxxk...', '.kxeexXk..', '.kxeexXk..', '.kxxxXXk..', '..kkkkk...'],
  vai: ['kkkkkkkk..', 'kfqfqfqk..', 'kqfqfqfk..', 'kfqfqfqk..', 'kqfqfqfk..', 'kkkkkkkk..'],
  lt: ['...kkk....', '..kxxXk...', '.kxcxxXk..', 'kxcxxxxXk.', '.kxxxxXk..', '..kxxXk...', '...kXk....', '....k.....'],
  tien: ['..kkkkk...', '.kllllLk..', 'kllkkklLk.', 'klkLLLklk.', 'klkLLLklk.', 'kllkkklLk.', '.kLlllLk..', '..kkkkk...'],
  co: ['...g.g....', '..gG.Gg...', '.gyGgGyg..', '..GgGgG...', '.kYYYYYk..', '..kYYYk...', '..kyyyk...', '...kkk....'],
  la: ['......Gk..', '....GgGk..', '...GgGgk..', '..GgGgk...', '.GgGgk....', 'GgGgk.....', 'Gt.k......', '.t........'],
  tre: ['....kak...', '....kAk...', '....kak...', '....kHk...', '....kak...', '....kAk...', '....kak...', '....kHk...'],
  go: ['..........', '.kkkkkkk..', 'kuuttttuk.', 'kTttttTuk.', 'kuTtttTuk.', '.kkkkkkkk.', '..........'],
  cui: ['..k.k.k...', '.kukukuk..', '.ktktktk..', '.ktktktk..', '.kTkTkTk..', '..k.k.k...', 'kYYYYYYYk.'],
  da: ['..........', '...kkkk...', '..knnnNk..', '.knwnnNNk.', '.knnnNNMk.', '..kNNNMk..', '...kkkk...'],
  sat: ['...kk.....', '..kmmk....', '...kmk.kk.', '...kmkkrrk', '...kmk.kRk', '...kmk..k.', '....k.....'],
  so: ['...kkkk...', '..kwswsk..', '.kswswswk.', '.kwswswsk.', '..kswswk..', '...kkkk...'],
  ngoc: ['...kkk....', '..kwiwk...', '.kwiwwmk..', '.kwwwwmk..', '..kmmmk...', '...kkk....'],
};
export function drawIcon(key: string): Canvas {
  return fromMap(ICONS[key] ?? ICONS.da, PAL, 3);
}

// ---------------- địa hình ----------------
export { drawIsland, drawSeaIsland, lookOf, miniRadius, MINI_SIZE } from './islands';
import { drawSeaIsland } from './islands';

/** Ô nước 32x32 lặp lại (2 khung). */
export function drawWater(frame: number): Canvas {
  const [c, ctx] = canvas(32, 32);
  const p = new Pen(ctx);
  p.rect(0, 0, 32, 32, 'b');
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(noise(i, 3, 7) * 32);
    const y = Math.floor(noise(i, 5, 9) * 32);
    const len = 2 + Math.floor(noise(i, 1, 2) * 3);
    const off = frame ? 1 : 0;
    p.hline((x + off) % 30, ((x + off) % 30) + len, y, i % 3 ? 'B' : 'c');
  }
  return c;
}

/** Đảo nhỏ trên hải đồ (biểu tượng chung). */
export function drawMiniIsland(size: number, kind: 'me' | 'player' | 'bot' | 'wild'): Canvas {
  return drawSeaIsland(`icon-${kind}`, 16 + size * 8, kind, 3);
}

/** Phông nền bãi biển cho trận đánh. */
export function drawBattleBg(w: number, h: number): Canvas {
  const [c, ctx] = canvas(w, h);
  const p = new Pen(ctx);
  const horizon = Math.round(h * 0.42);
  for (let y = 0; y < horizon; y++) p.hline(0, w, y, y < horizon * 0.5 ? '#f1a65d' : y < horizon * 0.8 ? '#e98a5b' : '#c86a63');
  p.ellipse(Math.round(w * 0.72), Math.round(horizon * 0.62), 9, 9, '#f8e08a');
  for (let y = horizon; y < Math.round(h * 0.6); y++) p.hline(0, w, y, (y - horizon) % 3 === 0 ? '#5fb6d6' : '#3a90c2');
  for (let y = Math.round(h * 0.6); y < h; y++)
    for (let x = 0; x < w; x++) {
      const n = noise(x, y, 4);
      p.px(x, y, n < 0.08 ? '#fbf3dc' : n < 0.2 ? '#d6b26d' : '#f2d99c');
    }
  return c;
}

const TRAU = [
  '................',
  '.wk..........kw.',
  '.wwk........kww.',
  '..wkkTTTTTTkkw..',
  '...kTTTTTTTTk...',
  '..kTTttttttTTk..',
  '.kTTtkTttTktTTk.',
  '.kTTtttttttTTTk.',
  '.kTTtuuuuuuTTTk.',
  '..kTtukkkkutTk..',
  '..kkTuuuuuuTkk..',
  '...kTTTTTTTTk...',
  '...kTTkkkkTTk...',
  '...kTTk..kTTk...',
  '...kkkk..kkkk...',
  '................',
];
const NGU = [
  '.......kk.......',
  '.....kkyykk.....',
  '....kyyyyyyk....',
  '...kYyyyyyyYk...',
  '....kkuuuukk....',
  '....kukuukuk....',
  '....kuuuuuuk....',
  '.....kuuuuk.....',
  '...kkBBbbBBkk.t.',
  '..kBbbbbbbbBkt..',
  '..kBbbbbbbbBkt..',
  '..kuBbbbbbBukt..',
  '...kkBBBBBBkkt..',
  '....kBBkkBBk.t..',
  '....kkk..kkk.t..',
  '................',
];
export function charCanvas(key: string): Canvas {
  if (isRandKey(key)) return drawMonster(randSeed(key), randBase(key).family);
  if (key === 'trau') return fromMap(TRAU);
  if (key === 'ngu') return fromMap(NGU);
  if (key === 'thuytinh') return drawThuyTinh();
  if (key === 'thuybinh') return drawThuyBinh();
  if (key === 'cuada') return fromMap(recolor(CUA_GAI, { e: 'n', E: 'N', O: 'M' }), PAL, 2);
  if (key.startsWith('rao')) return drawRao(Number(key.slice(3)) || 1, false, 'thuong');
  return fromMap(CHAR_MAPS[key] ?? CUA_GAI);
}
