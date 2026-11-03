# Implementation Plan: Cân bằng tài nguyên & chỉnh đồ họa
**Branch**: `005-can-bang-do-hoa` | **Spec**: [spec.md](./spec.md)

## Summary
Cân bằng nguồn (NODES) và thêm chỗ tiêu cho cỏ/lá/củi; thêm hành động bán nguyên liệu; gọn thanh trên cùng, Kho chia nhóm có mô tả; vẽ hình vật nuôi theo giai đoạn.

## Technical Context
TypeScript, Vite, Phaser 3; vitest. Logic ở `shared/`, UI ở `client/src/`, vẽ pixel bằng code (art2).

## Constitution Check
- I Rõ ràng (thanh gọn, Kho mô tả): PASS. III Logic dùng chung (bán, ăn cỏ, củi ở shared): PASS. IV Thời gian (vật nuôi đói thì chậm lớn): PASS. VI Test trước: PASS.

## Design
- `shared/balance.ts`: hằng số (FEED_CO_PER_HOUR, WRAP_LA, SELL_PRICE), `sinksOf(res)`, `hoursToAfford(res, nodes)`.
- `data.ts` NODES: dừa {la 2, go 5}, đá {da 6}, sắt {sat 4}, cỏ {co 3}.
- `eco.ts` PROCS.bep.take thêm {cui: 1}.
- `society.ts`: settleSociety trừ cỏ cho đàn, thiếu thì dời `born` (lớn chậm); `bao` tốn lá.
- `logic.ts`: action `banNL {res, n}`; giá tăng 5%/cấp Chợ.
- UI: `ui.ts renderRes` 6 bộ đếm; `ui-eco.ts openKho` nhóm + mô tả + nút Bán; `art2/animals.ts` hình theo giai đoạn dùng trong `ui-society.ts`.

## Structure
```text
shared/balance.ts  tests/balance.test.ts  client/src/art2/animals.ts
```
