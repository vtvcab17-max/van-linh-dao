import { describe, it, expect } from 'vitest';
import { parseQuality, rsFor, fpsFor, shouldDegrade } from '../shared/quality';

describe('chế độ tiết kiệm', () => {
  it('parse giá trị lạ về auto', () => {
    expect(parseQuality('x')).toBe('auto');
    expect(parseQuality(null)).toBe('auto');
    expect(parseQuality('tietkiem')).toBe('tietkiem');
  });
  it('rs theo mức', () => {
    expect(rsFor('tietkiem', 390, 800)).toBe(2);
    expect(rsFor('cao', 390, 800)).toBe(1);
    expect(rsFor('auto', 1280, 720)).toBe(2);
  });
  it('fps mục tiêu', () => {
    expect(fpsFor('tietkiem')).toBe(30);
    expect(fpsFor('cao')).toBe(60);
  });
  it('chỉ tự hạ khi auto, đủ mẫu và FPS thấp liên tục', () => {
    const low = [20, 22, 25, 21, 24, 23];
    expect(shouldDegrade('auto', low)).toBe(true);
    expect(shouldDegrade('cao', low)).toBe(false);
    expect(shouldDegrade('auto', low.slice(0, 3))).toBe(false);
    expect(shouldDegrade('auto', [20, 22, 60, 21, 24, 23])).toBe(false);
    expect(shouldDegrade('auto', [0, 0, 0, 0, 0, 0])).toBe(false);
  });
});
