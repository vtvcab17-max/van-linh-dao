# 016 — Tiến triển quân đội: nghiên cứu quân, lệnh hằng ngày

## Mục đích
Người chơi có lý do quay lại mỗi ngày và có hướng mạnh lên về quân đội: nghiên cứu ở Học Viện làm quân mạnh hơn,
và mỗi ngày có ba "lệnh" gắn với việc luyện quân, thắng trận, mang quân ra khơi.

## Luật
- R1 Ba môn mới nhánh Quân sự (tối đa cấp 3, theo luật Học Viện hiện có): Giáp quân (+8% máu lính/cấp),
  Vũ khí quân (+6% công lính/cấp), Cơ khí (+8% công và máu quân cơ giới/cấp). Chỉ áp cho đội quân `tq-*`;
  áp cho cả tấn công và phòng thủ (đảo công khai mang `tq` = cấp ba môn).
- R2 Lệnh hằng ngày `s.lenh {day, luyen, w0, ra, nhan[]}`: sang ngày mới (theo `dayOf`) làm lại từ đầu.
  - `luyen`: luyện/đóng đủ 10 quân → thưởng 80 Vỏ Sò.
  - `thang`: thắng 2 trận (tăng của `stats.wins + stats.raidWins` so với mốc đầu ngày) → thưởng 1 Bảo Ngọc.
  - `ra`: ra khơi 1 chuyến mang từ 5 quân trở lên → thưởng 3 Linh Thạch.
- R3 `nhanLenh {id}`: chỉ nhận khi đủ tiến độ, mỗi lệnh một lần mỗi ngày; chưa đủ hoặc nhận rồi thì từ chối.
- R4 `lenhView(s)` thuần: trả tiến độ từng lệnh (ngày mới → 0, không sửa trạng thái).
- R5 Giao diện: bảng Quân đội có thẻ "Lệnh hôm nay" với nút Nhận; Học Viện tự liệt kê môn mới.
- R6 Tất định, người chơi cũ nâng cấp mượt (migrate bổ sung `lenh`).
- Kiểm thử: tests/tien-trien-quan.test.ts.

## Trạng thái
Đã làm: R1–R6, 147 test xanh, bot playtest-quan 24/24 (nhận lệnh bằng nút).
Chưa làm: tướng chỉ huy một đội quân; lệnh theo tuần; thưởng khi xong cả ba lệnh; cân bằng số liệu thưởng bằng dữ liệu người chơi thật.
