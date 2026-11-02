// BỘ ĐÁNH GIÁ VẠN LINH ĐẢO — chạy một lệnh, ra một bảng điểm.
// npm run danh-gia            → test logic, kiểm kiểu, cân bằng, build, bot chơi thử (điện thoại + máy tính)
// npm run danh-gia -- --server http://127.0.0.1:8787   → thêm kiểm thử server Cloudflare
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import zlib from 'zlib';

const args = process.argv.slice(2);
const serverUrl = args.includes('--server') ? args[args.indexOf('--server') + 1] : null;
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'report';
fs.mkdirSync(out, { recursive: true });
const sh = (cmd, opts = {}) => {
  try {
    return { ok: true, out: execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64e6, ...opts }) };
  } catch (e) {
    return { ok: false, out: (e.stdout ?? '') + (e.stderr ?? '') };
  }
};
const R = { t: new Date().toISOString(), parts: {} };
const log = (s) => console.log(s);

log('1/6 Test logic (vitest)...');
const unit = sh('npx vitest run --reporter=json --outputFile=' + out + '/unit.json');
const uj = fs.existsSync(out + '/unit.json') ? JSON.parse(fs.readFileSync(out + '/unit.json', 'utf8')) : null;
R.parts.unit = { passed: uj?.numPassedTests ?? 0, total: uj?.numTotalTests ?? 0 };

log('2/6 Kiểm kiểu TypeScript (client + server)...');
const tc = sh('npx tsc -p tsconfig.json && npx tsc -p server/tsconfig.json');
R.parts.types = { ok: tc.ok, out: tc.ok ? '' : tc.out.slice(0, 2000) };

log('3/6 Mô phỏng cân bằng 8 giờ chơi, 20 người...');
sh('npx tsx tools/balance-sim.mts 8 20');
const bal = JSON.parse(fs.readFileSync('/tmp/claude-0/shots/balance.json', 'utf8'));
fs.copyFileSync('/tmp/claude-0/shots/balance.json', out + '/balance.json');
const m = bal.moc_tien_trien_phut;
const within = (k, lo, hi, allowMissing = false) => {
  const v = m[k]?.phut_trung_vi;
  const missing = v === null || v === undefined;
  return { moc: k, phut: v ?? null, muc_tieu: allowMissing ? `sau ${lo} phút (chưa đạt trong 8 giờ cũng được)` : `${lo}–${hi} phút`, ok: missing ? allowMissing : v >= lo && v <= hi };
};
R.parts.balance = {
  targets: [within('thang_baicua', 0, 5), within('leu2', 3, 12), within('mo_minh_chau', 2, 20), within('leu3', 20, 100), within('leu4', 90, 300), within('leu5', 300, 99999, true)],
  winMatrix: bal.ti_le_thang_dao_quai_phan_tram,
};

log('4/6 Build bản phát hành...');
const build = sh('npx vite build');
const html = fs.readFileSync('dist/index.html');
R.parts.build = { ok: build.ok, kb: Math.round(html.length / 1024), gzipKb: Math.round(zlib.gzipSync(html).length / 1024) };

log('5/6 Bot chơi thử trên bản build (điện thoại + máy tính)...');
const srv = spawn('node', ['tools/serve.mjs', '5174'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const shotsDir = out + '/anh';
fs.mkdirSync(shotsDir, { recursive: true });
R.parts.play = {};
for (const d of ['phone', 'desktop']) {
  sh(`node tools/playtest.mjs http://127.0.0.1:5174/ ${shotsDir} ${d}`, { timeout: 300000 });
  const f = `${shotsDir}/playtest-${d}.json`;
  if (fs.existsSync(f)) {
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    R.parts.play[d] = { passed: j.checks.filter((c) => c.ok).length, total: j.checks.length, failed: j.checks.filter((c) => !c.ok), loadMs: j.loadMs, fpsIdle: j.fpsIdle, fpsPan: j.fpsPan, fpsBattle: j.fpsBattle, memMb: j.memMb, errors: j.errors };
  } else R.parts.play[d] = { passed: 0, total: 1, failed: [{ name: 'Bot không chạy được' }] };
}
srv.kill();

log('6/6 Kiểm thử server Cloudflare...');
if (serverUrl) {
  const st = sh(`npx tsx tools/server-test.mts ${serverUrl}`, { timeout: 120000 });
  const lines = st.out.split('\n').filter((l) => /^(ĐẠT|LỖI)/.test(l));
  R.parts.server = { passed: lines.filter((l) => l.startsWith('ĐẠT')).length, total: lines.length, lines };
} else R.parts.server = { skipped: 'Chưa bật server (thêm --server http://127.0.0.1:8787)' };

// ---- chấm điểm ----
const pct = (a, b) => (b ? a / b : 0);
const play = Object.values(R.parts.play);
const fpsMin = Math.min(...play.flatMap((p) => [p.fpsIdle?.fps ?? 0, p.fpsPan?.fps ?? 0, p.fpsBattle?.fps ?? 0]));
const score = {
  'Chức năng (bot chơi qua giao diện)': Math.round(30 * pct(play.reduce((t, p) => t + p.passed, 0), play.reduce((t, p) => t + p.total, 0))),
  'Logic và kiểu dữ liệu': Math.round(15 * pct(R.parts.unit.passed, R.parts.unit.total) * (R.parts.types.ok ? 1 : 0.5)),
  'Độ mượt (FPS thấp nhất)': Math.round(20 * Math.min(1, fpsMin / 55)),
  'Độ nhẹ (dung lượng, tải)': Math.round(10 * Math.min(1, 500 / Math.max(R.parts.build.gzipKb, 1)) * Math.min(1, 1500 / Math.max(...play.map((p) => p.loadMs ?? 9999)))),
  'Cân bằng tiến trình': Math.round(15 * pct(R.parts.balance.targets.filter((t) => t.ok).length, R.parts.balance.targets.length)),
  'Server online': R.parts.server.skipped ? null : Math.round(10 * pct(R.parts.server.passed, R.parts.server.total)),
};
const weights = { 'Chức năng (bot chơi qua giao diện)': 30, 'Logic và kiểu dữ liệu': 15, 'Độ mượt (FPS thấp nhất)': 20, 'Độ nhẹ (dung lượng, tải)': 10, 'Cân bằng tiến trình': 15, 'Server online': 10 };
const got = Object.values(score).reduce((t, v) => t + (v ?? 0), 0);
const possible = Object.entries(score).reduce((t, [k, v]) => t + (v === null ? 0 : weights[k]), 0);
R.score = { parts: score, total: Math.round((got / possible) * 100) };

const md = [
  `# Báo cáo đánh giá Vạn Linh Đảo`,
  `${new Date().toLocaleString('vi-VN')} · Điểm tổng: **${R.score.total}/100**`,
  '',
  '| Hạng mục | Điểm |',
  '| --- | --- |',
  ...Object.entries(score).map(([k, v]) => `| ${k} | ${v === null ? 'chưa chạy' : `${v}/${weights[k]}`} |`),
  '',
  `## Bot chơi thử`,
  ...Object.entries(R.parts.play).map(([d, p]) => `- ${d === 'phone' ? 'Điện thoại 390x844' : 'Máy tính 1280x800'}: ${p.passed}/${p.total} đạt · tải ${p.loadMs}ms · FPS đứng yên ${p.fpsIdle?.fps}, kéo bản đồ ${p.fpsPan?.fps}, trong trận ${p.fpsBattle?.fps}${p.failed.length ? ` · lỗi: ${p.failed.map((f) => f.name).join('; ')}` : ''}`),
  '',
  `## Cân bằng (người chơi chăm, chạm liên tục)`,
  ...R.parts.balance.targets.map((t) => `- ${t.ok ? 'Đạt' : 'Lệch'}: ${t.moc} lúc ${t.phut ?? '—'} phút (mục tiêu ${t.muc_tieu})`),
  '',
  `## Bản build`,
  `- ${R.parts.build.kb} KB (nén gzip ${R.parts.build.gzipKb} KB), một file HTML duy nhất`,
  '',
  `## Server`,
  R.parts.server.skipped ? `- ${R.parts.server.skipped}` : `- ${R.parts.server.passed}/${R.parts.server.total} đạt`,
  '',
  `Ghi chú: FPS đo trong máy ảo không có GPU (vẽ bằng CPU) nên là mức thấp nhất; điện thoại thật có GPU sẽ cao hơn hoặc bằng.`,
].join('\n');
fs.writeFileSync(out + '/danh-gia.md', md);
fs.writeFileSync(out + '/danh-gia.json', JSON.stringify(R, null, 2));
console.log('\n' + md);
