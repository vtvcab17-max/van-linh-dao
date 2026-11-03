# Feature Specification: Đồ họa nhân vật và công trình

**Feature Branch**: `007-do-hoa-nhan-vat-cong-trinh` | **Created**: 2026-11-03 | **Status**: Draft
**Input**: "chỉnh đồ họa nhân vật và công trình" kèm 2 video chiến đấu 9VM làm tham chiếu phong cách.

## Tham chiếu từ video 9VM
- Sprite nhỏ, viền tối rõ, ánh sáng nhất quán; phe phân biệt bằng màu (đỏ/tím), có thanh máu và số sát thương nổi.
- Thanh phát lại có tốc độ 2x, tạm dừng, mốc thời gian (game ta đã có tốc độ và xem lại, spec 004).

## User Scenarios & Testing
### US1 - Ánh sáng thống nhất (P1)
Mọi công trình và nhân vật có mép sáng phía trên-trái và mép tối phía dưới-phải, cùng bóng đổ dưới chân.
**Independent Test**: `shadeEdges` làm sáng điểm sát mép trên-trái, làm tối điểm sát mép dưới-phải, không đụng viền và vùng trong suốt; ảnh chụp đảo trước/sau.
### US2 - Phân biệt phe khi đánh (P2)
Quân hai phe có vòng màu dưới chân (xanh ta, đỏ địch) để nhìn ra ngay trong trận đông.
**Independent Test**: ảnh chụp trận.

## Requirements
- **FR-001**: `shadeEdges` MUST thuần (chỉ nhận mảng điểm ảnh), tất định, không đổi alpha.
- **FR-002**: Công trình (`done`) và lính/nhân vật (`drawUnit`) MUST đi qua `lit`.
- **FR-003**: Trận đánh MUST vẽ vòng phe dưới chân mỗi đơn vị (không tính tường).

## Clarifications
### Session 2026-11-03
- Q: Hướng làm? → A: người dùng chọn "chỉnh đồ họa nhân vật và công trình" (không nêu chi tiết); chọn mặc định: ánh sáng thống nhất + vòng phe, vì khớp tham chiếu video.

## Success Criteria
- **SC-001**: Test `shadeEdges` xanh; ảnh chụp thấy công trình/nhân vật khối hơn; build thành công.
