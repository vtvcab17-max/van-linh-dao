# Plan 006
- `tools/sim.ts`: người chơi máy dùng `apply`/`tick`, in bảng mốc.
- `tests/pacing.test.ts`: kiểm các ngưỡng US1 (gọi cùng hàm mô phỏng).
- Nếu vượt ngưỡng: chỉnh `shared/data.ts` / `economy.ts`, ghi vào spec.
- `client/src/art2/animals.ts`: vẽ lại lợn/bò/trâu.
Constitution: III logic dùng chung (mô phỏng dùng shared), VI test trước. PASS.
