// Bảng thông tin ô hải đồ: thám hiểm, đảo tự nhiên (cắm cờ chủ quyền, thu sản lượng, xây trên đảo),
// bản đồ thu nhỏ và tìm theo toạ độ / tên / ID.
import type { UI } from './ui';
import { claimCheck, homeCell, isleCap, isleReady, isleYield, ISLE_BUILD, ISLE_STORE_H, isSeen, lordLevel, seenOf, wildCell, type IsleBuild } from '../../shared/logic';
import { MONSTERS, SKILLS, WILDS, type ResKey } from '../../shared/data';
import { islandCell, worldFor } from '../../shared/map';
import { CENTER, ISLE_KIND, TERRAIN_NAME, WORLD_H, WORLD_W, ZONE_NAMES, zoneLevel, type Isle } from '../../shared/world';
import { hexDist } from '../../shared/hex';
import { iconUrl, portraitUrl, canvasUrl } from './art/textures';
import { drawSeaIsland } from './art/islands';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const costHtml = (c: Partial<Record<ResKey, number>>, have?: Record<string, number>) =>
  Object.entries(c)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => `<span class="cost ${have && (have[k] ?? 0) < (v ?? 0) ? 'lack' : ''}"><img src="${iconUrl(k)}" alt="">${Math.round((v ?? 0) * 10) / 10}</span>`)
    .join(' ');

/** Chạm một ô trên hải đồ. */
export function openHex(ui: UI, c: number, r: number) {
  const s = ui.store.s;
  const w = worldFor(s.khu);
  const here = (x: number, y: number) => x === c && y === r;
  // đảo nhà mình
  const me = homeCell(s);
  if (here(me.x, me.y)) return ui.openIsland(ui.myPub(), true);
  // đảo người chơi, đảo máy
  for (const p of ui.store.net.islands()) {
    const h = p.home ?? islandCell(p.id, s.khu);
    if (here(h.x, h.y) && isSeen(s, c, r)) return ui.openIsland(p, false);
  }
  if (c === CENTER.c && r === CENTER.r) return ui.openBoss();
  if (isSeen(s, c, r)) {
    for (const wd of WILDS) {
      const h = wildCell(s, wd.id);
      if (here(h.x, h.y)) return ui.openWild(wd);
    }
    const o = w.at.get(`${c},${r}`);
    if (o?.kind === 'lair') return ui.openWild(o.v);
    if (o?.kind === 'isle') return openIsle(ui, o.v);
  }
  openSeaCell(ui, c, r);
}

/** Ô biển trống hoặc chưa khám phá: thám hiểm. */
function openSeaCell(ui: UI, c: number, r: number) {
  const s = ui.store.s;
  const known = isSeen(s, c, r);
  const info = ui.sea.hexInfo(c, r);
  const d = hexDist({ c, r }, { c: homeCell(s).x, r: homeCell(s).y });
  const html = `
    <p><b>(${c}, ${r})</b> · ${known ? TERRAIN_NAME[info.terrain] : 'Chưa khám phá'} · ${ZONE_NAMES[info.zone]} (vùng cấp ${info.zone}) · cách đảo bạn ${d} hải lý</p>
    <p class="muted small">${known ? 'Vùng biển đã khám phá.' : 'Mây mù che kín. Có thể có đảo bí ẩn, hang quái hay thuyền lạ.'} Càng gần Mắt Bão, đảo càng giàu và quái càng mạnh.</p>
    ${ui.sailLinePublic({ x: c, y: r })}
    <button class="primary wide" id="btnScout" ${s.voyage ? 'disabled' : ''}>${s.voyage ? 'Thuyền đang ngoài khơi' : 'Thám hiểm vùng này'}</button>`;
  ui.openSheet('hex', known ? 'Vùng biển' : 'Vùng biển chưa biết', html, (body) => {
    body.querySelector('#btnScout')?.addEventListener('click', () => ui.sailPublic(ui.store.do({ t: 'sail', kind: 'scout', to: { x: c, y: r } })));
  });
}

/** Đảo tự nhiên: quái canh giữ, sản lượng, chủ quyền, công trình trên đảo. */
export function openIsle(ui: UI, isle: Isle) {
  const draw = () => {
    const s = ui.store.s;
    const owners = ui.store.net.owners();
    const own = owners[isle.id];
    const mine = s.isles.find((o) => o.id === isle.id);
    const K = ISLE_KIND[isle.kind];
    const lvl = lordLevel(s);
    const name = isle.kind === 'bian' && !mine ? 'Đảo Bí Ẩn ???' : isle.name;
    const guard = isle.guard.map(([k, lv]) => `<div class="enemy"><img src="${portraitUrl(k)}" alt=""><span>${MONSTERS[k].name}</span><small>cấp ${lv} · ${SKILLS[MONSTERS[k].skill].name}</small></div>`).join('');
    const head = `<div class="lv-head"><img class="lv-img" src="${canvasUrl(`isle-${isle.id}`, () => drawSeaIsland(isle.id, 14 + isle.lv * 5, 'wild', 1), 3)}" alt="">
      <div><h3>${esc(name)}</h3><p class="muted">${K.name} · cấp ${isle.lv} · (${isle.c}, ${isle.r})</p><p class="small">${esc(K.desc)}</p>
      <p>${own ? `Chủ quyền: <b>${own.p === s.id ? 'của bạn' : esc(own.n)}</b>${own.g ? ` [${esc(own.g)}]` : ''}` : '<b class="good">Chưa ai cắm cờ</b>'}</p></div></div>`;
    if (mine) {
      const ready = isleReady(isle, mine, ui.store.now());
      const per = isleYield(isle, mine);
      const builds = (Object.keys(ISLE_BUILD) as IsleBuild[])
        .map((k) => {
          const b = ISLE_BUILD[k];
          const lv = mine[k];
          const cost = b.cost(lv + 1, isle.lv);
          return `<div class="isle-b"><div><b>${b.name}</b> <small>cấp ${lv}/3</small><p class="muted small">${b.desc}</p>${lv < 3 ? `<div class="costs">${costHtml(cost, s.res)}</div>` : ''}</div>
            ${lv < 3 ? `<button type="button" data-b="${k}" ${lvl < isle.needLvl ? 'disabled' : ''}>${lv ? 'Nâng cấp' : 'Xây'}</button>` : '<span class="good">Tối đa</span>'}</div>`;
        })
        .join('');
      return `${head}
        <div class="card"><small>Sản lượng mỗi giờ</small><div class="costs">${costHtml(per)}</div>
          <p>Đang có: ${Object.keys(ready).length ? costHtml(ready) : '<span class="muted">chưa có gì</span>'}</p>
          <p class="muted small">Đảo giữ tối đa ${ISLE_STORE_H} giờ sản lượng, nhớ ghé thu.</p>
          <button type="button" class="primary wide" id="btnThu">Thu hoạch</button></div>
        <div class="card"><small>Công trình trên đảo ${lvl < isle.needLvl ? `<b class="bad">(cần cấp chúa đảo ${isle.needLvl})</b>` : ''}</small>${builds}</div>
        <button type="button" class="wide" id="btnBo">Nhổ cờ, bỏ đảo</button>`;
    }
    const err = claimCheck(s, isle);
    const owned = own && own.p !== s.id;
    return `${head}
      <div class="card"><small>${owned ? 'Quân giữ đảo (quái đã thuần + lính đồn của chủ đảo)' : 'Quái canh giữ'}</small><div class="enemies">${guard}</div>
        ${owned && own.don ? `<p class="muted small">+ ${own.don} lính đồn tiền tiêu${own.thap ? `, tháp canh cấp ${own.thap} (quái mạnh hơn)` : ''}</p>` : ''}</div>
      <div class="card"><small>Khi cắm cờ chủ quyền</small><p>Sản lượng mỗi giờ: ${costHtml(isle.yields)}</p>
        <p class="muted small">Cần cấp chúa đảo <b>${isle.needLvl}</b> (bạn đang cấp ${lvl}) · đang giữ ${s.isles.length}/${isleCap(s)} đảo. ${isle.kind === 'bian' ? 'Đảo bí ẩn: 60% cơ hội nhặt 3–8 Linh Thạch.' : 'Thắng có 30% cơ hội nhặt Linh Thạch.'}</p>
        ${err ? `<p class="bad small">${esc(err)} Vẫn đánh được để lấy chiến lợi phẩm.</p>` : ''}</div>
      ${ui.sailLinePublic({ x: isle.c, y: isle.r })}
      <button class="primary wide hot" id="btnIsle" ${s.voyage ? 'disabled' : ''}>${s.voyage ? 'Thuyền đang ngoài khơi' : owned ? `Đánh chiếm đảo của ${esc(own!.n)}` : 'Đánh quái, cắm cờ chủ quyền'}</button>`;
  };
  const bind = (body: HTMLElement) => {
    body.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('button');
      if (!t) return;
      const s = ui.store.s;
      if (t.id === 'btnIsle') {
        const own = ui.store.net.owners()[isle.id];
        const def = own && own.p !== s.id ? { owner: own.p, ownerName: own.n, don: own.don, thap: own.thap } : undefined;
        return ui.sailPublic(ui.store.do({ t: 'sail', kind: 'isle', id: isle.id, def }));
      }
      if (t.id === 'btnThu') {
        const o = ui.store.do({ t: 'thuDao', id: isle.id });
        ui.toast(o.msg, o.ok ? 'gold' : 'bad');
      } else if (t.dataset.b) {
        const o = ui.store.do({ t: 'xayDao', id: isle.id, k: t.dataset.b as IsleBuild });
        ui.toast(o.msg, o.ok ? 'gold' : 'bad');
      } else if (t.id === 'btnBo') {
        if (!t.classList.contains('hot')) {
          t.classList.add('hot');
          t.textContent = 'Chắc chắn? Bấm lần nữa';
          return;
        }
        const o = ui.store.do({ t: 'boDao', id: isle.id });
        ui.toast(o.msg, o.ok ? 'gold' : 'bad');
      }
      body.innerHTML = draw();
    });
  };
  ui.openSheet('isle', 'Đảo tự nhiên', draw(), bind);
}

// ---------------- bản đồ thu nhỏ + tìm kiếm ----------------
export function openMap(ui: UI) {
  const s = ui.store.s;
  const K = 3; // điểm ảnh mỗi ô
  const html = `
    <div class="row"><input id="mapQ" placeholder="Toạ độ (vd 34,20), tên đảo, tên người chơi hoặc ID" style="flex:1"><button type="button" class="primary" id="mapGo">Tìm</button></div>
    <canvas id="mini" width="${WORLD_W * K + 2}" height="${WORLD_H * K + 2}"></canvas>
    <p class="muted small">Chạm vào bản đồ để tới nơi đó. Vàng: đảo bạn · Xanh lá: lãnh thổ của bạn · Xanh dương: cùng thương hội · Đỏ: người khác · Tím: đảo bí ẩn · Đỏ sậm: Mắt Bão.</p>
    <div class="card"><small>Đảo của bạn</small><p>(${homeCell(s).x}, ${homeCell(s).y}) · cấp chúa đảo <b>${lordLevel(s)}</b> · giữ ${s.isles.length}/${isleCap(s)} đảo tự nhiên</p>
      ${s.isles.map((o) => {
        const i = worldFor(s.khu).isles.find((x) => x.id === o.id);
        return i ? `<button type="button" class="link" data-go="${i.c},${i.r}">${esc(i.name)} (${i.c}, ${i.r}) · cấp ${i.lv}</button>` : '';
      }).join(' ')}</div>`;
  ui.openSheet('map', 'Hải đồ', html, (body) => {
    const cv = body.querySelector<HTMLCanvasElement>('#mini')!;
    const x = cv.getContext('2d')!;
    const seen = seenOf(s);
    const w = worldFor(s.khu);
    const owners = ui.store.net.owners();
    for (let r = 0; r < WORLD_H; r++)
      for (let c = 0; c < WORLD_W; c++) {
        const i = r * WORLD_W + c;
        const known = (seen[i >> 3] & (1 << (i & 7))) !== 0;
        const z = zoneLevel(c, r);
        x.fillStyle = known ? `hsl(203, 55%, ${48 - z * 2.2}%)` : '#d9e0e8';
        x.fillRect(1 + c * K + (r & 1) * (K >> 1), 1 + r * K, K, K);
      }
    const dot = (c: number, r: number, col: string, k = K) => {
      x.fillStyle = col;
      x.fillRect(1 + c * K + (r & 1) * (K >> 1) - (k - K) / 2, 1 + r * K - (k - K) / 2, k, k);
    };
    const isSeenAt = (c: number, r: number) => {
      const i = r * WORLD_W + c;
      return (seen[i >> 3] & (1 << (i & 7))) !== 0;
    };
    for (const i of w.isles) if (isSeenAt(i.c, i.r)) dot(i.c, i.r, owners[i.id] ? (owners[i.id].p === s.id ? '#4fd06a' : owners[i.id].g && [s.guild?.tag, ...(s.guild?.allyTags ?? [])].includes(owners[i.id].g) ? '#5aa8ff' : '#f0554a') : i.kind === 'bian' ? '#c07cff' : '#cfe8a0');
    for (const o of s.isles) {
      const i = w.isles.find((y) => y.id === o.id);
      if (i) dot(i.c, i.r, '#4fd06a', K + 2);
    }
    for (const p of ui.store.net.islands()) {
      const h = p.home ?? islandCell(p.id, s.khu);
      if (isSeenAt(h.x, h.y)) dot(h.x, h.y, p.bot ? '#ffc36a' : p.guild && [s.guild?.tag, ...(s.guild?.allyTags ?? [])].includes(p.guild) ? '#5aa8ff' : '#f0554a', K + 1);
    }
    dot(CENTER.c, CENTER.r, '#8a1f1f', K + 4);
    const me = homeCell(s);
    dot(me.x, me.y, '#ffe27a', K + 3);
    cv.addEventListener('click', (e) => {
      const rect = cv.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * cv.width, py = ((e.clientY - rect.top) / rect.height) * cv.height;
      const r = Math.max(0, Math.min(WORLD_H - 1, Math.floor((py - 1) / K)));
      const c = Math.max(0, Math.min(WORLD_W - 1, Math.floor((px - 1 - (r & 1) * (K >> 1)) / K)));
      ui.closeSheet();
      ui.sea.focusCell(c, r);
    });
    const go = () => {
      const q = (body.querySelector<HTMLInputElement>('#mapQ')!.value || '').trim();
      const m = q.match(/^\(?\s*(\d{1,3})\s*[,; ]\s*(\d{1,3})\s*\)?$/);
      let target: { c: number; r: number } | null = null;
      if (m) target = { c: Math.min(WORLD_W - 1, Number(m[1])), r: Math.min(WORLD_H - 1, Number(m[2])) };
      else if (q) {
        const low = q.toLowerCase();
        const p = ui.store.net.islands().find((x) => x.id === q || x.name.toLowerCase().includes(low) || x.islandName.toLowerCase().includes(low));
        if (p) {
          const h = p.home ?? islandCell(p.id, s.khu);
          target = { c: h.x, r: h.y };
        } else {
          const i = w.isles.find((x) => x.name.toLowerCase().includes(low) && isSeenAt(x.c, x.r));
          if (i) target = { c: i.c, r: i.r };
        }
      }
      if (!target) return ui.toast('Không tìm thấy. Thử toạ độ dạng 34,20 hoặc tên đảo đã khám phá.', 'bad');
      ui.closeSheet();
      ui.sea.focusCell(target.c, target.r);
      openHex(ui, target.c, target.r);
    };
    body.querySelector('#mapGo')!.addEventListener('click', go);
    body.querySelector('#mapQ')!.addEventListener('keydown', (e) => (e as KeyboardEvent).key === 'Enter' && go());
    body.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) =>
      b.addEventListener('click', () => {
        const [c, r] = b.dataset.go!.split(',').map(Number);
        ui.closeSheet();
        ui.sea.focusCell(c, r);
      }),
    );
  });
}

