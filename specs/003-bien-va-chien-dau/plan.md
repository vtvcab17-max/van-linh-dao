# Implementation Plan: Cảnh biển & Chiến đấu thành bang

**Branch**: `003-bien-va-chien-dau` | **Date**: 2026-11-03 | **Spec**: [spec.md](./spec.md)

## Summary
Cảnh biển động (canvas 2D, chỉ đọc) cho thuyền và tháp; nâng mô phỏng trận (`shared/battle.ts`) để tháp bắn và tường chặn; thanh trận có x1/x2 chỉ cho PvE.

## Technical Context
**Language/Version**: TypeScript 5, Vite single-file | **Dependencies**: Phaser 3 (đã có)
**Storage**: Durable Objects (đã có) | **Testing**: vitest (`tests/`) | **Target**: trình duyệt di động
**Performance**: ≥30 fps cảnh biển | **Constraints**: logic tất định trong `shared/`

## Constitution Check
- I Rõ ràng: cảnh biển chỉ hiện thứ cần xem. PASS
- II Vào tận bên trong: thuyền/tháp mở cảnh riêng. PASS
- III Logic dùng chung: cảnh biển chỉ đọc state; luật trận ở shared/. PASS
- IV Thời gian: PvP khóa x1. PASS
- VI Test: thêm tests/battle-defense.test.ts. PASS

## Project Structure
```text
specs/003-bien-va-chien-dau/{spec,plan,tasks}.md
client/src/ui-seaview.ts      # cảnh biển canvas (thuyền, tháp)
client/src/art2/boats scene reuse: drawBoat
shared/battle.ts              # thêm đơn vị công trình: tháp, tường
tests/battle-defense.test.ts
```
**Structure Decision**: giữ cấu trúc client/shared/server hiện có; không thêm gói mới.

## Data Model
- Đơn vị công trình `{kind:'thap'|'tuong', hp, dmg, rng}` sinh từ `s.dinh` khi dựng đội phòng thủ.
