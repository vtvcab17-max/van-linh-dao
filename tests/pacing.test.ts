import { describe, expect, it } from 'vitest';
import { runSim } from '../shared/sim';

// Người chơi máy chạy bằng đúng luật game, 16 giờ hoạt động mỗi ngày (spec 006).
describe('nhịp tiến triển (người chơi máy, 45 ngày)', () => {
  const r = runSim(45);
  const d = (h: number | null) => (h === null ? Infinity : h / 24);
  it('in bảng mốc', () => {
    console.log('MỐC:', { nhaDanPhut: Math.round((r.nhaDan ?? 0) * 60), leu2Gio: r.leu2, leu3Gio: r.leu3, leu4Ngay: d(r.leu4), leu5Ngay: d(r.leu5), cap3Ngay: d(r.allLv3), xay: r.built, full: r.full });
  });
  it('nhà dân đầu tiên trong 30 phút', () => {
    expect(r.nhaDan).not.toBeNull();
    expect(r.nhaDan!).toBeLessThanOrEqual(0.5);
  });
  it('Nhà chính bậc 2 trong 1 giờ, bậc 3 trong 3–24 giờ', () => {
    expect(r.leu2!).toBeLessThanOrEqual(1);
    expect(r.leu3!).toBeGreaterThanOrEqual(3);
    expect(r.leu3!).toBeLessThanOrEqual(24);
  });
  it('bậc 4 sau 5–10 ngày, bậc 5 sau 24–36 ngày', () => {
    expect(d(r.leu4)).toBeGreaterThanOrEqual(5);
    expect(d(r.leu4)).toBeLessThanOrEqual(10);
    expect(d(r.leu5)).toBeGreaterThanOrEqual(24);
    expect(d(r.leu5)).toBeLessThanOrEqual(36);
  });
  it('25 công trình cấp 3 không sớm hơn ngày 12', () => {
    expect(d(r.allLv3)).toBeGreaterThanOrEqual(12);
  });
  it('gỗ và đá không đầy kho quá nửa thời gian khi đang xây dựng', () => {
    expect(r.full.go).toBeLessThanOrEqual(0.5);
    expect(r.full.da).toBeLessThanOrEqual(0.5);
  });
});
