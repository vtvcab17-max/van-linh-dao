// Giao diện hệ sinh thái: ruộng vườn, chuồng ao, xưởng chế biến, học viện, sửa đồ, thời tiết, kho.
import type { UI } from './ui';
import { armyLine } from './ui-army';
import { cropsFor, homeCell, pending, plotsOf, plotState, rationNeed, techLv, unitsOf, type PlayerState } from '../../shared/logic';
import { CROPS, dayPhase, GAME_DAY_MS, HIRE_COST, PENS, PER_WORKER, PLOT_YIELD, plotSeed, PROCS, regionOf, seasonOf, TECH_KEYS, TECH_MAX, TECHS, techCost, techMs, WEATHER, weatherAt, WIND_DIRS, WX_MS, type CropKey, type TechKey } from '../../shared/eco';
import { RES, RES_KEYS, type ResKey } from '../../shared/data';
import { GEAR, GEAR_KEYS } from '../../shared/boss';
import { bLevel, routePeriod, routesNear, SLOT_INFO, slotsOf, type Dinh } from '../../shared/economy';
import { SELL_CHO_BONUS, SELL_PRICE } from '../../shared/balance';
import { berthsUsed, fleetCap, SHIP_KINDS, SHIP_SIZE, SHIPS, WEAPON_KEYS, WEAPONS, type ShipKind, type ShipWeapon } from '../../shared/navy';
import { repairCost } from '../../shared/logic';
import { canvasUrl, iconUrl } from './art/textures';
import { menuIcon } from './art2/icons';
import { lookUrl, troopUrl } from './art2/portrait';
import { drawBoat } from './art2/builds';
import { C } from './art2/pal';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fmt = (n: number) => (n >= 10000 ? (n / 1000).toFixed(0) + 'k' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.floor(n)));
const hm = (ms: number) => {
  const m = Math.max(0, Math.ceil(ms / 60_000));
  return m >= 60 ? `${Math.floor(m / 60)} giờ ${m % 60} phút` : `${m} phút`;
};
const costs = (c: Partial<Record<ResKey, number>>, have?: Record<string, number>) =>
  Object.entries(c)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => `<span class="cost ${have && (have[k] ?? 0) < (v ?? 0) ? 'lack' : ''}"><img src="${iconUrl(k)}" alt="">${fmt(v ?? 0)}</span>`)
    .join(' ');

/** Phần thêm vào bảng công trình (ruộng, chuồng, xưởng, học viện, bến, lò rèn). Trả '' nếu không có. */
/** Giống đang chọn để gieo cho từng loại ruộng/vườn. */
const seedPick: Partial<Record<string, CropKey>> = {};
const clock = (ms: number) => {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};
/** Hình người trong từng ô: thợ, dân, học trò. */
const WORKER = { hat: 'khan_van', weapon: 'none', cloth: [C.brown, C.brown2] } as const;
const DAN = { hat: 'nonla', weapon: 'none', cloth: [C.indigo, C.indigo2] } as const;
const HOCTRO = { hat: 'toc_bui', weapon: 'none', cloth: [C.white, C.white2], belt: C.green2 } as const;
const shipIcon = (k: string) => canvasUrl(`berth-${k}`, () => drawBoat(k as 'ghe' | 'buom' | 'chien'), 1);
/** Hình đại diện cho ô của các công trình chỉ để xem (chợ, tháp, tường...). */
function showIcon(k: string): string {
  switch (k) {
    case 'cho': return iconUrl('tien');
    case 'tramthue': return shipIcon('ghe');
    case 'thapcanh': return troopUrl('cung');
    case 'tuong': return troopUrl('no');
    case 'donbinh': return troopUrl('khien');
    case 'xuongren': return menuIcon('build');
    case 'xuongcg': return troopUrl('no');
    case 'hocvien': return lookUrl('hoctro', { ...HOCTRO, cloth: [...HOCTRO.cloth] } as never);
    case 'den': return menuIcon('huong');
  }
  return iconUrl('tien');
}

/** Lưới ô làm việc bên trong công trình: tối thiểu 6 ô, lên cấp thêm ô (ô cấp sau hiện mờ). */
function interior(ui: UI, d: Dinh): string {
  const s = ui.store.s;
  const now = ui.store.now();
  const n = slotsOf(d.lv);
  const info = SLOT_INFO[d.k];
  const nextN = d.lv < 3 ? slotsOf(d.lv + 1) : n;
  const locked = Array.from({ length: nextN - n }, () => `<div class="slot locked"><small>Cấp ${d.lv + 1}</small></div>`).join('');
  const tile = (inner: string, cls = '', attrs = '') => `<button type="button" class="slot ${cls}" ${attrs}>${inner}</button>`;
  let tiles = '';
  let tools = '';
  let filled = n;
  switch (info.kind) {
    case 'plot': {
      const crops = cropsFor(d.k);
      const k = seedPick[d.k] && crops.includes(seedPick[d.k]!) ? seedPick[d.k]! : crops[0];
      const c = CROPS[k];
      const ps = plotsOf(d);
      let empty = 0, ripe = 0;
      tiles = ps
        .map((p, i) => {
          if (!p) {
            empty++;
            return tile('<b class="plus">+</b><small>Trống</small>', 'empty', `data-plot="${i}" aria-label="Gieo ${c.name} ở ô ${i + 1}"`);
          }
          const st = plotState(s, d, i, now)!;
          if (st.ripe) ripe++;
          return tile(`<img src="${iconUrl(st.out)}" alt=""><small>${st.ripe ? (st.over ? 'Hỏng nửa' : 'Chín!') : clock(st.left)}</small>${st.ripe ? '' : `<i class="pg"><b style="width:${Math.round(st.p * 100)}%"></b></i>`}`, st.ripe ? (st.over ? 'ripe over' : 'ripe') : 'grow', `data-plot="${i}"`);
        })
        .join('');
      filled = n - empty;
      const per = Math.max(1, Math.round(c.per * PLOT_YIELD * (1 + 0.2 * techLv(s, 'giongLua'))));
      tools = `${crops.length > 1 ? `<div class="seg" role="radiogroup">${crops.map((x) => `<button type="button" data-seed="${x}" role="radio" aria-checked="${x === k}">${CROPS[x].name}</button>`).join('')}</div>` : ''}
        <p class="muted small">${c.name}: lớn trong ${hm(c.ms)} · mỗi ô ~${per} ${RES[c.out].name} · giống ${costs(plotSeed(c))} mỗi ô. Chạm ô trống để gieo, ô chín để gặt.</p>
        <div class="row"><button type="button" class="primary" id="btnGieo" ${empty ? '' : 'disabled'}>Gieo ${empty} ô trống</button><button type="button" id="btnGat" ${ripe ? '' : 'disabled'}>Gặt ${ripe} ô chín</button></div>
        <p class="muted small">Mưa cây lớn nhanh, bão dập mất một phần${c.slow ? `, mùa ${c.slow} chậm lại` : ''}. Chín rồi để quá 8 giờ thì hỏng một nửa.</p>`;
      break;
    }
    case 'animal':
    case 'worker': {
      const u = unitsOf(d);
      filled = u;
      const animal = info.kind === 'animal';
      const P = animal ? PENS[d.k as keyof typeof PENS] : null;
      const icon = animal ? (d.k === 'aoca' ? iconUrl('ca') : menuIcon('ga')) : lookUrl('tho', { ...WORKER, cloth: [...WORKER.cloth] } as never);
      tiles = Array.from({ length: n }, (_, i) =>
        i < u ? tile(`<img src="${icon}" alt=""><small>${animal ? (d.k === 'aoca' ? 'Lứa cá' : 'Gà') : 'Thợ'}</small>`, 'busy') : tile(`<b class="plus">+</b><small>${animal ? 'Thả' : 'Thuê'}</small>`, 'empty', `${animal ? 'data-buy="1"' : 'data-hire="1"'} aria-label="${animal ? `Thả thêm ${P!.animal}` : 'Thuê thêm thợ'}"`),
      ).join('');
      const p = pending(s, d, now);
      const has = Object.values(p.give).some((v) => (v ?? 0) > 0);
      const rate = animal ? `Mỗi con: ${costs(P!.out)} mỗi giờ${Object.keys(P!.feed).length ? `, ăn ${costs(P!.feed)}` : ''}` : `Mỗi thợ: ${(PROCS[d.k as keyof typeof PROCS].rate * PER_WORKER).toFixed(1).replace('.', ',')} mẻ mỗi giờ`;
      tools = `<p class="muted small">${rate}. ${u < n ? `Thêm ${animal ? P!.animal : 'thợ'}: ${costs(animal ? P!.buy : HIRE_COST)}.` : 'Đã đủ ô.'}</p>
        <div class="card sub"><small>Đang có (${p.h.toFixed(1).replace('.', ',')}/12 giờ)</small>
        <p>Thu được: ${has ? costs(p.give) : '<span class="muted">chưa có gì</span>'}</p>
        ${Object.values(p.take).some((v) => (v ?? 0) > 0) ? `<p class="muted small">Sẽ dùng: ${costs(p.take)}</p>` : ''}
        <button type="button" class="primary wide" id="btnThuNT" ${has ? '' : 'disabled'}>Thu</button></div>`;
      break;
    }
    case 'ho':
      tiles = Array.from({ length: n }, () => tile(`<img src="${lookUrl('dan', { ...DAN, cloth: [...DAN.cloth] } as never)}" alt=""><small>+1 đồng/giờ</small>`, 'busy')).join('');
      break;
    case 'kho':
      tiles = Array.from({ length: n }, () => tile(`<img src="${iconUrl('thoc')}" alt=""><small>+5% kho</small>`, 'busy')).join('');
      break;
    case 'berth': {
      const cap = fleetCap(d.lv);
      const out: string[] = [];
      for (const sh of s.fleet) {
        const z = SHIP_SIZE[sh.k] ?? 2;
        const short = sh.k === 'chien' ? 'Hạm' : sh.k === 'buom' ? 'Buồm' : 'Ghe';
        for (let i = 0; i < z && out.length < cap; i++) out.push(tile(i === 0 ? `<img src="${shipIcon(sh.k)}" alt=""><small>${short}</small>` : '<small class="muted">neo</small>', i === 0 ? 'busy ship' : 'busy ship-tail'));
      }
      filled = out.length;
      while (out.length < cap) out.push(tile('<small>Trống</small>', 'empty'));
      tiles = out.join('');
      break;
    }
    case 'show': {
      const icon = showIcon(d.k);
      // trạm thuế: thương thuyền đang ghé (theo tuyến buôn đi ngang đảo)
      const on = d.k === 'tramthue' ? Math.min(n, routesNear(homeCell(s), routePeriod(now)).length * 2) : n;
      filled = on;
      tiles = Array.from({ length: n }, (_, i) => (i < on ? tile(`<img src="${icon}" alt="">`, 'busy') : tile('<small>Chờ thuyền</small>', 'empty'))).join('');
      break;
    }
  }
  return `<div class="card inner-card"><div class="inner-h"><b>Bên trong · ${filled}/${n} ${info.unit}</b>${d.lv < 3 ? `<small>Lên cấp ${d.lv + 1}: ${nextN} ô</small>` : '<small>Tối đa 12 ô</small>'}</div>
    <p class="muted small">${esc(info.desc)}</p>
    <div class="inner ${nextN > 9 ? 'c4' : ''}">${tiles}${locked}</div>${tools}</div>`;
}

/** Phần thêm vào bảng công trình: lưới ô bên trong và các việc riêng (học viện, bến, lò rèn). */
export function dinhExtra(ui: UI, d: Dinh): string {
  const s = ui.store.s;
  if (d.lv < 1) return '';
  const inner = interior(ui, d);
  return inner + dinhMore(ui, d, s);
}
function dinhMore(ui: UI, d: Dinh, s: PlayerState): string {
  if (d.k === 'hocvien') {
    const r = s.research;
    const rows = TECH_KEYS.map((k) => {
      const T = TECHS[k];
      const lv = techLv(s, k);
      const to = lv + 1;
      const can = !r && to <= Math.min(TECH_MAX, d.lv);
      return `<div class="isle-b"><div><b>${T.name}</b> <small>${T.branch} · cấp ${lv}/${TECH_MAX}</small><p class="muted small">${T.desc}</p>${to <= TECH_MAX ? `<div class="costs">${costs(techCost(to), s.res)} · ${hm(techMs(to))}</div>` : ''}</div>
        ${to <= TECH_MAX ? `<button type="button" data-tech="${k}" ${can ? '' : 'disabled'}>${to > d.lv ? `Cần HV cấp ${to}` : 'Học'}</button>` : '<span class="good">Tối đa</span>'}</div>`;
    }).join('');
    return `${r ? `<div class="card"><small>Đang nghiên cứu</small><p><b>${TECHS[r.k].name}</b> cấp ${r.to} · còn ${hm((r.end - (s.gt + (Date.now() - s.lastReal) * s.speed)) / s.speed)}</p></div>` : ''}<div class="card"><small>Nghiên cứu</small>${rows}</div>`;
  }
  if (d.k === 'benthuyen') {
    const rc = repairCost(s);
    const cap = fleetCap(d.lv);
    const used = berthsUsed(s.fleet);
    const ships = s.fleet
      .map((sh) => {
        const slots = sh.k === 'chien' ? 3 : sh.k === 'buom' ? 2 : 1;
        const used = WEAPON_KEYS.filter((w) => sh.w[w]);
        return `<div class="ship"><b>${SHIPS[sh.k].name}</b> <small>bền ${Math.round(sh.vo)}%${used.length ? ' · ' + used.map((w) => WEAPONS[w].name).join(', ') : ''}</small>
          ${used.length < slots ? `<div class="row">${WEAPON_KEYS.filter((w) => !sh.w[w]).map((w) => `<button type="button" data-vk="${sh.id}:${w}" title="${WEAPONS[w].desc}">Lắp ${WEAPONS[w].name} ${costs(WEAPONS[w].cost)}</button>`).join('')}</div>` : ''}
          <button type="button" class="link" data-phatau="${sh.id}">tháo dỡ</button></div>`;
      })
      .join('');
    const build = SHIP_KINDS.map((k) => `<button type="button" class="wide" data-ship="${k}" ${d.lv < SHIPS[k].need || used + (SHIP_SIZE[k] ?? 2) > cap ? 'disabled' : ''}><b>${SHIPS[k].name}</b> · ${SHIP_SIZE[k]} chỗ neo ${d.lv < SHIPS[k].need ? `(cần xưởng cấp ${SHIPS[k].need})` : ''} · ${costs(SHIPS[k].cost, s.res)}<br><small>${SHIPS[k].desc}</small></button>`).join('');
    return `<div class="card"><small>Thuyền chính</small><div class="hpbar hull"><i style="width:${Math.round(s.vo)}%"></i></div><p>Độ bền <b>${Math.round(s.vo)}%</b>${s.vo < 30 ? ' · <b class="bad">thuyền đi chậm 30%</b>' : ''}${s.vo <= 0 ? ' · <b class="bad">không ra khơi được</b>' : ''}</p>
      ${rc ? `<div class="costs">${costs(rc, s.res)}</div><button type="button" class="primary wide" id="btnSuaThuyen">Sửa thuyền và hạm đội</button>` : '<p class="good">Thuyền còn nguyên.</p>'}</div>
      <div class="card"><small>Hạm đội (${s.fleet.length} thuyền · ${used}/${cap} chỗ neo)</small>${ships || '<p class="muted small">Chưa có thuyền chiến. Thuyền chiến theo thuyền chính ra trận và giữ bến khi ở nhà.</p>'}</div>
      <div class="card"><small>Đóng thuyền mới</small>${build}</div>`;
  }
  if (d.k === 'xuongren') {
    const rows = GEAR_KEYS.filter((g) => s.kho[g] > 0).map((g) => `<p>${GEAR[g].name} ×${s.kho[g]}: <b class="${s.ben[g] < 40 ? 'bad' : ''}">${Math.round(s.ben[g])}%</b></p>`).join('');
    return `<div class="card"><small>Sửa trang bị</small>${rows || '<p class="muted">Chưa có trang bị.</p>'}<p class="muted small">Mỗi trận trang bị mòn đi. Dưới 40% chỉ còn nửa tác dụng, hỏng hẳn thì mất tác dụng.</p>
      ${rows ? '<button type="button" class="primary wide" id="btnSuaDo">Sửa tất cả</button>' : ''}</div>`;
  }
  return '';
}

/** Xử lý bấm nút trong phần thêm. Trả true nếu đã xử lý. */
export function dinhClick(ui: UI, d: Dinh, t: HTMLElement): boolean {
  const run = (o: { ok: boolean; msg: string }) => ui.toast(o.msg, o.ok ? 'gold' : 'bad');
  const crops = cropsFor(d.k);
  const pickK = seedPick[d.k] && crops.includes(seedPick[d.k]!) ? seedPick[d.k]! : crops[0];
  if (t.dataset.seed) return (seedPick[d.k] = t.dataset.seed as CropKey), true;
  if (t.dataset.plot !== undefined) {
    const i = Number(t.dataset.plot);
    const p = plotsOf(d)[i];
    if (!p) return run(ui.store.do({ t: 'trong', id: d.id, k: pickK, slot: i })), true;
    const st = plotState(ui.store.s, d, i, ui.store.now());
    if (st?.ripe) return run(ui.store.do({ t: 'gat', id: d.id, slot: i })), true;
    ui.toast(`${CROPS[p.k].name} còn ${hm(st?.left ?? 0)} nữa thì chín.`, 'muted');
    return true;
  }
  if (t.id === 'btnGieo') return run(ui.store.do({ t: 'trong', id: d.id, k: pickK })), true;
  if (t.id === 'btnGat') return run(ui.store.do({ t: 'gat', id: d.id })), true;
  if (t.dataset.buy) return run(ui.store.do({ t: 'nuoi', id: d.id })), true;
  if (t.dataset.hire) return run(ui.store.do({ t: 'thue', id: d.id })), true;
  if (t.id === 'btnThuNT') return run(ui.store.do({ t: 'thuNT', id: d.id })), true;
  if (t.dataset.tech) return run(ui.store.do({ t: 'hoc', k: t.dataset.tech as TechKey })), true;
  if (t.id === 'btnSuaThuyen') return run(ui.store.do({ t: 'suaThuyen' })), true;
  if (t.id === 'btnSuaDo') return run(ui.store.do({ t: 'suaDo' })), true;
  if (t.dataset.ship) return run(ui.store.do({ t: 'dongTau', k: t.dataset.ship as ShipKind })), true;
  if (t.dataset.vk) {
    const [id, w] = t.dataset.vk.split(':');
    return run(ui.store.do({ t: 'lapVK', id, w: w as ShipWeapon })), true;
  }
  if (t.dataset.phatau) return run(ui.store.do({ t: 'phaTau', id: t.dataset.phatau })), true;
  return false;
}

// ---------------- thời tiết ----------------
export function wxNow(s: PlayerState, now: number) {
  const region = regionOf(homeCell(s));
  return { wx: weatherAt(region, now), phase: dayPhase(now), season: seasonOf(now), region };
}
export function wxChip(s: PlayerState, now: number) {
  const { wx, phase, season } = wxNow(s, now);
  const W = WEATHER[wx.kind];
  return `${phase.night ? '🌙' : W.icon} ${W.name} · ${season}`;
}
export function openWeather(ui: UI) {
  const s = ui.store.s;
  const now = ui.store.now();
  const { wx, phase, season, region } = wxNow(s, now);
  const W = WEATHER[wx.kind];
  const slot0 = Math.floor(now / WX_MS) * WX_MS;
  const fc = Array.from({ length: 6 }, (_, i) => {
    const t = slot0 + (i + 1) * WX_MS;
    const w = weatherAt(region, t);
    const d = new Date(t);
    return `<div class="fc"><small>${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</small><b>${WEATHER[w.kind].icon}</b><span>${WEATHER[w.kind].name}</span><small>gió ${WIND_DIRS[w.dir]} ${w.wind}</small></div>`;
  }).join('');
  const html = `
    <div class="card"><small>Vùng biển quanh đảo bạn</small>
      <p class="big">${W.icon} <b>${W.name}</b> · gió ${WIND_DIRS[wx.dir]} cấp ${wx.wind}</p>
      <p>${phase.name} · ngày ${phase.day} · mùa ${season} (mỗi ngày trong game dài ${GAME_DAY_MS / 3600_000} giờ, mỗi mùa 7 ngày thật)</p>
      <p class="muted small">${W.desc}</p></div>
    <div class="fcs">${fc}</div>
    <div class="card"><small>Ảnh hưởng</small>
      <p>Cây trồng ×${W.grow} · đánh xa ×${W.back} · cận chiến ×${W.front} · bệnh trên biển ×${W.sick} · thuyền hao mòn ×${W.wear} · thời gian đi biển ×${W.sail}</p>
      <p class="muted small">Xuôi gió thuyền đi nhanh hơn, ngược gió chậm hơn (học La Bàn để bớt chậm). Ban đêm biển tối, đánh úp dễ hơn.</p></div>`;
  ui.openSheet('wx', 'Thời tiết', html);
}

// ---------------- kho ----------------
/** Nguồn và chỗ dùng của từng tài nguyên (hiện khi chạm vào). */
const RES_INFO: Record<ResKey, [string, string]> = {
  co: ['Nhặt ở bụi cỏ tranh', 'Nuôi linh vật, thức ăn vật nuôi, bán ở sạp chợ'],
  la: ['Nhặt ở cây dừa', 'Gói thực phẩm khi muối/phơi, nhà thuốc, bán ở sạp chợ'],
  tre: ['Nhặt ở bụi tre', 'Xây nhà, vườn, bến, hàng rào'],
  go: ['Nhặt ở cây dừa', 'Xây hầu hết công trình'],
  cui: ['Nhặt củi trôi dạt', 'Nhiên liệu cho Bếp, nuôi linh vật, bán ở sạp chợ'],
  da: ['Nhặt ở mỏm đá', 'Xây tường, tháp, nhà cấp cao'],
  sat: ['Nhặt sắt vụn, thắng quái', 'Nâng cấp công trình, cuốc, thuyền chiến'],
  so: ['Hòm báu, thắng quái', 'Tiến hóa linh vật, xây chợ, miếu'],
  ngoc: ['Quái mạnh, hòm hiếm', 'Công trình cấp cao, tiến hóa bậc cuối'],
  tien: ['Thuế nhà dân, thương nhân, bán nguyên liệu', 'Mua giống, thuê thợ, học viện'],
  lt: ['Phần thưởng, mua gói', 'Quay Vòng Quay'],
  thoc: ['Gặt ở ruộng', 'Nấu lương ở Nhà Bếp, nuôi vật nuôi, học viện'],
  gao: ['Cối xay cũ (không xây mới)', 'Ăn trên biển, không có buff'],
  rau: ['Gặt ở vườn', 'Nuôi vật nuôi, nấu ăn. Chóng hỏng'],
  thit: ['Mổ lợn, chuồng trại', 'Ăn trên biển: công +12%. Nấu lương. Chóng hỏng'],
  trung: ['Gà mái đẻ', 'Ăn hoặc ấp. Chóng hỏng'],
  ca: ['Câu cá, ao cá', 'Ăn trên biển: máu +12%. Nấu lương. Chóng hỏng'],
  luong: ['Nấu ở Nhà Bếp', 'Lương ra khơi: công và máu +8%'],
  thaoduoc: ['Hàng cũ: tự đổi thành thuốc', 'Không còn dùng'],
  to: ['Hàng cũ: tự đổi thành vải', 'Không còn dùng'],
  duoc: ['Gặt ở vườn thuốc', 'Chữa bệnh trên biển'],
  vai: ['Gặt ở nương dâu', 'Buồm, thuyền lớn'],
};
export function openKho(ui: UI) {
  const draw = () => {
    const s = ui.store.s;
    const groups: [string, ResKey[]][] = [
      ['Tiền', ['tien', 'so', 'ngoc', 'lt']],
      ['Vật liệu', ['go', 'da', 'tre', 'sat', 'co', 'la', 'cui']],
      ['Nông sản', ['thoc', 'rau', 'thit', 'trung', 'ca', 'gao']],
      ['Quân nhu', ['luong', 'duoc', 'vai']],
    ];
    const sellable = (k: ResKey) => (k === 'co' || k === 'la' || k === 'cui') && s.res[k] >= 10;
    return groups
      .map(([g, ks]) => `<div class="card"><small>${g}</small><div class="kho">${ks.filter((k) => RES_KEYS.includes(k)).map((k) => `<button type="button" class="cost" data-info="${k}"><img src="${iconUrl(k)}" alt="">${RES[k].name}: <b>${fmt(s.res[k])}</b></button>`).join('')}</div></div>`)
      .join('') +
      `<div class="card" id="khoInfo"><small>Chạm một loại để xem nguồn và chỗ dùng</small></div>
      <div class="card"><small>Bán nguyên liệu dư ở sạp chợ</small>
        <div class="row" style="flex-wrap:wrap">${(['co', 'la', 'cui'] as ResKey[]).map((k) => `<button type="button" data-sell="${k}" ${sellable(k) ? '' : 'disabled'}><img src="${iconUrl(k)}" alt="" style="width:18px;vertical-align:middle"> Bán ${RES[k].name} (${SELL_PRICE[k]} đ)</button>`).join('')}</div>
        <p class="muted small">Mỗi lượt bán 10 (cần có ít nhất 10). Có Chợ thì giá cao hơn ${SELL_CHO_BONUS * 100}% mỗi cấp.</p></div>
      <div class="card"><small>Thuyền và trang bị</small><p>Thân thuyền: <b>${Math.round(s.vo)}%</b> ${bLevel(s.dinh, 'benthuyen') ? '' : '<span class="muted">(xây Bến Thuyền để sửa)</span>'}</p>
        ${GEAR_KEYS.filter((g) => s.kho[g] > 0).map((g) => `<p>${GEAR[g].name} ×${s.kho[g]} · bền ${Math.round(s.ben[g])}%</p>`).join('')}</div>`;
  };
  ui.openSheet('kho', 'Kho đảo', draw(), (body) => {
    body.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('button');
      if (!t) return;
      if (t.dataset.info) {
        const k = t.dataset.info as ResKey;
        body.querySelector('#khoInfo')!.innerHTML = `<small>${RES[k].name}</small><p>Lấy từ: ${RES_INFO[k][0]}</p><p>Dùng cho: ${RES_INFO[k][1]}</p>`;
      } else if (t.dataset.sell) {
        const k = t.dataset.sell as ResKey;
        const o = ui.store.do({ t: 'banNL', res: k, n: Math.min(10, Math.floor(ui.store.s.res[k])) });
        ui.toast(o.msg, o.ok ? 'gold' : 'bad');
        body.innerHTML = draw();
      }
    });
  });
}

/** Dòng hậu cần trong bảng ra khơi: lương, thuốc, thân thuyền. */
export function supplyLine(s: PlayerState, oneWayMs: number) {
  return supplyCard(s, oneWayMs) + armyLine(s);
}
function supplyCard(s: PlayerState, oneWayMs: number) {
  const need = rationNeed(s, oneWayMs);
  const have = s.res.luong + Math.floor(s.res.gao / 2) + s.res.ca + s.res.thit;
  const ok = have >= need;
  return `<div class="card ${ok ? '' : 'danger-card'}"><small>Hậu cần</small>
    <p>Lương cho cả chuyến: <b>${need}</b> khẩu phần · đang có ${have} ${ok ? '' : '<b class="bad">(thiếu: quân sẽ đói, đánh yếu đi)</b>'}</p>
    <p>Thuốc men mang theo: ${Math.min(s.res.duoc, 10)} liều · thân thuyền ${Math.round(s.vo)}%${s.vo < 30 ? ' <b class="bad">(đi chậm)</b>' : ''}</p>
    <p class="muted small">Bữa ăn là buff: lương nấu (công, máu +8%) dùng trước, rồi thịt (công +12%), cá (máu +12%), cuối cùng gạo (2 gạo = 1 khẩu phần, không buff). Đi càng lâu càng tốn lương, càng dễ đổ bệnh.</p></div>`;
}

/** Lớp phủ ngày đêm, mưa, sương mù trên màn hình. */
export function renderWxFx(s: PlayerState, now: number) {
  const el = document.getElementById('wxfx');
  if (!el) return;
  const { wx, phase } = wxNow(s, now);
  el.style.setProperty('--dark', String(phase.dark * 0.45));
  el.className = `wx-${wx.kind}`;
}
