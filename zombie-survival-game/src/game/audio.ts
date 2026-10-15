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

  private hum: GainNode | null = null;

  /** Continuous engine drone for nearby generators (0 = silent). */
  setHum(level: number) {
    if (!this.ctx || !this.master) return;
    if (!this.hum) {
      const o = this.ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = 58;
      const o2 = this.ctx.createOscillator();
      o2.type = "square";
      o2.frequency.value = 116.5;
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 320;
      this.hum = this.ctx.createGain();
      this.hum.gain.value = 0;
      const mix = this.ctx.createGain();
      mix.gain.value = 0.5;
      o.connect(lp);
      o2.connect(mix).connect(lp);
      lp.connect(this.hum).connect(this.master);
      o.start();
      o2.start();
    }
    this.hum.gain.setTargetAtTime(level * 0.12, this.ctx.currentTime, 0.2);
  }

  suspend() {
    void this.ctx?.suspend();
  }

  resume() {
    void this.ctx?.resume();
  }

  /** A panner wired to the master bus: the end of every voice chain. */
  private sink(pan: number): StereoPannerNode {
    const p = this.ctx!.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(this.master!);
    return p;
  }

  /**
   * Filtered noise burst. Starts `delay` s from now so multi-part sounds are
   * scheduled on the audio clock; `attack` > 0 swells in instead of striking.
   */
  private noise(duration: number, freq: number, type: BiquadFilterType, gain: number, pan = 0, q = 1, delay = 0, attack = 0) {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    if (attack > 0) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + attack);
    } else {
      g.gain.setValueAtTime(gain, t);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(f).connect(g).connect(this.sink(pan));
    src.start(t, Math.random());
    src.stop(t + duration + 0.05);
  }

  private tone(freq: number, endFreq: number, duration: number, gain: number, type: OscillatorType = "sine", pan = 0, delay = 0) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    // Very short pings (glass, nail ring) need a sharper onset than the usual 20 ms.
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, duration * 0.15));
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g).connect(this.sink(pan));
    o.start(t);
    o.stop(t + duration + 0.05);
  }

  /** Flat piezo-style beep for local UI, not placed in the world. */
  private beep(freq: number, duration: number, gain: number, type: OscillatorType, delay = 0) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.setValueAtTime(gain, t + duration - 0.01);
    g.gain.linearRampToValueAtTime(0, t + duration);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + duration + 0.02);
  }

  /**
   * Stick-slip friction (dry hinges, nails dragged out of wood): a sawtooth
   * whose rate wobbles, through a narrow resonance that glides.
   */
  private squeal(gain: number, pan: number, duration: number, pitch: number, band: [number, number], wobbleHz: number, delay = 0) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(pitch, t);
    o.frequency.linearRampToValueAtTime(pitch * (1.3 + Math.random() * 0.4), t + duration * 0.45);
    o.frequency.linearRampToValueAtTime(pitch * 0.85, t + duration);
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = wobbleHz * (0.8 + Math.random() * 0.4);
    const depth = this.ctx.createGain();
    depth.gain.value = pitch * 0.25;
    lfo.connect(depth).connect(o.frequency);
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 7;
    f.frequency.setValueAtTime(band[0], t);
    f.frequency.linearRampToValueAtTime(band[1], t + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + duration * 0.15);
    g.gain.linearRampToValueAtTime(gain * 0.6, t + duration * 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(f).connect(g).connect(this.sink(pan));
    o.start(t);
    lfo.start(t);
    o.stop(t + duration + 0.05);
    lfo.stop(t + duration + 0.05);
  }

  /**
   * Loudness of a world sound `dist` metres away: linear falloff to silence
   * at maxDist, as groans do. 0 means too quiet to be worth any nodes.
   */
  private level(dist: number, maxDist: number, loudness: number): number {
    if (!this.ctx || !this.master) return 0;
    const v = Math.max(0, 1 - dist / maxDist) * loudness;
    return v < 0.01 ? 0 : v;
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

  // World sounds below take the listener distance (m) and a stereo pan (-1..1).

  /** An old hinge creaking as a door swings. */
  doorCreak(dist: number, pan: number) {
    // The narrow band keeps only a harmonic or two of the sawtooth, hence the high level.
    const v = this.level(dist, 15, 0.6);
    if (!v) return;
    this.squeal(v, pan, 0.5 + Math.random() * 0.2, 85 + Math.random() * 40, [700 + Math.random() * 200, 1300], 6);
  }

  /** A door swinging shut into its frame: body thump, then the latch snapping home. */
  doorThud(dist: number, pan: number) {
    const v = this.level(dist, 15, 0.6);
    if (!v) return;
    this.tone(95, 45, 0.2, v * 0.8, "sine", pan);
    this.noise(0.14, 320, "lowpass", v * 0.7, pan);
    this.noise(0.025, 3200, "bandpass", v * 0.35, pan, 5, 0.03);
    this.tone(2300, 2100, 0.04, v * 0.08, "triangle", pan, 0.03);
  }

  /** One blow from a fist, body or weapon on a barrier. */
  doorBang(dist: number, pan: number, material: "wood" | "steel" | "glass") {
    const v = this.level(dist, 35, 0.7);
    if (!v) return;
    if (material === "wood") {
      // Deep panel boom plus the hollow body resonance...
      this.tone(80 + Math.random() * 15, 50, 0.3, v * 0.8, "sine", pan);
      this.noise(0.18, 420, "lowpass", v * 0.8, pan, 1.5);
      this.noise(0.15, 190, "bandpass", v * 0.5, pan, 4);
      // ...and the door rattling loose in its frame and hinges.
      for (let i = 0; i < 3; i++) this.noise(0.03, 1300 + Math.random() * 700, "bandpass", v * 0.15 * (1 - i * 0.25), pan, 3, 0.06 + i * 0.035 + Math.random() * 0.01);
    } else if (material === "steel") {
      // Impact transient and a dull thud, then a plate ringing at inharmonic partials.
      this.noise(0.05, 2500, "bandpass", v * 0.5, pan);
      this.tone(110, 70, 0.2, v * 0.45, "sine", pan);
      const base = 300 + Math.random() * 60;
      [1, 1.58, 2.31, 3.17].forEach((k, i) => this.tone(base * k, base * k * 0.995, 0.65 - i * 0.1, (v * 0.2) / (1 + i * 0.6), "sine", pan));
    } else {
      // Glass is stiff and light: a hard high tick, a brief ring and a little frame thunk.
      this.noise(0.04, 3500, "bandpass", v * 0.4, pan, 2);
      this.tone(1900, 1600, 0.08, v * 0.15, "sine", pan);
      this.tone(2600 + Math.random() * 400, 2600, 0.15, v * 0.06, "sine", pan);
      this.tone(170, 100, 0.08, v * 0.3, "sine", pan);
    }
  }

  /** A door giving way: a big crack, a splintering crash and a short debris tail. */
  doorBurst(dist: number, pan: number) {
    const v = this.level(dist, 45, 1);
    if (!v) return;
    this.noise(0.1, 1200, "bandpass", v, pan, 0.7);
    this.tone(70, 35, 0.35, v * 0.8, "sine", pan);
    this.noise(0.5, 900, "bandpass", v * 0.6, pan, 0.8, 0.03);
    this.noise(0.35, 3000, "highpass", v * 0.25, pan, 1, 0.05);
    // Individual splinters snapping through the crash.
    for (let i = 0; i < 4; i++) this.noise(0.03, 1500 + Math.random() * 2500, "bandpass", v * (0.1 + Math.random() * 0.15), pan, 3, 0.05 + Math.random() * 0.4);
    // Pieces landing and sliding.
    this.noise(0.4, 500, "lowpass", v * 0.25, pan, 1, 0.45, 0.05);
    this.tone(120, 60, 0.1, v * 0.25, "sine", pan, 0.55 + Math.random() * 0.1);
    this.tone(150, 70, 0.08, v * 0.15, "sine", pan, 0.75 + Math.random() * 0.1);
  }

  /** A pane shattering: a bright burst, then shards tinkling down for most of a second. */
  glassBreak(dist: number, pan: number) {
    const v = this.level(dist, 45, 0.8);
    if (!v) return;
    this.noise(0.12, 1800, "bandpass", v * 0.5, pan, 0.8);
    this.noise(0.3, 4000, "highpass", v * 0.7, pan);
    for (let i = 0; i < 7; i++) {
      // Squaring clusters the shards early, like a real fall.
      const at = 0.03 + Math.random() ** 2 * 0.75;
      const f = 2000 + Math.random() * 4000;
      this.tone(f, f * 0.98, 0.05 + Math.random() * 0.08, v * 0.12 * (1 - at), "sine", pan + (Math.random() - 0.5) * 0.3, at);
    }
    this.noise(0.05, 5000, "bandpass", v * 0.15, pan, 2, 0.25 + Math.random() * 0.2);
    this.noise(0.05, 4500, "bandpass", v * 0.1, pan, 2, 0.5 + Math.random() * 0.2);
  }

  /** A nailed board ripped off: nails shrieking out, then the wood cracking free. */
  boardTear(dist: number, pan: number) {
    const v = this.level(dist, 35, 0.6);
    if (!v) return;
    this.tone(900 + Math.random() * 200, 1700, 0.25, v * 0.1, "sawtooth", pan);
    this.tone(1200 + Math.random() * 200, 2000, 0.2, v * 0.07, "sawtooth", pan, 0.08);
    this.noise(0.12, 1500, "bandpass", v * 0.8, pan, 0.9, 0.22);
    this.tone(110, 50, 0.2, v * 0.5, "triangle", pan, 0.22);
    this.noise(0.25, 3500, "highpass", v * 0.25, pan, 1, 0.24);
  }

  /** One hammer blow on a nail: a sharp knock with a short steel ring. */
  hammer(dist: number, pan: number) {
    const v = this.level(dist, 30, 0.6);
    if (!v) return;
    this.noise(0.05, 2000, "bandpass", v * 0.7, pan, 1.2);
    this.tone(220, 120, 0.07, v * 0.4, "triangle", pan);
    const ring = 2800 + Math.random() * 300;
    this.tone(ring, ring * 0.995, 0.18, v * 0.08, "sine", pan);
    this.tone(ring * 1.48, ring * 1.47, 0.12, v * 0.05, "sine", pan);
  }

  /** The claw levering a nail out: a rising squeal ending in a pop as it frees. */
  pry(dist: number, pan: number) {
    const v = this.level(dist, 15, 0.5);
    if (!v) return;
    const dur = 0.55 + Math.random() * 0.1;
    this.squeal(v, pan, dur, 220 + Math.random() * 80, [1600, 2600], 11);
    this.noise(0.03, 2500, "bandpass", v * 0.8, pan, 3, dur - 0.05);
  }

  /** A heavy deadbolt, maglock or strike engaging: a click and a low thunk. */
  lockClunk(dist: number, pan: number) {
    const v = this.level(dist, 15, 0.5);
    if (!v) return;
    this.noise(0.02, 2800, "bandpass", v * 0.4, pan, 4);
    this.tone(140, 70, 0.09, v * 0.6, "sine", pan, 0.015);
    this.noise(0.06, 350, "lowpass", v * 0.5, pan, 1, 0.015);
  }

  /** Keypad feedback at the player's own hand: one bright beep, or two low buzzes on deny. */
  keypadBeep(ok: boolean) {
    if (ok) {
      this.beep(1200, 0.08, 0.06, "square");
    } else {
      this.beep(180, 0.16, 0.08, "square");
      this.beep(180, 0.16, 0.08, "square", 0.22);
    }
  }

  /** Clothing and shoes scuffing over a sill: two rustles, a knee thump, a shoe drag, a landing. */
  climb(dist: number, pan: number) {
    const v = this.level(dist, 15, 0.35);
    if (!v) return;
    this.noise(0.15, 2500, "bandpass", v * 0.5, pan, 0.8, 0, 0.05);
    this.tone(100, 60, 0.1, v * 0.5, "sine", pan, 0.05);
    this.noise(0.18, 1800, "bandpass", v * 0.4, pan, 0.8, 0.15, 0.06);
    this.noise(0.12, 900, "bandpass", v * 0.6, pan, 1.5, 0.28, 0.03);
    this.noise(0.08, 300, "lowpass", v * 0.7, pan, 1, 0.42);
  }
}
