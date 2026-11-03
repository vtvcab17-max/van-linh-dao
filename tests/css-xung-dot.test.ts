import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

// Lỗi thật đã gặp: ".sw" vừa là công tắc bật/tắt (cài đặt) vừa là hàng ô màu (tạo nhân vật) → ô màu bị nhét vào viên thuốc 44×24.
const css = readFileSync('client/index.html', 'utf8');
describe('CSS không xung đột tên lớp', () => {
  it('lớp .sw (công tắc) chỉ có một định nghĩa gốc', () => {
    const defs = css.match(/^\.sw \{/gm) ?? [];
    expect(defs.length).toBe(1);
  });
  it('hàng ô màu dùng lớp riêng .swatches', () => {
    expect(css).toMatch(/^\.swatches \{ display: flex/m);
    const ui = readFileSync('client/src/ui.ts', 'utf8');
    expect(ui).toContain('class="swatches"');
  });
});
