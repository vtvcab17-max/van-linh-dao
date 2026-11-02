// Mỗi hòn đảo một dáng riêng: kiểu đất (biome), đường bờ, hoa cỏ, đá, san hô đều sinh từ mã đảo.
import { GRID } from '../../../shared/data';
import { hashStr, mulberry32 } from '../../../shared/rng';
import { canvas, noise, Pen, type Canvas } from './pixel';

export interface Look {
  name: string;
  grass: [string, string, string, string]; // nền, đậm, sáng, mảng khô
  sand: [string, string, string]; // nền, đậm, sáng
  shallow: string;
  flowers: string[];
  flowerRate: number;
  rockRate: number;
  shellRate: number;
  coralRate: number;
  soil?: string;
}

export const LOOKS: Look[] = [
  { name: 'Đảo Dừa Xanh', grass: ['#86c95c', '#57a043', '#a6d86e', '#e8c56e'], sand: ['#f2d99c', '#d6b26d', '#fbf3dc'], shallow: '#5fb6d6', flowers: ['#f6d34d', '#fbf3dc'], flowerRate: 0.05, rockRate: 0.04, shellRate: 0.12, coralRate: 0.03 },
  { name: 'Đảo Cát Trắng', grass: ['#9ad66a', '#5fae4a', '#c3ea85', '#f0e2a0'], sand: ['#fbf6e6', '#e2d7bb', '#ffffff'], shallow: '#62d0e0', flowers: ['#ef7c98', '#fbf3dc'], flowerRate: 0.04, rockRate: 0.02, shellRate: 0.25, coralRate: 0.05 },
  { name: 'Đảo Đất Đỏ', grass: ['#6fb04f', '#3f7f39', '#8fca62', '#b8613a'], sand: ['#e8c48a', '#c9995c', '#f4dcae'], shallow: '#4fa8cc', flowers: ['#f6d34d'], flowerRate: 0.03, rockRate: 0.05, shellRate: 0.06, coralRate: 0.02, soil: '#b8613a' },
  { name: 'Đảo Đá Xám', grass: ['#8aa860', '#5d7d45', '#a9c27a', '#9aa0a8'], sand: ['#d8cfb8', '#b2a88f', '#ece6d4'], shallow: '#4f9cc0', flowers: ['#dbe3ea'], flowerRate: 0.02, rockRate: 0.22, shellRate: 0.05, coralRate: 0.01 },
  { name: 'Đảo Hoa Dại', grass: ['#7cc45a', '#4f9a48', '#a6d86e', '#d6e88a'], sand: ['#f2d99c', '#d6b26d', '#fbf3dc'], shallow: '#5fb6d6', flowers: ['#ef7c98', '#f6d34d', '#9563c9', '#fbf3dc', '#ec9640'], flowerRate: 0.3, rockRate: 0.02, shellRate: 0.08, coralRate: 0.02 },
  { name: 'Đảo San Hô', grass: ['#86c95c', '#57a043', '#b5e07c', '#f2d99c'], sand: ['#f6d8c8', '#dcb3a0', '#fff0e6'], shallow: '#58c4d8', flowers: ['#ef7c98'], flowerRate: 0.04, rockRate: 0.02, shellRate: 0.2, coralRate: 0.22 },
  { name: 'Đảo Lá Vàng', grass: ['#c9b85a', '#9a8a3a', '#e0d27a', '#d98a3a'], sand: ['#f2d99c', '#d6b26d', '#fbf3dc'], shallow: '#5fb6d6', flowers: ['#dc4a3e', '#ec9640'], flowerRate: 0.08, rockRate: 0.04, shellRate: 0.08, coralRate: 0.03 },
  { name: 'Đảo Rêu Ngọc', grass: ['#5fae86', '#3a7d63', '#86cfa4', '#a6d86e'], sand: ['#e6d9a8', '#c4b37a', '#f3ead0'], shallow: '#4fbcc0', flowers: ['#5fd0e0', '#fbf3dc'], flowerRate: 0.06, rockRate: 0.06, shellRate: 0.06, coralRate: 0.06 },
];

/** Kiểu đất của đảo theo mã đảo. */
export function lookOf(seed: number): Look {
  return LOOKS[seed % LOOKS.length];
}

function rgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

/** Nhiễu mượt (nội suy) để bờ biển, mảng cỏ uốn lượn tự nhiên. */
function smooth(x: number, y: number, seed: number, scale: number): number {
  const fx = x / scale,
    fy = y / scale;
  const x0 = Math.floor(fx),
    y0 = Math.floor(fy);
  const tx = fx - x0,
    ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx),
    sy = ty * ty * (3 - 2 * ty);
  const a = noise(x0, y0, seed),
    b = noise(x0 + 1, y0, seed),
    c = noise(x0, y0 + 1, seed),
    d = noise(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Vẽ toàn bộ hòn đảo vào một canvas (1 lệnh vẽ duy nhất trong game → rất nhẹ). */
export function drawIsland(land: string, seed: number): Canvas {
  const T = 16;
  const Wd = GRID * T;
  const look = lookOf(seed);
  const r = mulberry32(hashStr(`look:${seed}`));
  const beach = 2.6 + r() * 2.4; // bờ cát rộng hẹp tùy đảo
  const wobble = 1 + r() * 2.2; // bờ biển gồ ghề
  const [c, ctx] = canvas(Wd, Wd);
  const L = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID && y < GRID && land[y * GRID + x] === '1';
  const img = ctx.createImageData(Wd, Wd);
  const put = (x: number, y: number, hex: string, a = 255) => {
    if (x < 0 || y < 0 || x >= Wd || y >= Wd) return;
    const i = (y * Wd + x) * 4;
    const [cr, cg, cb] = rgb(hex);
    img.data[i] = cr;
    img.data[i + 1] = cg;
    img.data[i + 2] = cb;
    img.data[i + 3] = a;
  };
  const dist = new Float32Array(Wd * Wd);
  for (let py = 0; py < Wd; py++)
    for (let px = 0; px < Wd; px++) {
      const tx = Math.floor(px / T),
        ty = Math.floor(py / T);
      const land0 = L(tx, ty);
      let dMin = 99;
      for (let oy = -1; oy <= 1; oy++)
        for (let ox = -1; ox <= 1; ox++) {
          const nx = tx + ox,
            ny = ty + oy;
          if (L(nx, ny) === land0) continue;
          const cx = Math.max(nx * T, Math.min(px + 0.5, nx * T + T));
          const cy = Math.max(ny * T, Math.min(py + 0.5, ny * T + T));
          const d = Math.hypot(px + 0.5 - cx, py + 0.5 - cy);
          if (d < dMin) dMin = d;
        }
      // bờ uốn lượn: đẩy mép đất vào/ra theo nhiễu mượt
      const wob = (smooth(px, py, seed, 7) - 0.5) * wobble * 2;
      const sd = land0 ? dMin + wob : -dMin + wob; // >0: đất
      dist[py * Wd + px] = sd;
      const n = noise(px, py, seed);
      if (sd > 0) {
        if (sd < 1.2) put(px, py, look.sand[1]);
        else if (sd < beach) put(px, py, n < 0.08 ? look.sand[2] : n < 0.2 ? look.sand[1] : look.sand[0]);
        else if (sd < beach + 1) put(px, py, look.grass[1]);
        else {
          const patch = smooth(px, py, seed + 7, 11);
          let col = patch > 0.66 ? look.grass[2] : patch < 0.3 ? look.grass[1] : look.grass[0];
          if (look.soil && smooth(px, py, seed + 3, 9) > 0.72) col = look.soil;
          else if (n < 0.05) col = look.grass[2];
          else if (n > 0.97) col = look.grass[3];
          put(px, py, col);
        }
      } else {
        const dw = -sd;
        if (dw < 1.3) put(px, py, '#e9f8fb', 235);
        else if (dw < 6) put(px, py, n < 0.08 ? '#a8e6f0' : look.shallow, 200);
        else if (dw < 9) put(px, py, '#3a90c2', 90);
      }
    }
  // trang trí theo từng ô: cụm hoa, vỏ sò, đá, san hô
  const dec = mulberry32(hashStr(`decor:${seed}`));
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < Wd && y < Wd ? dist[y * Wd + x] : -99);
  for (let i = 0; i < 1400; i++) {
    const x = Math.floor(dec() * Wd),
      y = Math.floor(dec() * Wd);
    const sd = at(x, y);
    const roll = dec();
    if (sd > beach + 2.5) {
      if (roll < look.flowerRate) {
        const col = look.flowers[Math.floor(dec() * look.flowers.length)];
        for (const [dx, dy] of [[0, 0], [2, 1], [-1, 2], [1, -2]]) if (dec() < 0.75 && at(x + dx, y + dy) > beach + 1) put(x + dx, y + dy, col);
      } else if (roll < look.flowerRate + look.rockRate * 0.4) {
        put(x, y, '#9aa0a8');
        put(x + 1, y, '#7b7e88');
        put(x, y + 1, '#7b7e88');
      }
    } else if (sd > 1.5 && sd < beach) {
      if (roll < look.shellRate) put(x, y, dec() < 0.5 ? '#fbf3dc' : '#ef9fae');
      else if (roll < look.shellRate + look.rockRate) {
        put(x, y, '#b2b5bd');
        put(x + 1, y, '#7b7e88');
      }
    } else if (sd < -2 && sd > -6) {
      if (roll < look.coralRate) {
        const col = dec() < 0.5 ? '#ef7c98' : '#ec9640';
        put(x, y, col, 220);
        put(x + 1, y + 1, col, 200);
      } else if (roll < look.coralRate + look.rockRate * 0.5) {
        put(x, y, '#7b7e88');
        put(x + 1, y, '#4c4e58');
        put(x, y - 1, '#e9f8fb', 200);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ======================= ĐẢO TRÊN HẢI ĐỒ =======================
export type MiniKind = 'me' | 'player' | 'bot' | 'wild';

/** Bán kính đảo trên hải đồ theo số ô đất. */
export function miniRadius(land: number) {
  return Math.round(Math.max(6, Math.min(14, 6 + (land - 16) / 12)));
}

export const MINI_SIZE = 44;

/** Hình đảo nhìn từ xa: đường bờ sinh từ mã đảo (sóng hài ngẫu nhiên) nên không đảo nào giống đảo nào. */
export function drawSeaIsland(id: string, land: number, kind: MiniKind, tier = 1): Canvas {
  const S = MINI_SIZE;
  const [c, ctx] = canvas(S, S);
  const p = new Pen(ctx);
  const seed = hashStr(id);
  const look = lookOf(seed);
  const r = mulberry32(hashStr(`mini:${id}`));
  const R = miniRadius(land);
  const harm = [1, 2, 3, 4, 5].map((k) => ({ k, a: (r() * 0.5 + 0.1) / k ** 0.7, ph: r() * Math.PI * 2 }));
  // vịnh: một số đảo có một vũng lõm vào
  const bay = id === 'vinhcanoc' ? { ang: 0.6, d: 0.55 } : r() < 0.3 ? { ang: r() * Math.PI * 2, d: 0.25 + r() * 0.25 } : null;
  const cx = S / 2,
    cy = S / 2 + 2;
  const radiusAt = (th: number) => {
    let k = 1;
    for (const h of harm) k += h.a * 0.35 * Math.sin(h.k * th + h.ph);
    if (bay) k -= bay.d * Math.exp(-((Math.atan2(Math.sin(th - bay.ang), Math.cos(th - bay.ang)) / 0.45) ** 2));
    return R * Math.max(0.45, k);
  };
  const img = ctx.createImageData(S, S);
  const put = (x: number, y: number, hex: string, a = 255) => {
    const i = (y * S + x) * 4;
    const [cr, cg, cb] = rgb(hex);
    img.data[i] = cr;
    img.data[i + 1] = cg;
    img.data[i + 2] = cb;
    img.data[i + 3] = a;
  };
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - cx,
        dy = (y + 0.5 - cy) / 0.78;
      const d = Math.hypot(dx, dy);
      const rr = radiusAt(Math.atan2(dy, dx));
      const t = d / rr;
      const n = noise(x, y, seed);
      if (t < 0.6) put(x, y, n < 0.12 ? look.grass[2] : t > 0.5 ? look.grass[1] : look.grass[0]);
      else if (t < 0.72) put(x, y, look.grass[1]);
      else if (t < 1) put(x, y, n < 0.15 ? look.sand[2] : look.sand[0]);
      else if (t < 1.12) put(x, y, '#e9f8fb', 230);
      else if (t < 1.4) put(x, y, look.shallow, 170);
    }
  ctx.putImageData(img, 0, 0);
  // cây cối, đá rải theo mã đảo
  const trees = 2 + Math.floor(r() * 3) + Math.floor(R / 5);
  for (let i = 0; i < trees; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * 0.5;
    const x = Math.round(cx + Math.cos(a) * d * R);
    const y = Math.round(cy + Math.sin(a) * d * R * 0.78);
    if (kind === 'wild' && id === 'hangcuada') continue;
    p.px(x, y + 1, 'T');
    p.rect(x - 1, y - 1, 3, 2, look.grass[1]);
    p.px(x, y - 2, look.grass[2]);
  }
  for (let i = 0; i < 3; i++) {
    const a = r() * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * R * 0.85);
    const y = Math.round(cy + Math.sin(a) * R * 0.85 * 0.78);
    if (r() < 0.6) {
      p.px(x, y, 'n');
      p.px(x + 1, y, 'N');
    }
  }
  if (kind === 'wild') wildDecor(p, id, cx, cy, R);
  else {
    house(p, cx, cy - 1, tier);
    const flag = kind === 'me' ? 'l' : kind === 'player' ? 'p' : 'o';
    p.vline(cx + 5, cy - 10, cy - 1, 'k');
    p.rect(cx + 6, cy - 10, 5, 3, flag);
    p.hline(cx + 6, cx + 10, cy - 7, 'k');
  }
  return c;
}

/** Nhà chính thu nhỏ trên hải đồ: nhìn là biết đảo bậc mấy. */
function house(p: Pen, x: number, y: number, tier: number) {
  if (tier <= 1) {
    p.poly([[x - 3, y + 1], [x, y - 3], [x + 3, y + 1]], 'G');
    p.px(x, y, 'k');
  } else if (tier === 2) {
    p.rect(x - 3, y - 1, 6, 3, '#c99a62');
    p.poly([[x - 4, y - 1], [x - 1, y - 4], [x + 2, y - 4], [x + 4, y - 1]], 'y');
    p.px(x, y + 1, 'T');
  } else if (tier === 3) {
    p.vline(x - 3, y + 1, y + 2, 'T');
    p.vline(x + 2, y + 1, y + 2, 'T');
    p.rect(x - 3, y - 1, 6, 2, 'a');
    p.poly([[x - 4, y - 1], [x, y - 6], [x + 4, y - 1]], 'Y');
  } else if (tier === 4) {
    p.rect(x - 4, y - 1, 8, 3, 'u');
    p.poly([[x - 5, y - 1], [x - 3, y - 4], [x + 3, y - 4], [x + 5, y - 1]], '#a8432f');
    p.px(x - 5, y - 2, 'l');
    p.px(x + 4, y - 2, 'l');
  } else {
    p.ellipse(x, y + 1, 6, 2, 'S');
    p.ellipse(x, y + 1, 6, 2, 'k', false);
    p.rect(x - 2, y - 3, 4, 4, 'n');
    p.poly([[x - 4, y - 3], [x, y - 6], [x + 4, y - 3]], 'e');
    p.px(x, y - 7, 'l');
  }
}

/** Đảo hoang có nét riêng: cua đỏ, sứa, khỉ, cá nóc, hang đá, trại hải tặc. */
function wildDecor(p: Pen, id: string, cx: number, cy: number, R: number) {
  const ring = (n: number, k: number, col: string) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + k;
      p.px(Math.round(cx + Math.cos(a) * R * 1.25), Math.round(cy + Math.sin(a) * R * 0.98), col);
    }
  };
  if (id === 'baicua') {
    for (const [dx, dy] of [[-4, 3], [3, 4], [5, -1], [-2, -3]]) {
      p.px(cx + dx, cy + dy, 'e');
      p.px(cx + dx + 1, cy + dy, 'E');
    }
  } else if (id === 'ransua') {
    ring(9, 0.3, '#ef7c98');
    ring(7, 1.1, '#c3a3f0');
  } else if (id === 'daokhi') {
    for (const [dx, dy] of [[-3, -2], [2, -3], [0, 1], [4, 2], [-4, 2]]) {
      p.rect(cx + dx - 1, cy + dy - 1, 3, 3, 'H');
      p.px(cx + dx, cy + dy - 2, 'a');
    }
    p.rect(cx - 1, cy + 3, 2, 2, 'T');
  } else if (id === 'vinhcanoc') {
    p.ellipse(cx + 5, cy - 2, 2, 2, 'l');
    p.px(cx + 4, cy - 3, 'k');
    p.px(cx + 7, cy - 2, 'L');
  } else if (id === 'hangcuada') {
    p.ellipse(cx, cy - 1, 7, 5, 'N');
    p.ellipse(cx - 1, cy - 2, 5, 3, 'n');
    p.ellipse(cx, cy + 1, 3, 2, 'k');
    p.px(cx + 4, cy + 4, 'e');
  } else if (id === 'trailhaitac') {
    p.poly([[cx - 6, cy + 3], [cx - 3, cy - 2], [cx, cy + 3]], 'F');
    p.poly([[cx + 1, cy + 3], [cx + 4, cy - 1], [cx + 7, cy + 3]], 'F');
    p.vline(cx, cy - 11, cy + 2, 'k');
    p.rect(cx + 1, cy - 11, 6, 4, 'k');
    p.px(cx + 3, cy - 10, 'w');
    p.px(cx + 4, cy - 9, 'w');
  }
}
