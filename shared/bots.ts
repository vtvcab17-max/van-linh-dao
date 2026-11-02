// Đảo máy (bot): giúp một người test vẫn thấy Hải Khu đông vui. Tính theo đồng hồ chung
// nên mọi người chơi cùng thấy một trạng thái bot giống nhau.
import { COMP_KEYS, RES_KEYS, type CompKey, type ResKey } from './data';
import { titleOf, type IslandPub } from './logic';
import { hashStr, mulberry32 } from './rng';
import { avatarFrom } from './avatar';

interface BotDef {
  id: string;
  name: string;
  island: string;
  base: number;
  perDay: number;
}

export const BOTS: BotDef[] = [
  { id: 'bot-bon', name: 'Thằng Bờm', island: 'Cồn Quạt Mo', base: 70, perDay: 6 },
  { id: 'bot-hailua', name: 'Hai Lúa', island: 'Cồn Hai Lúa', base: 95, perDay: 8 },
  { id: 'bot-utdet', name: 'Út Đẹt', island: 'Mỏm Út Đẹt', base: 60, perDay: 5 },
  { id: 'bot-coba', name: 'Cô Ba Bánh Xèo', island: 'Đảo Bánh Xèo', base: 140, perDay: 10 },
  { id: 'bot-sauge', name: 'Chú Sáu Ghe', island: 'Bến Ghe Sáu', base: 180, perDay: 12 },
  { id: 'bot-tuluc', name: 'Anh Tư Lực Sĩ', island: 'Đảo Tạ Đá', base: 230, perDay: 14 },
  { id: 'bot-muoi', name: 'Chị Mười Chợ Nổi', island: 'Chợ Nổi Mười', base: 260, perDay: 15 },
  { id: 'bot-namngu', name: 'Ông Năm Ngư', island: 'Hòn Cá Ông', base: 320, perDay: 16 },
  { id: 'bot-baytheo', name: 'Bảy Thẹo', island: 'Sào Huyệt Cờ Đen', base: 520, perDay: 25 },
];

const EPOCH = Date.UTC(2026, 10, 1);

export function botPub(b: BotDef, now: number): IslandPub {
  const days = Math.max(0, (now - EPOCH) / 86_400_000);
  const p = Math.round(Math.min(b.base + b.perDay * days, b.base * 3));
  const r = mulberry32(hashStr(`${b.id}:${Math.floor(now / 600_000)}`));
  const tier = (w: number) => Math.max(1, Math.min(5, Math.round(p / w)));
  const nComps = p > 260 ? 4 : p > 150 ? 3 : 2;
  const lv = Math.max(1, Math.round(p / 45));
  const team: { k: CompKey; lv: number }[] = COMP_KEYS.slice(0, nComps).map((k, i) => ({ k, lv: Math.max(1, lv - (i % 2)) }));
  const lootable: Partial<Record<ResKey, number>> = {};
  for (const k of RES_KEYS) {
    if (k === 'ngoc') continue;
    if (r() < 0.7) lootable[k] = Math.round(20 + r() * p * 0.8);
  }
  return {
    id: b.id,
    name: b.name,
    islandName: b.island,
    power: p,
    title: titleOf(p),
    land: Math.round(16 + p / 8),
    tiers: { leu: tier(110), cuoc: tier(120), rao: tier(100), thuyen: tier(130) },
    team,
    lootable,
    updatedAt: now,
    bot: true,
    avatar: avatarFrom(b.id),
  };
}

export function allBots(now: number): IslandPub[] {
  return BOTS.map((b) => botPub(b, now));
}

const CHAT_LINES = [
  'Ai đổi tre lấy đá không? Tui dư tre quá trời.',
  'Cuốc nhà tui vừa lên Cuốc Sắt nè, nghe nó cười khà khà.',
  'Đêm nay trăng đỏ quá, coi chừng bị đột kích nha bà con.',
  'Có Hòm Đồng dạt vô bờ đông, mừng muốn xỉu.',
  'Lều nhà tui đói, bà càu nhàu cả đêm không cho ngủ.',
  'Bãi Cua dễ ăn lắm, đem Bảo Ngọc đứng trước là xong.',
  'Rạn Sứa đốt rát quá, nhớ mang Thu Hà theo hồi máu.',
  'Ai biết Hàng Rào Tre thích ăn gì ngoài tre không?',
  'Tui cho Cuốc ăn cỏ, nó dỗi tui luôn, đào chậm rì.',
  'Bảy Thẹo mới cướp đảo tui, ai lập Làng đánh hắn không?',
  'Nghe nói Hang Cua Đá rớt Ngọc Trai đó.',
  'Mới khai hoang thêm ô, mọc ra bụi tre, ngon lành.',
  'Có ai lên Nhà Sàn Tre chưa? Tốn gỗ ghê.',
  'Rùa Vàng nói người mới thì không bị đột kích, yên tâm cày.',
  'Thủy Tinh mà dâng nước là đảo thấp chìm hết đó nghen.',
];

/** Câu chat bot trong khung giờ hiện tại (mỗi 70 giây một khung). Ai cũng thấy giống nhau. */
export function botChatsSince(fromT: number, toT: number): { id: string; from: string; name: string; text: string; t: number; bot: true }[] {
  const slot = 70_000;
  const out: { id: string; from: string; name: string; text: string; t: number; bot: true }[] = [];
  const start = Math.max(Math.floor(fromT / slot), Math.floor(toT / slot) - 30);
  for (let i = start + 1; i <= Math.floor(toT / slot); i++) {
    const r = mulberry32(hashStr(`chat:${i}`));
    if (r() < 0.45) continue;
    const b = BOTS[Math.floor(r() * BOTS.length)];
    const t = i * slot + Math.floor(r() * slot);
    if (t > toT) continue;
    out.push({ id: `bc${i}`, from: b.id, name: b.name, text: CHAT_LINES[Math.floor(r() * CHAT_LINES.length)], t, bot: true });
  }
  return out;
}
