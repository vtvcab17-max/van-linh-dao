// Bảng Xã hội: phồn vinh, dân số, đàn vật nuôi theo giai đoạn, trứng/sữa, đồ chế biến, câu cá.
import type { UI } from './ui';
import { FISH, herdCap, HATCH_EGGS, isAdult, nextStageIn, PRESERVED, prosperity, SPECIES, SP_KEYS, stageIdx, type FishHow, type PKey, type Sp } from '../../shared/society';

const H = 3600_000;
const dur = (ms: number) => {
  const h = Math.ceil(ms / H);
  return h >= 24 ? `${Math.floor(h / 24)} ngày ${h % 24} giờ` : `${Math.max(1, h)} giờ`;
};
const bar = (v: number, cls = '') => `<i class="${cls}" style="display:block;height:8px;margin-top:3px;border-radius:4px;background:rgba(0,0,0,.45);overflow:hidden"><b style="display:block;height:100%;width:${Math.round(Math.min(1, v) * 100)}%;background:linear-gradient(90deg,#86cf70,#ffd955)"></b></i>`;

export function openSociety(ui: UI) {
  const draw = () => {
    const s = ui.store.s;
    const so = s.soc;
    const pr = prosperity(s);
    const cap = herdCap(s);
    const mood = pr.overload < 1 ? `<b class="bad">Quá tải: ${Math.floor(so.pop)} dân / ${pr.cap} chỗ ở. Hiệu suất ×${pr.overload.toFixed(2)}. Hãy xây thêm nhà hoặc mở rộng đảo.</b>` : pr.cap === 0 ? '<span class="muted">Chưa có nhà dân, đảo chỉ có vài người.</span>' : `<span class="good">Dân ${Math.floor(so.pop)} / ${pr.cap} chỗ ở.</span>`;
    const parts = pr.parts.map((p) => `<div><small>${p.name} · ${Math.round(p.v * 100)}%</small>${bar(p.v)}</div>`).join('');
    const herd = so.herd
      .map((a) => {
        const D = SPECIES[a.sp];
        const i = stageIdx(a, s.gt);
        const left = nextStageIn(a, s.gt);
        const mature = isAdult(a, s.gt);
        return `<div class="card sub"><small>${D.stages[i][0]}${mature ? ' · ' + D.use : ''}</small>
          <p class="muted small">${mature ? 'Đã trưởng thành' : `Lớn lên sau ${dur(left)}`}</p>
          ${a.sp === 'lon' && mature ? `<button type="button" data-use="${a.id}">Mổ lấy thịt</button>` : ''}</div>`;
      })
      .join('');
    const buy = SP_KEYS.map((k) => `<button type="button" data-buy="${k}" ${so.herd.length >= cap ? 'disabled' : ''}>${SPECIES[k].name} ${SPECIES[k].buy}đ</button>`).join(' ');
    const pk = (Object.keys(PRESERVED) as PKey[]).map((k) => `<button type="button" data-bao="${k}">${PRESERVED[k]}</button>`).join(' ');
    const kho = Object.entries(so.kho).filter(([, v]) => (v ?? 0) > 0).map(([k, v]) => `${PRESERVED[k as PKey]} ${v}`).join(', ');
    const fish = (Object.keys(FISH) as FishHow[])
      .map((k) => {
        const last = so.fishAt[k];
        const wait = last === undefined ? 0 : Math.max(0, FISH[k].cd - (s.gt - last));
        return `<button type="button" data-fish="${k}" ${wait > 0 ? 'disabled' : ''}>${FISH[k].name}${wait > 0 ? ` (${Math.ceil(wait / 60_000)} phút)` : ` +${FISH[k].ca} cá`}</button>`;
      })
      .join(' ');
    return `<div class="card"><small>Phồn vinh</small><div class="inner-h"><b>${pr.total}/100</b><small>${pr.merchants ? `Thương nhân ghé: +${pr.merchants} đồng/giờ` : 'Đạt 60 để thương nhân ghé'} · hiệu suất ×${pr.eff.toFixed(2)}</small></div>${bar(pr.total / 100)}<p class="small">${mood}</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">${parts}</div>
        <p class="muted small">Phồn vinh từ 40 thu hút dân nhập cư. Dân đông hơn chỗ ở thì quá tải, năng suất giảm.</p></div>
      <div class="card"><small>Chuồng trại ${so.herd.length}/${cap}</small>
        <p class="muted small">Vật nuôi lớn qua nhiều giai đoạn, mất nhiều ngày. Mỗi ô chuồng nuôi một con.</p>
        <div class="row" style="flex-wrap:wrap">${buy}</div>${herd || '<p class="muted small">Chưa nuôi con nào.</p>'}</div>
      <div class="card"><small>Trứng ${Math.floor(so.eggs)} · Sữa ${Math.floor(so.sua)}</small>
        <p class="muted small">Gà mái đẻ trứng: ăn hoặc ấp (${HATCH_EGGS} trứng ra 1 gà con). Bò sữa cho sữa. Trâu cày tăng sản lượng ruộng.</p>
        <div class="row"><button type="button" data-egg="food" ${so.eggs >= 1 ? '' : 'disabled'}>Nhặt làm thức ăn</button><button type="button" data-egg="hatch" ${so.eggs >= HATCH_EGGS ? '' : 'disabled'}>Ấp trứng</button></div></div>
      <div class="card"><small>Bảo quản thức ăn</small>
        <p class="muted small">Thịt, rau, cá, trứng, sữa tươi sẽ hỏng dần. Kho thóc nhiều ô thì hỏng chậm hơn. Muối, phơi, làm phô mai để giữ lâu rồi bán.</p>
        <div class="row" style="flex-wrap:wrap">${pk}<button type="button" data-ban="1">Bán đồ chế biến</button></div>${kho ? `<p class="small">Đang có: ${kho}</p>` : ''}</div>
      <div class="card"><small>Đánh bắt cá</small><div class="row" style="flex-wrap:wrap">${fish}</div>
        <p class="muted small">Cần câu miễn phí nhưng chậm. Lưới cần Bến thuyền. Thuyền đánh cá cần Bến và một chiếc ghe.</p></div>`;
  };
  ui.openSheet('xahoi', 'Xã hội đảo', draw(), (body) => {
    body.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('button');
      if (!t) return;
      const d = t.dataset;
      const o = d.buy ? ui.store.do({ t: 'herdBuy', sp: d.buy as Sp }) : d.use ? ui.store.do({ t: 'herdUse', id: d.use }) : d.egg ? ui.store.do({ t: 'egg', use: d.egg as 'food' | 'hatch' }) : d.bao ? ui.store.do({ t: 'bao', k: d.bao as PKey }) : d.ban ? ui.store.do({ t: 'banBQ' }) : d.fish ? ui.store.do({ t: 'fish', how: d.fish as FishHow }) : null;
      if (!o) return;
      ui.toast(o.msg, o.ok ? 'gold' : 'bad');
      body.innerHTML = draw();
    });
  }, () => {
    const b = document.querySelector<HTMLElement>('#sheet .sheet-body');
    if (b && ui.sheetKindPublic() === 'xahoi') b.innerHTML = draw();
  });
}
