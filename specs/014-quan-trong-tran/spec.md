# 014 — Quân trong trận: khắc chế, đội hình, báo cáo thương vong

## Mục đích
Game chính là đấm nhau. Người chơi phải thấy mình mang quân gì ra trận, quân nào khắc quân nào,
chọn được quân nào đứng hàng trước/hàng sau, và sau trận biết mỗi đội mất bao nhiêu.

## Luật
- R1 Khắc chế (nhân sát thương theo khoá đơn vị): giáo ×1,35 voi, ×1,2 xe nỏ/xe đá; cung ×1,2 giáo, ×0,85 khiên;
  khiên ×1,2 cung; xe nỏ ×1,25 voi; xe đá ×1,3 khiên, ×1,25 lính đồn/tháp canh. Cặp khác = ×1. `counterMult(att, def)`.
- R2 Đội hình: `s.hang` ghi hàng của từng loại quân (front/back); mặc định theo loại quân. Lệnh `doiHang {k,row}`.
  Hàng áp cho cả tấn công lẫn phòng thủ. Hàng sau không bị đánh khi còn hàng trước.
- R3 Báo cáo: `squadReport(troops, result)` trả mỗi loại quân: lúc ra trận `n`, còn sống `left`, mất `lost`
  (dùng `survivors` theo máu còn lại của đội).
- R4 Giao diện: sprite đội quân trong trận hiện số quân; bảng kết quả liệt kê từng đội (n → left, −lost);
  bảng Quân đội có nút chọn hàng trước/sau cho từng loại.
- R5 Tất định: cùng hạt giống cùng kết quả; không có quân thì đánh y như trước.
- Kiểm thử: tests/battle-quan.test.ts (+ balance.test.ts không vỡ).

## Trạng thái
Đã làm: R1–R5. 133 test xanh, bot playtest-quan 22/22 (chọn hàng, số quân trên sprite, bảng kết quả từng đội).
Chưa làm: hàng của quân phòng thủ người chơi khác (IslandPub chưa mang rows), báo cáo cho trận đảo bị đánh, cân bằng lại bằng mô phỏng sau khắc chế.
