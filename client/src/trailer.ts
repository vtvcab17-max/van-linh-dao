// Trailer hoạt hình ~32 giây chiếu sau khi đăng nhập (một lần mỗi máy, xem lại trong Cài đặt).
// Vẽ bằng chính hình pixel của game (đã nâng 32-bit), nhạc ngũ cung tổng hợp bằng Web Audio, không cần file ngoài.
import type { Avatar } from '../../shared/avatar';
import { drawAvatar } from './art/avatar';
import { drawThuyTinh } from './art/boss';
import { drawCuoc, drawLeu, drawThuyen } from './art/buildings';
import { enhance } from './art/hd';
import { drawSeaIsland } from './art/islands';
import { drawNode } from './art/sprites';
import type { Canvas } from './art/pixel';

const W = 640;
const H = 360;

interface Scene {
  dur: number;
  cap: string;
  draw: (g: CanvasRenderingContext2D, t: number, time: number) => void;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (t: number) => Math.max(0, Math.min(1, t));
const ease = (t: number) => t * t * (3 - 2 * t);

function sky(g: CanvasRenderingContext2D, top: string, bot: string, h = H) {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, top);
  gr.addColorStop(1, bot);
  g.fillStyle = gr;
  g.fillRect(0, 0, W, h);
}

function sea(g: CanvasRenderingContext2D, y: number, a: string, b: string, time: number, speed = 30) {
  g.fillStyle = a;
  g.fillRect(0, y, W, H - y);
  g.fillStyle = b;
  for (let row = 0; y + row * 10 < H; row++) {
    const yy = Math.round(y + 4 + row * 10 + row * row * 0.6);
    const off = (time * speed * (1 + row * 0.25)) % 48;
    for (let x = -48; x < W + 48; x += 48) g.fillRect(Math.round(x + off + (row % 2) * 20), yy, 14 + row * 2, 2);
  }
}

function stars(g: CanvasRenderingContext2D, time: number, n = 60) {
  for (let i = 0; i < n; i++) {
    const x = (i * 97) % W;
    const y = (i * 53) % 170;
    const tw = 0.5 + 0.5 * Math.sin(time * 3 + i);
    g.fillStyle = `rgba(255,248,220,${0.3 + tw * 0.6})`;
    g.fillRect(x, y, i % 7 ? 2 : 3, i % 7 ? 2 : 3);
  }
}

function sprite(g: CanvasRenderingContext2D, img: Canvas, cx: number, by: number, k = 1, flip = false) {
  const w = img.width * k;
  const h = img.height * k;
  g.save();
  if (flip) {
    g.translate(Math.round(cx), 0);
    g.scale(-1, 1);
    g.drawImage(img, Math.round(-w / 2), Math.round(by - h), w, h);
  } else g.drawImage(img, Math.round(cx - w / 2), Math.round(by - h), w, h);
  g.restore();
}

function sparkle(g: CanvasRenderingContext2D, x: number, y: number, s: number, col = '#f6d34d') {
  g.fillStyle = col;
  g.fillRect(x - s, y, s * 2 + 1, 1);
  g.fillRect(x, y - s, 1, s * 2 + 1);
  g.fillRect(x - 1, y - 1, 3, 3);
}

function bubble(g: CanvasRenderingContext2D, x: number, y: number, text: string) {
  g.font = 'bold 15px "Be Vietnam Pro", sans-serif';
  const w = g.measureText(text).width + 20;
  g.fillStyle = '#1d1b2a';
  g.fillRect(x - 2, y - 2, w + 4, 30);
  g.fillStyle = '#fbf3dc';
  g.fillRect(x, y, w, 26);
  g.fillRect(x + 14, y + 26, 8, 6);
  g.fillStyle = '#1d1b2a';
  g.fillText(text, x + 10, y + 18);
}

// ---------- nhạc ngũ cung ----------
function music(dur: number): { stop: () => void; mute: (m: boolean) => void } | null {
  try {
    const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new AC();
    const master = ac.createGain();
    master.gain.value = 0.35;
    master.connect(ac.destination);
    const t0 = ac.currentTime + 0.1;
    const note = (f: number, at: number, len: number, type: OscillatorType, vol: number) => {
      const o = ac.createOscillator();
      const v = ac.createGain();
      o.type = type;
      o.frequency.value = f;
      v.gain.setValueAtTime(0, t0 + at);
      v.gain.linearRampToValueAtTime(vol, t0 + at + 0.03);
      v.gain.exponentialRampToValueAtTime(0.001, t0 + at + len);
      o.connect(v).connect(master);
      o.start(t0 + at);
      o.stop(t0 + at + len + 0.05);
    };
    const drum = (at: number, vol = 0.5) => {
      const o = ac.createOscillator();
      const v = ac.createGain();
      o.frequency.setValueAtTime(110, t0 + at);
      o.frequency.exponentialRampToValueAtTime(40, t0 + at + 0.25);
      v.gain.setValueAtTime(vol, t0 + at);
      v.gain.exponentialRampToValueAtTime(0.001, t0 + at + 0.35);
      o.connect(v).connect(master);
      o.start(t0 + at);
      o.stop(t0 + at + 0.4);
    };
    const thunder = (at: number) => {
      const len = 1.6;
      const buf = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
      const src = ac.createBufferSource();
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 500;
      const v = ac.createGain();
      v.gain.value = 0.7;
      src.buffer = buf;
      src.connect(f).connect(v).connect(master);
      src.start(t0 + at);
    };
    // thang ngũ cung (Đô Rê Mi Sol La) như tiếng sáo trúc
    const P = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3, 784];
    const melody = [4, 3, 4, 5, 4, 3, 1, 2, 3, 2, 1, 0, 1, 3, 4, 3, 5, 6, 5, 4, 3, 4, 2, 1];
    for (let i = 0; i < melody.length * 2; i++) {
      const at = 9 + i * 0.5;
      if (at > dur - 6) break;
      note(P[melody[i % melody.length]] * (at > 22 ? 1 : 1), at, 0.45, 'triangle', 0.18);
    }
    for (let i = 0; i < dur - 1; i++) if (i >= 4) drum(i, i >= 22 ? 0.7 : 0.35);
    for (let i = 0; i < 4; i++) note(110, i, 1, 'sine', 0.12);
    thunder(4.2);
    thunder(6.5);
    thunder(23.5);
    // hợp âm kết hùng tráng
    for (const f of [261.6, 329.6, 392, 523.3]) note(f, 27, 4, 'sawtooth', 0.06);
    for (const f of [261.6, 392, 523.3]) note(f, 27, 4, 'triangle', 0.12);
    return {
      stop: () => {
        master.gain.setTargetAtTime(0, ac.currentTime, 0.2);
        setTimeout(() => void ac.close(), 600);
      },
      mute: (m) => (master.gain.value = m ? 0 : 0.35),
    };
  } catch {
    return null;
  }
}

/** Chiếu trailer; xong (hoặc bấm Bỏ qua) thì resolve. */
export function playTrailer(av: Avatar): Promise<void> {
  return new Promise((done) => {
    const E = (c: Canvas) => enhance(c);
    const boss = E(drawThuyTinh());
    const hero = E(drawAvatar(av));
    const leus = [1, 2, 3, 4, 5].map((t) => E(drawLeu(t, false, 'vui')));
    const boats = [1, 2, 3, 4, 5].map((t) => E(drawThuyen(t, false, 'thuong')));
    const cuoc = E(drawCuoc(1, false, 'vui'));
    const cuocBlink = E(drawCuoc(1, true, 'vui'));
    const palm = E(drawNode('palm'));
    const isl2 = E(drawSeaIsland('trailer-b', 60, 'wild', 1));
    const isl3 = E(drawSeaIsland('trailer-c', 90, 'wild', 1));
    const storm = E(drawSeaIsland('thuytinh', 60, 'wild', 1));

    const scenes: Scene[] = [
      {
        dur: 4,
        cap: 'Đêm rằm tháng Bảy, trăng đỏ như máu...',
        draw: (g, t, time) => {
          sky(g, '#0b0b1e', '#3a1430', 250);
          stars(g, time);
          const my = lerp(260, 110, ease(t));
          const glow = g.createRadialGradient(470, my, 10, 470, my, 90);
          glow.addColorStop(0, 'rgba(255,90,70,.55)');
          glow.addColorStop(1, 'rgba(255,90,70,0)');
          g.fillStyle = glow;
          g.fillRect(360, my - 100, 220, 200);
          g.fillStyle = '#d23b31';
          g.beginPath();
          g.arc(470, my, 34, 0, 7);
          g.fill();
          g.fillStyle = '#a82a25';
          g.fillRect(452, my - 10, 10, 6);
          g.fillRect(476, my + 8, 14, 5);
          sea(g, 250, '#120f2a', '#3a1d3e', time);
          g.fillStyle = 'rgba(210,59,49,.5)';
          for (let i = 0; i < 6; i++) g.fillRect(450 - i * 3, 256 + i * 16, 40 + i * 6, 2);
        },
      },
      {
        dur: 5,
        cap: 'Thủy Tinh nổi giận, dâng nước nhấn chìm đất liền, mở ra Vạn Đảo.',
        draw: (g, t, time) => {
          const flash = (t > 0.05 && t < 0.1) || (t > 0.5 && t < 0.54);
          sky(g, flash ? '#d8dcff' : '#101030', flash ? '#9aa4ff' : '#2a1838', 300);
          if (!flash) stars(g, time, 25);
          // mưa
          g.fillStyle = 'rgba(170,200,255,.35)';
          for (let i = 0; i < 90; i++) {
            const x = (i * 71 + time * 300) % (W + 40) - 20;
            const y = (i * 37 + time * 600) % H;
            g.fillRect(x, y, 1, 9);
          }
          const rise = ease(clamp(t * 1.4));
          const shake = t < 0.9 ? Math.round(Math.sin(time * 40) * 3 * (1 - t)) : 0;
          sprite(g, boss, W / 2 + shake, lerp(420, 300, rise), 2);
          sea(g, lerp(300, 230, ease(t)), '#16305a', '#3f6ea8', time, 80);
          g.fillStyle = 'rgba(233,248,251,.85)';
          for (let x = 0; x < W; x += 6) g.fillRect(x, Math.round(lerp(300, 230, ease(t)) - 2 + Math.sin(x / 15 + time * 8) * 3), 4, 3);
          if (flash) {
            g.fillStyle = '#ffffff';
            g.fillRect(120, 0, 3, 120);
            g.fillRect(122, 120, 3, 60);
            g.fillRect(124, 180, 3, 50);
          }
        },
      },
      {
        dur: 5,
        cap: 'Bạn tỉnh dậy trên một mỏm đảo nhỏ, tay vẫn cầm cái cuốc rỉ... rồi cái cuốc cất tiếng nói.',
        draw: (g, t, time) => {
          sky(g, '#7ec8f0', '#cdeefa', 200);
          g.fillStyle = 'rgba(255,255,255,.85)';
          for (const [x, y, w] of [[80, 50, 90], [400, 70, 120], [250, 30, 70]]) {
            const xx = (x + time * 8) % (W + 120) - 60;
            g.fillRect(xx, y, w, 14);
            g.fillRect(xx + 14, y - 8, w - 40, 10);
          }
          sea(g, 200, '#3a90c2', '#a8e6f0', time);
          // mỏm đảo nhỏ nhìn ngang: bãi cát, cỏ, cây dừa
          g.fillStyle = '#d6b26d';
          g.beginPath();
          g.ellipse(W / 2, 282, 190, 44, 0, 0, 7);
          g.fill();
          g.fillStyle = '#f2d99c';
          g.beginPath();
          g.ellipse(W / 2, 276, 180, 36, 0, 0, 7);
          g.fill();
          g.fillStyle = '#57a043';
          g.beginPath();
          g.ellipse(W / 2 - 10, 266, 120, 18, 0, 0, 7);
          g.fill();
          g.fillStyle = '#86c95c';
          g.beginPath();
          g.ellipse(W / 2 - 14, 262, 104, 12, 0, 0, 7);
          g.fill();
          g.fillStyle = 'rgba(233,248,251,.8)';
          for (let x = W / 2 - 200; x < W / 2 + 200; x += 8) g.fillRect(x, 318 + Math.round(Math.sin(x / 12 + time * 5) * 2), 5, 2);
          sprite(g, palm, W / 2 - 120, 272, 2.6);
          const up = ease(clamp(t * 2));
          // nằm sóng soài rồi đứng dậy
          if (up < 0.6) {
            g.save();
            g.translate(W / 2 - 40, 266);
            g.rotate(-Math.PI / 2 * (1 - up / 0.6));
            g.drawImage(hero, -hero.width, -hero.height * 2, hero.width * 2, hero.height * 2);
            g.restore();
          } else sprite(g, hero, W / 2 - 40, 268, 2);
          const blink = Math.floor(time * 2) % 4 === 0;
          sprite(g, blink ? cuocBlink : cuoc, W / 2 + 40, 270, 2);
          if (t > 0.45) bubble(g, W / 2 + 60, 120, 'Nhóc! Dậy đi, có việc rồi!');
        },
      },
      {
        dur: 5,
        cap: 'Lắng nghe tiếng lòng vạn vật. Xây nhà, rèn cuốc, đan lũy tre.',
        draw: (g, t, time) => {
          sky(g, '#f3b36b', '#fde7b8', 220);
          sea(g, 220, '#3a90c2', '#a8e6f0', time);
          g.fillStyle = '#86c95c';
          g.beginPath();
          g.ellipse(W / 2, 300, 230, 70, 0, 0, 7);
          g.fill();
          g.fillStyle = '#f2d99c';
          g.beginPath();
          g.ellipse(W / 2, 318, 240, 55, 0, 0, Math.PI);
          g.fill();
          const i = Math.min(4, Math.floor(t * 5));
          const local = t * 5 - i;
          const pop = local < 0.15 ? 1 + (0.15 - local) * 2 : 1;
          sprite(g, leus[i], W / 2, 300, 2 * pop);
          if (local < 0.3) for (let k = 0; k < 8; k++) sparkle(g, W / 2 + Math.cos(k) * (60 + local * 200), 230 + Math.sin(k * 2) * 60, 3);
          g.font = 'bold 22px VT323, monospace';
          g.fillStyle = '#5e2a1f';
          g.fillText(`Bậc ${i + 1}`, W / 2 - 30, 70);
        },
      },
      {
        dur: 4,
        cap: 'Đóng thuyền, ra khơi, chinh phục Vạn Đảo.',
        draw: (g, t, time) => {
          sky(g, '#5fb6e6', '#d6f2fb', 190);
          sea(g, 190, '#2f7fb4', '#a8e6f0', time, 90);
          sprite(g, isl2, 520 - t * 200, 250, 2);
          sprite(g, isl3, 140 - t * 120, 230, 1.5);
          for (let i = 0; i < 5; i++) {
            const x = lerp(-120, W + 140, clamp(t * 1.6 - i * 0.15));
            sprite(g, boats[i], x, 300 + i * 10 + Math.sin(time * 4 + i) * 3, 1.6 + i * 0.15, true);
          }
        },
      },
      {
        dur: 4,
        cap: 'Mỗi tuần, Thủy Tinh trỗi dậy ở Mắt Bão. Thắng thì phi thăng. Thua thì mất tất cả.',
        draw: (g, t, time) => {
          const flash = Math.floor(time * 6) % 9 === 0;
          sky(g, flash ? '#c9ccff' : '#1a1a33', '#3b2850', 230);
          sea(g, 230, '#18284a', '#45618f', time, 120);
          sprite(g, storm, 170, 320, 2.4);
          sprite(g, boss, 170 + Math.sin(time * 3) * 4, 270, 1.6);
          const charge = ease(clamp(t * 1.5));
          sprite(g, boats[4], lerp(W + 80, 430, charge), 315 + Math.sin(time * 5) * 4, 1.8, true);
          sprite(g, hero, lerp(W + 80, 430, charge), 262, 1.4, true);
          if (t > 0.6) {
            for (let k = 0; k < 10; k++) sparkle(g, 300 + Math.cos(k + time * 9) * 40, 200 + Math.sin(k * 3 + time * 9) * 30, 4, k % 2 ? '#ffffff' : '#f6d34d');
            g.font = 'bold 26px VT323, monospace';
            g.fillStyle = '#ff9b3a';
            g.fillText('-' + (900 + Math.floor(time * 37) % 400), 200, 150 - (t - 0.6) * 80);
          }
        },
      },
      {
        dur: 5,
        cap: '',
        draw: (g, t, time) => {
          sky(g, '#2a1512', '#5e2a1f');
          g.save();
          g.translate(W / 2, 150);
          for (let i = 0; i < 16; i++) {
            g.rotate(Math.PI / 8);
            g.fillStyle = `rgba(246,211,77,${0.06 + 0.04 * Math.sin(time * 2 + i)})`;
            g.beginPath();
            g.moveTo(0, 0);
            g.lineTo(-30, -400);
            g.lineTo(30, -400);
            g.fill();
          }
          g.restore();
          const a = ease(clamp(t * 2));
          g.globalAlpha = a;
          g.textAlign = 'center';
          g.font = '600 15px "Be Vietnam Pro", sans-serif';
          g.fillStyle = '#e8b84f';
          g.fillText('B E T A   H O L D I N G   G I Ớ I   T H I Ệ U', W / 2, 92);
          g.font = '72px VT323, monospace';
          g.fillStyle = '#1d1b2a';
          g.fillText('Vạn Linh Đảo', W / 2 + 3, 170);
          g.fillStyle = '#d23b31';
          g.fillText('Vạn Linh Đảo', W / 2 + 2, 167);
          g.fillStyle = '#fbf3dc';
          g.fillText('Vạn Linh Đảo', W / 2, 164);
          g.font = 'italic 16px "Be Vietnam Pro", sans-serif';
          g.fillStyle = '#cfc6ba';
          g.fillText('Vạn vật đều có hồn. Lắng nghe, rồi sống sót.', W / 2, 205);
          sprite(g, hero, W / 2 - 70, 320, 2);
          sprite(g, leus[4], W / 2 + 40, 330, 1.2);
          if (t > 0.5 && Math.floor(time * 2) % 2) {
            g.font = '22px VT323, monospace';
            g.fillStyle = '#f6d34d';
            g.fillText('Chạm để vào đảo', W / 2, 352);
          }
          g.textAlign = 'left';
          g.globalAlpha = 1;
        },
      },
    ];
    const total = scenes.reduce((t, s) => t + s.dur, 0);

    const box = document.createElement('div');
    box.id = 'trailer';
    box.innerHTML = `<canvas width="${W}" height="${H}"></canvas><p class="cap"></p><div class="tr-ctl"><button type="button" class="mute">Tắt tiếng</button><button type="button" class="skip">Bỏ qua ›</button></div><i class="bar"><span></span></i>`;
    document.body.appendChild(box);
    const cv = box.querySelector('canvas')!;
    const g = cv.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    const cap = box.querySelector('.cap') as HTMLElement;
    const bar = box.querySelector('.bar span') as HTMLElement;
    const snd = music(total);
    let muted = false;
    let raf = 0;
    let closed = false;
    const t0 = performance.now();
    let lastCap = '';
    const close = () => {
      if (closed) return;
      closed = true;
      cancelAnimationFrame(raf);
      snd?.stop();
      box.classList.add('out');
      setTimeout(() => {
        box.remove();
        done();
      }, 450);
    };
    box.querySelector('.skip')!.addEventListener('click', close);
    box.querySelector('.mute')!.addEventListener('click', (e) => {
      muted = !muted;
      snd?.mute(muted);
      (e.target as HTMLElement).textContent = muted ? 'Bật tiếng' : 'Tắt tiếng';
    });
    cv.addEventListener('click', () => {
      if ((performance.now() - t0) / 1000 > total - 3) close();
    });
    const frame = () => {
      const time = (performance.now() - t0) / 1000;
      if (time >= total + 2) return close();
      let acc = 0;
      let sc = scenes[scenes.length - 1];
      let local = 1;
      for (const s of scenes) {
        if (time < acc + s.dur) {
          sc = s;
          local = (time - acc) / s.dur;
          break;
        }
        acc += s.dur;
      }
      g.clearRect(0, 0, W, H);
      sc.draw(g, clamp(local), time);
      // chuyển cảnh: tối dần ở đầu và cuối mỗi cảnh
      const edge = Math.min(local, 1 - local) * sc.dur;
      if (edge < 0.35 && sc !== scenes[scenes.length - 1]) {
        g.fillStyle = `rgba(0,0,0,${1 - edge / 0.35})`;
        g.fillRect(0, 0, W, H);
      }
      if (sc.cap !== lastCap) {
        lastCap = sc.cap;
        cap.textContent = sc.cap;
        cap.classList.remove('in');
        void cap.offsetWidth;
        if (sc.cap) cap.classList.add('in');
      }
      bar.style.width = `${Math.min(100, (time / total) * 100)}%`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
}
