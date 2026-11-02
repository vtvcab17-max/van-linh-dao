// Giao diện DOM: thanh tài nguyên, bảng linh vật, đội, chat, góp ý, hải đồ, credit Beta Holding.
import type Phaser from 'phaser';
import {
  CHESTS,
  COMPANIONS,
  COMP_KEYS,
  EVOLVE_COST,
  FEEDABLE,
  FEED_PORTION,
  GAME,
  INTRO,
  LINH_VAT,
  MONSTERS,
  RES,
  RES_KEYS,
  SKILLS,
  HOME_CELL,
  TIER_NAMES,
  XP_TO_NEXT,
  type LvKey,
  type ResKey,
  type WildDef,
} from '../../shared/data';
import { buildMs, buildOf, buildSlots, canPay, currentQuest, dockPos, expandCost, landCap, landCount, LV_POS, newPlayer, power, publicOf, sailMs, storageCap, titleOf, xpForLevel, type IslandPub, type Outcome } from '../../shared/logic';
import { drawLeu, drawMiniIsland, drawEmote } from './art/sprites';
import { canvasUrl, iconUrl, lvCanvas, portraitUrl } from './art/textures';
import { avatarUrl } from './art/avatar';
import { drawSeaIsland, lookOf } from './art/islands';
import { avatarFrom, cleanAvatar, GENDERS, HAIRS, HAIR_COLORS, HATS, ITEMS, OUTFITS, OUTFIT_COLORS, SKINS, type Avatar } from '../../shared/avatar';
import { hashStr } from '../../shared/rng';
import type { IslandScene } from './scenes/IslandScene';
import type { SeaScene } from './scenes/SeaScene';
import type { BattleScene, BattleData } from './scenes/BattleScene';
import type { Store } from './store';
import type { Feedback } from './net/types';
import { ls } from './net/base';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fmt = (n: number) => (n >= 10000 ? (n / 1000).toFixed(0) + 'k' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.floor(n)));
const secs = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
};
const hms = (ms: number) => {
  const t = Math.max(0, Math.ceil(ms / 1000));
  if (t >= 3600) return `${Math.floor(t / 3600)} giờ ${Math.floor((t % 3600) / 60)} phút`;
  if (t >= 60) return `${Math.floor(t / 60)} phút ${t % 60 ? `${t % 60} giây` : ''}`.trim();
  return `${t} giây`;
};
const costHtml = (cost: Partial<Record<ResKey, number>>, have: Record<ResKey, number>) =>
  Object.entries(cost)
    .map(([k, v]) => `<span class="cost ${have[k as ResKey] >= (v ?? 0) ? '' : 'short'}"><img src="${iconUrl(k)}" alt="">${v} ${RES[k as ResKey].name}</span>`)
    .join(' ');

type Tab = 'island' | 'sea' | 'team' | 'chat' | 'feedback';

/** Dáng vẻ của một đảo người khác (dữ liệu gửi qua mạng nên luôn kiểm lại). */
export const pubAvatar = (p: { id: string; avatar?: unknown }): Avatar => cleanAvatar(p.avatar) ?? avatarFrom(p.id);

export class UI {
  game!: Phaser.Game;
  private tab: Tab = 'island';
  private bubble: { text: string; until: number; anchor: () => { x: number; y: number } } | null = null;
  private sheetKind = '';
  private sheetRefresh: (() => void) | null = null;
  private perfOn = false;
  private lastChatSeen = 0;
  private ratings = { fun: 0, smooth: 0, clear: 0 };

  constructor(public store: Store) {}

  get island(): IslandScene {
    return this.game.scene.getScene('island') as IslandScene;
  }
  get sea(): SeaScene {
    return this.game.scene.getScene('sea') as SeaScene;
  }
  private switching = false;

  /** Thu nhỏ đảo → ra hải đồ (liền mạch). */
  goSea() {
    if (this.switching || this.tab === 'sea') return;
    this.switching = true;
    this.closeSheet();
    this.toggleExpand(false);
    this.setTabUi('sea');
    this.island.leaveToSea(() => {
      this.game.scene.sleep('island');
      this.game.scene.run('sea');
      this.store.net.setActivity('đang xem Hải Khu');
      this.switching = false;
      this.updatePads();
    });
  }

  /** Phóng vào đảo nhà từ hải đồ. */
  goIsland() {
    if (this.switching || this.tab === 'island') return;
    this.switching = true;
    this.closeSheet();
    this.setTabUi('island');
    this.sea.leaveToIsland(() => {
      this.game.scene.sleep('sea');
      this.game.scene.run('island');
      this.switching = false;
      this.updatePads();
    });
  }

  private setTabUi(tab: 'island' | 'sea') {
    this.tab = tab;
    document.querySelectorAll<HTMLButtonElement>('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    $('#tools').hidden = tab !== 'island';
    $('#zMode').textContent = tab === 'island' ? 'Ra biển' : 'Về đảo';
    this.renderQuest();
  }

  /** Báo cho camera biết phần màn hình bị thanh trên và bảng dưới che (để đảo không nằm khuất). */
  updatePads() {
    if (!this.game) return;
    const rs = (this.game.registry.get('rs') as number) || 1;
    const topEl = $('#top').getBoundingClientRect();
    const quest = $('#quest');
    const top = Math.max(topEl.bottom, quest.hidden ? 0 : quest.getBoundingClientRect().bottom) + 6;
    const sheet = $('#sheet');
    const bottomEdge = !sheet.hidden ? sheet.getBoundingClientRect().top : $('#nav').getBoundingClientRect().top;
    const bottom = innerHeight - bottomEdge + 6;
    for (const sc of [this.island, this.sea]) sc?.ctl?.setPads(top / rs, bottom / rs);
  }

  zoom(dir: 1 | -1) {
    if (this.switching) return;
    if (this.tab === 'sea') this.sea.zoomStep(dir);
    else this.island.zoomStep(dir);
  }

  // ---------------- thuyền ----------------
  renderVoyage() {
    const s = this.store.s;
    const el = $('#voyage');
    const v = s.voyage;
    const lb = s.lastBattle;
    if (!v && !(lb && !lb.seen)) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const name = LINH_VAT.thuyen.tiers[s.lv.thuyen.tier - 1];
    let text = '';
    if (lb && !lb.seen) text = `<b>Xem trận</b><span>${esc(lb.title)} · ${lb.o.battle?.winner === 0 ? 'thắng' : 'thua'}</span>`;
    else if (v) {
      const end = v.phase === 'di' ? v.arriveAt : v.returnAt;
      const left = secs((end - s.gt) / s.speed);
      text = v.phase === 'di' ? `<b>${esc(name)} đang đi</b><span>tới ${esc(v.targetName)} sau ${left}</span>` : `<b>${esc(name)} đang về</b><span>về bến sau ${left}</span>`;
    }
    el.innerHTML = `<img src="${canvasUrl('boat-ui-' + s.lv.thuyen.tier, () => lvCanvas('thuyen', s.lv.thuyen.tier), 2)}" alt="">${text}`;
  }

  onVoyageChip() {
    const lb = this.store.s.lastBattle;
    if (lb && !lb.seen) return this.playLastBattle();
    if (this.tab !== 'sea') this.goSea();
  }

  playLastBattle() {
    const lb = this.store.s.lastBattle;
    if (!lb || !lb.o.battle) return;
    lb.seen = true;
    this.store.changed();
    this.runBattle(lb.o, lb.title, true);
  }

  private sailLine(to: { x: number; y: number }) {
    const s = this.store.s;
    const ms = sailMs(s, to) / s.speed;
    const dist = Math.max(1, Math.hypot(to.x - HOME_CELL.x, to.y - HOME_CELL.y));
    return `<div class="card"><small>Hải trình</small><p>Cách đảo bạn <b>${dist.toFixed(1).replace('.', ',')} hải lý</b>. ${esc(LINH_VAT.thuyen.tiers[s.lv.thuyen.tier - 1])} đi mất <b>${hms(ms)}</b>, về mất <b>${hms(ms)}</b>.</p><p class="muted small">Xa hơn thì lâu hơn. Tiến hóa thuyền để đi nhanh hơn. Chiến lợi phẩm về tới bến mới nhận.</p></div>`;
  }

  private sail(o: Outcome) {
    if (!o.ok) return this.toast(o.msg, 'bad');
    this.toast(o.msg, 'gold');
    this.closeSheet();
    this.renderVoyage();
    if (this.tab !== 'sea') this.goSea();
    else this.sea.draw(true);
  }

  init(game: Phaser.Game) {
    this.game = game;
    document.querySelectorAll<HTMLButtonElement>('#nav button').forEach((b) => b.addEventListener('click', () => this.showTab(b.dataset.tab as Tab)));
    $('#btnSettings').addEventListener('click', () => this.openSettings());
    $('#meAv').addEventListener('click', () => this.openAvatar());
    $('#btnExpand').addEventListener('click', () => this.toggleExpand());
    $('#btnSpeed').addEventListener('click', () => {
      const next = this.store.s.speed === 1 ? 5 : this.store.s.speed === 5 ? 10 : 1;
      const o = this.store.do({ t: 'speed', speed: next });
      this.toast(o.msg);
      this.render();
    });
    $('#sheet .x').addEventListener('click', () => this.closeSheet());
    $('#zIn').addEventListener('click', () => this.zoom(1));
    $('#zOut').addEventListener('click', () => this.zoom(-1));
    $('#zMode').addEventListener('click', () => (this.tab === 'island' ? this.goSea() : this.goIsland()));
    $('#voyage').addEventListener('click', () => this.onVoyageChip());
    addEventListener('resize', () => setTimeout(() => this.updatePads(), 120));
    $('#btnSkip').addEventListener('click', () => (this.game.scene.getScene('battle') as BattleScene).skip());
    const navIcons: Record<string, string> = {
      island: canvasUrl('nav-leu', () => drawLeu(1, false, 'thuong'), 1),
      sea: canvasUrl('nav-sea', () => drawMiniIsland(6, 'me'), 1),
      team: avatarUrl(this.store.s.avatar, 2, true),
      chat: canvasUrl('nav-chat', () => drawEmote('nghe'), 3),
      feedback: canvasUrl('nav-fb', () => drawEmote('vui'), 3),
    };
    document.querySelectorAll<HTMLButtonElement>('#nav button').forEach((b) => {
      const img = document.createElement('img');
      img.src = navIcons[b.dataset.tab!];
      img.alt = '';
      b.prepend(img);
    });
    this.store.on('change', () => this.render());
    this.store.on('tick', () => {
      this.renderVoyage();
      this.renderRes();
      this.sheetRefresh?.();
      if (this.perfOn) this.renderPerf();
    });
    this.store.on('note', (n) => this.toast(String(n), 'gold'));
    this.store.net.on('notice', (d) => {
      const { msg, kind } = d as { msg: string; kind: 'good' | 'bad' };
      if (msg) this.toast(msg, kind);
    });
    // bản chính thức: không có nút tăng tốc thời gian
    if (this.store.auth) $('#btnSpeed').hidden = true;
    this.store.on('built', (d) => this.onBuilt(d as { lv: LvKey; tier: number }));
    this.store.on('raided', (d) => {
      const { text, ev } = d as { text: string; ev: { win: boolean } };
      this.toast(text, ev.win ? 'bad' : 'good', 6000);
      this.island.cameras.main.shake(250, 0.006);
    });
    this.store.net.on('chat', () => this.renderChatBadge());
    this.store.net.on('status', (s) => this.toast(String(s), 'muted'));
    this.store.net.on('islands', () => this.renderTop());
    setInterval(() => this.renderChatBadge(), 5000);
    this.lastChatSeen = Number(ls.get('vld-chat-seen') ?? Date.now());
    const top = $('#top');
    const setTop = () => document.documentElement.style.setProperty('--top-h', `${Math.round(top.getBoundingClientRect().bottom)}px`);
    new ResizeObserver(() => {
      setTop();
      this.updatePads();
    }).observe(top);
    setTop();
    this.updatePads();
    if (this.island?.ctl) this.island.fitCamera(true);
    this.render();
  }

  // ---------------- khung chính ----------------
  render() {
    this.renderTop();
    this.renderRes();
    this.renderQuest();
    this.renderVoyage();
    $('#btnSpeed').textContent = `Tốc độ x${this.store.s.speed}`;
    $('#btnSpeed').classList.toggle('hot', this.store.s.speed > 1);
  }

  renderTop() {
    const s = this.store.s;
    const p = power(s);
    $('#islandName').textContent = s.islandName;
    $('#title').textContent = `${titleOf(p)} · ${p} sức mạnh`;
    const av = avatarUrl(s.avatar, 3, true);
    const meImg = $('#meAv img') as HTMLImageElement;
    if (meImg.getAttribute('src') !== av) {
      meImg.src = av;
      const nav = document.querySelector('#nav [data-tab="team"] img') as HTMLImageElement | null;
      if (nav) nav.src = avatarUrl(s.avatar, 2, true);
    }
    const online = this.store.net.online().length;
    $('#mode').textContent = this.store.net.mode === 'offline' ? 'Trên máy' : `Online · ${online}`;
    $('#mode').title = this.store.net.label;
  }

  renderRes() {
    const s = this.store.s;
    const cap = storageCap(s);
    const el = $('#res');
    const show: ResKey[] = ['co', 'la', 'tre', 'go', 'cui', 'da', 'sat', 'so', 'ngoc'];
    if (el.childElementCount !== show.length) {
      el.innerHTML = show.map((k) => `<span class="r" data-k="${k}" title="${RES[k].name}"><img src="${iconUrl(k)}" alt="${RES[k].name}"><b></b></span>`).join('');
    }
    for (const k of show) {
      const span = el.querySelector<HTMLElement>(`[data-k="${k}"]`)!;
      const b = span.querySelector('b')!;
      const v = fmt(s.res[k]);
      if (b.textContent !== v) {
        b.textContent = v;
        span.classList.remove('bump');
        void span.offsetWidth;
        span.classList.add('bump');
      }
      span.classList.toggle('full', RES[k].capped && s.res[k] >= cap);
    }
  }

  renderQuest() {
    const q = currentQuest(this.store.s);
    const el = $('#quest');
    el.hidden = !q || this.tab !== 'island';
    if (q) el.innerHTML = `<img src="${portraitUrl('rua')}" alt=""><span><small>Rùa Vàng dặn</small>${esc(q.text)}</span>`;
    el.onclick = () => this.openRua();
    // nhiệm vụ cần bấm nút trên giao diện: nút đó nhấp nháy để người mới biết bấm vào đâu
    $('#btnExpand').classList.toggle('pulse', q?.id === 'q_expand');
    $('#nav [data-tab="sea"]').classList.toggle('pulse', q?.id === 'q_fight' || q?.id === 'q_raid');
  }

  renderChatBadge() {
    const last = this.store.net.chats().filter((m) => m.from !== this.store.net.meId).slice(-1)[0];
    const badge = !!last && last.t > this.lastChatSeen && this.tab !== 'chat';
    $('#nav [data-tab="chat"]').classList.toggle('badge', badge);
    if (this.sheetKind === 'chat') this.sheetRefresh?.();
  }

  showTab(tab: Tab) {
    const prev = this.tab;
    this.tab = tab;
    document.querySelectorAll<HTMLButtonElement>('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    if (tab === 'island' || tab === 'sea') {
      this.tab = prev;
      this.closeSheet();
      if (tab === 'sea') this.goSea();
      else this.goIsland();
      return;
    }
    if (tab === 'team') this.openTeam();
    if (tab === 'chat') this.openChat();
    if (tab === 'feedback') this.openFeedback();
    if (tab === 'team' || tab === 'chat' || tab === 'feedback') {
      document.querySelectorAll<HTMLButtonElement>('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
      this.tab = prev === 'sea' ? 'sea' : 'island';
      this.tabSheet = tab;
    }
    this.renderQuest();
  }
  private tabSheet: Tab | null = null;

  toggleExpand(on?: boolean) {
    const v = this.island.toggleExpand(on);
    const b = $('#btnExpand');
    b.classList.toggle('hot', v);
    const s = this.store.s;
    if (v) {
      const full = landCount(s) >= landCap(s);
      b.innerHTML = full ? 'Đảo đã đủ đất' : `Ô đất thứ ${landCount(s) + 1}: ${costHtml(expandCost(s), s.res)}`;
      if (full) this.toast('Nâng Nhà chính để mở thêm đất.', 'muted');
    } else b.textContent = 'Khai hoang';
  }

  // ---------------- thông báo ----------------
  toast(text: string, kind: 'good' | 'bad' | 'muted' | 'gold' | '' = '', ms = 3200) {
    if (!text) return;
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    box.appendChild(el);
    while (box.childElementCount > 2) box.firstElementChild!.remove();
    setTimeout(() => el.classList.add('out'), ms);
    setTimeout(() => el.remove(), ms + 400);
  }

  floatAt(x: number, y: number, text: string, kind: 'good' | 'bad' | 'muted' | 'gold' | '' = '', icon?: string, color?: string, size?: number) {
    const el = document.createElement('div');
    el.className = `float ${kind}`;
    if (color) el.style.color = color;
    if (size) el.style.fontSize = `${size}px`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.innerHTML = `${icon ? `<img src="${icon}" alt="">` : ''}${esc(text)}`;
    $('#floats').appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }

  floatGains(x: number, y: number, g: Partial<Record<ResKey, number>>) {
    Object.entries(g).forEach(([k, v], i) => setTimeout(() => this.floatAt(x, y - i * 16, `+${v}`, 'good', iconUrl(k)), i * 120));
  }

  banner(text: string, win: boolean) {
    const el = document.createElement('div');
    el.className = `banner ${win ? 'win' : 'lose'}`;
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  questDone(text: string) {
    this.toast(`Xong việc: ${text}`, 'gold', 3500);
    this.renderQuest();
  }

  chestOpened(o: Outcome, at: { x: number; y: number }) {
    const c = CHESTS[o.chest ?? 0];
    this.floatGains(at.x, at.y, o.gained ?? {});
    this.toast(`${c.name} (${c.rarity})`, o.chest && o.chest >= 3 ? 'gold' : 'good');
  }

  // ---------------- bong bóng tiếng lòng ----------------
  showBubble(text: string, anchor: () => { x: number; y: number }, ms = 4200) {
    if (!text) return;
    this.bubble = { text, until: Date.now() + ms, anchor };
    const el = $('#bubble');
    el.textContent = text;
    el.hidden = false;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
    this.updateBubble();
  }
  updateBubble() {
    const el = $('#bubble');
    if (!this.bubble) return;
    if (Date.now() > this.bubble.until || this.tab !== 'island') {
      el.hidden = true;
      this.bubble = null;
      return;
    }
    const p = this.bubble.anchor();
    const w = el.offsetWidth;
    el.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, p.x - w / 2))}px`;
    el.style.top = `${Math.max(70, p.y - el.offsetHeight - 10)}px`;
  }

  // ---------------- bảng trượt ----------------
  openSheet(kind: string, title: string, html: string, bind?: (body: HTMLElement) => void, refresh?: () => void) {
    this.sheetKind = kind;
    const sheet = $('#sheet');
    sheet.querySelector('h2')!.textContent = title;
    const body = sheet.querySelector<HTMLElement>('.sheet-body')!;
    body.innerHTML = html;
    bind?.(body);
    this.sheetRefresh = refresh ?? null;
    sheet.hidden = false;
    sheet.classList.remove('in');
    void sheet.offsetWidth;
    sheet.classList.add('in');
    requestAnimationFrame(() => this.updatePads());
  }
  closeSheet() {
    const wasOpen = !$('#sheet').hidden;
    $('#sheet').hidden = true;
    if (wasOpen) requestAnimationFrame(() => this.updatePads());
    this.sheetKind = '';
    this.sheetRefresh = null;
    if (this.tabSheet) {
      this.tabSheet = null;
      document.querySelectorAll<HTMLButtonElement>('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === this.tab));
    }
  }

  // ---------------- linh vật ----------------
  openLv(k: LvKey) {
    this.toggleExpand(false);
    const o = this.store.do({ t: 'listen', lv: k });
    if (o.line) this.showBubble(o.line, () => this.island.lvAnchor(k));
    if (o.quest) this.questDone(o.quest);
    this.store.net.setActivity(`đang nghe ${LINH_VAT[k].tiers[this.store.s.lv[k].tier - 1]}`);
    const p = k === 'thuyen' ? dockPos(this.store.s) : LV_POS[k];
    this.island.focusTile(p.x, p.y);
    const draw = () => {
      const s = this.store.s;
      const l = s.lv[k];
      const def = LINH_VAT[k];
      const need = XP_TO_NEXT[l.tier - 1] ?? 0;
      const maxed = l.tier >= 5;
      const cost = EVOLVE_COST[l.tier - 1] ?? {};
      const canEvo = !maxed && l.xp >= need;
      const building = buildOf(s, k);
      const img = canvasUrl(`lvp-${k}-${l.tier}`, () => lvCanvas(k, l.tier), 3);
      const mood = l.mood === 'vui' ? 'Đang vui' : l.mood === 'doi' ? 'Đang dỗi' : l.hunger > 60 ? 'Đang đói' : 'Bình thường';
      const feeds = FEEDABLE.map((r) => {
        const known = l.known.includes(r);
        const enough = s.res[r] >= (known ? FEED_PORTION : 1);
        return `<button class="feed ${known ? 'known' : ''}" data-r="${r}" ${enough && !maxed ? '' : 'disabled'} title="${known ? 'Món ưa thích' : 'Chưa biết có thích không'}"><img src="${iconUrl(r)}" alt=""><span>${RES[r].name}</span><small>${fmt(s.res[r])}</small>${known ? '<i>thích</i>' : ''}</button>`;
      }).join('');
      return `
        <div class="lv-head">
          <img class="lv-img" src="${img}" alt="">
          <div>
            <div class="tier">Bậc ${l.tier} · ${TIER_NAMES[l.tier - 1]}</div>
            <h3>${def.tiers[l.tier - 1]}</h3>
            <p class="muted">${def.role}</p>
            <p class="mood mood-${l.mood}">${mood}</p>
          </div>
        </div>
        <div class="bars">
          <label>Linh khí <b>${maxed ? 'Đã Thành Thần' : `${l.xp}/${need}`}</b></label>
          <div class="bar"><i style="width:${maxed ? 100 : Math.round((l.xp / need) * 100)}%"></i></div>
          <label>Cơn đói <b>${Math.round(l.hunger)}%</b></label>
          <div class="bar hunger"><i style="width:${Math.round(l.hunger)}%"></i></div>
        </div>
        <p class="hint">Cho ăn ${FEED_PORTION} món một lần. Ăn đúng món thì vui và lớn nhanh. Ăn sai món thì dỗi, làm việc chậm đi một lúc.</p>
        <div class="feeds">${feeds}</div>
        ${maxed ? '' : building ? `
        <div class="build-box">
          <b>Đang xây ${def.tiers[building.to - 1]} · còn ${hms((building.end - s.gt) / s.speed)}</b>
          <div class="bar"><i style="width:${Math.round(((s.gt - building.start) / (building.end - building.start)) * 100)}%"></i></div>
          <p class="muted small">Công trình vẫn làm việc ở bậc hiện tại trong lúc xây.</p>
        </div>` : `
        <div class="evolve">
          <div><b>Xây lên ${def.tiers[l.tier]}</b><div class="costs">${costHtml(cost, s.res)}</div><p class="muted small">Thời gian xây: ${hms(buildMs(k, l.tier) / s.speed)} · Thợ đang bận ${s.builds.length}/${buildSlots(s)}</p></div>
          <button class="primary" id="btnEvolve" ${canEvo && canPay(s, cost) && s.builds.length < buildSlots(s) ? '' : 'disabled'}>${!canEvo ? 'Chưa đủ linh khí' : s.builds.length >= buildSlots(s) ? 'Thợ đang bận' : 'Bắt đầu xây'}</button>
        </div>`}
        <ol class="ladder">${def.tiers.map((t, i) => `<li class="${i < l.tier ? 'done' : ''}">${t}</li>`).join('')}</ol>`;
    };
    const bind = (body: HTMLElement) => {
      body.querySelectorAll<HTMLButtonElement>('.feed').forEach((b) =>
        b.addEventListener('click', () => {
          const r = b.dataset.r as ResKey;
          const res = this.store.do({ t: 'feed', lv: k, res: r });
          if (res.line) this.showBubble(res.line, () => this.island.lvAnchor(k));
          if (!res.ok) this.toast(res.msg, 'bad');
          else if (res.msg) {
            const a = this.island.lvAnchor(k);
            this.floatAt(a.x, a.y + 10, res.msg, res.msg.startsWith('+') ? 'gold' : 'bad');
          }
          if (res.quest) this.questDone(res.quest);
          this.rerenderSheet(draw, bind);
        }),
      );
      body.querySelector('#btnEvolve')?.addEventListener('click', () => {
        const res = this.store.do({ t: 'evolve', lv: k });
        if (!res.ok) return this.toast(res.msg, 'bad');
        this.toast(`${res.msg} Xong sau ${hms(buildMs(k, this.store.s.lv[k].tier) / this.store.s.speed)}.`, 'gold', 4000);
        if (res.line) this.showBubble(res.line, () => this.island.lvAnchor(k), 4000);
        this.rerenderSheet(draw, bind);
      });
    };
    let last = '';
    this.openSheet(`lv-${k}`, 'Thính Hồn', draw(), bind, () => {
      // làm mới đồng hồ xây mỗi giây
      if (!buildOf(this.store.s, k) && !last) return;
      const html = draw();
      if (html !== last) {
        last = html;
        this.rerenderSheet(draw, bind);
      }
    });
  }

  /** Xây xong: chớp sáng, linh vật nói câu tiến hóa. */
  onBuilt(d: { lv: LvKey; tier: number }) {
    if (this.tab === 'island') this.island.cameras.main.flash(400, 255, 230, 140);
    const line = LINH_VAT[d.lv].voice.evolve[d.tier - 1];
    if (line && this.tab === 'island') this.showBubble(line, () => this.island.lvAnchor(d.lv), 6000);
  }

  private rerenderSheet(draw: () => string, bind: (b: HTMLElement) => void) {
    const body = $('#sheet .sheet-body');
    const scroll = body.scrollTop;
    body.innerHTML = draw();
    bind(body);
    body.scrollTop = scroll;
  }

  openRua() {
    const q = currentQuest(this.store.s);
    const html = `
      <div class="lv-head"><img class="lv-img" src="${portraitUrl('rua')}" alt=""><div><h3>Rùa Vàng</h3><p class="muted">Thần rùa từng trao móng cho An Dương Vương. Giờ dẫn đường cho người lưu lạc.</p></div></div>
      ${q ? `<div class="card gold"><small>Việc cần làm</small><p>${esc(q.text)}</p><div class="costs">Thưởng: ${costHtml(q.reward, { ...this.store.s.res, so: 1e9, co: 1e9, la: 1e9, tre: 1e9, go: 1e9, cui: 1e9, da: 1e9, sat: 1e9, ngoc: 1e9 })}</div></div>` : '<div class="card"><p>Con đã làm hết việc ta dặn. Giờ hãy ra Hải Khu mà tự lập nghiệp.</p></div>'}
      <div class="story">${INTRO.map((l) => `<p>${esc(l)}</p>`).join('')}</div>
      <ul class="tips">
        <li>Chạm vào đồ vật có mắt để nghe tiếng lòng của nó.</li>
        <li>Mỗi đồ vật thích một vài món. Thử cho ăn để tìm ra.</li>
        <li>Hòm trôi dạt vào bờ theo thời gian. Phẩm càng cao càng hiếm.</li>
        <li>Nhà chính bậc 2 mở đột kích người chơi. Lũy tre giữ đảo khi bị đột kích.</li>
      </ul>`;
    this.openSheet('rua', 'Rùa Vàng', html);
  }

  // ---------------- đội ----------------
  openTeam() {
    const draw = () => {
      const s = this.store.s;
      return `<p class="hint">Đội ra trận tự động theo lượt. Chủ đảo (bạn) đánh mạnh hơn khi Cuốc tiến hóa.</p>` +
        COMP_KEYS.map((k) => {
          const c = k === 'an' ? { ...COMPANIONS.an, name: esc(s.name) } : COMPANIONS[k];
          const st = s.comps[k];
          const img = k === 'an' ? avatarUrl(s.avatar, 4) : portraitUrl(k);
          if (!st.unlocked)
            return `<div class="unit locked"><img src="${portraitUrl(k)}" alt=""><div><h3>${c.name}</h3><p class="muted">${c.title}</p><p>Mở khóa: ${c.unlock}</p></div></div>`;
          const m = 1 + 0.12 * (st.lv - 1);
          const need = xpForLevel(st.lv);
          return `<div class="unit"><img src="${img}" alt=""><div>
            <h3>${c.name} <span class="lvl">Cấp ${st.lv}</span></h3>
            <p class="muted">${c.title} · ${c.row === 'front' ? 'hàng trước' : 'hàng sau'}</p>
            <div class="bar thin"><i style="width:${Math.round((st.xp / need) * 100)}%"></i></div>
            <div class="stats"><span>Máu ${Math.round(c.hp * m)}</span><span>Công ${Math.round(c.atk * m)}</span><span>Thủ ${Math.round(c.def * m)}</span><span>Tốc ${Math.round(c.spd + 0.2 * (st.lv - 1))}</span></div>
            <p><b>${SKILLS[c.skill].name}:</b> ${SKILLS[c.skill].desc}</p>
            <p class="muted small">${c.bio}</p>${k === 'an' ? '<button type="button" class="avEdit">Chỉnh nhân vật</button>' : ''}</div></div>`;
        }).join('');
    };
    this.openSheet('team', `Đội của ${esc(this.store.s.name)}`, draw(), (body) => body.querySelector('.avEdit')?.addEventListener('click', () => this.openAvatar()));
  }

  // ---------------- chat ----------------
  openChat() {
    this.lastChatSeen = Date.now();
    ls.set('vld-chat-seen', String(this.lastChatSeen));
    $('#nav [data-tab="chat"]').classList.remove('badge');
    const list = () =>
      this.store.net
        .chats()
        .map((m) => `<div class="msg ${m.from === this.store.net.meId ? 'me' : ''} ${m.bot ? 'bot' : ''}"><b><img src="${this.avatarOf(m.from)}" alt="">${esc(m.name)}${m.bot ? ' <i>máy</i>' : ''}</b><span>${esc(m.text)}</span><time>${new Date(m.t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time></div>`)
        .join('');
    const html = `<div class="chat" id="chatList">${list()}</div>
      <form class="chat-in" id="chatForm"><input id="chatText" maxlength="140" placeholder="${this.store.net.canWrite ? 'Nhắn cả Hải Khu...' : 'Bạn đang ở quyền chỉ xem'}" autocomplete="off" ${this.store.net.canWrite ? '' : 'disabled'}><button class="primary">Gửi</button></form>
      <p class="muted small">${esc(this.store.net.label)}. Tin của đảo máy được đánh dấu "máy".</p>`;
    let count = 0;
    const scroll = () => {
      const el = document.getElementById('chatList');
      if (el) el.scrollTop = el.scrollHeight;
    };
    this.openSheet(
      'chat',
      'Chat Hải Khu',
      html,
      (body) => {
        body.querySelector<HTMLFormElement>('#chatForm')!.addEventListener('submit', (e) => {
          e.preventDefault();
          const input = body.querySelector<HTMLInputElement>('#chatText')!;
          const t = input.value.trim();
          if (!t) return;
          this.store.net.sendChat(t);
          input.value = '';
        });
        setTimeout(scroll, 30);
      },
      () => {
        const n = this.store.net.chats().length;
        const last = this.store.net.chats().slice(-1)[0]?.id;
        const key = n + (last ?? '');
        if (String(count) === key) return;
        count = key as unknown as number;
        const el = document.getElementById('chatList');
        if (el) {
          el.innerHTML = list();
          scroll();
        }
      },
    );
  }

  // ---------------- góp ý (cơ chế đánh giá riêng cho chat này) ----------------
  openFeedback() {
    const p = this.store.perf;
    const stars = (key: 'fun' | 'smooth' | 'clear', label: string) =>
      `<div class="rate" data-key="${key}"><span>${label}</span>${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-n="${n}" class="${this.ratings[key] >= n ? 'on' : ''}" aria-label="${n} điểm">${n}</button>`).join('')}</div>`;
    const html = `
      <p class="hint">Góp ý của bạn được lưu kèm số đo thật trên máy (FPS, thời gian tải, sức mạnh đảo). Claude đọc chúng để sửa game.</p>
      <form id="fbForm">
        ${stars('fun', 'Vui')}
        ${stars('smooth', 'Mượt')}
        ${stars('clear', 'Dễ hiểu')}
        <textarea id="fbText" rows="4" maxlength="1500" placeholder="Chỗ nào khó chịu, chỗ nào thích, muốn thêm gì..."></textarea>
        <div class="measure">
          <span>FPS trung bình <b>${p.fpsAvg()}</b></span><span>FPS thấp nhất <b>${p.fpsLow()}</b></span><span>Tải xong <b>${(p.loadMs / 1000).toFixed(1)}s</b></span><span>Giật khung <b>${p.longFrames}</b></span>
        </div>
        <div class="row">
          <button class="primary" id="fbSave">Lưu góp ý</button>
          <button type="button" id="fbClaude" hidden>Gửi cho Claude</button>
        </div>
        <p class="muted small" id="fbMsg"></p>
      </form>`;
    const ctx = (): Feedback => ({
      t: Date.now(),
      ...this.ratings,
      text: ($('#fbText') as HTMLTextAreaElement).value.trim(),
      ctx: {
        version: GAME.version,
        mode: this.store.net.mode,
        fpsAvg: p.fpsAvg(),
        fpsLow: p.fpsLow(),
        loadMs: p.loadMs,
        longFrames: p.longFrames,
        power: power(this.store.s),
        tiers: `leu${this.store.s.lv.leu.tier} cuoc${this.store.s.lv.cuoc.tier} rao${this.store.s.lv.rao.tier}`,
        quests: this.store.s.quests.length,
        minutes: p.minutes(),
        screen: `${innerWidth}x${innerHeight}@${devicePixelRatio}`,
      },
    });
    this.openSheet('feedback', 'Góp ý cho Claude', html, (body) => {
      body.querySelectorAll<HTMLElement>('.rate').forEach((r) =>
        r.addEventListener('click', (e) => {
          const b = (e.target as HTMLElement).closest('button');
          if (!b) return;
          const key = r.dataset.key as 'fun' | 'smooth' | 'clear';
          this.ratings[key] = Number(b.dataset.n);
          r.querySelectorAll('button').forEach((x) => x.classList.toggle('on', Number((x as HTMLElement).dataset.n) <= this.ratings[key]));
        }),
      );
      body.querySelector('#fbForm')!.addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = ctx();
        if (!f.fun && !f.smooth && !f.clear && !f.text) return ($('#fbMsg').textContent = 'Chấm điểm hoặc viết vài chữ trước đã.');
        $('#fbMsg').textContent = 'Đang lưu...';
        $('#fbMsg').textContent = await this.store.net.sendFeedback(f);
      });
      const btn = body.querySelector<HTMLButtonElement>('#fbClaude')!;
      void this.store.net.canSendToClaude().then((ok) => (btn.hidden = !ok));
      btn.addEventListener('click', () => {
        const f = ctx();
        this.store.net.sendToClaude(f).then((m) => ($('#fbMsg').textContent = m));
        void this.store.net.sendFeedback(f);
      });
    });
  }

  // ---------------- hải đồ ----------------
  private sailButton(ready: boolean, waitText: string, label: string) {
    const v = this.store.s.voyage;
    if (v) return `<button class="primary wide" id="btnSail" disabled>${v.phase === 'di' ? 'Thuyền đang ngoài khơi' : 'Chờ thuyền về bến'}</button>`;
    return `<button class="primary wide" id="btnSail" ${ready ? '' : 'disabled'}>${ready ? label : waitText}</button>`;
  }

  openWild(w: WildDef) {
    const draw = () => {
      const s = this.store.s;
      const st = s.wilds[w.id];
      const wait = st ? st.readyAt - s.gt : 0;
      const bonus = Math.min(5, st?.wins ?? 0);
      return `
        <p class="muted">Cấp ${w.level + bonus}${bonus ? ` (mạnh lên sau ${st!.wins} lần bị dọn)` : ''}</p>
        <div class="enemies">${w.enemies.map(([k, lv]) => `<div class="enemy"><img src="${portraitUrl(k)}" alt=""><span>${MONSTERS[k].name}</span><small>cấp ${lv + bonus} · ${SKILLS[MONSTERS[k].skill].name}</small></div>`).join('')}</div>
        <div class="card"><small>Phần thưởng</small><div class="costs">${costHtml(w.loot, { ...s.res, ...Object.fromEntries(RES_KEYS.map((k) => [k, 1e9])) })}${w.chest !== undefined ? ` <span class="cost" style="color:${CHESTS[w.chest].color}">+ có thể rơi ${CHESTS[w.chest].name}</span>` : ''}</div></div>
        ${this.sailLine({ x: w.sx, y: w.sy })}
        ${this.sailButton(wait <= 0, `Quái kéo về sau ${secs(wait / s.speed)}`, 'Lên thuyền ra trận')}`;
    };
    const bind = (body: HTMLElement) => body.querySelector('#btnSail')?.addEventListener('click', () => this.sail(this.store.do({ t: 'sail', kind: 'wild', id: w.id })));
    let last = '';
    this.openSheet('wild', w.name, draw(), bind, () => {
      const html = draw();
      if (html === last) return;
      last = html;
      this.rerenderSheet(draw, bind);
    });
  }

  openIsland(p: IslandPub, isMe: boolean) {
    const s = this.store.s;
    const me = publicOf(s);
    const cd = (s.raidCd[p.id] ?? 0) - s.gt;
    const online = this.store.net.online().some((o) => o.id === p.id);
    const lootPreview = Object.entries(p.lootable)
      .slice(0, 6)
      .map(([k, v]) => `<span class="cost"><img src="${iconUrl(k)}" alt="">~${Math.floor((v ?? 0) * 0.15)}</span>`)
      .join(' ');
    const to = isMe ? { x: 0, y: 0 } : this.sea.cellOf(p.id);
    const html = `
      <div class="lv-head"><img class="lv-img" src="${canvasUrl(`isl-${p.id}-${p.land}-${p.tiers.leu}`, () => drawSeaIsland(p.id, p.land, p.bot ? 'bot' : isMe ? 'me' : 'player', p.tiers.leu ?? 1), 2)}" alt="">
        <div><h3>${esc(p.islandName)}</h3><p class="owner"><img src="${avatarUrl(pubAvatar(p), 2, true)}" alt="">${esc(p.name)} · ${esc(p.title)}${p.bot ? ' · đảo máy' : online ? ' · đang online' : ''}</p>
        <p><b>${p.power}</b> sức mạnh · ${p.land} ô đất · ${lookOf(hashStr(p.id)).name}</p></div></div>
      <div class="stats"><span>${LINH_VAT.leu.tiers[(p.tiers.leu ?? 1) - 1]}</span><span>${LINH_VAT.cuoc.tiers[(p.tiers.cuoc ?? 1) - 1]}</span><span>${LINH_VAT.rao.tiers[(p.tiers.rao ?? 1) - 1]}</span><span>${LINH_VAT.thuyen.tiers[(p.tiers.thuyen ?? 1) - 1]}</span></div>
      <div class="enemies">${p.team.map((t) => `<div class="enemy"><img src="${t.k === 'an' ? avatarUrl(pubAvatar(p), 3) : portraitUrl(t.k)}" alt=""><span>${t.k === 'an' ? esc(p.name) : COMPANIONS[t.k].name}</span><small>cấp ${t.lv}</small></div>`).join('')}</div>
      ${isMe ? `<p class="hint">Người khác thấy đảo bạn như thế này. Phần tài nguyên dưới mức được bảo vệ của Nhà chính không bị cướp.</p><button class="wide" id="btnHome">Phóng vào đảo</button>` : `
        <div class="card"><small>Nếu thắng, chở về khoảng</small><div class="costs">${lootPreview || 'Đảo này nghèo quá, chẳng có gì để lấy.'}</div></div>
        <p class="muted small">So sức: bạn ${me.power} · họ ${p.power}</p>
        ${this.sailLine(to)}
        ${this.sailButton(cd <= 0, `Vừa đột kích, chờ ${secs(cd / s.speed)}`, 'Lên thuyền đột kích')}`}`;
    this.openSheet('island', isMe ? 'Đảo của bạn' : 'Đảo láng giềng', html, (body) => {
      body.querySelector('#btnHome')?.addEventListener('click', () => this.goIsland());
      body.querySelector('#btnSail')?.addEventListener('click', () => {
        const o = this.store.do({ t: 'sail', kind: 'island', target: p, to });
        if (o.ok) this.store.net.setActivity(`đang chèo thuyền tới ${p.islandName}`);
        this.sail(o);
      });
    });
  }

  // ---------------- trận đánh ----------------
  runBattle(o: Outcome, title: string, fromVoyage = false) {
    this.closeSheet();
    const from = this.game.scene.isActive('sea') ? 'sea' : 'island';
    this.game.scene.sleep(from);
    $('#battlebar').hidden = false;
    $('#battleTitle').textContent = title;
    $('#nav').classList.add('dim');
    $('#zoombar').hidden = true;
    const data: BattleData = {
      battle: o.battle!,
      title,
      onDone: () => {
        this.game.scene.stop('battle');
        this.game.scene.wake(from);
        $('#battlebar').hidden = true;
        $('#zoombar').hidden = false;
        $('#nav').classList.remove('dim');
        this.showResult(o, title, fromVoyage);
      },
    };
    this.game.scene.start('battle', data);
  }

  showResult(o: Outcome, title: string, fromVoyage = false) {
    const win = o.battle?.winner === 0;
    const gained = Object.entries(o.gained ?? {})
      .map(([k, v]) => `<span class="cost"><img src="${iconUrl(k)}" alt="">+${v}</span>`)
      .join(' ');
    const ups = (o.levelUps ?? []).map((k) => COMPANIONS[k].name);
    const v = this.store.s.voyage;
    const html = `
      <div class="result ${win ? 'win' : 'lose'}"><b>${win ? 'Thắng trận' : 'Thua trận'}</b><span>${o.battle?.rounds ?? 0} lượt</span></div>
      <p>${esc(o.msg)}</p>
      ${gained ? `<div class="card"><small>${fromVoyage ? (v ? 'Đang chở về bến' : 'Đã chở về bến') : 'Nhận được'}</small><div class="costs">${gained}</div></div>` : ''}
      ${ups.length ? `<p class="good">Lên cấp: ${[...new Set(ups)].join(', ')}</p>` : ''}
      ${win ? '' : '<p class="hint">Mẹo: cho Cuốc ăn sắt để chủ đảo đánh mạnh hơn, nâng Nhà chính để có Thu Hà hồi máu.</p>'}
      <button class="primary wide" id="btnOk">Tiếp tục</button>`;
    this.openSheet('result', title, html, (b) => b.querySelector('#btnOk')!.addEventListener('click', () => this.closeSheet()));
  }

  // ---------------- cài đặt, credit ----------------
  openSettings() {
    const s = this.store.s;
    const html = `
      <form id="nameForm" class="stack">
        <label for="inName">Tên của bạn</label><input id="inName" maxlength="18" value="${esc(s.name)}">
        <label for="inIsland">Tên đảo</label><input id="inIsland" maxlength="24" value="${esc(s.islandName)}">
        <button class="primary">Lưu tên</button>
      </form>
      <div class="card"><small>Chế độ chơi</small><p>${esc(this.store.net.label)}</p>${
        this.store.net.account
          ? `<p class="muted small">Đăng nhập bằng Google · ${esc(this.store.net.account.name)}. Đảo được lưu trên server, chơi máy nào cũng tiếp tục được.</p><button type="button" id="btnLogout">Đăng xuất</button>`
          : ''
      }</div>
      <div class="row wrap">
        <button type="button" id="btnAv">Chỉnh nhân vật</button>
        <button type="button" id="btnPerf">${this.perfOn ? 'Tắt bảng đo' : 'Bật bảng đo hiệu năng'}</button>
        <button type="button" id="btnLog">Nhật ký đảo</button>
        <button type="button" id="btnCredits">Credit</button>
      </div>
      ${this.store.auth ? '' : '<details class="danger"><summary>Chơi lại từ đầu</summary><p class="muted small">Xóa đảo hiện tại trên máy này và bắt đầu lại.</p><button type="button" id="btnReset">Xóa và chơi lại</button></details>'}
      <p class="credit">© 2026 ${GAME.studio}. Bảo lưu mọi quyền. · ${GAME.name} ${GAME.version}</p>`;
    this.openSheet('settings', 'Cài đặt', html, (body) => {
      body.querySelector('#btnAv')?.addEventListener('click', () => this.openAvatar());
      body.querySelector('#nameForm')!.addEventListener('submit', (e) => {
        e.preventDefault();
        const o = this.store.do({ t: 'rename', name: ($('#inName') as HTMLInputElement).value, island: ($('#inIsland') as HTMLInputElement).value });
        ls.set('vld-name', this.store.s.name);
        this.toast(o.msg, o.ok ? 'good' : 'bad');
        this.store.flush(true);
      });
      body.querySelector('#btnPerf')!.addEventListener('click', () => {
        this.perfOn = !this.perfOn;
        $('#perf').hidden = !this.perfOn;
        this.renderPerf();
        this.openSettings();
      });
      body.querySelector('#btnLog')!.addEventListener('click', () => this.openLog());
      body.querySelector('#btnCredits')!.addEventListener('click', () => this.openCredits());
      body.querySelector('#btnLogout')?.addEventListener('click', () => this.store.net.account?.logout());
      body.querySelector('#btnReset')?.addEventListener('click', () => {
        this.store.s = newPlayer(this.store.net.meId, this.store.s.name, Date.now());
        this.store.changed();
        this.store.flush(true);
        ls.set('vld-intro', '');
        setTimeout(() => location.reload(), 600);
      });
    });
  }

  openLog() {
    const items = this.store.s.log.map((l) => `<li><time>${new Date(l.t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time>${esc(l.text)}</li>`).join('');
    this.openSheet('log', 'Nhật ký đảo', items ? `<ul class="log">${items}</ul>` : '<p class="muted">Chưa có chuyện gì lớn xảy ra.</p>');
  }

  openCredits() {
    const html = `
      <div class="credits">
        <img src="${canvasUrl('cr-leu', () => drawLeu(5, false, 'vui'), 3)}" alt="">
        <h3>${GAME.name}</h3>
        <p class="muted">${GAME.tagline}</p>
        <dl>
          <dt>Phát triển và phát hành</dt><dd><b>${GAME.studio}</b></dd>
          <dt>Cảm hứng</dt><dd>Truyện dân gian Việt Nam: Sơn Tinh – Thủy Tinh, Thạch Sanh, Thánh Gióng, An Dương Vương</dd>
          <dt>Phiên bản</dt><dd>${GAME.version}</dd>
          <dt>Cảm ơn</dt><dd>Cộng đồng người chơi thử nghiệm</dd>
        </dl>
        <p class="credit">© 2026 ${GAME.studio}. Bảo lưu mọi quyền.</p>
      </div>`;
    this.openSheet('credits', 'Credit', html);
  }

  renderPerf() {
    const p = this.store.perf;
    const g = this.game.loop;
    const el = $('#perf');
    el.innerHTML = `FPS ${p.fpsAvg()} · thấp ${p.fpsLow()}<br>Phaser ${Math.round(g.actualFps)} · giật ${p.longFrames}<br>${p.memMb() !== null ? `RAM ${p.memMb()}MB · ` : ''}tải ${(p.loadMs / 1000).toFixed(1)}s<br>${this.game.renderer.type === 2 ? 'WebGL' : 'Canvas'} · ${this.store.net.mode}`;
  }

  /** Ảnh đầu nhân vật theo mã người chơi (chat, danh sách). */
  avatarOf(id: string): string {
    if (id === this.store.net.meId) return avatarUrl(this.store.s.avatar, 2, true);
    const p = this.store.net.islands().find((x) => x.id === id);
    return avatarUrl(p ? pubAvatar(p) : avatarFrom(id), 2, true);
  }

  // ---------------- tạo / chỉnh nhân vật ----------------
  openAvatar(first = false) {
    const s = this.store.s;
    let av: Avatar = { ...s.avatar };
    const swatch = (key: 'sk' | 'hc' | 'tc', list: readonly { name: string; c: readonly string[] }[]) =>
      `<div class="sw" role="radiogroup">${list
        .map((o, i) => `<button type="button" role="radio" data-k="${key}" data-v="${i}" title="${o.name}" aria-label="${o.name}" style="--c:${o.c[0]};--d:${o.c[1]}"></button>`)
        .join('')}</div>`;
    const stepper = (key: keyof Avatar, label: string) =>
      `<div class="avrow"><span>${label}</span><div class="step"><button type="button" data-step="${key}" data-d="-1" aria-label="Trước">‹</button><b data-name="${key}"></b><button type="button" data-step="${key}" data-d="1" aria-label="Sau">›</button></div></div>`;
    const html = `
      <div class="aved">
        <div class="avstage"><img id="avBig" alt="Nhân vật của bạn"><small id="avLine"></small></div>
        <div class="avopts">
          <div class="seg" role="radiogroup" aria-label="Giới tính">${GENDERS.map((g, i) => `<button type="button" role="radio" data-k="g" data-v="${i}">${g}</button>`).join('')}</div>
          ${stepper('ha', 'Kiểu tóc')}
          <div class="avrow"><span>Màu tóc</span>${swatch('hc', HAIR_COLORS)}</div>
          <div class="avrow"><span>Màu da</span>${swatch('sk', SKINS)}</div>
          ${stepper('to', 'Trang phục')}
          <div class="avrow"><span>Màu áo</span>${swatch('tc', OUTFIT_COLORS)}</div>
          ${stepper('hat', 'Mũ nón')}
          ${stepper('it', 'Vật cầm')}
        </div>
      </div>
      <div class="row"><button type="button" id="avRand">Ngẫu nhiên</button><button type="button" class="primary" id="avSave" style="flex:1">${first ? 'Vào đảo' : 'Lưu nhân vật'}</button></div>
      ${first ? '<p class="muted small">Đổi lại lúc nào cũng được: chạm vào nhân vật trên đảo hoặc vào Cài đặt.</p>' : ''}`;
    const names: Record<string, (a: Avatar) => string> = {
      ha: (a) => HAIRS[a.g][a.ha],
      to: (a) => OUTFITS[a.to],
      hat: (a) => HATS[a.hat],
      it: (a) => ITEMS[a.it],
    };
    const counts: Record<string, number> = { ha: 5, to: OUTFITS.length, hat: HATS.length, it: ITEMS.length };
    this.openSheet('avatar', first ? 'Tạo nhân vật' : 'Nhân vật của bạn', html, (body) => {
      const paint = () => {
        (body.querySelector('#avBig') as HTMLImageElement).src = avatarUrl(av, 8);
        body.querySelector('#avLine')!.textContent = `${GENDERS[av.g]} · ${HAIRS[av.g][av.ha]} · ${OUTFITS[av.to]}`;
        body.querySelectorAll<HTMLButtonElement>('[data-k]').forEach((b) => b.setAttribute('aria-checked', String(av[b.dataset.k as keyof Avatar] === Number(b.dataset.v))));
        for (const k of Object.keys(names)) body.querySelector(`[data-name="${k}"]`)!.textContent = names[k](av);
      };
      body.addEventListener('click', (e) => {
        const t = (e.target as HTMLElement).closest('button');
        if (!t) return;
        if (t.dataset.k) av = { ...av, [t.dataset.k]: Number(t.dataset.v) } as Avatar;
        else if (t.dataset.step) {
          const k = t.dataset.step as keyof Avatar;
          const n = counts[k];
          av = { ...av, [k]: (av[k] + Number(t.dataset.d) + n) % n } as Avatar;
        } else if (t.id === 'avRand') av = avatarFrom(`${s.id}:${Date.now()}`);
        else if (t.id === 'avSave') {
          const o = this.store.do({ t: 'avatar', av });
          this.toast(o.ok ? (first ? `Chào mừng ${s.name} tới đảo!` : o.msg) : o.msg, o.ok ? 'gold' : 'bad');
          if (o.ok) {
            this.closeSheet();
            this.renderTop();
            if (first) setTimeout(() => this.showBubble(LINH_VAT.cuoc.voice.idle[1], () => this.island.lvAnchor('cuoc'), 5000), 300);
          }
          return;
        }
        paint();
      });
      paint();
    });
  }

  // ---------------- mở màn ----------------
  intro(): Promise<void> {
    if (this.store.s.stats.gathers > 0 || ls.get('vld-intro')) {
      // người chơi cũ chưa từng chỉnh nhân vật: mời một lần
      if (!this.store.s.avatarSet && !ls.get('vld-av-asked')) {
        ls.set('vld-av-asked', '1');
        setTimeout(() => this.openAvatar(true), 600);
      }
      return Promise.resolve();
    }
    return new Promise((done) => {
      const el = $('#intro');
      el.hidden = false;
      let i = 0;
      const p = el.querySelector('p')!;
      const next = () => {
        if (i >= INTRO.length) {
          el.hidden = true;
          ls.set('vld-intro', '1');
          ls.set('vld-av-asked', '1');
          done();
          // tạo nhân vật ngay sau đoạn mở màn
          setTimeout(() => this.openAvatar(true), 300);
          return;
        }
        p.textContent = INTRO[i++];
        p.classList.remove('pop');
        void p.offsetWidth;
        p.classList.add('pop');
      };
      el.querySelector('button')!.addEventListener('click', next);
      next();
    });
  }
}
