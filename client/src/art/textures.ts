import type Phaser from 'phaser';
import type { LvKey } from '../../../shared/data';
import type { Avatar } from '../../../shared/avatar';
import { charCanvas, drawChest, drawCuoc, drawEmote, drawIcon, drawLeu, drawNode, drawRao, drawThuyen, drawWater } from './sprites';
import { opaqueBox } from './buildings';
import { drawSeaIsland, miniRadius, type MiniKind } from './islands';
import { avatarTexKey, drawAvatar } from './avatar';
import { drawMerchant } from './dinh';
import { drawDinh2 } from '../art2/dinh2';
import { drawBoat, drawHall } from '../art2/builds';
import type { BKey } from '../../../shared/economy';
import type { Canvas } from './pixel';
import { enhance, HD } from './hd';

export { HD };

/**
 * Tạo texture một lần. Mặc định hình được nâng lên kiểu 32-bit (gấp đôi chi tiết),
 * nên ảnh trong game phải setScale(1 / HD) để giữ đúng kích thước.
 */
export function ensureTex(scene: Phaser.Scene, key: string, make: () => Canvas, raw = false): string {
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, raw ? make() : enhance(make()));
  return key;
}

/** Phóng ảnh đã nâng cấp để hiện trên giao diện DOM (scale tính theo điểm ảnh gốc). */
function hdUrl(src: Canvas, scale: number): string {
  const e = enhance(src);
  const k = Math.max(1, Math.round(scale / HD));
  const c = document.createElement('canvas');
  c.width = e.width * k;
  c.height = e.height * k;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(e, 0, 0, c.width, c.height);
  return c.toDataURL();
}

export function lvTex(scene: Phaser.Scene, lv: LvKey, tier: number, blink: boolean, mood: 'vui' | 'thuong' | 'doi'): string {
  const key = `${lv}-${tier}-${blink ? 1 : 0}-${mood}`;
  return ensureTex(scene, key, () => lvCanvas(lv, tier, blink, mood));
}

export function lvCanvas(lv: LvKey, tier: number, blink = false, mood: 'vui' | 'thuong' | 'doi' = 'thuong'): Canvas {
  return lv === 'leu' ? drawLeu(tier, blink, mood) : lv === 'cuoc' ? drawCuoc(tier, blink, mood) : lv === 'rao' ? drawRao(tier, blink, mood) : drawThuyen(tier, blink, mood);
}

export function preloadAll(scene: Phaser.Scene) {
  for (const k of ['grass', 'palm', 'bamboo', 'rock', 'scrap', 'drift']) ensureTex(scene, `node-${k}`, () => drawNode(k));
  for (let i = 0; i < 6; i++) ensureTex(scene, `chest-${i}`, () => drawChest(i));
  for (const e of ['vui', 'doi', 'doi_bung', 'nghe'] as const) ensureTex(scene, `emo-${e}`, () => drawEmote(e));
    for (const k of ['an', 'ngoc', 'ha', 'chau', 'trau', 'ngu', 'rua', 'cuagai', 'sualua', 'khida', 'canoc', 'haitac', 'baytheo', 'cuada', 'thuytinh', 'thuybinh']) ensureTex(scene, `ch-${k}`, () => charCanvas(k));
  for (let t = 1; t <= 5; t++) ensureTex(scene, `ch-rao${t}`, () => charCanvas(`rao${t}`));
  for (let t = 1; t <= 5; t++) ensureTex(scene, `boat-${t}`, () => drawThuyen(t, false, 'thuong'));
}

/** Nhà cửa, thành trì theo loại và cấp (bộ đồ họa mới, qua bộ lọc 32-bit). */
export function dinhTex(scene: Phaser.Scene, k: BKey, lv: number): string {
  return ensureTex(scene, `dinh2-${k}-${lv}`, () => drawDinh2(k, lv));
}
export function merchantTex(scene: Phaser.Scene, id: string, color: string): string {
  return ensureTex(scene, `merchant-${id}`, () => drawMerchant(color));
}

/** Nhân vật chủ đảo theo dáng vẻ đã chỉnh. */
export function avatarTex(scene: Phaser.Scene, a: Avatar): string {
  return ensureTex(scene, avatarTexKey(a), () => drawAvatar(a));
}

/** Đảo trên hải đồ: mỗi đảo một hình riêng; vẽ lại khi đảo lớn thêm hoặc nhà chính lên bậc. */
export function seaIslandTex(scene: Phaser.Scene, id: string, land: number, kind: MiniKind, tier: number, withHouse = true): string {
  return ensureTex(scene, `sea-${id}-${miniRadius(land)}-${kind}-${tier}${withHouse ? '' : '-n'}`, () => drawSeaIsland(id, land, kind, tier, withHouse));
}
/** Phủ chúa (bộ mới) đặt trên đảo người chơi ở hải đồ. */
export function hallTex(scene: Phaser.Scene, tier: number): string {
  const t = Math.max(1, Math.min(5, tier));
  return ensureTex(scene, `hall2-${t}`, () => drawHall(t));
}
/** Thuyền trên hải đồ: cờ đỏ cho thuyền mình/đồng minh, cờ xám cho thuyền lạ. */
export function seaBoatTex(scene: Phaser.Scene, tier: number, known: boolean): string {
  const kind = tier <= 1 ? 'ghe' : tier <= 3 ? 'buom' : 'chien';
  return ensureTex(scene, `seaboat-${kind}-${known ? 'r' : 'g'}`, () => drawBoat(kind, { no: tier >= 3, da: tier >= 4 }, known ? '#ee5d4a' : '#9aa3ad'));
}

const boxCache = new Map<string, { x: number; y: number; w: number; h: number }>();
/** Phần có hình của một texture (để đặt vùng chạm, biểu cảm, nhãn cho khít). */
export function texBox(scene: Phaser.Scene, key: string) {
  let b = boxCache.get(key);
  if (!b) {
    b = opaqueBox(scene.textures.get(key).getSourceImage() as HTMLCanvasElement);
    boxCache.set(key, b);
  }
  return b;
}

const urlCache = new Map<string, string>();
export function iconUrl(key: string): string {
  let u = urlCache.get('i' + key);
  if (!u) {
    u = hdUrl(drawIcon(key), HD);
    urlCache.set('i' + key, u);
  }
  return u;
}
export function portraitUrl(key: string): string {
  let u = urlCache.get('p' + key);
  if (!u) {
    u = hdUrl(charCanvas(key), 4);
    urlCache.set('p' + key, u);
  }
  return u;
}
export function canvasUrl(key: string, make: () => Canvas, scale = 2): string {
  let u = urlCache.get('c' + key);
  if (!u) {
    u = hdUrl(make(), scale);
    urlCache.set('c' + key, u);
  }
  return u;
}

/** Mặt nước dựng sẵn thành ảnh lớn (rẻ hơn TileSprite khi vẽ mỗi khung hình). */
export function waterTex(scene: Phaser.Scene, w: number, h: number, frame: number, tint = ''): string {
  // w, h tính theo điểm ảnh gốc; ảnh thật lớn gấp HD lần
  return ensureTex(scene, `wbig-${w}x${h}-${frame}${tint}`, () => {
    // ô nước lặp lại: phóng thẳng (không làm mịn mép) để ghép không lộ đường nối
    const base = drawWater(frame);
    const tile = document.createElement('canvas');
    tile.width = base.width * HD;
    tile.height = base.height * HD;
    const tc = tile.getContext('2d')!;
    tc.imageSmoothingEnabled = false;
    tc.drawImage(base, 0, 0, tile.width, tile.height);
    const c = document.createElement('canvas');
    c.width = w * HD;
    c.height = h * HD;
    const ctx = c.getContext('2d')!;
    for (let y = 0; y < c.height; y += tile.height) for (let x = 0; x < c.width; x += tile.width) ctx.drawImage(tile, x, y);
    if (tint) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, c.width, c.height);
    }
    return c;
  }, true);
}
