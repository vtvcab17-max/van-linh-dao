# Feature Specification: Cân bằng tài nguyên & chỉnh đồ họa

**Feature Branch**: `005-can-bang-do-hoa` | **Created**: 2026-11-03 | **Status**: Draft
**Input**: "chỉnh đồ họa, cân bằng tài nguyên". Phản hồi người chơi: "tài nguyên vừa nhiều vừa rác", "tỉ lệ ra không hợp lý với nâng cấp cần có", "model lỏ".

## Khảo sát hiện trạng (số liệu từ code, 2026-11-03)
- 22 loại tài nguyên; thanh trên cùng hiện ~13 bộ đếm cùng lúc.
- Tổng chi phí xây 20 công trình mọi cấp + tiến hóa: gỗ 9455, đá 6860, đồng 3500, sò 2615, tre 1670, sắt 1420, lá 180, cỏ 80, **củi 0**.
- Nguồn tối đa mỗi giờ của đảo mới (1 cây dừa, 1 tre, 1 củi trôi, 1 đá, 1 sắt, 2 cỏ): cỏ 720, củi 262, tre 206, lá 135, đá 108, gỗ 90, sắt 60.
- Như vậy gỗ và đá chiếm ~68% chi phí nhưng nguồn thấp nhất; cỏ thừa gấp 8 lần cả công trình cộng lại (chỉ dùng cho nuôi linh vật), củi và lá gần như không có chỗ tiêu ngoài nuôi linh vật.
- Đảo mới có thu nhập đồng 0/giờ (thuế chỉ có khi có nhà dân); đồng khởi đầu 50.
- Kiểm tra chi phí xây so với sức chứa kho: không có bế tắc (cấp 3 đòi nhà chính cao hơn).

## User Scenarios & Testing

### US1 - Kho gọn, mỗi thứ có việc (P1)
Thanh trên cùng chỉ hiện các thứ cốt lõi; mọi tài nguyên còn lại nằm trong bảng Kho chia nhóm, bấm vào một loại thấy "lấy ở đâu, dùng làm gì".
**Independent Test**: mở game thấy ≤ 6 bộ đếm trên cùng; mở Kho thấy 4 nhóm; chạm một loại thấy nguồn và chỗ dùng.
1. **Given** người chơi mới, **When** vào đảo, **Then** thanh trên cùng ≤ 6 bộ đếm.
2. **Given** bảng Kho, **When** chạm "Củi", **Then** hiện nơi lấy và ít nhất 1 chỗ dùng.

### US2 - Nguồn và chi phí cân đối (P1)
Mọi tài nguyên vật liệu có ít nhất một chỗ tiêu có ý nghĩa; tỉ lệ nguồn/ chi phí của các vật liệu nằm trong khoảng đã nêu.
1. **Given** đảo mới, **When** tính nguồn tối đa mỗi giờ, **Then** gỗ và đá mỗi loại cần ≤ 60 giờ để đủ cho toàn bộ cây công trình, và hai thời gian đó chênh nhau ≤ 1,5 lần.
2. **Given** toàn bộ công trình, **Then** mỗi vật liệu xuất hiện trong ít nhất một chi phí xây hoặc một quy trình chế biến.

### US3 - Đảo mới có thu nhập đồng (P2)
Đảo mới bán dư nguyên liệu (cỏ, lá, củi) ở sạp chợ lấy đồng ngay từ đầu, không cần nhà dân. Giá tốt hơn khi có Chợ.
1. **Given** đảo mới có 30 cỏ, **When** bấm Bán, **Then** nhận đồng theo giá niêm yết và trừ đúng số cỏ.

### US4 - Đồ họa nhất quán (P2)
Biểu tượng tài nguyên, vật nuôi mới, thanh HUD dùng cùng bộ pixel art có viền nâu 1 điểm ảnh và bảng màu art2; không còn biểu tượng placeholder/tiền mặc định.
1. **Given** bảng Xã hội và Kho, **When** hiển thị, **Then** mọi biểu tượng đúng loại (không dùng biểu tượng đồng cho thứ khác).
2. **Given** vật nuôi theo giai đoạn, **Then** mỗi giai đoạn (con, tơ, trưởng thành) có hình riêng.

### Edge Cases
- Người chơi cũ có kho đầy cỏ: không mất tài nguyên khi đổi công thức.
- Nâng/hạ nguồn không làm công trình đã xây tụt cấp.

## Requirements
- **FR-001**: Thanh trên cùng MUST hiện tối đa 6 bộ đếm cốt lõi.
- **FR-002**: Bảng Kho MUST chia nhóm (vật liệu, lương thực, hàng hóa, tiền tệ) và mô tả nguồn/chỗ dùng từng loại.
- **FR-003**: Củi MUST là nhiên liệu của Bếp; cỏ MUST là thức ăn của vật nuôi (đói thì lớn chậm); lá MUST dùng gói thực phẩm khi muối/phơi. Cả ba còn bán được ở sạp chợ.
- **FR-004**: Nguồn mỗi giờ của đảo mới MUST cân đối theo US2.
- **FR-005**: Cân bằng MUST không làm mất dữ liệu người chơi cũ (migrate).
- **FR-006**: Biểu tượng mới MUST theo bộ art2.
- **FR-007**: Mọi thay đổi số liệu MUST có test kiểm tỉ lệ trong `tests/`.

## Clarifications

### Session 2026-11-03
- Q: Cỏ, lá, củi thêm chỗ tiêu? → A: Nhiên liệu và thức ăn vật nuôi.
- Q: Thanh trên cùng? → A: Đồng, Sò, Gỗ, Đá, Tre, Thóc.
- Q: Kiếm đồng đảo mới? → A: Bán dư nguyên liệu ở sạp chợ.

## Success Criteria
- **SC-001**: Thanh trên cùng ≤ 6 bộ đếm.
- **SC-002**: Thời gian để đủ gỗ cho toàn bộ cây công trình ở nguồn tối đa của đảo mới không quá 60 giờ, gỗ và đá chênh nhau không quá 1,5 lần (test tự động).
- **SC-003**: 100% vật liệu có ít nhất 2 chỗ dùng.
- **SC-004**: Đảo mới có ≥ 1 cách kiếm đồng trong 10 phút đầu.

## Assumptions
- Không xóa khóa tài nguyên khỏi `ResKey` để giữ tương thích bản lưu; chỉ đổi cách hiển thị và cân bằng.
- Đồ họa dùng canvas vẽ bằng code (art2), không tải ảnh ngoài.
