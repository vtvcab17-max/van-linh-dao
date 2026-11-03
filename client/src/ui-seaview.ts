// Cảnh biển động (chỉ đọc): thuyền giữa biển với tiến độ chuyến đi, và tầm nhìn từ tháp canh.
import type { UI } from './ui';
import { homeCell } from '../../shared/logic';
import { routePeriod, routesNear } from '../../shared/economy';
import { drawBoat } from './art2/builds';
import { C } from './art2/pal';
import { sound } from './audio';

const LW = 120;
const clock = (ms: number) => {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return h ? `${h} giờ ${m} phút` : `${m} phút ${String(s).padStart(2, '0')} giây`;
};

export function openSeaView(ui: UI, kind: 'boat' | 'tower') {
  document.getElementById('seaview')?.remove();
  const root = document.createElement('div');
  root.id = 'seaview';
  root.style.cssText = 'position:fixed;inset:0;z-index:40;background:#0d1b2a;display:flex;flex-direction:column;touch-action:none';
  const LH = Math.round((LW * Math.max(innerHeight, 1)) / Math.max(innerWidth, 1));
  root.innerHTML = `<canvas style="width:100%;flex:1;min-height:0;image-rendering:pixelated"></canvas>
    <div style="position:absolute;left:12px;right:12px;top:max(12px,env(safe-area-inset-top,0px));display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
      <div class="panel" style="padding:8px 12px"><b id="svT" style="font:22px/1 var(--font-pixel);color:var(--gold)"></b><div id="svD" class="muted small" style="margin-top:4px"></div></div>
      <button id="svX" type="button" style="font:18px var(--font-pixel)">Quay lại</button></div>`;
  document.body.appendChild(root);
  const cv = root.querySelector('canvas')!;
  cv.width = LW;
  cv.height = LH;
  const x = cv.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  const T = root.querySelector<HTMLElement>('#svT')!;
  const D = root.querySelector<HTMLElement>('#svD')!;
  sound.setMood('sea');
  let raf = 0;
  const close = () => {
    cancelAnimationFrame(raf);
    root.remove();
    sound.setMood('island');
  };
  root.querySelector('#svX')!.addEventListener('click', close);

  const boats = new Map<string, HTMLCanvasElement>();
  const boat = (k: 'ghe' | 'buom' | 'chien') => boats.get(k) ?? (boats.set(k, drawBoat(k)), boats.get(k)!);
  const horizon = Math.round(LH * (kind === 'tower' ? 0.55 : 0.32));
  const t0 = performance.now();

  const frame = (now: number) => {
    const t = (now - t0) / 1000;
    const s = ui.store.s;
    const gt = s.gt + (Date.now() - s.lastReal) * s.speed;
    // trời
    const g = x.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, '#6fb8e8');
    g.addColorStop(1, '#cdeefc');
    x.fillStyle = g;
    x.fillRect(0, 0, LW, horizon);
    x.fillStyle = '#ffe98a';
    x.beginPath();
    x.arc(LW * 0.78, horizon * 0.4, 7, 0, 7);
    x.fill();
    for (let i = 0; i < 3; i++) {
      const cx = ((t * (2 + i) + i * 50) % (LW + 40)) - 20;
      x.fillStyle = '#fff';
      x.fillRect(cx, 8 + i * 9, 18 - i * 3, 3);
      x.fillRect(cx + 4, 6 + i * 9, 10 - i * 2, 3);
    }
    // biển
    x.fillStyle = C.sea2;
    x.fillRect(0, horizon, LW, LH - horizon);
    for (let y = horizon; y < LH; y += 4) {
      x.fillStyle = (y / 4) % 2 ? C.sea : C.sea3;
      x.fillRect(0, y, LW, 2);
      for (let k = 0; k < LW; k += 14) {
        const px = (k + Math.sin(t * 0.8 + y) * 3 + y * 3) % LW;
        x.fillStyle = C.foam;
        x.fillRect(px, y + 1, 5, 1);
      }
    }
    if (kind === 'boat') {
      const ship = s.fleet[0]?.k ?? 'ghe';
      const v = s.voyage;
      let prog = 0.5;
      let line = 'Thuyền neo ở bến, chờ lệnh ra khơi.';
      if (v) {
        const going = v.phase === 'di';
        const a = going ? v.departAt : v.arriveAt;
        const b = going ? v.arriveAt : v.returnAt;
        const p = Math.min(1, Math.max(0, (gt - a) / Math.max(1, b - a)));
        prog = going ? p : 1 - p;
        line = `${going ? 'Đang đi tới' : 'Đang về từ'} ${v.targetName} · còn ${clock(b - gt)}`;
      }
      T.textContent = v ? 'Hành trình' : 'Thuyền trên biển';
      D.textContent = line;
      const bc = boat(ship);
      const sc = 34 / bc.width;
      const bx = 10 + prog * (LW - 20 - bc.width * sc);
      const by = horizon + 18 + Math.sin(t * 1.6) * 1.5;
      x.save();
      x.translate(bx + (bc.width * sc) / 2, by);
      x.rotate(Math.sin(t * 1.3) * 0.04);
      if (v && v.phase === 've') x.scale(-1, 1);
      x.drawImage(bc, -(bc.width * sc) / 2, -bc.height * sc, bc.width * sc, bc.height * sc);
      x.restore();
      // bọt nước sau thuyền
      x.fillStyle = C.foam;
      for (let i = 0; i < 5; i++) x.fillRect(bx - 4 - i * 3, by + 1 + (i % 2), 3, 1);
      if (v) {
        // đảo đích ở xa
        x.fillStyle = C.grass3;
        x.fillRect(LW - 18, horizon - 2, 14, 3);
        x.fillStyle = C.sand;
        x.fillRect(LW - 20, horizon + 1, 18, 1);
      }
    } else {
      const ships = routesNear(homeCell(s), routePeriod(ui.store.now())).length;
      T.textContent = 'Trên tháp canh';
      D.textContent = ships ? `Thấy ${ships} thương thuyền đang ghé gần đảo.` : 'Biển lặng, chưa thấy thương thuyền nào.';
      for (let i = 0; i < ships; i++) {
        const bc = boat(i % 2 ? 'buom' : 'ghe');
        const bx = ((t * (3 + i) + i * 40) % (LW + 30)) - 15;
        const by = horizon + 4 + i * 6 + Math.sin(t + i) * 0.8;
        const k = 16 / bc.width;
        x.drawImage(bc, bx, by - bc.height * k, bc.width * k, bc.height * k);
      }
      // lan can đá
      const wy = LH - 22;
      x.fillStyle = C.stone2;
      x.fillRect(0, wy, LW, 22);
      x.fillStyle = C.stone3;
      for (let k = 0; k < LW; k += 12) x.fillRect(k, wy - 5, 8, 5);
      x.fillStyle = '#3d2b2b';
      x.fillRect(0, wy, LW, 1);
      for (let yy = wy + 6; yy < LH; yy += 6) x.fillRect(0, yy, LW, 1);
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
}
