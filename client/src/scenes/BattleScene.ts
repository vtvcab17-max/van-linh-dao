// Trận đánh trên bàn cờ ô vuông: mỗi tướng/đồng đội dẫn một toán lính, xông qua từng ô chém nhau.
// Trận giữa hai người chơi phải xem hết (không tua, không bỏ qua); đánh quái thì được tua.
import Phaser from 'phaser';
import { SKILLS } from '../../../shared/data';
import type { BattleResult, BEvent, BUnit } from '../../../shared/battle';
import { charCanvas, drawBattleBg } from '../art/sprites';
import { isRandKey } from '../../../shared/monstergen';
import { avatarTex, ensureTex, HD } from '../art/textures';
import { avatarFrom } from '../../../shared/avatar';
import { pubAvatar } from '../ui';
import type { Store } from '../store';
import { zoomFor } from './IslandScene';
import type { UI } from '../ui';
import { drawUnit, GENERALS as GEN_LOOKS, TROOP_OF, TROOPS } from '../art2/units';
import { drawBoat } from '../art2/builds';
import { sound } from '../audio';

interface Squad {
  u: BUnit;
  img: Phaser.GameObjects.Image;
  men: Phaser.GameObjects.Image[];
  bar: Phaser.GameObjects.Graphics;
  hp: number;
  x: number;
  y: number;
  col: number;
  row: number;
}

export interface BattleData {
  battle: BattleResult;
  title: string;
  /** trận giữa hai người chơi: không cho tua, không bỏ qua */
  pvp?: boolean;
  onDone: () => void;
}

const COLS = 12;
const ROWS = 5;
/** lính đi theo từng loại chỉ huy */
const MEN = TROOP_OF;

export class BattleScene extends Phaser.Scene {
  private views = new Map<string, Squad>();
  private data0!: BattleData;
  private idx = 0;
  private speed = 1;
  private paused = false;
  private done = false;
  private W = 240;
  private H = 135;
  private ui!: UI;
  private rs = 1;
  private z = 3;
  private cell = 18;
  private ox = 0;
  private oy = 0;

  constructor() {
    super('battle');
  }

  init(d: BattleData) {
    this.data0 = d;
    this.idx = 0;
    this.speed = 1;
    this.paused = false;
    this.done = false;
    this.round = 0;
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
    const bgKey = `bbg-${this.W}x${this.H}`;
    ensureTex(this, bgKey, () => drawBattleBg(this.W, this.H));
    this.add.image(0, 0, bgKey).setOrigin(0).setScale(1 / HD);
    // bàn cờ: ô sáng tối xen kẽ, vừa khung nhìn
    this.cell = Math.max(14, Math.min(22, Math.floor((this.W - 16) / COLS)));
    this.ox = Math.round((this.W - this.cell * COLS) / 2);
    this.oy = Math.round(this.H * 0.6 - (this.cell * ROWS) / 2 + 8);
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0x3d2b2b, 0.35).fillRect(this.ox - 2, this.oy - 2, this.cell * COLS + 4, this.cell * ROWS + 4);
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        g.fillStyle((r + c) % 2 ? 0xf6ebc6 : 0xe9d9a8, 1).fillRect(this.ox + c * this.cell, this.oy + r * this.cell, this.cell, this.cell);
      }
    // vạch giữa hai bên
    g.fillStyle(0xc9a46a, 0.6).fillRect(this.ox + (COLS / 2) * this.cell - 1, this.oy, 2, this.cell * ROWS);
    const b = this.data0.battle;
    this.layout(b.a, 0);
    this.layout(b.b, 1);
    const q = (id: string) => document.getElementById(id)!;
    q('battleHud').hidden = false;
    q('bhLive').textContent = this.data0.pvp ? 'TRỰC TIẾP' : '';
    this.time.addEvent({ delay: 100, loop: true, callback: () => this.updateHud() });
    this.updateHud();
    this.time.delayedCall(500, () => this.next());
  }

  private round = 0;
  private updateHud() {
    const sum = (side: 0 | 1) => {
      let hp = 0, max = 0;
      for (const v of this.views.values()) if (v.u.side === side && !v.u.wall) { hp += v.hp; max += v.u.maxHp; }
      return max ? Math.round((100 * hp) / max) : 0;
    };
    const q = (id: string) => document.getElementById(id);
    const a = q('bhA'), b = q('bhB'), r = q('bhRound'), pg = q('bhP');
    const total = this.data0?.battle.events.length || 1;
    if (pg) pg.style.width = Math.min(100, Math.round((100 * this.idx) / total)) + '%';
    if (a) a.style.width = sum(0) + '%';
    if (b) b.style.width = sum(1) + '%';
    if (r) r.textContent = `Lượt ${this.round}`;
  }

  /** Đổi tốc độ x1 ↔ x2 (không áp cho trận người chơi). Trả về tốc độ mới. */
  toggleSpeed() {
    if (this.data0?.pvp) return 1;
    this.speed = this.speed === 1 ? 2 : 1;
    return this.speed;
  }

  skip() {
    if (this.data0?.pvp) return this.ui.toast('Trận giữa người chơi phải xem hết, không bỏ qua được.', 'muted');
    this.speed = 50;
  }

  private cellXY(col: number, row: number) {
    return { x: this.ox + col * this.cell + this.cell / 2, y: this.oy + row * this.cell + this.cell - 1 };
  }

  private texFor(u: BUnit, side: 0 | 1): string {
    if (u.key === 'an') return this.heroTex(u, side);
    if (u.key.startsWith('tau-')) {
      const m = u.key.match(/^tau-(ghe|buom|chien)(n?)(d?)(m?)$/);
      if (m) return ensureTex(this, u.key, () => drawBoat(m[1] as 'ghe' | 'buom' | 'chien', { no: !!m[2], da: !!m[3], dam: !!m[4] }, side === 0 ? '#ee5d4a' : '#5f6878'));
    }
    const gl = GEN_LOOKS.find((x) => x.id === u.key);
    if (gl) return ensureTex(this, `gen-${gl.id}`, () => drawUnit(gl.look));
    if (isRandKey(u.key)) return ensureTex(this, `ch-${u.key}`, () => charCanvas(u.key));
    return `ch-${u.key}`;
  }
  private menTex(u: BUnit): string | null {
    if (u.wall || u.key.startsWith('tau-')) return null;
    const t = MEN[u.key];
    if (t) {
      const def = TROOPS.find((x) => x.id === t)!;
      return ensureTex(this, `troop-${t}`, () => drawUnit(def.look));
    }
    return this.textures.exists(`ch-${u.key}`) ? `ch-${u.key}` : null;
  }

  private layout(units: BUnit[], side: 0 | 1) {
    const front = units.filter((u) => u.row === 'front' && !u.wall);
    const back = units.filter((u) => u.row === 'back');
    const walls = units.filter((u) => u.wall);
    // cột theo bên: bên mình ở trái, bên địch ở phải
    const colOf = (lane: 'front' | 'back' | 'wall') => (side === 0 ? { front: 4, back: 2, wall: 5 }[lane] : { front: 7, back: 9, wall: 6 }[lane]);
    const place = (list: BUnit[], lane: 'front' | 'back' | 'wall') =>
      list.forEach((u, i) => {
        const row = Math.max(0, Math.min(ROWS - 1, Math.round((ROWS - 1) / 2 + (i - (list.length - 1) / 2) * (list.length > 3 ? 1 : 1.5))));
        const col = colOf(lane);
        const { x, y } = this.cellXY(col, row);
        if (!u.wall) this.add.ellipse(x, y - 1, this.cell * 0.9, this.cell * 0.3, side === 0 ? 0x4fd06a : 0xf0554a, 0.35).setStrokeStyle(1, side === 0 ? 0x2f9a4a : 0xb23a30, 0.9).setDepth(y + 1);
        const img = this.add.image(x, y, this.texFor(u, side)).setOrigin(0.5, 1).setDepth(y + 2).setScale(this.fit(this.texFor(u, side), 1.25));
        if (side === 1 && !u.wall) img.setFlipX(true);
        const men: Phaser.GameObjects.Image[] = [];
        const mt = this.menTex(u);
        if (mt) {
          const n = u.key in MEN ? 3 : 2;
          for (let k = 0; k < n; k++) {
            const dc = side === 0 ? -1 : 1;
            const mx = x + dc * (this.cell * 0.55 + (k % 2) * this.cell * 0.45);
            const my = y + (k - 1) * Math.round(this.cell * 0.32);
            const m = this.add.image(mx, my, mt).setOrigin(0.5, 1).setDepth(my).setScale(this.fit(mt, 0.85));
            if (side === 1) m.setFlipX(true);
            this.tweens.add({ targets: m, y: my - 1, duration: 420 + k * 90, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
            men.push(m);
          }
        }
        const bar = this.add.graphics().setDepth(2000);
        const v: Squad = { u, img, men, bar, hp: u.hp, x, y, col, row };
        this.views.set(u.id, v);
        this.drawBar(v);
        this.tweens.add({ targets: img, y: y - 1, duration: 500 + i * 70, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      });
    place(front, 'front');
    place(back, 'back');
    place(walls, 'wall');
  }

  /** Thu phóng hình để vừa ô (cao khoảng k ô). */
  private fit(key: string, k: number) {
    const h = this.textures.get(key).getSourceImage().height || 32;
    return Math.min(1 / HD, (this.cell * k) / h);
  }

  private heroTex(u: BUnit, side: 0 | 1): string {
    const store = this.registry.get('store') as Store;
    if (side === 0) return avatarTex(this, store.s.avatar);
    const p = store.net.islands().find((x) => x.name === u.name);
    return avatarTex(this, p ? pubAvatar(p) : avatarFrom(u.name));
  }

  private drawBar(v: Squad) {
    const w = 16;
    const x = v.x - w / 2;
    const y = v.y - v.img.displayHeight - 4;
    v.bar.clear();
    v.bar.fillStyle(0x3d2b2b, 1).fillRect(x - 1, y - 1, w + 2, 4);
    const pct = Math.max(0, v.hp / v.u.maxHp);
    v.bar.fillStyle(v.u.side === 0 ? 0x4fd06a : 0xf0554a, 1).fillRect(x, y, Math.round(w * pct), 2);
    // lính ngã dần theo máu của toán
    const alive = Math.ceil(pct * v.men.length);
    v.men.forEach((m, i) => {
      if (i >= alive && m.visible && m.alpha > 0.5) this.tweens.add({ targets: m, alpha: 0, angle: v.u.side === 0 ? -90 : 90, duration: 300, onComplete: () => m.setVisible(false) });
    });
  }

  private pop(x: number, y: number, text: string, color: string, size = 10) {
    const cam = this.cameras.main;
    const k = this.z * this.rs;
    this.ui.floatAt((x - cam.worldView.x) * k, (y - cam.worldView.y) * k, text, '', undefined, color, Math.round(size * 2.1));
  }

  /** Tạm dừng/tiếp tục (chỉ trận không phải người chơi). */
  togglePause() {
    if (this.data0?.pvp) return false;
    this.paused = !this.paused;
    return this.paused;
  }

  private next() {
    if (this.paused) {
      this.time.delayedCall(100, () => this.next());
      return;
    }
    const ev = this.data0.battle.events[this.idx++];
    if (!ev) return this.finish();
    this.round = Math.max(this.round, ev.r);
    const wait = this.play(ev);
    this.time.delayedCall(Math.max(10, wait / this.speed), () => this.next());
  }

  /** Vệt chém hình cung. */
  private slash(x: number, y: number, dir: number) {
    const g = this.add.graphics().setDepth(2100);
    g.lineStyle(2, 0xffffff, 1);
    g.beginPath();
    g.arc(x - dir * 2, y, 7, dir > 0 ? -1.2 : Math.PI - 1.2, dir > 0 ? 1.2 : Math.PI + 1.2);
    g.strokePath();
    g.lineStyle(1, 0x9fd4ff, 1);
    g.beginPath();
    g.arc(x - dir * 3, y, 5, dir > 0 ? -1 : Math.PI - 1, dir > 0 ? 1 : Math.PI + 1);
    g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
  }
  /** Mũi tên bay từ hàng sau. */
  private arrow(a: Squad, t: Squad) {
    const g = this.add.graphics().setDepth(2100);
    const p = { k: 0 };
    const ax = a.x, ay = a.y - 8, bx = t.x, by = t.y - 8;
    this.tweens.add({
      targets: p,
      k: 1,
      duration: 220 / Math.min(this.speed, 3),
      onUpdate: () => {
        g.clear();
        const x = ax + (bx - ax) * p.k, y = ay + (by - ay) * p.k - Math.sin(p.k * Math.PI) * 10;
        g.lineStyle(1, 0x6c4229, 1).lineBetween(x - 4 * Math.sign(bx - ax), y + 1, x, y);
        g.fillStyle(0xeef1f5, 1).fillRect(x, y, 1, 1);
      },
      onComplete: () => g.destroy(),
    });
  }

  private play(ev: BEvent): number {
    const a = this.views.get(ev.a);
    if (!a) return 0;
    const dir = a.u.side === 0 ? 1 : -1;
    switch (ev.k) {
      case 'hit':
      case 'skill': {
        if (ev.s) this.pop(a.x, a.y - a.img.displayHeight - 6, SKILLS[ev.s].name, '#f6d34d', 9);
        const targets = (ev.t ?? []).map((id) => this.views.get(id)).filter(Boolean) as Squad[];
        const t0 = targets[0];
        const ranged = a.u.row === 'back';
        const sp = Math.min(this.speed, 3);
        if (t0 && !ranged) {
          // cả toán xông qua từng ô tới sát mục tiêu rồi quay về
          const tx = t0.x - dir * this.cell, ty = t0.y;
          const go = 220 / sp;
          this.tweens.add({ targets: a.img, x: tx, y: ty, duration: go, yoyo: true, hold: 120 / sp, ease: 'Quad.easeOut' });
          a.men.forEach((m, k) => {
            if (!m.visible) return;
            const mx0 = m.x, my0 = m.y;
            this.tweens.add({ targets: m, x: tx - dir * (6 + k * 3), y: ty + (k - 1) * 4, duration: go + k * 30, yoyo: true, hold: 100 / sp, ease: 'Quad.easeOut', onComplete: () => m.setPosition(mx0, my0) });
          });
          this.time.delayedCall(go, () => targets.forEach((t) => this.slash(t.x - dir * 4, t.y - 8, dir)));
        } else if (t0) {
          targets.forEach((t) => this.arrow(a, t));
          sound.play('arrow');
          a.men.forEach((m) => m.visible && targets.forEach((t) => this.time.delayedCall(60, () => this.arrow({ ...a, x: m.x, y: m.y } as Squad, t))));
        }
        const hitAt = ranged ? 220 / sp : 230 / sp;
        targets.forEach((t, i) => {
          if (ev.s === 'samset') {
            const g = this.add.graphics().setDepth(1500);
            g.lineStyle(1, 0xf6d34d, 1).lineBetween(a.x, a.y - 10, t.x, t.y - 8);
            this.time.delayedCall(160, () => g.destroy());
          }
          this.time.delayedCall(hitAt, () => {
            if (i === 0) sound.play(ev.crit ? 'crit' : 'hit');
            t.hp = Math.max(0, t.hp - (ev.v?.[i] ?? 0));
            this.drawBar(t);
            t.img.setTintFill(0xffffff);
            this.time.delayedCall(70, () => t.img.clearTint());
            this.tweens.add({ targets: t.img, x: t.x + 2 * dir, duration: 40, yoyo: true, repeat: 1 });
            this.pop(t.x, t.y - t.img.displayHeight, `${ev.crit ? 'BẠO ' : ''}-${ev.v?.[i] ?? 0}`, ev.crit ? '#ff9b3a' : '#ff6a55', ev.crit ? 12 : 10);
          });
        });
        return 620;
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
        sound.play('heal');
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
