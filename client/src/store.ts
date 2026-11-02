// Kho trạng thái phía client: chạy logic dùng chung, tự lưu, tự công bố đảo lên Hải Khu.
import { GAME, LV_KEYS } from '../../shared/data';
import {
  apply,
  applyRaidAgainstMe,
  digest,
  migrate,
  power,
  publicOf,
  tick,
  type Action,
  type Outcome,
  type PlayerState,
  type RaidEvent,
} from '../../shared/logic';
import type { Net } from './net/types';
import type { Perf } from './perf';

type Listener = (d?: unknown) => void;

export class Store {
  s: PlayerState;
  private ls: Record<string, Listener[]> = {};
  private dirty = false;
  private lastSave = 0;
  private lastPub = 0;
  private pubKey = '';
  private timer = 0;

  constructor(
    public net: Net,
    raw: unknown,
    public perf: Perf,
  ) {
    this.s = migrate(raw, net.meId, net.meName, Date.now());
    if (!raw) this.dirty = true;
    tick(this.s, this.now());
    // bản chính thức: server gửi trạng thái đúng khi lệch, và khi đảo mình bị đột kích
    net.on('sync', (d) => {
      const { state, msg } = d as { state: PlayerState; msg?: string };
      this.replace(state);
      if (msg) this.emit('note', msg);
    });
    net.on('raided', (d) => {
      const { state, ev, text } = d as { state: PlayerState; ev: RaidEvent; text: string };
      this.replace(state);
      this.emit('raided', { ev, text });
    });
    net.on('raid', (ev) => {
      const text = applyRaidAgainstMe(this.s, ev as RaidEvent);
      if (text) {
        this.changed();
        this.emit('raided', { ev, text });
      }
    });
  }

  /** Bản chính thức: server quyết định kết quả. */
  get auth() {
    return !!this.net.authoritative;
  }
  /** Giờ dùng để chạy luật chơi (bản chính thức: theo đồng hồ server). */
  now() {
    return this.net.serverNow?.() ?? Date.now();
  }

  /** Nhận trạng thái từ server, giữ những thứ chỉ để hiển thị (đã xem trận chưa). */
  private replace(state: PlayerState) {
    const prev = this.s;
    const tiers = Object.fromEntries(LV_KEYS.map((k) => [k, prev.lv[k].tier]));
    const next = migrate(state, this.net.meId, this.net.meName, this.now());
    if (prev.lastBattle?.seen && next.lastBattle && next.lastBattle.title === prev.lastBattle.title && next.lastBattle.o.battle?.events.length === prev.lastBattle.o.battle?.events.length) next.lastBattle.seen = true;
    tick(next, this.now());
    next.outbox = [];
    this.s = next;
    for (const k of LV_KEYS) if (next.lv[k].tier > (tiers[k] as number)) this.emit('built', { lv: k, tier: next.lv[k].tier });
    this.changed();
  }

  on(ev: string, cb: Listener) {
    (this.ls[ev] ??= []).push(cb);
  }
  emit(ev: string, d?: unknown) {
    for (const cb of this.ls[ev] ?? []) cb(d);
  }

  start() {
    this.timer = window.setInterval(() => this.step(), 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.flush(true);
    });
    window.addEventListener('pagehide', () => this.flush(true));
    this.step();
  }

  /** Gửi các trận đột kích vừa đánh xong (lúc thuyền cập đảo) lên mạng. */
  private flushOutbox() {
    if (!this.s.outbox.length) return;
    if (this.auth) {
      // bản chính thức: server tự trừ tài nguyên đảo bị đánh
      this.s.outbox.length = 0;
      return;
    }
    for (const ev of this.s.outbox.splice(0)) this.net.reportRaid(ev);
    this.changed();
  }

  step() {
    const hadBattle = this.s.lastBattle;
    const tiers = Object.fromEntries(LV_KEYS.map((k) => [k, this.s.lv[k].tier]));
    const notes = tick(this.s, this.now());
    for (const k of LV_KEYS) if (this.s.lv[k].tier !== tiers[k]) this.emit('built', { lv: k, tier: this.s.lv[k].tier });
    for (const n of notes) this.emit('note', n);
    if (notes.length) this.changed();
    if (this.s.lastBattle && this.s.lastBattle !== hadBattle) this.emit('arrived', this.s.lastBattle);
    this.flushOutbox();
    if (!this.auth) this.net.poll?.(this.s);
    this.emit('tick');
    this.flush(false);
  }

  do(a: Action): Outcome {
    const at = this.now();
    if (this.auth) tick(this.s, at);
    const o = apply(this.s, a);
    // bản chính thức: gửi hành động kèm "dấu vân tay" kết quả để server kiểm
    if (this.auth && o.ok) this.net.sendAction?.(a, at, digest(this.s));
    if (o.ok) this.changed();
    this.emit('outcome', o);
    return o;
  }


  changed() {
    this.dirty = true;
    this.emit('change');
  }

  flush(force: boolean) {
    const now = Date.now();
    if (this.auth) {
      this.dirty = false;
      this.sendTele(now, force);
      return;
    }
    if (this.dirty && (force || now - this.lastSave > 5000)) {
      this.dirty = false;
      this.lastSave = now;
      this.net.save(this.s);
    }
    const pub = publicOf(this.s);
    const key = JSON.stringify({ ...pub, updatedAt: 0 });
    if (key !== this.pubKey && (force || now - this.lastPub > 8000)) {
      this.pubKey = key;
      this.lastPub = now;
      this.net.publish(pub);
    }
    this.sendTele(now, force);
  }

  private sendTele(now: number, force: boolean) {
    if (now % 30_000 < 1000 || force) {
      this.net.sendTelemetry({
        t: now,
        version: GAME.version,
        mode: this.net.mode,
        fpsAvg: this.perf.fpsAvg(),
        fpsLow: this.perf.fpsLow(),
        longFrames: this.perf.longFrames,
        loadMs: this.perf.loadMs,
        memMb: this.perf.memMb(),
        ua: navigator.userAgent.slice(0, 160),
        screen: `${innerWidth}x${innerHeight}@${devicePixelRatio}`,
        errors: this.perf.errors.slice(-5),
        minutes: this.perf.minutes(),
        power: power(this.s),
      });
    }
  }
}
