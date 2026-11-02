// Nhân vật chủ đảo: nam hoặc nữ, tự chỉnh dáng vẻ. Dùng chung cho client và server.
import { hashStr, mulberry32 } from './rng';

export interface Avatar {
  /** 0 = nam, 1 = nữ */
  g: 0 | 1;
  /** màu da */
  sk: number;
  /** kiểu tóc (danh sách riêng theo giới tính) */
  ha: number;
  /** màu tóc */
  hc: number;
  /** trang phục */
  to: number;
  /** màu áo */
  tc: number;
  /** mũ nón */
  hat: number;
  /** vật cầm tay */
  it: number;
}

export const GENDERS = ['Nam', 'Nữ'] as const;
export const SKINS = [
  { name: 'Trắng hồng', c: ['#f6cfae', '#d9a07c'] },
  { name: 'Bánh mật', c: ['#e6b086', '#b9805b'] },
  { name: 'Rám nắng', c: ['#c98b63', '#9a6343'] },
  { name: 'Nâu sẫm', c: ['#9b6646', '#6f4530'] },
] as const;
export const HAIRS: readonly (readonly string[])[] = [
  ['Tóc ngắn', 'Rẽ ngôi', 'Đầu đinh', 'Búi tó', 'Tóc bồng'],
  ['Tóc dài', 'Tóc tết', 'Búi cao', 'Đuôi ngựa', 'Tóc ngắn'],
];
export const HAIR_COLORS = [
  { name: 'Đen nhánh', c: ['#2b201d', '#120d0c'] },
  { name: 'Nâu', c: ['#6b4128', '#43271a'] },
  { name: 'Nâu đỏ', c: ['#9a3f26', '#62261a'] },
  { name: 'Hạt dẻ', c: ['#b07a3c', '#7a5024'] },
  { name: 'Muối tiêu', c: ['#c9c6c2', '#8d8a87'] },
  { name: 'Xanh rêu', c: ['#3f6b55', '#25443a'] },
] as const;
export const OUTFITS = ['Áo bà ba', 'Áo dài', 'Áo ngư dân', 'Áo thủy thủ', 'Áo tơi lá'] as const;
export const OUTFIT_COLORS = [
  { name: 'Chàm', c: ['#4566b0', '#2c4378'] },
  { name: 'Đỏ son', c: ['#dc4a3e', '#962f2b'] },
  { name: 'Trắng ngà', c: ['#f7f0e6', '#cfc6ba'] },
  { name: 'Đen tuyền', c: ['#3b3442', '#221d29'] },
  { name: 'Lá mạ', c: ['#86c95c', '#4f8a3a'] },
  { name: 'Vàng nghệ', c: ['#f2b84b', '#c07f22'] },
  { name: 'Tím Huế', c: ['#9563c9', '#5f3b8a'] },
  { name: 'Hồng sen', c: ['#ef7c98', '#b84d6a'] },
] as const;
export const HATS = ['Đầu trần', 'Nón lá', 'Khăn rằn', 'Khăn vấn', 'Mũ rơm', 'Băng đô'] as const;
export const ITEMS = ['Tay không', 'Mái chèo', 'Cần câu', 'Giỏ tre', 'Quạt mo'] as const;

export const AVATAR_LIMITS: Record<keyof Avatar, number> = {
  g: 2,
  sk: SKINS.length,
  ha: 5,
  hc: HAIR_COLORS.length,
  to: OUTFITS.length,
  tc: OUTFIT_COLORS.length,
  hat: HATS.length,
  it: ITEMS.length,
};

export const AVATAR_KEYS = Object.keys(AVATAR_LIMITS) as (keyof Avatar)[];

/** Ép mọi giá trị về khoảng hợp lệ (dữ liệu gửi lên server không được tin). */
export function cleanAvatar(raw: unknown): Avatar | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const out = {} as Record<keyof Avatar, number>;
  for (const k of AVATAR_KEYS) {
    const n = Math.floor(Number(r[k]));
    if (!Number.isFinite(n) || n < 0 || n >= AVATAR_LIMITS[k]) return null;
    out[k] = n;
  }
  return out as unknown as Avatar;
}

/** Dáng vẻ ngẫu nhiên nhưng cố định theo mã (cho đảo máy, người chưa chỉnh). */
export function avatarFrom(seed: string): Avatar {
  const r = mulberry32(hashStr(`av:${seed}`));
  const pick = (n: number) => Math.floor(r() * n);
  return {
    g: pick(2) as 0 | 1,
    sk: pick(SKINS.length),
    ha: pick(5),
    hc: r() < 0.6 ? 0 : pick(HAIR_COLORS.length),
    to: pick(OUTFITS.length),
    tc: pick(OUTFIT_COLORS.length),
    hat: r() < 0.35 ? 0 : pick(HATS.length),
    it: pick(ITEMS.length),
  };
}

export const avatarKey = (a: Avatar) => AVATAR_KEYS.map((k) => a[k]).join('');
