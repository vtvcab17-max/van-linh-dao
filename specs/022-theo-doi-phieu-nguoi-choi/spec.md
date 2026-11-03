# 022 — Phễu người chơi: bỏ game ở bước nào

## Mục đích
Biết người chơi mới kẹt ở nhiệm vụ nào để sửa đúng chỗ (ví dụ nhiều người dừng ở "xây Trại Lính" vì thiếu Nhà chính bậc 3).

## Luật
- R1 `funnelOf(danhSachNhiemVuMoiNguoi, chuoiNhiemVu)`: với từng bước trong chuỗi trả `n` (số người đã xong bước), `pct` (so với tổng),
  `drop` (số người xong bước trước nhưng chưa xong bước này), và `stuck` (số người dừng đúng ở bước này: xong bước trước, chưa xong bước này, theo thứ tự chuỗi).
- R2 Người không có dữ liệu nhiệm vụ tính là chưa xong bước nào; id lạ trong dữ liệu người chơi bị bỏ qua.
- R3 Server trả `funnel` trong `/khu/N/state` (đã yêu cầu ADMIN_TOKEN), tính từ bản lưu của người chơi; không thu thêm dữ liệu cá nhân.
- Kiểm thử: tests/funnel.test.ts.

## Trạng thái
Đã làm: R1–R3. 167 test xanh. Xem phễu: GET /khu/<số>/state?token=ADMIN_TOKEN → trường `funnel`.
