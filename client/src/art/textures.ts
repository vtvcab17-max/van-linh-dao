import type Phaser from 'phaser';
import type { LvKey } from '../../../shared/data';
import type { Avatar } from '../../../shared/avatar';
import { charCanvas, drawChest, drawCuoc, drawEmote, drawIcon, drawLeu, drawNode, drawRao, drawThuyen, drawWater } from './sprites';
import { opaqueBox } from './buildings';
import { drawSeaIsland, miniRadius, type MiniKind } from './islands';
import { avatarTexKey, drawAvatar } from './avatar';
import type { Canvas } from './pixel';

export function ensureTex(scene: Phaser.Scene, key: string, make: () => Canvas): string {
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, make());
  return key;
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
  ensureTex(scene, 'water0', () => drawWater(0));
  ensureTex(scene, 'water1', () => drawWater(1));
  for (const k of ['an', 'ngoc', 'ha', 'chau', 'rua', 'cuagai', 'sualua', 'khida', 'canoc', 'haitac', 'baytheo', 'cuada']) ensureTex(scene, `ch-${k}`, () => charCanvas(k));
  for (let t = 1; t <= 5; t++) ensureTex(scene, `ch-rao${t}`, () => charCanvas(`rao${t}`));
  for (let t = 1; t <= 5; t++) ensureTex(scene, `boat-${t}`, () => drawThuyen(t, false, 'thuong'));
}

/** Nhân vật chủ đảo theo dáng vẻ đã chỉnh. */
export function avatarTex(scene: Phaser.Scene, a: Avatar): string {
  return ensureTex(scene, avatarTexKey(a), () => drawAvatar(a));
}

/** Đảo trên hải đồ: mỗi đảo một hình riêng; vẽ lại khi đảo lớn thêm hoặc nhà chính lên bậc. */
export function seaIslandTex(scene: Phaser.Scene, id: string, land: number, kind: MiniKind, tier: number): string {
  return ensureTex(scene, `sea-${id}-${miniRadius(land)}-${kind}-${tier}`, () => drawSeaIsland(id, land, kind, tier));
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
    u = drawIcon(key).toDataURL();
    urlCache.set('i' + key, u);
  }
  return u;
}
export function portraitUrl(key: string): string {
  let u = urlCache.get('p' + key);
  if (!u) {
    const src = charCanvas(key);
    const c = document.createElement('canvas');
    c.width = src.width * 3;
    c.height = src.height * 3;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, c.width, c.height);
    u = c.toDataURL();
    urlCache.set('p' + key, u);
  }
  return u;
}
export function canvasUrl(key: string, make: () => Canvas, scale = 2): string {
  let u = urlCache.get('c' + key);
  if (!u) {
    const src = make();
    const c = document.createElement('canvas');
    c.width = src.width * scale;
    c.height = src.height * scale;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, c.width, c.height);
    u = c.toDataURL();
    urlCache.set('c' + key, u);
  }
  return u;
}

/** Mặt nước dựng sẵn thành ảnh lớn (rẻ hơn TileSprite khi vẽ mỗi khung hình). */
export function waterTex(scene: Phaser.Scene, w: number, h: number, frame: number, tint = ''): string {
  return ensureTex(scene, `wbig-${w}x${h}-${frame}${tint}`, () => {
    const tile = drawWater(frame);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) ctx.drawImage(tile, x, y);
    if (tint) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, w, h);
    }
    return c;
  });
}
