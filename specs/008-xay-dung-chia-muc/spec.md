# Spec 008 - Bảng Xây dựng chia mục (Draft)
**Input**: "trong phần xây dựng vuốt rất lâu, chia nhỏ và rõ ràng từng mục"; cùng yêu cầu bộ tướng và hình công trình đầy đủ (làm sau).
- FR-001: Bảng Xây dựng MUST hiện 6 thẻ nhóm (Nhà cửa, Nông trại, Chế biến, Kinh tế, Học thuật, Thành trì), mỗi lần chỉ liệt kê một nhóm.
- FR-002: Mỗi thẻ MUST cho biết số công trình xây được ngay.
- FR-003: Nhóm đang chọn được nhớ trong phiên.
Trạng thái: thẻ nhóm đã làm (ui.ts + CSS); chỉnh cỡ chữ/gọn hàng đang dở; bộ tướng và hình phòng thủ chưa làm.

## Bổ sung: quái ngẫu nhiên (theo yêu cầu "sinh cả quái ngẫu nhiên")
- `shared/monstergen.ts`: khung nửa thân phản chiếu + ô ngẫu nhiên theo hạt giống, 3 họ (bien, thu, ma), bảng màu sáng/vừa/tối/nhấn từ hạt giống; tất định, có test (tests/monstergen.test.ts).
- `client/src/art2/monsters.ts`: vẽ ra canvas cùng viền, ánh sáng, bóng đổ như art2.
- Kỹ thuật học từ SpriteCook (giữ nhất quán phong cách, làm sạch viền), claude-pxl (dải màu, hạt giống, đổi bảng màu), pixel-sprite-generator (mặt nạ + đối xứng). SpriteCook cần MCP và trả credit nên không dùng trực tiếp.
- Chưa nối vào trận/biển (cần quyết định luật quái ngẫu nhiên phía server).
