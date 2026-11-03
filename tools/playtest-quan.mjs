// Bot "người chơi đánh nhau": bấm chuột thật qua giao diện — xây Trại Lính / Xưởng Cơ Giới / nhà dân,
// luyện lính, đóng cơ giới, xếp quân lên thuyền, ra khơi, đánh, quân còn lại ở đảo.
// Dùng: node tools/playtest-quan.mjs <url> <thư-mục-ảnh> [phone|desktop]
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
const shot = (name) => p.screenshot({ path: `${outDir}/quan-${device}-${name}.png` });
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

// chuẩn bị: Nhà chính bậc 3 + vật liệu + nhiều thợ
await p.evaluate(() => {
  const s = window.__vld.store.s;
  s.lv.leu.tier = 3;
  for (const k of ['go', 'da', 'sat', 'tre', 'co', 'thoc', 'luong', 'so', 'ngoc']) s.res[k] = 3000;
  window.__vld.store.do({ t: 'speed', speed: 20 });
});

// 1. xây ba loại công trình bằng giao diện
const okDon = await build('Thành trì', 'donbinh');
check('Xây Trại Lính (bấm menu → chọn chỗ → chạm đất)', okDon);
await finishBuilds();
const okCg = await build('Thành trì', 'xuongcg');
check('Xây Xưởng Cơ Giới', okCg);
await finishBuilds();
await shot('01-da-xay');
let st = await S();
check('Trại Lính và Xưởng Cơ Giới xuất hiện trên đảo', has(st, 'donbinh') && has(st, 'xuongcg'));

// 2. chạm Trại Lính → luyện lính
const don = st.dinh.find((d) => d.k === 'donbinh');
await reset();
let pt = await tileXY(don.x, don.y);
await p.mouse.click(pt.x, pt.y);
await wait(500);
check('Chạm Trại Lính → mở bảng có nút Luyện', (await p.$$('#sheet [data-luyen]')).length > 0);
await shot('02-trai-linh');
const before = count((await S()).troops);
await p.click('#sheet [data-luyen="giao:1"]');
await wait(300);
check('Bấm "Luyện 1" → thêm 1 lính', count((await S()).troops) === before + 1, `${before} → ${count((await S()).troops)}`);
// luyện nhiều lượt cho tới khi hết giường → nút phải khoá / báo lý do
let guard = 0;
while (guard++ < 60) {
  const sel = '#sheet [data-luyen="giao:1"]';
  const off = await p.evaluate((sel) => { const b = document.querySelector(sel); return !b || b.disabled; }, sel);
  if (off) break;
  await p.click(sel).catch(() => {});
  await wait(120);
}
st = await S();
const bedsMsg = await p.evaluate(() => document.querySelector('#sheet')?.textContent ?? '');
check('Luyện đến giới hạn thì dừng (giường/lượt luyện)', guard < 60 && count(st.troops) > 1, `${count(st.troops)} lính`);
check('Bảng ghi rõ giường trong nhà', /giường/.test(bedsMsg));

// 3. Xưởng Cơ Giới → đóng xe
const cg = st.dinh.find((d) => d.k === 'xuongcg');
await reset();
pt = await tileXY(cg.x, cg.y);
await p.mouse.click(pt.x, pt.y);
await wait(500);
const mechSel = '#sheet [data-luyen="xenu:1"]';
const mechBtn = await p.$(mechSel);
check('Chạm Xưởng Cơ Giới → có nút đóng xe', !!mechBtn);
if (mechBtn) {
  const m0 = (await S()).troops.xenu ?? 0;
  await p.click(mechSel);
  await wait(300);
  check('Đóng xe nỏ → +1 cơ giới', ((await S()).troops.xenu ?? 0) === m0 + 1);
}
await shot('03-xuong-co-gioi');

// 4. bảng Quân đội
await p.evaluate(() => window.__vld.ui.closeSheet());
await p.click('#nav [data-tab="team"]');
await wait(400);
check('Bảng Đội có nút mở Quân đội', !!(await p.$('#btnArmy')));
await p.click('#btnArmy');
await wait(400);
const armyText = await p.evaluate(() => document.querySelector('#sheet')?.textContent ?? '');
check('Bảng Quân đội có danh sách lính + cơ giới', /Giáo|Cung|Khiên/i.test(armyText) && /Xe|Voi/i.test(armyText));
check('Bảng Quân đội ghi quân từng đảo', /Đảo nhà/.test(armyText));
await shot('04-bang-quan-doi');
// lệnh hằng ngày: luyện đủ 10 quân → nhận thưởng bằng nút
const so0 = await p.evaluate(() => window.__vld.store.s.res.so);
check('Thẻ "Lệnh hôm nay" có nút Nhận khi luyện đủ 10 quân', await p.evaluate(() => { const b = document.querySelector('#sheet [data-lenh="luyen"]'); return !!b && !b.disabled; }));
await p.click('#sheet [data-lenh="luyen"]');
await wait(300);
check('Nhận thưởng lệnh luyện quân (+80 Vỏ Sò)', (await p.evaluate(() => window.__vld.store.s.res.so)) === so0 + 80);
// chọn hàng: đưa Lính Giáo ra hàng sau bằng nút
await p.click('#sheet [data-row="giao:back"]');
await wait(300);
check('Chọn hàng sau cho Lính Giáo', (await p.evaluate(() => window.__vld.store.s.hang.giao)) === 'back');
await p.click('#sheet [data-row="giao:front"]');
await wait(200);

// 5. xếp quân lên thuyền
await p.click('#sheet [data-mang="giao:5"]');
await wait(200);
await p.click('#sheet [data-mang="xenu:1"]');
await wait(200);
st = await S();
check('Xếp lính + cơ giới vào thuyền', (st.mang.giao ?? 0) > 0 && (st.mang.xenu ?? 0) > 0, JSON.stringify(st.mang));
await shot('05-xep-thuyen');
await p.evaluate(() => window.__vld.ui.closeSheet());

// 6. ra khơi đánh đảo quái
const troopsHome0 = count((await S()).troops);
await p.click('#nav [data-tab="sea"]');
await wait(900);
// mở bảng đảo quái Bãi Cua (đảo gần nhất) rồi bấm "Lên thuyền ra trận" bằng chuột thật
await p.evaluate(() => window.__vld.ui.openWild({ id: 'baicua', name: 'Bãi Cua', level: 1, enemies: [['cuagai', 1], ['cuagai', 1]], loot: { sat: 6, da: 4, so: 5 }, respawnMs: 360000, sx: 14, sy: 9 }));
await wait(400);
console.log('  bảng:', await p.evaluate(() => document.querySelector('#sheet h2')?.textContent));
await shot('05b-chon-dao');
await p.click('#btnSail');
await wait(500);
st = await S();
check('Thuyền rời bến', st.voyage);
const onBoat = await p.evaluate(() => { const v = window.__vld.store.s.voyage; return v?.troops ? Object.values(v.troops).reduce((a, n) => a + n, 0) : 0; });
check('Quân đã lên thuyền (không còn ở đảo nhà)', onBoat > 0 && count((await S()).troops) < troopsHome0, `${onBoat} lên thuyền, đảo nhà còn ${count((await S()).troops)}`);
console.log('  voyage:', await p.evaluate(() => { const s = window.__vld.store.s; return JSON.stringify({ v: s.voyage && { ph: s.voyage.phase, t: s.voyage.targetName, at: s.voyage.arriveAt, back: s.voyage.backAt }, gt: s.gt, speed: s.speed }); }));
await p.waitForFunction(() => window.__vld.store.s.lastBattle && !window.__vld.store.s.lastBattle.seen, null, { timeout: 30000 }).catch(async () => console.log('  quá hạn:', await p.evaluate(() => { const s = window.__vld.store.s; return JSON.stringify({ v: s.voyage && { ph: s.voyage.phase, at: s.voyage.arriveAt }, gt: s.gt, speed: s.speed, lb: !!s.lastBattle }); })));
await p.click('#voyage');
await wait(1500);
await shot('06-tran-danh');
const sq = await p.evaluate(() => (window.__vld.store.s.lastBattle?.o?.battle?.log ?? JSON.stringify(window.__vld.store.s.lastBattle ?? {})).toString().includes('tq-'));
check('Trận có đội quân (tq-*) tham chiến', sq);
await wait(800);
await shot('06b-so-quan-tren-sprite');
await p.click('#btnSkip').catch(() => {});
await p.waitForSelector('#sheet .result', { timeout: 20000 });
await shot('07-ket-qua');
const resTxt = await p.evaluate(() => document.querySelector('#sheet')?.textContent ?? '');
check('Kết quả liệt kê từng đội quân (ra trận → còn)', /Quân ra trận/.test(resTxt) && /→/.test(resTxt));
await p.click('#btnOk');
await p.waitForFunction(() => !window.__vld.store.s.voyage, null, { timeout: 30000 });
st = await S();
const back = count(st.troops) + Object.values(st.isleTroops).reduce((a, g) => a + count(g || {}), 0);
check('Thuyền về: quân còn sống về lại đảo / ở lại giữ đảo', back > 0, `${back} quân còn`);

// 7. tải lại vẫn giữ quân
await p.evaluate(() => window.__vld.store.flush(true));
const beforeReload = count((await S()).troops);
await p.reload();
await p.waitForFunction(() => window.__vld?.store, null, { timeout: 25000 });
await wait(600);
check('Tải lại vẫn giữ quân', count((await S()).troops) === beforeReload, `${beforeReload}`);

check('Không có lỗi JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
fs.writeFileSync(`${outDir}/playtest-quan-${device}.json`, JSON.stringify({ device, url, checks, errors, ms: Date.now() - t0 }, null, 2));
console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} kiểm tra đạt`);
await b.close();
