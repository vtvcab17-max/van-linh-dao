// Đo hiệu năng thật trên máy người chơi: FPS trung bình, FPS thấp (1%), khung hình giật, bộ nhớ, thời gian tải.
export class Perf {
  private frames: number[] = [];
  private last = performance.now();
  longFrames = 0;
  totalFrames = 0;
  loadMs = 0;
  errors: string[] = [];
  started = Date.now();
  private raf = 0;

  start() {
    const loop = (t: number) => {
      const dt = t - this.last;
      this.last = t;
      if (dt > 0 && dt < 1000 && !document.hidden) {
        this.frames.push(dt);
        if (this.frames.length > 600) this.frames.shift();
        this.totalFrames++;
        if (dt > 50) this.longFrames++;
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    window.addEventListener('error', (e) => this.errors.push(String(e.message).slice(0, 200)));
    window.addEventListener('unhandledrejection', (e) => this.errors.push(String((e as PromiseRejectionEvent).reason).slice(0, 200)));
  }
  stop() {
    cancelAnimationFrame(this.raf);
  }
  fpsAvg(): number {
    if (!this.frames.length) return 0;
    const avg = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
    return Math.round(1000 / avg);
  }
  fpsLow(): number {
    if (this.frames.length < 20) return this.fpsAvg();
    const sorted = [...this.frames].sort((a, b) => b - a);
    const worst = sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.01)));
    const avg = worst.reduce((a, b) => a + b, 0) / worst.length;
    return Math.round(1000 / avg);
  }
  memMb(): number | null {
    const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return m ? Math.round(m.usedJSHeapSize / 1048576) : null;
  }
  minutes() {
    return Math.round((Date.now() - this.started) / 6000) / 10;
  }
}
