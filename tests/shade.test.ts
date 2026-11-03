import { describe, expect, it } from 'vitest';
import { shadeEdges } from '../client/src/art2/pal';

const OUT = [0x3d, 0x2b, 0x2b, 255];
// 5x5: viền OUT bao quanh, lõi 3x3 màu xám 100
function sprite() {
  const w = 5, h = 5, d = new Uint8ClampedArray(w * h * 4);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const edge = i === 0 || j === 0 || i === w - 1 || j === h - 1;
    d.set(edge ? OUT : [100, 100, 100, 255], (j * w + i) * 4);
  }
  return { d, w, h };
}
const px = (s: ReturnType<typeof sprite>, i: number, j: number) => s.d[(j * s.w + i) * 4];

describe('shadeEdges', () => {
  it('làm sáng mép trên-trái, tối mép dưới-phải, giữ tâm', () => {
    const s = sprite();
    shadeEdges(s.d, s.w, s.h);
    expect(px(s, 1, 2)).toBeGreaterThan(100); // sát viền trái
    expect(px(s, 2, 1)).toBeGreaterThan(100); // sát viền trên
    expect(px(s, 3, 2)).toBeLessThan(100); // sát viền phải
    expect(px(s, 2, 3)).toBeLessThan(100); // sát viền dưới
    expect(px(s, 2, 2)).toBe(100); // tâm
    expect(px(s, 0, 0)).toBe(0x3d); // viền không đổi
  });
  it('không đổi alpha và tất định', () => {
    const a = sprite(), b = sprite();
    shadeEdges(a.d, a.w, a.h); shadeEdges(b.d, b.w, b.h);
    expect([...a.d]).toEqual([...b.d]);
    for (let k = 3; k < a.d.length; k += 4) expect(a.d[k]).toBe(255);
  });
});

import { AI_GROUP_OF } from '../client/src/art2/aiart';
describe('tranh AI', () => {
  it('chỉ gán nhóm tranh cho công trình có thật', async () => {
    const { B_KEYS } = await import('../shared/economy');
    for (const k of Object.keys(AI_GROUP_OF)) expect(B_KEYS).toContain(k);
  });
});
