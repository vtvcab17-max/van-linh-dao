// Bản chính thức: chơi online qua server Cloudflare (Worker + Durable Object "Hải Khu").
// Server giữ dữ liệu đảo và quyết định kết quả. Máy chỉ gửi hành động; nếu lệch, server gửi lại trạng thái đúng.
import type { Action, IslandPub, PlayerState, RaidEvent } from '../../../shared/logic';
import { logout, forgetSession, type Session } from '../login';
import { NetBase } from './base';
import type { BossWorld } from '../../../shared/boss';
import type { FleetView, IsleOwner } from '../../../shared/world';
import type { ChatMsg, Feedback, Telemetry } from './types';

const TELE_EVERY = 5 * 60_000;

export class CloudflareNet extends NetBase {
  mode = 'cloudflare' as const;
  label: string;
  authoritative = true;
  account: { name: string; khu: string; logout: () => void };
  private ws: WebSocket | null = null;
  private queue: string[] = [];
  private state: PlayerState | null = null;
  private welcomed: Promise<void>;
  private resolveWelcome!: () => void;
  private failWelcome!: (e: Error) => void;
  private retry = 0;
  private offset = 0;
  private lastTele = 0;
  private lastAct = '';
  private everWelcomed = false;
  private rid = 0;
  private waits = new Map<number, (r: { ok: boolean; msg: string; data?: any }) => void>();
  private bossW: BossWorld | null = null;
  private own: Record<string, IsleOwner> = {};
  private fl: FleetView[] = [];

  constructor(
    private server: string,
    private sess: Session,
  ) {
    super();
    this.meId = sess.id;
    this.meName = sess.name;
    this.label = `Hải Khu ${sess.khu} · bản chính thức`;
    this.account = { name: sess.name, khu: sess.khu, logout };
    this.welcomed = new Promise((ok, fail) => {
      this.resolveWelcome = ok;
      this.failWelcome = fail;
    });
  }

  async init() {
    this.connect();
    const timeout = new Promise<never>((_, fail) => setTimeout(() => fail(new Error('Server không trả lời. Thử tải lại sau ít phút.')), 15_000));
    await Promise.race([this.welcomed, timeout]);
    // giữ kết nối sống; server trả lời tự động nên không tốn công đánh thức Hải Khu
    setInterval(() => this.send({ t: 'ping' }), 25_000);
  }

  /** Giờ theo server (đã trừ lệch đồng hồ của máy). */
  serverNow() {
    return Date.now() + this.offset;
  }

  private wsUrl() {
    return `${this.server.replace(/^http/, 'ws')}/khu/${encodeURIComponent(this.sess.khu)}/ws?session=${encodeURIComponent(this.sess.session)}`;
  }

  private connect() {
    const ws = new WebSocket(this.wsUrl());
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.emit('status', 'Đã vào Hải Khu');
    };
    ws.onmessage = (e) => this.onMsg(String(e.data));
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      this.emit('status', 'Mất kết nối, đang nối lại...');
      void this.reconnect();
    };
  }

  private async reconnect() {
    this.retry++;
    // nối hỏng liên tục: kiểm tra phiên đăng nhập còn hạn không
    if (this.retry === 3) {
      try {
        const r = await fetch(this.wsUrl().replace(/^ws/, 'http'));
        if (r.status === 401 || r.status === 403) {
          forgetSession();
          if (!this.everWelcomed) this.failWelcome(new Error('Phiên đăng nhập hết hạn. Tải lại để đăng nhập.'));
          else this.emit('notice', { msg: 'Phiên đăng nhập hết hạn, hãy tải lại trang.', kind: 'bad' });
          return;
        }
      } catch {
        /* mất mạng: cứ thử lại */
      }
    }
    setTimeout(() => this.connect(), Math.min(15_000, 600 * 2 ** Math.min(this.retry, 5)));
  }

  private send(m: unknown) {
    const s = JSON.stringify(m);
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(s);
    else if (this.queue.length < 200) this.queue.push(s);
  }

  private flushQueue() {
    const q = this.queue.splice(0);
    for (const s of q) this.ws?.send(s);
  }

  private clock(serverNow: unknown) {
    if (typeof serverNow === 'number') this.offset = serverNow - Date.now();
  }

  private onMsg(raw: string) {
    let m: Record<string, unknown>;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    switch (m.t) {
      case 'welcome': {
        this.clock(m.serverNow);
        this.state = m.state as PlayerState;
        this.realIslands.clear();
        for (const p of (m.islands as IslandPub[]) ?? []) if (!p.bot) this.realIslands.set(p.id, p);
        this.chatList = (m.chat as ChatMsg[]) ?? [];
        this.onlineList = (m.online as { id: string; act: string }[]) ?? [];
        if (m.boss) this.bossW = m.boss as BossWorld;
        this.own = (m.owners as Record<string, IsleOwner>) ?? {};
        this.fl = (m.fleets as FleetView[]) ?? [];
        // nối lại giữa chừng: hành động chờ gửi đã bị server bỏ qua nên lấy trạng thái server làm chuẩn
        this.queue = this.queue.filter((s) => !s.startsWith('{"t":"a"'));
        this.flushQueue();
        if (this.everWelcomed) this.emit('sync', { state: this.state, msg: '' });
        this.everWelcomed = true;
        this.resolveWelcome();
        this.emit('islands');
        this.emit('chat');
        return;
      }
      case 'sync':
        this.clock(m.serverNow);
        this.emit('sync', { state: m.state, msg: m.msg });
        return;
      case 'raided':
        this.clock(m.serverNow);
        this.emit('raided', { ev: m.ev as RaidEvent, text: m.text, state: m.state });
        return;
      case 'islands':
        for (const p of (m.list as IslandPub[]) ?? []) if (p.id !== this.meId && !p.bot) this.realIslands.set(p.id, p);
        this.emit('islands');
        return;
      case 'online':
        this.onlineList = (m.list as { id: string; act: string }[]) ?? [];
        this.emit('islands');
        return;
      case 'chat': {
        const msg = m.msg as ChatMsg;
        if (msg && !this.chatList.some((c) => c.id === msg.id)) {
          this.chatList.push(msg);
          if (this.chatList.length > 120) this.chatList.splice(0, this.chatList.length - 120);
        }
        this.emit('chat');
        return;
      }
      case 'mr': {
        const w = this.waits.get(Number(m.rid));
        if (w) {
          this.waits.delete(Number(m.rid));
          w({ ok: !!m.ok, msg: String(m.msg ?? ''), data: m.data });
        }
        return;
      }
      case 'boss':
        this.bossW = m.boss as BossWorld;
        this.emit('boss');
        return;
      case 'owners':
        this.own = (m.owners as Record<string, IsleOwner>) ?? {};
        this.emit('owners');
        return;
      case 'fleets':
        this.fl = (m.list as FleetView[]) ?? [];
        this.emit('fleets');
        return;
      case 'pong':
        this.clock(m.serverNow);
        return;
      case 'info':
      case 'error':
        this.emit('notice', { msg: String(m.msg ?? ''), kind: m.t === 'error' ? 'bad' : 'good' });
        return;
    }
  }

  async api(path: string, body: Record<string, unknown> = {}) {
    const r = await fetch(`${this.server}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, session: this.sess.session }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error ?? `Lỗi ${r.status}`);
    return d;
  }

  owners() {
    return this.own;
  }
  fleets() {
    return this.fl;
  }

  bossWorld(s: PlayerState): BossWorld {
    return this.bossW ?? super.bossWorld(s);
  }

  async loadSave() {
    return this.state;
  }
  save() {}
  publish() {}
  poll() {}
  reportRaid(_ev: RaidEvent) {}

  /** Bản chính thức không có tin nhắn của đảo máy. */
  chats(): ChatMsg[] {
    return this.chatList.slice(-80);
  }
  sendChat(text: string) {
    this.send({ t: 'chat', text: text.slice(0, 140) });
  }
  /** Gửi yêu cầu chợ/thương hội, chờ server trả lời. */
  market(op: string, args: Record<string, unknown> = {}) {
    const rid = ++this.rid;
    return new Promise<{ ok: boolean; msg: string; data?: any }>((done) => {
      this.waits.set(rid, done);
      this.send({ t: 'm', op, rid, ...args });
      setTimeout(() => {
        if (this.waits.delete(rid)) done({ ok: false, msg: 'Chợ không trả lời, thử lại sau.' });
      }, 15_000);
    });
  }
  sendAction(a: Action, at: number, h: string) {
    this.send({ t: 'a', a, at, h });
  }
  async sendFeedback(f: Feedback) {
    this.send({ t: 'fb', fb: f });
    return 'Đã gửi góp ý tới Beta Holding. Cảm ơn bạn!';
  }
  sendTelemetry(t: Telemetry) {
    if (t.t - this.lastTele < TELE_EVERY) return;
    this.lastTele = t.t;
    this.send({ t: 'tele', tele: t });
  }
  setActivity(text: string) {
    if (text === this.lastAct) return;
    this.lastAct = text;
    this.send({ t: 'act', act: text });
  }
}
