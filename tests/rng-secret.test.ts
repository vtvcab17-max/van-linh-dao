import { describe, expect, it } from 'vitest';
import { apply, newPlayer, rngSecret, stripSecret, digest, SERVER_RNG_ACTIONS } from '../shared/logic';

const spinWith = (id: string, salt?: number) => {
  const s = newPlayer(id, 'T', 1000);
  s.res.lt = 5000;
  if (salt !== undefined) s.salt = salt;
  const o = apply(s, { t: 'quay', n: 10 });
  return o.spin!.map((x) => x.slot).join(',');
};

describe('rng bí mật', () => {
  it('cùng salt thì lặp lại, khác salt thì khác', () => {
    expect(spinWith('a', 123456)).toBe(spinWith('a', 123456));
    expect(spinWith('a', 123456)).not.toBe(spinWith('a', 654321));
  });
  it('kẻ đoán bằng seed công khai (không salt) sai ở hầu hết người chơi', () => {
    let wrong = 0;
    for (let i = 0; i < 20; i++) if (spinWith('p' + i, 987654321 + i) !== spinWith('p' + i)) wrong++;
    expect(wrong).toBeGreaterThanOrEqual(18);
  });
  it('rngSecret tăng rngN như rngOf', () => {
    const s = newPlayer('x', 'T', 1);
    s.salt = 7;
    const n = s.rngN;
    rngSecret(s);
    expect(s.rngN).toBe(n + 1);
  });
  it('stripSecret bỏ salt, không đổi trạng thái gốc, digest không phụ thuộc salt', () => {
    const s = newPlayer('x', 'T', 1);
    s.salt = 42;
    const c = stripSecret(s);
    expect(c.salt).toBeUndefined();
    expect(s.salt).toBe(42);
    expect(digest(c)).toBe(digest(s));
  });
  it('quay và hòm là hành động do server quyết định', () => {
    expect(SERVER_RNG_ACTIONS.has('quay')).toBe(true);
    expect(SERVER_RNG_ACTIONS.has('chest')).toBe(true);
  });
});
