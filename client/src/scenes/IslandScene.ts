import Phaser from 'phaser';
import { GRID, LINH_VAT, LV_KEYS, NODES, type LvKey } from '../../../shared/data';
import { currentQuest, dockPos, isLand, landCount, landCap, LV_POS, type PlayerState } from '../../../shared/logic';
import { canvas, Pen } from '../art/pixel';
import { CamCtl } from './camctl';
import { drawIsland, drawScaffold, LV_SIZE } from '../art/sprites';
import { avatarTex, dinhTex, ensureTex, HD, lvTex, preloadAll, texBox, waterTex } from '../art/textures';
import { BUILDINGS, type BKey } from '../../../shared/economy';
import { occupied } from '../../../shared/logic';

/** Hình vẽ chi tiết gấp HD lần nên thu lại cho đúng kích thước trong thế giới. */
const Q = 1 / HD;
import { hashStr } from '../../../shared/rng';
import type { Store } from '../store';
import type { UI } from '../ui';

export const T = 16;
export const PAD = 160;
const WORLD = GRID * T + PAD * 2;
const wx = (tx: number) => PAD + tx * T;

/** Mức phóng to camera theo kích thước khung game (đã chia cho hệ số vẽ rs). */
export function zoomFor(w: number, h: number, rs = 1) {
  const z = Math.min((w * rs) / (T * 9), (h * rs) / (T * 10)) / rs;
  return Math.max(rs > 1 ? 2 : 2, Math.min(5, Math.round(z)));
}

export class IslandScene extends Phaser.Scene {
  store!: Store;
  ui!: UI;
  private water!: Phaser.GameObjects.Image;
  private waterF = 0;
  private landKey = '';
  private islandVer = 0;
  private nodes = new Map<string, Phaser.GameObjects.Image>();
  private chests = new Map<string, Phaser.GameObjects.Image>();
  private lvs = {} as Record<LvKey, Phaser.GameObjects.Image>;
  private emotes = {} as Record<LvKey, Phaser.GameObjects.Image>;
  private blinkUntil = {} as Record<LvKey, number>;
  private an!: Phaser.GameObjects.Image;
  private rua!: Phaser.GameObjects.Image;
  private expandGfx!: Phaser.GameObjects.Graphics;
  expandMode = false;
  ctl!: CamCtl;
  private lastSlow = 0;
  private dockKey = '';
  private scaffolds = {} as Record<LvKey, Phaser.GameObjects.Image>;
  private buildLabels = new Map<string, HTMLElement>();
  private lastBuildText = 0;
  private bounds = { x: 0, y: 0, w: WORLD, h: WORLD };
  private guide!: Phaser.GameObjects.Image;
  private halo!: Phaser.GameObjects.Image;
  private dinhImgs = new Map<string, { img: Phaser.GameObjects.Image; scaf: Phaser.GameObjects.Image; key: string }>();
  /** đang chọn chỗ đặt công trình */
  placing: BKey | null = null;
  private placeGfx!: Phaser.GameObjects.Graphics;

  private get dragged() {
    return this.ctl?.dragged ?? false;
  }

  constructor() {
    super('island');
  }

  create() {
    this.store = this.registry.get('store');
    this.ui = this.registry.get('ui');
    preloadAll(this);
    const cam = this.cameras.main;
    cam.setRoundPixels(true);
    this.ctl = new CamCtl(this, {
      minZ: 1,
      maxZ: 6,
      region: () => this.bounds,
      onPastMin: () => this.ui.goSea(),
    });
    this.water = this.add.image(0, 0, '__DEFAULT').setOrigin(0).setDepth(-20).setScale(Q);
    this.expandGfx = this.add.graphics().setDepth(5000);
    this.placeGfx = this.add.graphics().setDepth(5001);
    for (const k of LV_KEYS) {
      const p = LV_POS[k];
      const img = this.add.image(wx(p.x) + 8, wx(p.y) + 15, '__DEFAULT').setOrigin(0.5, 1).setDepth(wx(p.y) + 15).setScale(Q);
      // vùng chạm vừa khít phần có hình của từng bậc (đặt lại mỗi khi đổi hình), không che các ô phía sau
      img.setInteractive({ hitArea: new Phaser.Geom.Rectangle(0, 0, 1, 1), hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true });
      img.on('pointerup', () => !this.dragged && this.ui.openLv(k));
      this.lvs[k] = img;
      this.emotes[k] = this.add.image(img.x, img.y - 30, 'emo-vui').setDepth(4000).setVisible(false).setScale(Q);
      const { w: sw, h: sh } = LV_SIZE[k];
      this.scaffolds[k] = this.add.image(img.x, img.y, ensureTex(this, `scaf-${sw}x${sh}`, () => drawScaffold(sw, sh))).setOrigin(0.5, 1).setVisible(false).setScale(Q);
      this.blinkUntil[k] = 0;
    }
    this.tweens.add({ targets: this.lvs.thuyen, angle: { from: -2, to: 2 }, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    // nhân vật chủ đảo (nam/nữ, theo dáng vẻ người chơi tự chỉnh); chạm vào để chỉnh
    this.an = this.add.image(wx(11) + 8, wx(12) + 15, avatarTex(this, this.store.s.avatar)).setOrigin(0.5, 1).setScale(Q);
    this.an.setInteractive({ useHandCursor: true }).on('pointerup', () => !this.dragged && this.ui.openAvatar());
    this.events.on('wake', () => this.enterFromSea());
    this.rua = this.add.image(wx(9) + 8, wx(14) + 12, 'ch-rua').setOrigin(0.5, 1).setDepth(wx(14)).setScale(Q);
    const labelsBox = () => document.getElementById('buildlabels');
    this.events.on('sleep', () => labelsBox()?.setAttribute('hidden', ''));
    this.events.on('wake', () => labelsBox()?.removeAttribute('hidden'));
    this.rua.setInteractive({ useHandCursor: true }).on('pointerup', () => !this.dragged && this.ui.openRua());

    // vầng hào quang trên đầu người đã phi thăng
    this.halo = this.add.image(0, 0, ensureTex(this, 'halo', drawHalo)).setOrigin(0.5, 1).setScale(Q).setVisible(false);
    // mũi tên vàng chỉ chỗ cần bấm theo nhiệm vụ Rùa Vàng
    this.guide = this.add.image(0, 0, ensureTex(this, 'guide-arrow', drawGuideArrow)).setOrigin(0.5, 1).setDepth(6000).setScale(Q).setVisible(false);
    this.time.addEvent({ delay: 700, loop: true, callback: () => this.water.setTexture(`iw${(this.waterF ^= 1)}-${this.islandVer}`) });
    this.time.addEvent({ delay: 400, loop: true, callback: () => this.blinkTick() });

    this.ctl.attach();
    this.input.on('pointerup', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.dragged || over.length) return;
      this.tapGround(p.worldX, p.worldY);
    });

    this.scale.on('resize', () => this.fitCamera(false));
    this.updateBounds(this.store.s);
    this.fitCamera(true);
    this.store.on('change', () => this.sync());
    this.store.on('tick', () => this.sync());
    this.sync();
  }

  fitZoom() {
    return zoomFor(this.scale.width, this.scale.height, this.registry.get('rs'));
  }

  /** Tâm hòn đảo (theo các ô đất). */
  islandCenter() {
    return { x: this.bounds.x + this.bounds.w / 2, y: this.bounds.y + this.bounds.h / 2 };
  }

  fitCamera(center: boolean) {
    const cam = this.cameras.main;
    cam.setZoom(this.fitZoom());
    if (center) {
      const c = this.islandCenter();
      this.ctl.centerOn(c.x, c.y);
    }
    this.ctl.clamp();
  }

  /** Từ hải đồ phóng vào: bắt đầu từ xa rồi sà xuống đảo. */
  enterFromSea() {
    const cam = this.cameras.main;
    const c = this.islandCenter();
    cam.setZoom(1);
    this.ctl.centerOn(c.x, c.y);
    cam.fadeIn(220, 18, 9, 10);
    this.ctl.animateTo(this.fitZoom(), cam.width / 2, cam.height / 2, 380);
  }

  /** Thu nhỏ rồi mờ dần trước khi ra hải đồ. */
  leaveToSea(done: () => void) {
    const cam = this.cameras.main;
    this.ctl.animateTo(Math.max(0.5, cam.zoom * 0.5), cam.width / 2, cam.height / 2, 220);
    cam.fadeOut(220, 18, 9, 10);
    cam.once('camerafadeoutcomplete', done);
  }

  zoomStep(dir: 1 | -1) {
    this.ctl.step(dir);
  }

  focusTile(tx: number, ty: number) {
    this.cameras.main.pan(wx(tx) + 8, wx(ty) + 8, 350, 'Sine.easeInOut');
  }

  private updateBounds(s: PlayerState) {
    let x0 = GRID,
      y0 = GRID,
      x1 = 0,
      y1 = 0;
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++)
        if (isLand(s, x, y)) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
    const m = 3; // chừa 3 ô biển quanh đảo để thấy bến thuyền và Rùa Vàng
    this.bounds = { x: wx(x0 - m), y: wx(y0 - m - 1), w: (x1 - x0 + 1 + m * 2) * T, h: (y1 - y0 + 1 + m * 2 + 1) * T };
  }

  /** Toạ độ màn hình (px CSS) của một điểm trong thế giới — để đặt chữ nổi, bong bóng DOM. */
  screenOf(worldX: number, worldY: number) {
    const cam = this.cameras.main;
    const rs = (this.registry.get('rs') as number) || 1;
    return { x: (worldX - cam.worldView.x) * cam.zoom * rs, y: (worldY - cam.worldView.y) * cam.zoom * rs };
  }
  /** Đỉnh phần có hình của công trình (toạ độ thế giới). */
  lvTop(k: LvKey) {
    const img = this.lvs[k];
    const b = texBox(this, img.texture.key);
    return img.y - (img.height - b.y) * img.scaleY;
  }
  lvAnchor(k: LvKey) {
    const img = this.lvs[k];
    return this.screenOf(img.x, this.lvTop(k));
  }

  private walkTo(tx: number, ty: number) {
    const x = wx(tx) + (this.an.x < wx(tx) + 8 ? -2 : 18);
    const y = wx(ty) + 15;
    this.an.setFlipX(x < this.an.x);
    const dist = Phaser.Math.Distance.Between(this.an.x, this.an.y, x, y);
    this.tweens.killTweensOf(this.an);
    this.tweens.add({ targets: this.an, x, y, duration: Math.min(900, dist * 9), ease: 'Linear' });
    this.store.net.setActivity('đang làm lụng trên đảo');
  }

  private tapNode(id: string) {
    const n = this.store.s.nodes.find((x) => x.id === id);
    if (!n) return;
    this.walkTo(n.x, n.y);
    const o = this.store.do({ t: 'gather', node: id });
    const img = this.nodes.get(id);
    const at = this.screenOf(wx(n.x) + 8, wx(n.y) - 4);
    if (!o.ok) {
      const left = Math.ceil((n.readyAt - this.store.s.gt) / 1000 / this.store.s.speed);
      this.ui.floatAt(at.x, at.y, `${NODES[n.kind].name}: còn ${left}s`, 'muted');
      return;
    }
    if (img) this.tweens.add({ targets: img, scaleY: 0.8 * Q, duration: 80, yoyo: true });
    this.ui.floatGains(at.x, at.y, o.gained ?? {});
    if (o.msg) this.ui.toast(o.msg);
    if (o.quest) this.ui.questDone(o.quest);
  }

  private tapChest(id: string) {
    const c = this.store.s.chests.find((x) => x.id === id);
    if (!c) return;
    this.walkTo(c.x, c.y);
    const img = this.chests.get(id);
    const at = this.screenOf(wx(c.x) + 8, wx(c.y));
    const o = this.store.do({ t: 'chest', id });
    if (!o.ok) return;
    if (img) {
      this.chests.delete(id);
      this.tweens.add({ targets: img, y: img.y - 10, alpha: 0, scale: 1.5 * Q, duration: 450, onComplete: () => img.destroy() });
    }
    this.ui.chestOpened(o, at);
    if (o.quest) this.ui.questDone(o.quest);
  }

  private tapGround(worldX: number, worldY: number) {
    const tx = Math.floor((worldX - PAD) / T);
    const ty = Math.floor((worldY - PAD) / T);
    if (this.placing) {
      const o = this.store.do({ t: 'xay', k: this.placing, x: tx, y: ty });
      this.ui.toast(o.msg, o.ok ? 'gold' : 'bad');
      if (o.ok) {
        this.walkTo(tx, ty);
        this.setPlacing(null);
      }
      return;
    }
    if (this.expandMode) {
      const o = this.store.do({ t: 'expand', x: tx, y: ty });
      const at = this.screenOf(wx(tx) + 8, wx(ty));
      if (o.ok) {
        this.walkTo(tx, ty);
        this.ui.floatAt(at.x, at.y, 'Đất mới!', 'good');
        this.ui.toggleExpand(true);
        if (o.quest) this.ui.questDone(o.quest);
        this.cameras.main.shake(120, 0.004);
      } else this.ui.toast(o.msg, 'bad');
      return;
    }
    if (isLand(this.store.s, tx, ty)) this.walkTo(tx, ty);
  }

  /** Rùa Vàng nằm ở ô nước sát bờ phía tây nam (đảo mỗi người một hình nên phải tìm chỗ). */
  private placeRua(s: PlayerState) {
    let best = { x: 9, y: 14 };
    let bd = Infinity;
    for (let y = 1; y < GRID - 1; y++)
      for (let x = 1; x < GRID - 1; x++) {
        if (isLand(s, x, y)) continue;
        if (!(isLand(s, x + 1, y) || isLand(s, x, y - 1) || isLand(s, x + 1, y - 1))) continue;
        const d = Math.hypot(x - 8, y - 15);
        if (d < bd) {
          bd = d;
          best = { x, y };
        }
      }
    const dock = dockPos(s);
    if (best.x === dock.x && best.y === dock.y) best = { x: best.x - 1, y: best.y };
    this.tweens.killTweensOf(this.rua);
    this.rua.setPosition(wx(best.x) + 8, wx(best.y) + 12).setDepth(wx(best.y));
    this.tweens.add({ targets: this.rua, y: this.rua.y + 1, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  /** Bật/tắt chế độ chọn ô đất để xây. */
  setPlacing(k: BKey | null) {
    this.placing = k;
    if (k) this.toggleExpand(false);
    this.drawPlace();
    this.ui.onPlacing(k);
  }
  private drawPlace() {
    const g = this.placeGfx;
    g.clear();
    if (!this.placing) return;
    const s = this.store.s;
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++) {
        if (!isLand(s, x, y) || occupied(s, x, y)) continue;
        g.fillStyle(0x7cff9a, 0.2).fillRect(wx(x) + 1, wx(y) + 1, T - 2, T - 2);
        g.lineStyle(1, 0x7cff9a, 0.85).strokeRect(wx(x) + 1.5, wx(y) + 1.5, T - 3, T - 3);
      }
  }

  /** Vẽ nhà cửa, thành trì; giàn giáo khi đang xây. */
  private syncDinh(s: PlayerState) {
    const seen = new Set<string>();
    for (const d of s.dinh) {
      seen.add(d.id);
      const key = dinhTex(this, d.k, Math.max(1, d.lv || d.to || 1));
      let v = this.dinhImgs.get(d.id);
      if (!v) {
        const img = this.add.image(wx(d.x) + 8, wx(d.y) + 15, key).setOrigin(0.5, 1).setDepth(wx(d.y) + 15).setScale(Q);
        img.setInteractive({ useHandCursor: true }).on('pointerup', () => !this.dragged && this.ui.openDinh(d.id));
        const scaf = this.add.image(img.x, img.y, ensureTex(this, 'scaf-16x24', () => drawScaffold(16, 24))).setOrigin(0.5, 1).setDepth(img.depth + 1).setScale(Q);
        v = { img, scaf, key };
        this.dinhImgs.set(d.id, v);
        if (this.time.now > 2000) this.tweens.add({ targets: img, scaleY: { from: 0, to: Q }, duration: 300, ease: 'Back.out' });
      }
      if (v.key !== key) {
        v.img.setTexture(key);
        v.key = key;
        this.cameras.main.flash(250, 255, 230, 140);
      }
      v.img.setAlpha(d.lv === 0 ? 0.45 : 1);
      v.scaf.setVisible(d.doneAt !== undefined);
    }
    for (const [id, v] of this.dinhImgs)
      if (!seen.has(id)) {
        v.img.destroy();
        v.scaf.destroy();
        this.dinhImgs.delete(id);
      }
    if (this.placing) this.drawPlace();
  }
  dinhAnchor(id: string) {
    const v = this.dinhImgs.get(id);
    return v ? this.screenOf(v.img.x, v.img.y - v.img.displayHeight) : { x: 0, y: 0 };
  }

  toggleExpand(on?: boolean) {
    this.expandMode = on ?? !this.expandMode;
    this.drawExpand();
    return this.expandMode;
  }

  private drawExpand() {
    const g = this.expandGfx;
    g.clear();
    if (!this.expandMode) return;
    const s = this.store.s;
    if (landCount(s) >= landCap(s)) return;
    for (let y = 1; y < GRID - 1; y++)
      for (let x = 1; x < GRID - 1; x++) {
        if (isLand(s, x, y)) continue;
        if (!(isLand(s, x + 1, y) || isLand(s, x - 1, y) || isLand(s, x, y + 1) || isLand(s, x, y - 1))) continue;
        g.fillStyle(0xf6d34d, 0.22).fillRect(wx(x) + 1, wx(y) + 1, T - 2, T - 2);
        g.lineStyle(1, 0xf6d34d, 0.9).strokeRect(wx(x) + 1.5, wx(y) + 1.5, T - 3, T - 3);
      }
  }

  private blinkTick() {
    const now = this.time.now;
    for (const k of LV_KEYS) {
      if (now > this.blinkUntil[k] + 2500 && Math.random() < 0.18) this.blinkUntil[k] = now + 160;
    }
    this.syncLv();
  }

  private syncLv() {
    const s = this.store.s;
    const now = this.time.now;
    for (const k of LV_KEYS) {
      if (k === 'thuyen' && s.voyage) continue;
      const l = s.lv[k];
      const blink = now < this.blinkUntil[k];
      const key = lvTex(this, k, l.tier, blink, l.mood);
      if (this.lvs[k].texture.key !== key) {
        this.lvs[k].setTexture(key);
        const b = texBox(this, key);
        (this.lvs[k].input!.hitArea as Phaser.Geom.Rectangle).setTo(b.x, b.y, b.w, b.h);
      }
      const emo = l.mood === 'vui' ? 'emo-vui' : l.mood === 'doi' ? 'emo-doi' : l.hunger > 60 ? 'emo-doi_bung' : '';
      const e = this.emotes[k];
      e.setVisible(!!emo);
      if (emo && e.texture.key !== emo) e.setTexture(emo);
      e.setPosition(this.lvs[k].x + 6, this.lvTop(k) - 3 + Math.round(Math.sin(now / 300 + k.length)));
    }
    for (const k of LV_KEYS) {
      const b = s.builds.find((x) => x.lv === k);
      const sc = this.scaffolds[k];
      const img = this.lvs[k];
      sc.setVisible(!!b && img.visible).setPosition(img.x, img.y).setDepth(img.depth + 1);
      if (b) this.emotes[k].setVisible(false);
    }
  }

  /** Đồng hồ đếm ngược trên mỗi công trình đang xây (chữ DOM cho sắc nét). */
  private updateBuildLabels(time: number) {
    const s = this.store.s;
    const box = document.getElementById('buildlabels');
    if (!box) return;
    const active = new Set<string>([...s.builds.map((b) => b.lv), ...s.dinh.filter((d) => d.doneAt !== undefined).map((d) => d.id)]);
    for (const [k, el] of this.buildLabels)
      if (!active.has(k)) {
        el.remove();
        this.buildLabels.delete(k);
      }
    if (!active.size) return;
    const gtNow = s.gt + (Date.now() - s.lastReal) * s.speed;
    const writeText = time - this.lastBuildText > 250;
    if (writeText) this.lastBuildText = time;
    const jobs = [
      ...s.builds.map((b) => ({ key: b.lv as string, start: b.start, end: b.end, name: LINH_VAT[b.lv].tiers[b.to - 1], at: () => this.screenOf(this.lvs[b.lv].x, this.lvTop(b.lv) - 2) })),
      ...s.dinh.filter((d) => d.doneAt !== undefined).map((d) => ({ key: d.id, start: d.doneAt! - BUILDINGS[d.k].ms[(d.to ?? 1) - 1], end: d.doneAt!, name: BUILDINGS[d.k].names[(d.to ?? 1) - 1], at: () => this.dinhAnchor(d.id) })),
    ];
    for (const b of jobs) {
      let el = this.buildLabels.get(b.key);
      if (!el) {
        el = document.createElement('div');
        el.className = 'blabel';
        el.innerHTML = '<b></b><i><span></span></i>';
        box.appendChild(el);
        this.buildLabels.set(b.key, el);
      }
      const p = b.at();
      el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
      if (writeText) {
        const left = Math.max(0, Math.ceil((b.end - gtNow) / 1000 / s.speed));
        const mm = left >= 3600 ? `${Math.floor(left / 3600)}:${String(Math.floor((left % 3600) / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}` : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
        el.querySelector('b')!.textContent = `Xây ${b.name} · ${mm}`;
        (el.querySelector('span') as HTMLElement).style.width = `${Math.min(100, Math.round(((gtNow - b.start) / (b.end - b.start)) * 100))}%`;
      }
    }
  }

  sync() {
    const s: PlayerState = this.store.s;
    if (s.land !== this.landKey) {
      // nước + đảo gộp thành một ảnh duy nhất cho mỗi khung sóng → chỉ một lớp phủ kín màn hình
      const prev = this.islandVer;
      const ver = ++this.islandVer;
      const isl = drawIsland(s.land, hashStr(s.id), HD);
      for (const f of [0, 1]) {
        const c = document.createElement('canvas');
        c.width = WORLD * HD;
        c.height = WORLD * HD;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(this.textures.get(waterTex(this, WORLD, WORLD, f)).getSourceImage() as HTMLCanvasElement, 0, 0);
        ctx.drawImage(isl, PAD * HD, PAD * HD);
        this.textures.addCanvas(`iw${f}-${ver}`, c);
      }
      this.water.setTexture(`iw${this.waterF}-${ver}`);
      if (prev) for (const f of [0, 1]) this.textures.remove(`iw${f}-${prev}`);
      this.landKey = s.land;
      this.updateBounds(s);
      this.drawExpand();
      this.placeRua(s);
    }
    const avKey = avatarTex(this, s.avatar);
    if (this.an.texture.key !== avKey) this.an.setTexture(avKey);
    const dock = dockPos(s);
    const dk = `${dock.x},${dock.y}`;
    if (dk !== this.dockKey) {
      this.dockKey = dk;
      this.lvs.thuyen.setPosition(wx(dock.x) + 8, wx(dock.y) + 14).setDepth(wx(dock.y) + 14);
    }
    const atSea = !!s.voyage;
    this.lvs.thuyen.setVisible(!atSea);
    if (atSea) this.emotes.thuyen.setVisible(false);
    // điểm tài nguyên
    const seen = new Set<string>();
    for (const n of s.nodes) {
      seen.add(n.id);
      let img = this.nodes.get(n.id);
      if (!img) {
        img = this.add.image(wx(n.x) + 8, wx(n.y) + 15, `node-${n.kind}`).setOrigin(0.5, 1).setDepth(wx(n.y) + 14).setScale(Q);
        const tall = n.kind === 'palm' ? new Phaser.Geom.Rectangle(1 * HD, 8 * HD, 14 * HD, 24 * HD) : n.kind === 'bamboo' ? new Phaser.Geom.Rectangle(1 * HD, 4 * HD, 14 * HD, 20 * HD) : new Phaser.Geom.Rectangle(0, 0, 16 * HD, 16 * HD);
        img.setInteractive({ hitArea: tall, hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true }).on('pointerup', () => !this.dragged && this.tapNode(n.id));
        this.nodes.set(n.id, img);
        if (this.time.now > 2000) this.tweens.add({ targets: img, scaleY: { from: 0, to: Q }, duration: 300, ease: 'Back.out' });
      }
      const ready = s.gt >= n.readyAt;
      const a = ready ? 1 : 0.38;
      if (img.alpha !== a) {
        if (ready && img.alpha < 1) this.tweens.add({ targets: img, scaleY: { from: 0.6 * Q, to: Q }, duration: 250, ease: 'Back.out' });
        img.setAlpha(a);
      }
    }
    for (const [id, img] of this.nodes) if (!seen.has(id)) (img.destroy(), this.nodes.delete(id));
    // hòm
    const seenC = new Set<string>();
    for (const c of s.chests) {
      seenC.add(c.id);
      if (this.chests.has(c.id)) continue;
      const img = this.add.image(wx(c.x) + 8, wx(c.y) + 14, `chest-${c.ci}`).setOrigin(0.5, 1).setDepth(wx(c.y) + 14).setScale(Q);
      img.setInteractive({ useHandCursor: true }).on('pointerup', () => !this.dragged && this.tapChest(c.id));
      this.tweens.add({ targets: img, y: img.y - 2, duration: 700 + c.ci * 40, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      if (this.time.now > 2000) this.tweens.add({ targets: img, alpha: { from: 0, to: 1 }, duration: 600 });
      this.chests.set(c.id, img);
    }
    for (const [id, img] of this.chests) if (!seenC.has(id)) (img.destroy(), this.chests.delete(id));
    this.syncLv();
    this.syncDinh(s);
  }

  /** Chỗ mũi tên hướng dẫn cần chỉ (toạ độ thế giới) theo nhiệm vụ hiện tại. */
  private guideAt(): { x: number; y: number } | null {
    const s = this.store.s;
    const q = currentQuest(s);
    if (!q || this.expandMode) return null;
    const node = (kind: string) => {
      const n = s.nodes.find((x) => x.kind === kind && s.gt >= x.readyAt) ?? s.nodes.find((x) => x.kind === kind);
      const img = n && this.nodes.get(n.id);
      return img ? { x: img.x, y: img.y - img.displayHeight } : null;
    };
    const lv = (k: LvKey) => (this.lvs[k].visible ? { x: this.lvs[k].x, y: this.lvTop(k) } : null);
    switch (q.id) {
      case 'q_gather':
        return node('grass');
      case 'q_listen':
      case 'q_feed':
      case 'q_evolve':
        return lv('leu');
      case 'q_cuoc':
        return s.res.sat > 0 ? lv('cuoc') : node('scrap');
      case 'q_chest': {
        const img = [...this.chests.values()][0];
        return img ? { x: img.x, y: img.y - img.displayHeight } : null;
      }
      case 'q_boat':
        return lv('thuyen');
    }
    return null;
  }

  update(time: number) {
    this.halo.setVisible(this.store.s.asc > 0);
    if (this.halo.visible) this.halo.setPosition(this.an.x, this.an.y - this.an.displayHeight + 1 + Math.round(Math.sin(time / 400))).setDepth(this.an.depth + 1);
    const g = this.guideAt();
    this.guide.setVisible(!!g);
    if (g) this.guide.setPosition(g.x, g.y - 2 - Math.round(Math.abs(Math.sin(time / 260)) * 4));
    this.ctl.clamp();
    this.updateBuildLabels(time);
    this.an.setDepth(this.an.y);
    if (time - this.lastSlow > 120) {
      this.lastSlow = time;
      this.ui.updateBubble();
    }
  }
}

/** Mũi tên vàng nhỏ chỉ xuống. */
function drawGuideArrow() {
  const [c, ctx] = canvas(11, 12);
  const p = new Pen(ctx);
  p.rect(3, 0, 5, 6, 'k');
  p.poly([[0, 5], [11, 5], [5.5, 12]], 'k');
  p.rect(4, 1, 3, 5, 'l');
  p.poly([[2, 6], [9, 6], [5.5, 10]], 'l');
  p.px(4, 1, 'i');
  p.px(4, 2, 'i');
  return c;
}

/** Vầng hào quang tiên nhân. */
function drawHalo() {
  const [c, ctx] = canvas(12, 4);
  const p = new Pen(ctx);
  p.ellipse(6, 2, 5, 1, 'l', false);
  p.hline(2, 9, 0, 'l');
  p.hline(2, 9, 3, 'L');
  p.px(1, 1, 'l');
  p.px(10, 1, 'l');
  p.px(1, 2, 'L');
  p.px(10, 2, 'L');
  return c;
}
