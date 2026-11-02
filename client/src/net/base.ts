// Phần dùng chung cho mọi chế độ mạng: sự kiện, đảo máy, lưu trên máy.
import { allBots, botChatsSince, BOTS } from '../../../shared/bots';
import { publicOf, resolveRaid, type IslandPub, type PlayerState, type RaidEvent } from '../../../shared/logic';
import { hashStr } from '../../../shared/rng';
import type { ChatMsg, Feedback, Net, NetEvent, NetMode, Telemetry } from './types';

export const ls = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* chế độ riêng tư: bỏ qua */
    }
  },
};

export function localId(): string {
  let id = ls.get('vld-id');
  if (!id) {
    id = 'u' + Math.random().toString(36).slice(2, 10);
    ls.set('vld-id', id);
  }
  return id;
}

export abstract class NetBase implements Net {
  abstract mode: NetMode;
  abstract label: string;
  meId = '';
  meName = 'Mai An';
  canWrite = true;
  protected handlers: Partial<Record<NetEvent, ((d?: unknown) => void)[]>> = {};
  protected realIslands = new Map<string, IslandPub>();
  protected chatList: ChatMsg[] = [];
  protected botChatFrom = Date.now() - 20 * 60_000;
  protected onlineList: { id: string; act: string }[] = [];
  protected lastBotRaid = Date.now();

  on(ev: NetEvent, cb: (d?: unknown) => void) {
    (this.handlers[ev] ??= []).push(cb);
  }
  protected emit(ev: NetEvent, d?: unknown) {
    for (const cb of this.handlers[ev] ?? []) {
      try {
        cb(d);
      } catch (e) {
        console.error(e);
      }
    }
  }

  abstract init(): Promise<void>;

  async loadSave(): Promise<unknown | null> {
    const raw = ls.get('vld-save-' + this.meId);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  save(s: PlayerState) {
    ls.set('vld-save-' + this.meId, JSON.stringify(s));
  }
  publish(_p: IslandPub) {}

  islands(): IslandPub[] {
    const now = Date.now();
    const real = [...this.realIslands.values()].filter((p) => p.id !== this.meId);
    return [...real, ...allBots(now)].sort((a, b) => b.power - a.power);
  }

  chats(): ChatMsg[] {
    const now = Date.now();
    const bots = botChatsSince(this.botChatFrom, now);
    const map = new Map<string, ChatMsg>();
    for (const m of [...bots, ...this.chatList]) map.set(m.id, m);
    return [...map.values()].sort((a, b) => a.t - b.t).slice(-60);
  }

  sendChat(text: string) {
    const msg: ChatMsg = { id: `${this.meId}-${Date.now()}`, from: this.meId, name: this.meName, text: text.slice(0, 140), t: Date.now() };
    this.chatList.push(msg);
    this.emit('chat');
  }
  reportRaid(_ev: RaidEvent) {}
  async sendFeedback(f: Feedback): Promise<string> {
    const list = JSON.parse(ls.get('vld-feedback') ?? '[]') as Feedback[];
    list.push(f);
    ls.set('vld-feedback', JSON.stringify(list.slice(-30)));
    return 'Đã lưu góp ý trên máy này.';
  }
  async canSendToClaude() {
    return false;
  }
  async sendToClaude(_f: Feedback): Promise<string> {
    return 'Chỉ gửi được khi mở game trên Claude.';
  }
  sendTelemetry(t: Telemetry) {
    ls.set('vld-telemetry', JSON.stringify(t));
  }
  setActivity(_t: string) {}
  online() {
    return this.onlineList;
  }

  /** Đảo máy thỉnh thoảng đột kích người chơi (chỉ khi đã qua thời gian được che chở). */
  poll(s: PlayerState) {
    const now = Date.now();
    const gap = 5 * 60_000 / Math.max(1, s.speed);
    if (now - this.lastBotRaid < gap) return;
    this.lastBotRaid = now;
    if (s.lv.leu.tier < 2) return;
    const me = publicOf(s);
    if (!Object.keys(me.lootable).length) return;
    const n = Math.floor(now / gap);
    const r = hashStr(`botraid:${s.id}:${n}`);
    if (r % 3 !== 0) return;
    const candidates = allBots(now).filter((b) => b.power <= me.power * 1.4 + 40);
    if (!candidates.length) return;
    const bot = candidates[r % candidates.length];
    const res = resolveRaid({ comps: bot.team, cuocTier: bot.tiers.cuoc }, me, r);
    const ev: RaidEvent = {
      id: `br${n}`,
      attackerId: bot.id,
      attackerName: BOTS.find((b) => b.id === bot.id)?.name ?? bot.name,
      targetId: s.id,
      targetName: s.islandName,
      win: res.battle.winner === 0,
      loot: res.loot,
      seed: r,
      t: now,
    };
    this.emit('raid', ev);
  }
}
