// Giao diện Vòng Quay Vạn Linh, Tướng, Gói lượt quay, đổi Linh Thạch.
import type { UI } from './ui';
import type { SpinResult } from '../../shared/logic';
import {
  FRAG_PER_GENERAL, GEN_IDS, GENERALS, LEG_IDS, LEG_WEAPONS, LT_BUY_DAILY, LT_BUY_PRICE, LT_SELL_PRICE, MAX_STAR, PITY, RARITY_COLOR, RARITY_ORDER, SPIN10_COST, SPIN_COST, SPIN_PACKS, starMult, WHEEL, WHEEL_TOTAL,
  type GenId, type LegWeaponId, type Slot,
} from '../../shared/gacha';
import { ITEMS, type ItemKey } from '../../shared/economy';
import { RES, type ResKey } from '../../shared/data';
import { menuIcon } from './art2/icons';
import { drawItemIcon } from './art/items';
import { sound } from './audio';
import { dayOf } from '../../shared/economy';
import { SKILLS } from '../../shared/data';
import { generalUnit } from '../../shared/gacha';
import { generalUrl, legWeaponUrl } from './art2/portrait';
import { canvasUrl, iconUrl } from './art/textures';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const vnd = (n: number) => n.toLocaleString('vi-VN') + 'đ';
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(MAX_STAR - n);

// ---------------- VÒNG QUAY ----------------
type Tier = 'tt' | 'st' | 'h' | 'th';
const TIER_NAME: Record<Tier, string> = { tt: 'Truyền thuyết', st: 'Sử thi', h: 'Hiếm', th: 'Thường' };
const TIER_COLOR: Record<Tier, string> = { tt: '#ffcf4d', st: '#c792ff', h: '#6fb6ff', th: '#e8d9b4' };
const tierOf = (w: Slot): Tier => (w.leg ? 'tt' : ['tuong_st', 'vay', 'trong', 'manh'].includes(w.id) ? 'st' : ['tuong_h', 'lenh', 'the', 'ngocden'].includes(w.id) ? 'h' : 'th');
const POOL_FACE: Record<string, GenId> = { 'Truyền Thuyết': 'giong', 'Sử Thi': 'auco', 'Hiếm': 'nghiaquan' };
const fmt = (n: number) => n.toLocaleString('vi-VN');

/** Hình của một ô giải (data URL). */
function slotIcon(w: Slot, got?: string): string {
  const p = w.prize;
  if (p.k === 'gen') return generalUrl(got && got in GENERALS ? got : POOL_FACE[p.pool as string] ?? 'giong', 2);
  if (p.k === 'weapon') return legWeaponUrl(got && got in LEG_WEAPONS ? got : 'nothan', 3);
  if (p.k === 'frag') return menuIcon('manh');
  if (p.k === 'item') return canvasUrl('item-' + p.item, () => drawItemIcon(p.item as ItemKey), 3);
  const keys = Object.keys(p.res);
  return keys.length > 1 ? menuIcon('vatlieu') : iconUrl(keys[0]);
}
/** Số lượng in nhỏ dưới hình. */
function slotQty(w: Slot): string {
  const p = w.prize;
  if (p.k === 'frag') return `×${p.n}`;
  if (p.k === 'item') return p.n > 1 ? `×${p.n}` : '';
  if (p.k === 'res') {
    const v = Object.values(p.res);
    const x = v[0] ?? 0;
    return v.length > 1 ? 'Lớn' : `×${x >= 1000 ? `${x / 1000}K` : x}`;
  }
  return '';
}
/** Thông tin chi tiết khi nhấn giữ. */
function slotInfo(w: Slot): string {
  const p = w.prize;
  if (p.k === 'gen') {
    const names = GEN_IDS.filter((id) => GENERALS[id].rarity === p.pool).map((id) => GENERALS[id].name);
    return `Chiêu mộ ngẫu nhiên 1 tướng ${String(p.pool).toLowerCase()}: ${names.join(', ')}. Trùng tướng thì lên sao (tối đa ${MAX_STAR}★), đủ sao đổi ra mảnh.`;
  }
  if (p.k === 'weapon') return `Một trong ${LEG_IDS.length} vũ khí: ${LEG_IDS.map((id) => LEG_WEAPONS[id].name).join(', ')}. Đeo cho chủ tướng; đúng tướng hợp thì mạnh gấp rưỡi.`;
  if (p.k === 'frag') return `${p.n} mảnh tướng truyền thuyết. Đủ ${FRAG_PER_GENERAL} mảnh ghép được một tướng truyền thuyết tự chọn.`;
  if (p.k === 'item') return `${ITEMS[p.item as ItemKey].desc}${p.n > 1 ? ` Nhận ${p.n} cái.` : ''}`;
  return Object.entries(p.res).map(([k, v]) => `${RES[k as ResKey]?.name ?? k} ${fmt(v ?? 0)}`).join(' · ');
}
const oddsOf = (w: Slot) => (w.weight / WHEEL_TOTAL) * 100;
const pctText = (x: number) => `${x.toFixed(x < 1 ? 2 : 1).replace('.', ',')}%`;

const imgCache = new Map<string, Promise<HTMLImageElement>>();
function loadImg(src: string) {
  let p = imgCache.get(src);
  if (!p) {
    p = new Promise((ok) => {
      const im = new Image();
      im.onload = () => ok(im);
      im.onerror = () => ok(im);
      im.src = src;
    });
    imgCache.set(src, p);
  }
  return p;
}

/** Mặt vòng quay: mỗi ô một hình phần thưởng, viền màu theo độ hiếm. */
async function drawWheel(cv: HTMLCanvasElement) {
  const n = WHEEL.length;
  const ctx = cv.getContext('2d')!;
  const S = cv.width, R = S / 2;
  const imgs = await Promise.all(WHEEL.map((w) => loadImg(slotIcon(w))));
  await document.fonts?.load(`700 ${Math.round(R * 0.09)}px Handjet`).catch(() => undefined);
  ctx.clearRect(0, 0, S, S);
  ctx.imageSmoothingEnabled = false;
  for (let i = 0; i < n; i++) {
    const w = WHEEL[i];
    const tier = tierOf(w);
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(R, R);
    ctx.arc(R, R, R - 2, a0, a1);
    ctx.closePath();
    if (tier === 'tt') {
      const g = ctx.createRadialGradient(R, R, R * 0.2, R, R, R);
      g.addColorStop(0, '#fff3b0');
      g.addColorStop(1, '#f3b53a');
      ctx.fillStyle = g;
    } else ctx.fillStyle = i % 2 ? '#fff4dc' : '#f7e3b8';
    ctx.fill();
    // dải màu độ hiếm sát vành
    ctx.beginPath();
    ctx.arc(R, R, R - 9, a0 + 0.01, a1 - 0.01);
    ctx.strokeStyle = TIER_COLOR[tier];
    ctx.lineWidth = 10;
    ctx.stroke();
    // vạch chia ô
    ctx.beginPath();
    ctx.moveTo(R, R);
    ctx.lineTo(R + Math.cos(a0) * (R - 2), R + Math.sin(a0) * (R - 2));
    ctx.strokeStyle = '#b77a35';
    ctx.lineWidth = 2;
    ctx.stroke();
    // hình phần thưởng dựng đứng hướng ra vành
    ctx.save();
    ctx.translate(R, R);
    ctx.rotate((a0 + a1) / 2 + Math.PI / 2);
    const im = imgs[i];
    const box = R * 0.25;
    const k = Math.min(box / (im.width || 1), box / (im.height || 1));
    const iw = Math.round((im.width || 1) * k), ih = Math.round((im.height || 1) * k);
    ctx.drawImage(im, -iw / 2, -R * 0.7 - ih / 2, iw, ih);
    const q = slotQty(w);
    if (q) {
      ctx.font = `700 ${Math.round(R * 0.085)}px Handjet, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#fff8e6';
      ctx.strokeText(q, 0, -R * 0.5);
      ctx.fillStyle = '#5a2a18';
      ctx.fillText(q, 0, -R * 0.5);
    }
    ctx.restore();
  }
  // vành trong quanh trục
  ctx.beginPath();
  ctx.arc(R, R, R * 0.24, 0, Math.PI * 2);
  ctx.fillStyle = '#7a2e2a';
  ctx.fill();
}

/** Vành ngoài đứng yên, đèn nhấp nháy xen kẽ. */
function drawRim(cv: HTMLCanvasElement, phase: number) {
  const ctx = cv.getContext('2d')!;
  const S = cv.width, R = S / 2;
  ctx.clearRect(0, 0, S, S);
  ctx.beginPath();
  ctx.arc(R, R, R - 9, 0, Math.PI * 2);
  ctx.lineWidth = 16;
  ctx.strokeStyle = '#8a2f24';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(R, R, R - 2, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffd955';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(R, R, R - 16, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#e3a52e';
  ctx.stroke();
  const bulbs = 24;
  for (let i = 0; i < bulbs; i++) {
    const a = (i / bulbs) * Math.PI * 2;
    const x = R + Math.cos(a) * (R - 9), y = R + Math.sin(a) * (R - 9);
    const on = (i + phase) % 2 === 0;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = on ? '#fff6c0' : '#c98a2c';
    ctx.shadowColor = on ? '#ffe27a' : 'transparent';
    ctx.shadowBlur = on ? 8 : 0;
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

/** Bong bóng thông tin khi nhấn giữ (hoặc rê chuột) lên một phần thưởng. */
function showTip(host: HTMLElement, x: number, y: number, w: Slot, extra?: string, got?: string) {
  let tip = host.querySelector<HTMLElement>('.gtip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'gtip';
    host.appendChild(tip);
  }
  const tier = tierOf(w);
  tip.style.setProperty('--rc', TIER_COLOR[tier]);
  tip.innerHTML = `<div class="gtip-h"><img src="${slotIcon(w, got)}" alt=""><div><b>${esc(extra ?? w.label)}</b><small><span class="tag">${TIER_NAME[tier]}</span> · tỉ lệ ${pctText(oddsOf(w))}</small></div></div><p>${esc(slotInfo(w))}</p>`;
  tip.hidden = false;
  const hb = host.getBoundingClientRect();
  const tw = Math.min(260, hb.width - 16);
  tip.style.width = `${tw}px`;
  const left = Math.max(8, Math.min(hb.width - tw - 8, x - hb.left - tw / 2));
  const th = tip.offsetHeight;
  let top = y - hb.top - th - 18;
  if (top < 4) top = y - hb.top + 22;
  tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top + host.scrollTop)}px)`;
}
function hideTip(host: HTMLElement) {
  const tip = host.querySelector<HTMLElement>('.gtip');
  if (tip) tip.hidden = true;
}

/** Nhấn giữ ~0,3 giây thì hiện thông tin; thả tay thì ẩn. Chuột thì rê qua là hiện. */
function holdInfo(host: HTMLElement, area: HTMLElement, find: (e: PointerEvent) => { w: Slot; label?: string; got?: string } | null) {
  let timer = 0;
  let shown = false;
  const show = (e: PointerEvent) => {
    const f = find(e);
    if (!f) return hideTip(host);
    shown = true;
    showTip(host, e.clientX, e.clientY, f.w, f.label, f.got);
  };
  area.addEventListener('pointerdown', (e) => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      show(e);
      navigator.vibrate?.(12);
    }, 320);
  });
  const end = () => {
    clearTimeout(timer);
    if (shown) {
      shown = false;
      hideTip(host);
    }
  };
  area.addEventListener('pointerup', end);
  area.addEventListener('pointercancel', end);
  area.addEventListener('pointerleave', end);
  area.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' && e.buttons === 0) show(e);
  });
  area.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function openWheel(ui: UI) {
  let spinning = false;
  let angle = 0;
  const n = WHEEL.length;
  const seg = 360 / n;
  const html = `
    <div class="wq">
      <div class="wq-top" id="wqTop"></div>
      <div class="wheel-box" id="wheelBox">
        <canvas id="wheel" width="640" height="640"></canvas>
        <canvas id="wheelRim" width="640" height="640" aria-hidden="true"></canvas>
        <div class="wheel-pin" aria-hidden="true"></div>
        <button type="button" class="wheel-hub" id="spinHub" aria-label="Quay 1 lần">QUAY</button>
      </div>
      <div class="wq-btns" id="wqBtns"></div>
      <div class="wq-pity" id="wqPity"></div>
      <p class="wq-hint">Nhấn giữ một ô trên vòng quay để xem phần thưởng</p>
      <details class="wq-more"><summary>Tỉ lệ giải thưởng</summary><ul class="wq-odds" id="wqOdds"></ul>
        <p class="muted small">Linh Thạch có được khi chiếm đảo (30% cơ hội), đảo bí ẩn, hang quái, hòm báu, phi thăng.</p></details>
      <details class="wq-more"><summary>Đổi Linh Thạch</summary><div id="wqLt"></div></details>
      <button type="button" class="wq-link" id="goTuong">Tướng của tôi ›</button>
      <div class="spin-modal" id="spinModal" hidden></div>
    </div>`;
  ui.openSheet('quay', 'Vòng Quay Vạn Linh', html, (body) => {
    const host = body.querySelector<HTMLElement>('.wq')!;
    const cv = body.querySelector<HTMLCanvasElement>('#wheel')!;
    const rim = body.querySelector<HTMLCanvasElement>('#wheelRim')!;
    void drawWheel(cv);
    let phase = 0;
    drawRim(rim, phase);
    const blink = window.setInterval(() => {
      if (!rim.isConnected) return clearInterval(blink);
      drawRim(rim, ++phase);
    }, spinning ? 120 : 450);

    const update = () => {
      const s = ui.store.s;
      const day = dayOf(ui.store.now());
      const boughtToday = s.ltDay.day === day ? s.ltDay.n : 0;
      body.querySelector('#wqTop')!.innerHTML = `
        <span class="wq-chip" title="Linh Thạch"><img src="${iconUrl('lt')}" alt=""><b>${fmt(s.res.lt)}</b></span>
        <span class="wq-chip" title="Lượt quay đã mua"><img src="${menuIcon('wheel')}" alt=""><b>${s.luot ?? 0}</b></span>
        <button type="button" class="wq-buy" id="goShop">+ Mua lượt</button>`;
      const pityPct = Math.round((s.gacha.pity / PITY) * 100);
      body.querySelector('#wqPity')!.innerHTML = `<div class="bar"><i style="width:${pityPct}%"></i></div><small>Bảo hiểm truyền thuyết <b>${s.gacha.pity}/${PITY}</b> · lần thứ ${PITY} chắc chắn ra đồ truyền thuyết</small>`;
      const c1 = s.luot > 0 ? '1 lượt' : `${SPIN_COST} LT`, c10 = s.luot >= 10 ? '10 lượt' : `${SPIN10_COST} LT`;
      body.querySelector('#wqBtns')!.innerHTML = `
        <button type="button" class="primary wq-spin" id="spin1" ${spinning ? 'disabled' : ''}><b>Quay 1</b><small>${c1}</small></button>
        <button type="button" class="primary wq-spin gold" id="spin10" ${spinning ? 'disabled' : ''}><b>Quay 10</b><small>${c10} · giảm 10%</small></button>`;
      body.querySelector('#wqLt')!.innerHTML = `
        <p class="muted small">${LT_BUY_PRICE} đồng vàng = 1 Linh Thạch (hôm nay còn đổi được ${LT_BUY_DAILY - boughtToday}) · Bán lại: 1 Linh Thạch = ${LT_SELL_PRICE} đồng vàng</p>
        <div class="row"><input id="ltN" type="number" min="1" max="${LT_BUY_DAILY}" value="1" style="width:64px"><button type="button" id="ltBuy">Đổi vàng → LT</button><button type="button" id="ltSell">Bán LT</button></div>`;
      body.querySelector<HTMLButtonElement>('#spinHub')!.disabled = spinning;
    };
    body.querySelector('#wqOdds')!.innerHTML = WHEEL.map((w, i) => `<li data-i="${i}" style="--rc:${TIER_COLOR[tierOf(w)]}"><img src="${slotIcon(w)}" alt=""><span>${esc(w.label)}</span><b>${pctText(oddsOf(w))}</b></li>`).join('');
    update();

    // nhấn giữ trên mặt vòng quay: tính ô theo góc (đã trừ góc đang xoay)
    const box = body.querySelector<HTMLElement>('#wheelBox')!;
    holdInfo(host, box, (e) => {
      const r = cv.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) / (r.width / 2);
      if (d < 0.26 || d > 1) return null;
      const deg = (((Math.atan2(dy, dx) * 180) / Math.PI - angle + 90) % 360 + 360) % 360;
      return { w: WHEEL[Math.floor(deg / seg) % n] };
    });
    const odds = body.querySelector<HTMLElement>('#wqOdds')!;
    holdInfo(host, odds, (e) => {
      const li = (e.target as HTMLElement).closest<HTMLElement>('li[data-i]');
      return li ? { w: WHEEL[Number(li.dataset.i)] } : null;
    });
    const modal = body.querySelector<HTMLElement>('#spinModal')!;
    let lastOut: SpinResult[] = [];
    holdInfo(host, modal, (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('.rw[data-i]');
      if (!el) return null;
      const r = lastOut[Number(el.dataset.i)];
      const w = WHEEL.find((x) => x.id === r.slot);
      return w ? { w, label: r.detail, got: r.id } : null;
    });

    const showResults = (out: SpinResult[]) => {
      lastOut = out;
      const legs = out.filter((r) => r.leg).length;
      modal.innerHTML = `<div class="sm-card ${legs ? 'leg' : ''}">
        <h3>${legs ? 'TRUYỀN THUYẾT!' : 'Phần thưởng'}</h3>
        <div class="sm-grid ${out.length > 1 ? 'many' : ''}">${out
          .map((r, i) => {
            const w = WHEEL.find((x) => x.id === r.slot)!;
            const t = tierOf(w);
            return `<div class="rw ${t}" data-i="${i}" style="--rc:${TIER_COLOR[t]};animation-delay:${i * 70}ms"><img src="${slotIcon(w, r.id)}" alt=""><b>${esc(r.detail)}</b>${t === 'tt' ? '<small>Truyền thuyết</small>' : ''}</div>`;
          })
          .join('')}</div>
        <p class="wq-hint">Nhấn giữ một phần thưởng để xem chi tiết</p>
        <button type="button" class="primary wide" id="smOk">Nhận</button></div>`;
      modal.hidden = false;
    };

    const spin = async (count: 1 | 10) => {
      if (spinning) return;
      spinning = true;
      update();
      const o = await ui.store.doRemote({ t: 'quay', n: count });
      if (!o.ok) {
        spinning = false;
        update();
        return ui.toast(o.msg, 'bad');
      }
      const out = o.spin ?? [];
      // quay tới ô của giải tốt nhất trong lượt
      const best = out.find((r) => r.leg) ?? out[out.length - 1];
      const i = WHEEL.findIndex((w) => w.id === best.slot);
      const target = 360 - (i + 0.5) * seg + (Math.random() - 0.5) * seg * 0.6;
      spinning = true;
      update();
      const from = angle;
      angle = angle - (((angle % 360) + 360) % 360) + 360 * 5 + target;
      cv.style.transition = 'transform 3.2s cubic-bezier(.12,.72,.16,1)';
      cv.style.transform = `rotate(${angle}deg)`;
      // tiếng lách cách mỗi khi kim lướt qua một vạch, chậm dần theo vòng quay
      const D = angle - from, ticks = Math.floor(D / seg);
      for (let k = 1; k <= ticks; k++) sound.play('tick', 3.2 * (1 - Math.pow(1 - (k * seg) / D, 1 / 3.4)));
      setTimeout(() => {
        spinning = false;
        update();
        sound.play(out.some((r) => r.leg) ? 'legend' : 'win');
        showResults(out);
        ui.renderTop();
        ui.render();
      }, 3300);
    };

    body.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('button');
      if (!t) return;
      if (t.id === 'smOk') {
        modal.hidden = true;
        return;
      }
      if (spinning) return;
      if (t.id === 'spin1' || t.id === 'spinHub') return spin(1);
      if (t.id === 'spin10') return spin(10);
      if (t.id === 'goShop') return openSpinShop(ui);
      if (t.id === 'goTuong') return openGenerals(ui);
      if (t.id === 'ltBuy' || t.id === 'ltSell') {
        const k = Math.floor(Number(body.querySelector<HTMLInputElement>('#ltN')!.value));
        const o = ui.store.do({ t: 'doiLT', dir: t.id === 'ltBuy' ? 'mua' : 'ban', n: k });
        ui.toast(o.msg, o.ok ? 'gold' : 'bad');
        if (o.ok) update();
      }
    });
  });
}

// ---------------- TƯỚNG ----------------
export function openGenerals(ui: UI) {
  let sel: GenId = ui.store.s.chuTuong ?? GEN_IDS[0];
  const draw = () => {
    const s = ui.store.s;
    const ids = [...GEN_IDS].sort((a, b) => RARITY_ORDER.indexOf(GENERALS[a].rarity) - RARITY_ORDER.indexOf(GENERALS[b].rarity));
    const list = ids
      .map((id) => {
        const g = GENERALS[id];
        const st = s.tuong[id] ?? 0;
        return `<button type="button" class="gen ${st ? '' : 'locked'} ${sel === id ? 'on' : ''}" data-g="${id}" style="--rc:${RARITY_COLOR[g.rarity]}">
          <img src="${generalUrl(id, 2)}" alt=""><b>${esc(g.name)}</b><small>${st ? stars(st) : 'Chưa có'}</small>${s.chuTuong === id ? '<i>Chủ tướng</i>' : ''}</button>`;
      })
      .join('');
    const g = GENERALS[sel];
    const st = s.tuong[sel] ?? 0;
    const u = generalUnit(sel, Math.max(1, st), s.chuTuong === sel ? s.deo : null);
    const weapons = LEG_IDS.filter((w) => (s.vuKhi[w] ?? 0) > 0)
      .map((w) => `<button type="button" class="wpn ${s.deo === w ? 'on' : ''}" data-w="${w}"><img src="${legWeaponUrl(w)}" alt=""><span><b>${esc(LEG_WEAPONS[w].name)}</b><small>${esc(LEG_WEAPONS[w].desc)}${LEG_WEAPONS[w].fit === sel ? ' · <b class="good">hợp tướng: x1,5</b>' : ''}</small></span></button>`)
      .join('');
    return `
      <div class="gen-grid">${list}</div>
      <div class="card gen-detail" style="--rc:${RARITY_COLOR[g.rarity]}">
        <div class="lv-head"><img class="lv-img" src="${generalUrl(sel, 4)}" alt=""><div>
          <h3>${esc(g.name)} <small class="rar">${g.rarity}</small></h3><p class="muted">${esc(g.title)}</p>
          <p>${st ? `<b class="stars">${stars(st)}</b> (+${Math.round((starMult(st) - 1) * 100)}% chỉ số)` : '<b class="bad">Chưa có</b> · quay Vòng Vạn Linh để chiêu mộ'}</p>
          <div class="stats"><span>Máu ${u.hp}</span><span>Công ${u.atk}</span><span>Thủ ${u.def}</span><span>Tốc ${u.spd}</span></div>
          <p class="muted small">Kỹ năng <b>${esc(SKILLS[g.skill].name)}</b>: ${esc(SKILLS[g.skill].desc)}</p>
          <p class="small">${esc(g.lore)}</p></div></div>
        ${st ? `<div class="row">${s.chuTuong === sel ? '<button type="button" id="unsetChu">Bỏ chủ tướng</button>' : '<button type="button" class="primary" id="setChu">Làm chủ tướng</button>'}</div>` : ''}
        ${!st && g.rarity === 'Truyền Thuyết' ? `<button type="button" class="wide" id="ghep" ${s.manh < FRAG_PER_GENERAL ? 'disabled' : ''}>Ghép bằng ${FRAG_PER_GENERAL} mảnh (đang có ${s.manh})</button>` : ''}
      </div>
      <div class="card"><small>Vũ khí truyền thuyết (đeo cho chủ tướng)</small>${weapons || '<p class="muted small">Chưa có. Quay Vòng Vạn Linh để có Nỏ Thần, Roi Sắt, Đinh Ba, Gậy Thần.</p>'}
        ${s.deo ? '<button type="button" id="unDeo">Tháo vũ khí</button>' : ''}</div>
      <p class="muted small">Mảnh tướng truyền thuyết: <b>${s.manh}</b>/${FRAG_PER_GENERAL}. Chủ tướng ra trận cùng đội khi đánh đảo, đột kích, giữ đảo và đánh Thủy Tinh.</p>
      <button type="button" class="wide primary" id="goWheel">Vòng Quay Vạn Linh</button>`;
  };
  ui.openSheet('tuong', 'Tướng', draw(), (body) => {
    body.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('button');
      if (!t) return;
      if (t.dataset.g) sel = t.dataset.g as GenId;
      else if (t.dataset.w) {
        const o = ui.store.do({ t: 'deo', id: t.dataset.w as LegWeaponId });
        ui.toast(o.msg, o.ok ? 'gold' : 'bad');
      } else if (t.id === 'setChu' || t.id === 'unsetChu') {
        const o = ui.store.do({ t: 'chuTuong', id: t.id === 'setChu' ? sel : null });
        ui.toast(o.msg, o.ok ? 'gold' : 'bad');
      } else if (t.id === 'unDeo') ui.store.do({ t: 'deo', id: null });
      else if (t.id === 'ghep') {
        const o = ui.store.do({ t: 'ghep', id: sel });
        ui.toast(o.msg, o.ok ? 'gold' : 'bad');
      } else if (t.id === 'goWheel') return openWheel(ui);
      body.innerHTML = draw();
      ui.renderTop();
    });
  });
}

// ---------------- GÓI LƯỢT QUAY ----------------
export function openSpinShop(ui: UI) {
  const net = ui.store.net;
  const base = `<p class="muted small">Gói lượt quay chỉ dùng để quay Vòng Vạn Linh. Lượt quay không đổi ra Linh Thạch hay đồng vàng, không tặng, không bán được.</p>`;
  const packs = SPIN_PACKS.map((p) => `<button type="button" class="pack" data-p="${p.id}"><b>${esc(p.name)}</b><span>${p.spins}${p.bonus ? ` + ${p.bonus} tặng` : ''} lượt</span><i>${vnd(p.vnd)}</i></button>`).join('');
  if (!net.api) {
    ui.openSheet('goiquay', 'Gói lượt quay', `${base}<div class="packs">${packs}</div><p class="bad">Bản chơi thử không mua được gói quay. Hãy chơi bản chính thức.</p>`);
    return;
  }
  const show = (html: string) =>
    ui.openSheet('goiquay', 'Gói lượt quay', html, (body) => {
      body.addEventListener('click', async (e) => {
        const t = (e.target as HTMLElement).closest('button');
        if (!t) return;
        if (t.dataset.p) {
          t.setAttribute('disabled', '');
          try {
            const d = await net.api!('/nap/tao', { pack: t.dataset.p });
            show(`${base}
              <div class="card pay"><small>Chuyển khoản để nhận ${d.spins} lượt quay</small>
                <img class="qr" src="${esc(d.qr)}" alt="Mã VietQR">
                <p>Ngân hàng: <b>${esc(d.bank)}</b> · Số tài khoản: <b>${esc(d.acc)}</b>${d.holder ? ` · ${esc(d.holder)}` : ''}</p>
                <p>Số tiền: <b>${vnd(d.vnd)}</b></p>
                <p>Nội dung chuyển khoản: <b class="code">${esc(d.code)}</b></p>
                <p class="muted small">Quét mã bằng app ngân hàng (đã điền sẵn số tiền và nội dung). Chuyển xong, lượt quay tự cộng trong khoảng 1–2 phút.</p></div>
              <button type="button" id="orders" class="wide">Xem đơn của tôi</button>`);
          } catch (err) {
            ui.toast((err as Error).message, 'bad');
            t.removeAttribute('disabled');
          }
        } else if (t.id === 'orders') {
          try {
            const d = await net.api!('/nap/don');
            const rows = (d.orders as { code: string; lt: number; vnd: number; status: string; created: number }[])
              .map((o) => `<li><b>${esc(o.code)}</b><span>${o.lt} lượt · ${vnd(o.vnd)}</span><span class="${o.status === 'xong' ? 'good' : 'muted'}">${o.status === 'xong' ? 'Đã nhận' : 'Chờ chuyển khoản'}</span></li>`)
              .join('');
            show(`${base}<ul class="orders">${rows || '<li>Chưa có đơn.</li>'}</ul><div class="packs">${packs}</div>`);
          } catch (err) {
            ui.toast((err as Error).message, 'bad');
          }
        }
      });
    });
  show(`${base}<div class="packs">${packs}</div><button type="button" id="orders" class="wide">Xem đơn của tôi</button>`);
  // cửa hàng chưa mở (chủ game chưa điền tài khoản ngân hàng)
  fetch('/nap/goi')
    .then((r) => r.json())
    .then((d) => {
      if (!d.open) show(`${base}<div class="packs">${packs}</div><p class="bad">Cửa hàng gói quay chưa mở.</p>`);
    })
    .catch(() => undefined);
}
