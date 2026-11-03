// Âm thanh của game, tổng hợp hoàn toàn bằng Web Audio (không cần tệp ngoài):
// - Nhạc nền ngũ cung: sáo trúc, đàn tranh, mõ; ra biển nhạc rộng hơn; vào trận có trống trận.
// - Tiếng môi trường: sóng biển, gió, mưa, sấm theo thời tiết thật của vùng biển; chim ban ngày, dế ban đêm.
// - Hiệu ứng: chạm nút, nhặt đồ, xây nhà, lên cấp, vòng quay, chém, tên bay...
// Ba loại bật/tắt riêng trong Cài đặt, lưu trên máy này.

export type Ch = 'music' | 'amb' | 'sfx';
export type Mood = 'island' | 'sea' | 'battle';
export type Sfx =
  | 'tap' | 'open' | 'coin' | 'gather' | 'build' | 'levelup' | 'error' | 'tick' | 'win' | 'legend'
  | 'hit' | 'crit' | 'arrow' | 'heal' | 'chest' | 'expand' | 'sail' | 'victory' | 'defeat';

interface Prefs {
  music: boolean;
  amb: boolean;
  sfx: boolean;
  /** âm lượng tổng 0..1 */
  vol: number;
}
const KEY = 'vld-sound';
const DEF: Prefs = { music: true, amb: true, sfx: true, vol: 0.8 };
/** mức to nhỏ của từng loại so với nhau */
const LEVEL: Record<Ch, number> = { music: 0.2, amb: 0.42, sfx: 0.55 };

function load(): Prefs {
  try {
    return { ...DEF, ...(JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Prefs>) };
  } catch {
    return { ...DEF };
  }
}

// thang ngũ cung (Rê Fa Sol La Đô) — hơi hướng dân ca Nam Bộ / hò biển
const SCALE = [293.66, 349.23, 392, 440, 523.25, 587.33, 698.46, 783.99, 880];
const BASS = [73.42, 65.41, 98, 110]; // Rê, Đô, Sol, La
// các câu nhạc (chỉ số trong SCALE, -1 là nghỉ), mỗi câu 16 nhịp móc
const PHRASES_ISLAND = [
  [3, -1, 4, 3, 2, -1, 1, -1, 2, 3, -1, 2, 0, -1, -1, -1],
  [4, -1, 5, 4, 3, -1, 4, -1, 2, -1, 1, 2, 3, -1, -1, -1],
  [5, 4, 3, -1, 4, -1, 2, -1, 3, 2, 1, -1, 0, -1, -1, -1],
  [2, -1, 3, 4, 5, -1, 4, 3, 4, -1, -1, 2, 3, -1, -1, -1],
];
const PHRASES_SEA = [
  [5, -1, -1, 6, 5, -1, 4, -1, 3, -1, -1, 4, 5, -1, -1, -1],
  [7, -1, 6, 5, -1, 4, 5, -1, 3, -1, 2, -1, 3, -1, -1, -1],
  [4, -1, 5, -1, 7, -1, 6, 5, 4, -1, 3, -1, 2, -1, -1, -1],
];
const PHRASES_BATTLE = [
  [3, 3, 5, -1, 4, 3, 2, -1, 3, 3, 5, 6, 5, -1, 4, -1],
  [6, -1, 5, 4, 5, -1, 3, -1, 4, 4, 3, 2, 3, -1, -1, -1],
];

class Sound {
  prefs = load();
  private ac: AudioContext | null = null;
  private master!: GainNode;
  private bus = {} as Record<Ch, GainNode>;
  private noise!: AudioBuffer;
  private mood: Mood = 'island';
  private night = false;
  private rain = 0;
  private storm = false;
  private wind = 1;
  private timer = 0;
  private nextAt = 0;
  private step = 0;
  private phrase: number[] = PHRASES_ISLAND[0];
  private ambNodes: { waves: GainNode; wind: GainNode; rain: GainNode } | null = null;
  private nextBird = 0;
  private nextBug = 0;
  private nextThunder = 0;
  private recent = new Map<string, number>();

  /** Trình duyệt chỉ cho phát tiếng sau lần chạm đầu tiên: gọi hàm này trong sự kiện chạm. */
  unlock() {
    if (this.ac) {
      if (this.ac.state === 'suspended' && !document.hidden) void this.ac.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      this.ac = new AC();
    } catch {
      return;
    }
    const ac = this.ac;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.connect(ac.destination);
    this.master = ac.createGain();
    this.master.gain.value = this.prefs.vol;
    this.master.connect(comp);
    for (const ch of ['music', 'amb', 'sfx'] as Ch[]) {
      const g = ac.createGain();
      g.gain.value = this.prefs[ch] ? LEVEL[ch] : 0;
      g.connect(this.master);
      this.bus[ch] = g;
    }
    const len = ac.sampleRate * 2;
    this.noise = ac.createBuffer(1, len, ac.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startAmb();
    this.nextAt = ac.currentTime + 0.4;
    this.timer = window.setInterval(() => this.schedule(), 100);
    document.addEventListener('visibilitychange', () => {
      if (!this.ac) return;
      if (document.hidden) void this.ac.suspend();
      else void this.ac.resume();
    });
  }

  // ---------------- cài đặt ----------------
  set(ch: Ch, on: boolean) {
    this.prefs[ch] = on;
    this.save();
    if (this.ac) this.bus[ch].gain.setTargetAtTime(on ? LEVEL[ch] : 0, this.ac.currentTime, 0.15);
  }
  setVol(v: number) {
    this.prefs.vol = Math.max(0, Math.min(1, v));
    this.save();
    if (this.ac) this.master.gain.setTargetAtTime(this.prefs.vol, this.ac.currentTime, 0.1);
  }
  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.prefs));
    } catch {
      /* máy chặn lưu: vẫn chạy với cài đặt hiện tại */
    }
  }

  /** Đổi không khí nhạc: trên đảo, ngoài biển, trong trận. */
  setMood(m: Mood) {
    if (m === this.mood) return;
    this.mood = m;
    this.step = 0;
    this.applyAmb();
  }
  /** Thời tiết vùng biển quanh đảo: mưa, giông, bão, sức gió, ngày/đêm. */
  setWeather(kind: string, wind: number, night: boolean) {
    const rain = kind === 'mua' ? 0.55 : kind === 'giong' ? 0.85 : kind === 'bao' ? 1 : 0;
    const storm = kind === 'giong' || kind === 'bao';
    if (rain === this.rain && storm === this.storm && wind === this.wind && night === this.night) return;
    this.rain = rain;
    this.storm = storm;
    this.wind = wind;
    this.night = night;
    this.applyAmb();
  }

  // ---------------- nhạc nền ----------------
  private schedule() {
    const ac = this.ac;
    if (!ac || ac.state !== 'running') return;
    const now = ac.currentTime;
    if (this.nextAt < now - 1) this.nextAt = now + 0.05; // tab vừa quay lại: bỏ nhịp cũ
    const bpm = this.mood === 'battle' ? 124 : this.mood === 'sea' ? 70 : 78;
    const eighth = 60 / bpm / 2;
    while (this.nextAt < now + 0.6) {
      if (this.prefs.music) this.musicStep(this.step, this.nextAt, eighth);
      this.nextAt += eighth;
      this.step++;
    }
    if (this.prefs.amb) this.ambEvents(now);
  }

  private musicStep(i: number, t: number, e: number) {
    const st = i % 16;
    const bar = Math.floor(i / 16);
    if (st === 0) {
      const set = this.mood === 'battle' ? PHRASES_BATTLE : this.mood === 'sea' ? PHRASES_SEA : PHRASES_ISLAND;
      this.phrase = set[(bar * 7 + (bar >> 2)) % set.length];
    }
    const root = BASS[bar % BASS.length];
    if (this.mood === 'battle') {
      // trống trận: dồn ở phách mạnh, chen tiếng chũm chọe nhẹ
      if (st % 4 === 0) this.drum(t, 0.9);
      if (st % 8 === 6) this.drum(t, 0.5);
      if (st % 4 === 2) this.hat(t, 0.18);
      if (st % 2 === 0) this.pluck(root * 2, t, e * 1.6, 0.22, 900);
      const n = this.phrase[st];
      if (n >= 0) this.pluck(SCALE[n], t, e * 2, 0.32, 2200);
      return;
    }
    // bè trầm ngân dài mỗi nửa ô nhịp
    if (st % 8 === 0) this.drone(root, t, e * 8, this.mood === 'sea' ? 0.2 : 0.16);
    // đàn tranh rải hợp âm
    if (st % 2 === 1 && !(this.night && st % 4 === 3)) {
      const arp = [0, 2, 4, 3];
      const k = arp[(st >> 1) % 4];
      this.pluck(SCALE[(k + (bar % 2)) % SCALE.length] / 2, t, e * 3, 0.14, 1600);
    }
    // sáo trúc hát câu chính (đêm thì thưa hơn)
    const n = this.phrase[st];
    if (n >= 0 && !(this.night && st % 4 === 2)) {
      let len = e;
      for (let j = st + 1; j < 16 && this.phrase[j] < 0 && len < e * 4; j++) len += e;
      this.flute(SCALE[n] * (this.mood === 'sea' ? 1 : 1), t, len * 0.95, this.night ? 0.12 : 0.16);
    }
    // tiếng mõ gõ nhịp
    if (st % 8 === 0) this.block(t, 0.12);
  }

  private env(g: GainNode, t: number, a: number, peak: number, dur: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  private osc(type: OscillatorType, f: number, t: number, dur: number, out: AudioNode) {
    const o = this.ac!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }
  private gain(to: AudioNode) {
    const g = this.ac!.createGain();
    g.connect(to);
    return g;
  }
  private filter(type: BiquadFilterType, f: number, to: AudioNode, q = 0.7) {
    const b = this.ac!.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    b.connect(to);
    return b;
  }
  private noiseSrc(t: number, dur: number, to: AudioNode, rate = 1) {
    const s = this.ac!.createBufferSource();
    s.buffer = this.noise;
    s.playbackRate.value = rate;
    s.connect(to);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.05);
    return s;
  }

  private flute(f: number, t: number, dur: number, vol: number) {
    const g = this.gain(this.bus.music);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.06);
    g.gain.setValueAtTime(vol * 0.85, t + Math.max(0.07, dur - 0.12));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);
    const lp = this.filter('lowpass', 2600, g);
    const o = this.osc('triangle', f, t, dur + 0.2, lp);
    const o2 = this.osc('sine', f * 2, t, dur + 0.2, this.gainTo(lp, 0.25));
    // rung hơi (vibrato) như thổi sáo
    const lfo = this.osc('sine', 5.2, t, dur + 0.2, this.gainTo(o.frequency, f * 0.006));
    void lfo;
    void o2;
    // chút hơi gió
    const ng = this.gain(this.bus.music);
    this.env(ng, t, 0.03, vol * 0.08, 0.15);
    this.noiseSrc(t, 0.16, this.filter('bandpass', f * 2, ng, 2));
  }
  private gainTo(to: AudioNode | AudioParam, v: number) {
    const g = this.ac!.createGain();
    g.gain.value = v;
    g.connect(to as AudioNode);
    return g;
  }
  private pluck(f: number, t: number, dur: number, vol: number, bright: number) {
    const g = this.gain(this.bus.music);
    this.env(g, t, 0.005, vol, dur);
    const lp = this.filter('lowpass', bright, g);
    lp.frequency.setValueAtTime(bright, t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(200, bright / 4), t + dur);
    this.osc('sawtooth', f, t, dur, lp);
    this.osc('triangle', f * 2.01, t, dur * 0.6, this.gainTo(lp, 0.3));
  }
  private drone(f: number, t: number, dur: number, vol: number) {
    const g = this.gain(this.bus.music);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    this.osc('sine', f, t, dur, g);
    this.osc('sine', f * 1.5, t, dur, this.gainTo(g, 0.25));
  }
  private block(t: number, vol: number) {
    const g = this.gain(this.bus.music);
    this.env(g, t, 0.002, vol, 0.09);
    this.osc('sine', 1180, t, 0.1, g);
    this.osc('triangle', 760, t, 0.06, this.gainTo(g, 0.5));
  }
  private drum(t: number, vol: number, bus: GainNode = this.bus.music) {
    const g = this.gain(bus);
    this.env(g, t, 0.004, vol, 0.45);
    const o = this.osc('sine', 120, t, 0.45, g);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.35);
    const ng = this.gain(bus);
    this.env(ng, t, 0.002, vol * 0.25, 0.08);
    this.noiseSrc(t, 0.1, this.filter('lowpass', 900, ng));
  }
  private hat(t: number, vol: number) {
    const g = this.gain(this.bus.music);
    this.env(g, t, 0.002, vol, 0.12);
    this.noiseSrc(t, 0.13, this.filter('highpass', 6000, g));
  }

  // ---------------- tiếng môi trường ----------------
  private startAmb() {
    const ac = this.ac!;
    const loop = (to: AudioNode) => {
      const s = ac.createBufferSource();
      s.buffer = this.noise;
      s.loop = true;
      s.connect(to);
      s.start();
      return s;
    };
    // sóng vỗ: tiếng ồn trầm, to nhỏ theo nhịp sóng
    const waves = ac.createGain();
    waves.gain.value = 0.2;
    waves.connect(this.bus.amb);
    const wl = ac.createBiquadFilter();
    wl.type = 'lowpass';
    wl.frequency.value = 520;
    wl.connect(waves);
    const swell = ac.createGain();
    swell.gain.value = 0.5;
    swell.connect(wl);
    loop(swell);
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.11;
    const depth = ac.createGain();
    depth.gain.value = 0.45;
    lfo.connect(depth).connect(swell.gain);
    lfo.start();
    // gió: dải tần lượn lên xuống
    const wind = ac.createGain();
    wind.gain.value = 0.03;
    wind.connect(this.bus.amb);
    const wb = ac.createBiquadFilter();
    wb.type = 'bandpass';
    wb.frequency.value = 480;
    wb.Q.value = 0.9;
    wb.connect(wind);
    loop(wb);
    const wlfo = ac.createOscillator();
    wlfo.frequency.value = 0.07;
    const wd = ac.createGain();
    wd.gain.value = 260;
    wlfo.connect(wd).connect(wb.frequency);
    wlfo.start();
    // mưa: tiếng rào rào tần cao
    const rain = ac.createGain();
    rain.gain.value = 0;
    rain.connect(this.bus.amb);
    const rh = ac.createBiquadFilter();
    rh.type = 'highpass';
    rh.frequency.value = 1400;
    const rl = ac.createBiquadFilter();
    rl.type = 'lowpass';
    rl.frequency.value = 7000;
    rh.connect(rl).connect(rain);
    loop(rh);
    this.ambNodes = { waves, wind, rain };
    this.applyAmb();
  }
  private applyAmb() {
    const n = this.ambNodes;
    if (!n || !this.ac) return;
    const t = this.ac.currentTime;
    const battle = this.mood === 'battle';
    const sea = this.mood === 'sea';
    n.waves.gain.setTargetAtTime(battle ? 0.05 : sea ? 0.32 : 0.18, t, 0.8);
    n.wind.gain.setTargetAtTime((battle ? 0.3 : 1) * (0.02 + this.wind * 0.018 + (this.storm ? 0.08 : 0)), t, 0.8);
    n.rain.gain.setTargetAtTime((battle ? 0.4 : 1) * this.rain * 0.16, t, 1.2);
  }
  private ambEvents(now: number) {
    if (this.mood === 'battle') return;
    if (!this.night && this.rain < 0.5 && now > this.nextBird) {
      this.nextBird = now + 5 + Math.random() * 9;
      if (this.mood === 'sea') this.gull(now + 0.1);
      else this.bird(now + 0.1);
    }
    if (this.night && this.rain < 0.5 && now > this.nextBug) {
      this.nextBug = now + 1.6 + Math.random() * 2.4;
      this.cricket(now + 0.05);
    }
    if (this.storm && now > this.nextThunder) {
      this.nextThunder = now + 14 + Math.random() * 26;
      this.thunder(now + 0.2);
    }
  }
  private bird(t: number) {
    const n = 2 + Math.floor(Math.random() * 4);
    const base = 2400 + Math.random() * 1400;
    for (let i = 0; i < n; i++) {
      const at = t + i * (0.09 + Math.random() * 0.05);
      const g = this.gain(this.bus.amb);
      this.env(g, at, 0.01, 0.05, 0.08);
      const o = this.osc('sine', base, at, 0.09, g);
      o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.3), at + 0.06);
    }
  }
  private gull(t: number) {
    for (let i = 0; i < 2; i++) {
      const at = t + i * 0.32;
      const g = this.gain(this.bus.amb);
      this.env(g, at, 0.03, 0.04, 0.28);
      const o = this.osc('sawtooth', 1250, at, 0.3, this.filter('lowpass', 2400, g));
      o.frequency.exponentialRampToValueAtTime(720, at + 0.26);
    }
  }
  private cricket(t: number) {
    const g = this.gain(this.bus.amb);
    g.gain.value = 0;
    for (let i = 0; i < 6; i++) {
      const at = t + i * 0.045;
      g.gain.setValueAtTime(0.022, at);
      g.gain.setValueAtTime(0, at + 0.025);
    }
    this.osc('sine', 4300 + Math.random() * 300, t, 0.3, g);
  }
  private thunder(t: number) {
    const g = this.gain(this.bus.amb);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    this.noiseSrc(t, 2.7, this.filter('lowpass', 220, g), 0.5);
  }

  // ---------------- hiệu ứng ----------------
  /** Phát một hiệu ứng (sau `delay` giây). Cùng tiếng dồn dập quá thì bỏ bớt. */
  play(name: Sfx, delay = 0) {
    const ac = this.ac;
    if (!ac || !this.prefs.sfx || ac.state !== 'running') return;
    const t = ac.currentTime + delay;
    const last = this.recent.get(name) ?? -1;
    if (delay === 0 && t - last < (name === 'arrow' || name === 'hit' ? 0.07 : 0.035)) return;
    if (delay === 0) this.recent.set(name, t);
    const out = this.bus.sfx;
    const tone = (type: OscillatorType, f: number, at: number, dur: number, vol: number, to?: number) => {
      const g = this.gain(out);
      this.env(g, at, 0.006, vol, dur);
      const o = this.osc(type, f, at, dur, g);
      if (to) o.frequency.exponentialRampToValueAtTime(to, at + dur * 0.9);
    };
    const burst = (at: number, dur: number, vol: number, type: BiquadFilterType, f: number, q = 0.8) => {
      const g = this.gain(out);
      this.env(g, at, 0.003, vol, dur);
      this.noiseSrc(at, dur, this.filter(type, f, g, q));
    };
    switch (name) {
      case 'tap':
        tone('triangle', 1320, t, 0.05, 0.12);
        break;
      case 'open':
        tone('triangle', 587, t, 0.12, 0.12);
        tone('triangle', 880, t + 0.06, 0.16, 0.1);
        break;
      case 'coin':
        tone('sine', 1568, t, 0.16, 0.22);
        tone('sine', 2093, t + 0.07, 0.28, 0.2);
        break;
      case 'gather':
        burst(t, 0.12, 0.35, 'bandpass', 1100, 1.2);
        tone('triangle', 330, t, 0.12, 0.25, 220);
        tone('sine', 1760, t + 0.1, 0.14, 0.12);
        break;
      case 'build':
        for (let i = 0; i < 3; i++) {
          burst(t + i * 0.15, 0.06, 0.5, 'bandpass', 1900, 1.5);
          tone('sine', 190, t + i * 0.15, 0.1, 0.4, 90);
        }
        break;
      case 'levelup':
        [587, 698, 880, 1175, 1397].forEach((f, i) => tone('triangle', f, t + i * 0.07, 0.24, 0.2));
        tone('sine', 1760, t + 0.36, 0.5, 0.1);
        break;
      case 'error':
        tone('square', 220, t, 0.1, 0.07);
        tone('square', 175, t + 0.11, 0.14, 0.07);
        break;
      case 'tick':
        tone('square', 2400, t, 0.015, 0.06);
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, t + i * 0.06, 0.3, 0.2));
        break;
      case 'legend': {
        // cồng chiêng + kèn rộn ràng
        const g = this.gain(out);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
        for (const [m, v] of [[1, 1], [1.52, 0.5], [2.74, 0.3], [4.1, 0.15]]) this.osc('sine', 98 * m, t, 3, this.gainTo(g, v));
        [587, 698, 880, 1175, 1397, 1760].forEach((f, i) => tone('sawtooth', f, t + 0.15 + i * 0.08, 0.35, 0.08));
        [880, 1175, 1397].forEach((f) => tone('triangle', f, t + 0.7, 0.9, 0.12));
        break;
      }
      case 'hit':
        burst(t, 0.08, 0.5, 'lowpass', 1600);
        tone('sine', 150, t, 0.12, 0.45, 60);
        break;
      case 'crit':
        burst(t, 0.1, 0.6, 'bandpass', 2600, 1.2);
        tone('sine', 180, t, 0.18, 0.6, 50);
        tone('square', 900, t, 0.05, 0.08, 400);
        break;
      case 'arrow':
        burst(t, 0.16, 0.18, 'bandpass', 3000, 2);
        break;
      case 'heal':
        [784, 988, 1175].forEach((f, i) => tone('sine', f, t + i * 0.08, 0.3, 0.14));
        break;
      case 'chest':
        [1319, 1568, 1976, 2637].forEach((f, i) => tone('sine', f, t + i * 0.06, 0.25, 0.14));
        burst(t, 0.1, 0.2, 'lowpass', 600);
        break;
      case 'expand':
        tone('sine', 110, t, 0.25, 0.5, 55);
        burst(t + 0.02, 0.22, 0.3, 'lowpass', 700);
        break;
      case 'sail': {
        const g = this.gain(out);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.35, t + 0.25);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1);
        const f = this.filter('bandpass', 400, g, 0.8);
        f.frequency.exponentialRampToValueAtTime(1500, t + 0.9);
        this.noiseSrc(t, 1, f);
        break;
      }
      case 'victory':
        this.drum(t, 0.7, out);
        [587, 740, 880, 1175].forEach((f, i) => tone('sawtooth', f, t + 0.1 + i * 0.12, 0.3, 0.08));
        tone('triangle', 1175, t + 0.6, 0.8, 0.16);
        break;
      case 'defeat':
        [440, 392, 349, 294].forEach((f, i) => tone('triangle', f, t + i * 0.18, 0.35, 0.16));
        break;
    }
  }
}

export const sound = new Sound();
