# 012 — Nông trại gắn với chiến đấu (phản hồi người chơi thử)

## Phản hồi
Gameplay chính là đấm nhau nhưng muốn ăn phải qua 4 nhà; gạo/thịt/cá ăn thẳng được nên Cối xay, Bếp thừa;
nông trại không làm quân mạnh; quá nhiều tài nguyên rời rạc; chiến đấu chỉ 4 nhân vật.

## Yêu cầu
- R1 Bữa ăn thành buff: khẩu phần mang theo quyết định buff trận. Thịt: +12% công · tỉ lệ; cá: +12% máu · tỉ lệ;
  lương nấu (Bếp): +8% công và +8% máu · tỉ lệ; gạo: không buff. (`mealBuff` thuần, trong eco.ts)
- R2 `takeRations` trả cả cơ cấu khẩu phần; `Voyage.mix` lưu lại; `voyageCondition` áp buff.
- R3 Bỏ khâu trung gian: Bếp nấu thẳng từ thóc (3 thóc + 1 củi + 1 thịt/cá/trứng → 4 lương).
  Cối xay, Khung cửi, Nhà thuốc ngừng cho xây mới (`hidden`), công trình cũ vẫn chạy. Học viện tốn thóc thay gạo.
- R4 Bớt tài nguyên: dâu tằm cho vải thẳng, thảo dược cho thuốc thẳng; save cũ đổi tơ→vải (2:1), thảo dược→thuốc (3:1).
- R5 Đơn vị phụ mở khóa từ nông trại: Trâu Chiến (Chuồng xong cấp 2, hàng trước), Ngư Phủ (Ao Cá xong cấp 1, hàng sau).
- Kiểm thử: tests/farm-link.test.ts.
