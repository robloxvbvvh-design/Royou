// Синтезированные звуки (без файлов): выстрелы, перезарядка, попадания, интерфейс.
let ctx = null, master = null, noiseBuf = null;
export const Sfx = {
  volume: 0.7,
  init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = this.volume; master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
  },
  setVolume(v) { this.volume = v; if (master) master.gain.value = v; },
  _noise(dur, freq, q, vol, type = 'lowpass', delay = 0) {
    if (!ctx) return; const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.05);
  },
  _tone(freq, dur, vol, type = 'sine', slideTo = null, delay = 0) {
    if (!ctx) return; const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  },
  play(name, vol = 1) {
    if (!ctx) return;
    switch (name) {
      case 'pistol': this._noise(0.14, 2400, 0.7, 0.55 * vol); this._tone(180, 0.1, 0.35 * vol, 'square', 60); break;
      case 'rifle': this._noise(0.12, 1800, 0.7, 0.5 * vol); this._tone(140, 0.09, 0.35 * vol, 'sawtooth', 50); break;
      case 'shotgun': this._noise(0.35, 1100, 0.5, 0.9 * vol); this._tone(90, 0.25, 0.5 * vol, 'square', 35); break;
      case 'sniper': this._noise(0.5, 1500, 0.5, 0.9 * vol); this._tone(110, 0.4, 0.6 * vol, 'sawtooth', 30); this._noise(0.4, 600, 0.4, 0.3 * vol, 'lowpass', 0.08); break;
      case 'knife': this._noise(0.16, 4500, 1, 0.35 * vol, 'highpass'); break;
      case 'reload': this._tone(900, 0.05, 0.2 * vol, 'square', 500); this._tone(500, 0.07, 0.2 * vol, 'square', 300, 0.5); this._tone(1100, 0.04, 0.2 * vol, 'square', 800, 0.95); break;
      case 'empty': this._tone(300, 0.05, 0.2 * vol, 'square'); break;
      case 'hit': this._tone(1500, 0.06, 0.25 * vol, 'triangle'); break;
      case 'head': this._tone(2200, 0.1, 0.3 * vol, 'triangle'); this._tone(1500, 0.08, 0.2 * vol, 'triangle', null, 0.04); break;
      case 'kill': this._tone(660, 0.08, 0.3 * vol, 'square'); this._tone(990, 0.14, 0.3 * vol, 'square', null, 0.08); break;
      case 'hurt': this._noise(0.12, 500, 0.8, 0.45 * vol); this._tone(120, 0.15, 0.3 * vol, 'sawtooth', 70); break;
      case 'coin': this._tone(1200, 0.07, 0.25 * vol, 'square'); this._tone(1700, 0.16, 0.25 * vol, 'square', null, 0.07); break;
      case 'click': this._tone(700, 0.04, 0.15 * vol, 'triangle'); break;
      case 'buy': this._tone(600, 0.07, 0.25 * vol, 'square'); this._tone(900, 0.07, 0.25 * vol, 'square', null, 0.07); this._tone(1300, 0.18, 0.25 * vol, 'square', null, 0.14); break;
      case 'copy': this._tone(400, 0.25, 0.3 * vol, 'sine', 1400); this._tone(1400, 0.2, 0.2 * vol, 'sine', 700, 0.12); break;
      case 'pickup': this._tone(500, 0.1, 0.25 * vol, 'sine', 1000); break;
      case 'flag': this._tone(440, 0.12, 0.3 * vol, 'square'); this._tone(660, 0.12, 0.3 * vol, 'square', null, 0.12); this._tone(880, 0.25, 0.3 * vol, 'square', null, 0.24); break;
      case 'jump': this._tone(300, 0.12, 0.12 * vol, 'sine', 600); break;
      case 'pad': this._tone(250, 0.35, 0.3 * vol, 'sine', 1200); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.2, 0.3 * vol, 'square', null, i * 0.13)); break;
      case 'lose': [400, 330, 260].forEach((f, i) => this._tone(f, 0.25, 0.3 * vol, 'sawtooth', null, i * 0.18)); break;
      case 'beep': this._tone(880, 0.12, 0.3 * vol, 'square'); break;
      case 'go': this._tone(1320, 0.3, 0.35 * vol, 'square'); break;
    }
  },
};
