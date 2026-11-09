# 024 — Chế độ tiết kiệm (chạy mượt trên máy yếu)
- Có 3 mức hình ảnh: Tự động (mặc định), Cao, Tiết kiệm. Lưu trong localStorage `vld-quality`.
- Tiết kiệm: vẽ ở nửa độ phân giải (rs=2) trên mọi màn hình, giới hạn 30 FPS.
- Cao: rs theo kích thước màn hình (≥900x560 → 2, còn lại 1), 60 FPS.
- Tự động: bắt đầu như Cao; nếu FPS trung bình < 35 liên tục ≥ 6 giây (đủ mẫu) thì tự chuyển Tiết kiệm cho lần sau và hiện thông báo "Tải lại để mượt hơn". Không tự nâng lại.
- Cài đặt có lựa chọn 3 mức; đổi mức thì tải lại trang.
- Hàm thuần `shared/quality.ts`: `rsFor`, `fpsFor`, `shouldDegrade`, `resolveQuality`.
