# 023 — Thử chịu tải nhiều người chơi cùng lúc

## Mục đích
Biết một Hải Khu chịu được bao nhiêu người cùng lúc trước khi mở thật, và chứng minh giới hạn tốc độ lệnh hoạt động.

## Cách chạy
`npx wrangler dev --port 8790 --var DEV_LOGIN:1 --var ADMIN_TOKEN:thu-nghiem`
`npx tsx tools/load-test.mts http://127.0.0.1:8790 60 25 thu-nghiem`
(ADMIN_TOKEN ở trên chỉ là giá trị thử trên máy, không phải khoá thật.)

## Kết quả đo ngày 03/11/2026 (chạy trên wrangler dev cục bộ, KHÔNG phải mạng Cloudflare thật)
- 60 người chơi giả, 25 giây, mỗi người ~2 lệnh/giây: vào được 60/60, vào game p50 80ms / p95 177ms,
  ping p50 3ms / p95 18ms / tối đa 102ms, 2155 lệnh, 0 lần lệch trạng thái, 0 lỗi, 0 rớt kết nối.
- Gửi dồn 300 lệnh từ một người: bị chặn (giới hạn theo kết nối và theo người chơi đều hoạt động).
- Phễu nhiệm vụ trả đúng (94 người, 90 người xong bước 1).

## Giới hạn của phép đo
- Độ trễ mạng thật (điện thoại, 4G) chưa đo; cần chạy script từ máy ngoài trỏ vào địa chỉ triển khai thật.
- Mới thử 60 người trong một Hải Khu; một Durable Object xử lý tuần tự nên cần thử 200–500 trước khi mở rộng.
