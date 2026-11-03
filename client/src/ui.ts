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
import { cellDist, wildCell } from '../../shared/logic';
import { bossCheck, busySlots, conquerCheck, craftCost, goodLabel, haveGood, homeCell, incomePerHour, nearestBase, fortName, shopPrice, buildMs, buildOf, buildSlots, canPay, currentQuest, dockPos, expandCost, landCap, landCount, LV_POS, newPlayer, power, publicOf, sailMs, storageCap, titleOf, xpForLevel, type IslandPub, type Outcome } from '../../shared/logic';
import { drawLeu, drawMiniIsland, drawEmote } from './art/sprites';
import { canvasUrl, iconUrl, lvCanvas, portraitUrl } from './art/textures';
import { avatarUrl } from './art/avatar';
import { drawSeaIsland, lookOf } from './art/islands';
import { avatarFrom, cleanAvatar, GENDERS, HAIRS, HAIR_COLORS, HATS, ITEMS as AV_ITEMS, OUTFITS, OUTFIT_COLORS, SKINS, type Avatar } from '../../shared/avatar';
import { hashStr } from '../../shared/rng';
import { LV_LABEL, BOSS_CELL, BOSS_REQ, BOSS_TRAVEL_MUL, bossOf, GEAR, GEAR_KEYS, gearBonus, noGear, weekEnd, weekOf, type GearKey, type GearSet } from '../../shared/boss';
import { thuongGioiHtml } from './thuonggioi';
import { openGenerals, openWheel } from './ui-gacha';
import { openHex as openHexPanel, openMap } from './ui-sea';
import { addFriend, openFriends } from './ui-social';
import { openScout } from './ui-scout';
import { dinhClick, dinhExtra, openKho, openWeather, renderWxFx, supplyLine, wxChip, wxNow } from './ui-eco';
import {
  B_KEYS, BUILDINGS, DAY0, dayOf, GUILD_COST, guildLevel, ITEM_KEYS, ITEMS, marketFee, PORT_MULT, RARITY_COLOR, ROUTE_MS, routePeriod, routesNear, SHOP_BASE, shopSpecial, tollPerHour, tributePerHour, goodRarity, bLevel,
  type BKey, type ItemKey, type Route,
} from '../../shared/economy';
import { canvas, Pen } from './art/pixel';
import { drawItemIcon } from './art/items';
import { sound } from './audio';
import { menuIcon } from './art2/icons';
import { SPIN_COST } from '../../shared/gacha';
import { drawDinh2 as drawDinh } from './art2/dinh2';
import { roomUrl } from './art2/room';
import { openSociety } from './ui-society';
import { openSeaView } from './ui-seaview';
import { playTrailer } from './trailer';
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

type Tab = 'island' | 'sea' | 'team' | 'chat' | 'feedback' | 'bxh' | 'cho';

/** Dáng vẻ của một đảo người khác (dữ liệu gửi qua mạng nên luôn kiểm lại). */
export const pubAvatar = (p: { id: string; avatar?: unknown }): Avatar => cleanAvatar(p.avatar) ?? avatarFrom(p.id);

export class UI {
  game!: Phaser.Game;
  private tab: Tab = 'island';
  private bubble: { text: string; until: number; anchor: () => { x: number; y: number } } | null = null;
  private sheetKind = '';
  private sheetRefresh: (() => void) | null = null;
  private bossRedraw: (() => void) | null = null;
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
    document.body.dataset.tab = tab;
    sound.setMood(tab);
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
    el.innerHTML = `<img src="${canvasUrl('boat-ui-' + s.lv.thuyen.tier, () => lvCanvas('thuyen', s.lv.thuyen.tier), 2)}" alt=""><div>${text}</div>`;
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

  /** Chạm một ô trên hải đồ. */
  openHex(c: number, r: number) {
    openHexPanel(this, c, r);
  }
  myPub() {
    return publicOf(this.store.s);
  }
  sailLinePublic(to: { x: number; y: number }, mul = 1) {
    return this.sailLine(to, mul);
  }
  sailPublic(o: Outcome) {
    return this.sail(o);
  }

  private sailLine(to: { x: number; y: number }, mul = 1) {
    const s = this.store.s;
    const ms = sailMs(s, to, mul) / s.speed;
    const base = nearestBase(s, to);
    const dist = Math.max(1, cellDist(to, base));
    return `<div class="card"><small>Hải trình</small><p>Cách ${base.x === homeCell(s).x && base.y === homeCell(s).y ? 'đảo bạn' : `cứ điểm ${esc(base.name)}`} <b>${dist} hải lý</b>. ${esc(LINH_VAT.thuyen.tiers[s.lv.thuyen.tier - 1])} đi mất <b>${hms(ms)}</b>, về mất <b>${hms(ms)}</b>.</p><p class="muted small">Xa hơn thì lâu hơn. Tiến hóa thuyền để đi nhanh hơn. Chiến lợi phẩm về tới bến mới nhận.</p></div>${supplyLine(s, sailMs(s, to, mul))}`;
  }

  private sail(o: Outcome) {
    if (!o.ok) return this.toast(o.msg, 'bad');
    this.toast(o.msg);
    sound.play('sail');
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
    $('#btnWheel').addEventListener('click', () => openWheel(this));
    $('#res').addEventListener('click', (e) => ((e.target as HTMLElement).closest('[data-k="lt"]') ? openWheel(this) : openKho(this)));
    $('#wxChip').addEventListener('click', () => openWeather(this));
    $('#btnTuong').addEventListener('click', () => openGenerals(this));
    $('#btnXaHoi').addEventListener('click', () => openSociety(this));
    $('#btnBuild').addEventListener('click', () => (this.island.placing ? this.island.setPlacing(null) : this.openBuildMenu()));
    $('#income').addEventListener('click', () => this.openCho('linh'));
    $('#vassal').addEventListener('click', () => this.openCho('linh'));
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
    $('#zMap').addEventListener('click', () => (this.tab === 'sea' ? openMap(this) : this.goSea()));
    // ---- menu gom một chỗ: bấm Menu thả danh sách xuống, chạm ra ngoài hoặc chọn mục thì thu lại ----
    document.querySelectorAll<HTMLElement>('#menuList [data-ic]').forEach((b) => {
      const img = document.createElement('img');
      img.src = menuIcon(b.dataset.ic!);
      img.alt = '';
      b.prepend(img);
    });
    $('#menuBtn').addEventListener('click', () => this.menu(!$('#tools').classList.contains('open')));
    $('#menuList').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (b && !b.closest('.mi-zoom')) this.menu(false);
    });
    document.addEventListener(
      'pointerdown',
      (e) => {
        // lần chạm đầu tiên mới được mở âm thanh (luật của trình duyệt)
        sound.unlock();
        const t = e.target as HTMLElement;
        if (t.closest?.('button, .chip, [role="button"]')) sound.play('tap');
        if (!$('#tools').contains(t)) this.menu(false);
      },
      true,
    );
    addEventListener('keydown', (e) => e.key === 'Escape' && this.menu(false));
    $('#voyage').addEventListener('click', () => this.onVoyageChip());
    addEventListener('resize', () => setTimeout(() => this.updatePads(), 120));
    $('#btnBSpeed').addEventListener('click', () => {
      const v = (this.game.scene.getScene('battle') as BattleScene).toggleSpeed();
      $('#btnBSpeed').textContent = `x${v}`;
    });
    $('#btnSkip').addEventListener('click', () => (this.game.scene.getScene('battle') as BattleScene).skip());
    const navIcons: Record<string, string> = {
      island: canvasUrl('nav-leu', () => drawLeu(1, false, 'thuong'), 1),
      sea: canvasUrl('nav-sea', () => drawMiniIsland(6, 'me'), 1),
      team: avatarUrl(this.store.s.avatar, 2, true),
      chat: canvasUrl('nav-chat', () => drawEmote('nghe'), 3),
      feedback: canvasUrl('nav-fb', () => drawEmote('vui'), 3),
      bxh: canvasUrl('nav-bxh', drawCup, 2),
      cho: iconUrl('tien'),
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
      const now = this.store.now();
      $('#wxChip').textContent = wxChip(this.store.s, now);
      renderWxFx(this.store.s, now);
      const w = wxNow(this.store.s, now);
      sound.setWeather(w.wx.kind, w.wx.wind, w.phase.night);
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
    this.store.net.on('boss', () => this.sheetKind === 'boss' && this.bossRedraw?.());
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
    $('#btnSpeed .mi-t').textContent = `Tốc độ x${this.store.s.speed}`;
    // số lượt quay đang có (lượt mua + Linh Thạch đủ quay)
    const s = this.store.s;
    const spins = (s.luot ?? 0) + Math.floor(s.res.lt / SPIN_COST);
    const n = $('#btnWheel .mi-n');
    n.hidden = spins <= 0;
    n.textContent = String(Math.min(99, spins));
    this.syncMenu();
  }

  /** Mở/đóng danh sách menu bên phải. */
  menu(open: boolean) {
    const tools = $('#tools');
    if (tools.classList.contains('open') === open) return;
    tools.classList.toggle('open', open);
    $('#menuBtn').setAttribute('aria-expanded', String(open));
    this.syncMenu();
  }
  /** Nút đang bật chế độ (khai hoang, chọn chỗ xây) hiện ngay dưới Menu; việc cần làm thì Menu nhấp nháy. */
  syncMenu() {
    const tools = $('#tools');
    let mode = false;
    for (const id of ['#btnExpand', '#btnBuild']) {
      const b = $(id);
      const on = b.classList.contains('hot');
      b.classList.toggle('mode', on);
      mode ||= on;
    }
    tools.classList.toggle('moding', mode);
    const pulse = !!tools.querySelector('#menuList > button.pulse:not([hidden])');
    $('#menuBtn').classList.toggle('pulse', pulse && !tools.classList.contains('open'));
  }

  renderTop() {
    const s = this.store.s;
    const p = power(s);
    $('#islandName').textContent = s.islandName;
    $('#title').textContent = `${titleOf(p)} · ${p} sức mạnh${(s.shield ?? 0) > this.store.now() ? ' · 🛡' : ''}`;
    const inc = incomePerHour(s, this.store.now());
    $('#income').textContent = `${inc.total >= 0 ? '+' : ''}${Math.round(inc.total)} đồng/giờ`;
    const vb = $('#vassal');
    const lord = s.chuQuan && s.chuQuan.until > this.store.now() ? s.chuQuan : null;
    vb.hidden = !lord && !s.chuHau.length;
    vb.innerHTML = lord
      ? `<b class="bad">Chư hầu của ${esc(lord.name)}</b><span>nộp ${tributePerHour(power(s))}/giờ · còn ${clock(lord.until - this.store.now())}</span>`
      : s.chuHau.length
        ? `<b>Lãnh chúa ${s.chuHau.length} đảo</b><span>${s.chuHau.map((v) => esc(v.islandName)).slice(0, 2).join(', ')}</span>`
        : '';
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
    const show: ResKey[] = ['tien', 'so', 'go', 'da', 'tre', 'thoc'];
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
    this.syncMenu();
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
    if (tab === 'bxh') this.openBxh();
    if (tab === 'cho') this.openCho();
    if (tab === 'team' || tab === 'chat' || tab === 'feedback' || tab === 'bxh' || tab === 'cho') {
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
    const t = b.querySelector('.mi-t')!;
    if (v) {
      const full = landCount(s) >= landCap(s);
      t.innerHTML = full ? 'Đảo đã đủ đất' : `Ô đất thứ ${landCount(s) + 1}: ${costHtml(expandCost(s), s.res)}`;
      if (full) this.toast('Nâng Nhà chính để mở thêm đất.', 'muted');
    } else t.textContent = 'Khai hoang';
    this.syncMenu();
  }

  // ---------------- thông báo ----------------
  toast(text: string, kind: 'good' | 'bad' | 'muted' | 'gold' | '' = '', ms = 3200) {
    if (!text) return;
    if (kind === 'bad') sound.play('error');
    else if (kind === 'gold') sound.play('coin');
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
    if (Object.keys(g).length) sound.play('gather');
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
    sound.play('chest');
    this.floatGains(at.x, at.y, o.gained ?? {});
    this.toast(`${c.name} (${c.rarity})`, o.chest && o.chest >= 3 ? 'gold' : 'good');
  }

  // ---------------- bong bóng tiếng lòng ----------------
  showBubble(text: string, anchor: () => { x: number; y: number }, ms = 4200) {
    if (!text || !$('#sheet').hidden) return;
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
    // lời thoại linh vật không được che bảng
    this.bubble = null;
    $('#bubble').hidden = true;
    const sheet = $('#sheet');
    sheet.dataset.kind = kind;
    sheet.querySelector('h2')!.textContent = title;
    // thay khung nội dung mới để bỏ hết trình xử lý bấm của bảng trước
    const old = sheet.querySelector<HTMLElement>('.sheet-body')!;
    const body = old.cloneNode(false) as HTMLElement;
    old.replaceWith(body);
    body.innerHTML = html;
    bind?.(body);
    this.sheetRefresh = refresh ?? null;
    sheet.hidden = false;
    sheet.classList.remove('in');
    void sheet.offsetWidth;
    sheet.classList.add('in');
    requestAnimationFrame(() => this.updatePads());
  }
  sheetKindPublic() {
    return this.sheetKind;
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
      return this.gearHtml() + `<p class="hint">Đội ra trận tự động theo lượt. Chủ đảo (bạn) đánh mạnh hơn khi Cuốc tiến hóa.</p>` +
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
    this.openSheet('team', `Đội của ${esc(this.store.s.name)}`, draw(), (body) => {
      body.addEventListener('click', (e) => {
        const t = (e.target as HTMLElement).closest('button');
        if (!t) return;
        if (t.classList.contains('avEdit')) return this.openAvatar();
        if (t.dataset.craft) {
          const o = this.store.do({ t: 'craft', g: t.dataset.craft as GearKey });
          this.toast(o.msg, o.ok ? 'gold' : 'bad');
          if (o.ok) body.innerHTML = draw();
        }
      });
    });
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
    const tabs = this.store.net.market ? `<div class="seg tabs3"><button type="button" data-ct="world" aria-checked="true">Thế giới</button><button type="button" data-ct="friends">Bạn bè</button><button type="button" data-ct="ally">Liên minh</button></div>` : '';
    const html = `${tabs}<div class="chat" id="chatList">${list()}</div>
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
        body.querySelector('[data-ct="friends"]')?.addEventListener('click', () => void openFriends(this));
        body.querySelector('[data-ct="ally"]')?.addEventListener('click', () => void import('./ui-social').then((m) => m.openAlliance(this)));
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
        ${this.sailLine(wildCell(this.store.s, w.id))}
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
    const to = isMe ? homeCell(s) : this.sea.cellOf(p.id, p);
    const html = `
      <div class="lv-head"><img class="lv-img" src="${canvasUrl(`isl-${p.id}-${p.land}-${p.tiers.leu}`, () => drawSeaIsland(p.id, p.land, p.bot ? 'bot' : isMe ? 'me' : 'player', p.tiers.leu ?? 1), 2)}" alt="">
        <div><h3>${esc(p.islandName)}</h3><p class="owner"><img src="${avatarUrl(pubAvatar(p), 2, true)}" alt="">${esc(p.name)} · ${esc(p.title)}${p.bot ? ' · đảo máy' : online ? ' · đang online' : ''}</p>
        <p><b>${p.power}</b> sức mạnh · ${p.land} ô đất · ${lookOf(hashStr(p.id)).name}</p></div></div>
      <div class="stats"><span>${LINH_VAT.leu.tiers[(p.tiers.leu ?? 1) - 1]}</span><span>${LINH_VAT.cuoc.tiers[(p.tiers.cuoc ?? 1) - 1]}</span><span>${LINH_VAT.rao.tiers[(p.tiers.rao ?? 1) - 1]}</span><span>${LINH_VAT.thuyen.tiers[(p.tiers.thuyen ?? 1) - 1]}</span></div>
      <div class="enemies">${p.team.map((t) => `<div class="enemy"><img src="${t.k === 'an' ? avatarUrl(pubAvatar(p), 3) : portraitUrl(t.k)}" alt=""><span>${t.k === 'an' ? esc(p.name) : COMPANIONS[t.k].name}</span><small>cấp ${t.lv}</small></div>`).join('')}</div>
      ${isMe ? `<p class="hint">Người khác thấy đảo bạn như thế này. Phần tài nguyên dưới mức được bảo vệ của Nhà chính không bị cướp.</p><button class="wide" id="btnHome">Phóng vào đảo</button>` : `
        ${p.bot || !this.store.net.market ? '' : `<div class="row"><button type="button" id="btnFriend">Kết bạn</button><button type="button" id="btnScout" ${(p.shield ?? 0) > this.store.now() ? 'disabled' : ''}>Thám thính (80 đồng)</button><span class="muted small">ID: ${esc(p.id)} · (${to.x}, ${to.y})</span></div>`}
        ${(p.shield ?? 0) > this.store.now() ? `<div class="card"><small>🛡 Khiên bảo hộ</small><p>Còn <b>${hms(p.shield! - this.store.now())}</b>. Không đột kích, đánh chiếm, thám thính được; bên trong đảo bị che.</p></div>` : ''}
        <div class="card"><small>Nếu thắng, chở về khoảng</small><div class="costs">${lootPreview || 'Đảo này nghèo quá, chẳng có gì để lấy.'}</div></div>
        <p class="muted small">So sức: bạn ${me.power} · họ ${p.power}${p.fort ? ` · thành trì: ${['Đảo Trống', 'Xóm Đảo', 'Làng Lũy', 'Đồn Lũy', 'Thành Trì', 'Kinh Thành'][p.fort]}` : ''}${p.guild ? ` · hội [${esc(p.guild)}]` : ''}</p>
        ${p.lord ? `<p class="hint">Đảo này đang là chư hầu của ${p.lord.id === s.id ? '<b>bạn</b>' : esc(p.lord.name)}.</p>` : ''}
        ${s.chuQuan && s.chuQuan.id === p.id ? '<p class="hint">Đây là chủ của bạn. Đánh thắng họ để <b>khởi nghĩa</b>, giành lại tự do.</p>' : ''}
        <p class="muted small">Thuế thương thuyền ở đảo này: ~${Math.round(tollPerHour(to, routePeriod(this.store.now()), p.port ?? 0))} đồng/giờ${routesNear(to, routePeriod(this.store.now())).length ? ` (${routesNear(to, routePeriod(this.store.now())).map((r) => r.m.name).join(', ')} đi ngang)` : ''}.</p>
        ${this.sailLine(to)}
        ${this.sailButton(cd <= 0, `Vừa đột kích, chờ ${secs(cd / s.speed)}`, 'Đột kích cướp tài nguyên')}
        ${s.voyage || cd > 0 ? '' : (() => {
          const err = conquerCheck(s, p);
          return `<button class="wide ${err ? '' : 'hot'}" id="btnConquer" ${err ? 'disabled' : ''}>${err ? esc(err) : 'Đánh chiếm làm chư hầu (72 giờ)'}</button><p class="muted small">Thắng thì đảo này cống nạp ~${tributePerHour(p.power)} đồng/giờ, chia bạn một nửa thuế thương thuyền, và thành cứ điểm cho thuyền xuất phát.</p>`;
        })()}`}`;
    this.openSheet('island', isMe ? 'Đảo của bạn' : 'Đảo láng giềng', html, (body) => {
      body.querySelector('#btnHome')?.addEventListener('click', () => this.goIsland());
      body.querySelector('#btnFriend')?.addEventListener('click', () => void addFriend(this, p.id, p.name));
      body.querySelector('#btnScout')?.addEventListener('click', () => void openScout(this, p));
      body.querySelector('#btnSail')?.addEventListener('click', () => {
        const o = this.store.do({ t: 'sail', kind: 'island', target: p, to });
        if (o.ok) this.store.net.setActivity(`đang chèo thuyền tới ${p.islandName}`);
        this.sail(o);
      });
      body.querySelector('#btnConquer')?.addEventListener('click', () => {
        const o = this.store.do({ t: 'sail', kind: 'island', target: p, to, conquer: true });
        if (o.ok) this.store.net.setActivity(`đang kéo quân đánh chiếm ${p.islandName}`);
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
    $('#tools').hidden = true;
    sound.setMood('battle');
    $('#btnSkip').hidden = !!o.pvp;
    $('#btnBSpeed').hidden = !!o.pvp;
    $('#btnBSpeed').textContent = 'x1';
    $('#battleTitle').textContent = o.pvp ? `${title} · trận người chơi, không tua` : title;
    const data: BattleData = {
      battle: o.battle!,
      title,
      pvp: !!o.pvp,
      onDone: () => {
        this.game.scene.stop('battle');
        this.game.scene.wake(from);
        $('#battlebar').hidden = true;
        $('#battleHud').hidden = true;
        $('#tools').hidden = false;
        $('#nav').classList.remove('dim');
        sound.setMood(from);
        sound.play(o.battle?.winner === 0 ? 'victory' : 'defeat');
        this.showResult(o, title, fromVoyage);
      },
    };
    this.game.scene.start('battle', data);
  }

  showResult(o: Outcome, title: string, fromVoyage = false) {
    if (o.boss) return this.showBossResult(o);
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
      ${o.battle ? '<button class="wide" id="btnReplay">Xem lại trận</button>' : ''}
      <button class="primary wide" id="btnOk">Tiếp tục</button>`;
    this.openSheet('result', title, html, (b) => {
      b.querySelector('#btnOk')!.addEventListener('click', () => this.closeSheet());
      b.querySelector('#btnReplay')?.addEventListener('click', () => this.runBattle(o, title, fromVoyage));
    });
  }

  // ---------------- cài đặt, credit ----------------
  openSettings() {
    const s = this.store.s;
    const sw = (k: 'music' | 'amb' | 'sfx', name: string, sub: string) =>
      `<label class="sw-row"><span><b>${name}</b><small>${sub}</small></span><input type="checkbox" data-snd="${k}" ${sound.prefs[k] ? 'checked' : ''}><i class="sw" aria-hidden="true"></i></label>`;
    const html = `
      <div class="card snd"><small>Âm thanh</small>
        ${sw('music', 'Nhạc nền', 'Sáo trúc, đàn tranh; ra trận có trống')}
        ${sw('amb', 'Âm thanh môi trường', 'Sóng, gió, mưa, sấm, chim, dế theo thời tiết')}
        ${sw('sfx', 'Hiệu ứng', 'Chạm nút, nhặt đồ, xây nhà, đánh nhau, vòng quay')}
        <label class="vol"><span>Âm lượng</span><input type="range" id="sndVol" min="0" max="100" value="${Math.round(sound.prefs.vol * 100)}"><output>${Math.round(sound.prefs.vol * 100)}</output></label>
      </div>
      <form id="nameForm" class="stack">
        <label for="inName">Tên của bạn</label><input id="inName" maxlength="18" value="${esc(s.name)}">
        <label for="inIsland">Tên đảo</label><input id="inIsland" maxlength="24" value="${esc(s.islandName)}">
        <button class="primary">Lưu tên</button>
      </form>
      <div class="card"><small>Chế độ chơi</small><p>${esc(this.store.net.label)}</p>${
        this.store.net.account
          ? `<p class="muted small">Đăng nhập bằng Google · ${esc(this.store.net.account.name)}. Đảo được lưu trên server, chơi máy nào cũng tiếp tục được.</p><p class="small">ID người chơi của bạn (gửi cho bạn bè để kết bạn): <b class="code">${esc(this.store.net.meId)}</b></p><button type="button" id="btnLogout">Đăng xuất</button>`
          : ''
      }</div>
      <div class="row wrap">
        <button type="button" id="btnAv">Chỉnh nhân vật</button>
        <button type="button" id="btnTrailer">Xem trailer</button>
        <button type="button" id="btnFb">Góp ý</button>
        <button type="button" id="btnTG">Cổng Thượng Giới</button>
        <button type="button" id="btnPerf">${this.perfOn ? 'Tắt bảng đo' : 'Bật bảng đo hiệu năng'}</button>
        <button type="button" id="btnLog">Nhật ký đảo</button>
        <button type="button" id="btnCredits">Credit</button>
      </div>
      ${this.store.auth ? '' : '<details class="danger"><summary>Chơi lại từ đầu</summary><p class="muted small">Xóa đảo hiện tại trên máy này và bắt đầu lại.</p><button type="button" id="btnReset">Xóa và chơi lại</button></details>'}
      <p class="credit">© 2026 ${GAME.studio}. Bảo lưu mọi quyền. · ${GAME.name} ${GAME.version}</p>`;
    this.openSheet('settings', 'Cài đặt', html, (body) => {
      body.querySelectorAll<HTMLInputElement>('[data-snd]').forEach((el) =>
        el.addEventListener('change', () => {
          sound.unlock();
          sound.set(el.dataset.snd as 'music' | 'amb' | 'sfx', el.checked);
          if (el.checked && el.dataset.snd === 'sfx') sound.play('coin');
        }),
      );
      const vol = body.querySelector<HTMLInputElement>('#sndVol')!;
      vol.addEventListener('input', () => {
        sound.setVol(Number(vol.value) / 100);
        vol.nextElementSibling!.textContent = vol.value;
      });
      body.querySelector('#btnAv')?.addEventListener('click', () => this.openAvatar());
      body.querySelector('#btnTrailer')?.addEventListener('click', () => {
        this.closeSheet();
        void playTrailer(this.store.s.avatar);
      });
      body.querySelector('#btnTG')?.addEventListener('click', () => this.openThuongGioi());
      body.querySelector('#btnFb')?.addEventListener('click', () => this.openFeedback());
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

  // ---------------- trang bị ----------------
  private gearHtml(): string {
    const s = this.store.s;
    const b = gearBonus(s.kho);
    const rows = GEAR_KEYS.map((k) => {
      const g = GEAR[k];
      const locked = s.lv[g.need.lv].tier < g.need.tier;
      const full = s.kho[k] >= g.max;
      return `<div class="gear"><img src="${canvasUrl('gear-' + k, () => drawGearIcon(k), 3)}" alt=""><div><b>${g.name} <span class="lvl">${s.kho[k]}/${g.max}</span></b>
        <small>${g.desc}${locked ? ` · cần ${LV_LABEL[g.need.lv]} bậc ${g.need.tier}` : ''}</small><div class="costs">${costHtml(g.cost, s.res)}</div></div>
        <button type="button" data-craft="${k}" ${locked || full ? 'disabled' : ''}>${full ? 'Đầy' : 'Chế tạo'}</button></div>`;
    }).join('');
    return `<div class="card"><small>Trang bị trong kho</small><p class="muted small">Cất ở nhà thì tăng sức cho mọi trận và khi giữ đảo. Mang đi đánh Thủy Tinh mà thua thì mất hết.</p>
      <p><b>+${Math.round(b.atk * 100)}%</b> công · <b>+${Math.round(b.def * 100)}%</b> thủ · <b>+${Math.round(b.hp * 100)}%</b> máu</p>${rows}</div>`;
  }

  // ---------------- xây dựng nhà cửa, thành trì ----------------
  openBuildMenu() {
    const draw = () => {
      const s = this.store.s;
      const groups: Record<string, BKey[]> = { 'Nhà cửa': [], 'Nông trại': [], 'Chế biến': [], 'Kinh tế': [], 'Học thuật': [], 'Thành trì': [] };
      const G: Record<string, string> = { 'nhà cửa': 'Nhà cửa', 'nông trại': 'Nông trại', 'chế biến': 'Chế biến', 'kinh tế': 'Kinh tế', 'học thuật': 'Học thuật', 'thành trì': 'Thành trì' };
      for (const k of B_KEYS) groups[G[BUILDINGS[k].group]].push(k);
      const row = (k: BKey) => {
        const b = BUILDINGS[k];
        const have = s.dinh.filter((d) => d.k === k).length;
        const lock = s.lv.leu.tier < b.needLeu ? `Cần Nhà chính bậc ${b.needLeu}` : have >= b.max ? `Đã đủ ${b.max}` : '';
        return `<div class="gear"><img src="${canvasUrl('dinh2-ui-' + k, () => drawDinh(k, 1), 2)}" alt=""><div><b>${b.names[0]} <span class="lvl">${have}/${b.max}</span></b><small>${b.desc} · xây ${hms(b.ms[0])}</small><div class="costs">${costHtml(b.cost[0], s.res)}</div></div>
          <button type="button" data-b="${k}" ${lock || !canPay(s, b.cost[0]) ? 'disabled' : ''}>${lock || 'Chọn chỗ'}</button></div>`;
      };
      return `<div class="card"><small>Đảo của bạn</small><p>Thành trì: <b>${fortName(s)}</b> · Đội thợ: ${busySlots(s)}/${buildSlots(s)} đang bận · Kho chứa ${storageCap(s)}</p>
        <p class="muted small">Bấm "Chọn chỗ" rồi chạm một ô đất trống (viền xanh). Chạm công trình đã xây để nâng cấp. Càng lên cấp xây càng lâu.</p></div>
        ${Object.entries(groups).map(([g, ks]) => `<div class="card"><small>${g}</small>${ks.map(row).join('')}</div>`).join('')}`;
    };
    this.openSheet('build', 'Xây dựng', draw(), (body) =>
      body.addEventListener('click', (e) => {
        const t = (e.target as HTMLElement).closest('button');
        if (!t?.dataset.b) return;
        this.closeSheet();
        if (this.tab !== 'island') this.goIsland();
        this.island.setPlacing(t.dataset.b as BKey);
      }),
    );
  }

  onPlacing(k: BKey | null) {
    const b = $('#btnBuild');
    b.querySelector('.mi-t')!.textContent = k ? 'Hủy chọn chỗ' : 'Xây dựng';
    b.classList.toggle('hot', !!k);
    this.syncMenu();
    if (k) this.toast(`Chạm một ô đất có viền xanh để xây ${BUILDINGS[k].names[0]}.`, 'gold', 4000);
  }

  openSeaView(kind: 'boat' | 'tower') {
    openSeaView(this, kind);
  }

  openDinh(id: string) {
    let armed = false;
    const draw = () => {
      const s = this.store.s;
      const d = s.dinh.find((x) => x.id === id);
      if (!d) return '<p>Công trình đã bị dỡ.</p>';
      const b = BUILDINGS[d.k];
      const lv = Math.max(1, d.lv);
      const busy = d.doneAt !== undefined;
      const left = busy ? d.doneAt! - (s.gt + (Date.now() - s.lastReal) * s.speed) : 0;
      const next = d.lv < 3 && !busy ? `<div class="card"><small>Nâng lên ${b.names[d.lv]}</small><div class="costs">${costHtml(b.cost[d.lv], s.res)}</div><p class="muted small">Xây mất ${hms(b.ms[d.lv])}</p>
        <button class="primary wide" id="btnUp" ${canPay(s, b.cost[d.lv]) && busySlots(s) < buildSlots(s) ? '' : 'disabled'}>${busySlots(s) >= buildSlots(s) ? 'Thợ đang bận hết' : 'Nâng cấp'}</button></div>` : '';
      return `<div class="room" style="background-image:url(${roomUrl(d.k)})"><div class="room-t"><img src="${canvasUrl(`dinh2-ui-${d.k}-${lv}`, () => drawDinh(d.k, lv), 2)}" alt=""><div><h3>${b.names[lv - 1]}</h3><p class="tier">Cấp ${d.lv || 0}/3${busy ? ` · đang xây lên cấp ${d.to}` : ''}</p></div></div></div>
        <p class="muted room-d">${b.desc}</p>
        ${busy ? `<div class="card"><small>Đang xây</small><p>Còn <b>${hms(left / s.speed)}</b></p></div>` : ''}
        ${d.lv > 0 && (d.k === 'thapcanh' || d.k === 'tuong' || d.k === 'donbinh') ? '<button class="wide" id="btnTower">Lên tháp nhìn biển</button>' : ''}
        ${d.k === 'benthuyen' && d.lv > 0 ? '<button class="wide" id="btnBoatView">Ra xem thuyền trên biển</button>' : ''}
        ${dinhExtra(this, d)}
        ${next}
        <button class="wide" id="btnPha">${armed ? 'Chắc chắn dỡ? Bấm lần nữa' : 'Dỡ bỏ (thu lại 30% vật liệu)'}</button>`;
    };
    this.openSheet('dinh', 'Công trình', draw(), (body) =>
      body.addEventListener('click', (e) => {
        const t = (e.target as HTMLElement).closest('button');
        if (!t) return;
        const dd = this.store.s.dinh.find((x) => x.id === id);
        if (dd && dinhClick(this, dd, t)) {
          body.innerHTML = draw();
          return;
        }
        if (t.id === 'btnTower') return this.openSeaView('tower');
        if (t.id === 'btnBoatView') return this.openSeaView('boat');
        if (t.id === 'btnUp') {
          const o = this.store.do({ t: 'nang', id });
          this.toast(o.msg, o.ok ? 'gold' : 'bad');
        } else if (t.id === 'btnPha') {
          if (!armed) armed = true;
          else {
            const o = this.store.do({ t: 'pha', id });
            this.toast(o.msg, o.ok ? 'gold' : 'bad');
            return this.closeSheet();
          }
        }
        body.innerHTML = draw();
      }),
      () => {
        const b = $('#sheet .sheet-body');
        if (b && this.sheetKind === 'dinh' && !b.matches(':focus-within')) b.innerHTML = draw();
      },
    );
  }

  openMerchant(rt: Route) {
    const s = this.store.s;
    const html = `<div class="card"><small>${esc(rt.m.name)}</small><p>Tuyến buôn 6 giờ này ghé ${rt.pts.length} điểm. Đảo nằm sát tuyến (trong ${2.5} hải lý) thu <b>${rt.value} đồng/giờ</b> × hệ số Trạm thuế (${PORT_MULT.join(' / ')}).</p>
      <p>Hàng mang theo: ${rt.m.goods.map((g) => `<span style="color:${RARITY_COLOR[goodRarity(g)]}">${esc(goodLabel(g))}</span>`).join(', ')}</p>
      <p class="muted small">Đổi tuyến sau ${hms(ROUTE_MS - ((this.store.now() - DAY0) % ROUTE_MS))}. Đảo bạn ${routesNear(homeCell(s), routePeriod(this.store.now())).some((r) => r.m.id === rt.m.id) ? '<b class="good">đang nằm trên tuyến này</b>' : 'không nằm trên tuyến này'}.</p></div>
      <button class="primary wide" id="btnGoMarket">Xem hàng của thương buôn ở chợ</button>`;
    this.openSheet('merchant', 'Thương thuyền', html, (b) => b.querySelector('#btnGoMarket')!.addEventListener('click', () => this.openCho('market', rt.m.name.split(' ').slice(-2).join(' '))));
  }

  // ---------------- chợ, cửa hàng, túi đồ, thương hội, lãnh địa ----------------
  private choTab = 'shop';
  openCho(tab?: string, q = '') {
    if (tab) this.choTab = tab;
    const net = this.store.net;
    const online = !!net.market;
    const st = { q, cat: 'all', sort: 'new', data: null as any, mine: null as any, guilds: null as any, ginfo: null as any, busy: false, sellGood: 'go', mode: 'fixed' };
    const tabs: [string, string][] = [
      ['shop', 'Cửa hàng'],
      ['bag', 'Túi đồ'],
      ['market', 'Chợ'],
      ['orders', 'Đặt mua'],
      ['sell', 'Đăng bán'],
      ['mine', 'Của tôi'],
      ['guild', 'Thương hội'],
      ['linh', 'Lãnh địa'],
    ];
    const s = () => this.store.s;
    const goodOpt = (sel: string, onlyHave: boolean) =>
      [...(['tien'] as string[]).filter(() => false), 'co', 'la', 'tre', 'go', 'cui', 'da', 'sat', 'so', 'ngoc', ...ITEM_KEYS, 'g_giao', 'g_khien', 'g_thuoc', 'g_bua']
        .filter((g) => !onlyHave || haveGood(s(), g) > 0)
        .map((g) => `<option value="${g}" ${g === sel ? 'selected' : ''}>${esc(goodLabel(g))}${onlyHave ? ` (có ${haveGood(s(), g)})` : ''}</option>`)
        .join('');
    const gname = (g: string) => `<b style="color:${RARITY_COLOR[goodRarity(g)]}">${esc(goodLabel(g))}</b>`;
    const fee = () => marketFee(bLevel(s().dinh, 'cho'), !!s().guild);
    const offline = '<p class="hint">Chợ thế giới, đấu giá và thương hội chỉ có ở bản chính thức (đăng nhập Google, chơi online). Cửa hàng, túi đồ, lãnh địa vẫn dùng được.</p>';
    const call = async (op: string, args: Record<string, unknown> = {}) => {
      if (!net.market) return null;
      st.busy = true;
      paint();
      const r = await net.market(op, args);
      st.busy = false;
      if (r.msg) this.toast(r.msg, r.ok ? 'gold' : 'bad');
      return r;
    };
    const load = async () => {
      if (!online) return paint();
      if (this.choTab === 'market' || this.choTab === 'orders') st.data = (await call('search', { q: st.q, cat: st.cat, sort: st.sort }))?.data ?? null;
      if (this.choTab === 'mine') st.mine = (await call('mine'))?.data ?? null;
      if (this.choTab === 'guild') {
        if (s().guild) st.ginfo = (await call('gInfo', { id: s().guild!.id }))?.data ?? null;
        else st.guilds = (await call('gList'))?.data ?? null;
      }
      paint();
    };
    const left = (t: number) => hms(Math.max(0, t - Date.now()));
    const body = () => {
      const S = s();
      const tabBar = `<div class="seg scrolltabs">${tabs.map(([k, n]) => `<button type="button" data-tab2="${k}" aria-checked="${this.choTab === k}">${n}</button>`).join('')}</div>
        <p class="money"><img src="${iconUrl('tien')}" alt=""> <b>${fmt(S.res.tien)}</b> đồng vàng${st.busy ? ' · <i>đang chờ chợ...</i>' : ''}</p>`;
      switch (this.choTab) {
        case 'shop': {
          const day = dayOf(this.store.now());
          const sp = shopSpecial(day);
          const offers = [...SHOP_BASE, sp];
          return tabBar + `<p class="muted small">Cửa hàng của Rùa Vàng. ${bLevel(S.dinh, 'cho') ? `Chợ phiên giúp giảm ${bLevel(S.dinh, 'cho') * 5}%.` : 'Xây Chợ phiên để mua rẻ hơn.'} Hàng hiếm đổi mỗi ngày.</p>` +
            offers.map((o) => {
              const bought = S.shop.day === day ? (S.shop.bought[o.id] ?? 0) : 0;
              const price = shopPrice(S, o.price);
              const out = o.daily !== undefined && bought >= o.daily;
              return `<div class="gear ${o.id === 'sp' ? 'special' : ''}"><img src="${o.good in ITEMS ? canvasUrl('item-' + o.good, () => drawItemIcon(o.good as ItemKey), 3) : o.good.startsWith('g_') ? canvasUrl('gear-' + o.good.slice(2), () => drawGearIcon(o.good.slice(2) as GearKey), 3) : iconUrl(o.good)}" alt=""><div>${o.id === 'sp' ? '<small class="tag">HÀNG HIẾM HÔM NAY</small>' : ''}${gname(o.good)}${o.n > 1 ? ` ×${o.n}` : ''}<small>${o.good in ITEMS ? ITEMS[o.good as ItemKey].desc : ''}${o.daily ? ` · mỗi ngày ${o.daily}` : ''}</small></div>
                <button type="button" data-buyshop="${o.id}" ${out || S.res.tien < price ? 'disabled' : ''}>${out ? 'Hết lượt' : `${price} tiền`}</button></div>`;
            }).join('');
        }
        case 'bag': {
          const have = ITEM_KEYS.filter((k) => (S.bag[k] ?? 0) > 0);
          return tabBar + (have.length ? '' : '<p class="hint">Túi trống. Vật phẩm hiếm rơi từ hòm báu, thắng Thủy Tinh, hoặc mua ở cửa hàng, chợ.</p>') +
            have.map((k) => `<div class="gear"><img src="${canvasUrl('item-' + k, () => drawItemIcon(k), 3)}" alt=""><div>${gname(k)} <span class="lvl">×${S.bag[k]}</span><small>${ITEMS[k].desc}</small></div>
              ${ITEMS[k].use ? `<button type="button" data-use="${k}">Dùng</button>` : '<span class="muted small">Giữ trong túi</span>'}</div>`).join('');
        }
        case 'market': {
          if (!online) return tabBar + offline;
          const d = st.data;
          const rows = (d?.listings ?? []).map((l: any) => {
            const avg = d.prices?.[l.good]?.avg;
            const isA = l.kind === 'auction';
            return `<li><div>${gname(l.good)} ×${l.n}<small>${esc(l.sellerName)}${l.npc ? ' · thương buôn' : ''}${avg ? ` · giá TB ${Math.round(avg)}` : ''}</small></div>
              <div class="mk-r">${isA ? `<span>${l.bidder ? 'Giá hiện tại' : 'Khởi điểm'} <b>${l.price}</b><small>${l.bidder ? esc(l.bidderName) + ' · ' : ''}còn ${left(l.ends)}</small></span><input type="number" min="${l.bidder ? Math.ceil(l.price * 1.05) : l.price}" value="${l.bidder ? Math.ceil(l.price * 1.05) : l.price}" data-bidv="${l.id}"><button type="button" data-bid="${l.id}" ${l.seller === S.id ? 'disabled' : ''}>Trả giá</button>`
                : `<span><b>${l.price}</b>/món</span>${l.n > 1 ? `<input type="number" min="1" max="${l.n}" value="${Math.min(l.n, 10)}" data-qty="${l.id}">` : ''}<button type="button" class="primary" data-buy="${l.id}" ${l.seller === S.id ? 'disabled' : ''}>Mua</button>`}</div></li>`;
          }).join('');
          return tabBar + `<form class="mk-search" id="mkSearch"><input name="q" placeholder="Tìm hàng: gỗ, vảy rồng, bùa..." value="${esc(st.q)}"><select name="cat">${[['all', 'Tất cả'], ['res', 'Tài nguyên'], ['item', 'Vật phẩm'], ['gear', 'Trang bị'], ['rare', 'Hàng hiếm']].map(([v, n]) => `<option value="${v}" ${st.cat === v ? 'selected' : ''}>${n}</option>`).join('')}</select><select name="sort">${[['new', 'Mới nhất'], ['price', 'Rẻ nhất'], ['ending', 'Đấu giá sắp hết']].map(([v, n]) => `<option value="${v}" ${st.sort === v ? 'selected' : ''}>${n}</option>`).join('')}</select><button class="primary">Tìm</button></form>
            <ol class="mk">${rows || '<li><div class="muted">Chưa có món nào khớp.</div></li>'}</ol><p class="muted small">Phí chợ của bạn: ${Math.round(fee() * 100)}% (trừ vào tiền người bán).</p>`;
        }
        case 'orders': {
          if (!online) return tabBar + offline;
          const rows = (st.data?.orders ?? []).map((o: any) => `<li><div>${gname(o.good)} ×${o.n}<small>${esc(o.buyerName)}${o.npc ? ' · thương buôn thu mua' : ''} · bạn có ${haveGood(S, o.good)}</small></div>
            <div class="mk-r"><span><b>${o.price}</b>/món</span><input type="number" min="1" max="${o.n}" value="${Math.max(1, Math.min(o.n, haveGood(S, o.good)))}" data-fillq="${o.id}"><button type="button" class="primary" data-fill="${o.id}" data-good="${o.good}" ${haveGood(S, o.good) < 1 || o.buyer === S.id ? 'disabled' : ''}>Bán cho họ</button></div></li>`).join('');
          return tabBar + `<div class="card"><small>Đặt giá mua (ký quỹ tiền)</small><form class="mk-form" id="mkOrder"><select name="good">${goodOpt('go', false)}</select><input name="n" type="number" min="1" value="100" aria-label="Số lượng"><input name="price" type="number" min="1" value="2" aria-label="Giá mỗi món"><button class="primary">Đặt mua</button></form></div>
            <ol class="mk">${rows || '<li><div class="muted">Chưa có ai đặt mua.</div></li>'}</ol>`;
        }
        case 'sell': {
          if (!online) return tabBar + offline;
          const g = haveGood(S, st.sellGood) > 0 ? st.sellGood : (['co', 'la', 'tre', 'go', 'cui', 'da', 'sat', 'so', 'ngoc', ...ITEM_KEYS, 'g_giao', 'g_khien', 'g_thuoc', 'g_bua'].find((x) => haveGood(S, x) > 0) ?? 'go');
          return tabBar + `<form class="stack" id="mkSell"><label>Món hàng</label><select name="good">${goodOpt(g, true)}</select>
            <label>Số lượng</label><input name="n" type="number" min="1" max="${haveGood(S, g)}" value="${Math.min(haveGood(S, g), g in ITEMS || g.startsWith('g_') ? 1 : 100)}">
            <label>Hình thức</label><div class="seg"><button type="button" data-mode="fixed" aria-checked="${st.mode === 'fixed'}">Bán giá cố định</button><button type="button" data-mode="auction" aria-checked="${st.mode === 'auction'}">Đấu giá</button></div>
            <label>${st.mode === 'auction' ? 'Giá khởi điểm (cả lô)' : 'Giá mỗi món'}</label><input name="price" type="number" min="1" value="${g in ITEMS ? ITEMS[g as ItemKey].value : 2}">
            ${st.mode === 'auction' ? `<label>Thời gian đấu giá</label><select name="hours">${[1, 6, 12, 24, 48].map((h) => `<option value="${h}" ${h === 6 ? 'selected' : ''}>${h} giờ</option>`).join('')}</select>` : ''}
            <p class="muted small">Hàng được giữ ở chợ cho tới khi bán xong. Phí ${Math.round(fee() * 100)}%. Bán giá cố định tự gỡ sau 72 giờ, hàng về hộp thư.</p>
            <button class="primary">${st.mode === 'auction' ? 'Mở phiên đấu giá' : 'Bày bán'}</button></form>`;
        }
        case 'mine': {
          if (!online) return tabBar + offline;
          const m = st.mine;
          const ls = (m?.listings ?? []).map((l: any) => `<li><div>${gname(l.good)} ×${l.n}<small>${l.kind === 'auction' ? `Đấu giá · ${l.bidder === S.id ? 'bạn đang giữ giá' : l.bidder ? 'có người trả ' + l.price : 'chưa ai trả'} · còn ${left(l.ends)}` : `Bán ${l.price}/món`}</small></div>${l.seller === S.id ? `<button type="button" data-cancel="${l.id}">Gỡ</button>` : ''}</li>`).join('');
          const os = (m?.orders ?? []).map((o: any) => `<li><div>Đặt mua ${gname(o.good)} ×${o.n}<small>${o.price}/món</small></div><button type="button" data-cancel="${o.id}">Hủy</button></li>`).join('');
          return tabBar + `<p class="muted small">Tiền bán hàng, hàng mua được, tiền hoàn đều tự về đảo (hộp thư).</p><ol class="mk">${ls + os || '<li><div class="muted">Bạn chưa đăng món nào.</div></li>'}</ol>`;
        }
        case 'guild': {
          if (!online) return tabBar + offline;
          if (S.guild && st.ginfo) {
            const g = st.ginfo.guild;
            const lead = g.leader === S.id;
            return tabBar + `<div class="card gold"><small>Thương hội</small><h3>${esc(g.name)} [${esc(g.tag)}]</h3><p>Cấp ${g.lv} · quỹ ${fmt(g.fund)} tiền · ${g.members} hội viên · hội trưởng ${esc(g.leaderName)}</p>
              <p class="muted small">Ưu đãi: thuế thương thuyền +${g.lv * 5}%, phí chợ giảm 1%. Quỹ càng lớn, hội càng lên cấp (2.500 / 8.000 / 20.000 / 50.000).</p>${g.about ? `<p>${esc(g.about)}</p>` : ''}</div>
              <form class="mk-form" id="gDonate"><input name="n" type="number" min="1" value="100"><button class="primary">Góp quỹ</button></form>
              <ol class="bxh">${st.ginfo.members.map((m: any, i: number) => `<li><i>${i + 1}</i><span></span><div><b>${esc(m.name)}${m.player === g.leader ? ' (hội trưởng)' : ''}</b><small>góp ${fmt(m.donated)}</small></div>${lead && m.player !== S.id ? `<button type="button" data-kick="${m.player}">Mời ra</button>` : ''}</li>`).join('')}</ol>
              <button type="button" class="wide" id="gLeave">Rời thương hội</button>`;
          }
          const list = (st.guilds?.guilds ?? []).map((g: any) => `<li><div><b>${esc(g.name)} [${esc(g.tag)}]</b><small>Cấp ${g.lv} · ${g.members} người · quỹ ${fmt(g.fund)}</small></div><button type="button" data-join="${g.id}">Xin vào</button></li>`).join('');
          return tabBar + `<p class="hint">Thương hội: hội viên được thuế thương thuyền cao hơn, phí chợ thấp hơn, cùng góp quỹ để hội lên cấp.</p><ol class="mk">${list || '<li><div class="muted">Chưa có thương hội nào. Hãy lập hội đầu tiên!</div></li>'}</ol>
            <div class="card"><small>Lập thương hội (${GUILD_COST} tiền)</small><form class="stack" id="gCreate"><input name="name" maxlength="24" placeholder="Tên hội, ví dụ: Thương Hội Phố Hiến"><input name="tag" maxlength="4" placeholder="Ký hiệu 2–4 chữ, ví dụ: PH"><input name="about" maxlength="140" placeholder="Giới thiệu ngắn"><button class="primary">Lập hội</button></form></div>`;
        }
        case 'linh': {
          const now = this.store.now();
          const inc = incomePerHour(S, now);
          const near = routesNear(homeCell(S), routePeriod(now));
          return tabBar + `<div class="card"><small>Thu nhập mỗi giờ</small>
              <p>Nhà dân <b>+${Math.round(inc.dan)}</b> · Thuế thương thuyền <b>+${Math.round(inc.toll)}</b> · Chư hầu cống nạp <b>+${Math.round(inc.cong)}</b>${inc.nop ? ` · Nộp cho chủ <b class="bad">−${Math.round(inc.nop)}</b>` : ''}</p>
              <p>Tổng: <b>${Math.round(inc.total)} đồng/giờ</b> · hôm nay đã thu ${fmt(S.thue.today)}</p></div>
            <div class="card"><small>Tuyến buôn đi ngang đảo bạn</small><p>${near.length ? near.map((r) => `<span style="color:${r.m.color}">${esc(r.m.name)}</span> (${r.value}/giờ)`).join(', ') : 'Khung giờ này không có thương thuyền nào đi ngang.'}</p>
              <p class="muted small">Thương buôn đổi tuyến sau ${hms(ROUTE_MS - ((now - DAY0) % ROUTE_MS))}. Trạm thuế cấp ${bLevel(S.dinh, 'tramthue')} → hệ số ×${PORT_MULT[bLevel(S.dinh, 'tramthue')]}.</p></div>
            <div class="card"><small>Chư hầu, cứ điểm (${S.chuHau.length})</small>${S.chuHau.length ? S.chuHau.map((v) => `<p><b>${esc(v.islandName)}</b> (${esc(v.name)}) · +${tributePerHour(v.power)} đồng/giờ · còn ${hms(v.until - now)}</p>`).join('') : '<p class="muted">Chưa có. Xây Trại Lính rồi ra Hải Khu chọn đảo, bấm "Đánh chiếm".</p>'}</div>
            ${S.chuQuan && S.chuQuan.until > now ? `<div class="card danger-card"><small>Bạn đang là chư hầu</small><p>Chủ: <b>${esc(S.chuQuan.name)}</b> (${esc(S.chuQuan.islandName)}). Nộp ${tributePerHour(power(S))} đồng/giờ, còn ${hms(S.chuQuan.until - now)}.</p><p class="muted small">Ra Hải Khu, chọn đảo của họ và đánh thắng để khởi nghĩa.</p></div>` : ''}`;
        }
      }
      return tabBar;
    };
    const paint = () => {
      const b = $('#sheet .sheet-body');
      if (this.sheetKind === 'cho' && b) {
        const y = b.scrollTop;
        b.innerHTML = body();
        b.scrollTop = y;
      }
    };
    this.openSheet('cho', 'Chợ Vạn Đảo', body(), (b) => {
      b.addEventListener('click', async (e) => {
        const t = (e.target as HTMLElement).closest('button');
        if (!t || st.busy) return;
        const d = t.dataset;
        if (d.tab2) {
          this.choTab = d.tab2;
          paint();
          return void load();
        }
        if (d.buyshop) {
          const o = this.store.do({ t: 'mua', offer: d.buyshop });
          this.toast(o.msg, o.ok ? 'gold' : 'bad');
          return paint();
        }
        if (d.use) {
          const o = this.store.do({ t: 'dung', item: d.use as ItemKey });
          this.toast(o.msg, o.ok ? 'gold' : 'bad');
          return paint();
        }
        if (d.mode) {
          st.mode = d.mode;
          return paint();
        }
        if (d.buy) {
          const q = b.querySelector<HTMLInputElement>(`[data-qty="${d.buy}"]`);
          await call('buy', { id: d.buy, n: q ? Number(q.value) : 1 });
          return void load();
        }
        if (d.bid) {
          const v = b.querySelector<HTMLInputElement>(`[data-bidv="${d.bid}"]`);
          await call('bid', { id: d.bid, amount: Number(v?.value) });
          return void load();
        }
        if (d.fill) {
          const v = b.querySelector<HTMLInputElement>(`[data-fillq="${d.fill}"]`);
          await call('fill', { id: d.fill, good: d.good, n: Number(v?.value) });
          return void load();
        }
        if (d.cancel) {
          await call('cancel', { id: d.cancel });
          return void load();
        }
        if (d.join) {
          await call('gJoin', { id: d.join });
          return void load();
        }
        if (d.kick) {
          await call('gKick', { who: d.kick });
          return void load();
        }
        if (t.id === 'gLeave') {
          await call('gLeave');
          return void load();
        }
      });
      b.addEventListener('change', (e) => {
        const el = e.target as HTMLSelectElement;
        if (el.closest('#mkSell') && el.name === 'good') {
          st.sellGood = el.value;
          paint();
        }
      });
      b.addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target as HTMLFormElement;
        const v = Object.fromEntries(new FormData(f).entries()) as Record<string, string>;
        if (f.id === 'mkSearch') {
          st.q = v.q ?? '';
          st.cat = v.cat;
          st.sort = v.sort;
          return void load();
        }
        if (f.id === 'mkSell') {
          const r = await call('list', { good: v.good, n: Number(v.n), price: Number(v.price), kind: st.mode, hours: Number(v.hours ?? 6) });
          if (r?.ok) this.choTab = 'mine';
          return void load();
        }
        if (f.id === 'mkOrder') {
          await call('order', { good: v.good, n: Number(v.n), price: Number(v.price) });
          return void load();
        }
        if (f.id === 'gCreate') {
          await call('gCreate', { name: v.name, tag: v.tag, about: v.about });
          return void load();
        }
        if (f.id === 'gDonate') {
          await call('gDonate', { n: Number(v.n) });
          return void load();
        }
      });
    });
    void load();
  }

  // ---------------- Thủy Tinh ----------------
  openBoss() {
    const carry: GearSet = noGear();
    let armed = false;
    const draw = () => {
      const s = this.store.s;
      const now = this.store.now();
      const week = weekOf(now);
      const f = bossOf(week);
      const left = weekEnd(now) - now;
      const d = Math.floor(left / 86_400_000);
      const h = Math.floor((left % 86_400_000) / 3_600_000);
      const m = Math.floor((left % 3_600_000) / 60_000);
      for (const k of GEAR_KEYS) carry[k] = Math.min(carry[k], s.kho[k]);
      const b = gearBonus(carry);
      const err = bossCheck(s);
      const req = (ok: boolean, t: string) => `<li class="${ok ? 'good' : 'bad'}">${ok ? '✓' : '✗'} ${t}</li>`;
      const pick = GEAR_KEYS.map(
        (k) => `<div class="avrow"><span>${GEAR[k].name.split(' ').slice(0, 2).join(' ')}</span><div class="step"><button type="button" data-c="${k}" data-d="-1" aria-label="Bớt">‹</button><b>${carry[k]} / ${s.kho[k]}</b><button type="button" data-c="${k}" data-d="1" aria-label="Thêm">›</button></div></div>`,
      ).join('');
      const bw = this.store.net.bossWorld(s);
      const pct = bw.max ? Math.round((bw.hp / bw.max) * 1000) / 10 : 0;
      const myRank = bw.top.findIndex((x) => x.id === s.id) + 1;
      const top = bw.top
        .slice(0, 8)
        .map((x, i) => `<li class="${x.id === s.id ? 'me' : ''}"><b>${i + 1}</b><span>${esc(x.name)}</span><span>${x.dmg.toLocaleString('vi-VN')}</span></li>`)
        .join('');
      return `
        <div class="lv-head"><img class="lv-img" src="${portraitUrl('thuytinh')}" alt=""><div><h3>${f.name} · ${f.title}</h3><p class="muted">${f.lore}</p>
          <div class="stats"><span>Máu mỗi trận ${f.hp}</span><span>Công ${f.atk}</span><span>Thủ ${f.def}</span><span>Tốc ${f.spd}</span><span>+${f.minions} Thủy Binh</span></div></div></div>
        <div class="card"><small>Máu chung cả Hải Khu</small>
          <div class="hpbar"><i style="width:${pct}%"></i></div>
          <p><b>${bw.hp.toLocaleString('vi-VN')}</b> / ${bw.max.toLocaleString('vi-VN')} máu ${bw.done ? '· <b class="good">ĐÃ BỊ HẠ</b>' : ''}</p>
          <p class="muted small">Không ai hạ được Thủy Tinh một mình. Mọi đảo cùng góp sát thương. Khi máu chung về 0, Thiên Môn mở cho <b>${bw.slots}</b> người góp nhiều nhất (chưa từng phi thăng).</p>
          ${bw.winners.length ? `<p>Phi thăng tuần này: <b>${bw.winners.map((x) => esc(x.name)).join(', ')}</b></p>` : ''}
          <p>Bạn góp <b>${s.boss.total.toLocaleString('vi-VN')}</b> sát thương${myRank ? ` · hạng ${myRank}` : ''} · ${s.boss.tries} lần đánh</p>
          <p class="muted small">Hồi sinh và đổi dạng sau <b>${d} ngày ${h} giờ ${m} phút</b> (thứ Hai 00:00). Đã phi thăng tổng cộng ${s.asc} lần.</p></div>
        ${top ? `<ol class="bxh boss">${top}</ol>` : ''}
        <ul class="req">${req(s.lv.leu.tier >= BOSS_REQ.leu, `Nhà chính bậc ${BOSS_REQ.leu}`)}${req(s.lv.thuyen.tier >= BOSS_REQ.thuyen, `Thuyền bậc ${BOSS_REQ.thuyen} để vượt bão`)}${req(!bw.done, 'Thủy Tinh tuần này chưa bị hạ')}</ul>
        <div class="card"><small>Chở trang bị theo thuyền</small><div class="avopts">${pick}</div>
          <p>Đội được thêm <b>+${Math.round(b.atk * 100)}%</b> công · <b>+${Math.round(b.def * 100)}%</b> thủ · <b>+${Math.round(b.hp * 100)}%</b> máu</p>
          <p class="muted small">Chỉ trang bị mang theo mới có tác dụng ở Mắt Bão. Trang bị mang đi thì đảo nhà yếu đi khi bị đột kích.</p></div>
        <div class="card danger-card"><small>Luật Mắt Bão</small>
          <p><b>Trụ được hết trận:</b> sát thương được cộng vào máu chung, thuyền và trang bị rút về nhà.</p>
          <p><b>Bị diệt sạch:</b> mất <b>toàn bộ trang bị mang theo</b>, thuyền bị đánh chìm, về lại <b>Thuyền Thúng</b>.</p>
          <p><b>Phi thăng:</b> chỉ người góp nhiều nhất khi Thủy Tinh gục mới được. Mỗi tuần tối đa 3 người mỗi Hải Khu, không quá 5% số người đang chơi.</p></div>
        ${this.sailLine(BOSS_CELL, BOSS_TRAVEL_MUL)}
        ${s.voyage ? this.sailButton(false, '', '') : `<button class="primary wide ${armed ? 'hot' : ''}" id="btnBoss" ${err ? 'disabled' : ''}>${err ? esc(err) : armed ? 'Chắc chắn? Bấm lần nữa để ra khơi' : 'Vượt bão đánh Thủy Tinh'}</button>`}
        ${s.asc > 0 ? '<button class="wide" id="btnTG">Cổng Thượng Giới</button>' : ''}`;
    };
    this.openSheet('boss', 'Mắt Bão', draw(), (body) => {
      this.bossRedraw = () => (body.innerHTML = draw());
      body.addEventListener('click', (e) => {
        const t = (e.target as HTMLElement).closest('button');
        if (!t) return;
        if (t.dataset.c) {
          const k = t.dataset.c as GearKey;
          carry[k] = Math.max(0, Math.min(this.store.s.kho[k], carry[k] + Number(t.dataset.d)));
          armed = false;
        } else if (t.id === 'btnBoss') {
          if (!armed) armed = true;
          else {
            const o = this.store.do({ t: 'sail', kind: 'boss', carry: { ...carry } });
            if (o.ok) this.store.net.setActivity('đang vượt bão đi đánh Thủy Tinh');
            return this.sail(o);
          }
        } else if (t.id === 'btnTG') return this.openThuongGioi();
        body.innerHTML = draw();
      });
    });
  }

  showBossResult(o: Outcome) {
    const f = bossOf(weekOf(this.store.now()));
    const bw = this.store.net.bossWorld(this.store.s);
    const wiped = !!o.boss?.wiped;
    const html = !wiped
      ? `<div class="result win"><b>Trụ vững</b><span>${o.battle?.rounds ?? 0} lượt</span></div>
         <p>Gây <b>${(o.boss?.dmg ?? 0).toLocaleString('vi-VN')}</b> sát thương cho ${f.name} · ${f.title}. Đã cộng vào máu chung của Hải Khu.</p>
         <p class="muted small">Máu chung còn ${bw.hp.toLocaleString('vi-VN')} / ${bw.max.toLocaleString('vi-VN')}. Thuyền và trang bị đang rút về nhà.</p>`
      : `<div class="result lose"><b>Bị diệt sạch</b><span>${o.battle?.rounds ?? 0} lượt</span></div>
         <p>Vẫn gây được <b>${(o.boss?.dmg ?? 0).toLocaleString('vi-VN')}</b> sát thương vào máu chung.</p>
         <div class="card danger-card"><small>Cái giá phải trả</small><p>Toàn bộ trang bị mang theo đã chìm xuống đáy biển. Thuyền bị đánh chìm, bạn bơi về đảo và chỉ còn <b>Thuyền Thúng</b>.</p></div>
         <p class="hint">Mạnh lên rồi quay lại. Thủy Tinh hồi sinh và đổi dạng mỗi thứ Hai.</p>`;
    this.openSheet('result', 'Đại chiến Thủy Tinh', html + '<button class="primary wide" id="btnOk">Tiếp tục</button>', (b) => b.querySelector('#btnOk')!.addEventListener('click', () => this.closeSheet()));
  }

  openThuongGioi() {
    this.openSheet('thuonggioi', 'Cổng Thượng Giới', thuongGioiHtml(this.store.s));
  }

  // ---------------- bảng xếp hạng ----------------
  openBxh() {
    let tab: 'power' | 'boss' | 'asc' = 'power';
    const draw = () => {
      const s = this.store.s;
      const week = weekOf(this.store.now());
      const me = { ...publicOf(s), me: true };
      const all = [me, ...this.store.net.islands().map((p) => ({ ...p, me: false }))];
      const val = (p: IslandPub) => (tab === 'power' ? p.power : tab === 'boss' ? (p.boss?.week === week ? (p.boss.total ?? p.boss.best) : 0) : p.asc ?? 0);
      const list = all.filter((p) => tab !== 'asc' || (p.asc ?? 0) > 0).sort((a, b) => val(b) - val(a) || b.power - a.power).slice(0, 50);
      const unit = tab === 'power' ? 'sức mạnh' : tab === 'boss' ? 'sát thương' : 'lần';
      const rows = list
        .map(
          (p, i) => `<li class="${p.me ? 'me' : ''}"><i>${i + 1}</i><img src="${avatarUrl(p.me ? s.avatar : pubAvatar(p), 2, true)}" alt=""><div><b>${esc(p.name)}${p.me ? ' (bạn)' : ''}${p.bot ? ' <em>máy</em>' : ''}</b><small>${esc(p.title)} · ${esc(p.islandName)}</small></div>
            <span>${val(p)} <small>${unit}</small>${tab === 'boss' && p.boss?.week === week && p.boss.won ? ' ★' : ''}</span></li>`,
        )
        .join('');
      const f = bossOf(week);
      return `<div class="seg tabs3">${(['power', 'boss', 'asc'] as const).map((k) => `<button type="button" data-t="${k}" aria-checked="${tab === k}">${k === 'power' ? 'Sức mạnh' : k === 'boss' ? 'Thủy Tinh tuần' : 'Phi thăng'}</button>`).join('')}</div>
        ${tab === 'boss' ? `<p class="muted small">Tuần này: ${f.name} · ${f.title}. Tổng sát thương góp vào máu chung. ★ = được Thiên Môn chọn phi thăng. Làm mới mỗi thứ Hai.</p>` : ''}
        ${tab === 'asc' && !list.length ? '<p class="hint">Chưa ai phi thăng. Hãy là người đầu tiên đánh bại Thủy Tinh!</p>' : ''}
        <ol class="bxh">${rows}</ol>
        <button type="button" class="wide" id="btnBossGo">Xem Thủy Tinh ở Mắt Bão</button>`;
    };
    this.openSheet('bxh', 'Bảng xếp hạng', draw(), (body) => {
      body.addEventListener('click', (e) => {
        const t = (e.target as HTMLElement).closest('button');
        if (!t) return;
        if (t.id === 'btnBossGo') return this.openBoss();
        if (t.dataset.t) {
          tab = t.dataset.t as typeof tab;
          body.innerHTML = draw();
        }
      });
    });
  }

  // ---------------- tạo / chỉnh nhân vật ----------------
  openAvatar(first = false) {
    const s = this.store.s;
    // chỉ đổi được một lần; sau đó cần Thẻ Đổi Giao Diện
    if (s.avatarSet && !first && (s.bag.thegd ?? 0) < 1) {
      this.toast('Nhân vật chỉ đổi được một lần. Mua Thẻ Đổi Giao Diện ở Chợ để đổi lại.', 'bad');
      return;
    }
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
      ${first ? '<p class="muted small">Chú ý: chỉ chọn được một lần. Muốn đổi lại sau này phải có Thẻ Đổi Giao Diện (bán ở Chợ).</p>' : '<p class="muted small">Lưu sẽ dùng 1 Thẻ Đổi Giao Diện.</p>'}`;
    const names: Record<string, (a: Avatar) => string> = {
      ha: (a) => HAIRS[a.g][a.ha],
      to: (a) => OUTFITS[a.to],
      hat: (a) => HATS[a.hat],
      it: (a) => AV_ITEMS[a.it],
    };
    const counts: Record<string, number> = { ha: 5, to: OUTFITS.length, hat: HATS.length, it: AV_ITEMS.length };
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

/** Cúp vàng cho nút Bảng xếp hạng. */
function drawCup() {
  const [c, ctx] = canvas(12, 12);
  const p = new Pen(ctx);
  p.rect(2, 1, 8, 5, 'l');
  p.rect(3, 6, 6, 1, 'l');
  p.rect(5, 7, 2, 2, 'L');
  p.rect(3, 9, 6, 2, 'L');
  p.px(1, 2, 'l');
  p.px(10, 2, 'l');
  p.px(0, 3, 'L');
  p.px(11, 3, 'L');
  p.px(3, 2, 'i');
  p.vline(3, 2, 4, 'i');
  return c;
}

/** Biểu tượng trang bị. */
function drawGearIcon(k: GearKey) {
  const [c, ctx] = canvas(12, 12);
  const p = new Pen(ctx);
  if (k === 'giao') {
    p.line(1, 11, 9, 3, 'T');
    p.poly([[8, 1], [11, 0], [10, 3], [9, 4]], 'm');
    p.px(10, 1, 'i');
  } else if (k === 'khien') {
    p.ellipse(6, 6, 5, 5, 'Y');
    p.ellipse(6, 6, 5, 5, 'z', false);
    p.ellipse(6, 6, 2, 2, 'l');
  } else if (k === 'thuoc') {
    p.rect(3, 4, 6, 7, 'G');
    p.rect(4, 2, 4, 2, 'T');
    p.rect(4, 6, 4, 2, 'f');
    p.px(5, 7, 'e');
  } else {
    p.ellipse(6, 6, 4, 4, 'x');
    p.ellipse(6, 6, 4, 4, 'X', false);
    p.px(5, 4, 'i');
    p.vline(6, 0, 2, 'e');
  }
  return c;
}

/** Thời gian còn lại gọn: 64:59 (giờ:phút) hoặc 12:05 (phút:giây) khi dưới 1 giờ. */
function clock(ms: number) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}
