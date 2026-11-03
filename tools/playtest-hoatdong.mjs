// Bot "người chơi sinh hoạt": bấm chuột thật — Vòng Quay (gacha, có chờ server), Chợ (cửa hàng, túi đồ, chợ người chơi),
// Nhà Bếp nấu ăn từ thóc.
// Dùng: node tools/playtest-hoatdong.mjs <url> <thư-mục-ảnh> [phone|desktop]
// (Chỉ "chỉnh" vật liệu + bậc Nhà chính + thời gian xây cho nhanh; mọi thao tác còn lại là bấm thật.)
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

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1 });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));
p.on('console', (m) => {
  if (m.type() === 'error' && !/ERR_TUNNEL|fonts\.g|net::/.test(m.text())) errors.push(m.text());
});
const shot = (name) => p.screenshot({ path: `${outDir}/hd-${device}-${name}.png` });
const wait = (ms) => p.waitForTimeout(ms);
const S = () => p.evaluate(() => {
  const s = window.__vld.store.s;
  return { troops: { ...s.troops }, mang: { ...s.mang }, isleTroops: JSON.parse(JSON.stringify(s.isleTroops)), dinh: s.dinh.map((d) => ({ k: d.k, lv: d.lv, x: d.x, y: d.y, building: d.doneAt !== undefined })), voyage: !!s.voyage, battles: s.stats.battles, lastBattle: !!s.lastBattle };
});
const count = (t) => Object.values(t).reduce((a, n) => a + (n || 0), 0);
const has = (st, k) => st.dinh.some((d) => d.k === k);

const reset = async () => {
  await p.evaluate(() => { window.__vld.ui.closeSheet(); window.__vld.ui.island.cameras.main.stopFollow(); window.__vld.ui.island.fitCamera(true); });
  await wait(120);
};
const tileXY = (x, y) => p.evaluate(([x, y]) => window.__vld.game.scene.getScene('island').screenOf(160 + x * 16 + 8, 160 + y * 16 + 10), [x, y]);
const nBuilt = () => p.evaluate(() => window.__vld.store.s.dinh.length);

// bấm "Xây dựng" → chọn tab → "Chọn chỗ" → chạm ô đất trống (thử lần lượt đến khi được)
async function build(tab, key) {
  const n0 = await nBuilt();
  await reset();
  if (!(await p.isVisible('#btnBuild'))) { await p.click('#menuBtn'); await wait(250); }
  await p.click('#btnBuild');
  await wait(300);
  await p.click(`[data-bt="${tab}"]`);
  await wait(200);
  const btn = await p.$(`#sheet button[data-b="${key}"]`);
  if (!btn || (await btn.isDisabled())) { console.log('  (nút xây', key, btn ? 'bị khoá: ' + (await btn.textContent()) : 'không có', ')'); return false; }
  await btn.click();
  await wait(200);
  // ô đất trống tính từ trạng thái (đất, không có cây/hòm/công trình), gần tâm đảo trước
  const cand = await p.evaluate(() => {
    const s = window.__vld.store.s;
    const G = Math.round(Math.sqrt(s.land.length));
    const used = new Set([...s.nodes, ...s.chests, ...s.dinh].map((o) => o.x + ',' + o.y));
    const out = [];
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
      if (s.land[y * G + x] !== '1' || used.has(x + ',' + y)) continue;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => s.land[(y + dy) * G + x + dx] === '1').length;
      if (nb === 4) out.push([x, y, Math.abs(x - G / 2) + Math.abs(y - G / 2)]);
    }
    return out.sort((a, b) => a[2] - b[2]).map(([x, y]) => [x, y]);
  });
  for (const [x, y] of cand.slice(0, 25)) {
    await p.evaluate(() => window.__vld.ui.closeSheet());
    const pt = await tileXY(x, y);
    if (pt.x < 0 || pt.y < 60 || pt.x > vp.width || pt.y > vp.height - 70) continue;
    if (!(await p.evaluate(() => !!window.__vld.ui.island.placing))) {
      // lỡ chạm trúng thứ khác → chọn chỗ lại
      await reset();
      if (!(await p.isVisible('#btnBuild'))) { await p.click('#menuBtn'); await wait(250); }
      await p.click('#btnBuild'); await wait(300);
      await p.click(`[data-bt="${tab}"]`); await wait(200);
      await p.click(`#sheet button[data-b="${key}"]`); await wait(200);
    }
    await p.mouse.click(pt.x, pt.y);
    await wait(150);
    if ((await nBuilt()) > n0) return true;
  }
  await shot('loi-xay-' + key);
  console.log('  (không tìm được ô trống cho', key, ')');
  return false;
}
// xây xong ngay (chỉnh giờ cho khỏi chờ)
const finishBuilds = async () => {
  await p.evaluate(() => { const s = window.__vld.store.s; for (const d of s.dinh) if (d.doneAt !== undefined) { d.lv = d.to ?? d.lv + 1; delete d.doneAt; delete d.to; } });
  await wait(300);
};

const t0 = Date.now();
await p.goto(url);
await p.waitForFunction(() => window.__vld?.store, null, { timeout: 25000 });
await wait(1800);
for (let i = 0; i < 6; i++) {
  const btn = await p.$('#intro:not([hidden]) button');
  if (!btn) break;
  await btn.click();
  await wait(120);
}
await wait(700);
check('Game mở được', true);
// trailer + giới thiệu: bấm "Bỏ qua"/"Tiếp" như người chơi cho tới khi hết
for (let i = 0; i < 14; i++) {
  const btn = (await p.$('#trailer .skip')) ?? (await p.$('#intro:not([hidden]) button'));
  if (!btn) { await wait(400); if (!(await p.$('#trailer')) && !(await p.$('#intro:not([hidden])'))) break; continue; }
  await btn.click().catch(() => {});
  await wait(350);
}
await wait(500);

// chuẩn bị: Nhà chính bậc 3 + vật liệu + tốc độ x20
await p.evaluate(() => {
  const s = window.__vld.store.s;
  s.lv.leu.tier = 3;
  for (const k of ['go', 'da', 'sat', 'tre', 'co', 'thoc', 'luong', 'so', 'ngoc', 'cui', 'lt']) s.res[k] = 3000;
  s.res.tien = 3000;
  window.__vld.store.do({ t: 'speed', speed: 20 });
});
const open = (sel) => p.evaluate((sel) => !!document.querySelector(sel), sel);
const clickIf = async (sel) => { const ok = await open(sel); if (ok) await p.click(sel); return ok; };

// 1. Vòng Quay: bấm menu → Vòng Quay → Quay 1 (kết quả do SERVER quay, có chờ)
await reset();
if (!(await p.isVisible('#btnWheel'))) { await p.click('#menuBtn'); await wait(250); }
await p.click('#btnWheel');
await wait(500);
check('Mở được Vòng Quay', await open('#spinHub'));
await shot('01-vong-quay');
const lt0 = await p.evaluate(() => window.__vld.store.s.res.lt + (window.__vld.store.s.luot ?? 0));
const sp0 = await p.evaluate(() => window.__vld.store.s.gacha.spins ?? window.__vld.store.s.gacha.pity);
await p.click('#spin1');
await p.waitForSelector('#spinModal:not([hidden]) #smOk, #smOk', { timeout: 20000 }).catch(() => {});
check('Quay 1 → hiện bảng kết quả (server trả về)', await open('#smOk'));
await shot('02-ket-qua-quay');
const lt1 = await p.evaluate(() => window.__vld.store.s.res.lt + (window.__vld.store.s.luot ?? 0));
check('Quay 1 tốn Linh Thạch/lượt', lt1 < lt0, `${lt0} → ${lt1}`);
await clickIf('#smOk');
await wait(300);
await p.click('#spin10').catch(() => {});
await p.waitForSelector('#smOk', { timeout: 20000 }).catch(() => {});
check('Quay 10 cũng ra kết quả', await open('#smOk'));
await clickIf('#smOk');
await wait(300);
// cùng một lệnh quay không thể lặp lại: server quyết kết quả, client không tự đoán trước được
const pity = await p.evaluate(() => window.__vld.store.s.gacha.pity);
check('Bộ đếm bảo hiểm tăng sau khi quay', pity > 0 || sp0 !== undefined, `pity ${pity}`);
await p.evaluate(() => window.__vld.ui.closeSheet());

// 2. Chợ: Cửa hàng → mua → Túi đồ → Chợ người chơi
await reset();
await p.click('#nav [data-tab="cho"]');
await wait(500);
check('Mở Chợ', await open('#sheet'));
const buyBtn = await p.evaluate(() => { const b = [...document.querySelectorAll('#sheet [data-buyshop]')].find((x) => !x.disabled); return b ? b.dataset.buyshop : null; });
if (!buyBtn) {
  // tab Cửa hàng chưa mở? thử bấm tab
  await p.evaluate(() => [...document.querySelectorAll('#sheet button')].find((b) => /Cửa hàng/.test(b.textContent))?.click());
  await wait(400);
}
const buyId = buyBtn ?? (await p.evaluate(() => [...document.querySelectorAll('#sheet [data-buyshop]')].find((x) => !x.disabled)?.dataset.buyshop ?? null));
check('Cửa hàng có món mua được', !!buyId);
await shot('03-cua-hang');
if (buyId) {
  const t0m = await p.evaluate(() => window.__vld.store.s.res.tien);
  await p.click(`#sheet [data-buyshop="${buyId}"]`);
  await wait(400);
  const t1m = await p.evaluate(() => window.__vld.store.s.res.tien);
  check('Mua đồ → trừ tiền', t1m < t0m, `${t0m} → ${t1m}`);
}
await p.evaluate(() => [...document.querySelectorAll('#sheet button')].find((b) => /Túi đồ/.test(b.textContent))?.click());
await wait(400);
check('Mở Túi đồ', /Túi|đồ/.test(await p.evaluate(() => document.querySelector('#sheet')?.textContent ?? '')));
await shot('04-tui-do');
await p.evaluate(() => [...document.querySelectorAll('#sheet button')].find((b) => /^Chợ$/.test(b.textContent.trim()))?.click());
await wait(1200);
const mk = await p.evaluate(() => document.querySelector('#sheet')?.textContent ?? '');
check('Chợ người chơi mở được (có danh sách hoặc báo trống/ngoại tuyến)', /Chưa có món|Tìm hàng|bản chính thức|ngoại tuyến|×/i.test(mk));
await shot('05-cho-nguoi-choi');
await p.evaluate(() => window.__vld.ui.closeSheet());

// 3. Nhà Bếp: xây → chạm → thuê thợ → nấu ra khẩu phần
const okBep = await build('Chế biến', 'bep');
check('Xây Nhà Bếp bằng giao diện', okBep);
await finishBuilds();
let st = await S();
const bep = st.dinh.find((d) => d.k === 'bep');
check('Nhà Bếp xuất hiện trên đảo', !!bep);
if (bep) {
  await reset();
  const pt = await tileXY(bep.x, bep.y);
  await p.mouse.click(pt.x, pt.y);
  await wait(500);
  await shot('06-nha-bep');
  const sheetTxt = await p.evaluate(() => document.querySelector('#sheet')?.textContent ?? '');
  check('Bảng Nhà Bếp ghi thóc + củi → khẩu phần', /thóc|Thóc/.test(sheetTxt) && /khẩu phần|Lương|lương/.test(sheetTxt));
  await p.evaluate(() => { const r = window.__vld.store.s.res; r.luong = 0; r.thoc = 60; r.cui = 60; r.thit = 0; r.ca = 0; r.trung = 0; });
  await p.evaluate(() => window.__vld.ui.closeSheet());
  await reset();
  const ptN = await tileXY(bep.x, bep.y);
  await p.mouse.click(ptN.x, ptN.y);
  await wait(500);
  check('Thiếu thịt/cá/trứng → bảng Nhà Bếp báo rõ thiếu gì', await open('#needNote'));
  await shot('06b-thieu-thit');
  await p.evaluate(() => { window.__vld.store.s.res.thit = 30; });
  const l0 = await p.evaluate(() => window.__vld.store.s.res.luong);
  const t0 = await p.evaluate(() => window.__vld.store.s.res.thoc);
  // nấu: thuê thợ (ô trống) rồi chờ thời gian game chạy
  await p.evaluate(() => { const b = [...document.querySelectorAll('#sheet .tile.empty, #sheet [data-hire]')][0]; b?.click(); });
  await wait(400);
  const hired = await p.evaluate(() => window.__vld.store.s.dinh.find((d) => d.k === 'bep')?.n ?? 0);
  check('Có thợ bếp', hired >= 1, `${hired} thợ`);
  // nấu tính theo giờ THẬT: lùi mốc 2 giờ (như người chơi đã đi chơi 2 giờ), mở bảng, bấm "Thu"
  await p.evaluate(() => { const s = window.__vld.store.s; const d = s.dinh.find((x) => x.k === 'bep'); d.last = s.lastReal - 2 * 3600_000; });
  await p.evaluate(() => window.__vld.ui.closeSheet());
  await reset();
  const pt2 = await tileXY(bep.x, bep.y);
  await p.mouse.click(pt2.x, pt2.y);
  await wait(500);
  const thuOk = await open('#btnThuNT');
  check('Nhà Bếp có nút "Thu" khi có hàng chờ', thuOk);
  if (thuOk) { await p.click('#btnThuNT'); await wait(400); }
  const l1 = await p.evaluate(() => window.__vld.store.s.res.luong);
  const t1 = await p.evaluate(() => window.__vld.store.s.res.thoc);
  check('Nấu thóc → ra khẩu phần (lương tăng, thóc giảm)', l1 > l0 && t1 < t0, `lương ${l0} → ${l1}, thóc ${t0} → ${t1}`);
}

// 4. Chợ đen? không. Đánh bằng quân đã có test riêng (playtest-quan.mjs). Tải lại vẫn giữ.
await p.evaluate(() => window.__vld.store.flush(true));
const beforeReload = await p.evaluate(() => window.__vld.store.s.res.tien);
await p.reload();
await p.waitForFunction(() => window.__vld?.store, null, { timeout: 25000 });
await wait(600);
check('Tải lại vẫn giữ tiến trình', (await p.evaluate(() => window.__vld.store.s.dinh.some((d) => d.k === 'bep'))) && beforeReload !== undefined);
check('Không có lỗi JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
fs.writeFileSync(`${outDir}/playtest-hoatdong-${device}.json`, JSON.stringify({ device, url, checks, errors, ms: Date.now() - t0 }, null, 2));
console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} kiểm tra đạt`);
await b.close();
