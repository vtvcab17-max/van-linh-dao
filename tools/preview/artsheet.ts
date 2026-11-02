// Bảng xem nhanh toàn bộ đồ họa (kiến trúc theo bậc, thuyền, nhân vật, đảo) — chỉ dùng khi phát triển.
import { drawLeu, drawCuoc, drawRao, drawThuyen } from '../../client/src/art/buildings';
import { drawAvatar } from '../../client/src/art/avatar';
import { drawIsland, drawSeaIsland, LOOKS } from '../../client/src/art/islands';
import { avatarFrom, type Avatar } from '../../shared/avatar';
import { newPlayer } from '../../shared/logic';
import { hashStr } from '../../shared/rng';
import { WILDS } from '../../shared/data';

const root = document.body;
root.style.cssText = 'margin:0;background:#20303a;color:#fff;font:12px sans-serif;padding:8px';
function row(title: string, items: HTMLCanvasElement[], scale: number) {
  const h = document.createElement('div');
  h.textContent = title;
  h.style.margin = '6px 0 2px';
  root.appendChild(h);
  const r = document.createElement('div');
  r.style.cssText = 'display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap';
  for (const c of items) {
    c.style.cssText = `width:${c.width * scale}px;height:${c.height * scale}px;image-rendering:pixelated;background:#7fb86a33`;
    r.appendChild(c);
  }
  root.appendChild(r);
}
const tiers = [1, 2, 3, 4, 5];
const mode = location.hash.slice(1) || 'b';
if (mode === 'b') {
  row('Nhà chính', tiers.map((t) => drawLeu(t, false, 'thuong')), 4);
  row('Cuốc', tiers.map((t) => drawCuoc(t, false, 'vui')), 4);
  row('Lũy tre', tiers.map((t) => drawRao(t, false, 'thuong')), 4);
  row('Thuyền', tiers.map((t) => drawThuyen(t, false, 'thuong')), 4);
} else if (mode === 'a') {
  const avs: Avatar[] = [];
  for (let g = 0; g < 2; g++) for (let ha = 0; ha < 5; ha++) avs.push({ g: g as 0 | 1, sk: ha % 4, ha, hc: ha, to: ha, tc: ha + g * 3, hat: 0, it: 0 });
  row('Nam / Nữ — 5 kiểu tóc, 5 trang phục', avs.map(drawAvatar), 5);
  const hats: Avatar[] = [0, 1, 2, 3, 4, 5].map((hat) => ({ g: (hat % 2) as 0 | 1, sk: 1, ha: hat % 5, hc: 0, to: hat % 5, tc: hat, hat, it: hat % 5 }));
  row('Mũ nón + vật cầm', hats.map(drawAvatar), 5);
  row('Ngẫu nhiên', Array.from({ length: 12 }, (_, i) => drawAvatar(avatarFrom('x' + i))), 4);
} else {
  row('Đảo trên hải đồ (người chơi)', Array.from({ length: 8 }, (_, i) => drawSeaIsland('p' + i, 16 + i * 14, i % 2 ? 'player' : 'bot', 1 + (i % 5))), 3);
  row('Đảo hoang', WILDS.map((w) => drawSeaIsland(w.id, 20 + w.level * 8, 'wild')), 3);
  row('Kiểu đất: ' + LOOKS.map((l) => l.name).join(' · '), LOOKS.map((_, i) => {
    const s = newPlayer('isl' + i, 'x', 0);
    const id = Array.from({ length: 400 }, (_, k) => 'u' + k).find((k) => hashStr(k) % LOOKS.length === i)!;
    const full = drawIsland(newPlayer(id, 'x', 0).land, hashStr(id));
    void s;
    const c = document.createElement('canvas');
    c.width = 112; c.height = 112;
    c.getContext('2d')!.drawImage(full, 104, 104, 112, 112, 0, 0, 112, 112);
    return c;
  }), 2);
}
