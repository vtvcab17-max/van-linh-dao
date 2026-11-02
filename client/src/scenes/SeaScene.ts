import Phaser from 'phaser';
import { HOME_CELL, LINH_VAT, WILDS } from '../../../shared/data';
import { publicOf, type IslandPub } from '../../../shared/logic';
import { islandCell } from '../../../shared/map';
import type { Store } from '../store';
import type { UI } from '../ui';
import { zoomFor } from './IslandScene';
import { seaIslandTex, waterTex } from '../art/textures';
import { miniRadius, type MiniKind } from '../art/islands';
import { CamCtl } from './camctl';

const T = 16;
const COLS = 40;
const ROWS = 24;

interface Label {
  el: HTMLElement;
  x: number;
  y: number;
}

export class SeaScene extends Phaser.Scene {
  store!: Store;
  ui!: UI;
  ctl!: CamCtl;
  private water!: Phaser.GameObjects.Image;
  private waterF = 0;
  private layer!: Phaser.GameObjects.Container;
  private route!: Phaser.GameObjects.Graphics;
  private boat!: Phaser.GameObjects.Image;
  private boatLabel: Label | null = null;
  private sig = '';
  portrait = false;
  private labels: Label[] = [];
  private lastCam = '';
  private lastBoatText = 0;

  constructor() {
    super('sea');
  }

  create() {
    this.store = this.registry.get('store');
    this.ui = this.registry.get('ui');
    const S = Math.max(COLS, ROWS) * T + 192; // hình vuông: phủ kín cả màn ngang lẫn dọc
    this.cameras.main.setRoundPixels(true);
    waterTex(this, S, S, 1, '#b8d6ff');
    this.water = this.add.image(-96, -96, waterTex(this, S, S, 0, '#b8d6ff')).setOrigin(0).setDepth(-10);
    this.layer = this.add.container(0, 0);
    this.route = this.add.graphics().setDepth(5);
    this.boat = this.add.image(0, 0, 'boat-1').setOrigin(0.5, 0.85).setDepth(10).setVisible(false);
    this.tweens.add({ targets: this.boat, angle: { from: -4, to: 4 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.time.addEvent({ delay: 800, loop: true, callback: () => this.water.setTexture(waterTex(this, S, S, (this.waterF ^= 1), '#b8d6ff')) });
    this.ctl = new CamCtl(this, {
      minZ: 1,
      maxZ: 4,
      region: () => {
        const W = (this.portrait ? ROWS : COLS) * T;
        const H = (this.portrait ? COLS : ROWS) * T;
        return { x: -32, y: -32, w: W + 64, h: H + 64 };
      },
      // phóng to sát đảo nhà thì sà xuống đảo
      onPastMax: (x, y) => {
        const h = this.P(HOME_CELL.x, HOME_CELL.y);
        if (Math.hypot(x - h.x, y - h.y) < 64) this.ui.goIsland();
        else this.ui.toast('Phóng to ở gần đảo của bạn để về đảo.', 'muted');
      },
    });
    this.ctl.attach();
    this.scale.on('resize', () => {
      this.fit(false);
      this.draw(true);
    });
    this.fit(true);
    this.store.net.on('islands', () => this.draw());
    this.store.on('change', () => this.draw());
    const hide = () => {
      const box = document.getElementById('maplabels');
      if (box) box.hidden = true;
    };
    this.events.on('sleep', hide);
    this.events.on('shutdown', hide);
    this.events.on('wake', () => this.enterFromIsland());
    this.draw(true);
    this.enterFromIsland();
  }

  get dragged() {
    return this.ctl?.dragged ?? false;
  }

  /** Màn dọc (điện thoại) thì xoay hải đồ: rộng 24 ô, cao 40 ô. */
  P(x: number, y: number) {
    return this.portrait ? { x: y * T, y: x * T } : { x: x * T, y: y * T };
  }

  defaultZoom() {
    const rs = (this.registry.get('rs') as number) || 1;
    return rs > 1 ? 2 : Math.max(1, zoomFor(this.scale.width, this.scale.height) - 1);
  }

  private fit(center: boolean) {
    const was = this.portrait;
    this.portrait = this.scale.height > this.scale.width;
    if (was !== this.portrait) this.sig = '';
    if (center) {
      this.cameras.main.setZoom(this.defaultZoom());
      const me = this.P(HOME_CELL.x, HOME_CELL.y);
      this.ctl.centerOn(me.x, me.y);
    }
    this.ctl.clamp();
  }

  /** Từ đảo thu nhỏ ra: bắt đầu sát đảo nhà rồi lùi ra thấy cả vùng biển. */
  enterFromIsland() {
    this.fit(false);
    this.draw(true);
    const cam = this.cameras.main;
    const me = this.P(HOME_CELL.x, HOME_CELL.y);
    cam.setZoom(this.ctl.o.maxZ);
    this.ctl.centerOn(me.x, me.y);
    cam.fadeIn(220, 18, 9, 10);
    const target = this.defaultZoom();
    this.time.delayedCall(30, () => {
      const p = this.screenOfWorld(me.x, me.y, false);
      this.ctl.animateTo(target, p.x, p.y, 420);
    });
  }

  /** Phóng vào đảo nhà rồi mờ dần trước khi về đảo. */
  leaveToIsland(done: () => void) {
    const cam = this.cameras.main;
    const me = this.P(HOME_CELL.x, HOME_CELL.y);
    const p = this.screenOfWorld(me.x, me.y, false);
    this.ctl.animateTo(this.ctl.o.maxZ + 2, p.x, p.y, 240);
    cam.fadeOut(240, 18, 9, 10);
    cam.once('camerafadeoutcomplete', done);
  }

  zoomStep(dir: 1 | -1) {
    if (dir < 0 && Math.round(this.cameras.main.zoom) <= this.ctl.o.minZ) return;
    this.ctl.step(dir);
  }

  focusHome() {
    const me = this.P(HOME_CELL.x, HOME_CELL.y);
    this.ctl.centerOn(me.x, me.y);
  }

  /** Toạ độ màn hình. css=true → px CSS (cho DOM), false → px khung game (cho camera). */
  screenOfWorld(x: number, y: number, css = true) {
    const cam = this.cameras.main;
    const k = cam.zoom * (css ? ((this.registry.get('rs') as number) || 1) : 1);
    return { x: (x - cam.worldView.x) * k, y: (y - cam.worldView.y) * k };
  }

  /** Ô hải đồ (chưa xoay) của một đảo người chơi/đảo máy — tính chung với server (shared/map). */
  cellOf(id: string): { x: number; y: number } {
    return islandCell(id);
  }

  private label(x: number, y: number, text: string, color: string, sub?: string): Label {
    const el = document.createElement('div');
    el.className = 'ml';
    el.style.color = color;
    el.textContent = text;
    if (sub) {
      const sm = document.createElement('small');
      sm.textContent = sub;
      el.appendChild(sm);
    }
    const l = { el, x, y };
    this.labels.push(l);
    return l;
  }

  private placeLabels(force = false) {
    const cam = this.cameras.main;
    const key = `${cam.zoom.toFixed(3)}:${cam.worldView.x.toFixed(1)}:${cam.worldView.y.toFixed(1)}`;
    if (key === this.lastCam && !force) return;
    this.lastCam = key;
    const k = cam.zoom * ((this.registry.get('rs') as number) || 1);
    const ox = cam.worldView.x;
    const oy = cam.worldView.y;
    for (const l of this.labels) l.el.style.transform = `translate(${Math.round((l.x - ox) * k)}px, ${Math.round((l.y - oy) * k)}px) translateX(-50%)`;
  }

  /** Một hòn đảo trên hải đồ; trả về khoảng cách từ tâm tới mép dưới để đặt nhãn. */
  private island(id: string, x: number, y: number, kind: MiniKind, land: number, tier: number, onTap: () => void, online = false): number {
    const R = miniRadius(land);
    const img = this.add.image(x, y, seaIslandTex(this, id, land, kind, tier));
    const hit = R * 2 + 6;
    img.setInteractive({ hitArea: new Phaser.Geom.Rectangle((img.width - hit) / 2, (img.height - hit) / 2 + 2, hit, hit), hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true });
    img.on('pointerup', () => !this.dragged && onTap());
    this.layer.add(img);
    if (online) {
      const ring = this.add.circle(x, y + 2, R + 5).setStrokeStyle(1, 0x7cff9a, 0.9);
      this.tweens.add({ targets: ring, scale: { from: 0.9, to: 1.15 }, alpha: { from: 1, to: 0.3 }, duration: 900, yoyo: true, repeat: -1 });
      this.layer.add(ring);
    }
    return Math.round(R * 0.78 + 5);
  }

  draw(force = false) {
    if (!this.sys.isActive() && !force) return;
    const s = this.store.s;
    const list = this.store.net.islands();
    const online = new Set(this.store.net.online().map((o) => o.id));
    const sig = JSON.stringify([list.map((p) => [p.id, p.power, p.land, p.tiers?.leu]), s.land.split("1").length, [...online], Object.values(s.wilds).map((w) => w.readyAt > s.gt), s.lv.leu.tier, this.portrait, s.voyage?.id]);
    if (sig === this.sig && !force) return;
    this.sig = sig;
    this.layer.removeAll(true);
    this.labels = [];
    this.boatLabel = null;
    const me = publicOf(s);
    const m = this.P(HOME_CELL.x, HOME_CELL.y);
    const dm = this.island(s.id, m.x, m.y, 'me', me.land, me.tiers.leu, () => this.ui.openIsland(me, true), true);
    this.label(m.x, m.y + dm, 'Đảo của bạn', '#f6d34d');
    for (const w of WILDS) {
      const st = s.wilds[w.id];
      const ready = !st || s.gt >= st.readyAt;
      const q = this.P(w.sx, w.sy);
      const d = this.island(w.id, q.x, q.y, 'wild', 20 + w.level * 8, 1, () => this.ui.openWild(w));
      this.label(q.x, q.y + d, w.name, ready ? '#ff9b8a' : '#9aa0a8', `cấp ${w.level}${ready ? '' : ' · đã dọn'}`);
    }
    for (const p of list) {
      const t = islandCell(p.id);
      const pos = this.P(t.x, t.y);
      const d = this.island(p.id, pos.x, pos.y, p.bot ? 'bot' : 'player', p.land, p.tiers?.leu ?? 1, () => this.ui.openIsland(p as IslandPub, false), online.has(p.id));
      this.label(pos.x, pos.y + d, p.name, p.bot ? '#ffd29a' : '#a9c8ff', `${p.power} sức mạnh${p.bot ? ' · máy' : ''}`);
    }
    if (s.voyage) this.boatLabel = this.label(0, 0, '', '#fbf3dc');
    const box = document.getElementById('maplabels');
    if (box) {
      box.replaceChildren(...this.labels.map((l) => l.el));
      box.hidden = false;
    }
    this.drawRoute();
    this.placeLabels(true);
  }

  private drawRoute() {
    const g = this.route;
    g.clear();
    const v = this.store.s.voyage;
    this.boat.setVisible(!!v);
    if (!v) return;
    this.boat.setTexture(`boat-${this.store.s.lv.thuyen.tier}`);
    const a = this.P(HOME_CELL.x, HOME_CELL.y);
    const b = this.P(v.to.x, v.to.y);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.floor(len / 6);
    g.fillStyle(0xfbf3dc, 0.8);
    for (let i = 1; i < n; i++) g.fillRect(Math.round(a.x + ((b.x - a.x) * i) / n), Math.round(a.y + ((b.y - a.y) * i) / n), 2, 2);
  }

  /** Vị trí thuyền theo thời gian trong game (nội suy mượt giữa các nhịp 1 giây). */
  private boatTick(time: number) {
    const s = this.store.s;
    const v = s.voyage;
    if (!v) {
      if (this.boat.visible) this.drawRoute();
      return;
    }
    const gtNow = s.gt + (Date.now() - s.lastReal) * s.speed;
    const home = this.P(HOME_CELL.x, HOME_CELL.y);
    const dest = this.P(v.to.x, v.to.y);
    let t: number;
    let from = home,
      to = dest;
    if (v.phase === 'di') t = (gtNow - v.departAt) / Math.max(1, v.arriveAt - v.departAt);
    else {
      t = (gtNow - v.arriveAt) / Math.max(1, v.returnAt - v.arriveAt);
      from = dest;
      to = home;
    }
    t = Phaser.Math.Clamp(t, 0, 1);
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    this.boat.setPosition(x, y);
    this.boat.setFlipX(to.x < from.x);
    if (this.boatLabel) {
      this.boatLabel.x = x;
      this.boatLabel.y = y + 4;
      if (time - this.lastBoatText > 250) {
        this.lastBoatText = time;
        const left = Math.max(0, Math.ceil(((v.phase === 'di' ? v.arriveAt : v.returnAt) - gtNow) / 1000 / s.speed));
        const mm = left >= 60 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : `${left}s`;
        this.boatLabel.el.textContent = `${LINH_VAT.thuyen.tiers[s.lv.thuyen.tier - 1]}`;
        const sm = document.createElement('small');
        sm.textContent = v.phase === 'di' ? `tới ${v.targetName} sau ${mm}` : `về bến sau ${mm}`;
        this.boatLabel.el.appendChild(sm);
      }
      this.lastCam = '';
    }
  }

  update(time: number) {
    this.ctl.clamp();
    this.boatTick(time);
    this.placeLabels();
  }
}
