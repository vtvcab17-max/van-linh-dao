import Phaser from 'phaser';
import { GRID, LINH_VAT, LV_KEYS, NODES, type LvKey } from '../../../shared/data';
import { currentQuest, dockPos, isLand, landCount, landCap, LV_POS, type PlayerState } from '../../../shared/logic';
import { canvas, Pen } from '../art/pixel';
import { CamCtl } from './camctl';
import { drawIsland, drawScaffold, LV_SIZE } from '../art/sprites';
import { avatarTex, dinhTex, ensureTex, HD, lvTex, preloadAll, texBox, waterTex } from '../art/textures';
import { BUILDINGS, type BKey } from '../../../shared/economy';
import { occupied } from '../../../shared/logic';
import { drawUnit, GENERALS as GEN_LOOKS, TROOP_OF, TROOPS } from '../art2/units';
import { drawBoat } from '../art2/builds';

/** Hình vẽ chi tiết gấp HD lần nên thu lại cho đúng kích thước trong thế giới. */
const Q = 1 / HD;
import { hashStr } from '../../../shared/rng';
import type { Store } from '../store';
import type { UI } from '../ui';
import { sound } from '../audio';

export const T = 16;
export const PAD = 160;
const WORLD = GRID * T + PAD * 2;
const wx = (tx: number) => PAD + tx * T;
/** Chân người/lính (bộ chibi mới) đứng sát đáy ô; nhà cửa thấp hơn một chút cho có bóng. */
const FOOT = 18;
const DINH_FOOT = 17;
/** Nhà cửa thu nhỏ cho vừa khít đúng một ô (hình vẽ rộng 22 điểm ảnh, ô rộng 16). */
const DS = 16 / 22;

/** Mức phóng to camera theo kích thước khung game (đã chia cho hệ số vẽ rs). */
export function zoomFor(w: number, h: number, rs = 1) {
  // thấy trọn hòn đảo cùng nhà cửa, lính tráng (khoảng 9 ô ngang, 15 ô dọc)
  const z = Math.min((w * rs) / (T * 9), (h * rs) / (T * 15)) / rs;
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
    this.gridGfx = this.add.graphics().setDepth(1);
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
    // nhân vật chủ đảo (nam/nữ); chỉ đi theo ô vuông, chạm vào không mở gì cả
    this.an = this.add.image(wx(11) + 8, wx(12) + FOOT, avatarTex(this, this.store.s.avatar)).setOrigin(0.5, 1).setScale(Q);
    this.time.addEvent({ delay: 1800, loop: true, callback: () => this.wanderTroop() });
    // bóng mờ nhân vật hiện xuyên qua nhà/cây khi đứng khuất phía sau
    this.anGhost = this.add.image(this.an.x, this.an.y, this.an.texture.key).setOrigin(0.5, 1).setScale(Q).setAlpha(0.5).setDepth(4500).setVisible(false);
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

  /** Ô lưới hiện tại của nhân vật. */
  private cellOf() {
    return { x: Math.round((this.an.x - PAD - 8) / T), y: Math.round((this.an.y - PAD - FOOT) / T) };
  }
  private walkable(tx: number, ty: number) {
    const s = this.store.s;
    return isLand(s, tx, ty) && !occupied(s, tx, ty);
  }
  /** Tìm đường ngắn nhất theo ô vuông (4 hướng) tới ô đích hoặc ô trống sát đích. */
  private pathTo(tx: number, ty: number): { x: number; y: number }[] | null {
    const from = this.cellOf();
    const goal = (x: number, y: number) => (x === tx && y === ty) || (!this.walkable(tx, ty) && Math.abs(x - tx) + Math.abs(y - ty) === 1);
    const key = (x: number, y: number) => y * GRID + x;
    const prev = new Map<number, number>();
    const q: { x: number; y: number }[] = [from];
    prev.set(key(from.x, from.y), -1);
    let end: { x: number; y: number } | null = goal(from.x, from.y) && this.walkable(from.x, from.y) ? from : null;
    for (let i = 0; i < q.length && !end; i++) {
      const c = q[i];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = c.x + dx, ny = c.y + dy;
        if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID || prev.has(key(nx, ny)) || !this.walkable(nx, ny)) continue;
        prev.set(key(nx, ny), key(c.x, c.y));
        q.push({ x: nx, y: ny });
        if (goal(nx, ny)) {
          end = { x: nx, y: ny };
          break;
        }
      }
    }
    if (!end) return null;
    const out: { x: number; y: number }[] = [];
    for (let k = key(end.x, end.y); k !== -1; k = prev.get(k)!) out.unshift({ x: k % GRID, y: Math.floor(k / GRID) });
    out.shift();
    return out;
  }
  private walkChain: Phaser.Tweens.TweenChain | null = null;
  private walkTo(tx: number, ty: number) {
    const path = this.pathTo(tx, ty);
    this.store.net.setActivity('đang làm lụng trên đảo');
    this.walkChain?.stop();
    this.tweens.killTweensOf(this.an);
    // đang đi dở thì dừng ở giữa ô: kéo về ô gần nhất cho khỏi lệch lưới
    const c0 = this.cellOf();
    this.an.setPosition(wx(c0.x) + 8, wx(c0.y) + FOOT);
    if (!path || !path.length) return;
    // đi từng ô, mỗi ô một nhịp, không cắt chéo
    this.walkChain = this.tweens.chain({
      targets: this.an,
      tweens: path.map((c) => ({
        x: wx(c.x) + 8,
        y: wx(c.y) + FOOT,
        duration: 150,
        ease: 'Linear',
        onStart: () => this.an.setFlipX(wx(c.x) + 8 < this.an.x),
      })),
    });
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
        sound.play('expand');
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
        const img = this.add.image(wx(d.x) + 8, wx(d.y) + DINH_FOOT, key).setOrigin(0.5, 1).setDepth(wx(d.y) + 15).setScale(Q * DS);
        // vùng chạm khít phần có hình, không lấn sang ô bên cạnh
        img.setInteractive({ hitArea: new Phaser.Geom.Rectangle(0, 0, 1, 1), hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true }).on('pointerup', () => !this.dragged && this.ui.openDinh(d.id));
        this.fitHit(img);
        const scaf = this.add.image(img.x, img.y, ensureTex(this, 'scaf-16x24', () => drawScaffold(16, 24))).setOrigin(0.5, 1).setDepth(img.depth + 1).setScale(Q);
        v = { img, scaf, key };
        this.dinhImgs.set(d.id, v);
        if (this.time.now > 2000) {
          this.tweens.add({ targets: img, scaleY: { from: 0, to: Q * DS }, duration: 300, ease: 'Back.out' });
          sound.play('build');
        }
      }
      if (v.key !== key) {
        sound.play('levelup');
        v.img.setTexture(key);
        this.fitHit(v.img);
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

  /** Lưới ô nhạt trên đất (kiểu bàn cờ) cho dễ thấy từng ô. */
  private gridGfx!: Phaser.GameObjects.Graphics;
  private drawGrid() {
    const g = this.gridGfx;
    g.clear();
    const s = this.store.s;
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++) {
        if (!isLand(s, x, y)) continue;
        const inner = isLand(s, x + 1, y) && isLand(s, x - 1, y) && isLand(s, x, y + 1) && isLand(s, x, y - 1);
        if (!inner) continue;
        g.fillStyle((x + y) % 2 ? 0xffffe6 : 0x285014, (x + y) % 2 ? 0.08 : 0.05).fillRect(wx(x), wx(y), T, T);
      }
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
      this.drawGrid();
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
    this.syncTroops(s);
    this.syncFleet(s);
  }

  private fitHit(img: Phaser.GameObjects.Image) {
    const b = texBox(this, img.texture.key);
    (img.input!.hitArea as Phaser.Geom.Rectangle).setTo(b.x, b.y, b.w, b.h);
  }

  // ---------------- quân đồn trú: tướng chủ lực và lính chibi đứng quanh nhà ----------------
  private troops: { img: Phaser.GameObjects.Image; x: number; y: number }[] = [];
  private troopKey = '';
  private syncTroops(s: PlayerState) {
    const keys: string[] = [];
    const gl = s.chuTuong ? GEN_LOOKS.find((g) => g.id === s.chuTuong) : undefined;
    if (gl) keys.push(ensureTex(this, `gen-${gl.id}`, () => drawUnit(gl.look)));
    const types = (Object.keys(s.comps) as (keyof typeof s.comps)[]).filter((k) => s.comps[k].unlocked).map((k) => TROOP_OF[k] ?? 'danbinh');
    const don = s.dinh.filter((d) => d.k === 'donbinh').reduce((a, d) => a + (d.lv || 0), 0);
    const n = Math.min(8, Math.max(1, types.length) + don * 2);
    for (let i = 0; i < n; i++) {
      const t = types[i % Math.max(1, types.length)] ?? 'danbinh';
      const def = TROOPS.find((x) => x.id === t) ?? TROOPS[0];
      keys.push(ensureTex(this, `troop-${def.id}`, () => drawUnit(def.look)));
    }
    const key = `${keys.join(',')}|${s.land}|${s.dinh.map((d) => `${d.x},${d.y}`).join(';')}|${s.nodes.length}`;
    if (key === this.troopKey) return;
    this.troopKey = key;
    for (const t of this.troops) t.img.destroy();
    this.troops = [];
    // ô trống gần nhà Lều, lan dần ra (cách một ô cho thoáng)
    const me = this.cellOf();
    const start = LV_POS.leu;
    const seen = new Set<number>([start.y * GRID + start.x]);
    const q = [start];
    const free: { x: number; y: number }[] = [];
    for (let i = 0; i < q.length && free.length < keys.length * 2 + 2; i++) {
      const c = q[i];
      if (this.standable(c.x, c.y, false) && Math.abs(c.x - me.x) + Math.abs(c.y - me.y) > 1) free.push(c);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = c.x + dx, ny = c.y + dy;
        if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID || seen.has(ny * GRID + nx) || !isLand(s, nx, ny)) continue;
        seen.add(ny * GRID + nx);
        q.push({ x: nx, y: ny });
      }
    }
    // ưu tiên ô trong đảo; đảo nhỏ quá thì mới cho đứng sát bờ
    const inner = free.filter((c) => this.standable(c.x, c.y));
    const edge = free.filter((c) => !inner.includes(c));
    const spots = [...inner.filter((_, i) => i % 2 === 1), ...inner.filter((_, i) => i % 2 === 0), ...edge];
    keys.forEach((tk, i) => {
      const c = spots[i];
      if (!c) return;
      const img = this.add.image(wx(c.x) + 8, wx(c.y) + FOOT, tk).setOrigin(0.5, 1).setScale(Q).setDepth(wx(c.y) + FOOT);
      img.setFlipX(((c.x * 7 + c.y * 3) & 1) === 1);
      this.troops.push({ img, x: c.x, y: c.y });
    });
  }
  /** Phần có hình của một ảnh (toạ độ thế giới), bỏ phần trong suốt. */
  private solidRect(img: Phaser.GameObjects.Image) {
    const b = texBox(this, img.texture.key);
    const sx = img.scaleX, sy = img.scaleY;
    return { x: img.x - img.width * img.originX * sx + b.x * sx, y: img.y - img.height * img.originY * sy + b.y * sy, w: b.w * sx, h: b.h * sy, d: img.depth };
  }
  /** Những hình cao có thể che người đứng phía sau (nhà, linh vật, cây). */
  private occluders() {
    const out: Phaser.GameObjects.Image[] = [];
    for (const k of LV_KEYS) if (this.lvs[k].visible) out.push(this.lvs[k]);
    for (const v of this.dinhImgs.values()) out.push(v.img);
    for (const img of this.nodes.values()) if (img.height > 18 * HD) out.push(img);
    return out;
  }
  /** Điểm (x, y) có bị một hình đứng trước (sâu hơn `depth`) che không. */
  private covered(x: number, y: number, depth: number) {
    return this.occluders().some((img) => {
      if (img.depth <= depth) return false;
      const r = this.solidRect(img);
      return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    });
  }
  /** Ô lính đứng được: đất trong (không sát mép biển), trống, không bị nhà hay cây che khuất. */
  private standable(tx: number, ty: number, innerOnly = true) {
    const s = this.store.s;
    if (!this.walkable(tx, ty)) return false;
    if (innerOnly && !(isLand(s, tx + 1, ty) && isLand(s, tx - 1, ty) && isLand(s, tx, ty + 1) && isLand(s, tx, ty - 1))) return false;
    const x = wx(tx) + 8, foot = wx(ty) + FOOT;
    return !this.covered(x, foot - 4, foot) && !this.covered(x, foot - 16, foot);
  }

  /** Thỉnh thoảng một người lính bước sang ô bên cạnh cho đảo có sức sống. */
  private wanderTroop() {
    if (!this.troops.length) return;
    const t = this.troops[Math.floor(Math.random() * this.troops.length)];
    const me = this.cellOf();
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].sort(() => Math.random() - 0.5);
    for (const [dx, dy] of dirs) {
      const nx = t.x + dx, ny = t.y + dy;
      if (!this.standable(nx, ny) || (nx === me.x && ny === me.y) || this.troops.some((o) => o.x === nx && o.y === ny)) continue;
      // không đi xa chỗ đóng quân quá 3 ô
      if (Math.abs(nx - LV_POS.leu.x) + Math.abs(ny - LV_POS.leu.y) > 6) continue;
      t.x = nx;
      t.y = ny;
      if (dx) t.img.setFlipX(dx < 0);
      this.tweens.add({ targets: t.img, x: wx(nx) + 8, y: wx(ny) + FOOT, duration: 320, ease: 'Linear', onUpdate: () => t.img.setDepth(t.img.y) });
      return;
    }
    // không có chỗ đi thì quay mặt
    t.img.setFlipX(!t.img.flipX);
  }

  // ---------------- chiến thuyền neo quanh bến ----------------
  private boats: Phaser.GameObjects.Image[] = [];
  private boatKey = '';
  private syncFleet(s: PlayerState) {
    const ships = s.voyage ? [] : s.fleet;
    const key = `${ships.map((x) => `${x.k}${x.w.no ? 'n' : ''}${x.w.da ? 'd' : ''}${x.w.dam ? 'm' : ''}`).join(',')}|${s.land}`;
    if (key === this.boatKey) return;
    this.boatKey = key;
    for (const b of this.boats) b.destroy();
    this.boats = [];
    if (!ships.length) return;
    const dock = dockPos(s);
    const rua = { x: Math.floor((this.rua.x - PAD) / T), y: Math.floor((this.rua.y - PAD) / T) };
    // ô nước sát bờ quanh bến, mỗi thuyền cách nhau ít nhất 3 ô
    const cands: { x: number; y: number; d: number }[] = [];
    for (let y = 1; y < GRID - 1; y++)
      for (let x = 1; x < GRID - 1; x++) {
        if (isLand(s, x, y) || (x === dock.x && y === dock.y) || (x === rua.x && y === rua.y)) continue;
        // thuyền cao hơn 2 ô, rộng 3 ô: cần khoảng nước trống phía trên và hai bên để không đè lên đảo
        let near = false, blocked = false;
        for (let oy = -3; oy <= 3 && !near; oy++) for (let ox = -3; ox <= 3 && !near; ox++) near = isLand(s, x + ox, y + oy);
        for (let oy = -2; oy <= 0 && !blocked; oy++) for (let ox = -2; ox <= 2 && !blocked; ox++) blocked = isLand(s, x + ox, y + oy);
        if (!near || blocked) continue;
        cands.push({ x, y, d: Math.hypot(x - dock.x, y - dock.y) });
      }
    cands.sort((a, b) => a.d - b.d);
    const used: { x: number; y: number }[] = [dock];
    ships.forEach((sh, i) => {
      const c = cands.find((p) => used.every((u) => Math.abs(u.x - p.x) + Math.abs(u.y - p.y) >= 3));
      if (!c) return;
      used.push(c);
      const g = { no: !!sh.w.no, da: !!sh.w.da, dam: !!sh.w.dam };
      const tk = ensureTex(this, `fleet-${sh.k}${g.no ? 'n' : ''}${g.da ? 'd' : ''}${g.dam ? 'm' : ''}`, () => drawBoat(sh.k, g));
      const img = this.add.image(wx(c.x) + 8, wx(c.y) + 14, tk).setOrigin(0.5, 1).setScale(Q).setDepth(wx(c.y) + 14);
      // mũi thuyền hướng ra biển
      img.setFlipX(isLand(s, c.x + 1, c.y) || isLand(s, c.x + 2, c.y));
      img.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        if (this.dragged) return;
        const by = s.dinh.find((d) => d.k === 'benthuyen');
        if (by) this.ui.openDinh(by.id);
      });
      this.tweens.add({ targets: img, y: img.y + 1, angle: { from: -1.5, to: 1.5 }, duration: 1100 + i * 170, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.boats.push(img);
    });
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

  private anGhost!: Phaser.GameObjects.Image;
  update(time: number) {
    if (this.anGhost.texture.key !== this.an.texture.key) this.anGhost.setTexture(this.an.texture.key);
    this.anGhost.setPosition(this.an.x, this.an.y).setFlipX(this.an.flipX);
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
      this.anGhost.setVisible(this.covered(this.an.x, this.an.y - 8, this.an.depth) || this.covered(this.an.x, this.an.y - 18, this.an.depth));
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
