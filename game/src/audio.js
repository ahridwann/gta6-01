// audio.js — fully procedural WebAudio: engine hum, police siren, gunshots,
// punch thuds, UI blips, and a laid-back sunset music loop. No audio files.
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.muted = false;
  }

  // Must be called from a user gesture; safe to call twice.
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.startEngine();
        this.startMusic();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { /* audio is optional; the game plays silent */ }
  }

  startEngine() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 320;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(filter).connect(this.engineGain).connect(this.ctx.destination);
    this.engineOsc.start();
  }

  setEngine(speedKmh, inCar) {
    if (!this.ctx || !this.engineGain) return;
    const target = inCar ? 0.05 + Math.min(0.12, speedKmh / 500) : 0.0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speedKmh * 1.4, this.ctx.currentTime, 0.1);
  }

  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'square';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.025;
      this.sirenOsc.connect(this.sirenGain).connect(this.ctx.destination);
      this.sirenOsc.start();
      this.sirenOsc.frequency.setValueAtTime(700, this.ctx.currentTime);
      this.sirenOsc.frequency.linearRampToValueAtTime(950, this.ctx.currentTime + 0.5);
      this.sirenOsc.frequency.linearRampToValueAtTime(700, this.ctx.currentTime + 1.0);
      const loop = () => {
        if (!this.sirenOsc) return;
        const t = this.ctx.currentTime;
        this.sirenOsc.frequency.setValueAtTime(700, t);
        this.sirenOsc.frequency.linearRampToValueAtTime(950, t + 0.5);
        this.sirenOsc.frequency.linearRampToValueAtTime(700, t + 1.0);
        this.sirenTimer = setTimeout(loop, 1000);
      };
      this.sirenTimer = setTimeout(loop, 1000);
    } else if (!on && this.sirenOsc) {
      clearTimeout(this.sirenTimer);
      try { this.sirenOsc.stop(); } catch (e) { /* already stopped */ }
      this.sirenOsc = null;
    }
  }

  blip(freq = 660, dur = 0.09, type = 'sine', vol = 0.08) {
    if (!this.ctx) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      o.connect(g).connect(this.ctx.destination);
      o.start(); o.stop(this.ctx.currentTime + dur);
    } catch (e) { /* ignore */ }
  }

  noiseBurst(dur = 0.16, vol = 0.22, lowpass = 1800) {
    if (!this.ctx) return;
    try {
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = lowpass;
      const g = this.ctx.createGain(); g.gain.value = vol;
      src.connect(filter).connect(g).connect(this.ctx.destination);
      src.start();
    } catch (e) { /* ignore */ }
  }

  shoot() { this.noiseBurst(0.14, 0.25, 2400); }
  punch() { this.noiseBurst(0.1, 0.18, 500); }
  cash() { this.blip(880, 0.1); setTimeout(() => this.blip(1320, 0.14), 90); }
  busted() { this.blip(220, 0.4, 'sawtooth', 0.12); }

  // Sunset loop: slow Am–F–C–G bass notes with a soft pluck on top.
  startMusic() {
    const bassNotes = [110, 87.31, 130.81, 98];
    let step = 0;
    const tick = () => {
      if (!this.ctx) return;
      const f = bassNotes[step % bassNotes.length];
      this.blip(f, 0.9, 'triangle', 0.05);
      if (step % 2 === 0) this.blip(f * 2, 0.4, 'sine', 0.03);
      step++;
      this.musicTimer = setTimeout(tick, 620);
    };
    tick();
  }
}
