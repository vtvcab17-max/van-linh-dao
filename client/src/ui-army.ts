// Bảng quân đội (spec 013): lính, quân cơ giới, quân từng đảo, quân mang theo mỗi chuyến, luyện quân.
import type { UI } from './ui';
import { RES, type ResKey } from '../../shared/data';
import { bLevel } from '../../shared/economy';
import { fitCargo, carryCap, houseCap, isMech, TROOP_KEYS, TROOPS, boardOk, mechCount, troopCount, type TroopKey, type Troops } from '../../shared/troops';
import { worldFor } from '../../shared/map';
import { isleById } from '../../shared/world';
import type { PlayerState } from '../../shared/logic';
import { iconUrl, portraitUrl } from './art/textures';
import { troopUrl } from './art2/portrait';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Hình đại diện của từng loại quân (lính chibi, cơ giới vẽ riêng). */
export function troopIcon(k: TroopKey): string {
  if (isMech(k)) return portraitUrl(`tq-${k}`);
  return troopUrl(k === 'giao' ? 'danbinh' : k, 2);
}

const costHtml = (cost: Partial<Record<ResKey, number>>, have: Record<ResKey, number>) =>
  Object.entries(cost)
    .map(([k, v]) => `<span class="cost ${have[k as ResKey] >= (v ?? 0) ? '' : 'short'}"><img src="${iconUrl(k)}" alt="">${v} ${RES[k as ResKey].name}</span>`)
    .join(' ');

const listTroops = (t: Troops | undefined) =>
  TROOP_KEYS.filter((k) => (t?.[k] ?? 0) > 0)
    .map((k) => `${TROOPS[k].name} ×${t![k]}`)
    .join(' · ') || 'không có';

/** Dòng quân mang theo mỗi chuyến (hiện trong bảng ra khơi). */
export function armyLine(s: PlayerState): string {
  const cap = carryCap(s.lv.thuyen.tier, s.fleet);
  const cargo = fitCargo(s.mang, s.troops, cap, s.fleet);
  const n = troopCount(cargo);
  return `<div class="card"><small>Quân mang theo</small><p><b>${n}</b>/${cap} chỗ trên thuyền${n ? ` · ${esc(listTroops(cargo))}` : ''}</p>
    <p class="muted small">${troopCount(s.troops) ? `Quân ở đảo nhà: ${troopCount(s.troops)}. Chỉnh quân mang theo ở bảng Quân đội (tab Đội).` : 'Chưa có quân. Xây Trại Lính để luyện lính, Xưởng Cơ Giới để đóng xe và voi chiến.'}</p></div>`;
}

/** Tóm tắt quân cho tab Đội. */
export function armySummary(s: PlayerState): string {
  const total = troopCount(s.troops) + Object.values(s.isleTroops).reduce((t, g) => t + troopCount(g), 0) + troopCount(s.voyage?.troops);
  const mech = mechCount(s.troops);
  return `<div class="card"><small>Quân đội</small><p><b>${total}</b> quân (${total - mech - Object.values(s.isleTroops).reduce((t, g) => t + mechCount(g), 0) - mechCount(s.voyage?.troops)} lính · ${mech + Object.values(s.isleTroops).reduce((t, g) => t + mechCount(g), 0) + mechCount(s.voyage?.troops)} cơ giới)</p>
    <button type="button" class="primary wide" id="btnArmy">Mở bảng quân đội</button></div>`;
}

export function openArmy(ui: UI) {
  const draw = () => {
    const s = ui.store.s;
    const don = bLevel(s.dinh, 'donbinh');
    const cg = bLevel(s.dinh, 'xuongcg');
    const cap = houseCap(don, cg);
    const home = troopCount(s.troops);
    const carry = carryCap(s.lv.thuyen.tier, s.fleet);
    const cargo = fitCargo(s.mang, s.troops, carry, s.fleet);
    const noBoat = TROOP_KEYS.filter((k) => (s.mang[k] ?? 0) > 0 && !boardOk(k, s.fleet));

    const roster = TROOP_KEYS.map((k) => {
      const d = TROOPS[k];
      const n = s.troops[k] ?? 0;
      return `<div class="unit${n ? '' : ' locked'}"><img src="${troopIcon(k)}" alt=""><div>
        <h3>${d.name} <span class="lvl">${n} ở đảo nhà</span></h3>
        <p class="muted">${isMech(k) ? 'Cơ giới' : 'Lính'} · ${d.row === 'front' ? 'hàng trước' : 'hàng sau'} · 1 đơn vị</p>
        <div class="stats"><span>Máu ${d.hp}</span><span>Công ${d.atk}</span><span>Thủ ${d.def}</span><span>Tốc ${d.spd}</span></div></div></div>`;
    }).join('');

    // quân từng đảo
    const isleRows = s.isles
      .map((o) => {
        const g = s.isleTroops[o.id];
        const name = isleById(worldFor(s.khu), o.id)?.name ?? o.id;
        const n = troopCount(g);
        return `<div class="garr"><div><b>${esc(name)}</b> <span class="lvl">${n}/24 quân</span><small>${n ? esc(listTroops(g)) : 'Chưa có quân đóng. Thắng đảo thì quân còn lại ở lại giữ.'}${n >= 8 ? ` · thêm ${Math.min(3, Math.floor(n / 8))} cấp đồn giữ đảo` : ''}</small></div>
          <button type="button" data-rut="${o.id}" ${n && !s.voyage ? '' : 'disabled'}>Rút về</button></div>`;
      })
      .join('');
    const onBoat = s.voyage?.troops && troopCount(s.voyage.troops) ? `<div class="garr"><div><b>Trên thuyền (${s.voyage.targetName})</b> <span class="lvl">${troopCount(s.voyage.troops)} quân</span><small>${esc(listTroops(s.voyage.troops))}</small></div></div>` : '';

    // kế hoạch mang theo
    const plan = TROOP_KEYS.filter((k) => (s.troops[k] ?? 0) > 0 || (s.mang[k] ?? 0) > 0)
      .map((k) => {
        const w = s.mang[k] ?? 0;
        const got = cargo[k] ?? 0;
        return `<div class="gear"><img src="${troopIcon(k)}" alt=""><div><b>${TROOPS[k].name}</b> <span class="lvl">có ${s.troops[k] ?? 0}</span><small>${got < w ? `chỉ chở được ${got}` : w ? `mang ${got}` : 'không mang'}</small></div>
          <div class="tstep"><button type="button" data-mang="${k}:-5">−5</button><button type="button" data-mang="${k}:-1">−</button><b>${w}</b><button type="button" data-mang="${k}:1">+</button><button type="button" data-mang="${k}:5">+5</button></div></div>`;
      })
      .join('');

    // luyện quân
    const train = TROOP_KEYS.map((k) => {
      const d = TROOPS[k];
      const site = isMech(k) ? cg : don;
      const lock = !site ? (isMech(k) ? 'Cần Xưởng Cơ Giới' : 'Cần Trại Lính') : site < d.need ? `Cần ${isMech(k) ? 'Xưởng Cơ Giới' : 'Trại Lính'} cấp ${d.need}` : home >= cap ? 'Trại đầy' : '';
      const can = (n: number) => !lock && home + n <= cap && Object.entries(d.cost).every(([r, v]) => s.res[r as ResKey] >= (v ?? 0) * n);
      return `<div class="gear"><img src="${troopIcon(k)}" alt=""><div><b>${d.name}</b><small>${d.desc}</small><div class="costs">${costHtml(d.cost, s.res)}</div>${lock ? `<small class="bad">${lock}</small>` : ''}</div>
        <div class="tstep"><button type="button" data-luyen="${k}:1" ${can(1) ? '' : 'disabled'}>${isMech(k) ? 'Đóng' : 'Luyện'} 1</button><button type="button" data-luyen="${k}:5" ${can(5) ? '' : 'disabled'}>×5</button></div></div>`;
    }).join('');

    return `<div class="card"><small>Tổng quan</small>
      <p>Quân ở đảo nhà <b>${home}</b>/${cap} chỗ · lính ${home - mechCount(s.troops)} · cơ giới ${mechCount(s.troops)}</p>
      <p>Thuyền chở tối đa <b>${carry}</b> quân. Mỗi chuyến đang mang <b>${troopCount(cargo)}</b>.</p>
      <p class="muted small">Mỗi lính và mỗi cơ giới đều tính là 1 đơn vị, chiếm 1 chỗ ở trại và 1 chỗ trên thuyền. Quân ở nhà giữ đảo; quân mang đi ăn lương và có thể tử trận.</p></div>
      <div class="card"><small>Quân từng hòn đảo</small>
        <div class="garr"><div><b>Đảo nhà</b> <span class="lvl">${home}/${cap} quân</span><small>${esc(listTroops(s.troops))}</small></div></div>
        ${onBoat}${isleRows || '<p class="muted small">Chưa có đảo nào cắm cờ. Thắng một đảo tự nhiên thì quân còn lại ở lại giữ đảo.</p>'}</div>
      <div class="card"><small>Mang theo mỗi chuyến (${troopCount(cargo)}/${carry})</small>${plan || '<p class="muted small">Luyện quân xong sẽ chỉnh số mang theo ở đây.</p>'}
        ${noBoat.length ? `<p class="bad small">${noBoat.map((k) => TROOPS[k].name).join(', ')} cần thuyền buồm chiến trở lên mới lên được.</p>` : ''}</div>
      <div class="card"><small>Danh sách quân</small>${roster}</div>
      <div class="card"><small>Luyện lính và đóng cơ giới</small>${train}</div>`;
  };
  ui.openSheet('army', 'Quân đội', draw(), (body) => {
    body.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('button');
      if (!t) return;
      const s = ui.store.s;
      if (t.dataset.luyen) {
        const [k, n] = t.dataset.luyen.split(':');
        const o = ui.store.do({ t: 'luyen', k: k as TroopKey, n: Number(n) });
        ui.toast(o.msg, o.ok ? 'gold' : 'bad');
      } else if (t.dataset.mang) {
        const [k, d] = t.dataset.mang.split(':');
        const next: Troops = { ...s.mang };
        next[k as TroopKey] = Math.max(0, Math.min(99, (next[k as TroopKey] ?? 0) + Number(d)));
        ui.store.do({ t: 'mangQuan', troops: next });
      } else if (t.dataset.rut) {
        const o = ui.store.do({ t: 'rutQuan', isle: t.dataset.rut });
        ui.toast(o.msg, o.ok ? 'gold' : 'bad');
      } else return;
      body.innerHTML = draw();
    });
  });
}
