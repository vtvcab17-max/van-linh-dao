import { describe, expect, it } from 'vitest';
import { funnelOf } from '../shared/funnel';

const chain = [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }];

describe('phễu nhiệm vụ', () => {
  it('đếm người xong từng bước, phần trăm và số bị kẹt', () => {
    const f = funnelOf([['a', 'b', 'c'], ['a', 'b'], ['a'], []], chain);
    expect(f.total).toBe(4);
    expect(f.steps.map((s) => s.n)).toEqual([3, 2, 1]);
    expect(f.steps.map((s) => s.pct)).toEqual([75, 50, 25]);
    expect(f.steps.map((s) => s.stuck)).toEqual([1, 1, 1]);
    expect(f.steps[0].drop).toBe(1); // 4 người vào, 3 xong bước đầu
  });
  it('không dữ liệu → toàn 0, không chia cho 0', () => {
    const f = funnelOf([], chain);
    expect(f.total).toBe(0);
    expect(f.steps.every((s) => s.n === 0 && s.pct === 0)).toBe(true);
  });
  it('id lạ bị bỏ qua, người làm sớm bước sau vẫn tính', () => {
    const f = funnelOf([['zzz', 'c']], chain);
    expect(f.steps.map((s) => s.n)).toEqual([0, 0, 1]);
  });
  it('kẹt tính theo bước đầu tiên chưa xong', () => {
    const f = funnelOf([['b'], ['a', 'c']], chain);
    expect(f.steps.map((s) => s.stuck)).toEqual([1, 1, 0]);
  });
});
