# Đặc tả: Vạn Linh Đảo v2 — Xã hội thu nhỏ & Không gian bên trong

**Trạng thái**: Đang thực hiện | **Ngày**: 2026-11-03

## Câu chuyện người dùng

### US1 (P1) — Đảo rõ ràng
Là người chơi, tôi thấy đảo chỉ gồm các ô đất và công trình, ô nào xây được/đã xây/khóa phân biệt rõ như 9 Vạn Mẫu; không có dân hay lính đi lại.
- Given đang ở đảo, When nhìn màn hình, Then không có nhân vật di chuyển; lưới ô hiện rõ trong chế độ xây/khai hoang.
- Given đang chiến đấu/đi biển, When bấm nút tốc độ, Then có nhãn x1/x2 rõ; trận PvP không đổi được tốc độ và không bỏ qua.

### US2 (P1) — Vào trong công trình
Chạm công trình → cảnh nội thất toàn màn hình với đồ đạc thật (ruộng có luống, chuồng có máng/ổ rơm, nhà dân có giường/bếp, kho có bao/thùng, bến có cầu tàu). Có nút Quay lại.
- Thuyền → cảnh thuyền giữa biển (sóng, mòn nước), hiện hành trình đang đi.
- Tháp → cảnh nhìn ra biển (đường chân trời, thuyền xa).

### US3 (P2) — Chăn nuôi theo giai đoạn
Gà: trứng → gà con → gà tơ → gà mái (trứng làm thức ăn HOẶC ấp). Lợn: heo con → heo choai → heo thịt (lấy thịt). Bò: bê → bò tơ → bò sữa (sữa). Trâu: nghé → trâu tơ → trâu cày (tăng sản lượng ruộng). Mỗi giai đoạn dài hàng giờ đến nhiều ngày; khác nhau theo loài.

### US4 (P2) — Thức ăn & bảo quản
Mỗi lương thực có sản phẩm chính + chế biến (lúa→gạo, rau→dưa muối, thịt→thịt muối, sữa→phô mai, cá→cá khô, trứng→trứng muối). Thực phẩm tươi hỏng theo thời gian nếu không có kho/chế biến; kho nâng cấp giảm hỏng.

### US5 (P2) — Câu cá
Cần câu (miễn phí, chậm), lưới (nhiều, cần Bến), thuyền đánh cá (nhiều nhất, tốn chỗ neo).

### US6 (P2) — Phồn vinh & dân số
Chỉ số phồn vinh 0–100 từ: nhà ở, thức ăn đủ, chợ/bến, đất, an ninh, nghề cá. Cao → dân nhập cư, thương nhân ghé (thu nhập/hiệu suất ↑). Dân > sức chứa nhà → quá tải (hiệu suất ↓, phồn vinh ↓) → phải mở rộng/xây thêm nhà.

## Yêu cầu chức năng
- FR-1 Gỡ dân/lính đi lại khỏi IslandScene.
- FR-2 InteriorScene cho từng loại công trình; SeaViewScene cho thuyền/tháp.
- FR-3 shared/society.ts: giai đoạn vật nuôi, hỏng thực phẩm, phồn vinh, dân số — thuần & tất định, có test.
- FR-4 Nút tốc độ x1/x2 hiển thị; PvP cố định x1, không bỏ qua.
- FR-5 Di cư save: migrate() không làm mất dữ liệu cũ.

## Tiêu chí thành công
Tất cả test xanh; build sạch; mở game thấy đảo không có người đi lại; chạm công trình vào cảnh bên trong; panel Xã hội hiển thị phồn vinh/dân số/kho thực phẩm.
