// Giao diện Vòng Quay Vạn Linh, Tướng, Gói lượt quay, đổi Linh Thạch.
import type { UI } from './ui';
import type { SpinResult } from '../../shared/logic';
import {
  FRAG_PER_GENERAL, GEN_IDS, GENERALS, LEG_IDS, LEG_WEAPONS, LT_BUY_DAILY, LT_BUY_PRICE, LT_SELL_PRICE, MAX_STAR, PITY, RARITY_COLOR, RARITY_ORDER, SPIN10_COST, SPIN_COST, SPIN_PACKS, starMult, WHEEL, wheelOdds,
  type GenId, type LegWeaponId,
} from '../../shared/gacha';
import { dayOf } from '../../shared/economy';
import { SKILLS } from '../../shared/data';
import { generalUnit } from '../../shared/gacha';
import { generalUrl, legWeaponUrl } from './art2/portrait';
import { iconUrl } from './art/textures';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const vnd = (n: number) => n.toLocaleString('vi-VN') + 'đ';
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(MAX_STAR - n);

// ---------------- VÒNG QUAY ----------------
const SEG_COLORS = ['#7a2e2a', '#9c3b2f', '#6e3a1f', '#8a4a24'];

function drawWheel(cv: HTMLCanvasElement) {
  const n = WHEEL.length;
  const ctx = cv.getContext('2d')!;
  const R = cv.width / 2;
  ctx.clearRect(0, 0, cv.width, cv.height);
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(R, R);
    ctx.arc(R, R, R - 6, a0, a1);
    ctx.closePath();
    ctx.fillStyle = WHEEL[i].leg ? (i % 2 ? '#e8a52c' : '#ffcf4d') : SEG_COLORS[i % SEG_COLORS.length];
    ctx.fill();
    ctx.strokeStyle = '#f3d27a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.save();
    ctx.translate(R, R);
    ctx.rotate((a0 + a1) / 2);
    ctx.textAlign = 'right';
    ctx.font = `700 ${Math.round(R / 10)}px "Be Vietnam Pro", sans-serif`;
    ctx.fillStyle = WHEEL[i].leg ? '#4a1a10' : '#fff3d0';
    const label = WHEEL[i].label.replace('Truyền Thuyết', 'T.Thuyết').replace('Linh Thạch', 'L.Thạch');
    ctx.fillText(label.length > 18 ? label.slice(0, 17) + '…' : label, R - 14, 4);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(R, R, R / 6, 0, Math.PI * 2);
  ctx.fillStyle = '#3d2b2b';
  ctx.fill();
  ctx.strokeStyle = '#ffd955';
  ctx.lineWidth = 3;
  ctx.stroke();
}

export function openWheel(ui: UI) {
  let spinning = false;
  let last: SpinResult[] = [];
  let angle = 0;
  const draw = () => {
    const s = ui.store.s;
    const day = dayOf(ui.store.now());
    const boughtToday = s.ltDay.day === day ? s.ltDay.n : 0;
    const pityPct = Math.round((s.gacha.pity / PITY) * 100);
    const odds = wheelOdds()
      .map((o) => `<li class="${o.leg ? 'leg' : ''}"><span>${esc(o.label)}</span><b>${o.pct.toFixed(o.pct < 1 ? 2 : 1)}%</b></li>`)
      .join('');
    const res = last.length
      ? `<div class="spin-res">${last.map((r) => `<div class="sr ${r.leg ? 'leg' : ''}"><b>${esc(r.label)}</b>${r.detail !== r.label ? `<small>${esc(r.detail)}</small>` : ''}</div>`).join('')}</div>`
      : '';
    return `
      <div class="wallet"><span><img src="${iconUrl('lt')}" alt=""> <b>${s.res.lt}</b> Linh Thạch</span><span class="ticket">🎟 <b>${s.luot ?? 0}</b> lượt quay</span></div>
      <div class="wheel-box"><div class="wheel-pin"></div><canvas id="wheel" width="300" height="300" style="transform:rotate(${angle}deg)"></canvas></div>
      <div class="pity"><span>Bảo hiểm truyền thuyết</span><div class="bar"><i style="width:${pityPct}%"></i></div><small>${s.gacha.pity}/${PITY} · lần thứ ${PITY} chắc chắn ra đồ truyền thuyết</small></div>
      <div class="row">
        <button type="button" class="primary" id="spin1" ${spinning ? 'disabled' : ''}>Quay 1 · ${s.luot > 0 ? '1 lượt' : `${SPIN_COST} LT`}</button>
        <button type="button" class="primary" id="spin10" ${spinning ? 'disabled' : ''}>Quay 10 · ${s.luot >= 10 ? '10 lượt' : `${SPIN10_COST} LT`}</button>
      </div>
      ${res}
      <div class="row"><button type="button" id="goShop">Mua gói lượt quay</button><button type="button" id="goTuong">Tướng của tôi</button></div>
      <div class="card"><small>Đổi Linh Thạch</small>
        <p class="muted small">${LT_BUY_PRICE} đồng vàng = 1 Linh Thạch (hôm nay còn đổi được ${LT_BUY_DAILY - boughtToday}) · Bán lại: 1 Linh Thạch = ${LT_SELL_PRICE} đồng vàng</p>
        <div class="row"><input id="ltN" type="number" min="1" max="${LT_BUY_DAILY}" value="1" style="width:70px"><button type="button" id="ltBuy">Đổi đồng vàng → LT</button><button type="button" id="ltSell">Bán LT → đồng vàng</button></div>
      </div>
      <details class="odds"><summary>Tỉ lệ giải thưởng (công khai)</summary><ul>${odds}</ul>
        <p class="muted small">Linh Thạch kiếm được khi chiếm đảo (30% cơ hội), đảo bí ẩn, hang quái, hòm báu, phi thăng. Tướng trùng lên sao (tối đa ${MAX_STAR}★), đủ sao đổi thành mảnh; ${FRAG_PER_GENERAL} mảnh ghép một tướng truyền thuyết.</p></details>`;
  };
  ui.openSheet('quay', 'Vòng Quay Vạn Linh', draw(), (body) => {
    const paint = () => {
      body.innerHTML = draw();
      const cv = body.querySelector<HTMLCanvasElement>('#wheel');
      if (cv) drawWheel(cv);
    };
    paint();
    body.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('button');
      if (!t || spinning) return;
      if (t.id === 'spin1' || t.id === 'spin10') {
        const o = ui.store.do({ t: 'quay', n: t.id === 'spin10' ? 10 : 1 });
        if (!o.ok) return ui.toast(o.msg, 'bad');
        const out = o.spin ?? [];
        // quay tới ô của giải tốt nhất trong lượt
        const best = out.find((r) => r.leg) ?? out[out.length - 1];
        const i = WHEEL.findIndex((w) => w.id === best.slot);
        const seg = 360 / WHEEL.length;
        const target = 360 - (i + 0.5) * seg;
        spinning = true;
        last = [];
        paint(); // vẽ lại ở góc cũ rồi mới quay tới góc mới
        angle = angle - (angle % 360) + 360 * 5 + target;
        const cv = body.querySelector<HTMLCanvasElement>('#wheel')!;
        void cv.offsetWidth;
        cv.style.transition = 'transform 2.6s cubic-bezier(.12,.7,.18,1)';
        cv.style.transform = `rotate(${angle}deg)`;
        setTimeout(() => {
          spinning = false;
          last = out;
          paint();
          const legs = out.filter((r) => r.leg);
          if (legs.length) ui.toast(`TRUYỀN THUYẾT! ${legs.map((r) => r.detail).join(', ')}`, 'gold', 6000);
          ui.renderTop();
        }, 2700);
        return;
      }
      if (t.id === 'goShop') return openSpinShop(ui);
      if (t.id === 'goTuong') return openGenerals(ui);
      if (t.id === 'ltBuy' || t.id === 'ltSell') {
        const n = Math.floor(Number(body.querySelector<HTMLInputElement>('#ltN')!.value));
        const o = ui.store.do({ t: 'doiLT', dir: t.id === 'ltBuy' ? 'mua' : 'ban', n });
        ui.toast(o.msg, o.ok ? 'gold' : 'bad');
        if (o.ok) paint();
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
