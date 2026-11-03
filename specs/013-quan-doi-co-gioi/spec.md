# 013 — Quân đội: lính, quân cơ giới, chở bằng thuyền, đóng quân từng đảo

## Mục đích
Game chính là đánh nhau. Công trình và vũ khí phải ra quân; người chơi thấy mình có bao nhiêu lính,
mỗi hòn đảo đóng bao nhiêu quân, mỗi chuyến mang theo bao nhiêu.

## Chuỗi sản xuất
Nông trại (lương, thịt) + vật liệu → Trại Lính (đồn binh) luyện lính · Xưởng Cơ Giới (công trình mới) đóng quân cơ giới ·
Thuyền chở quân (sức chở theo bậc thuyền và hạm đội) → ra trận.

## Quân
- Lính: Lính Giáo, Cung Thủ (Trại Lính cấp 1), Giáp Binh (cấp 2).
- Cơ giới: Xe Nỏ (Xưởng CG cấp 1), Xe Bắn Đá (cấp 2), Voi Chiến (cấp 3, chỉ lên Thuyền Buồm Chiến trở lên).
- Mỗi lính và mỗi cơ giới đều tính là 1 đơn vị (chiếm 1 chỗ ở trại và 1 chỗ trên thuyền).
- Luyện lính tốn lương (nông trại gắn với quân đội).

## Luật
- R1 Sức chứa trại: 10 + 15 × tổng cấp Trại Lính + 10 × tổng cấp Xưởng CG.
- R2 Sức chở: 8 + 4 × bậc thuyền + hạm đội (ghe 6, thuyền buồm 10, chiến hạm 16; thuyền hỏng không tính).
- R3 Quân tại đảo nhà (`troops`), tại từng đảo đã cắm cờ (`isleTroops`), kế hoạch mang theo (`mang`).
- R4 Ra khơi (hoang đảo, đảo tự nhiên, đảo người chơi) mang theo quân theo kế hoạch, bị giới hạn bởi quân sẵn có, sức chở, luật lên thuyền; quân mang theo ăn lương.
- R5 Trong trận mỗi loại quân là một đơn vị: máu × n, công × n^0.85. Sau trận, còn sống theo máu còn lại; thắng đảo tự nhiên thì quân còn lại đóng ở đảo, ngoài ra về đảo nhà.
- R6 Quân ở nhà là lực lượng giữ đảo; tính vào sức mạnh (2 mỗi lính, 6 mỗi cơ giới).
- R7 Quân đóng ở đảo cắm cờ: mỗi 8 quân thêm 1 cấp đồn (tối đa 3) cho đảo đó.
- Kiểm thử: tests/troops.test.ts.
