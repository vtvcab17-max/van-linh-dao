import Phaser from 'phaser';
import { SKILLS } from '../../../shared/data';
import type { BattleResult, BEvent, BUnit } from '../../../shared/battle';
import { drawBattleBg } from '../art/sprites';
import { avatarTex, ensureTex, HD } from '../art/textures';
import { avatarFrom } from '../../../shared/avatar';
import { pubAvatar } from '../ui';
import type { Store } from '../store';
import { zoomFor } from './IslandScene';
import type { UI } from '../ui';

interface UnitView {
  u: BUnit;
  img: Phaser.GameObjects.Image;
  bar: Phaser.GameObjects.Graphics;
  hp: number;
  x: number;
  y: number;
}

export interface BattleData {
  battle: BattleResult;
  title: string;
  onDone: () => void;
}

export class BattleScene extends Phaser.Scene {
  private views = new Map<string, UnitView>();
  private data0!: BattleData;
  private idx = 0;
  private speed = 1;
  private done = false;
  private W = 240;
  private H = 135;
  private res = 1;
  private ui!: UI;
  private rs = 1;
  private z = 3;

  constructor() {
    super('battle');
  }

  init(d: BattleData) {
    this.data0 = d;
    this.idx = 0;
    this.speed = 1;
    this.done = false;
    this.views.clear();
  }

  create() {
    const rs = (this.registry.get('rs') as number) || 1;
    this.ui = this.registry.get('ui');
    this.rs = rs;
    const z = zoomFor(this.scale.width, this.scale.height, rs);
    this.z = z;
    const cam = this.cameras.main;
    cam.setZoom(z);
    this.W = Math.ceil(this.scale.width / z);
    this.H = Math.ceil(this.scale.height / z);
    cam.centerOn(this.W / 2, this.H / 2);
    this.res = z * rs * (window.devicePixelRatio || 1);
    const bgKey = `bbg-${this.W}x${this.H}`;
    ensureTex(this, bgKey, () => drawBattleBg(this.W, this.H));
    this.add.image(0, 0, bgKey).setOrigin(0).setScale(1 / HD);
    const b = this.data0.battle;
    this.layout(b.a, 0);
    this.layout(b.b, 1);
    this.input.on('pointerup', () => (this.speed = this.speed === 1 ? 3 : 1));
    this.time.delayedCall(450, () => this.next());
  }

  skip() {
    this.speed = 50;
  }

  private layout(units: BUnit[], side: 0 | 1) {
    const mid = this.W / 2;
    const groundY = Math.round(this.H * 0.62);
    const front = units.filter((u) => u.row === 'front');
    const back = units.filter((u) => u.row === 'back');
    const place = (list: BUnit[], dx: number) =>
      list.forEach((u, i) => {
        const x = Math.round(mid + (side === 0 ? -dx : dx));
        const y = Math.round(groundY + 14 + i * 20 - (list.length - 1) * 10);
        const key = u.key === 'an' ? this.heroTex(u, side) : u.key === 'cuada' ? 'ch-cuada' : `ch-${u.key}`;
        const img = this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(y).setScale(1 / HD);
        if (side === 1 && !u.wall) img.setFlipX(true);
        const bar = this.add.graphics().setDepth(1000);
        const v: UnitView = { u, img, bar, hp: u.hp, x, y };
        this.views.set(u.id, v);
        this.drawBar(v);
        this.tweens.add({ targets: img, y: y - 1, duration: 500 + i * 70, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      });
    place(front, Math.min(40, this.W * 0.16));
    place(back, Math.min(78, this.W * 0.3));
  }

  /** Chủ đảo ra trận bằng đúng nhân vật người chơi đã chỉnh (bên mình và bên đảo bị đánh). */
  private heroTex(u: BUnit, side: 0 | 1): string {
    const store = this.registry.get('store') as Store;
    if (side === 0) return avatarTex(this, store.s.avatar);
    const p = store.net.islands().find((x) => x.name === u.name);
    return avatarTex(this, p ? pubAvatar(p) : avatarFrom(u.name));
  }

  private drawBar(v: UnitView) {
    const w = 16;
    const x = v.x - w / 2;
    const y = v.y - v.img.displayHeight - 4;
    v.bar.clear();
    v.bar.fillStyle(0x1d1b2a, 1).fillRect(x - 1, y - 1, w + 2, 4);
    const pct = Math.max(0, v.hp / v.u.maxHp);
    v.bar.fillStyle(pct > 0.5 ? 0x7cc35a : pct > 0.25 ? 0xf6d34d : 0xdc4a3e, 1).fillRect(x, y, Math.round(w * pct), 2);
  }

  private pop(x: number, y: number, text: string, color: string, size = 10) {
    const cam = this.cameras.main;
    const k = this.z * this.rs;
    this.ui.floatAt((x - cam.worldView.x) * k, (y - cam.worldView.y) * k, text, '', undefined, color, Math.round(size * 2.1));
  }

  private next() {
    const ev = this.data0.battle.events[this.idx++];
    if (!ev) return this.finish();
    const wait = this.play(ev);
    this.time.delayedCall(Math.max(10, wait / this.speed), () => this.next());
  }

  private play(ev: BEvent): number {
    const a = this.views.get(ev.a);
    if (!a) return 0;
    const dir = a.u.side === 0 ? 1 : -1;
    switch (ev.k) {
      case 'hit':
      case 'skill': {
        if (ev.s) this.pop(a.x, a.y - a.img.displayHeight - 6, SKILLS[ev.s].name, '#f6d34d', 9);
        this.tweens.add({ targets: a.img, x: a.x + 10 * dir, duration: 90 / Math.min(this.speed, 3), yoyo: true });
        (ev.t ?? []).forEach((tid, i) => {
          const t = this.views.get(tid);
          if (!t) return;
          if (ev.s === 'samset') {
            const g = this.add.graphics().setDepth(1500);
            g.lineStyle(1, 0xf6d34d, 1).lineBetween(a.x, a.y - 10, t.x, t.y - 8);
            this.time.delayedCall(160, () => g.destroy());
          }
          t.hp = Math.max(0, t.hp - (ev.v?.[i] ?? 0));
          this.drawBar(t);
          t.img.setTintFill(0xffffff);
          this.time.delayedCall(70, () => t.img.clearTint());
          this.tweens.add({ targets: t.img, x: t.x + 2 * dir, duration: 40, yoyo: true, repeat: 1 });
          this.pop(t.x, t.y - t.img.displayHeight, `${ev.crit ? 'BẠO ' : ''}-${ev.v?.[i] ?? 0}`, ev.crit ? '#ff9b3a' : '#ffffff', ev.crit ? 12 : 10);
        });
        return 420;
      }
      case 'thorns': {
        const t = this.views.get(ev.t?.[0] ?? '');
        if (t) {
          t.hp = Math.max(0, t.hp - (ev.v?.[0] ?? 0));
          this.drawBar(t);
          this.pop(t.x, t.y - t.img.displayHeight + 4, `gai -${ev.v?.[0]}`, '#a6d86e', 8);
        }
        return 200;
      }
      case 'heal': {
        const t = this.views.get(ev.t?.[0] ?? '');
        this.pop(a.x, a.y - a.img.displayHeight - 6, SKILLS.lalanh.name, '#a6d86e', 9);
        if (t) {
          t.hp = Math.min(t.u.maxHp, t.hp + (ev.v?.[0] ?? 0));
          this.drawBar(t);
          this.pop(t.x, t.y - t.img.displayHeight, `+${ev.v?.[0]}`, '#7cff9a', 11);
          t.img.setTint(0x9dff9d);
          this.time.delayedCall(220, () => t.img.clearTint());
        }
        return 420;
      }
      case 'buff': {
        if (ev.s) this.pop(a.x, a.y - a.img.displayHeight - 6, SKILLS[ev.s].name, '#f6d34d', 10);
        for (const id of ev.t ?? []) {
          const t = this.views.get(id);
          if (!t) continue;
          t.img.setTint(0xffe27a);
          this.time.delayedCall(260, () => t.img.clearTint());
        }
        return 420;
      }
      case 'dot': {
        a.hp = Math.max(0, a.hp - (ev.v?.[0] ?? 0));
        this.drawBar(a);
        this.pop(a.x, a.y - a.img.displayHeight, `-${ev.v?.[0]}`, '#ff8a5a', 9);
        a.img.setTint(0xff9a6a);
        this.time.delayedCall(160, () => a.img.clearTint());
        return 260;
      }
      case 'die': {
        a.hp = 0;
        this.drawBar(a);
        this.tweens.add({ targets: a.img, alpha: 0.15, angle: 90 * dir * -1, y: a.y + 2, duration: 350 });
        return 300;
      }
    }
    return 100;
  }

  private finish() {
    if (this.done) return;
    this.done = true;
    const win = this.data0.battle.winner === 0;
    this.ui.banner(win ? 'THẮNG' : 'THUA', win);
    this.time.delayedCall(700, () => this.data0.onDone());
  }
}
