// Hải đồ lục giác rất rộng: sương mù, đảo tự nhiên, hang quái, lãnh thổ, đoàn thuyền, tuyến buôn.
// Địa hình vẽ theo khối 16x16 ô (chỉ vẽ khối đang nhìn thấy), đảo và thuyền là hình riêng.
import Phaser from 'phaser';
import { WILDS } from '../../../shared/data';
import { homeCell, isSeen, seenOf, wildCell, type IslandPub, type SeenMap } from '../../../shared/logic';
import { merchantPos, routePeriod, routesView, type Route } from '../../../shared/economy';
import { islandCell, worldFor } from '../../../shared/map';
import { BOSS_CELL } from '../../../shared/boss';
import { hexCenterPx, hexNeighbors, pxToHex } from '../../../shared/hex';
import { CENTER, fleetPos, isleById, terrainAt, WORLD_H, WORLD_W, ZONE_NAMES, zoneLevel, type FleetView, type Terrain } from '../../../shared/world';
import { charCanvas } from '../art/sprites';
import { ensureTex } from '../art/textures';
import type { Store } from '../store';
import type { UI } from '../ui';
import { HD, hallTex, merchantTex, seaBoatTex, seaIslandTex, waterTex } from '../art/textures';
import { CamCtl } from './camctl';

const CH = 16; // khối 16x16 ô
const CW_PX = CH * 32 + 16;
const CH_PX = CH * 24 + 8;
const W_PX = WORLD_W * 32 + 16;
const H_PX = WORLD_H * 24 + 8;
const NCX = Math.ceil(WORLD_W / CH);
const NCY = Math.ceil(WORLD_H / CH);

interface Label {
  el: HTMLElement;
  x: number;
  y: number;
}

// ---------- ô lục giác 32x32 (đỉnh nhọn, cạnh dốc 2:1) ----------
const inHex = (x: number, y: number) => {
  if (x < 0 || y < 0 || x >= 32 || y >= 32) return false;
  const j = y < 8 ? y : y > 23 ? 31 - y : 8;
  if (j >= 8) return true;
  const hw = 2 * j + 1;
  return x >= 16 - hw && x <= 15 + hw;
};
const HEX_POLY = [16, 0, 32, 8, 32, 24, 16, 32, 0, 24, 0, 8];
function nz(x: number, y: number, s: number) {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const TER_COL: Record<Terrain, [string, string, string]> = {
  sea: ['#3a90c2', '#347fb0', '#5fb0dc'],
  deep: ['#2c74a8', '#265f8d', '#4a8ec2'],
  shoal: ['#5fb6d6', '#4fa3c6', '#8fd6ea'],
  reef: ['#3a90c2', '#347fb0', '#5fb0dc'],
  storm: ['#3f4a5c', '#2a3242', '#6a7894'],
};
const tileCache = new Map<string, HTMLCanvasElement>();
function hexTile(t: Terrain | 'fog', v: number): HTMLCanvasElement {
  const key = `${t}:${v}`;
  let c = tileCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d')!;
  const px = (i: number, j: number, col: string) => {
    x.fillStyle = col;
    x.fillRect(i, j, 1, 1);
  };
  for (let j = 0; j < 32; j++)
    for (let i = 0; i < 32; i++) {
      if (!inHex(i, j)) continue;
      const edge = !inHex(i - 1, j) || !inHex(i + 1, j) || !inHex(i, j - 1) || !inHex(i, j + 1);
      if (t === 'fog') {
        const n = nz(i >> 2, j >> 2, v + 3);
        px(i, j, edge ? '#cdd6e0' : n < 0.5 ? '#e9eef3' : '#dde4ec');
        continue;
      }
      const [a, b] = TER_COL[t];
      px(i, j, edge ? b : a);
    }
  if (t === 'fog') {
    const cx = 9 + (v % 3) * 4, cy = 12 + (v % 2) * 5;
    for (const [dx, dy] of [[0, 0], [1, -1], [2, -1], [3, 0], [3, 1], [2, 2], [1, 2], [0, 1]]) px(cx + dx, cy + dy, '#c4cfdb');
    x.fillStyle = '#ffffff';
    x.fillRect(cx - 4, cy + 7, 6, 1);
    return tileCache.set(key, c), c;
  }
  const hi = TER_COL[t][2];
  // gợn sóng thưa
  for (let k = 0; k < 2; k++) {
    const wx = 7 + Math.floor(nz(v, k, 1) * 14), wy = 9 + Math.floor(nz(v, k, 2) * 14);
    x.fillStyle = hi;
    x.fillRect(wx, wy, 3 + (v % 2), 1);
  }
  if (t === 'shoal') for (let k = 0; k < 4; k++) px(8 + Math.floor(nz(v, k, 5) * 16), 8 + Math.floor(nz(v, k, 6) * 16), '#f2d99c');
  if (t === 'reef')
    for (let k = 0; k < 3; k++) {
      const rx = 7 + Math.floor(nz(v, k, 7) * 16), ry = 9 + Math.floor(nz(v, k, 8) * 13);
      x.fillStyle = '#4c4e58';
      x.fillRect(rx, ry, 3, 2);
      x.fillStyle = '#7b7e88';
      x.fillRect(rx, ry, 2, 1);
      x.fillStyle = '#e9f8fb';
      x.fillRect(rx - 1, ry + 2, 5, 1);
    }
  if (t === 'storm') {
    x.strokeStyle = '#8fb8ff55';
    x.beginPath();
    x.arc(16, 16, 6 + (v % 3) * 2, v, v + 3);
    x.stroke();
  }
  tileCache.set(key, c);
  return c;
}

export class SeaScene extends Phaser.Scene {
  store!: Store;
  ui!: UI;
  ctl!: CamCtl;
  private water!: Phaser.GameObjects.TileSprite;
  private chunks = new Map<string, { img: Phaser.GameObjects.Image; sig: string; key: string }>();
  private objs!: Phaser.GameObjects.Container;
  private terr!: Phaser.GameObjects.Graphics;
  private route!: Phaser.GameObjects.Graphics;
  private trade!: Phaser.GameObjects.Graphics;
  private sel!: Phaser.GameObjects.Graphics;
  private ships: { rt: Route; img: Phaser.GameObjects.Image }[] = [];
  private fleets: { f: FleetView; img: Phaser.GameObjects.Image; label: Label }[] = [];
  private period = -1;
  private tradeKey = '';
  private sig = '';
  private seenSig = '';
  private labels: Label[] = [];
  private lastCam = '';
  private lastLabelBuild = 0;
  private ver = 0;
  private picked: { c: number; r: number } | null = null;
  portrait = false;

  constructor() {
    super('sea');
  }

  create() {
    this.store = this.registry.get('store');
    this.ui = this.registry.get('ui');
    this.cameras.main.setRoundPixels(true);
    // nước nền ngoài mép hải đồ
    // hải đồ rất rộng: nước nền chỉ phủ quanh khung nhìn, dời theo camera
    const wt = waterTex(this, 64, 64, 0);
    this.water = this.add.tileSprite(0, 0, 64, 64, wt).setOrigin(0).setDepth(-20).setTileScale(1 / HD);
    this.objs = this.add.container(0, 0).setDepth(10);
    this.terr = this.add.graphics().setDepth(5);
    this.trade = this.add.graphics().setDepth(6);
    this.route = this.add.graphics().setDepth(7);
    this.sel = this.add.graphics().setDepth(8);
    this.ctl = new CamCtl(this, {
      minZ: 1,
      maxZ: 4,
      region: () => ({ x: -48, y: -48, w: W_PX + 96, h: H_PX + 96 }),
      onPastMax: (x, y) => {
        const h = this.homePx();
        if (Math.hypot(x - h.x, y - h.y) < 64) this.ui.goIsland();
        else this.ui.toast('Phóng to ở gần đảo của bạn để về đảo.', 'muted');
      },
    });
    this.ctl.attach();
    this.input.on('pointerup', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.dragged || over.length) return;
      const h = pxToHex(p.worldX, p.worldY);
      if (h.c < 0 || h.r < 0 || h.c >= WORLD_W || h.r >= WORLD_H) return;
      this.pick(h.c, h.r);
      this.ui.openHex(h.c, h.r);
    });
    this.scale.on('resize', () => {
      this.ctl.clamp();
      this.draw(true);
    });
    this.store.net.on('islands', () => this.draw());
    this.store.net.on('owners', () => this.draw(true));
    this.store.net.on('fleets', () => this.syncFleets());
    this.store.on('change', () => this.draw());
    const hide = () => {
      const box = document.getElementById('maplabels');
      if (box) box.hidden = true;
    };
    this.events.on('sleep', hide);
    this.events.on('shutdown', hide);
    this.events.on('wake', () => this.enterFromIsland());
    this.cameras.main.setZoom(this.defaultZoom());
    this.focusHome();
    this.draw(true);
    this.enterFromIsland();
  }

  get dragged() {
    return this.ctl?.dragged ?? false;
  }
  home() {
    return homeCell(this.store.s);
  }
  homePx() {
    const h = this.home();
    return hexCenterPx({ c: h.x, r: h.y });
  }
  /** Tâm ô (x = cột, y = hàng) ra toạ độ điểm ảnh. */
  P(x: number, y: number) {
    // nội suy cho toạ độ lẻ (thuyền đang đi): hàng lẻ lệch nửa ô
    const r0 = Math.floor(y), t = y - r0;
    const a = hexCenterPx({ c: 0, r: r0 }), b = hexCenterPx({ c: 0, r: r0 + 1 });
    const ox = a.x + (b.x - a.x) * t;
    return { x: ox + x * 32, y: a.y + (b.y - a.y) * t };
  }
  defaultZoom() {
    const rs = (this.registry.get('rs') as number) || 1;
    return rs > 1 ? 2 : 2;
  }
  /** Ô hải đồ của một đảo (người chơi có chỗ riêng do server chọn). */
  cellOf(id: string, p?: IslandPub): { x: number; y: number } {
    if (p?.home) return p.home;
    if (id === this.store.s.id) return this.home();
    const known = this.store.net.islands().find((x) => x.id === id);
    return known?.home ?? islandCell(id, this.store.s.khu);
  }

  enterFromIsland() {
    this.draw(true);
    const cam = this.cameras.main;
    const me = this.homePx();
    cam.setZoom(this.ctl.o.maxZ);
    this.ctl.centerOn(me.x, me.y);
    cam.fadeIn(220, 18, 9, 10);
    const target = this.defaultZoom();
    this.time.delayedCall(30, () => {
      const p = this.screenOfWorld(me.x, me.y, false);
      this.ctl.animateTo(target, p.x, p.y, 420);
    });
  }
  leaveToIsland(done: () => void) {
    const cam = this.cameras.main;
    const me = this.homePx();
    const p = this.screenOfWorld(me.x, me.y, false);
    this.ctl.animateTo(this.ctl.o.maxZ + 2, p.x, p.y, 240);
    cam.fadeOut(240, 18, 9, 10);
    cam.once('camerafadeoutcomplete', done);
  }
  zoomStep(dir: 1 | -1) {
    if (dir < 0 && Math.round(this.cameras.main.zoom) <= this.ctl.o.minZ) return;
    this.ctl.step(dir);
  }
  focusHome() {
    const me = this.homePx();
    this.ctl.centerOn(me.x, me.y);
  }
  /** Đưa camera tới một ô (tìm theo toạ độ). */
  focusCell(c: number, r: number) {
    const p = hexCenterPx({ c, r });
    this.ctl.centerOn(p.x, p.y);
    this.pick(c, r);
  }
  pick(c: number, r: number) {
    this.picked = { c, r };
    const g = this.sel;
    g.clear();
    const o = hexCenterPx({ c, r });
    g.lineStyle(2, 0xffe27a, 1);
    const pts = [];
    for (let i = 0; i < HEX_POLY.length; i += 2) pts.push(new Phaser.Math.Vector2(o.x - 16 + HEX_POLY[i], o.y - 16 + HEX_POLY[i + 1]));
    g.strokePoints(pts, true);
  }
  screenOfWorld(x: number, y: number, css = true) {
    const cam = this.cameras.main;
    const k = cam.zoom * (css ? ((this.registry.get('rs') as number) || 1) : 1);
    return { x: (x - cam.worldView.x) * k, y: (y - cam.worldView.y) * k };
  }

  // ---------- khối địa hình ----------
  private chunkSig(seen: SeenMap, cx: number, cy: number) {
    const s = this.store.s;
    let h = 2166136261;
    let any = false;
    for (let r = cy * CH; r < Math.min(WORLD_H, (cy + 1) * CH); r++)
      for (let c = cx * CH; c < Math.min(WORLD_W, (cx + 1) * CH); c++) {
        const k = isSeen(s, c, r, seen);
        any ||= k;
        h = Math.imul(h ^ (k ? 1 : 0), 16777619);
      }
    return any ? String(h >>> 0) : 'fog';
  }
  /** Khối toàn sương mù dùng chung một hình (đỡ tốn bộ nhớ trên hải đồ lớn). */
  private fogChunkKey() {
    const key = 'seachunk-fog';
    if (!this.textures.exists(key)) {
      const cv = document.createElement('canvas');
      cv.width = CW_PX;
      cv.height = CH_PX;
      const x = cv.getContext('2d')!;
      for (let r = 0; r < CH; r++) for (let c = 0; c < CH; c++) x.drawImage(hexTile('fog', Math.floor(nz(c, r, 9) * 6)), c * 32 + (r & 1) * 16, r * 24);
      this.textures.addCanvas(key, cv);
    }
    return key;
  }
  private renderChunk(cx: number, cy: number, seen: SeenMap): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = CW_PX;
    cv.height = CH_PX;
    const x = cv.getContext('2d')!;
    const khu = this.store.s.khu || '01';
    for (let r = cy * CH; r < Math.min(WORLD_H, (cy + 1) * CH); r++)
      for (let c = cx * CH; c < Math.min(WORLD_W, (cx + 1) * CH); c++) {
        const ox = (c - cx * CH) * 32 + (r & 1) * 16, oy = (r - cy * CH) * 24;
        const v = Math.floor(nz(c, r, 9) * 6);
        const known = isSeen(this.store.s, c, r, seen);
        x.drawImage(hexTile(known ? terrainAt(khu, c, r) : 'fog', v), ox, oy);
      }
    return cv;
  }
  private syncChunks(force = false) {
    const seen = seenOf(this.store.s);
    const cam = this.cameras.main;
    const v = cam.worldView;
    const x0 = Math.max(0, Math.floor((v.x - 64) / (CH * 32))), x1 = Math.min(NCX - 1, Math.floor((v.right + 64) / (CH * 32)));
    const y0 = Math.max(0, Math.floor((v.y - 64) / (CH * 24))), y1 = Math.min(NCY - 1, Math.floor((v.bottom + 64) / (CH * 24)));
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        const id = `${cx},${cy}`;
        const sig = this.chunkSig(seen, cx, cy);
        const cur = this.chunks.get(id);
        if (cur && cur.sig === sig && !force) continue;
        const fog = sig === 'fog';
        const key = fog ? this.fogChunkKey() : `seachunk-${id}-${++this.ver}`;
        if (!fog) this.textures.addCanvas(key, this.renderChunk(cx, cy, seen));
        if (cur) {
          cur.img.setTexture(key);
          if (cur.key !== 'seachunk-fog') this.textures.remove(cur.key);
          cur.key = key;
          cur.sig = sig;
        } else {
          const img = this.add.image(cx * CH * 32, cy * CH * 24, key).setOrigin(0).setDepth(0);
          this.chunks.set(id, { img, sig, key });
        }
      }
    // bỏ khối đã ra xa khung nhìn (hải đồ hơn 1 triệu ô, không giữ hết được)
    for (const [id, ch] of this.chunks) {
      const [cx, cy] = id.split(',').map(Number);
      if (cx >= x0 - 2 && cx <= x1 + 2 && cy >= y0 - 2 && cy <= y1 + 2) continue;
      ch.img.destroy();
      if (ch.key !== 'seachunk-fog') this.textures.remove(ch.key);
      this.chunks.delete(id);
    }
    // nước nền theo camera
    this.water.setPosition(v.x - 64, v.y - 64).setSize(v.width + 128, v.height + 128);
    this.water.setTilePosition((v.x - 64) * HD, (v.y - 64) * HD);
  }
  /** Khung ô quanh camera để vẽ đảo, hang, nhãn (hải đồ quá lớn để vẽ hết). */
  private viewRect() {
    const v = this.cameras.main.worldView;
    const m = 18;
    return {
      c0: Math.max(0, Math.floor(v.x / 32) - m), c1: Math.min(WORLD_W - 1, Math.ceil(v.right / 32) + m),
      r0: Math.max(0, Math.floor(v.y / 24) - m), r1: Math.min(WORLD_H - 1, Math.ceil(v.bottom / 24) + m),
    };
  }
  private viewKey() {
    const v = this.cameras.main.worldView;
    return `${Math.floor(v.centerX / 32 / 12)},${Math.floor(v.centerY / 24 / 12)},${Math.round(this.cameras.main.zoom)}`;
  }
  private lastView = '';

  // ---------- nhãn chữ (DOM) ----------
  private label(x: number, y: number, text: string, color: string, sub?: string): Label {
    const el = document.createElement('div');
    el.className = 'ml';
    el.style.color = color;
    el.textContent = text;
    if (sub) {
      const sm = document.createElement('small');
      sm.textContent = sub;
      el.appendChild(sm);
    }
    const l = { el, x, y };
    this.labels.push(l);
    return l;
  }
  private placeLabels(force = false) {
    const cam = this.cameras.main;
    const key = `${cam.zoom.toFixed(3)}:${cam.worldView.x.toFixed(1)}:${cam.worldView.y.toFixed(1)}`;
    if (key === this.lastCam && !force) return;
    this.lastCam = key;
    const k = cam.zoom * ((this.registry.get('rs') as number) || 1);
    const ox = cam.worldView.x, oy = cam.worldView.y;
    const v = cam.worldView;
    for (const l of this.labels) {
      const vis = l.x > v.x - 80 && l.x < v.right + 80 && l.y > v.y - 40 && l.y < v.bottom + 40;
      l.el.style.display = vis ? '' : 'none';
      if (vis) l.el.style.transform = `translate(${Math.round((l.x - ox) * k)}px, ${Math.round((l.y - oy) * k)}px) translateX(-50%)`;
    }
  }

  // ---------- vẽ đảo, hang quái, lãnh thổ ----------
  private add1(img: Phaser.GameObjects.GameObject) {
    this.objs.add(img);
  }
  draw(force = false) {
    if (!this.sys.isActive() && !force) return;
    const s = this.store.s;
    const net = this.store.net;
    const list = net.islands();
    const owners = net.owners();
    const view = this.viewKey();
    this.lastView = view;
    const sig = JSON.stringify([view, s.seen.length, s.seen.slice(-64), list.map((p) => [p.id, p.power, p.land, p.tiers?.leu, p.home?.x]), s.isles.map((o) => o.id), Object.values(s.wilds).map((w) => w.readyAt > s.gt), Object.keys(owners).length, s.home, s.voyage?.id]);
    if (sig === this.sig && !force) {
      this.syncChunks();
      return;
    }
    this.sig = sig;
    const seen = seenOf(s);
    const seenAt = (c: number, r: number) => isSeen(s, c, r, seen);
    this.syncChunks(this.seenSig !== s.seen && force);
    this.seenSig = s.seen;
    this.objs.removeAll(true);
    this.labels = [];
    const w = worldFor(s.khu);
    const vr = this.viewRect();
    const inView = (c: number, r: number) => c >= vr.c0 && c <= vr.c1 && r >= vr.r0 && r <= vr.r1;
    const online = new Set(net.online().map((o) => o.id));
    const myGuild = s.guild?.tag ?? '';
    const allyT = new Set([myGuild, ...(s.guild?.allyTags ?? [])].filter(Boolean));
    // lãnh thổ: đảo tự nhiên có chủ + vùng quanh đảo nhà
    const terr = new Map<string, number>();
    const mark = (c: number, r: number, col: number, k = 1) => {
      terr.set(`${c},${r}`, col);
      if (k) for (const n of hexNeighbors({ c, r })) if (!terr.has(`${n.c},${n.r}`)) terr.set(`${n.c},${n.r}`, col);
    };
    const MINE = 0x4fd06a, ALLY = 0x5aa8ff, OTHER = 0xf0554a, BOT = 0xffc36a;
    for (const p of list) if (p.home && inView(p.home.x, p.home.y) && seenAt(p.home.x, p.home.y)) mark(p.home.x, p.home.y, p.bot ? BOT : allyT.has(p.guild ?? '') ? ALLY : OTHER);
    for (const [isle, o] of Object.entries(owners)) {
      const i = isleById(w, isle);
      if (i && inView(i.c, i.r) && seenAt(i.c, i.r)) mark(i.c, i.r, o.p === s.id ? MINE : allyT.has(o.g) ? ALLY : OTHER);
    }
    for (const o of s.isles) {
      const i = isleById(w, o.id);
      if (i) mark(i.c, i.r, MINE);
    }
    const me = this.home();
    mark(me.x, me.y, MINE);
    this.drawTerritory(terr);

    // đảo nhà
    const hp = this.homePx();
    this.island(s.id, hp.x, hp.y, 'me', Math.max(16, s.land.split('1').length - 1), s.lv.leu.tier, true);
    this.label(hp.x, hp.y + 14, s.islandName, '#ffe27a', `(${me.x}, ${me.y}) · đảo của bạn`);
    // đảo người chơi khác, đảo máy
    for (const p of list) {
      const c = p.home ?? islandCell(p.id, s.khu);
      if (!inView(c.x, c.y) || !seenAt(c.x, c.y)) continue;
      const q = hexCenterPx({ c: c.x, r: c.y });
      this.island(p.id, q.x, q.y, p.bot ? 'bot' : 'player', p.land, p.tiers?.leu ?? 1, online.has(p.id));
      this.label(q.x, q.y + 14, p.name, p.bot ? '#ffd29a' : allyT.has(p.guild ?? '') ? '#bfe0ff' : '#ffb3a8', `${p.power} sức mạnh${p.guild ? ` · [${p.guild}]` : ''}`);
    }
    // đảo tự nhiên
    for (const i of w.islesIn(vr.c0, vr.r0, vr.c1, vr.r1)) {
      if (!seenAt(i.c, i.r)) continue;
      const q = hexCenterPx({ c: i.c, r: i.r });
      const img = this.add.image(q.x, q.y + 2, seaIslandTex(this, i.id, 14 + i.lv * 5, 'wild', 1)).setScale(0.7 / HD);
      this.add1(img);
      const own = owners[i.id];
      const mine = s.isles.some((o) => o.id === i.id);
      if (own || mine) this.flag(q.x + 7, q.y - 10, mine ? MINE : allyT.has(own?.g ?? '') ? ALLY : OTHER);
      if (i.kind === 'bian' && !mine) {
        const ring = this.add.circle(q.x, q.y + 2, 12).setStrokeStyle(1, 0xc07cff, 0.9);
        this.tweens.add({ targets: ring, scale: { from: 0.85, to: 1.2 }, alpha: { from: 1, to: 0.2 }, duration: 1100, yoyo: true, repeat: -1 });
        this.add1(ring);
      }
      const name = i.kind === 'bian' && !mine ? 'Đảo Bí Ẩn ???' : i.name;
      this.label(q.x, q.y + 12, name, i.kind === 'bian' ? '#d8b4ff' : '#e8f4ff', `cấp ${i.lv}${own ? ` · ${mine ? 'của bạn' : own.n}` : ''}`);
    }
    // hang quái trên hải đồ + bãi luyện quân riêng quanh nhà
    const lairs = [...w.lairsIn(vr.c0, vr.r0, vr.c1, vr.r1).map((l) => ({ w: l, c: { x: l.sx!, y: l.sy! } })), ...WILDS.map((l) => ({ w: l, c: wildCell(s, l.id) }))];
    for (const { w: l, c } of lairs) {
      if (!inView(c.x, c.y) || !seenAt(c.x, c.y)) continue;
      const q = hexCenterPx({ c: c.x, r: c.y });
      const st = s.wilds[l.id];
      const ready = !st || s.gt >= st.readyAt;
      const sh = this.add.ellipse(q.x, q.y + 6, 18, 6, 0x1d1b2a, 0.35);
      const ek = l.enemies[l.enemies.length - 1][0];
      const key = ensureTex(this, `ch-${ek}`, () => charCanvas(ek));
      const th = this.textures.get(key).getSourceImage().height || 32;
      const img = this.add.image(q.x, q.y + 6, key).setOrigin(0.5, 1).setScale(Math.min(0.8 / HD, 22 / th));
      if (!ready) img.setTint(0x777777);
      this.add1(sh);
      this.add1(img);
      this.label(q.x, q.y + 8, l.name, ready ? '#ff9b8a' : '#9aa0a8', ready ? `cấp ${l.level}` : 'đã dọn');
    }
    // Mắt Bão
    if (inView(CENTER.c, CENTER.r)) {
      const q = hexCenterPx({ c: CENTER.c, r: CENTER.r });
      const img = this.add.image(q.x, q.y + 8, 'ch-thuytinh').setOrigin(0.5, 1).setScale(1.2 / HD);
      const ring = this.add.circle(q.x, q.y, 30).setStrokeStyle(2, 0x8fb8ff, 0.5);
      this.tweens.add({ targets: ring, scale: { from: 0.7, to: 1.4 }, alpha: { from: 0.9, to: 0 }, duration: 1800, repeat: -1 });
      this.add1(ring);
      this.add1(img);
      this.label(q.x, q.y + 12, 'Mắt Bão · Thủy Tinh', '#ff6b6b', `(${BOSS_CELL.x}, ${BOSS_CELL.y})`);
    }
    const box = document.getElementById('maplabels');
    if (box) {
      box.replaceChildren(...this.labels.map((l) => l.el));
      box.hidden = false;
    }
    this.syncFleets();
    this.drawRoute();
    this.drawTrade(true);
    this.placeLabels(true);
  }

  private flag(x: number, y: number, col: number) {
    this.add1(this.add.rectangle(x, y + 4, 1, 10, 0x1d1b2a));
    this.add1(this.add.rectangle(x + 3, y, 6, 4, col).setStrokeStyle(1, 0x1d1b2a));
  }
  private island(id: string, x: number, y: number, kind: 'me' | 'player' | 'bot' | 'wild', land: number, tier: number, online = false) {
    const img = this.add.image(x, y, seaIslandTex(this, id, land, kind, tier, false)).setScale(0.85 / HD);
    this.add1(img);
    // phủ chúa kiểu mới trên đảo, bậc nhà chính càng cao mái càng đẹp; cờ màu theo phe
    this.add1(this.add.image(x, y + 6, hallTex(this, tier)).setOrigin(0.5, 1).setScale(0.5 / HD));
    this.flag(x + 9, y - 13, kind === 'me' ? 0xffe27a : kind === 'player' ? 0xf0554a : 0xffb35a);
    if (online) {
      const ring = this.add.circle(x, y + 2, 16).setStrokeStyle(1, 0x7cff9a, 0.9);
      this.tweens.add({ targets: ring, scale: { from: 0.9, to: 1.15 }, alpha: { from: 1, to: 0.3 }, duration: 900, yoyo: true, repeat: -1 });
      this.add1(ring);
    }
  }
  private drawTerritory(terr: Map<string, number>) {
    const g = this.terr;
    g.clear();
    for (const [k, col] of terr) {
      const [c, r] = k.split(',').map(Number);
      if (c < 0 || r < 0 || c >= WORLD_W || r >= WORLD_H) continue;
      const o = hexCenterPx({ c, r });
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < HEX_POLY.length; i += 2) pts.push(new Phaser.Math.Vector2(o.x - 16 + HEX_POLY[i], o.y - 16 + HEX_POLY[i + 1]));
      g.fillStyle(col, 0.22);
      g.fillPoints(pts, true);
      // viền ở cạnh giáp ô khác chủ (cạnh i nối đỉnh i với đỉnh i+1, bắt đầu từ cạnh ĐB)
      const nb = hexNeighbors({ c, r }); // Đ, ĐN, TN, T, TB, ĐB
      const edgeOf = [5, 0, 1, 2, 3, 4]; // cạnh của đa giác (đỉnh trên → phải trên...) ứng với hàng xóm
      g.lineStyle(2, col, 0.95);
      for (let e = 0; e < 6; e++) {
        const n = nb[edgeOf[e]];
        if (terr.get(`${n.c},${n.r}`) === col) continue;
        const a = pts[e], b = pts[(e + 1) % 6];
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
  }

  // ---------- đoàn thuyền ----------
  private syncFleets() {
    for (const f of this.fleets) f.img.destroy();
    this.fleets = [];
    const s = this.store.s;
    const seen = seenOf(s);
    const list = this.store.net.fleets(s);
    for (const f of list) {
      const img = this.add.image(0, 0, seaBoatTex(this, Math.max(1, Math.min(5, f.t)), !!(f.mine || f.who))).setOrigin(0.5, 0.85).setDepth(12).setScale(0.55 / HD);
      const label = this.label(0, 0, f.mine ? 'Thuyền của bạn' : f.who ? `Thuyền ${f.who}` : 'Thuyền lạ', f.mine ? '#ffe27a' : f.who ? '#bfe0ff' : '#e9eef3');
      this.fleets.push({ f, img, label });
      void seen;
    }
    const box = document.getElementById('maplabels');
    if (box) box.replaceChildren(...this.labels.map((l) => l.el));
  }
  private fleetTick() {
    const now = this.store.now();
    const s = this.store.s;
    const seen = seenOf(s);
    for (const fl of this.fleets) {
      const p = fleetPos(fl.f, now);
      const vis = !!p && (fl.f.mine || isSeen(s, Math.round(p.x), Math.round(p.y), seen));
      fl.img.setVisible(vis);
      fl.label.el.style.visibility = vis ? '' : 'hidden';
      if (!p || !vis) continue;
      const q = this.P(p.x, p.y);
      fl.img.setPosition(q.x, q.y + Math.sin(now / 400) * 1);
      fl.img.setFlipX(now <= fl.f.a ? fl.f.to.x < fl.f.from.x : fl.f.from.x < fl.f.to.x);
      fl.label.x = q.x;
      fl.label.y = q.y + 4;
    }
    this.lastCam = '';
  }

  /** Tuyến buôn của thương hội NPC (đổi mỗi 6 giờ) và thương thuyền đang chạy. */
  private drawTrade(force = false) {
    const period = routePeriod(this.store.now());
    const vk = `${period}|${this.viewKey()}`;
    if (vk === this.tradeKey && !force) return;
    this.tradeKey = vk;
    this.period = period;
    const vr = this.viewRect();
    const g = this.trade;
    g.clear();
    for (const sh of this.ships) sh.img.destroy();
    this.ships = [];
    for (const rt of routesView(vr.c0, vr.r0, vr.c1, vr.r1, period)) {
      const col = Phaser.Display.Color.HexStringToColor(rt.m.color).color;
      for (let i = 1; i < rt.pts.length; i++) {
        const a = this.P(rt.pts[i - 1].x, rt.pts[i - 1].y);
        const b = this.P(rt.pts[i].x, rt.pts[i].y);
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        g.fillStyle(col, 0.5);
        for (let d = 0; d < len; d += 9) g.fillRect(Math.round(a.x + ((b.x - a.x) * d) / len), Math.round(a.y + ((b.y - a.y) * d) / len), 4, 1);
      }
      const img = this.add.image(0, 0, merchantTex(this, rt.m.id, rt.m.color)).setScale(1 / HD).setDepth(11).setInteractive({ useHandCursor: true });
      img.on('pointerup', () => !this.dragged && this.ui.openMerchant(rt));
      this.ships.push({ rt, img });
    }
  }
  private shipTick() {
    const now = this.store.now();
    for (const sh of this.ships) {
      const p = merchantPos(sh.rt, now);
      const q = this.P(p.x, p.y);
      sh.img.setPosition(q.x, q.y + Math.round(Math.sin(now / 500 + q.x) * 1));
      sh.img.setFlipX(p.dir < 0);
    }
  }
  /** Đường thuyền mình đang đi (chấm). */
  private drawRoute() {
    const g = this.route;
    g.clear();
    const v = this.store.s.voyage;
    if (!v) return;
    const from = v.from ?? this.home();
    const a = hexCenterPx({ c: from.x, r: from.y }), b = hexCenterPx({ c: v.to.x, r: v.to.y });
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(2, Math.floor(len / 8));
    g.fillStyle(0xffe27a, 0.9);
    for (let i = 1; i < n; i++) g.fillRect(Math.round(a.x + ((b.x - a.x) * i) / n), Math.round(a.y + ((b.y - a.y) * i) / n), 2, 2);
  }

  /** Mô tả ngắn một ô (cho bảng thông tin). */
  hexInfo(c: number, r: number) {
    const s = this.store.s;
    const known = isSeen(s, c, r);
    const t = terrainAt(s.khu || '01', c, r);
    return { known, terrain: t, zone: zoneLevel(c, r), zoneName: ZONE_NAMES[zoneLevel(c, r)] };
  }

  update(time: number) {
    this.ctl.clamp();
    if (time - this.lastLabelBuild > 400) {
      this.lastLabelBuild = time;
      this.syncChunks();
      // camera đi sang vùng khác: vẽ lại đảo, hang, nhãn quanh chỗ mới
      if (this.viewKey() !== this.lastView) this.draw(true);
    }
    this.drawTrade();
    this.shipTick();
    this.fleetTick();
    this.placeLabels();
  }
}

