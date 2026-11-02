// Chơi online ngay trên Claude: dữ liệu chung qua `db`, người đang mở game qua `room`.
import type { IslandPub, PlayerState, RaidEvent } from '../../../shared/logic';
import { ls, NetBase } from './base';
import type { ChatMsg, Feedback, Telemetry } from './types';

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Ghi tuần tự một tài liệu: luôn chỉ một lệnh ghi đang chạy, giữ lại bản mới nhất. */
class DocWriter {
  private busy = false;
  private pending: Record<string, unknown> | null = null;
  constructor(
    private ref: Any,
    private onError: (code: string) => void,
  ) {}
  write(data: Record<string, unknown>) {
    this.pending = data;
    void this.flush();
  }
  private async flush() {
    if (this.busy || !this.pending) return;
    this.busy = true;
    const data = this.pending;
    this.pending = null;
    try {
      await this.ref.set(data);
    } catch (e) {
      this.onError((e as Any)?.code ?? 'unavailable');
    }
    this.busy = false;
    if (this.pending) void this.flush();
  }
}

export class ClaudeNet extends NetBase {
  mode = 'claude' as const;
  label = 'Online trên Claude';
  private db: Any;
  private room: Any;
  private user: Any;
  private writers = new Map<string, DocWriter>();
  private myChats: ChatMsg[] = [];
  private myRaids: RaidEvent[] = [];
  private myFeedback: Feedback[] = [];
  private seenRaids = new Set<string>();
  status = 'Đang kết nối Hải Khu...';

  static async available(): Promise<{ db: Any; room: Any; user: Any } | null> {
    const c = (window as Any).claude;
    if (!c?.use) return null;
    const [db, room, user] = await Promise.all([c.use('db'), c.use('room'), c.use('user')]);
    if (!db || !user) return null;
    const id = await user.id();
    if (!id) return null;
    return { db, room, user };
  }

  constructor(caps: { db: Any; room: Any; user: Any }) {
    super();
    this.db = caps.db;
    this.room = caps.room;
    this.user = caps.user;
  }

  private writer(path: string): DocWriter {
    let w = this.writers.get(path);
    if (!w) {
      w = new DocWriter(this.db.doc(path), (code) => {
        if (code === 'invalid_argument' && !path.startsWith('data/users/')) {
          this.canWrite = false;
          this.status = 'Bạn đang ở quyền chỉ xem: tiến trình lưu trên máy này.';
          this.emit('status', this.status);
        }
      });
      this.writers.set(path, w);
    }
    return w;
  }

  async init() {
    this.meId = await this.user.id();
    const me = await this.user.me();
    this.meName = (me?.name || 'Người lưu lạc').slice(0, 18);
    const can = await this.user.can('data.write');
    if (can === false) {
      this.canWrite = false;
      this.label = 'Xem trên Claude (không ghi được)';
    }
    const timer = setTimeout(() => {
      this.status = 'Chưa kết nối được Hải Khu, đang thử lại...';
      this.emit('status', this.status);
    }, 10_000);
    const ok = () => {
      clearTimeout(timer);
      if (this.status.startsWith('Đang') || this.status.startsWith('Chưa')) {
        this.status = 'Đã vào Hải Khu';
        this.emit('status', this.status);
      }
    };
    this.db.collection('islands').onSnapshot(
      (snap: Any) => {
        if (!snap.metadata.fromCache) ok();
        this.realIslands.clear();
        const weekAgo = Date.now() - 7 * 86_400_000;
        for (const d of snap.docs) {
          const p = d.data() as IslandPub;
          if (p && p.id && (p.updatedAt ?? 0) > weekAgo) this.realIslands.set(p.id, { ...p, bot: false });
        }
        this.emit('islands');
      },
      (e: Any) => this.emit('status', `Mất kết nối danh sách đảo (${e.code})`),
    );
    this.db.collection('chatlog').onSnapshot(
      (snap: Any) => {
        const all: ChatMsg[] = [];
        for (const d of snap.docs) {
          const list = (d.data()?.msgs ?? []) as ChatMsg[];
          for (const m of list) if (m && typeof m.text === 'string') all.push({ ...m, text: m.text.slice(0, 140), name: String(m.name ?? '').slice(0, 18) });
        }
        const map = new Map(this.chatList.map((m) => [m.id, m]));
        for (const m of all) map.set(m.id, m);
        this.chatList = [...map.values()].sort((a, b) => a.t - b.t).slice(-80);
        const mine = all.filter((m) => m.from === this.meId);
        if (mine.length > this.myChats.length) this.myChats = mine.sort((a, b) => a.t - b.t).slice(-20);
        this.emit('chat');
      },
      () => {},
    );
    this.db.collection('raids').onSnapshot(
      (snap: Any) => {
        for (const d of snap.docs) {
          const list = (d.data()?.list ?? []) as RaidEvent[];
          for (const ev of list) {
            if (ev?.targetId === this.meId && !this.seenRaids.has(ev.id)) {
              this.seenRaids.add(ev.id);
              this.emit('raid', ev);
            }
            if (ev?.attackerId === this.meId && !this.myRaids.some((r) => r.id === ev.id)) this.myRaids.push(ev);
          }
        }
      },
      () => {},
    );
    // khôi phục góp ý cũ để không ghi đè mất
    try {
      const fb = await this.db.doc(`feedback/${this.meId}`).get();
      if (fb.exists) this.myFeedback = (fb.data()?.list ?? []) as Feedback[];
    } catch {
      /* bỏ qua */
    }
    if (this.room) {
      this.room.on('chat', (msg: Any) => {
        const m = msg?.data as ChatMsg;
        if (!m || typeof m.text !== 'string' || msg.sameTab) return;
        if (!this.chatList.some((x) => x.id === m.id)) {
          this.chatList.push({ id: String(m.id), from: String(m.from), name: String(m.name).slice(0, 18), text: m.text.slice(0, 140), t: Number(m.t) || Date.now() });
          this.emit('chat');
        }
      }, () => {});
      this.room.on('raid', (msg: Any) => {
        const ev = msg?.data as RaidEvent;
        if (ev?.targetId === this.meId && !this.seenRaids.has(ev.id)) {
          this.seenRaids.add(ev.id);
          this.emit('raid', ev);
        }
      }, () => {});
      this.room.onPeers((ch: Any) => {
        this.onlineList = ch.peers.map((p: Any) => ({ id: p.by ?? p.peer, act: String(p.presence?.act ?? '') }));
        this.emit('islands');
      }, () => {});
    }
  }

  async loadSave(): Promise<unknown | null> {
    try {
      const d = await this.db.doc(`data/users/${this.meId}/save`).get();
      if (d.exists) return d.data()?.state ?? null;
    } catch {
      /* rơi về bản trên máy */
    }
    return super.loadSave();
  }

  save(s: PlayerState) {
    super.save(s);
    this.writer(`data/users/${this.meId}/save`).write({ state: s, at: Date.now() });
  }

  publish(p: IslandPub) {
    this.realIslands.set(p.id, p);
    if (this.canWrite) this.writer(`islands/${this.meId}`).write({ ...p });
  }

  sendChat(text: string) {
    const msg: ChatMsg = { id: `${this.meId.slice(-8)}-${Date.now()}`, from: this.meId, name: this.meName, text: text.slice(0, 140), t: Date.now() };
    this.chatList.push(msg);
    this.myChats = [...this.myChats, msg].slice(-20);
    this.emit('chat');
    if (!this.canWrite) return;
    this.writer(`chatlog/${this.meId}`).write({ msgs: this.myChats });
    this.room?.emit('chat', msg).catch(() => {});
  }

  reportRaid(ev: RaidEvent) {
    this.myRaids = [...this.myRaids, ev].slice(-20);
    if (!this.canWrite || ev.targetId.startsWith('bot-')) return;
    this.writer(`raids/${this.meId}`).write({ list: this.myRaids });
    this.room?.emit('raid', ev).catch(() => {});
  }

  async sendFeedback(f: Feedback): Promise<string> {
    await super.sendFeedback(f);
    this.myFeedback = [...this.myFeedback, f].slice(-30);
    try {
      await this.db.doc(`feedback/${this.meId}`).set({ list: this.myFeedback });
      return 'Đã lưu góp ý. Claude đọc được phần này khi bạn nhắn trong chat.';
    } catch {
      return 'Lưu góp ý thất bại, đã giữ bản trên máy.';
    }
  }

  async canSendToClaude() {
    if (!this.room?.canSendToClaudeSession) return false;
    try {
      const v = await this.room.canSendToClaudeSession();
      return v === 'available' || v === 'available_if_opened';
    } catch {
      return false;
    }
  }

  /** Phải gọi ngay trong sự kiện bấm nút, không chờ gì trước đó. */
  sendToClaude(f: Feedback): Promise<string> {
    const clean = (s: string) => s.replace(/[\u0000-\u0008\u000b-\u001f\u007f­​-‏‪-‮⁠-⁯﻿]/g, '').slice(0, 1500);
    const data = {
      label: 'Góp ý Vạn Linh Đảo',
      diem_vui: f.fun,
      diem_muot: f.smooth,
      diem_de_hieu: f.clear,
      gop_y: clean(f.text),
      phien_ban: String(f.ctx.version ?? ''),
      fps_trung_binh: Number(f.ctx.fpsAvg ?? 0),
      fps_thap: Number(f.ctx.fpsLow ?? 0),
      suc_manh: Number(f.ctx.power ?? 0),
      bac_linh_vat: String(f.ctx.tiers ?? ''),
      thiet_bi: clean(String(f.ctx.screen ?? '')),
    };
    return this.room
      .sendToClaudeSession(data, { deliver: 'stage' })
      .then(() => 'Góp ý đã nằm trong ô chat với Claude. Bấm gửi khi sẵn sàng.')
      .catch((e: Any) => (e?.code === 'rate_limited' ? 'Gửi nhanh quá, thử lại sau ít giây.' : 'Chưa gửi được sang Claude. Góp ý vẫn được lưu.'));
  }

  private lastTele = 0;
  sendTelemetry(t: Telemetry) {
    super.sendTelemetry(t);
    if (!this.canWrite || Date.now() - this.lastTele < 60_000) return;
    this.lastTele = Date.now();
    this.writer(`telemetry/${this.meId}`).write({ ...t });
  }

  private lastAct = '';
  setActivity(text: string) {
    if (text === this.lastAct || !this.room) return;
    this.lastAct = text;
    this.room.presence({ act: text.slice(0, 60) }).catch(() => {});
  }
}

export const CLAUDE_CAPABILITIES = {
  db: {
    rules: [
      { path: 'islands', read: 'view', write: 'owner' },
      { path: 'islands/{self}', read: 'view', write: 'interact' },
      { path: 'chatlog', read: 'view', write: 'owner' },
      { path: 'chatlog/{self}', read: 'view', write: 'interact' },
      { path: 'raids', read: 'view', write: 'owner' },
      { path: 'raids/{self}', read: 'view', write: 'interact' },
      { path: 'feedback', read: 'admin', write: 'owner' },
      { path: 'feedback/{self}', read: 'interact', write: 'interact' },
      { path: 'telemetry', read: 'admin', write: 'owner' },
      { path: 'telemetry/{self}', read: 'interact', write: 'interact' },
    ],
  },
  user: { scopes: ['profile'] },
  room: { topics: { chat: 'interact', raid: 'interact' } },
};

export { ls };
