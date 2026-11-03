import { describe, expect, it } from 'vitest';
import { makeLimiter, actionCost } from '../shared/ratelimit';

describe('giới hạn tốc độ', () => {
  it('cho đến hết dung lượng rồi chặn', () => {
    const L = makeLimiter({ cap: 5, perSec: 1 });
    for (let i = 0; i < 5; i++) expect(L.allow('a', 1, 0)).toBe(true);
    expect(L.allow('a', 1, 0)).toBe(false);
  });
  it('hồi lại theo thời gian, không vượt dung lượng', () => {
    const L = makeLimiter({ cap: 5, perSec: 1 });
    for (let i = 0; i < 5; i++) L.allow('a', 1, 0);
    expect(L.allow('a', 1, 2000)).toBe(true);
    expect(L.allow('a', 5, 100_000)).toBe(true);
    expect(L.allow('a', 1, 100_000)).toBe(false);
  });
  it('mỗi người một thùng riêng', () => {
    const L = makeLimiter({ cap: 1, perSec: 0.001 });
    expect(L.allow('a', 1, 0)).toBe(true);
    expect(L.allow('b', 1, 0)).toBe(true);
    expect(L.allow('a', 1, 1)).toBe(false);
  });
  it('lệnh nặng tốn nhiều điểm hơn', () => {
    expect(actionCost('quay')).toBe(4);
    expect(actionCost('sail')).toBe(4);
    expect(actionCost('luyen')).toBe(4);
    expect(actionCost('nhat')).toBe(1);
  });
  it('người chơi thường (3 lệnh mỗi giây) không bị chặn', () => {
    const L = makeLimiter({ cap: 40, perSec: 4 });
    let ok = true;
    for (let i = 0; i < 300; i++) ok = ok && L.allow('a', 1, i * 333);
    expect(ok).toBe(true);
  });
  it('kẻ gửi dồn 1000 lệnh trong 1 giây chỉ qua được khoảng dung lượng', () => {
    const L = makeLimiter({ cap: 40, perSec: 4 });
    let pass = 0;
    for (let i = 0; i < 1000; i++) if (L.allow('x', 1, i)) pass++;
    expect(pass).toBeLessThanOrEqual(45);
  });
  it('dọn khoá cũ', () => {
    const L = makeLimiter({ cap: 3, perSec: 1 });
    L.allow('a', 1, 0);
    L.allow('b', 1, 1000);
    L.prune(400_000);
    expect(L.size()).toBe(0);
  });
});
