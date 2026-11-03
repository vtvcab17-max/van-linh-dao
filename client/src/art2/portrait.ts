// Ảnh tướng, vũ khí truyền thuyết cho giao diện (vẽ một lần, giữ trong bộ nhớ).
import { enhance } from '../art/hd';
import { C, cnv, outline, P, scaleUp } from './pal';
import { drawUnit, GENERALS as LOOKS, TROOPS, type Look } from './units';

const cache = new Map<string, string>();
const url = (key: string, make: () => HTMLCanvasElement) => {
  let u = cache.get(key);
  if (!u) {
    u = make().toDataURL();
    cache.set(key, u);
  }
  return u;
};

/** Chân dung tướng (lính chibi làm mịn kiểu 32-bit). */
export function generalUrl(id: string, k = 3): string {
  return url(`g:${id}:${k}`, () => {
    const g = LOOKS.find((x) => x.id === id) ?? LOOKS[0];
    return scaleUp(enhance(drawUnit(g.look)), k);
  });
}

/** Biểu tượng vũ khí truyền thuyết 16x16. */
export function legWeaponUrl(id: string, k = 4): string {
  return url(`w:${id}:${k}`, () => {
    const [c, x] = cnv(18, 18);
    const p = new P(x);
    if (id === 'nothan') {
      p.h(2, 15, 9, C.gold); p.h(2, 6, 10, C.gold2);
      for (let y = 3; y <= 15; y++) p.px(13 + Math.round(Math.abs(y - 9) / 3), y, C.gold2);
      p.v(12, 4, 14, '#fff4d8'); p.px(16, 9, C.metal);
    } else if (id === 'roisat') {
      p.line(3, 15, 14, 2, '#5f6878'); p.line(4, 15, 15, 2, '#8d96a6');
      p.rect(2, 14, 3, 3, C.wood2); p.px(14, 3, C.red);
    } else if (id === 'dinhba') {
      p.v(8, 5, 16, C.wood); p.v(9, 5, 16, C.wood2);
      p.h(4, 13, 5, C.metal3); for (const xx of [4, 8, 13]) p.v(xx, 1, 4, C.metal); p.px(8, 0, C.metal);
    } else {
      p.v(8, 5, 16, C.wood2); p.v(9, 5, 16, C.wood3);
      p.ell(8, 3, 2, 2, C.green); p.px(7, 2, '#d6ffbf');
    }
    return scaleUp(enhance(outline(c)), Math.max(1, Math.round(k / 2)));
  });
}

/** Lính chibi theo binh chủng (danbinh, khien, cung, no, riu, thuy). */
export function troopUrl(id: string, k = 2): string {
  return url(`t:${id}:${k}`, () => scaleUp(enhance(drawUnit((TROOPS.find((x) => x.id === id) ?? TROOPS[0]).look)), k));
}
/** Nhân vật chibi theo dáng tự đặt (thợ, dân, học trò...). */
export function lookUrl(key: string, look: Look, k = 2): string {
  return url(`l:${key}:${k}`, () => scaleUp(enhance(drawUnit(look)), k));
}
