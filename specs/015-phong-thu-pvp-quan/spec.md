# 015 — Phòng thủ khi bị đánh: hàng của quân giữ đảo, thương vong, báo cáo

## Mục đích
Đánh nhau với người thật phải có hệ quả cả hai bên: quân giữ đảo đứng đúng hàng chủ đảo chọn,
bị đánh thì ngã quân thật, và chủ đảo biết ai đánh, mất bao nhiêu quân và vật liệu.

## Luật
- R1 `IslandPub.rows`: hàng trước/sau quân giữ đảo (từ `s.hang`); `resolveRaid` đưa vào đội phòng thủ.
- R2 `RaidEvent.defLost`: quân phòng thủ mất sau trận (tính từ máu còn lại của từng đội); chỉ có khi đảo có quân.
- R3 `applyRaidAgainstMe` trừ `defLost` khỏi `s.troops` (không âm, không quá số đang có), thắng hay thua đều trừ.
- R4 Nhật ký chủ đảo ghi số quân mất ("mất 3 Lính Giáo, 1 Xe Nỏ").
- R5 `squadReport(troops, res, side)` dùng được cho cả bên 1.
- R6 Đảo không quân / đảo máy: hành vi cũ không đổi.
- Kiểm thử: tests/pvp-quan.test.ts.

## Trạng thái
Đã làm: R1–R6, 139 test xanh. Sự kiện đột kích do server tự tính (outbox) nên chủ tấn công không giả được defLost.
Chưa làm: xem lại trận từ phía chủ đảo bị đánh; quân đóng ở đảo chư hầu chưa tham gia phòng thủ; chưa chạy thử hai người chơi thật qua server.
