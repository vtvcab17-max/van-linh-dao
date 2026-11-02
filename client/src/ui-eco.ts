// Giao diện hệ sinh thái: ruộng vườn, chuồng ao, xưởng chế biến, học viện, sửa đồ, thời tiết, kho.
import type { UI } from './ui';
import { cropState, cropsFor, homeCell, pending, rationNeed, techLv, type PlayerState } from '../../shared/logic';
import { CROPS, dayPhase, GAME_DAY_MS, regionOf, seasonOf, TECH_KEYS, TECH_MAX, TECHS, techCost, techMs, WEATHER, weatherAt, WIND_DIRS, WX_MS, type CropKey, type TechKey } from '../../shared/eco';
import { RES, RES_KEYS, type ResKey } from '../../shared/data';
import { GEAR, GEAR_KEYS } from '../../shared/boss';
import { bLevel, type Dinh } from '../../shared/economy';
import { iconUrl } from './art/textures';

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
export function dinhExtra(ui: UI, d: Dinh): string {
  const s = ui.store.s;
  if (d.lv < 1) return '';
  const now = ui.store.now();
  const crops = cropsFor(d.k);
  if (crops.length) {
    const st = cropState(s, d, now);
    if (!st)
      return `<div class="card"><small>Gieo trồng</small>${crops
        .map((k) => {
          const c = CROPS[k];
          return `<button type="button" class="wide" data-plant="${k}">${c.name} · ${hm(c.ms)} · ra ~${Math.round(c.per * d.lv * (1 + 0.2 * techLv(s, 'giongLua')))} ${RES[c.out].name} · giống ${costs(c.seed)}</button>`;
        })
        .join('')}<p class="muted small">Mưa cây lớn nhanh, bão dập mất một phần, ${CROPS[crops[0]].slow ? `mùa ${CROPS[crops[0]].slow} chậm lại` : ''}. Chín rồi để quá 8 giờ thì hỏng một nửa.</p></div>`;
    const c = CROPS[d.crop!.k];
    return `<div class="card"><small>${c.name}</small><div class="hpbar grow"><i style="width:${Math.round(st.p * 100)}%"></i></div>
      <p>${st.ripe ? `<b class="good">Đã chín</b>${st.over ? ' · <b class="bad">để quá lâu, hỏng một nửa</b>' : ''}` : `Đang lớn ${Math.floor(st.p * 100)}%`} · thu được ${st.n} ${RES[st.out].name}${st.storms ? ` (bị bão ${st.storms} lần)` : ''}</p>
      <button type="button" class="primary wide" id="btnGat" ${st.ripe ? '' : 'disabled'}>Thu hoạch</button></div>`;
  }
  if (['chuong', 'aoca', 'coixay', 'bep', 'nhathuoc', 'khungcui'].includes(d.k)) {
    const p = pending(s, d, now);
    const has = Object.values(p.give).some((v) => (v ?? 0) > 0);
    return `<div class="card"><small>Đang có (${p.h.toFixed(1).replace('.', ',')}/12 giờ)</small>
      <p>Thu được: ${has ? costs(p.give) : '<span class="muted">chưa có gì</span>'}</p>
      ${Object.values(p.take).some((v) => (v ?? 0) > 0) ? `<p class="muted small">Sẽ dùng: ${costs(p.take)}</p>` : ''}
      <button type="button" class="primary wide" id="btnThuNT" ${has ? '' : 'disabled'}>Thu</button>
      <p class="muted small">Giữ tối đa 12 giờ sản phẩm, ghé thu thường xuyên.</p></div>`;
  }
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
    const miss = 100 - s.vo;
    return `<div class="card"><small>Thân thuyền</small><div class="hpbar hull"><i style="width:${Math.round(s.vo)}%"></i></div><p>Độ bền <b>${Math.round(s.vo)}%</b>${s.vo < 30 ? ' · <b class="bad">thuyền đi chậm 30%</b>' : ''}${s.vo <= 0 ? ' · <b class="bad">không ra khơi được</b>' : ''}</p>
      ${miss > 0 ? `<div class="costs">${costs({ go: Math.ceil(miss * 1.2 * s.lv.thuyen.tier), vai: Math.ceil(miss / 12) }, s.res)}</div><button type="button" class="primary wide" id="btnSuaThuyen">Sửa thuyền, vá buồm</button>` : '<p class="good">Thuyền còn nguyên.</p>'}</div>`;
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
  if (t.dataset.plant) return run(ui.store.do({ t: 'trong', id: d.id, k: t.dataset.plant as CropKey })), true;
  if (t.id === 'btnGat') return run(ui.store.do({ t: 'gat', id: d.id })), true;
  if (t.id === 'btnThuNT') return run(ui.store.do({ t: 'thuNT', id: d.id })), true;
  if (t.dataset.tech) return run(ui.store.do({ t: 'hoc', k: t.dataset.tech as TechKey })), true;
  if (t.id === 'btnSuaThuyen') return run(ui.store.do({ t: 'suaThuyen' })), true;
  if (t.id === 'btnSuaDo') return run(ui.store.do({ t: 'suaDo' })), true;
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
export function openKho(ui: UI) {
  const s = ui.store.s;
  const groups: [string, ResKey[]][] = [
    ['Tiền', ['lt', 'tien', 'so', 'ngoc']],
    ['Vật liệu', ['co', 'la', 'tre', 'go', 'cui', 'da', 'sat']],
    ['Nông sản', ['thoc', 'gao', 'rau', 'thit', 'trung', 'ca', 'thaoduoc', 'to']],
    ['Quân nhu', ['luong', 'duoc', 'vai']],
  ];
  const html = groups
    .map(([g, ks]) => `<div class="card"><small>${g}</small><div class="kho">${ks.filter((k) => RES_KEYS.includes(k)).map((k) => `<span class="cost"><img src="${iconUrl(k)}" alt="">${RES[k].name}: <b>${fmt(s.res[k])}</b></span>`).join('')}</div></div>`)
    .join('') +
    `<div class="card"><small>Thuyền và trang bị</small><p>Thân thuyền: <b>${Math.round(s.vo)}%</b> ${bLevel(s.dinh, 'benthuyen') ? '' : '<span class="muted">(xây Bến Thuyền để sửa)</span>'}</p>
      ${GEAR_KEYS.filter((g) => s.kho[g] > 0).map((g) => `<p>${GEAR[g].name} ×${s.kho[g]} · bền ${Math.round(s.ben[g])}%</p>`).join('')}</div>`;
  ui.openSheet('kho', 'Kho đảo', html);
}

/** Dòng hậu cần trong bảng ra khơi: lương, thuốc, thân thuyền. */
export function supplyLine(s: PlayerState, oneWayMs: number) {
  const need = rationNeed(s, oneWayMs);
  const have = s.res.luong + Math.floor(s.res.gao / 2) + s.res.ca + s.res.thit;
  const ok = have >= need;
  return `<div class="card ${ok ? '' : 'danger-card'}"><small>Hậu cần</small>
    <p>Lương cho cả chuyến: <b>${need}</b> khẩu phần · đang có ${have} ${ok ? '' : '<b class="bad">(thiếu: quân sẽ đói, đánh yếu đi)</b>'}</p>
    <p>Thuốc men mang theo: ${Math.min(s.res.duoc, 10)} liều · thân thuyền ${Math.round(s.vo)}%${s.vo < 30 ? ' <b class="bad">(đi chậm)</b>' : ''}</p>
    <p class="muted small">Lương khô dùng trước, thiếu thì lấy gạo (2 gạo = 1 khẩu phần), cá, thịt. Đi càng lâu càng tốn lương, càng dễ đổ bệnh.</p></div>`;
}

/** Lớp phủ ngày đêm, mưa, sương mù trên màn hình. */
export function renderWxFx(s: PlayerState, now: number) {
  const el = document.getElementById('wxfx');
  if (!el) return;
  const { wx, phase } = wxNow(s, now);
  el.style.setProperty('--dark', String(phase.dark * 0.45));
  el.className = `wx-${wx.kind}`;
}
