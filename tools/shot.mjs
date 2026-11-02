// Chụp màn hình một trang: node tools/shot.mjs <url> <out.png> [width] [height]
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [url, out, w = '1100', h = '1400'] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(url, { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
await p.screenshot({ path: out, fullPage: true });
console.log(errs.length ? 'ERR ' + errs.join('\n') : 'ok');
await b.close();
