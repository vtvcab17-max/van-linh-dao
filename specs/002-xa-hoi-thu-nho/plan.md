# Kế hoạch triển khai
- shared/society.ts (mới): STAGES theo loài, stageOf(animal, now), SPOIL rates, prosperity(s), settle(s, now) cập nhật dân số & hỏng.
- logic.ts: PlayerState.soc? {pop, prosp, born[], fish}; migrate khởi tạo; tick gọi settle.
- client/src/scenes/InteriorScene.ts (mới) + SeaViewScene.ts (mới): đăng ký trong main.ts, mở từ IslandScene.
- IslandScene: bỏ syncTroops/wanderTroop/anGhost; bỏ đội thuyền neo, thay bằng biểu tượng.
- ui.ts: openDinh → mở InteriorScene; nút Xã hội; nút tốc độ có nhãn.
- tests/society.test.ts.
