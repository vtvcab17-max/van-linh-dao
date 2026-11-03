# 019 — Âm thanh trận quân

## Luật
- R1 Vào trận phát tiếng tù và xung trận (`horn`).
- R2 Đội quân (`tq-*`) bị diệt thì phát tiếng đổ nặng (`fall`); đơn vị khác chết như cũ.
- R3 Âm chỉ phát khi người chơi bật hiệu ứng và AudioContext đang chạy; không bao giờ ném lỗi khi tắt.
- Kiểm thử: kiểm tra kiểu (tsc) và bot chơi thử không có lỗi JavaScript; nghe thử là việc tay (không tự động được).
