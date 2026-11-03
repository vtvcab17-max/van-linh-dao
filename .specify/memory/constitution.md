# Hiến chương Vạn Linh Đảo

## Nguyên tắc cốt lõi

### I. Rõ ràng trước hết
Mọi màn hình chỉ hiển thị thứ người chơi cần thao tác. Đảo chỉ có đất và công trình; không dân/lính đi lại vô nghĩa. Mỗi thao tác có một nút, một nhãn, một kết quả nhìn thấy được.

### II. Vào tận bên trong
Công trình là một không gian: chạm vào thì vào cảnh nội thất riêng (có đồ đạc, chỗ làm việc). Thuyền và tháp mở cảnh biển. Không dùng "thẻ + lưới ô" làm giao diện chính.

### III. Logic dùng chung, máy chủ quyết định (BẤT BIẾN)
Mọi luật chơi nằm trong `shared/` (thuần, tất định), chạy cả ở client lẫn Durable Object. Client chỉ dự đoán; máy chủ là chuẩn. Không logic game trong lớp giao diện.

### IV. Thời gian kéo dài để giữ chân
Giai đoạn vật nuôi/cây trồng/dân cư có mốc thời gian dài, khác nhau theo loài. Không có đường tắt miễn phí; tua nhanh (x1/x2) chỉ áp cho PvE và hiển thị, không cho PvP.

### V. Xã hội thu nhỏ
Kinh tế là hệ sinh thái: vật nuôi → sản phẩm → chế biến → bảo quản → tiêu thụ; dân cư → lao động → phồn vinh → thương nhân; quá tải → phải mở rộng.

### VI. Thử trước khi giao
Mọi luật mới có test vitest; typecheck và build sạch trước khi đẩy. Không để bí mật trong mã.

## Ràng buộc
Phaser 3 + TypeScript + Vite, một tệp; Cloudflare Workers + Durable Objects; tiếng Việt; phong cách pixel chibi art2. Pháp lý VN: không giao dịch vật phẩm ảo P2P (NĐ 147/2024).

## Quy trình
Spec → Plan → Tasks → Implement (spec-kit). Thay đổi luật phải cập nhật spec trước.

**Phiên bản**: 1.0.0 | **Phê chuẩn**: 2026-11-03
