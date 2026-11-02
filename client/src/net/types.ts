import type { Action, IslandPub, PlayerState, RaidEvent } from '../../../shared/logic';
import type { BossWorld } from '../../../shared/boss';
import type { FleetView, IsleOwner } from '../../../shared/world';

export interface ChatMsg {
  id: string;
  from: string;
  name: string;
  text: string;
  t: number;
  bot?: boolean;
}

export interface Feedback {
  t: number;
  fun: number;
  smooth: number;
  clear: number;
  text: string;
  ctx: Record<string, unknown>;
}

export interface Telemetry {
  t: number;
  version: string;
  mode: string;
  fpsAvg: number;
  fpsLow: number;
  longFrames: number;
  loadMs: number;
  memMb: number | null;
  ua: string;
  screen: string;
  errors: string[];
  minutes: number;
  power: number;
}

export type NetMode = 'offline' | 'claude' | 'cloudflare';
export type NetEvent = 'islands' | 'chat' | 'raid' | 'status' | 'sync' | 'raided' | 'notice' | 'boss' | 'owners' | 'fleets';

export interface Net {
  mode: NetMode;
  label: string;
  meId: string;
  meName: string;
  canWrite: boolean;
  init(): Promise<void>;
  loadSave(): Promise<unknown | null>;
  save(s: PlayerState): void;
  publish(p: IslandPub): void;
  islands(): IslandPub[];
  chats(): ChatMsg[];
  sendChat(text: string): void;
  reportRaid(ev: RaidEvent): void;
  sendFeedback(f: Feedback): Promise<string>;
  canSendToClaude(): Promise<boolean>;
  sendToClaude(f: Feedback): Promise<string>;
  sendTelemetry(t: Telemetry): void;
  setActivity(text: string): void;
  online(): { id: string; act: string }[];
  on(ev: NetEvent, cb: (data?: unknown) => void): void;
  /** Bot đảo máy chủ động đột kích (chỉ khi chơi một mình). */
  poll?(s: PlayerState): void;
  /** Bản chính thức: server quyết định, máy chỉ gửi hành động. */
  authoritative?: boolean;
  sendAction?(a: Action, at: number, h: string): void;
  serverNow?(): number;
  account?: { name: string; khu: string; logout: () => void };
  /** Chợ thế giới, đấu giá, thương hội (chỉ bản chính thức). */
  market?(op: string, args?: Record<string, unknown>): Promise<{ ok: boolean; msg: string; data?: any }>;
  /** Thủy Tinh tuần này: máu chung cả Hải Khu (bản chính thức do server gửi). */
  bossWorld(s: PlayerState): BossWorld;
  /** Chủ các đảo tự nhiên trên hải đồ. */
  owners(): Record<string, IsleOwner>;
  /** Đoàn thuyền đang đi trên biển. */
  fleets(s: PlayerState): FleetView[];
  /** Gọi API của server kèm phiên đăng nhập (chỉ bản chính thức). */
  api?(path: string, body?: Record<string, unknown>): Promise<any>;
}
