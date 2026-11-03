// Bảng thông tin ô hải đồ: thám hiểm, đảo tự nhiên (cắm cờ chủ quyền, thu sản lượng, xây trên đảo),
// bản đồ thu nhỏ và tìm theo toạ độ / tên / ID.
import type { UI } from './ui';
import { claimCheck, homeCell, isleCap, isleReady, isleYield, ISLE_BUILD, ISLE_STORE_H, isSeen, lordLevel, seenChunks, seenOf, wildCell, type IsleBuild } from '../../shared/logic';
import { MONSTERS, SKILLS, WILDS, type ResKey } from '../../shared/data';
import { islandCell, worldFor } from '../../shared/map';
import { CENTER, isleById, ISLE_KIND, TERRAIN_NAME, WORLD_H, WORLD_W, ZONE_NAMES, zoneLevel, type Isle } from '../../shared/world';
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
    const o = w.at(c, r);
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
/** Mỗi điểm ảnh của bản đồ thu nhỏ là một khối 4x4 ô (hải đồ 1024 x 1024 ô). */
const MK = 4;
export function openMap(ui: UI) {
  const s = ui.store.s;
  const MW = Math.ceil(WORLD_W / MK), MH = Math.ceil(WORLD_H / MK);
  const html = `
    <div class="row"><input id="mapQ" placeholder="Toạ độ (vd 340,520), tên đảo, tên người chơi hoặc ID" style="flex:1"><button type="button" class="primary" id="mapGo">Tìm</button></div>
    <canvas id="mini" width="${MW}" height="${MH}"></canvas>
    <p class="muted small">Hải đồ ${WORLD_W} × ${WORLD_H} = ${(WORLD_W * WORLD_H).toLocaleString('vi-VN')} ô. Chạm vào bản đồ để tới nơi đó. Vàng: đảo bạn · Xanh lá: lãnh thổ của bạn · Xanh dương: cùng thương hội · Đỏ: người khác · Tím: đảo bí ẩn · Đỏ sậm: Mắt Bão. Vùng xám là biển chưa khám phá.</p>
    <div class="card"><small>Đảo của bạn</small><p>(${homeCell(s).x}, ${homeCell(s).y}) · ${ZONE_NAMES[zoneLevel(homeCell(s).x, homeCell(s).y)]} · cấp chúa đảo <b>${lordLevel(s)}</b> · giữ ${s.isles.length}/${isleCap(s)} đảo tự nhiên</p>
      ${s.isles.map((o) => {
        const i = isleById(worldFor(s.khu), o.id);
        return i ? `<button type="button" class="link" data-go="${i.c},${i.r}">${esc(i.name)} (${i.c}, ${i.r}) · cấp ${i.lv}</button>` : '';
      }).join(' ')}</div>`;
  ui.openSheet('map', 'Hải đồ', html, (body) => {
    const cv = body.querySelector<HTMLCanvasElement>('#mini')!;
    const x = cv.getContext('2d')!;
    const seen = seenOf(s);
    const w = worldFor(s.khu);
    const owners = ui.store.net.owners();
    const img = x.createImageData(MW, MH);
    for (let py = 0; py < MH; py++)
      for (let px = 0; px < MW; px++) {
        const c = px * MK + 2, r = py * MK + 2;
        const z = zoneLevel(c, r);
        const k = (py * MW + px) * 4;
        if (isSeen(s, c, r, seen)) {
          // biển đã khám phá: càng gần Mắt Bão càng sẫm
          img.data[k] = 70 - z * 4;
          img.data[k + 1] = 150 - z * 7;
          img.data[k + 2] = 205 - z * 6;
        } else {
          // sương mù: vẫn thấy vành vùng để định hướng
          const g = 214 - (z % 2) * 10 - z * 2;
          img.data[k] = g;
          img.data[k + 1] = g + 6;
          img.data[k + 2] = g + 14;
        }
        img.data[k + 3] = 255;
      }
    x.putImageData(img, 0, 0);
    const dot = (c: number, r: number, col: string, k = 3) => {
      x.fillStyle = '#1d1b2a';
      x.fillRect(Math.round(c / MK) - (k >> 1) - 1, Math.round(r / MK) - (k >> 1) - 1, k + 2, k + 2);
      x.fillStyle = col;
      x.fillRect(Math.round(c / MK) - (k >> 1), Math.round(r / MK) - (k >> 1), k, k);
    };
    const allies = [s.guild?.tag, ...(s.guild?.allyTags ?? [])].filter(Boolean);
    for (const [id, o] of Object.entries(owners)) {
      const i = isleById(w, id);
      if (i && isSeen(s, i.c, i.r, seen)) dot(i.c, i.r, o.p === s.id ? '#4fd06a' : o.g && allies.includes(o.g) ? '#5aa8ff' : '#f0554a', 2);
    }
    // đảo bí ẩn đã thấy (trong các khoang đã khám phá)
    for (const ch of seenChunks(s))
      for (const i of w.islesIn(ch.cx * ch.size, ch.cy * ch.size, (ch.cx + 1) * ch.size - 1, (ch.cy + 1) * ch.size - 1))
        if (i.kind === 'bian' && isSeen(s, i.c, i.r, seen) && !owners[i.id]) dot(i.c, i.r, '#c07cff', 2);
    for (const o of s.isles) {
      const i = isleById(w, o.id);
      if (i) dot(i.c, i.r, '#4fd06a', 3);
    }
    for (const p of ui.store.net.islands()) {
      const h = p.home ?? islandCell(p.id, s.khu);
      if (isSeen(s, h.x, h.y, seen)) dot(h.x, h.y, p.bot ? '#ffc36a' : p.guild && allies.includes(p.guild) ? '#5aa8ff' : '#f0554a', 3);
    }
    dot(CENTER.c, CENTER.r, '#8a1f1f', 6);
    const me = homeCell(s);
    dot(me.x, me.y, '#ffe27a', 5);
    cv.addEventListener('click', (e) => {
      const rect = cv.getBoundingClientRect();
      const c = Math.max(0, Math.min(WORLD_W - 1, Math.floor(((e.clientX - rect.left) / rect.width) * WORLD_W)));
      const r = Math.max(0, Math.min(WORLD_H - 1, Math.floor(((e.clientY - rect.top) / rect.height) * WORLD_H)));
      ui.closeSheet();
      ui.sea.focusCell(c, r);
    });
    const go = () => {
      const q = (body.querySelector<HTMLInputElement>('#mapQ')!.value || '').trim();
      const m = q.match(/^\(?\s*(\d{1,4})\s*[,; ]\s*(\d{1,4})\s*\)?$/);
      let target: { c: number; r: number } | null = null;
      if (m) target = { c: Math.min(WORLD_W - 1, Number(m[1])), r: Math.min(WORLD_H - 1, Number(m[2])) };
      else if (q) {
        const low = q.toLowerCase();
        const p = ui.store.net.islands().find((x) => x.id === q || x.name.toLowerCase().includes(low) || x.islandName.toLowerCase().includes(low));
        if (p) {
          const h = p.home ?? islandCell(p.id, s.khu);
          target = { c: h.x, r: h.y };
        } else {
          // tìm đảo tự nhiên theo tên trong vùng đã khám phá
          outer: for (const ch of seenChunks(s))
            for (const i of w.islesIn(ch.cx * ch.size, ch.cy * ch.size, (ch.cx + 1) * ch.size - 1, (ch.cy + 1) * ch.size - 1))
              if (i.name.toLowerCase().includes(low) && isSeen(s, i.c, i.r, seen)) {
                target = { c: i.c, r: i.r };
                break outer;
              }
        }
      }
      if (!target) return ui.toast('Không tìm thấy. Thử toạ độ dạng 340,520 hoặc tên đảo đã khám phá.', 'bad');
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
