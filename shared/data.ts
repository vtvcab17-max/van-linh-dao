// Dữ liệu game Vạn Linh Đảo — © Beta Holding. Mọi tên gọi là bản gốc, dựa trên truyện dân gian Việt Nam.

export const GAME = {
  name: 'Vạn Linh Đảo',
  studio: 'Beta Holding',
  version: '0.3.0',
  tagline: 'Vạn vật đều có hồn. Lắng nghe, rồi sống sót.',
};

export type ResKey = 'co' | 'la' | 'tre' | 'go' | 'cui' | 'da' | 'sat' | 'so' | 'ngoc' | 'tien' | 'lt' | 'thoc' | 'gao' | 'rau' | 'thit' | 'trung' | 'ca' | 'thaoduoc' | 'to' | 'luong' | 'duoc' | 'vai';
export const RES_KEYS: ResKey[] = ['co', 'la', 'tre', 'go', 'cui', 'da', 'sat', 'so', 'ngoc', 'tien', 'lt', 'thoc', 'gao', 'rau', 'thit', 'trung', 'ca', 'thaoduoc', 'to', 'luong', 'duoc', 'vai'];
export const FEEDABLE: ResKey[] = ['co', 'la', 'tre', 'go', 'cui', 'da', 'sat'];
export const RES: Record<ResKey, { name: string; capped: boolean }> = {
  co: { name: 'Cỏ tranh', capped: true },
  la: { name: 'Lá dừa', capped: true },
  tre: { name: 'Tre', capped: true },
  go: { name: 'Gỗ', capped: true },
  cui: { name: 'Củi', capped: true },
  da: { name: 'Đá', capped: true },
  sat: { name: 'Sắt vụn', capped: true },
  so: { name: 'Vỏ Sò', capped: false },
  ngoc: { name: 'Ngọc Trai', capped: false },
  tien: { name: 'Đồng vàng', capped: false },
  lt: { name: 'Linh Thạch', capped: false },
  thoc: { name: 'Thóc', capped: true },
  gao: { name: 'Gạo', capped: true },
  rau: { name: 'Rau', capped: true },
  thit: { name: 'Thịt', capped: true },
  trung: { name: 'Trứng', capped: true },
  ca: { name: 'Cá', capped: true },
  thaoduoc: { name: 'Thảo dược', capped: true },
  to: { name: 'Tơ tằm', capped: true },
  luong: { name: 'Lương khô', capped: true },
  duoc: { name: 'Thuốc men', capped: true },
  vai: { name: 'Vải buồm', capped: true },
};

export type NodeKind = 'grass' | 'palm' | 'bamboo' | 'rock' | 'scrap' | 'drift';
export const NODES: Record<NodeKind, { name: string; yields: Partial<Record<ResKey, number>>; regrowMs: number; weight: number }> = {
  grass: { name: 'Bụi cỏ tranh', yields: { co: 3 }, regrowMs: 40_000, weight: 30 },
  palm: { name: 'Cây dừa', yields: { la: 2, go: 5 }, regrowMs: 80_000, weight: 22 },
  bamboo: { name: 'Bụi tre', yields: { tre: 4 }, regrowMs: 70_000, weight: 22 },
  rock: { name: 'Mỏm đá', yields: { da: 6 }, regrowMs: 100_000, weight: 14 },
  scrap: { name: 'Đống sắt vụn', yields: { sat: 2 }, regrowMs: 120_000, weight: 9 },
  drift: { name: 'Gỗ trôi dạt', yields: { cui: 4 }, regrowMs: 55_000, weight: 0 },
};

export type LvKey = 'leu' | 'cuoc' | 'rao' | 'thuyen';
export const LV_KEYS: LvKey[] = ['leu', 'cuoc', 'rao', 'thuyen'];
/** Linh vật đứng trên đất (thuyền nằm dưới nước ở bến). */
export const LAND_LV: LvKey[] = ['leu', 'cuoc', 'rao'];

export interface LinhVatDef {
  role: string;
  tiers: [string, string, string, string, string];
  likes: Partial<Record<ResKey, number>>;
  voice: { idle: string[]; hungry: string[]; happy: string[]; sulky: string[]; evolve: string[] };
}

export const TIER_NAMES = ['Thức Tỉnh', 'Có Hồn', 'Thành Linh', 'Thành Tinh', 'Thành Thần'];
/** Linh khí cần để lên bậc tiếp theo (bậc 1→2, 2→3, 3→4, 4→5). */
/** Linh khí cần để lên bậc 2, 3, 4, 5 (đã cân bằng bằng mô phỏng: bậc 4 ~ngày 8, bậc 5 ~ngày 30). */
export const XP_TO_NEXT = [50, 600, 40_000, 120_000];
/** Thời gian xây khi tiến hóa lên bậc 2, 3, 4, 5 — bậc càng cao xây càng lâu. */
export const BUILD_MS = [60_000, 30 * 60_000, 3 * 3600_000, 12 * 3600_000];
/** Mỗi công trình nặng nhẹ khác nhau: nhà chính lâu nhất. */
export const BUILD_FACTOR: Record<LvKey, number> = { leu: 1, cuoc: 0.7, rao: 0.8, thuyen: 0.9 };

/** Chi phí thêm khi tiến hóa (ngoài linh khí). */
export const EVOLVE_COST: Partial<Record<ResKey, number>>[] = [
  { so: 15 },
  { so: 80, go: 40 },
  { so: 300, go: 150, da: 120 },
  { so: 1000, go: 400, da: 300, ngoc: 8 },
];

export const LINH_VAT: Record<LvKey, LinhVatDef> = {
  leu: {
    role: 'Nhà chính: kho, đất, hòm, đồng đội',
    tiers: ['Túp Lều Lá', 'Nhà Tranh Vách Đất', 'Nhà Sàn Tre', 'Nhà Rường Gỗ Lim', 'Loa Thành Chín Vòng'],
    likes: { co: 1, la: 1.3 },
    voice: {
      idle: [
        'Gió biển lùa qua vách, bà lạnh lưng quá cháu ơi.',
        'Cháu ngủ có ngon không? Bà che mưa cho cháu cả đêm đó.',
        'Bà từng chỉ là một đống lá vô tri. Giờ bà có hồn rồi, nhờ cháu.',
        'Ngoài kia biển rộng lắm. Nhưng nhà thì chỉ có một.',
      ],
      hungry: [
        'Bụng bà réo rồi... mùi cỏ tranh mới cắt thơm biết mấy.',
        'Lá dừa tươi! Bà thèm lá dừa tươi lắm cháu ơi!',
        'Vách bà mỏng đi rồi, cháu có thấy không?',
      ],
      happy: ['Ngon quá! Bà thấy vách mình dày thêm một lớp.', 'Ừ, bà no rồi. Để bà giữ ấm cho cháu.', 'Thơm mùi đồng nội ghê!'],
      sulky: ['Cái gì đây? Bà là nhà chứ có phải lò rèn đâu!', 'Bà không ăn thứ này. Bà dỗi đó.'],
      evolve: [
        '',
        'Vách đất! Bà đứng vững hơn rồi.',
        'Lên nhà sàn, nước có dâng bà cũng chẳng sợ.',
        'Gỗ lim nghìn năm. Bà thấy mình sang quá.',
        'Chín vòng thành ốc. Từ nay không ai bước qua cửa nhà cháu được nữa.',
      ],
    },
  },
  cuoc: {
    role: 'Khai thác nhanh hơn, khai hoang rẻ hơn, chủ đảo đánh mạnh hơn',
    tiers: ['Cuốc Rỉ', 'Cuốc Sắt', 'Cuốc Thép Ròng', 'Cuốc Phá Đá', 'Cuốc Dời Non'],
    likes: { sat: 2.5, da: 0.6 },
    voice: {
      idle: [
        'Ta từng dời cả một dãy núi. Giờ lại đi xới cát. Hừ.',
        'Nhóc có biết ta là ai không? Ta là cuốc của Sơn Tinh đấy.',
        'Thủy Tinh... ta vẫn nhớ mùi tanh của hắn.',
        'Đất này mềm quá. Ta nhớ đá núi Tản Viên.',
      ],
      hungry: ['Sắt! Cho ta sắt! Lưỡi ta mòn hết rồi.', 'Đinh rỉ cũng được, ta không kén... à mà có kén.', 'Đá mài lưỡi cũng tạm, nhưng sắt mới là món chính.'],
      happy: ['Khà! Sắt ngon. Lưỡi ta sắc lại rồi.', 'Được lắm nhóc. Đào đâu ta cũng đào.', 'Lâu lắm rồi mới được ăn một bữa ra hồn.'],
      sulky: ['Ngươi cho ta ăn cái gì thế? Ta là cuốc, không phải trâu!', 'Ta dỗi. Hôm nay ta đào chậm.'],
      evolve: [
        '',
        'Sắt mới! Ta nhớ lại cảm giác ngày xưa.',
        'Thép ròng. Đá cũng phải nể ta.',
        'Phá đá như bẻ bánh đa.',
        'Ta đã về lại hình dạng xưa. Cuốc Dời Non. Núi nào cũng phải dời.',
      ],
    },
  },
  rao: {
    role: 'Phòng thủ: đứng chắn trong trận khi bị đột kích',
    tiers: ['Hàng Rào Tre', 'Rào Tre Gai', 'Lũy Tre Làng', 'Lũy Tre Ba Lớp', 'Lũy Tre Ngàn Năm'],
    likes: { tre: 1, cui: 0.7 },
    voice: {
      idle: [
        'Báo cáo chủ đảo: không có gì bất thường.',
        'Tre già măng mọc. Tôi còn đứng đây thì đảo còn đây.',
        'Đêm qua có con cua lén bò qua. Tôi đã... nhìn nó rất dữ.',
        'Báo cáo: gió mùa đông bắc sắp về.',
      ],
      hungry: ['Báo cáo: thân tôi khô rồi, xin thêm tre!', 'Củi cũng được chủ đảo ơi, miễn là gỗ.'],
      happy: ['Rõ! Tôi cứng cáp thêm rồi!', 'Cảm ơn chủ đảo. Cả lũy xin hứa đứng vững.'],
      sulky: ['Báo cáo... tôi không tiêu hóa được thứ này.', 'Tôi giận. Nhưng tôi vẫn gác. Vì tôi là rào.'],
      evolve: [
        '',
        'Gai mọc rồi! Đứa nào leo vào thì biết tay.',
        'Lũy tre làng! Nghe quen như tiếng gà gáy sớm.',
        'Ba lớp tre. Ba lớp lòng trung thành.',
        'Lũy Tre Ngàn Năm. Sóng Thủy Tinh cũng phải dừng ở đây.',
      ],
    },
  },
  thuyen: {
    role: 'Đi biển: thuyền càng lớn càng đi nhanh, ra trận và đột kích xa hơn',
    tiers: ['Thuyền Thúng', 'Ghe Nan', 'Ghe Bầu', 'Thuyền Buồm Nâu', 'Thuyền Rồng Lạc Hồng'],
    likes: { tre: 1, go: 1.2 },
    voice: {
      idle: [
        'Biển hôm nay êm, chủ đảo có ra khơi không?',
        'Tui tròn vo vậy chứ chở được cả gánh hàng.',
        'Sóng vỗ mạn tui nghe như ru.',
        'Ngoài kia có Bãi Cua, cua nhiều lắm đó.',
      ],
      hungry: ['Nan tre của tui bung rồi, cho tui ít tre vá lại đi.', 'Gỗ! Có gỗ tui đóng thêm mạn.'],
      happy: ['Kín nước rồi! Đi đâu tui chở đi.', 'Ngon lành, mái chèo nhẹ hẳn.'],
      sulky: ['Cái này mà vá thuyền là chìm đó chủ đảo ơi!', 'Tui dỗi, hôm nay tui trôi chậm.'],
      evolve: [
        '',
        'Ghe nan! Tui dài ra rồi, chở được nhiều hơn.',
        'Ghe bầu vượt sóng, xa mấy cũng tới.',
        'Có buồm nâu rồi, gió đẩy tui đi băng băng.',
        'Thuyền Rồng Lạc Hồng. Biển nào cũng là nhà.',
      ],
    },
  },
};

/** Hiệu ứng theo bậc (chỉ số 0 = bậc 1). */
export const EFFECTS = {
  storageCap: [150, 400, 1000, 2500, 6000],
  landCap: [60, 84, 112, 144, 180],
  protect: [40, 120, 300, 700, 1500],
  chestSlots: [2, 3, 3, 4, 5],
  gatherMult: [1, 1.3, 1.7, 2.2, 3],
  expandDiscount: [0, 0.1, 0.2, 0.3, 0.4],
  anAtkBonus: [0, 4, 10, 18, 30],
  wallHp: [60, 160, 380, 800, 1600],
  wallThorns: [0, 0.1, 0.18, 0.25, 0.35],
  /** Số giây đi hết một ô hải đồ, theo bậc thuyền. */
  sailSecPerCell: [15, 12, 9, 7, 5],
};

export type CompKey = 'an' | 'ngoc' | 'ha' | 'chau';
export const COMP_KEYS: CompKey[] = ['an', 'ngoc', 'ha', 'chau'];
export interface UnitBase {
  name: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  skill: SkillKey;
  row: 'front' | 'back';
}
export type SkillKey =
  | 'thinhhon'
  | 'thietcot'
  | 'lalanh'
  | 'samset'
  | 'phandon'
  | 'dot'
  | 'danhkep'
  | 'docto'
  | 'dapcang'
  | 'chan'
  | 'cuoploi';

export const COMPANIONS: Record<CompKey, UnitBase & { title: string; unlock: string; bio: string }> = {
  an: { name: 'Chủ Đảo', title: 'Người nghe tiếng lòng', hp: 95, atk: 12, def: 6, spd: 10, skill: 'thinhhon', row: 'front', unlock: 'Có sẵn', bio: 'Chính là bạn: nghe được tiếng lòng của vạn vật, đánh nhau bằng cái cuốc của Sơn Tinh.' },
  ngoc: { name: 'Lâm Bảo Ngọc', title: 'Võ sư Bình Định', hp: 150, atk: 9, def: 12, spd: 7, skill: 'thietcot', row: 'front', unlock: 'Có sẵn', bio: 'Thiết Cốt: da cứng như sắt, đứng ra chịu đòn thay đồng đội.' },
  ha: { name: 'Đặng Thu Hà', title: 'Dược sĩ trạm xá', hp: 80, atk: 7, def: 5, spd: 9, skill: 'lalanh', row: 'back', unlock: 'Nhà chính lên bậc 2', bio: 'Lá Lành: hồi máu bằng thuốc nam.' },
  chau: { name: 'Hồ Minh Châu', title: 'Sinh viên Bách Khoa', hp: 75, atk: 15, def: 4, spd: 11, skill: 'samset', row: 'back', unlock: 'Cuốc lên bậc 2', bio: 'Sấm Sét: phóng tia sét đánh dây chuyền.' },
};

export const SKILLS: Record<SkillKey, { name: string; desc: string }> = {
  thinhhon: { name: 'Thính Hồn', desc: 'Cả đội tăng 25% công trong 2 lượt' },
  thietcot: { name: 'Thiết Cốt', desc: 'Kéo đòn về mình, thủ x1.6 trong 2 lượt' },
  lalanh: { name: 'Lá Lành', desc: 'Hồi 28% máu cho đồng đội yếu nhất, giải độc' },
  samset: { name: 'Sấm Sét', desc: 'Đánh 2 kẻ địch, mỗi đòn 115% công' },
  phandon: { name: 'Mai Gai', desc: 'Phản lại 20% sát thương nhận vào' },
  dot: { name: 'Xúc Tu Lửa', desc: 'Đốt cháy, mất 6% máu mỗi lượt trong 2 lượt' },
  danhkep: { name: 'Vồ Kép', desc: 'Đánh liền 2 đòn, mỗi đòn 70% công' },
  docto: { name: 'Gai Độc', desc: 'Gây độc, mất 5% máu mỗi lượt trong 3 lượt' },
  dapcang: { name: 'Đập Càng', desc: 'Đánh cả đội địch, 65% công' },
  chan: { name: 'Lũy Chắn', desc: 'Đứng chắn, phản gai theo bậc' },
  cuoploi: { name: 'Cướp Lời', desc: 'Đòn hiểm, 140% công' },
};

import { isRandKey, randBase, type RandKey } from './monstergen';
export type MonsterKey = 'cuagai' | 'sualua' | 'khida' | 'canoc' | 'cuada' | 'haitac' | 'baytheo';
export const MONSTERS: Record<MonsterKey, UnitBase> = {
  cuagai: { name: 'Cua Gai', hp: 70, atk: 8, def: 10, spd: 5, skill: 'phandon', row: 'front' },
  sualua: { name: 'Sứa Lửa', hp: 55, atk: 9, def: 3, spd: 8, skill: 'dot', row: 'back' },
  khida: { name: 'Khỉ Đá', hp: 65, atk: 10, def: 5, spd: 13, skill: 'danhkep', row: 'front' },
  canoc: { name: 'Cá Nóc Độc', hp: 60, atk: 8, def: 6, spd: 9, skill: 'docto', row: 'back' },
  cuada: { name: 'Cua Đá Khổng Lồ', hp: 340, atk: 16, def: 14, spd: 6, skill: 'dapcang', row: 'front' },
  haitac: { name: 'Hải tặc Cờ Đen', hp: 90, atk: 12, def: 7, spd: 10, skill: 'cuoploi', row: 'front' },
  baytheo: { name: 'Bảy Thẹo', hp: 260, atk: 20, def: 12, spd: 12, skill: 'cuoploi', row: 'front' },
};

export type EnemyKey = MonsterKey | RandKey;
/** Chỉ số của quái thường hoặc quái ngẫu nhiên. */
export function enemyBase(k: EnemyKey): UnitBase {
  if (isRandKey(k)) {
    const b = randBase(k);
    return { name: b.name, hp: b.hp, atk: b.atk, def: b.def, spd: b.spd, skill: b.skill, row: b.row };
  }
  return MONSTERS[k];
}

export interface WildDef {
  id: string;
  name: string;
  level: number;
  enemies: [EnemyKey, number][];
  loot: Partial<Record<ResKey, number>>;
  chest?: number; // chỉ số phẩm hòm thưởng thêm
  chestChance?: number; // xác suất rơi hòm khi thắng
  respawnMs: number;
  sx: number; // toạ độ trên hải đồ (ô)
  sy: number;
}
export const WILDS: WildDef[] = [
  { id: 'baicua', name: 'Bãi Cua', level: 1, enemies: [['cuagai', 1], ['cuagai', 1]], loot: { sat: 6, da: 4, so: 5 }, respawnMs: 6 * 60_000, sx: 14, sy: 9 },
  { id: 'ransua', name: 'Rạn Sứa', level: 2, enemies: [['cuagai', 2], ['sualua', 2], ['sualua', 2]], loot: { sat: 8, la: 8, so: 8 }, respawnMs: 9 * 60_000, sx: 25, sy: 7 },
  { id: 'daokhi', name: 'Đảo Khỉ', level: 3, enemies: [['khida', 3], ['khida', 3], ['canoc', 3]], loot: { go: 12, tre: 10, so: 12 }, chest: 1, chestChance: 0.3, respawnMs: 12 * 60_000, sx: 9, sy: 15 },
  { id: 'vinhcanoc', name: 'Vịnh Cá Nóc', level: 5, enemies: [['cuagai', 5], ['canoc', 5], ['canoc', 5], ['sualua', 5]], loot: { sat: 16, da: 14, so: 20 }, chest: 2, chestChance: 0.3, respawnMs: 18 * 60_000, sx: 29, sy: 14 },
  { id: 'hangcuada', name: 'Hang Cua Đá', level: 7, enemies: [['cuada', 7], ['cuagai', 6], ['sualua', 6]], loot: { sat: 28, so: 35, ngoc: 1 }, chest: 3, chestChance: 0.35, respawnMs: 25 * 60_000, sx: 19, sy: 19 },
  { id: 'trailhaitac', name: 'Trại Cờ Đen', level: 10, enemies: [['baytheo', 10], ['haitac', 9], ['haitac', 9], ['khida', 9]], loot: { so: 80, ngoc: 2, go: 40 }, chest: 4, chestChance: 0.4, respawnMs: 40 * 60_000, sx: 34, sy: 4 },
];

export interface ChestDef {
  key: string;
  name: string;
  rarity: string;
  color: string;
  weight: number;
  rolls: number;
  amount: [number, number];
  so: [number, number];
  ngoc: number;
}
export const CHESTS: ChestDef[] = [
  { key: 'moc', name: 'Hòm Gỗ Mục', rarity: 'Thường', color: '#e9e4d6', weight: 600, rolls: 2, amount: [5, 10], so: [3, 8], ngoc: 0 },
  { key: 'lim', name: 'Hòm Gỗ Lim', rarity: 'Tốt', color: '#62b356', weight: 250, rolls: 2, amount: [10, 18], so: [8, 16], ngoc: 0 },
  { key: 'dong', name: 'Hòm Đồng', rarity: 'Hiếm', color: '#4f90da', weight: 160, rolls: 3, amount: [16, 28], so: [15, 30], ngoc: 0 },
  { key: 'bac', name: 'Hòm Bạc Chạm', rarity: 'Quý', color: '#a273d8', weight: 80, rolls: 3, amount: [28, 45], so: [30, 60], ngoc: 1 },
  { key: 'sonmai', name: 'Hòm Sơn Mài', rarity: 'Huyền Thoại', color: '#ec8d3c', weight: 20, rolls: 4, amount: [45, 80], so: [60, 120], ngoc: 2 },
  { key: 'rong', name: 'Hòm Rồng Vàng', rarity: 'Thần Thoại', color: '#de4a3f', weight: 3, rolls: 5, amount: [80, 140], so: [150, 260], ngoc: 5 },
];
export const CHEST_INTERVAL_MS = 300_000;

export const TITLES: [number, string][] = [
  [0, 'Kẻ Lưu Lạc'],
  [80, 'Chủ Đảo'],
  [200, 'Hào Trưởng'],
  [450, 'Đô Đốc'],
  [900, 'Vua Vạn Đảo'],
];

export const HUNGER_PER_MIN = 0.35; // 0→100 trong khoảng 4,7 giờ
export const MOOD_HAPPY_MS = 8 * 60_000;
export const MOOD_SULKY_MS = 2 * 60_000;
export const FEED_PORTION = 5;

export const GRID = 24; // đảo nằm trên lưới 24x24 ô
export const RAID_COOLDOWN_MS = 10 * 60_000;
export const RAID_SHARE = 0.15;
/** Toạ độ đảo nhà trên hải đồ (ô). */
export const HOME_CELL = { x: 20, y: 12 };

export interface QuestDef {
  id: string;
  text: string;
  reward: Partial<Record<ResKey, number>>;
}
export const QUESTS: QuestDef[] = [
  { id: 'q_gather', text: 'Chạm bụi cỏ tranh để nhặt cỏ.', reward: { so: 5 } },
  { id: 'q_listen', text: 'Chạm Túp Lều Lá để nghe tiếng lòng của bà.', reward: { co: 6 } },
  { id: 'q_feed', text: 'Cho Túp Lều Lá ăn đúng món bà thích.', reward: { so: 8 } },
  { id: 'q_cuoc', text: 'Nhặt sắt vụn rồi cho Cuốc Rỉ ăn.', reward: { sat: 6 } },
  { id: 'q_chest', text: 'Mở một hòm trôi dạt ở bờ biển.', reward: { so: 10 } },
  { id: 'q_expand', text: 'Khai hoang một ô biển sát đảo.', reward: { da: 8, tre: 8 } },
  { id: 'q_fight', text: 'Lên thuyền ra Bãi Cua và đánh thắng.', reward: { so: 15 } },
  { id: 'q_evolve', text: 'Tiến hóa một linh vật lên bậc 2.', reward: { so: 20, go: 10 } },
  { id: 'q_boat', text: 'Cho Thuyền Thúng ăn tre để vá nan.', reward: { tre: 10 } },
  { id: 'q_raid', text: 'Chèo thuyền đi đột kích đảo của người khác.', reward: { so: 25 } },
];

export const INTRO = [
  'Đêm rằm tháng Bảy, trăng đỏ như máu.',
  'Thủy Tinh mở Vạn Đảo và kéo cả loài người xuống biển.',
  'Bạn tỉnh dậy trên một mỏm đảo nhỏ, tay vẫn cầm cái cuốc rỉ đang sửa dở.',
  'Rồi cái cuốc cất tiếng nói.',
];

export const RUA_VANG = 'Rùa Vàng';
