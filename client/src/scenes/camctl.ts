// Điều khiển camera dùng chung: kéo để di chuyển, chụm 2 ngón / cuộn chuột / nút +− để thu phóng,
// giữ khung nhìn trong một vùng cho phép, và báo ra ngoài khi người chơi thu nhỏ/phóng to quá giới hạn
// (để chuyển liền mạch giữa đảo và hải đồ).
import Phaser from 'phaser';

export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CamOpts {
  minZ: number;
  maxZ: number;
  region: () => Region;
  /** Thu nhỏ quá mức tối thiểu (toạ độ thế giới tại điểm thu). */
  onPastMin?: (wx: number, wy: number) => void;
  /** Phóng to quá mức tối đa (toạ độ thế giới tại điểm phóng). */
  onPastMax?: (wx: number, wy: number) => void;
  onChange?: () => void;
}

export class CamCtl {
  dragged = false;
  /** Phần màn hình bị giao diện che ở trên/dưới (px của khung game). Khung nhìn tự né vùng này. */
  padTop = 0;
  padBottom = 0;
  private down = { x: 0, y: 0, sx: 0, sy: 0 };
  private pinch: { d0: number; z0: number } | null = null;
  private snapTween: Phaser.Tweens.Tween | null = null;
  private wheelLock = 0;

  constructor(
    private scene: Phaser.Scene,
    public o: CamOpts,
  ) {}

  get cam() {
    return this.scene.cameras.main;
  }

  attach() {
    const input = this.scene.input;
    input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.down = { x: p.x, y: p.y, sx: this.cam.scrollX, sy: this.cam.scrollY };
      this.dragged = false;
    });
    input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const p1 = input.pointer1;
      const p2 = input.pointer2;
      if (p1?.isDown && p2?.isDown) {
        const d = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        if (!this.pinch) this.pinch = { d0: Math.max(10, d), z0: this.cam.zoom };
        const z = Phaser.Math.Clamp((this.pinch.z0 * d) / this.pinch.d0, this.o.minZ * 0.6, this.o.maxZ * 1.3);
        this.zoomAt(z, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
        this.dragged = true;
        return;
      }
      if (!p.isDown || this.pinch) return;
      const dx = p.x - this.down.x;
      const dy = p.y - this.down.y;
      if (!this.dragged && Math.hypot(dx, dy) > 8) this.dragged = true;
      if (this.dragged) {
        this.cam.scrollX = this.down.sx - dx / this.cam.zoom;
        this.cam.scrollY = this.down.sy - dy / this.cam.zoom;
        this.clamp();
      }
    });
    input.on('pointerup', () => {
      if (!this.pinch) return;
      if (input.pointer1?.isDown || input.pointer2?.isDown) return;
      const z = this.cam.zoom;
      const mid = this.cam.midPoint;
      this.pinch = null;
      if (z < this.o.minZ * 0.85 && this.o.onPastMin) return this.o.onPastMin(mid.x, mid.y);
      if (z > this.o.maxZ * 1.12 && this.o.onPastMax) return this.o.onPastMax(mid.x, mid.y);
      this.snap();
    });
    input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      const now = performance.now();
      if (now < this.wheelLock) return;
      this.wheelLock = now + 140;
      this.step(dy > 0 ? -1 : 1, p.x, p.y);
    });
  }

  /** Một nấc thu phóng (nút +− hoặc cuộn chuột), neo tại điểm (sx, sy) trên màn hình. */
  step(dir: 1 | -1, sx = this.cam.width / 2, sy = this.cam.height / 2) {
    const cur = Math.round(this.cam.zoom);
    const w = this.worldAt(sx, sy);
    if (dir < 0 && cur <= this.o.minZ) return this.o.onPastMin?.(w.x, w.y);
    if (dir > 0 && cur >= this.o.maxZ) return this.o.onPastMax?.(w.x, w.y);
    this.animateTo(Phaser.Math.Clamp(cur + dir, this.o.minZ, this.o.maxZ), sx, sy);
  }

  worldAt(sx: number, sy: number) {
    const cam = this.cam;
    return { x: cam.scrollX + cam.width / 2 + (sx - cam.width / 2) / cam.zoom, y: cam.scrollY + cam.height / 2 + (sy - cam.height / 2) / cam.zoom };
  }

  /** Đổi zoom mà giữ nguyên điểm thế giới nằm dưới (sx, sy). */
  zoomAt(z: number, sx: number, sy: number) {
    const cam = this.cam;
    const w = this.worldAt(sx, sy);
    cam.setZoom(z);
    cam.scrollX = w.x - cam.width / 2 - (sx - cam.width / 2) / z;
    cam.scrollY = w.y - cam.height / 2 - (sy - cam.height / 2) / z;
    this.clamp();
    this.o.onChange?.();
  }

  animateTo(z: number, sx = this.cam.width / 2, sy = this.cam.height / 2, ms = 180, done?: () => void) {
    this.snapTween?.stop();
    const proxy = { z: this.cam.zoom };
    this.snapTween = this.scene.tweens.add({
      targets: proxy,
      z,
      duration: ms,
      ease: 'Sine.easeOut',
      onUpdate: () => this.zoomAt(proxy.z, sx, sy),
      onComplete: () => {
        this.zoomAt(z, sx, sy);
        done?.();
      },
    });
  }

  /** Về nấc nguyên gần nhất để pixel sắc nét. */
  snap() {
    const z = Phaser.Math.Clamp(Math.round(this.cam.zoom), this.o.minZ, this.o.maxZ);
    if (z !== this.cam.zoom) this.animateTo(z);
  }

  /** Đặt điểm (x, y) vào giữa phần màn hình không bị giao diện che. */
  centerOn(x: number, y: number) {
    this.cam.centerOn(x, y + (this.padBottom - this.padTop) / 2 / this.cam.zoom);
    this.clamp();
  }

  setPads(top: number, bottom: number) {
    this.padTop = Math.max(0, top);
    this.padBottom = Math.max(0, bottom);
  }

  /** Giữ khung nhìn trong vùng cho phép; vùng nhỏ hơn màn hình thì căn giữa. */
  clamp() {
    const cam = this.cam;
    const R = this.o.region();
    const vw = cam.width / cam.zoom;
    const vh = cam.height / cam.zoom;
    // phần nhìn thấy thật (trừ thanh trên và bảng dưới)
    const top = Math.min(this.padTop, cam.height * 0.45) / cam.zoom;
    const visH = Math.max(vh * 0.25, vh - top - Math.min(this.padBottom, cam.height * 0.7) / cam.zoom);
    let x = cam.scrollX + (cam.width - vw) / 2;
    let y = cam.scrollY + (cam.height - vh) / 2 + top; // mép trên của phần nhìn thấy
    x = R.w <= vw ? R.x + R.w / 2 - vw / 2 : Phaser.Math.Clamp(x, R.x, R.x + R.w - vw);
    y = R.h <= visH ? R.y + R.h / 2 - visH / 2 : Phaser.Math.Clamp(y, R.y, R.y + R.h - visH);
    cam.scrollX = x - (cam.width - vw) / 2;
    cam.scrollY = y - top - (cam.height - vh) / 2;
  }
}
