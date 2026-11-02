// ==============================================================
//  THƯỢNG GIỚI — ĐỂ TRỐNG CHO BẢN SAU
// ==============================================================
// Người chơi đánh bại Thủy Tinh sẽ phi thăng (PlayerState.asc > 0) và có quyền vào Thượng Giới.
// Mọi nội dung Thượng Giới (bản đồ, nhiệm vụ, kẻ địch, tài nguyên, luật chơi) viết vào file này
// và thư mục client/src/thuonggioi/, server/src/thuonggioi.ts. Dữ liệu riêng lưu trong
// PlayerState.thuongGioi (hiện là object rỗng, không đụng tới luật chơi hạ giới).
//
// Quy ước khi viết tiếp:
// - Không đổi các trường đang có của PlayerState; chỉ thêm vào PlayerState.thuongGioi.
// - Hành động mới đặt tên bắt đầu bằng "tg_" (ví dụ { t: 'tg_...' }) để server dễ phân biệt.
import type { PlayerState } from './logic';

/** Bật lên true khi Thượng Giới làm xong. */
export const THUONG_GIOI_OPEN = false;

/** Trạng thái Thượng Giới của một người chơi. TODO: định nghĩa ở bản sau. */
export type ThuongGioiState = Record<string, never>;

/** Ai được vào: người đã phi thăng ít nhất một lần. */
export function canEnterThuongGioi(s: PlayerState): boolean {
  return s.asc > 0;
}

/** TODO: khởi tạo Thượng Giới cho người mới phi thăng. */
export function initThuongGioi(_s: PlayerState): void {
  // để trống
}

/** TODO: luật chơi Thượng Giới chạy mỗi nhịp (giống tick ở hạ giới). */
export function tickThuongGioi(_s: PlayerState, _now: number): string[] {
  return [];
}
