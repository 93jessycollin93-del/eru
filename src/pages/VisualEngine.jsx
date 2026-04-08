import { useState } from 'react';
import { Palette, Layers, Zap, Sliders, Lock, Unlock, RotateCcw, CheckCircle2, Battery, Sparkles } from 'lucide-react';
import { useTheme, THEMES, BG_ENVS, MOTION_PRESETS, TYPOGRAPHY_PACKS } from '../context/ThemeContext';
import AnimatedBackground from '../components/AnimatedBackground';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const THEME_CATS = {
  cyber:'Cyber', neon:'Neon', jade:'Jade', gold:'Gold', void:'Void',
  organic:'Organic', energy:'Energy', mythic:'Mythic', cool:'Cool',
  warm:'Warm', minimal:'Minimal',
};
const BG_CATS = { off:'Off', digital:'Digital', space:'Space', nature:'Nature', energy:'Energy', mythic:'Mythic' };

function SliderRow({ label, value, min=0, max=2, step=0.05, onChange, locked, suffix='' }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex items-center gap-1.5">
          {locked && <Lock className="w-3 h-3 text-muted-foreground/50" />}
          <span className="text-xs font-mono text-foreground">{value.toFixed(2)}{suffix}</span>
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => !locked && onChange(parseFloat(e.target.value))}
        disabled={locked}
        className="w-full accent-primary h-1.5 rounded-full disabled:opacity-40"
      />
    </div>
  );
}

function SectionHeader({ icon: Icon, label, sub }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-primary" />
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

// ─── TAB: THEMES ─────────────────────────────────────────────────────────────
function ThemesTab() {
  const { theme, setTheme, isLocked } = useTheme();
  const [cat, setCat] = useState('all');
  const locked = isLocked('theme');

  const grouped = {};
  Object.entries(THEMES).forEach(([key, t]) => {
    if (!grouped[t.cat]) grouped[t.cat] = [];
    grouped[t.cat].push({ key, ...t });
  });

  const filtered = cat === 'all'
    ? Object.values(THEMES).map((t, i) => ({ key: Object.keys(THEMES)[i], ...t }))
    : (grouped[cat] || []);

  // Build primary hsl for preview swatch
  const getPrimary = (t) => `hsl(${t['--primary']})`;
  const getBg = (t) => `hsl(${t['--background']})`;

  return (
    <div className="space-y-4">
      <SectionHeader icon={Palette} label="Theme Presets" sub={`${Object.keys(THEMES).length} presets available`} />
      {locked && (
        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
          <Lock className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-xs text-yellow-400">Theme locked by administrator</span>
        </div>
      )}
      {/* Category filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button onClick={() => setCat('all')}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-colors ${cat === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
          All
        </button>
        {Object.entries(THEME_CATS).map(([k, v]) => (
          <button key={k} onClick={() => setCat(k)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-colors ${cat === k ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
            {v}
          </button>
        ))}
      </div>
      {/* Theme grid */}
      <div className="grid grid-cols-2 gap-2">
        {filtered.map(t => (
          <button key={t.key} onClick={() => setTheme(t.key)} disabled={locked}
            className={`relative rounded-xl border p-3 text-left transition-all disabled:opacity-40 ${theme === t.key ? 'border-primary ring-1 ring-primary/30' : 'border-border hover:border-primary/30'}`}
            style={{ background: getBg(t) }}>
            {theme === t.key && (
              <CheckCircle2 className="absolute top-2 right-2 w-3.5 h-3.5 text-primary" />
            )}
            <div className="flex gap-1.5 mb-2">
              <div className="w-4 h-4 rounded-full" style={{ background: getPrimary(t) }} />
              <div className="w-4 h-4 rounded-full" style={{ background: `hsl(${t['--card']})` }} />
              <div className="w-4 h-4 rounded-full" style={{ background: `hsl(${t['--border']})` }} />
            </div>
            <p className="text-[11px] font-medium text-foreground leading-tight">{t.label}</p>
            <p className="text-[9px] text-muted-foreground capitalize">{t.cat}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── TAB: BACKGROUNDS ────────────────────────────────────────────────────────
function BackgroundsTab() {
  const { bg, setBg, bgOpacity, setBgOpacity, particleDensity, setParticleDensity, lowPowerMode, setLowPowerMode, isLocked } = useTheme();
  const [preview, setPreview] = useState(null);
  const [cat, setCat] = useState('all');

  const filtered = Object.entries(BG_ENVS).filter(([, v]) => cat === 'all' || v.cat === cat);

  return (
    <div className="space-y-4">
      <SectionHeader icon={Layers} label="Animated Environments" sub="Canvas-rendered visual atmospheres" />

      <div className="flex items-center justify-between px-3 py-2 bg-secondary rounded-xl border border-border">
        <div className="flex items-center gap-2">
          <Battery className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Low Power Mode</span>
        </div>
        <button onClick={() => setLowPowerMode(!lowPowerMode)}
          className={`w-10 h-5 rounded-full transition-colors relative ${lowPowerMode ? 'bg-primary' : 'bg-secondary border border-border'}`}>
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${lowPowerMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button onClick={() => setCat('all')} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap ${cat==='all'?'bg-primary text-primary-foreground':'bg-secondary text-muted-foreground'}`}>All</button>
        {Object.entries(BG_CATS).map(([k,v]) => (
          <button key={k} onClick={() => setCat(k)} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap ${cat===k?'bg-primary text-primary-foreground':'bg-secondary text-muted-foreground'}`}>{v}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {filtered.map(([key, env]) => (
          <button key={key}
            onMouseEnter={() => setPreview(key)}
            onMouseLeave={() => setPreview(null)}
            onClick={() => setBg(key)}
            className={`relative rounded-xl border p-3 text-left transition-all ${bg === key ? 'border-primary ring-1 ring-primary/30 bg-primary/5' : 'border-border bg-secondary hover:border-primary/30'}`}>
            {bg === key && <CheckCircle2 className="absolute top-2 right-2 w-3.5 h-3.5 text-primary" />}
            <div className="w-6 h-6 rounded-lg bg-black/40 border border-border flex items-center justify-center mb-2">
              <span className="text-[10px]">
                {env.cat === 'digital' ? '⬡' : env.cat === 'space' ? '✦' : env.cat === 'nature' ? '◈' : env.cat === 'energy' ? '⚡' : env.cat === 'mythic' ? '⟡' : '○'}
              </span>
            </div>
            <p className="text-[11px] font-medium">{env.label}</p>
            <p className="text-[9px] text-muted-foreground capitalize">{env.cat}</p>
          </button>
        ))}
      </div>

      <div className="space-y-3 p-3 bg-card rounded-xl border border-border">
        <SliderRow label="Opacity" value={bgOpacity} min={0} max={1} step={0.05} onChange={setBgOpacity} />
        <SliderRow label="Particle Density" value={particleDensity} min={0.1} max={2} step={0.1} onChange={setParticleDensity} />
      </div>
    </div>
  );
}

// ─── TAB: MOTION ─────────────────────────────────────────────────────────────
function MotionTab() {
  const { motionIntensity, setMotionIntensity, animSpeed, setAnimSpeed, glowIntensity, setGlowIntensity, blurLevel, setBlurLevel, isLocked } = useTheme();
  return (
    <div className="space-y-4">
      <SectionHeader icon={Zap} label="Motion & Interaction" sub="Global animation rules and feedback" />

      <div className="space-y-3 p-3 bg-card rounded-xl border border-border">
        <SliderRow label="Motion Intensity" value={motionIntensity} onChange={setMotionIntensity} locked={isLocked('motionIntensity')} />
        <SliderRow label="Animation Speed" value={animSpeed} onChange={setAnimSpeed} locked={isLocked('animSpeed')} />
        <SliderRow label="Glow Intensity" value={glowIntensity} onChange={setGlowIntensity} locked={isLocked('glowIntensity')} />
        <SliderRow label="Blur / Glass Level" value={blurLevel} onChange={setBlurLevel} locked={isLocked('blurLevel')} />
      </div>

      {/* Motion language presets */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Micro-Interaction Style</p>
        {[
          { id:'ripple', label:'Ripple', desc:'Click creates expanding ring' },
          { id:'pulse', label:'Pulse', desc:'Elements breathe on hover' },
          { id:'glow', label:'Glow', desc:'Neon glow on interaction' },
          { id:'bounce', label:'Bounce', desc:'Springy element response' },
        ].map(m => (
          <div key={m.id} className="flex items-center justify-between px-3 py-2.5 bg-card border border-border rounded-xl">
            <div>
              <p className="text-sm">{m.label}</p>
              <p className="text-[10px] text-muted-foreground">{m.desc}</p>
            </div>
            <span className="text-[10px] text-muted-foreground/50 italic">Global</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TAB: DISPLAY ────────────────────────────────────────────────────────────
function DisplayTab() {
  const { brightness, setBrightness, contrast, setContrast, saturation, setSaturation, typography, setTypography, isLocked } = useTheme();

  return (
    <div className="space-y-4">
      <SectionHeader icon={Sliders} label="Display & Typography" sub="Color grading and font system" />

      <div className="space-y-3 p-3 bg-card rounded-xl border border-border">
        <SliderRow label="Brightness" value={brightness} min={0.5} max={1.5} onChange={setBrightness} locked={isLocked('brightness')} />
        <SliderRow label="Contrast" value={contrast} min={0.5} max={2} onChange={setContrast} locked={isLocked('contrast')} />
        <SliderRow label="Saturation" value={saturation} min={0} max={2} onChange={setSaturation} locked={isLocked('saturation')} />
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Typography Pack</p>
        {Object.entries(TYPOGRAPHY_PACKS).map(([key, pack]) => (
          <button key={key} onClick={() => setTypography(key)} disabled={isLocked('typography')}
            className={`w-full flex items-center justify-between px-3 py-3 rounded-xl border transition-all disabled:opacity-40 ${typography === key ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/30'}`}>
            <div>
              <p className="text-sm font-medium">{pack.label}</p>
              <p className="text-[10px] text-muted-foreground truncate">{pack.font}</p>
            </div>
            {typography === key && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── TAB: CONTROL ────────────────────────────────────────────────────────────
function ControlTab() {
  const { lockedSettings, setLockedSettings, resetAll } = useTheme();
  const [showReset, setShowReset] = useState(false);

  const LOCKABLE = [
    { key: 'theme', label: 'Theme Preset' },
    { key: 'bg', label: 'Background Environment' },
    { key: 'motionIntensity', label: 'Motion Intensity' },
    { key: 'glowIntensity', label: 'Glow Intensity' },
    { key: 'blurLevel', label: 'Blur Level' },
    { key: 'animSpeed', label: 'Animation Speed' },
    { key: 'brightness', label: 'Brightness' },
    { key: 'contrast', label: 'Contrast' },
    { key: 'saturation', label: 'Saturation' },
    { key: 'typography', label: 'Typography Pack' },
  ];

  const toggle = (key) => {
    setLockedSettings(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  return (
    <div className="space-y-4">
      <SectionHeader icon={Lock} label="Lock System" sub="Restrict which settings users can adjust" />

      <div className="space-y-1">
        {LOCKABLE.map(({ key, label }) => {
          const locked = lockedSettings.includes(key);
          return (
            <button key={key} onClick={() => toggle(key)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${locked ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-border bg-card hover:bg-secondary'}`}>
              <span className="text-sm">{label}</span>
              {locked
                ? <Lock className="w-3.5 h-3.5 text-yellow-400" />
                : <Unlock className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
          );
        })}
      </div>

      <div className="pt-2 border-t border-border">
        {!showReset ? (
          <button onClick={() => setShowReset(true)}
            className="w-full flex items-center gap-2 px-3 py-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm">
            <RotateCcw className="w-4 h-4" /> Reset All Visual Settings
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground text-center">This will reset ALL visual settings to defaults.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowReset(false)} className="flex-1 py-2.5 text-sm bg-secondary rounded-xl">Cancel</button>
              <button onClick={() => { resetAll(); setShowReset(false); }} className="flex-1 py-2.5 text-sm bg-red-500 text-white rounded-xl">Reset All</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'themes',  label: 'Themes',     Icon: Palette  },
  { id: 'bg',      label: 'Backgrounds',Icon: Layers   },
  { id: 'motion',  label: 'Motion',     Icon: Zap      },
  { id: 'display', label: 'Display',    Icon: Sliders  },
  { id: 'control', label: 'Control',    Icon: Lock     },
];

export default function VisualEngine() {
  const [tab, setTab] = useState('themes');

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Visual Engine</h2>
          <span className="ml-auto text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">SYSTEM LAYER</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Themes, backgrounds & animation control</p>
      </div>

      {/* Tab bar */}
      <div className="flex-shrink-0 overflow-x-auto border-b border-border bg-card/50">
        <div className="flex min-w-max">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex flex-col items-center gap-0.5 px-5 py-2.5 text-[10px] font-medium transition-colors whitespace-nowrap ${tab === id ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        {tab === 'themes'  && <ThemesTab />}
        {tab === 'bg'      && <BackgroundsTab />}
        {tab === 'motion'  && <MotionTab />}
        {tab === 'display' && <DisplayTab />}
        {tab === 'control' && <ControlTab />}
      </div>
    </div>
  );
}