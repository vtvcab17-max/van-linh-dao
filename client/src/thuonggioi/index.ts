// ==============================================================
//  THƯỢNG GIỚI (giao diện) — ĐỂ TRỐNG CHO BẢN SAU
// ==============================================================
// Khi làm Thượng Giới: thêm scene Phaser mới (ví dụ ThuongGioiScene) vào main.ts và mở từ đây.
// Luật chơi dùng chung ở shared/thuonggioi.ts.
import { THUONG_GIOI_OPEN, canEnterThuongGioi } from '../../../shared/thuonggioi';
import type { PlayerState } from '../../../shared/logic';

/** Nội dung hiện trong bảng "Cổng Thượng Giới". */
export function thuongGioiHtml(s: PlayerState): string {
  if (!canEnterThuongGioi(s))
    return '<p class="hint">Cổng Thượng Giới chỉ mở cho người đã đánh bại Thủy Tinh và phi thăng.</p>';
  if (!THUONG_GIOI_OPEN)
    return `<div class="card gold"><small>Cổng Thượng Giới</small><p>Bạn đã phi thăng ${s.asc} lần. Mây ngũ sắc đang tụ lại trên đảo, nhưng cổng trời còn khép.</p><p class="muted small">Thượng Giới sẽ mở ở bản cập nhật sau. Danh hiệu và số lần phi thăng của bạn được giữ nguyên.</p></div>`;
  // TODO: giao diện Thượng Giới
  return '';
}
