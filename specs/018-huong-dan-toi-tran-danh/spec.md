# 018 — Hướng dẫn đầu game dẫn tới trận đánh bằng quân

## Mục đích
Người mới phải được dắt tay qua chuỗi: xây Trại Lính → luyện lính → mang quân ra khơi đánh. Hiện chuỗi nhiệm vụ
dừng ở "đột kích", chưa nhắc gì tới quân đội nên người chơi không biết bước tiếp theo.

## Luật
- R1 Thêm ba nhiệm vụ cuối chuỗi: `q_don` (xây Trại Lính, nhắc cần Nhà chính bậc 3), `q_luyen` (luyện lính),
  `q_ra` (mang quân ra khơi). Thưởng nhỏ (Vỏ Sò, gỗ, sắt).
- R2 `q_don` hoàn thành khi đặt xây Trại Lính; `q_luyen` khi luyện/đóng quân thành công; `q_ra` khi thuyền rời bến
  chở ít nhất 1 quân. Mỗi nhiệm vụ chỉ nhận thưởng một lần, và hoàn thành sớm vẫn tính (không phải làm theo thứ tự).
- R3 Hành động trả `quest` (chữ nhiệm vụ) để giao diện hiện thông báo; chuyến đi chở quân đưa `quest` vào kết quả `sail`.
- Kiểm thử: tests/huong-dan-quan.test.ts.

## Trạng thái
Đã làm: R1–R3, 156 test xanh; giao diện hiện thông báo nhiệm vụ khi xây Trại Lính, luyện quân, ra khơi chở quân.
