// Mở game, chờ sẵn sàng, chụp màn hình ở cỡ điện thoại và máy tính.
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = process.argv[2] ?? 'http://127.0.0.1:5173/';
const outDir = process.argv[3] ?? '/tmp/claude-0/shots';
const b = await chromium.launch();
for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 800 }]]) {
  const p = await b.newPage({ viewport: vp, deviceScaleFactor: name === 'phone' ? 2 : 1 });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(url);
  await p.waitForFunction(() => window.__vld?.store, null, { timeout: 20000 });
  await p.waitForTimeout(2200);
  // bỏ qua phần mở màn nếu có
  for (let i = 0; i < 5; i++) { const btn = await p.$('#intro:not([hidden]) button'); if (!btn) break; await btn.click(); await p.waitForTimeout(150); }
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${outDir}/${name}-island.png` });
  console.log(name, errs.length ? 'ERR:\n' + errs.join('\n') : 'ok');
  await p.close();
}
await b.close();
