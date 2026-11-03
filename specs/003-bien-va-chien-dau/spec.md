# Feature Specification: Cảnh biển & Chiến đấu thành bang

**Feature Branch**: `003-bien-va-chien-dau`
**Created**: 2026-11-03
**Status**: Draft
**Input**: "Nhấn vào thuyền ra cảnh thuyền trên biển, di chuyển cũng thấy, cảnh tháp cảnh trên biển. Chiến đấu thời gian thực giữa các người chơi thì không bỏ qua được. Cơ chế combat giữa 2 thành bang như trong Chín Vạn Mẫu (2 video tham khảo). Phản hồi người dùng: muốn cướp phải xem trận online; hệ thống chiến đấu hiện tại 'rác'."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Thuyền trên biển (Priority: P1)
Chạm thuyền (ở đảo hoặc bến) → cảnh toàn màn hình: thuyền nhấp nhô giữa biển, sóng, mòn nước; khi đang có chuyến đi thì hiện tiến độ, điểm đến, thời gian còn lại, chiều đi/về.

**Why this priority**: người chơi muốn thấy hành trình thay vì chỉ một thanh đếm giờ.
**Independent Test**: mở game, chạm thuyền, thấy cảnh biển động; ra khơi rồi mở lại, thấy thuyền đi theo tiến độ.

**Acceptance Scenarios**:
1. **Given** có thuyền neo ở bến, **When** chạm thuyền, **Then** thấy cảnh biển với đúng loại thuyền (ghe/buồm/chiến) và nút Quay lại.
2. **Given** đang có chuyến đi, **When** mở cảnh biển, **Then** thấy thuyền ở vị trí tương ứng tiến độ và đồng hồ đếm ngược đúng với trạng thái game.
3. **Given** không có thuyền, **When** chạm bến, **Then** thấy cảnh bến trống, không lỗi.

### User Story 2 - Tháp nhìn biển (Priority: P1)
Từ Tháp Canh (và tường/đồn binh), nút "Lên tháp" mở cảnh nhìn ra biển: đường chân trời, thuyền xa (thương thuyền ghé, tàu địch tiến tới).

**Independent Test**: xây tháp → Lên tháp → thấy cảnh biển; có thương thuyền hiện khi đảo nằm trên tuyến buôn.

**Acceptance Scenarios**:
1. **Given** có tháp cấp ≥1, **When** bấm Lên tháp, **Then** thấy biển và số thuyền xa bằng số thương thuyền đang ghé.
2. (Hoãn) Thấy tàu địch tiến tới: cần trạng thái chuyến tấn công đang tới từ máy chủ, chưa có.

### User Story 3 - Chiến đấu thời gian thực giữa hai thành bang (Priority: P1)
Hai bên giao chiến theo thời gian thực; người tấn công và phòng thủ đều xem được diễn biến; không bỏ qua, không tua nhanh khi là trận người chơi.

**Independent Test**: hai tài khoản đối đầu; cả hai thấy cùng diễn biến, cùng kết quả; nút bỏ qua/x2 không có.

**Acceptance Scenarios**:
1. **Given** trận PvP, **When** bắt đầu, **Then** không có nút Bỏ qua hoặc x2; thanh trận ghi "không tua".
2. **Given** trận PvE, **When** bấm x2, **Then** tốc độ tăng gấp đôi, bấm lại về x1.
3. **Given** cùng đầu vào, **When** hai máy mô phỏng, **Then** kết quả giống nhau (tất định).

### User Story 4 - Cướp phải xem trận (Priority: P2)
Kẻ tấn công muốn cướp tài nguyên thì phải thắng trận trực tiếp; kết quả cướp dựa trên diễn biến đã xem.

### Edge Cases
- Đối thủ ngoại tuyến lúc bị tấn công: đội phòng thủ đã xếp sẵn tự đánh; chủ đảo xem lại bản ghi khi online.
- Mất kết nối giữa trận: trận tiếp tục theo máy chủ, người chơi vào lại xem tiếp đoạn còn lại.
- Hai chuyến tấn công đồng thời vào một đảo: xếp hàng, mỗi trận một lượt.

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: Hệ thống MUST hiển thị cảnh biển động cho thuyền (US1) và tháp (US2), có nút Quay lại.
- **FR-002**: Cảnh biển MUST đọc trạng thái từ `PlayerState` (voyage, fleet, routes), không có logic game riêng.
- **FR-003**: Trận giữa người chơi MUST không có bỏ qua và không có x2; trận PvE MUST có x1/x2.
- **FR-004**: Mô phỏng trận MUST tất định, dùng chung client và máy chủ.
- **FR-005**: Hai bên xếp đội hình trước; trong trận tự đánh theo thời gian thực, người chơi chỉ xem, không can thiệp.
- **FR-006**: Tháp canh MUST bắn tên vào đội tấn công; tường MUST chặn đường đi, trong trận như các đơn vị.
- **FR-007**: Người xem (kể cả chủ đảo bị đánh) MUST xem được diễn biến trực tiếp.

### Key Entities
- **Chuyến đi (Voyage)**: loại, điểm đến, thời gian đi/về, chiến lợi phẩm.
- **Trận (Battle)**: hai đội hình, hạt giống ngẫu nhiên, chuỗi sự kiện tất định.
- **Cảnh biển (SeaView)**: lớp hiển thị chỉ đọc.

## Success Criteria *(mandatory)*
- **SC-001**: Từ đảo, chạm thuyền → thấy cảnh biển trong ≤ 1 giây.
- **SC-002**: 100% trận PvP không có điều khiển bỏ qua/tua.
- **SC-003**: Cùng đầu vào cho cùng kết quả trên 1000 trận thử.
- **SC-004**: Cảnh biển giữ ≥ 30 fps trên điện thoại tầm trung.

## Clarifications

### Session 2026-11-03
- Q: Điều khiển trong trận? → A: Tự đánh, xem trực tiếp.
- Q: Đối thủ ngoại tuyến? → A: Đội phòng thủ tự đánh, chủ đảo xem lại.
- Q: Tường/tháp? → A: Có: tháp bắn, tường chặn.

## Assumptions
- Dùng canvas 2D (không thêm scene Phaser) cho cảnh biển, vì chỉ hiển thị.
- Thuật toán trận hiện có (`shared/battle.ts`) là nền; nâng cấp theo trả lời Q1–Q3.
- Không xem được nội dung 2 video tham khảo; chi tiết cơ chế lấy từ câu trả lời của người dùng.
