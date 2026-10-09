/**
 * All game sounds are synthesised with WebAudio so the game ships no audio
 * files. The context is created on the first user gesture (Start button).
 */
export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private wind: GainNode | null = null;

  init() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
    } catch {
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);

    const len = this.ctx.sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    // Constant low wind for atmosphere.
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 380;
    this.wind = this.ctx.createGain();
    this.wind.gain.value = 0.05;
    src.connect(lp).connect(this.wind).connect(this.master);
    src.start();
  }

  suspend() {
    void this.ctx?.suspend();
  }

  resume() {
    void this.ctx?.resume();
  }

  private noise(duration: number, freq: number, type: BiquadFilterType, gain: number, pan = 0, q = 1) {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(f).connect(g).connect(p).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + duration + 0.05);
  }

  private tone(freq: number, endFreq: number, duration: number, gain: number, type: OscillatorType = "sine", pan = 0) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    o.connect(g).connect(p).connect(this.master);
    o.start(t);
    o.stop(t + duration + 0.05);
  }

  gunshot() {
    this.noise(0.5, 1800, "lowpass", 1.0);
    this.noise(0.12, 4000, "highpass", 0.5);
    this.tone(140, 40, 0.25, 0.6, "triangle");
  }

  dryFire() {
    this.noise(0.04, 3000, "bandpass", 0.3, 0, 4);
  }

  reload() {
    this.noise(0.05, 2500, "bandpass", 0.25, 0, 3);
    setTimeout(() => this.noise(0.06, 1800, "bandpass", 0.3, 0, 3), 700);
  }

  swing() {
    this.noise(0.18, 900, "bandpass", 0.25, 0, 0.7);
  }

  hit() {
    this.tone(110, 50, 0.15, 0.5, "sine");
    this.noise(0.1, 600, "lowpass", 0.6);
  }

  hurt() {
    this.tone(220, 120, 0.25, 0.25, "sawtooth");
    this.noise(0.15, 500, "lowpass", 0.4);
  }

  pickup() {
    this.noise(0.08, 1500, "bandpass", 0.2, 0, 2);
  }

  eat() {
    this.noise(0.25, 700, "bandpass", 0.2, 0, 1.5);
  }

  /** A zombie groan at a distance, panned left/right relative to the listener. */
  groan(distance: number, pan: number, urgent: boolean) {
    if (!this.ctx || !this.master || distance > 35) return;
    const gain = Math.max(0, 1 - distance / 35) * (urgent ? 0.35 : 0.22);
    if (gain < 0.01) return;
    const t = this.ctx.currentTime;
    const dur = 0.8 + Math.random() * 0.9;
    const o = this.ctx.createOscillator();
    o.type = "sawtooth";
    const base = 70 + Math.random() * 50;
    o.frequency.setValueAtTime(base, t);
    o.frequency.linearRampToValueAtTime(base * (0.7 + Math.random() * 0.5), t + dur);
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 5 + Math.random() * 6;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 8;
    lfo.connect(lfoGain).connect(o.frequency);
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 400 + Math.random() * 300;
    f.Q.value = 2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    o.connect(f).connect(g).connect(p).connect(this.master);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }
}
