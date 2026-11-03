import { charCanvas } from './art/sprites';
import { drawMonster } from './art2/monsters';
import { drawDinh2 } from './art2/dinh2';
import { drawUnit, GENERALS } from './art2/units';
import Phaser from 'phaser';
import { GAME } from '../../shared/data';
import { createNet } from './net';
import { Perf } from './perf';
import { BattleScene } from './scenes/BattleScene';
import { IslandScene } from './scenes/IslandScene';
import { SeaScene } from './scenes/SeaScene';
import { Store } from './store';
import { UI } from './ui';
import { playTrailer } from './trailer';
import { ls } from './net/base';

const t0 = performance.now();

function setSplash(text: string) {
  const el = document.getElementById('splashStatus');
  if (el) el.textContent = text;
}

/** Hiện lỗi ngay trên màn hình mở game (kèm nút tải lại) thay vì đứng im. */
function showBootError(where: string, e: unknown) {
  const msg = `${where}: ${(e as Error)?.message ?? String(e)}`.slice(0, 300);
  console.error(where, e);
  const sp = document.getElementById('splash');
  if (sp) {
    sp.hidden = false;
    sp.classList.remove('out');
  }
  setSplash('Không mở được game. ' + msg);
  const btn = document.getElementById('splashRetry');
  if (btn) btn.hidden = false;
  try {
    (window as unknown as { __vldBootError?: string }).__vldBootError = msg;
    const net = (window as unknown as { __vld?: { net?: { sendTelemetry?: (t: unknown) => void } } }).__vld?.net;
    net?.sendTelemetry?.({ t: Date.now(), version: GAME.version, mode: 'loi-mo-game', fpsAvg: 0, fpsLow: 0, longFrames: 0, loadMs: 0, memMb: null, ua: navigator.userAgent.slice(0, 160), screen: `${innerWidth}x${innerHeight}@${devicePixelRatio}`, errors: [msg, String((e as Error)?.stack ?? '').slice(0, 600)], minutes: 0, power: 0 });
  } catch {
    /* bỏ qua */
  }
}

// Lỗi xảy ra trong lúc mở game cũng hiện ra màn hình
let booted = false;
addEventListener('error', (e) => {
  if (!booted) showBootError('Lỗi khi mở', e.error ?? e.message);
});
addEventListener('unhandledrejection', (e) => {
  if (!booted) showBootError('Lỗi khi mở', (e as PromiseRejectionEvent).reason);
});
setTimeout(() => {
  // đang chờ người chơi đăng nhập thì không báo chậm
  if (!booted && !document.body.dataset.login) {
    setSplash('Game mở chậm hơn bình thường. Bấm Tải lại nếu vẫn đứng ở đây.');
    const btn = document.getElementById('splashRetry');
    if (btn) btn.hidden = false;
  }
}, 20_000);

async function boot() {
  const perf = new Perf();
  perf.start();
  const splashMin = new Promise((r) => setTimeout(r, 1600));
  const fonts = Promise.race([
    Promise.all([document.fonts.load('16px VT323'), document.fonts.load('14px "Be Vietnam Pro"')]),
    new Promise((r) => setTimeout(r, 2500)),
  ]).catch(() => undefined);
  setSplash('Đang tìm Hải Khu...');
  const net = await createNet();
  setSplash(net.label);
  const raw = await net.loadSave();
  await fonts;
  // Màn lớn: vẽ ở nửa độ phân giải rồi phóng to bằng CSS (pixel art vẫn sắc nét) → nhẹ gấp 4 lần cho GPU yếu.
  const rs = innerWidth >= 900 && innerHeight >= 560 ? 2 : 1;
  const store = new Store(net, raw, perf);
  const ui = new UI(store);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#24668f',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    banner: false,
    scale: { mode: Phaser.Scale.NONE, width: Math.ceil(innerWidth / rs), height: Math.ceil(innerHeight / rs), zoom: rs },
    input: { activePointers: 3, windowEvents: false },
    fps: { target: 60, smoothStep: true },
    render: { powerPreference: 'high-performance', batchSize: 2048, clearBeforeRender: false },
    scene: [IslandScene, SeaScene, BattleScene],
  });
  game.registry.set('store', store);
  game.registry.set('ui', ui);
  game.registry.set('rs', rs);
  let rt = 0;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = window.setTimeout(() => game.scale.resize(Math.ceil(innerWidth / rs), Math.ceil(innerHeight / rs)), 60);
  });
  (window as unknown as { __vld: unknown }).__vld = { store, ui, game, perf, net, GAME, drawMonster, drawDinh2, drawUnit, GENERALS, char: charCanvas };
  game.events.once('ready', async () => {
    try {
      ui.init(game);
    } catch (e) {
      return showBootError('Lỗi giao diện', e);
    }
    try {
      store.start();
    } catch (e) {
      return showBootError('Lỗi dữ liệu đảo', e);
    }
    booted = true;
    perf.loadMs = Math.round(performance.now() - t0);
    await splashMin;
    const sp = document.getElementById('splash')!;
    sp.classList.add('out');
    setTimeout(() => (sp.hidden = true), 500);
    // trailer hoạt hình: chiếu một lần trên mỗi máy, ngay sau khi vào game
    if (!ls.get('vld-trailer')) {
      ls.set('vld-trailer', '1');
      await playTrailer(store.s.avatar);
    }
    await ui.intro();
    document.body.dataset.ready = '1';
  });
}

document.getElementById('splashRetry')?.addEventListener('click', () => location.reload());
boot().catch((e) => showBootError('Lỗi khởi động', e));
