// Lính và tướng chibi: đầu to bằng nửa người, mặt hai chấm mắt, nhìn mũ là biết binh chủng.
import { HAIR_COLORS, OUTFIT_COLORS, SKINS, type Avatar } from '../../../shared/avatar';
import { C, cnv, lit, outline, P, shadow } from './pal';

export const UW = 20;
export const UH = 26;
const OX = 2;
const OY = 6;

// thân người quay mặt sang phải (16 x 16), tay trước cầm vũ khí ở (12, 11)
const BODY = [
  '................',
  '................',
  '.....rrrrrr.....',
  '....rrrrrrrr....',
  '...rrrrrrrrrr...',
  '...rrrhhhhhhh...',
  '...rrhhhehheh...',
  '...rrhhhehheh...',
  '...rhhhhbhhbh...',
  '....HHHHHHHH....',
  '....Cccccccc....',
  '....CcccccCch...',
  '....hcccccCC....',
  '.....DDDDDD.....',
  '......pp.pp.....',
  '......ff.ff.....',
];
// nữ: tóc dài xõa sau lưng
const LONG_HAIR = [
  '', '', '', '', '', '', '', '', '',
  '...rr...........',
  '...rR...........',
  '...rR...........',
  '....R...........',
];

export type Hat = 'nonla' | 'mu_sat' | 'khan_trum' | 'khan_ran' | 'mu_da' | 'khan_do' | 'mu_tuong' | 'mien' | 'hoa' | 'toc_bui' | 'mu_sat_den' | 'tran' | 'mu_rom' | 'khan_van' | 'bang_do';
export type Weapon = 'giao' | 'cung' | 'khien' | 'riu' | 'no' | 'chia' | 'tre' | 'gay' | 'quat' | 'no_vang' | 'kiem' | 'none' | 'cheo' | 'can' | 'gio';

export interface Look {
  hat: Hat;
  weapon: Weapon;
  cloth: [string, string, string?];
  hair?: [string, string];
  skin?: [string, string];
  female?: boolean;
  cape?: string;
  /** dải màu ngang thân (áo sọc, đai) */
  belt?: string;
  /** hào quang dưới chân và đốm sáng (tướng hiếm) */
  aura?: string;
}

function hat(p: P, h: Hat, ox: number, oy: number, hairC: [string, string]) {
  const at = (x: number, y: number, c: string) => p.px(ox + x, oy + y, c);
  const row = (x0: number, x1: number, y: number, c: string) => p.h(ox + x0, ox + x1, oy + y, c);
  switch (h) {
    case 'nonla': {
      // nón lá: chóp nhọn, vành rộng hơn đầu, nan nón chạy ngang
      const rows: [number, number][] = [[7, 8], [6, 9], [5, 10], [4, 11], [3, 12], [2, 13], [1, 14]];
      rows.forEach(([a, b], i) => {
        const y = i - 3;
        row(a, b, y, C.straw);
        row(Math.ceil((a + b) / 2) + 1, b, y, C.straw2);
      });
      row(3, 12, -1, C.straw2);
      row(2, 7, 1, C.straw2);
      row(1, 14, 3, C.straw3);
      at(6, -2, '#fff6cf');
      at(5, -1, '#fff6cf');
      break;
    }
    case 'mu_sat':
    case 'mu_sat_den': {
      const m1 = h === 'mu_sat' ? C.metal : '#8d96a6', m2 = h === 'mu_sat' ? C.metal2 : '#5f6878', m3 = h === 'mu_sat' ? C.metal3 : '#454c5a';
      row(5, 10, 0, m1); row(4, 11, 1, m1); row(3, 12, 2, m1); row(3, 12, 3, m1);
      row(9, 10, 0, m2); row(9, 11, 1, m2); row(9, 12, 2, m2); row(9, 12, 3, m2);
      row(2, 13, 4, m3);
      at(5, 1, '#ffffff'); at(4, 2, '#ffffff');
      // chóp đỏ ngả về sau
      if (h === 'mu_sat') {
        row(7, 8, -1, C.red); row(5, 8, -2, C.red); row(4, 7, -3, C.red); row(3, 5, -2, C.red2); at(8, -2, C.red2);
      } else {
        row(7, 8, -1, m3); row(7, 8, -2, m3); at(7, -3, m2);
      }
      break;
    }
    case 'khan_trum': {
      // khăn trùm kín đầu kiểu cung thủ, chừa mặt
      row(5, 10, 1, C.green); row(4, 11, 2, C.green); row(3, 12, 3, C.green); row(2, 12, 4, C.green);
      row(2, 5, 5, C.green2); row(2, 4, 6, C.green2); row(2, 4, 7, C.green2); row(2, 4, 8, C.green2); row(2, 3, 9, C.green3); row(1, 2, 10, C.green3);
      row(9, 11, 2, C.green2); row(10, 12, 3, C.green2);
      row(4, 12, 4, C.green3);
      at(5, 2, '#c6f0a6'); at(4, 3, '#c6f0a6');
      break;
    }
    case 'khan_ran': {
      // tóc + khăn rằn ca rô trắng đen, đuôi khăn bay sau
      for (let x = 3; x <= 12; x++) at(x, 4, x % 2 ? '#f5efe2' : '#3f3a46');
      at(2, 4, '#3f3a46'); at(1, 5, '#f5efe2'); at(2, 5, '#3f3a46'); at(1, 6, '#3f3a46'); at(0, 6, '#f5efe2');
      break;
    }
    case 'mu_da': {
      row(5, 10, 1, C.brown); row(4, 11, 2, C.brown); row(3, 12, 3, C.brown);
      row(9, 11, 2, C.brown2); row(9, 12, 3, C.brown2);
      for (let x = 2; x <= 13; x++) at(x, 4, x % 2 ? '#f3e2c4' : '#d8c09a');
      at(5, 2, '#f0c49a');
      break;
    }
    case 'khan_do': {
      row(5, 10, 2, C.red); row(4, 11, 3, C.red); row(3, 12, 4, C.red);
      row(9, 11, 3, C.red2); row(9, 12, 4, C.red2);
      for (let x = 4; x <= 12; x += 3) at(x, 4, '#ffd7c4');
      at(2, 4, C.red); at(1, 5, C.red2); at(2, 5, C.red); at(0, 6, C.red2);
      break;
    }
    case 'mu_tuong': {
      // mũ trụ vàng có cánh hai bên và tua đỏ
      row(5, 10, 0, C.gold); row(4, 11, 1, C.gold); row(3, 12, 2, C.gold); row(3, 12, 3, C.gold);
      row(9, 11, 1, C.gold2); row(9, 12, 2, C.gold2); row(9, 12, 3, C.gold2);
      row(2, 13, 4, C.gold3);
      at(5, 1, '#fff6c0'); at(4, 2, '#fff6c0');
      at(7, 2, C.red); at(8, 2, C.red);
      row(0, 2, 1, C.gold2); at(0, 0, C.gold); row(13, 15, 1, C.gold2); at(15, 0, C.gold);
      row(7, 8, -1, C.red); row(6, 9, -2, C.red); row(6, 8, -3, C.red2); at(7, -4, C.red2);
      break;
    }
    case 'mien': {
      // miện vua: vành vàng, ngọc đỏ, lá ngọc hai bên
      row(3, 12, 3, C.gold); row(3, 12, 4, C.gold2);
      for (const x of [4, 7, 10]) { at(x, 2, C.gold); at(x, 1, C.gold); }
      at(7, 0, C.gold); at(7, 3, C.red); at(4, 3, C.blue); at(10, 3, C.blue);
      break;
    }
    case 'hoa': {
      // vòng hoa trên tóc (nữ)
      for (const [x, c] of [[4, C.pink], [6, C.white], [8, C.pink], [10, C.white], [12, C.pink]] as [number, string][]) { at(x, 3, c); at(x + 1, 3, C.leaf); }
      at(8, 2, C.gold);
      break;
    }
    case 'toc_bui': {
      // búi tó trên đỉnh đầu
      row(6, 9, 0, hairC[0]); row(6, 9, 1, hairC[0]); at(8, 0, hairC[1]); at(7, -1, hairC[0]); at(8, -1, hairC[0]);
      at(6, 1, C.red); at(9, 1, C.red);
      break;
    }
    case 'mu_rom': {
      // mũ rơm vành phẳng, dải đỏ quanh chóp
      row(5, 10, 0, C.straw); row(4, 11, 1, C.straw); row(4, 11, 2, C.straw);
      row(9, 11, 1, C.straw2); row(9, 11, 2, C.straw2);
      row(4, 11, 3, C.red);
      row(1, 14, 4, C.straw); row(2, 13, 5, C.straw2);
      at(5, 1, '#fff6cf');
      break;
    }
    case 'khan_van': {
      // khăn vấn quấn tròn quanh đầu (màu theo áo)
      const k1 = '#3b3442';
      row(4, 11, 1, k1); row(3, 12, 2, '#5a5266'); row(3, 12, 3, k1); row(3, 12, 4, '#5a5266');
      for (let x = 4; x <= 11; x += 2) at(x, 3, '#6e6680');
      at(5, 1, '#7a7290');
      break;
    }
    case 'bang_do': {
      row(3, 12, 4, C.red); at(2, 4, C.red); at(1, 5, C.red2); at(2, 5, C.red); at(0, 6, C.red2);
      at(5, 4, '#ffd7c4');
      break;
    }
  }
}

function weapon(p: P, w: Weapon, ox: number, oy: number) {
  const at = (x: number, y: number, c: string) => p.px(ox + x, oy + y, c);
  const col = (x: number, y0: number, y1: number, c: string) => p.v(ox + x, oy + y0, oy + y1, c);
  switch (w) {
    case 'giao':
      col(13, -3, 14, C.wood);
      col(14, -3, 14, C.wood2);
      at(13, -6, C.metal); col(13, -5, -4, C.metal); at(14, -5, C.metal2); at(12, -5, C.metal); at(14, -4, C.metal3);
      at(12, -3, C.red); at(15, -3, C.red2); at(12, -2, C.red2);
      break;
    case 'chia':
      col(13, -3, 14, C.wood); col(14, -3, 14, C.wood2);
      p.h(ox + 11, ox + 16, oy - 3, C.metal3);
      for (const x of [11, 13, 16]) col(x, -6, -4, C.metal);
      at(13, -7, C.metal);
      break;
    case 'cung':
      // cung cong, dây sáng, ống tên sau lưng
      for (const [x, y] of [[14, 3], [15, 4], [15, 5], [16, 6], [16, 7], [16, 8], [16, 9], [16, 10], [16, 11], [15, 12], [15, 13], [14, 14]]) at(x, y, C.wood2);
      col(14, 4, 13, '#fff4d8');
      p.h(ox + 9, ox + 15, oy + 9, C.wood);
      at(16, 9, C.metal);
      col(1, 8, 12, C.brown2); col(2, 8, 12, C.brown); at(1, 7, C.white); at(2, 6, C.white);
      break;
    case 'no':
    case 'no_vang': {
      const a = w === 'no' ? C.wood : C.gold, b = w === 'no' ? C.wood2 : C.gold2;
      p.h(ox + 9, ox + 17, oy + 11, a);
      p.h(ox + 9, ox + 12, oy + 12, b);
      col(16, 7, 15, b);
      at(17, 11, C.metal);
      for (const [x, y] of [[15, 8], [14, 10], [14, 12], [15, 14]]) at(x, y, '#fff4d8');
      break;
    }
    case 'khien':
      // khiên mây tròn phía trước, kiếm giơ cao sau khiên
      col(15, 2, 8, C.metal); col(16, 3, 8, C.metal2); p.h(ox + 14, ox + 17, oy + 9, C.gold2);
      p.ell(ox + 12, oy + 12, 3, 3, C.wood);
      p.ell(ox + 12, oy + 12, 2, 2, C.straw2);
      for (const [x, y] of [[10, 11], [11, 10], [13, 14], [14, 13]]) at(x, y, C.wood2);
      at(12, 12, C.metal); at(12, 11, '#ffffff');
      break;
    case 'riu':
      col(13, 0, 13, C.wood); col(14, 0, 13, C.wood2);
      p.rect(ox + 15, oy + 0, 2, 5, C.metal); at(17, 1, C.metal2); at(17, 2, C.metal2); at(17, 3, C.metal2);
      at(12, 1, C.metal2); at(12, 2, C.metal2); at(15, 0, '#ffffff');
      break;
    case 'tre':
      // cây tre nhổ cả gốc (Thánh Gióng)
      col(13, -5, 15, C.green); col(14, -5, 15, C.green2);
      for (const y of [-2, 2, 6, 10]) { at(13, y, C.green3); at(14, y, C.green3); }
      at(12, -5, C.leaf); at(11, -6, C.leaf); at(15, -6, C.leaf2); at(16, -7, C.leaf);
      break;
    case 'gay':
      // gậy thần có ngọc
      col(13, -1, 14, C.wood2); col(14, -1, 14, C.wood3);
      p.ell(ox + 13, oy - 3, 2, 2, C.green);
      at(12, -4, '#d6ffbf'); at(13, -3, C.green2);
      break;
    case 'quat':
      // quạt lông (nữ tướng)
      p.poly([[ox + 12, oy + 11], [ox + 17, oy + 5], [ox + 18, oy + 9]], C.white);
      at(16, 7, C.pink); at(17, 8, C.pink); col(12, 11, 13, C.wood2);
      break;
    case 'kiem':
      col(14, 2, 9, C.metal); col(15, 3, 9, C.metal2); p.h(ox + 13, ox + 16, oy + 10, C.gold2); col(14, 11, 12, C.wood3);
      break;
    case 'cheo':
      // mái chèo gỗ dựng bên người
      col(14, 0, 12, C.wood); col(15, 0, 12, C.wood2);
      p.rect(ox + 13, oy + 12, 3, 4, C.wood); col(15, 12, 15, C.wood2);
      break;
    case 'can':
      // cần câu tre cong, dây và lưỡi
      p.line(ox + 12, oy + 12, ox + 17, oy - 2, C.straw2);
      at(17, -3, C.straw3);
      col(18, -2, 6, '#cfe9f2');
      at(18, 7, C.red);
      break;
    case 'gio':
      // giỏ tre đựng cá
      p.rect(ox + 12, oy + 11, 5, 4, C.straw2);
      p.h(ox + 12, ox + 16, oy + 11, C.straw3);
      p.h(ox + 12, ox + 16, oy + 13, C.straw3);
      at(14, 10, C.blue); at(15, 10, C.blue2);
      break;
  }
}

/** Vẽ một lính/tướng quay mặt sang phải. */
export function drawUnit(look: Look): HTMLCanvasElement {
  const [c0, x0] = cnv(UW, UH);
  const p = new P(x0);
  const [cl, cl2, cl3] = look.cloth;
  const hairC = look.hair ?? [C.hair, C.hair2];
  const [sk, sk2] = look.skin ?? [C.skin, C.skin2];
  const pal: Record<string, string> = {
    r: hairC[0], R: hairC[1], h: sk, H: sk2, e: '#3d2b2b', b: C.blush,
    c: cl, C: cl2, D: cl3 ?? cl2, p: C.pants, f: C.shoe,
  };
  // áo choàng sau lưng
  if (look.cape) {
    p.poly([[OX + 4, OY + 10], [OX + 8, OY + 10], [OX + 6, OY + 16], [OX + 1, OY + 16]], look.cape);
  }
  if (look.weapon === 'cung') weapon(p, 'cung', OX, OY); // ống tên vẽ trước thân
  if (look.female) p.map(OX, OY, LONG_HAIR, pal);
  p.map(OX, OY, BODY, pal);
  if (look.belt) p.h(OX + 5, OX + 10, OY + 12, look.belt);
  // má phấn nhẹ hơn với nón che
  hat(p, look.hat, OX, OY, hairC);
  if (look.weapon !== 'cung') weapon(p, look.weapon, OX, OY);
  const o = lit(outline(c0));
  // bóng đổ vẽ sau viền để không bị viền bao
  const [c, x] = cnv(UW, UH);
  const ps = new P(x);
  if (look.aura) {
    // vòng hào quang dưới chân + vài đốm sáng quanh người
    x.fillStyle = look.aura + '88';
    for (const [dx, dy, w] of [[-7, 0, 15], [-6, 1, 13], [-6, -1, 13]]) x.fillRect(OX + 8 + dx, OY + 16 + dy, w, 1);
    x.fillStyle = look.aura;
    for (const [px, py] of [[1, 8], [18, 12], [3, 3], [17, 5]]) x.fillRect(px, py, 1, 1);
  }
  shadow(ps, OX + 8, OY + 16, 5);
  x.drawImage(o, 0, 0);
  return c;
}

// ================= binh chủng =================
export interface TroopDef {
  id: string;
  name: string;
  role: string;
  look: Look;
}

export const TROOPS: TroopDef[] = [
  { id: 'danbinh', name: 'Dân Binh Giáo', role: 'Đánh gần, rẻ, đông', look: { hat: 'nonla', weapon: 'giao', cloth: [C.brown, C.brown2] } },
  { id: 'khien', name: 'Lính Khiên Mây', role: 'Đỡ đòn hàng đầu', look: { hat: 'mu_sat', weapon: 'khien', cloth: [C.metal2, C.metal3, '#6d7685'] } },
  { id: 'cung', name: 'Cung Thủ', role: 'Bắn xa 3 ô', look: { hat: 'khan_trum', weapon: 'cung', cloth: [C.green, C.green2] } },
  { id: 'no', name: 'Nỏ Thủ', role: 'Bắn xuyên hàng', look: { hat: 'khan_ran', weapon: 'no', cloth: [C.indigo, C.indigo2] } },
  { id: 'riu', name: 'Lính Rìu', role: 'Phá khiên, phá tường', look: { hat: 'mu_da', weapon: 'riu', cloth: [C.red, C.red2] } },
  { id: 'thuy', name: 'Thủy Binh', role: 'Đánh trên thuyền, đổ bộ', look: { hat: 'khan_do', weapon: 'chia', cloth: [C.white, C.white2], belt: C.blue } },
];

/** Lính đi theo từng loại chỉ huy (đồng đội, tướng). */
export const TROOP_OF: Record<string, string> = { an: 'danbinh', ngoc: 'khien', ha: 'cung', chau: 'no', don: 'khien', thap: 'cung', giong: 'khien', sontinh: 'khien', lac: 'thuy', auco: 'cung', caolo: 'no', nuthuy: 'thuy', nghiaquan: 'riu', ngudan: 'thuy', thaylang: 'cung' };

// ================= tướng (nhân vật truyền thuyết) =================
export interface GeneralDef {
  id: string;
  name: string;
  title: string;
  skill: string;
  rarity: 'Truyền Thuyết' | 'Sử Thi' | 'Hiếm';
  look: Look;
}

export const GENERALS: GeneralDef[] = [
  { id: 'giong', name: 'Thánh Gióng', title: 'Phù Đổng Thiên Vương', skill: 'Nhổ tre quét ngang 3 ô, hất văng địch', rarity: 'Truyền Thuyết', look: { hat: 'mu_sat_den', weapon: 'tre', cloth: ['#7d8797', '#5a6372', '#4a5260'], cape: C.red , aura: '#ffd24a' } },
  { id: 'sontinh', name: 'Sơn Tinh', title: 'Thần Núi Tản Viên', skill: 'Dựng núi chắn 2 lượt, quân mình +30% thủ', rarity: 'Truyền Thuyết', look: { hat: 'mien', weapon: 'gay', cloth: [C.green2, C.green3], cape: C.leaf3 , aura: '#ffd24a' } },
  { id: 'lac', name: 'Lạc Long Quân', title: 'Vua Biển Cả', skill: 'Gọi sóng: đẩy lùi cả hàng địch, đánh trên biển +40%', rarity: 'Truyền Thuyết', look: { hat: 'mu_tuong', weapon: 'chia', cloth: [C.blue, C.blue2, C.gold2], cape: C.teal2 , aura: '#ffd24a' } },
  { id: 'auco', name: 'Âu Cơ', title: 'Mẹ Tiên', skill: 'Hồi máu cho cả đội mỗi lượt', rarity: 'Sử Thi', look: { hat: 'hoa', weapon: 'quat', cloth: [C.pink, C.pink2], female: true, cape: C.white , aura: '#c58bff' } },
  { id: 'caolo', name: 'Cao Lỗ', title: 'Thần Nỏ', skill: 'Nỏ thần bắn một phát trúng mười', rarity: 'Sử Thi', look: { hat: 'toc_bui', weapon: 'no_vang', cloth: [C.brown, C.brown2, C.gold2], cape: C.gold2 , aura: '#c58bff' } },
  { id: 'nuthuy', name: 'Nữ Tướng Hải Âu', title: 'Thủy Quân Đô Đốc', skill: 'Thuyền mình đi nhanh hơn 30%', rarity: 'Hiếm', look: { hat: 'khan_do', weapon: 'kiem', cloth: [C.white, C.blue2], female: true, cape: C.blue , aura: '#6fb7ff' } },
  { id: 'nghiaquan', name: 'Thủ Lĩnh Nghĩa Quân', title: 'Áo Vải Cờ Đào', skill: 'Đòn hiểm 140% công', rarity: 'Hiếm', look: { hat: 'khan_ran', weapon: 'giao', cloth: [C.brown, C.brown2], cape: C.red , aura: '#6fb7ff' } },
  { id: 'ngudan', name: 'Lão Ngư Mắt Bão', title: 'Người Nghe Sóng', skill: 'Cả đội tăng 25% công', rarity: 'Hiếm', look: { hat: 'nonla', weapon: 'chia', cloth: [C.indigo, C.indigo2], hair: ['#d8d2c8', '#b0a898'] , aura: '#6fb7ff' } },
  { id: 'thaylang', name: 'Thầy Lang Đảo', title: 'Nam Dược Thần Hiệu', skill: 'Hồi máu đồng đội yếu nhất', rarity: 'Hiếm', look: { hat: 'toc_bui', weapon: 'gay', cloth: [C.white, C.white2], belt: C.green2 , aura: '#6fb7ff' } },
];

// ================= nhân vật chủ đảo theo dáng vẻ đã chỉnh =================

const AV_HATS: Hat[] = ['tran', 'nonla', 'khan_ran', 'khan_van', 'mu_rom', 'bang_do'];
const AV_ITEMS: Weapon[] = ['none', 'cheo', 'can', 'gio', 'quat'];

/** Đổi dáng vẻ người chơi chọn sang kiểu chibi của bộ đồ họa mới. */
export function avatarLook(a: Avatar): Look {
  const cl = OUTFIT_COLORS[a.tc % OUTFIT_COLORS.length].c;
  const sk = SKINS[a.sk % SKINS.length].c;
  const hc = HAIR_COLORS[a.hc % HAIR_COLORS.length].c;
  const female = a.g === 1;
  // kiểu tóc: búi tó (nam) / búi cao (nữ) hiện búi khi đầu trần; nữ tóc ngắn thì không xõa
  const bun = (female ? a.ha === 2 : a.ha === 3) && a.hat === 0;
  const hat: Hat = bun ? 'toc_bui' : AV_HATS[a.hat % AV_HATS.length];
  const look: Look = {
    hat,
    weapon: AV_ITEMS[a.it % AV_ITEMS.length],
    cloth: [cl[0], cl[1]],
    hair: [hc[0], hc[1]],
    skin: [sk[0], sk[1]],
    female: female && a.ha % 5 !== 4 && !(a.ha === 2 && a.hat === 0),
  };
  // trang phục: áo ngư dân có đai nâu, áo thủy thủ sọc trắng, áo tơi lá khoác ngoài, áo dài vạt dài
  if (a.to === 2) look.belt = C.brown2;
  else if (a.to === 3) look.belt = C.white;
  else if (a.to === 4) look.cape = C.straw2;
  else if (a.to === 1) look.cloth = [cl[0], cl[1], cl[0]];
  return look;
}
