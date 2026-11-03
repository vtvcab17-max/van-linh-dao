# 017 — Tướng chỉ huy đội quân

## Mục đích
Tướng (gacha) không chỉ là một đơn vị đánh lẻ: mỗi tướng có một binh chủng sở trường; mang đúng quân đó đi cùng
thì đội quân ấy mạnh hẳn lên. Người chơi có lý do chọn tướng theo quân đang có và ngược lại.

## Luật
- R1 `GEN_ARM`: mỗi tướng chỉ huy một loại quân (Gióng: voi, Sơn Tinh: khiên, Lạc Long Quân: giáo, Âu Cơ: cung,
  Cao Lỗ: xe nỏ, Nữ Tướng Hải Âu: xe bắn đá, Thủ Lĩnh Nghĩa Quân: giáo, Lão Ngư: cung, Thầy Lang: khiên).
- R2 `commandBonus(id, star)` = 12% + 2% mỗi sao (sao 1: 14%, sao 3: 18%, sao 5: 22%).
- R3 Khi tướng ra trận cùng đội quân đúng loại sở trường: đội đó +bonus công và +bonus máu. Quân loại khác, đội
  không có tướng, hay có tướng mà không mang đúng quân: không đổi.
- R4 Giao diện: bảng Quân đội ghi "Tướng X chỉ huy …: +N%" cho loại quân đang được chỉ huy; hoặc gợi ý nếu
  tướng đang chọn không khớp quân đã mang.
- R5 Tất định; tướng của đảo phòng thủ (spec.gen) cũng áp dụng.
- Kiểm thử: tests/tuong-chi-huy.test.ts.

## Trạng thái
Đã làm: R1–R5, 151 test xanh, bot playtest-quan 25/25.
Chưa làm: kỹ năng riêng của tướng cho đội quân; giới hạn số quân một tướng chỉ huy; hình ảnh tướng đứng giữa đội.
