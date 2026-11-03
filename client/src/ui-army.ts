// Bảng quân đội (spec 013): lính, quân cơ giới, quân từng đảo, quân mang theo mỗi chuyến, luyện quân.
import type { UI } from './ui';
import { RES, type ResKey } from '../../shared/data';
import { bLevel, slotSum } from '../../shared/economy';
import { fitCargo, carryCap, bedCap, parkCap, isMech, TROOP_KEYS, TROOPS, boardOk, mechCount, troopCount, type TroopKey, type Troops } from '../../shared/troops';
import { GENERALS, GEN_ARM, commandBonus } from '../../shared/gacha';
import { worldFor } from '../../shared/map';
import { isleById } from '../../shared/world';
import { lenhView, type LenhId, type PlayerState } from '../../shared/logic';
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

const COUNTER_HINT: Record<TroopKey, string> = {
  giao: 'khắc voi và xe, yếu trước cung',
  cung: 'khắc lính giáo, yếu trước khiên',
  khien: 'khắc cung, yếu trước xe bắn đá',
  xenu: 'khắc voi',
  xeda: 'khắc khiên, tháp, đồn',
  voi: 'húc mạnh, sợ lính giáo',
};
export function openArmy(ui: UI) {
  const draw = () => {
    const s = ui.store.s;
    const don = bLevel(s.dinh, 'donbinh');
    const cg = bLevel(s.dinh, 'xuongcg');
    const beds = bedCap(s.lv.leu.tier, slotSum(s.dinh, 'nhadan'));
    const park = parkCap(cg);
    const home = troopCount(s.troops);
    const homeMech = mechCount(s.troops);
    const homeInf = home - homeMech;
    const carry = carryCap(s.lv.thuyen.tier, s.fleet);
    const cargo = fitCargo(s.mang, s.troops, carry, s.fleet);
    const noBoat = TROOP_KEYS.filter((k) => (s.mang[k] ?? 0) > 0 && !boardOk(k, s.fleet));

    const roster = TROOP_KEYS.map((k) => {
      const d = TROOPS[k];
      const n = s.troops[k] ?? 0;
      return `<div class="unit${n ? '' : ' locked'}"><img src="${troopIcon(k)}" alt=""><div>
        <h3>${d.name} <span class="lvl">${n} ở đảo nhà</span></h3>
        <p class="muted">${isMech(k) ? 'Cơ giới' : 'Lính'} · 1 đơn vị · ${COUNTER_HINT[k]}</p>
        <div class="seg" role="radiogroup" aria-label="Hàng đứng">${(['front', 'back'] as const).map((r) => `<button type="button" data-row="${k}:${r}" role="radio" aria-checked="${(s.hang[k] ?? d.row) === r}">${r === 'front' ? 'Hàng trước' : 'Hàng sau'}</button>`).join('')}</div>
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
      const lock = !site ? (isMech(k) ? 'Cần Xưởng Cơ Giới' : 'Cần Trại Lính') : site < d.need ? `Cần ${isMech(k) ? 'Xưởng Cơ Giới' : 'Trại Lính'} cấp ${d.need}` : isMech(k) ? (homeMech >= park ? 'Bãi xe đầy' : '') : homeInf >= beds ? 'Hết giường, lính ngủ trong nhà' : '';
      const can = (n: number) => !lock && (isMech(k) ? homeMech + n <= park : homeInf + n <= beds && (n <= 5 * don)) && Object.entries(d.cost).every(([r, v]) => s.res[r as ResKey] >= (v ?? 0) * n);
      return `<div class="gear"><img src="${troopIcon(k)}" alt=""><div><b>${d.name}</b><small>${d.desc}</small><div class="costs">${costHtml(d.cost, s.res)}</div>${lock ? `<small class="bad">${lock}</small>` : ''}</div>
        <div class="tstep"><button type="button" data-luyen="${k}:1" ${can(1) ? '' : 'disabled'}>${isMech(k) ? 'Đóng' : 'Luyện'} 1</button><button type="button" data-luyen="${k}:5" ${can(5) ? '' : 'disabled'}>×5</button></div></div>`;
    }).join('');

    const lenh = lenhView(s)
      .map((l) => `<div class="garr"><div><b>${esc(l.name)}</b> <span class="lvl">${l.have}/${l.need}</span><small>Thưởng: ${Object.entries(l.reward).map(([r, v]) => `+${v} ${RES[r as ResKey]?.name ?? r}`).join(', ')}</small></div>
          <button type="button" data-lenh="${l.id}" ${l.done && !l.claimed ? '' : 'disabled'}>${l.claimed ? 'Đã nhận' : 'Nhận'}</button></div>`)
      .join('');
    const tq = [s.tech.giapQuan ?? 0, s.tech.vuKhiQuan ?? 0, s.tech.coKhi ?? 0];
    const tqLine = tq.some((x) => x > 0)
      ? `Nghiên cứu: lính +${8 * tq[0]}% máu, +${6 * tq[1]}% công · cơ giới +${8 * tq[2]}% công và máu.`
      : 'Học Viện có Giáp quân, Vũ khí quân, Cơ khí để quân mạnh hơn.';
    const gid = s.chuTuong && s.tuong[s.chuTuong] ? s.chuTuong : null;
    const arm = gid ? GEN_ARM[gid] : null;
    const cmdLine = !gid
      ? 'Chưa chọn tướng dẫn đầu. Mỗi tướng chỉ huy một loại quân sở trường và làm đội đó mạnh hơn.'
      : (s.mang[arm!] ?? 0) > 0
        ? `<b>${GENERALS[gid].name}</b> chỉ huy <b>${TROOPS[arm!].name}</b>: đội này +${Math.round(commandBonus(gid, s.tuong[gid]!) * 100)}% công và máu.`
        : `<b>${GENERALS[gid].name}</b> sở trường <b>${TROOPS[arm!].name}</b>: mang loại quân này theo thì được +${Math.round(commandBonus(gid, s.tuong[gid]!) * 100)}% công và máu.`;
    return `<div class="card"><small>Tướng chỉ huy</small><p>${cmdLine}</p></div>
      <div class="card"><small>Lệnh hôm nay</small>${lenh}</div>
      <div class="card"><small>Tổng quan</small>
      <p class="muted small">${tqLine}</p>
      <p>Quân ở đảo nhà <b>${home}</b> · lính <b>${homeInf}</b>/${beds} giường · cơ giới <b>${homeMech}</b>/${park} chỗ đậu</p>
      <p>Thuyền chở tối đa <b>${carry}</b> quân. Mỗi chuyến đang mang <b>${troopCount(cargo)}</b>.</p>
      <p class="muted small">Mỗi lính và mỗi cơ giới đều tính là 1 đơn vị, chiếm 1 giường (lính ngủ trong nhà: Nhà chính mỗi bậc 4 giường, mỗi gian nhà dân thêm 1) hoặc 1 chỗ đậu (cơ giới ở Xưởng Cơ Giới) và 1 chỗ trên thuyền. Trại Lính chỉ để huấn luyện. Quân ở nhà giữ đảo; quân mang đi ăn lương và có thể tử trận.</p></div>
      <div class="card"><small>Quân từng hòn đảo</small>
        <div class="garr"><div><b>Đảo nhà</b> <span class="lvl">${home} quân</span><small>${esc(listTroops(s.troops))}</small></div></div>
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
      } else if (t.dataset.lenh) {
        const o = ui.store.do({ t: 'nhanLenh', id: t.dataset.lenh as LenhId });
        ui.toast(o.msg, o.ok ? 'gold' : 'bad');
      } else if (t.dataset.row) {
        const [k, row] = t.dataset.row.split(':');
        const o = ui.store.do({ t: 'doiHang', k: k as TroopKey, row: row as 'front' | 'back' });
        ui.toast(o.msg, o.ok ? 'gold' : 'bad');
      } else if (t.dataset.rut) {
        const o = ui.store.do({ t: 'rutQuan', isle: t.dataset.rut });
        ui.toast(o.msg, o.ok ? 'gold' : 'bad');
      } else return;
      body.innerHTML = draw();
    });
  });
}

/** Sân trại: từng người lính (hoặc xe, voi) đi lại bên trong, thấy trực tiếp quân đang có ở đảo nhà. */
const hash = (n: number) => {
  let x = (n + 0x9e3779b9) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
};
const MAX_SHOWN = 36;
export function campYard(s: PlayerState, site: 'donbinh' | 'xuongcg'): string {
  const mech = site === 'xuongcg';
  const keys = TROOP_KEYS.filter((k) => isMech(k) === mech);
  const list: TroopKey[] = [];
  for (const k of keys) for (let i = 0; i < (s.troops[k] ?? 0); i++) list.push(k);
  const shown = list.slice(0, MAX_SHOWN);
  const away = keys.reduce((t, k) => t + (s.voyage?.troops?.[k] ?? 0) + Object.values(s.isleTroops).reduce((a, g) => a + (g[k] ?? 0), 0), 0);
  const sprites = shown
    .map((k, i) => {
      const h = hash(i * 7919 + k.charCodeAt(0) * 131);
      const h2 = hash(h);
      const left = 4 + (h % 84);
      const top = 22 + (h2 % 58);
      const amp = mech ? 22 : 44;
      const dx = (((h >> 3) % (amp * 2 + 1)) - amp) || amp;
      const dy = ((h2 >> 3) % 29) - 14;
      const dur = (mech ? 7 : 3.5) + (h % 30) / 10;
      const del = -((h2 % 60) / 10);
      const size = mech ? 46 : 32;
      return `<span class="tp${mech ? ' mech' : ''}" style="left:${left}%;top:${top}%;--dx:${dx}px;--dy:${dy}px;--f:${dx >= 0 ? 1 : -1};--dur:${dur}s;--del:${del}s;--sz:${size}px;z-index:${top}"><img src="${troopIcon(k)}" alt="${TROOPS[k].name}"></span>`;
    })
    .join('');
  const chips = keys.map((k) => `<span class="cost"><img src="${troopIcon(k)}" alt="">${TROOPS[k].name} ×${s.troops[k] ?? 0}</span>`).join(' ');
  const total = list.length;
  return `<div class="card"><small>${mech ? 'Bãi xe và voi chiến' : 'Sân trại lính'} · ${total} ${mech ? 'cơ giới' : 'lính'} đang ở trại</small>
    <div class="yard${mech ? ' yard-m' : ''}">${sprites || `<p class="yard-empty">${mech ? 'Bãi trống. Đóng xe nỏ, xe đá, voi chiến bên dưới.' : 'Sân trống. Luyện lính bên dưới để thấy họ tập trận.'}</p>`}</div>
    <div class="costs">${chips}</div>
    <p class="muted small">${total > MAX_SHOWN ? `Hiển thị ${MAX_SHOWN}/${total}. ` : ''}${away ? `Đang đi vắng: ${away} (trên thuyền hoặc đóng ở đảo khác). ` : ''}Mỗi hình là một ${mech ? 'cơ giới' : 'người lính'} thật.${mech ? '' : ' Lính tập luyện ở sân này, ngủ trong nhà.'}</p></div>`;
}
/** Nút luyện nhanh ngay trong nhà lính / xưởng cơ giới. */
export function campControls(s: PlayerState, site: 'donbinh' | 'xuongcg'): string {
  const mech = site === 'xuongcg';
  const don = bLevel(s.dinh, 'donbinh');
  const cg = bLevel(s.dinh, 'xuongcg');
  const beds = bedCap(s.lv.leu.tier, slotSum(s.dinh, 'nhadan'));
  const park = parkCap(cg);
  const homeMech = mechCount(s.troops);
  const homeInf = troopCount(s.troops) - homeMech;
  const rows = TROOP_KEYS.filter((k) => isMech(k) === mech)
    .map((k) => {
      const d = TROOPS[k];
      const lv = mech ? cg : don;
      const lock = lv < d.need ? `Cần cấp ${d.need}` : mech ? (homeMech >= park ? 'Bãi xe đầy' : '') : homeInf >= beds ? 'Hết giường: lính ngủ trong nhà, xây thêm nhà dân' : '';
      const can = !lock && Object.entries(d.cost).every(([r, v]) => s.res[r as ResKey] >= (v ?? 0));
      return `<div class="gear"><img src="${troopIcon(k)}" alt=""><div><b>${d.name}</b><small>${d.desc}</small><div class="costs">${costHtml(d.cost, s.res)}</div>${lock ? `<small class="bad">${lock}</small>` : ''}</div>
        <div class="tstep"><button type="button" data-luyen="${k}:1" ${can ? '' : 'disabled'}>${mech ? 'Đóng' : 'Luyện'} 1</button></div></div>`;
    })
    .join('');
  return `<div class="card"><small>${mech ? `Đóng cơ giới · bãi xe ${homeMech}/${park}` : `Luyện lính (tối đa ${5 * don} mỗi lượt) · giường trong nhà ${homeInf}/${beds}`}</small>${rows}<button type="button" class="wide" id="btnArmy2">Mở bảng quân đội</button></div>`;
}
