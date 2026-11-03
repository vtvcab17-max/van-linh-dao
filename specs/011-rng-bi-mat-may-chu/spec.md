# 011 — Ngẫu nhiên bí mật phía máy chủ (Linh Thạch, vòng quay, hòm báu)

## Vấn đề
`rngOf(s)` = mulberry32(hash(`seed:rngN`)); `seed` và `rngN` nằm trong trạng thái mà client giữ đầy đủ.
Người chơi có thể chạy lại hàm ở máy mình để biết trước kết quả quay/mở hòm/rơi LT, rồi chọn thời điểm
(hoặc tăng `rngN` bằng hành động rẻ) để ra ô hiếm. Server chạy lại hành động nhưng dùng cùng seed công khai.

## Yêu cầu
- R1: thêm `salt` bí mật (chỉ server biết) vào `PlayerState`; `rngSecret(s)` trộn `salt` vào hạt giống.
- R2: quay (`quay`), mở hòm (`chest`) và `dropLT` dùng `rngSecret`.
- R3: server không bao giờ gửi `salt` cho client (mọi thông điệp có `state`).
- R4: bản chính thức: `quay` và `chest` KHÔNG áp dụng sớm ở client; client gửi hành động kèm mã yêu cầu,
  server trả `res` {outcome, state}; giao diện chờ kết quả (hoạt ảnh quay che độ trễ).
- R5: bản offline/test không có salt → hành vi cũ (không tiền thật).
- R6: `salt` không nằm trong `digest`.

## Kiểm thử (tests/rng-secret.test.ts)
- cùng salt → kết quả lặp lại; khác salt → khác; kẻ đoán với salt=0 sai ở đa số seed.
- `stripSecret` bỏ salt; `SERVER_RNG_ACTIONS` có quay và chest.
