// ─── SOUND ENGINE ────────────────────────────────────────────────────────────
// Web Audio API — all sounds synthesized, no external files needed.

let ctx = null;
const getCtx = () => {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};

const STORAGE_KEY = 'sound_prefs';
const defaults = { enabled: true, volume: 0.5, vibration: true, pack: 'cyber' };

export function getSoundPrefs() {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
  catch { return defaults; }
}

export function saveSoundPrefs(prefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...getSoundPrefs(), ...prefs }));
}

// ─── VIBRATION ────────────────────────────────────────────────────────────────
function vibrate(pattern) {
  const prefs = getSoundPrefs();
  if (prefs.vibration && navigator.vibrate) navigator.vibrate(pattern);
}

// ─── SOUND PACKS ─────────────────────────────────────────────────────────────
const PACKS = {

  cyber: {
    click: (ctx, vol) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'square'; o.frequency.setValueAtTime(800, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);
      g.gain.setValueAtTime(vol * 0.3, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      o.start(); o.stop(ctx.currentTime + 0.08);
    },
    success: (ctx, vol) => {
      [523, 659, 784].forEach((freq, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.value = freq;
        const t = ctx.currentTime + i * 0.1;
        g.gain.setValueAtTime(vol * 0.4, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        o.start(t); o.stop(t + 0.2);
      });
    },
    error: (ctx, vol) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sawtooth'; o.frequency.setValueAtTime(200, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.2);
      g.gain.setValueAtTime(vol * 0.4, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      o.start(); o.stop(ctx.currentTime + 0.25);
    },
    notify: (ctx, vol) => {
      [1200, 900].forEach((freq, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.value = freq;
        const t = ctx.currentTime + i * 0.12;
        g.gain.setValueAtTime(vol * 0.35, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        o.start(t); o.stop(t + 0.15);
      });
    },
    toggle: (ctx, vol) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'triangle'; o.frequency.setValueAtTime(600, ctx.currentTime);
      o.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.06);
      g.gain.setValueAtTime(vol * 0.25, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      o.start(); o.stop(ctx.currentTime + 0.1);
    },
    whoosh: (ctx, vol) => {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = buf; f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 0.5;
      src.connect(f); f.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(vol * 0.3, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      src.start(); src.stop(ctx.currentTime + 0.3);
    },
  },

  plasma: {
    click: (ctx, vol) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.setValueAtTime(1200, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.06);
      g.gain.setValueAtTime(vol * 0.25, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
      o.start(); o.stop(ctx.currentTime + 0.07);
    },
    success: (ctx, vol) => {
      const freqs = [440, 550, 660, 880];
      freqs.forEach((freq, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.value = freq;
        const t = ctx.currentTime + i * 0.07;
        g.gain.setValueAtTime(vol * 0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        o.start(t); o.stop(t + 0.25);
      });
    },
    error: (ctx, vol) => {
      [160, 120, 90].forEach((freq, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sawtooth'; o.frequency.value = freq;
        const t = ctx.currentTime + i * 0.08;
        g.gain.setValueAtTime(vol * 0.35, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        o.start(t); o.stop(t + 0.1);
      });
    },
    notify: (ctx, vol) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.setValueAtTime(880, ctx.currentTime);
      o.frequency.linearRampToValueAtTime(1320, ctx.currentTime + 0.15);
      g.gain.setValueAtTime(vol * 0.3, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      o.start(); o.stop(ctx.currentTime + 0.25);
    },
    toggle: (ctx, vol) => {
      [800, 1000].forEach((freq, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'triangle'; o.frequency.value = freq;
        const t = ctx.currentTime + i * 0.05;
        g.gain.setValueAtTime(vol * 0.2, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        o.start(t); o.stop(t + 0.08);
      });
    },
    whoosh: (ctx, vol) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.setValueAtTime(200, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.2);
      g.gain.setValueAtTime(vol * 0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      o.start(); o.stop(ctx.currentTime + 0.25);
    },
  },

  void: {
    click: (ctx, vol) => {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = buf; f.type = 'highpass'; f.frequency.value = 3000;
      src.connect(f); f.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(vol * 0.4, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      src.start(); src.stop(ctx.currentTime + 0.05);
    },
    success: (ctx, vol) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.setValueAtTime(300, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.3);
      g.gain.setValueAtTime(vol * 0.3, ctx.currentTime);
      g.gain.setValueAtTime(vol * 0.3, ctx.currentTime + 0.25);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      o.start(); o.stop(ctx.currentTime + 0.45);
    },
    error: (ctx, vol) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'square'; o.frequency.setValueAtTime(100, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.3);
      g.gain.setValueAtTime(vol * 0.3, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      o.start(); o.stop(ctx.currentTime + 0.3);
    },
    notify: (ctx, vol) => {
      [200, 400, 800].forEach((freq, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.value = freq;
        const t = ctx.currentTime + i * 0.1;
        g.gain.setValueAtTime(vol * 0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        o.start(t); o.stop(t + 0.15);
      });
    },
    toggle: (ctx, vol) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.value = 400;
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(vol * 0.2, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      o.start(); o.stop(ctx.currentTime + 0.12);
    },
    whoosh: (ctx, vol) => {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / data.length);
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = buf; f.type = 'bandpass'; f.frequency.value = 400; f.Q.value = 1;
      src.connect(f); f.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(vol * 0.35, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      src.start(); src.stop(ctx.currentTime + 0.4);
    },
  },
};

// ─── PUBLIC API ───────────────────────────────────────────────────────────────
export function playSound(type = 'click') {
  const prefs = getSoundPrefs();
  if (!prefs.enabled) return;
  try {
    const c = getCtx();
    const pack = PACKS[prefs.pack] || PACKS.cyber;
    const fn = pack[type] || pack.click;
    fn(c, prefs.volume);
  } catch {}
}

export const SOUND_TYPES = {
  click:   { label: 'Click',    desc: 'Button taps & selections' },
  success: { label: 'Success',  desc: 'Completed actions & saves' },
  error:   { label: 'Error',    desc: 'Failures & warnings' },
  notify:  { label: 'Notify',   desc: 'Alerts & messages' },
  toggle:  { label: 'Toggle',   desc: 'Switches & toggles' },
  whoosh:  { label: 'Whoosh',   desc: 'Navigation & transitions' },
};

export const SOUND_PACKS = {
  cyber:  { label: 'Cyber Pulse',    desc: 'Sharp digital beeps — crisp and reactive' },
  plasma: { label: 'Plasma Wave',    desc: 'Smooth harmonic tones — fluid and warm' },
  void:   { label: 'Void Core',      desc: 'Deep sub-bass textures — dark and immersive' },
};

// Vibration patterns for different actions
export const VIBRATE = {
  click:   () => vibrate([10]),
  success: () => vibrate([20, 50, 20]),
  error:   () => vibrate([30, 30, 30]),
  toggle:  () => vibrate([15]),
  notify:  () => vibrate([10, 20, 10]),
};