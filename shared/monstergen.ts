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
