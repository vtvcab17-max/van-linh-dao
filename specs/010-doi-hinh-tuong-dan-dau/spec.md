# Spec 010 - Tướng dẫn đầu và đội hình hàng
**Input**: "làm tiếp phần chiến đấu" (sau video 9VM: tướng đi cùng đội lính, đội hình hàng trước/hàng sau).
**Clarification (mặc định, người dùng yêu cầu không hỏi thêm)**: chọn luật đơn giản, dễ thấy: tướng dẫn đầu cho đội +10% công và +10% thủ khi còn sống; mất tướng thì mất hiệu ứng.

## Requirements
- FR-001: Đơn vị tướng (từ `spec.gen`) MUST có cờ `lead`.
- FR-002: Khi tướng còn sống, mọi đồng đội không phải tường (trừ chính tướng) MUST được +10% công khi đánh và +10% thủ khi bị đánh; tướng chết thì hết.
- FR-003: Đầu trận MUST phát một sự kiện `buff` từ tướng tới cả đội (không có kỹ năng) để hiển thị "Dẫn đầu".
- FR-004: Mô phỏng MUST vẫn tất định (cùng hạt giống cùng kết quả); đội không có tướng MUST đánh y hệt trước đây.
- FR-005: Giao diện trận MUST đánh dấu tướng bằng cờ nhỏ trên đầu, và đội hình hàng trước ở gần hơn hàng sau (đã có).

## Tests
tests/formation.test.ts: leaderBonus; sự kiện đầu trận; đội không tướng không đổi; tướng sống mạnh hơn không tướng với cùng hạt giống; tướng chết hết hiệu ứng.

## Trạng thái
Đã làm: cờ `lead`, `leaderBonus` (+10% công/thủ), sự kiện buff đầu trận, hiển thị "DẪN ĐẦU" và cờ vàng đi theo tướng, 93 test xanh.
Chưa làm: tướng đứng giữa đội lính theo hàng với hình riêng từng tướng.
