// Thám thính: nhìn vào bên trong đảo người khác (khi đảo không có khiên bảo hộ).
import type { UI } from './ui';
import type { IslandPub, ScoutReport } from '../../shared/logic';
import { LV_POS, SCOUT_COST } from '../../shared/logic';
import { COMPANIONS, GRID, LINH_VAT } from '../../shared/data';
import { BUILDINGS } from '../../shared/economy';
import { GEAR, GEAR_KEYS } from '../../shared/boss';
import { GENERALS, LEG_WEAPONS } from '../../shared/gacha';
import { hashStr } from '../../shared/rng';
import { drawIsland } from './art/islands';
import { drawDinh2 as drawDinh } from './art2/dinh2';
import { drawCuoc, drawLeu, drawRao } from './art/buildings';
import { iconUrl } from './art/textures';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fmt = (n: number) => (n >= 10000 ? (n / 1000).toFixed(0) + 'k' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.floor(n)));

/** Vẽ bản đồ bên trong đảo từ báo cáo thám thính. */
function preview(r: ScoutReport): string {
  const T = 16;
  const isl = drawIsland(r.land, hashStr(r.id), 1);
  let x0 = GRID, y0 = GRID, x1 = 0, y1 = 0;
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++)
      if (r.land[y * GRID + x] === '1') {
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
  const pad = 2;
  const sx = Math.max(0, x0 - pad) * T, sy = Math.max(0, y0 - pad - 1) * T;
  const w = (Math.min(GRID, x1 + pad + 1) * T) - sx, h = (Math.min(GRID, y1 + pad + 1) * T) - sy;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#3a90c2';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(isl, -sx, -sy);
  const items: [number, HTMLCanvasElement, number][] = [];
  const put = (img: HTMLCanvasElement, cx: number, cy: number) => items.push([cy, img, cx]);
  put(drawLeu(r.tiers.leu, false, 'thuong'), LV_POS.leu.x, LV_POS.leu.y);
  put(drawCuoc(r.tiers.cuoc, false, 'thuong'), LV_POS.cuoc.x, LV_POS.cuoc.y);
  put(drawRao(r.tiers.rao, false, 'thuong'), LV_POS.rao.x, LV_POS.rao.y);
  for (const d of r.dinh) put(drawDinh(d.k, d.lv), d.x, d.y);
  items.sort((a, b) => a[0] - b[0]);
  for (const [cy, img, cx] of items) ctx.drawImage(img, cx * T + 8 - img.width / 2 - sx, cy * T + 16 - img.height - sy);
  const big = document.createElement('canvas');
  big.width = w * 2;
  big.height = h * 2;
  const bx = big.getContext('2d')!;
  bx.imageSmoothingEnabled = false;
  bx.drawImage(c, 0, 0, w * 2, h * 2);
  return big.toDataURL();
}

export async function openScout(ui: UI, p: IslandPub) {
  const net = ui.store.net;
  if (!net.market) return ui.toast('Thám thính chỉ có ở bản chính thức.', 'bad');
  const o = await net.market('scout', { id: p.id });
  if (!o.ok) return ui.toast(o.msg, 'bad');
  const r = o.data as ScoutReport;
  const gen = r.gen ? `${GENERALS[r.gen.id].name} ${'★'.repeat(r.gen.star)}${r.gen.w ? ` · ${LEG_WEAPONS[r.gen.w].name}` : ''}` : 'không có';
  const res = Object.entries(r.res)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => `<span class="cost"><img src="${iconUrl(k)}" alt="">${fmt(v ?? 0)}</span>`)
    .join(' ');
  const builds = r.dinh.map((d) => `${BUILDINGS[d.k].names[d.lv - 1]}`).join(', ');
  const html = `
    <img class="scout-map" src="${preview(r)}" alt="Bên trong đảo">
    <div class="card"><small>Báo cáo thám tử · ${new Date(r.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</small>
      <p><b>${esc(r.islandName)}</b> · ${esc(r.name)} · cấp chúa đảo ${r.lvl} · giữ ${r.isles} đảo tự nhiên · thân thuyền ${Math.round(r.vo)}%</p>
      <p>${LINH_VAT.leu.tiers[r.tiers.leu - 1]} · ${LINH_VAT.cuoc.tiers[r.tiers.cuoc - 1]} · ${LINH_VAT.rao.tiers[r.tiers.rao - 1]} · ${LINH_VAT.thuyen.tiers[r.tiers.thuyen - 1]}</p>
      <p>Đội giữ đảo: ${r.team.map((t) => `${t.k === 'an' ? esc(r.name) : COMPANIONS[t.k].name} cấp ${t.lv}`).join(', ')}</p>
      <p>Chủ tướng: ${gen}</p>
      <p>Trang bị: ${GEAR_KEYS.filter((g) => r.gear[g] > 0).map((g) => `${GEAR[g].name} ×${r.gear[g]}`).join(', ') || 'không có'}</p>
      <p>Công trình: ${builds || 'chưa xây gì'}</p></div>
    <div class="card"><small>Kho (thám tử đếm được)</small><div class="costs">${res || 'trống'}</div></div>
    <p class="muted small">Thám thính tốn ${SCOUT_COST} đồng vàng. Đảo có khiên bảo hộ thì không lọt vào được.</p>`;
  ui.openSheet('scout', `Thám thính · ${p.islandName}`, html);
}
