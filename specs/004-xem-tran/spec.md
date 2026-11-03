# Feature Specification: Xem trận rõ ràng & xem lại

**Feature Branch**: `004-xem-tran` | **Created**: 2026-11-03 | **Status**: Draft
**Input**: Phản hồi người chơi: "muốn cướp phải xem trận online", "hệ thống chiến đấu rác". Kế thừa spec 003 (tự đánh, xem trực tiếp, PvP không tua).

## User Scenarios & Testing

### User Story 1 - Thấy ai đang thắng (P1)
Trong trận có bảng trực tiếp: nhãn "TRỰC TIẾP" nếu PvP, tên hai bên, thanh máu tổng của mỗi bên và số lượt.
**Independent Test**: vào trận bất kỳ, thấy hai thanh máu giảm theo diễn biến và số lượt tăng.
1. **Given** trận PvP, **When** bắt đầu, **Then** có nhãn TRỰC TIẾP, không có x2 hay Bỏ qua.
2. **Given** một đơn vị trúng đòn, **When** hiệu ứng xong, **Then** thanh máu tổng bên đó giảm đúng bằng sát thương.

### User Story 2 - Xem lại trận (P1)
Màn kết quả có nút "Xem lại trận" phát lại đúng diễn biến cũ (tất định); phát lại trận PvP vẫn không tua.
1. **Given** vừa xong trận, **When** bấm Xem lại, **Then** trận chạy lại từ đầu và cho cùng kết quả.

### User Story 3 - Bản ghi trận bị đánh lúc ngoại tuyến (ĐÃ BỎ)
Người dùng quyết định (2026-11-03): không cần ghi lại trận bị đánh lúc ngoại tuyến. Không làm.

### Edge Cases
- Trận không có sự kiện nào: hiện kết quả ngay, không lỗi.
- Đóng ứng dụng giữa trận: bản ghi `lastBattle` vẫn còn để xem lại.

## Requirements
- **FR-001**: Trận MUST hiện bảng trực tiếp (nhãn, hai thanh máu, lượt).
- **FR-002**: Thanh máu tổng MUST tính từ máu các đơn vị không tính tường.
- **FR-003**: Kết quả MUST có nút Xem lại; phát lại MUST dùng cùng `BattleResult`.
- **FR-004**: PvP MUST không có x2/Bỏ qua kể cả khi xem lại.

## Success Criteria
- **SC-001**: 100% trận hiện bảng trực tiếp.
- **SC-002**: Xem lại cho cùng kết quả (cùng thắng/thua, cùng số lượt).

## Assumptions
- Không lưu bản ghi trận phía máy chủ.
