// Bot chơi thử qua giao diện thật (bấm chuột như người), kiểm tra từng tính năng, đo FPS, chụp màn hình.
// Dùng: node tools/playtest.mjs <url> <thư-mục-ảnh> [phone|desktop]
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const url = process.argv[2] ?? 'http://127.0.0.1:5173/';
const outDir = process.argv[3] ?? '/tmp/claude-0/shots';
const device = process.argv[4] ?? 'phone';
fs.mkdirSync(outDir, { recursive: true });
const vp = device === 'phone' ? { width: 390, height: 844 } : { width: 1280, height: 800 };

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'ĐẠT ' : 'LỖI '} ${name}${detail ? ' — ' + detail : ''}`);
};
const shots = [];

const b = await chromium.launch({ args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: device === 'phone' ? 2 : 1, hasTouch: false });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));
p.on('console', (m) => {
  if (m.type() === 'error' && !/ERR_TUNNEL|fonts\.g|net::/.test(m.text())) errors.push(m.text());
});
const shot = async (name) => {
  const f = `${outDir}/${device}-${name}.png`;
  await p.screenshot({ path: f });
  shots.push(f);
};
const S = () => p.evaluate(() => {
  const s = window.__vld.store.s;
  return { res: s.res, land: s.land.split('').filter((c) => c === '1').length, lv: s.lv, quests: s.quests, stats: s.stats, chests: s.chests.length, comps: s.comps };
});
// toạ độ màn hình của một ô trên đảo
const tileXY = (x, y, dy = 10) =>
  p.evaluate(([x, y, dy]) => {
    const sc = window.__vld.game.scene.getScene('island');
    return sc.screenOf(160 + x * 16 + 8, 160 + y * 16 + dy);
  }, [x, y, dy]);
const seaXY = (x, y) =>
  p.evaluate(([x, y]) => {
    const sc = window.__vld.game.scene.getScene('sea');
    const cam = sc.cameras.main;
    const q = sc.portrait ? { x: y * 16, y: x * 16 } : { x: x * 16, y: y * 16 };
    cam.centerOn(q.x, q.y);
    cam.preRender();
    const rs = window.__vld.game.registry.get('rs') || 1;
    return { x: (q.x - cam.worldView.x) * cam.zoom * rs, y: (q.y - cam.worldView.y) * cam.zoom * rs };
  }, [x, y]);
const openMenu = async () => { if (!(await p.isVisible('#btnExpand'))) { await p.click('#menuBtn'); await p.waitForTimeout(250); } };
const reset = async () => {
  await p.evaluate(() => { window.__vld.ui.closeSheet(); window.__vld.ui.island.cameras.main.stopFollow(); window.__vld.ui.island.fitCamera(true); });
  await p.waitForTimeout(900); // camera cần thời gian vào khung (HUD đổi chỗ chạm)
};
const tap = async (x, y, dy = 10) => { await reset(); const pt = await tileXY(x, y, dy); await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(600); };
const sampleFps = (ms) =>
  p.evaluate(
    (ms) =>
      new Promise((res) => {
        const f = [];
        let last = performance.now();
        const end = last + ms;
        const loop = (t) => {
          f.push(t - last);
          last = t;
          if (t < end) requestAnimationFrame(loop);
          else {
            const avg = f.reduce((a, b) => a + b, 0) / f.length;
            const worst = [...f].sort((a, b) => b - a).slice(0, Math.max(1, Math.floor(f.length * 0.01)));
            res({ fps: Math.round(1000 / avg), low1: Math.round(1000 / (worst.reduce((a, b) => a + b, 0) / worst.length)), long: f.filter((x) => x > 50).length, frames: f.length });
          }
        };
        requestAnimationFrame(loop);
      }),
    ms,
  );

const t0 = Date.now();
await p.goto(url);
await p.waitForFunction(() => !!window.__vld?.store, null, { timeout: 25000 });
const loadMs = await p.evaluate(() => window.__vld.perf.loadMs);
check('Game mở được', true, `tải xong ${loadMs}ms`);
await p.waitForTimeout(1800);
await shot('01-intro');
for (let i = 0; i < 14; i++) { // trailer lần đầu rồi giới thiệu: bấm "Bỏ qua"/"Tiếp" như người chơi
  const btn = (await p.$('#trailer .skip')) ?? (await p.$('#intro:not([hidden]) button'));
  if (!btn) { await p.waitForTimeout(400); if (!(await p.$('#trailer')) && !(await p.$('#intro:not([hidden])'))) break; continue; }
  await btn.click().catch(() => {});
  await p.waitForTimeout(350);
}
await p.waitForTimeout(700);
// người mới được mời "Tạo nhân vật": ảnh chụp bảng này (kiểm ô màu), rồi đóng như người chơi bấm Đóng
if (await p.isVisible('#sheet .avstage, #sheet .avrow')) {
  await shot('01b-tao-nhan-vat');
  await p.click('#sheet .x').catch(() => {});
  await p.waitForTimeout(300);
}
check('Có credit Beta Holding trên màn hình mở', (await p.textContent('#splash .studio'))?.includes('Beta Holding'));
await shot('02-island');

// 1. nhặt cỏ
let s0 = await S();
let pt;
const nodes = await p.evaluate(() => window.__vld.store.s.nodes.map((n) => ({ kind: n.kind, x: n.x, y: n.y })));
const grass = nodes.find((n) => n.kind === 'grass');
await tap(grass.x, grass.y); // điểm nhặt lấy từ trạng thái thật (bản đồ đảo khác nhau mỗi người)
let s1 = await S();
check('Chạm bụi cỏ tranh → có thêm cỏ', s1.res.co > s0.res.co, `${s0.res.co} → ${s1.res.co}`);
check('Xong nhiệm vụ nhặt cỏ', s1.quests.includes('q_gather'));
// nhặt hết các điểm
for (const n of nodes.filter((n) => n !== grass)) await tap(n.x, n.y);
s1 = await S();
check('Nhặt được sắt vụn, đá, tre', (s1.res.sat > 0 || s1.res.da > 6) && s1.res.tre > 6, `sắt ${s1.res.sat}, đá ${s1.res.da}, tre ${s1.res.tre}`);
await shot('03-gather');

// 2. nghe & cho Túp Lều ăn
await reset();
const lv = await p.evaluate(() => window.__vld.ui.island.lvAnchor('leu'));
await p.mouse.click(lv.x, lv.y + 24); // chạm thân Túp Lều (vị trí lấy từ cảnh, đảo mỗi người khác nhau)
await p.waitForTimeout(700);
check('Chạm Túp Lều → mở bảng Thính Hồn', await p.isVisible('#sheet .lv-head'));
check('Có bong bóng tiếng lòng', await p.isVisible('#bubble'));
await shot('04-thinh-hon');
const xp0 = (await S()).lv.leu.xp;
await p.click('#sheet .feed[data-r="co"]');
await p.waitForTimeout(300);
let s2 = await S();
check('Cho Túp Lều ăn cỏ → tăng linh khí', s2.lv.leu.xp > xp0, `${xp0} → ${s2.lv.leu.xp}`);
check('Túp Lều đang vui sau khi ăn đúng món', s2.lv.leu.mood === 'vui');
await shot('05-feed');

// 3. cho Cuốc ăn sắt
await tap(12, 12, 2);
const satBefore = (await S()).res.sat;
if (satBefore >= 5) {
  await p.click('#sheet .feed[data-r="sat"]');
  await p.waitForTimeout(200);
}
check('Cho Cuốc ăn sắt', (await S()).lv.cuoc.xp > 0 || satBefore < 5, `sắt có ${satBefore}`);
await p.click('#sheet .feed[data-r="co"]').catch(() => {});
await p.waitForTimeout(200);
check('Cho Cuốc ăn cỏ → Cuốc dỗi', (await S()).lv.cuoc.mood === 'doi');

// 4. mở hòm
const c0 = (await S()).chests;
const ch = await p.evaluate(() => window.__vld.store.s.chests[0]);
await tap(ch.x, ch.y, 8);
await p.waitForTimeout(1500); // mở hòm do server quay: chờ phản hồi
check('Mở hòm trôi dạt', (await S()).chests < c0, `${c0} → ${(await S()).chests}`);

// 5. khai hoang
await p.evaluate(() => { const s = window.__vld.store.s; s.res.da += 20; s.res.tre += 20; });
await reset();
await openMenu();
await p.click('#btnExpand');
await p.waitForTimeout(250);
await shot('06-khai-hoang');
const land0 = (await S()).land;
const shore = await p.evaluate(() => { // ô biển sát đảo (đảo mỗi người một hình)
  const s = window.__vld.store.s;
  const G = Math.round(Math.sqrt(s.land.length));
  const L = (x, y) => x >= 0 && y >= 0 && x < G && y < G && s.land[y * G + x] === '1';
  for (let y = 4; y < G - 4; y++) for (let x = 4; x < G - 4; x++) if (!L(x, y) && L(x - 1, y) && L(x + 1, y) === false && L(x, y - 1) === L(x, y + 1)) return { x, y };
  return null;
});
pt = await tileXY(shore.x, shore.y, 8);
await p.mouse.click(pt.x, pt.y);
await p.waitForTimeout(400);
check('Khai hoang ô biển sát đảo', (await S()).land === land0 + 1, `${land0} → ${(await S()).land}`);
await openMenu();
await p.click('#btnExpand');

// 6. kéo camera (đo FPS khi kéo)
const fpsIdlePromise = sampleFps(4000);
const fpsIdle = await fpsIdlePromise;
const panPromise = sampleFps(3000);
await p.mouse.move(vp.width / 2, vp.height / 2);
await p.mouse.down();
for (let i = 0; i < 40; i++) {
  await p.mouse.move(vp.width / 2 + Math.sin(i / 5) * 120, vp.height / 2 + Math.cos(i / 5) * 90, { steps: 2 });
}
await p.mouse.up();
const fpsPan = await panPromise;
check('FPS khi đứng yên ≥ 50', fpsIdle.fps >= 50, JSON.stringify(fpsIdle));
check('FPS khi kéo bản đồ ≥ 45', fpsPan.fps >= 45, JSON.stringify(fpsPan));

// 7. Thu phóng đảo
await reset();
const z0 = await p.evaluate(() => window.__vld.ui.island.cameras.main.zoom);
await p.click('#zIn');
await p.waitForTimeout(350);
const z1 = await p.evaluate(() => window.__vld.ui.island.cameras.main.zoom);
check('Nút + phóng to đảo', z1 > z0, `${z0} → ${z1}`);
await shot('07a-phong-to');
// kéo thật xa: khung nhìn phải giữ đảo trong màn hình
await p.mouse.move(vp.width / 2, vp.height / 2);
await p.mouse.down();
await p.mouse.move(vp.width / 2 + 1500, vp.height / 2 + 1500, { steps: 8 });
await p.mouse.up();
await p.waitForTimeout(200);
const inView = await p.evaluate(() => {
  const sc = window.__vld.ui.island;
  const v = sc.cameras.main.worldView;
  const c = sc.islandCenter();
  const b = sc.bounds;
  // ít nhất một phần hòn đảo còn trong khung nhìn
  return v.x < b.x + b.w && v.right > b.x && v.y < b.y + b.h && v.bottom > b.y;
});
check('Kéo xa vẫn không lạc khỏi đảo', inView);
await p.mouse.move(vp.width / 2, vp.height / 2);
await p.mouse.wheel(0, 300);
await p.waitForTimeout(350);
const z2 = await p.evaluate(() => window.__vld.ui.island.cameras.main.zoom);
check('Cuộn chuột thu nhỏ', z2 < z1, `${z1} → ${z2}`);
// thu nhỏ hết cỡ → ra hải đồ
for (let i = 0; i < 8; i++) {
  if (await p.evaluate(() => window.__vld.game.scene.isActive('sea'))) break;
  await p.click('#zOut');
  await p.waitForTimeout(380);
}
await p.waitForTimeout(700);
check('Thu nhỏ hết cỡ thì ra hải đồ', await p.evaluate(() => window.__vld.game.scene.isActive('sea') && !window.__vld.game.scene.isActive('island')));
await shot('07-hai-khu');
const islands = await p.evaluate(() => window.__vld.net.islands().length);
check('Hải Khu có đảo láng giềng', islands >= 5, `${islands} đảo`);
// phóng to tại đảo nhà → về đảo
for (let i = 0; i < 8; i++) {
  if (await p.evaluate(() => window.__vld.game.scene.isActive('island'))) break;
  await p.click('#zIn');
  await p.waitForTimeout(380);
}
await p.waitForTimeout(700);
check('Phóng to tại đảo nhà thì về đảo', await p.evaluate(() => window.__vld.game.scene.isActive('island')));
await p.click('#zMode');
await p.waitForTimeout(900);

// 8. Lên thuyền ra Bãi Cua (bật tốc độ test x20 cho nhanh)
await p.evaluate(() => window.__vld.store.do({ t: 'speed', speed: 20 }));
pt = await seaXY(14, 9);
await p.mouse.click(pt.x, pt.y);
await p.waitForTimeout(400);
check('Chạm Bãi Cua → mở bảng đảo quái', (await p.textContent('#sheet h2')) === 'Bãi Cua');
check('Bảng ghi thời gian đi thuyền', ((await p.textContent('#sheet')) ?? '').includes('đi mất'));
await shot('08-bai-cua');
await p.click('#btnSail');
await p.waitForTimeout(500);
check('Thuyền rời bến', await p.evaluate(() => window.__vld.store.s.voyage?.phase === 'di'));
check('Trận chưa đánh khi thuyền chưa tới', (await S()).stats.battles === 0);
await p.waitForTimeout(700);
await shot('08b-thuyen-tren-bien');
await p.waitForFunction(() => window.__vld.store.s.lastBattle && !window.__vld.store.s.lastBattle.seen, null, { timeout: 30000 });
check('Thuyền cập đảo thì có trận', (await S()).stats.battles >= 1);
check('Thẻ thuyền hiện "Xem trận"', ((await p.textContent('#voyage')) ?? '').includes('Xem trận'));
const resBefore = (await S()).res;
await p.click('#voyage');
await p.waitForTimeout(1500);
await shot('09-tran-danh');
const fpsBattle = await sampleFps(2500);
check('FPS trong trận ≥ 45', fpsBattle.fps >= 45, JSON.stringify(fpsBattle));
await p.click('#btnSkip');
await p.waitForSelector('#sheet .result', { timeout: 20000 });
await shot('10-ket-qua');
await p.click('#btnOk');
await p.waitForFunction(() => !window.__vld.store.s.voyage, null, { timeout: 30000 });
const afterReturn = await S();
const won = await p.evaluate(() => window.__vld.store.s.lastBattle?.o.battle?.winner === 0);
check('Thuyền về bến mới nhận chiến lợi phẩm', !won || afterReturn.res.sat > resBefore.sat || afterReturn.res.so > resBefore.so, `sắt ${resBefore.sat} → ${afterReturn.res.sat}`);

// 9. đột kích một đảo máy bằng thuyền
const target = await p.evaluate(() => window.__vld.net.islands().filter((i) => i.bot).sort((a, b) => a.power - b.power)[0]?.id);
await p.evaluate((id) => { const t = window.__vld.net.islands().find((i) => i.id === id); window.__vld.ui.openIsland(t, false); }, target);
await p.waitForTimeout(300);
await shot('11-dao-may');
await p.click('#btnSail');
await p.waitForFunction(() => window.__vld.store.s.lastBattle && !window.__vld.store.s.lastBattle.seen, null, { timeout: 40000 });
check('Đột kích đảo máy bằng thuyền', (await S()).stats.raids >= 1);
await p.click('#voyage');
await p.waitForTimeout(400);
await p.click('#btnSkip').catch(() => {});
await p.waitForSelector('#sheet .result', { timeout: 20000 });
await p.click('#btnOk');
await p.evaluate(() => window.__vld.store.do({ t: 'speed', speed: 1 }));

// 10. Đội, Chat, Góp ý
await p.click('#nav [data-tab="team"]');
await p.waitForTimeout(300);
check('Bảng Đội hiện 4 nhân vật', (await p.$$('#sheet .unit')).length === 4);
await shot('12-doi');
await p.click('#nav [data-tab="chat"]');
await p.waitForTimeout(300);
await p.fill('#chatText', 'Chào cả Hải Khu, tui mới tới!');
await p.click('#chatForm button');
await p.waitForTimeout(300);
const sent = await p.evaluate(() => window.__vld.net.chats().some((m) => m.text === 'Chào cả Hải Khu, tui mới tới!' && m.from === window.__vld.net.meId));
check('Gửi chat', sent);
await shot('13-chat');
await p.click('#nav [data-tab="feedback"]');
await p.waitForTimeout(300);
await p.click('.rate[data-key="fun"] button[data-n="4"]');
await p.click('.rate[data-key="smooth"] button[data-n="5"]');
await p.click('.rate[data-key="clear"] button[data-n="3"]');
await p.fill('#fbText', 'Bot test: luồng chơi chạy được.');
await p.click('#fbSave');
await p.waitForTimeout(400);
check('Lưu góp ý', ((await p.textContent('#fbMsg')) ?? '').startsWith('Đã'));
await shot('14-gop-y');
await p.click('#sheet .x');

// 10. cài đặt + credit
await p.click('#btnSettings');
await p.waitForTimeout(200);
await p.click('#btnCredits');
await p.waitForTimeout(200);
check('Credit ghi Beta Holding', ((await p.textContent('#sheet')) ?? '').includes('Beta Holding'));
await shot('15-credit');
await p.click('#sheet .x');

// 11. lưu và tải lại giữ tiến trình
await p.evaluate(() => window.__vld.store.flush(true));
const before = await S();
await p.reload();
await p.waitForFunction(() => window.__vld?.store, null, { timeout: 25000 });
await p.waitForTimeout(500);
const after = await S();
check('Tải lại vẫn giữ tiến trình', after.land === before.land && after.stats.battles === before.stats.battles, `đất ${after.land}, trận ${after.stats.battles}`);

const mem = await p.evaluate(() => window.__vld.perf.memMb());
check('Không có lỗi JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
const report = { device, url, loadMs, fpsIdle, fpsPan, fpsBattle, memMb: mem, errors, checks, shots, ms: Date.now() - t0 };
fs.writeFileSync(`${outDir}/playtest-${device}.json`, JSON.stringify(report, null, 2));
console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} kiểm tra đạt`);
await b.close();
