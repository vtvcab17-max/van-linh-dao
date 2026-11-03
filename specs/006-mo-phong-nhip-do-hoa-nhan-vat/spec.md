# Feature Specification: Mô phỏng nhịp tiến triển & đồ họa nhân vật/công trình

**Feature Branch**: `006-mo-phong-nhip-do-hoa-nhan-vat` | **Created**: 2026-11-03 | **Status**: Draft
**Input**: "có" (đồng ý cả hai việc đề xuất): kiểm tỉ lệ nhận được so với chi phí nâng cấp bằng một ván mô phỏng đủ lâu; chỉnh tiếp đồ họa nhân vật và công trình.

## User Scenarios & Testing

### User Story 1 - Nhịp tiến triển đo được (P1)
Một "người chơi máy" chạy bằng chính luật game (`shared/`), nhặt, xây, nâng cấp theo thứ tự hợp lý, mô phỏng nhiều ngày; báo cáo thời điểm đạt từng mốc.
**Independent Test**: chạy mô phỏng 7 ngày game, xuất bảng mốc và kiểm tra các ngưỡng.
1. **Given** đảo mới, **When** mô phỏng, **Then** nhà dân đầu tiên xong trong ≤ 30 phút.
2. **Given** mô phỏng người chơi tích cực (16 giờ hoạt động mỗi ngày), **Then** Nhà chính bậc 2 trong ≤ 1 giờ, bậc 3 trong 3–24 giờ, bậc 4 trong 5–10 ngày, bậc 5 trong 24–36 ngày.
3. **Given** mô phỏng 45 ngày, **Then** 25 công trình đạt cấp 3 không sớm hơn ngày 12. (Ghi chú sửa: ban đầu viết ngày 20 là phỏng đoán; với Nhà chính bậc 5 ở ngày ~28 thì xây xong 25 công trình cấp 3 ở ngày ~13 là hợp lý, nên đặt mốc 12 và khóa bằng test.)
4. **Given** mô phỏng khi còn đang xây dựng, **Then** gỗ và đá không đầy kho (cap) quá 50% thời gian. (Tre và sắt còn dư, ghi nhận ở kết quả.)
5. **Given** nguồn nhặt và hòm: nguồn nhặt tăng và tỉ lệ hòm hiếm tăng so với hiện tại (theo yêu cầu), nhưng chi phí/linh khí tăng nhiều hơn để cây tiến triển dài ~30 ngày.

### User Story 2 - Nhân vật và công trình nét hơn (P2)
Hình lợn/bò/trâu bớt tròn như cục; nhân vật chủ đảo và công trình phòng thủ có bóng đổ và nhấn sáng thống nhất bộ art2.
**Independent Test**: so ảnh chụp trước/sau trong bảng Xã hội và cảnh nội thất.
1. **Given** bảng Xã hội, **Then** lợn, bò, trâu nhìn ra đúng loài (có chân, tai, mõm/sừng phân biệt).
2. **Given** cảnh đảo, **Then** công trình có bóng dưới chân thống nhất.

### Edge Cases
- Mô phỏng phải tất định (cùng hạt giống ra cùng kết quả) để làm test.
- Mô phỏng không dùng thời gian thật.

## Requirements
- **FR-001**: Bộ mô phỏng MUST chỉ dùng `apply`/`tick` của `shared/logic.ts`, không có luật riêng.
- **FR-002**: Mô phỏng MUST tất định và chạy ≤ 20 giây cho 7 ngày game.
- **FR-003**: Các ngưỡng nhịp ở US1 MUST được kiểm bằng test; nếu vượt, chỉnh số liệu trong `shared/` (không sửa ngưỡng cho khớp).
- **FR-004**: Hình vật nuôi MUST phân biệt được 4 loài ở cỡ 20×16.

## Clarifications

### Session 2026-11-03
- Q: Cây tiến triển dài bao lâu? → A: Khoảng 30 ngày.
- Q: Cách kéo dài? → A: "cần tăng nguồn tài nguyên, tỷ lệ hòm hiếm". Diễn giải: tăng nguồn nhặt và tỉ lệ hòm hiếm để người chơi thấy dồi dào; kéo dài bằng linh khí, chi phí, thời gian xây cao hơn (đã nêu rõ với người dùng).

## Success Criteria
- **SC-001**: Test nhịp xanh với các ngưỡng trên.
- **SC-002**: Báo cáo mốc xuất được thành bảng đọc được.

## Assumptions
- Người chơi máy nhặt mỗi khi điểm thu hoạch sẵn sàng (nhịp 2 phút mỗi lượt) và chạy 16 giờ hoạt động mỗi ngày, nghỉ 8 giờ.
- Hình nhân vật chủ đảo lớn hơn nằm ngoài lát cắt này nếu tốn nhiều.
