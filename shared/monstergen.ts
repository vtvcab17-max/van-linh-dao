// Sinh quái ngẫu nhiên theo hạt giống (tất định): khung nửa thân phản chiếu ngang, ô '?' do hạt giống quyết định.
// Cách làm học từ pixel-sprite-generator (mặt nạ + đối xứng) và claude-pxl (dải màu sáng-vừa-tối, đổi bảng màu, hạt giống).
export type Family = 'bien' | 'thu' | 'ma';
export const FAMILIES: Family[] = ['bien', 'thu', 'ma'];
export type Cell = 0 | 1 | 2 | 3 | 4; // 0 trống, 1 thân, 2 vằn/nhấn màu, 3 mắt, 4 sừng/gai

/** Nửa trái (6 cột) của khung; '.' trống, '#' thân, '?' ngẫu nhiên thân/trống, 'x' ngẫu nhiên nhấn, 'e' mắt, 'h' ngẫu nhiên sừng. */
const TEMPLATES: Record<Family, string[][]> = {
  bien: [
    ['..h...', '..?#..', '.?###.', '.#e###', '?#x###', '.#####', '.?#x##', '..?###', '.?.?#.', '?...?.'],
    ['......', '..###.', '.#####', '#e#x##', '######', '?.####', '..?x##', '.?.?##', '?..?.#', '......'],
    ['.h....', '..#?..', '.####.', '##e###', '#?#x##', '.?####', '..#x?#', '.?#?.#', '?.?...', '......'],
  ],
  thu: [
    ['.h..h.', '.####.', '.#e###', '.#####', '..####', '.#x###', '#?####', '#?.?##', '#?..?#', '##..##'],
    ['..h...', '.?##..', '.#e###', '######', '#?x###', '#?####', '..####', '.#?.##', '.#..?#', '##..##'],
    ['h.....', '.#h...', '.####.', '##e###', '######', '#?x?##', '.?####', '.#?.##', '.#..#.', '##..##'],
  ],
  ma: [
    ['..###.', '.#####', '#e#e##', '######', '#?x###', '######', '#?####', '?#?##x', '?.?#?#', '..?.?.'],
    ['...h..', '..###.', '.#####', '#e#x##', '######', '?#####', '#?#x##', '#?#?##', '?.?.?#', '......'],
    ['..h...', '.####.', '######', '#e#e##', '#?x###', '#?####', '?#?###', '?#.?##', '.?.?.#', '......'],
  ],
};

export interface MonsterSpec {
  seed: number;
  family: Family;
  /** 12 cột × 10 hàng sau khi phản chiếu */
  cells: Cell[][];
  hue: number;
  /** màu thân sáng, vừa, tối; nhấn; mắt */
  pal: { light: string; mid: string; dark: string; accent: string; eye: string };
}

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hsl(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Họ quái chọn theo hạt giống nếu không nêu. */
export function genMonster(seed: number, family?: Family): MonsterSpec {
  const r = rng(seed);
  const fam = family ?? FAMILIES[Math.floor(r() * FAMILIES.length)];
  const tpls = TEMPLATES[fam];
  const t = tpls[Math.floor(r() * tpls.length)];
  const half: Cell[][] = t.map((row) =>
    [...row].map((ch): Cell => {
      switch (ch) {
        case '#': return 1;
        case '?': return r() < 0.55 ? 1 : 0;
        case 'x': return r() < 0.6 ? 2 : 1;
        case 'e': return 3;
        case 'h': return r() < 0.7 ? 4 : 0;
        default: return 0;
      }
    }),
  );
  const cells = half.map((row) => [...row, ...[...row].reverse()] as Cell[]);
  const hue = Math.floor(r() * 360);
  const sat = 45 + Math.floor(r() * 30);
  const pal = {
    light: hsl(hue, sat, 66),
    mid: hsl(hue, sat, 50),
    dark: hsl(hue, sat + 5, 32),
    accent: hsl((hue + 150 + Math.floor(r() * 60)) % 360, 70, 60),
    eye: r() < 0.5 ? '#fff6cf' : '#ff6a4a',
  };
  return { seed, family: fam, cells, hue, pal };
}

/** Sức mạnh tương đối từ hạt giống: số ô thân càng nhiều càng khỏe (dùng khi cần chỉ số quái ngẫu nhiên). */
export function monsterPower(m: MonsterSpec): number {
  return m.cells.flat().filter((c) => c !== 0).length;
}

// ---- quái ngẫu nhiên trong trận: khóa dạng "qn:<hạt giống>", chỉ số suy ra từ hình ----
export type RandKey = `qn:${number}`;
export const randKey = (seed: number): RandKey => `qn:${seed >>> 0}`;
export const isRandKey = (k: string): k is RandKey => /^qn:\d+$/.test(k);
export const randSeed = (k: RandKey) => Number(k.slice(3));

const PRE: Record<Family, string[]> = {
  bien: ['Hải', 'Sóng', 'Triều', 'Vực'],
  thu: ['Sơn', 'Dã', 'Rừng', 'Hổ'],
  ma: ['U', 'Hồn', 'Quỷ', 'Bóng'],
};
const POST = ['Ngáo', 'Gai', 'Mắt Đỏ', 'Lạ', 'Cuồng', 'Nanh', 'Độc', 'Đá'];

export interface RandBase {
  name: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  skill: 'dot' | 'danhkep' | 'docto' | 'dapcang' | 'phandon';
  row: 'front' | 'back';
  family: Family;
}
/** Chỉ số quái ngẫu nhiên: thân càng lớn càng trâu, mức tương đương quái thường cấp thấp. */
export function randBase(k: RandKey): RandBase {
  const m = genMonster(randSeed(k));
  const power = monsterPower(m); // ~30..110
  const r = rng(randSeed(k) ^ 0x9e3779b9);
  const t = Math.max(0, Math.min(1, (power - 30) / 60));
  const name = `${PRE[m.family][Math.floor(r() * 4)]} ${POST[Math.floor(r() * POST.length)]}`;
  const base = { name, family: m.family };
  if (m.family === 'thu') return { ...base, hp: Math.round(55 + 30 * t), atk: Math.round(9 + 3 * t), def: Math.round(5 + 4 * t), spd: 11, skill: r() < 0.5 ? 'danhkep' : 'phandon', row: 'front' };
  if (m.family === 'bien') return { ...base, hp: Math.round(60 + 25 * t), atk: Math.round(8 + 3 * t), def: Math.round(6 + 4 * t), spd: 8, skill: r() < 0.5 ? 'docto' : 'dapcang', row: 'front' };
  return { ...base, hp: Math.round(50 + 20 * t), atk: Math.round(10 + 3 * t), def: Math.round(3 + 2 * t), spd: 9, skill: 'dot', row: 'back' };
}
