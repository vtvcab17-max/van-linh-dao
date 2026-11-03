# 021 — Giới hạn tốc độ lệnh theo người chơi

## Mục đích
Hiện server chỉ giới hạn theo từng kết nối (60 tin / 10 giây). Mở nhiều kết nối cùng lúc là lách được, và các lệnh
nặng (quay thưởng, mở hòm, ra khơi) không bị siết riêng.

## Luật
- R1 `makeLimiter({cap, perSec})`: thùng token thuần; `allow(key, cost, now)` trả true/false; cạn thì từ chối, đầy lại theo thời gian.
- R2 Mỗi người chơi (theo id, không theo kết nối) có một thùng chung: dung lượng 40, hồi 4/giây; lệnh nặng
  (`quay`, `chest`, `sail`, `luyen`) tốn 4 điểm, lệnh thường 1 điểm.
- R3 Hết token thì server không chạy lệnh, gửi lại trạng thái hiện tại và thông báo "Thao tác nhanh quá, chậm lại một chút.".
- R4 Bộ nhớ không phình: khoá không dùng quá 5 phút bị dọn.
- R5 Người chơi bình thường (vài thao tác mỗi giây) không bao giờ bị chặn.
- Kiểm thử: tests/ratelimit.test.ts.

## Trạng thái
Đã làm: R1–R5; bộ giới hạn đã nối vào server (onAction), lệnh có rid trả `res` lỗi để giao diện không treo. 163 test xanh.
