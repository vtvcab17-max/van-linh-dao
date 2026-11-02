// Toán lục giác dùng chung (lưới "odd-r": hàng lẻ lệch phải nửa ô, đỉnh nhọn ở trên).
export interface Hex {
  c: number;
  r: number;
}

export const hexKey = (c: number, r: number) => `${c},${r}`;

function toCube(c: number, r: number) {
  const x = c - (r - (r & 1)) / 2;
  const z = r;
  return { x, y: -x - z, z };
}
function fromCube(x: number, z: number): Hex {
  return { c: x + (z - (z & 1)) / 2, r: z };
}

/** Số bước lục giác giữa hai ô. */
export function hexDist(a: Hex, b: Hex): number {
  const p = toCube(a.c, a.r), q = toCube(b.c, b.r);
  return Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y), Math.abs(p.z - q.z));
}

/** 6 ô kề: Đ, ĐN, TN, T, TB, ĐB. */
export function hexNeighbors(h: Hex): Hex[] {
  const odd = h.r & 1;
  return [
    { c: h.c + 1, r: h.r },
    { c: h.c + odd, r: h.r + 1 },
    { c: h.c - 1 + odd, r: h.r + 1 },
    { c: h.c - 1, r: h.r },
    { c: h.c - 1 + odd, r: h.r - 1 },
    { c: h.c + odd, r: h.r - 1 },
  ];
}

function cubeRound(x: number, y: number, z: number) {
  let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
  const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return { x: rx, z: rz };
}

/** Đường thẳng từng ô từ a tới b (gồm cả hai đầu). */
export function hexLine(a: Hex, b: Hex): Hex[] {
  const n = hexDist(a, b);
  const p = toCube(a.c, a.r), q = toCube(b.c, b.r);
  const out: Hex[] = [];
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0;
    // lệch nhẹ để tránh rơi đúng mép giữa hai ô
    const x = p.x + (q.x - p.x) * t + 1e-6, y = p.y + (q.y - p.y) * t + 1e-6, z = p.z + (q.z - p.z) * t - 2e-6;
    const r = cubeRound(x, y, z);
    out.push(fromCube(r.x, r.z));
  }
  return out;
}

/** Mọi ô trong bán kính k quanh h. */
export function hexRange(h: Hex, k: number): Hex[] {
  const p = toCube(h.c, h.r);
  const out: Hex[] = [];
  for (let dx = -k; dx <= k; dx++)
    for (let dy = Math.max(-k, -dx - k); dy <= Math.min(k, -dx + k); dy++) {
      const dz = -dx - dy;
      out.push(fromCube(p.x + dx, p.z + dz));
    }
  return out;
}

/** Toạ độ điểm ảnh (tâm ô) với ô rộng 32, bước hàng 24. */
export const hexCenterPx = (h: Hex) => ({ x: h.c * 32 + (h.r & 1) * 16 + 16, y: h.r * 24 + 16 });

/** Ô lục giác chứa điểm ảnh (x, y): ô có tâm gần nhất (đã bù độ dẹt theo chiều dọc). */
export function pxToHex(x: number, y: number): Hex {
  const r0 = Math.round((y - 16) / 24);
  let best: Hex = { c: 0, r: 0 }, bd = Infinity;
  const k = 32 / 24 / Math.sqrt(3) * 1.5; // hệ số đưa lưới dẹt về lục giác đều
  for (let r = r0 - 1; r <= r0 + 1; r++) {
    const c0 = Math.round((x - 16 - (r & 1) * 16) / 32);
    for (let c = c0 - 1; c <= c0 + 1; c++) {
      const p = hexCenterPx({ c, r });
      const d = (p.x - x) ** 2 + ((p.y - y) * k) ** 2;
      if (d < bd) { bd = d; best = { c, r }; }
    }
  }
  return best;
}
