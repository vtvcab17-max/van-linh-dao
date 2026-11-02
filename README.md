# Vạn Linh Đảo

Game chiến thuật sinh tồn trên đảo, đồ họa pixel. Phát triển và phát hành bởi **Beta Holding**.

Có hai bản dùng chung một bộ code:

| Bản | Chạy ở đâu | Đăng nhập | Dữ liệu |
| --- | --- | --- | --- |
| **Chính thức** | Web (Cloudflare) | Tài khoản Google (Gmail) | Lưu trên server, server quyết định kết quả |
| Thử nghiệm | Trang chơi thử trên Claude, file APK, mở file HTML | Không | Lưu trên máy / trên Claude |

## Có gì trong game

- Mỗi người chơi có **nhân vật nam hoặc nữ**, tự chỉnh: kiểu tóc, màu tóc, màu da, trang phục (áo bà ba, áo dài, áo ngư dân, áo thủy thủ, áo tơi lá), màu áo, mũ nón (nón lá, khăn rằn, khăn vấn, mũ rơm, băng đô), vật cầm tay. Nhân vật đi trên đảo, ra trận, hiện trong chat và trên đảo của người khác.
- **Mỗi đảo một hình dạng riêng**: hình bờ, kiểu đất (8 loại: dừa xanh, cát trắng, đất đỏ, đá xám, hoa dại, san hô, lá vàng, rêu ngọc), hoa cỏ, đá, san hô đều sinh từ mã đảo, không đảo nào giống đảo nào. Trên hải đồ cũng vậy, kèm nhà chính thu nhỏ theo bậc.
- **Kiến trúc đổi theo từng bậc**:
  - Nhà chính: Túp Lều Lá → Nhà Tranh Vách Đất → Nhà Sàn Tre → Nhà Rường Gỗ Lim → Loa Thành Chín Vòng.
  - Cuốc: Cuốc Rỉ → Cuốc Sắt → Cuốc Thép Ròng → Cuốc Phá Đá → Cuốc Dời Non.
  - Lũy tre: Hàng Rào Tre → Rào Tre Gai → Lũy Tre Làng → Lũy Tre Ba Lớp → Lũy Tre Ngàn Năm.
- **Thuyền đổi theo từng bậc**: Thuyền Thúng → Ghe Nan → Ghe Bầu → Thuyền Buồm Nâu → Thuyền Rồng Lạc Hồng (cả trên đảo lẫn trên hải đồ).
- Xây càng lên bậc càng lâu, khai hoang càng nhiều ô càng tốn, đi thuyền mất thời gian theo khoảng cách và bậc thuyền.

## Cấu trúc

| Thư mục | Nội dung |
| --- | --- |
| `shared/` | Luật chơi dùng chung cho client và server: dữ liệu, nhân vật (`avatar.ts`), hình đảo, trận đánh, đột kích, hải đồ (`map.ts`) |
| `client/` | Game (Phaser 3 + TypeScript). Đồ họa pixel vẽ bằng code: `art/buildings.ts` (kiến trúc, thuyền), `art/avatar.ts` (nhân vật), `art/islands.ts` (đảo) |
| `client/src/login.ts` | Đăng nhập Google cho bản chính thức |
| `server/` | Cloudflare Worker + Durable Object: `Directory` (danh bạ, chia Hải Khu) và `HaiKhu` (giữ đảo, chạy luật chơi). Cấu hình ở `wrangler.toml` thư mục gốc |
| `tests/` | Test logic và đăng nhập (vitest) |
| `tools/` | Bot chơi thử, mô phỏng cân bằng, test server, bảng xem đồ họa (`tools/preview/`) |

## Bản chính thức: đưa lên web với đăng nhập Gmail

### 1. Nối repo với Cloudflare (đã làm)

Cloudflare → Workers & Pages → Worker `van-linh-dao` → Settings → Build, nối với repo GitHub này:

| Mục | Giá trị |
| --- | --- |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/` |

Mỗi lần đẩy code lên nhánh `main`, Cloudflare tự build bản web chính thức và đưa server lên. Cấu hình server nằm ở `wrangler.toml` (thư mục gốc). Không cần khoá Cloudflare trong GitHub.

### 2. Tạo mã đăng nhập Google (làm một lần)

1. Vào [Google Cloud Console](https://console.cloud.google.com/), tạo dự án (ví dụ "Van Linh Dao").
2. **APIs & Services → OAuth consent screen**: chọn External, tên ứng dụng "Vạn Linh Đảo", email hỗ trợ của Beta Holding. Không cần thêm quyền (scope) nào. Bấm Publish app.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**, loại **Web application**.
4. Ở **Authorized JavaScript origins** thêm địa chỉ game, ví dụ `https://van-linh-dao.<tên-miền-workers>.workers.dev` (và tên miền riêng nếu có, `http://localhost:8787` để thử trên máy).
5. Chép **Client ID** (dạng `xxxx.apps.googleusercontent.com`).
6. Cloudflare → Worker `van-linh-dao` → **Settings → Variables and Secrets → Add**: loại Text, tên `GOOGLE_CLIENT_ID`, dán Client ID → Deploy. (Hoặc ghi thẳng vào `[vars]` trong `wrangler.toml`.)

Client ID không phải bí mật. Game chỉ nhận mã tài khoản Google và tên hiển thị; không đọc Gmail, không lưu email.

### 3. Bí mật (tuỳ chọn)

- `SESSION_SECRET`: không cần đặt; server tự tạo một khoá ngẫu nhiên lần đầu và giữ mãi. Muốn tự đặt thì thêm loại **Secret** cùng chỗ với bước 2.6.
- `ADMIN_TOKEN` (Secret): mật khẩu xem thống kê và góp ý.

### 4. Quản lý

- Số tài khoản, chia Hải Khu: `/admin/stats?token=<ADMIN_TOKEN>`
- Góp ý, đo hiệu năng, bảng xếp hạng của một Hải Khu: `/khu/01/state?token=<ADMIN_TOKEN>`
- Mỗi Hải Khu nhận tối đa 800 tài khoản; đầy thì tự mở khu mới (02, 03...).

### Cách server giữ công bằng

Máy người chơi chỉ gửi **hành động** (nhặt, cho ăn, tiến hóa, ra khơi...). Server chạy đúng luật chơi trong `shared/` rồi lưu. Mỗi hành động kèm "dấu vân tay" kết quả; nếu máy bị sửa dữ liệu hoặc lệch giờ, server gửi lại trạng thái đúng. Đột kích được server tính và trừ thẳng vào đảo bị đánh, chủ đảo nhận tin ngay nếu đang online. Bản chính thức không có nút tăng tốc thời gian.

## Thử bản chính thức trên máy

```bash
npm install && (cd server && npm install)
npm run build
npx wrangler dev --port 8787 --var DEV_LOGIN:1
# mở http://127.0.0.1:8787 → có ô "Đăng nhập thử" (không cần Google)
npx tsx tools/server-test.mts http://127.0.0.1:8787   # 15 mục kiểm tra server
```

`DEV_LOGIN` luôn để `"0"` trên bản thật.

## Bản thử nghiệm

```bash
npm run dev               # http://127.0.0.1:5173 (chơi trên máy, có đảo máy)
npm run build:test        # bản web thử nghiệm (mở thẳng file dist/index.html)
npm run build:artifact    # trang chơi thử trên Claude
bash tools/build-apk.sh   # file APK (chơi trên máy), chỉ cần Java 17+
```

Bản APK là bản thử nghiệm chơi trên máy. Google không cho đăng nhập bên trong WebView của APK, nên bản chính thức chỉ chạy trên trình duyệt.

## Kiểm tra

```bash
npm test             # test logic, hình đảo, nhân vật, đăng nhập
npm run typecheck
npm run danh-gia     # bảng điểm đầy đủ (bot chơi thử, cân bằng, hiệu năng)
```

## Chi phí Cloudflare

Gói miễn phí đủ cho giai đoạn đầu (100.000 lượt gọi/ngày). Hải Khu chỉ thức khi có người chơi đang làm gì đó; ping giữ kết nối được Cloudflare trả lời tự động nên không tốn. Khi đông người nên lên gói Workers Paid 5 USD/tháng.

## Credit

© 2026 Beta Holding. Bảo lưu mọi quyền.
Cảm hứng từ truyện dân gian Việt Nam: Sơn Tinh – Thủy Tinh, Thạch Sanh, Thánh Gióng, An Dương Vương.
