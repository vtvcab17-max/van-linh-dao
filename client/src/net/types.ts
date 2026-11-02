import type { Action, IslandPub, PlayerState, RaidEvent } from '../../../shared/logic';

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
export type NetEvent = 'islands' | 'chat' | 'raid' | 'status' | 'sync' | 'raided' | 'notice';

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
}
