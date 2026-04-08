import { createContext, useContext, useState, useEffect } from 'react';

// ─── 50+ THEME PRESETS ────────────────────────────────────────────────────────
export const THEMES = {
  // CYBER / DARK
  cyber_green:    { label:'Cyber Green',    cat:'cyber',   '--primary':'160 100% 45%', '--background':'230 25% 6%',  '--card':'230 22% 9%',  '--border':'230 18% 16%', '--muted':'230 18% 12%', '--muted-foreground':'220 12% 50%' },
  cyber_blue:     { label:'Cyber Blue',     cat:'cyber',   '--primary':'200 100% 55%', '--background':'225 30% 6%',  '--card':'225 25% 9%',  '--border':'225 20% 15%', '--muted':'225 22% 12%', '--muted-foreground':'220 12% 48%' },
  cyber_red:      { label:'Cyber Red',      cat:'cyber',   '--primary':'350 100% 55%', '--background':'10 25% 5%',   '--card':'10 22% 8%',   '--border':'10 18% 14%',  '--muted':'10 18% 11%',  '--muted-foreground':'0 10% 48%'  },
  cyber_orange:   { label:'Cyber Orange',   cat:'cyber',   '--primary':'30 100% 55%',  '--background':'20 25% 5%',   '--card':'20 22% 8%',   '--border':'20 18% 14%',  '--muted':'20 18% 11%',  '--muted-foreground':'20 10% 48%' },
  cyber_pink:     { label:'Cyber Pink',     cat:'cyber',   '--primary':'320 100% 65%', '--background':'300 25% 5%',  '--card':'300 22% 8%',  '--border':'300 18% 13%', '--muted':'300 18% 10%', '--muted-foreground':'300 10% 48%'},
  // NEON
  neon_purple:    { label:'Neon Purple',    cat:'neon',    '--primary':'280 100% 68%', '--background':'260 30% 5%',  '--card':'260 25% 8%',  '--border':'260 20% 14%', '--muted':'260 20% 11%', '--muted-foreground':'260 12% 48%'},
  neon_teal:      { label:'Neon Teal',      cat:'neon',    '--primary':'175 100% 45%', '--background':'190 30% 5%',  '--card':'190 25% 8%',  '--border':'190 20% 14%', '--muted':'190 20% 11%', '--muted-foreground':'190 12% 48%'},
  neon_lime:      { label:'Neon Lime',      cat:'neon',    '--primary':'80 100% 50%',  '--background':'80 20% 5%',   '--card':'80 18% 8%',   '--border':'80 15% 13%',  '--muted':'80 15% 10%',  '--muted-foreground':'80 10% 48%' },
  neon_coral:     { label:'Neon Coral',     cat:'neon',    '--primary':'15 100% 65%',  '--background':'350 25% 5%',  '--card':'350 22% 8%',  '--border':'350 18% 13%', '--muted':'350 18% 10%', '--muted-foreground':'350 10% 48%'},
  neon_yellow:    { label:'Neon Yellow',    cat:'neon',    '--primary':'55 100% 58%',  '--background':'50 20% 5%',   '--card':'50 18% 8%',   '--border':'50 15% 13%',  '--muted':'50 15% 10%',  '--muted-foreground':'50 10% 48%' },
  // JADE
  jade_classic:   { label:'Jade Classic',   cat:'jade',    '--primary':'150 80% 45%',  '--background':'160 25% 5%',  '--card':'160 22% 8%',  '--border':'160 18% 14%', '--muted':'160 18% 11%', '--muted-foreground':'160 12% 48%'},
  jade_imperial:  { label:'Jade Imperial',  cat:'jade',    '--primary':'142 70% 40%',  '--background':'155 30% 4%',  '--card':'155 26% 7%',  '--border':'155 20% 12%', '--muted':'155 20% 9%',  '--muted-foreground':'155 12% 45%'},
  jade_lavender:  { label:'Jade Lavender',  cat:'jade',    '--primary':'270 70% 65%',  '--background':'155 20% 5%',  '--card':'155 18% 8%',  '--border':'155 15% 13%', '--muted':'155 15% 10%', '--muted-foreground':'155 10% 48%'},
  jade_frost:     { label:'Jade Frost',     cat:'jade',    '--primary':'185 60% 55%',  '--background':'165 25% 6%',  '--card':'165 22% 9%',  '--border':'165 18% 15%', '--muted':'165 18% 12%', '--muted-foreground':'165 12% 50%'},
  jade_void:      { label:'Jade Void',      cat:'jade',    '--primary':'160 100% 40%', '--background':'160 15% 3%',  '--card':'160 12% 5%',  '--border':'160 10% 10%', '--muted':'160 10% 8%',  '--muted-foreground':'160 8% 40%' },
  // GOLD / SOLAR
  solar_gold:     { label:'Solar Gold',     cat:'gold',    '--primary':'45 100% 55%',  '--background':'20 20% 5%',   '--card':'20 18% 8%',   '--border':'20 15% 14%',  '--muted':'20 15% 11%',  '--muted-foreground':'20 10% 48%' },
  solar_amber:    { label:'Solar Amber',    cat:'gold',    '--primary':'38 100% 55%',  '--background':'25 22% 5%',   '--card':'25 18% 8%',   '--border':'25 15% 13%',  '--muted':'25 15% 10%',  '--muted-foreground':'25 10% 48%' },
  solar_bronze:   { label:'Solar Bronze',   cat:'gold',    '--primary':'30 80% 50%',   '--background':'15 20% 5%',   '--card':'15 17% 8%',   '--border':'15 14% 13%',  '--muted':'15 14% 10%',  '--muted-foreground':'15 10% 47%' },
  solar_platinum: { label:'Solar Platinum', cat:'gold',    '--primary':'220 15% 75%',  '--background':'220 15% 7%',  '--card':'220 12% 10%', '--border':'220 10% 16%', '--muted':'220 10% 13%', '--muted-foreground':'220 8% 50%' },
  // VOID / SPACE
  void_dark:      { label:'Void Dark',      cat:'void',    '--primary':'240 80% 65%',  '--background':'240 20% 3%',  '--card':'240 18% 5%',  '--border':'240 15% 9%',  '--muted':'240 15% 7%',  '--muted-foreground':'240 10% 40%'},
  void_eclipse:   { label:'Void Eclipse',   cat:'void',    '--primary':'260 90% 70%',  '--background':'255 25% 3%',  '--card':'255 20% 5%',  '--border':'255 15% 9%',  '--muted':'255 15% 7%',  '--muted-foreground':'255 10% 40%'},
  void_cosmic:    { label:'Void Cosmic',    cat:'void',    '--primary':'300 100% 65%', '--background':'270 25% 3%',  '--card':'270 20% 5%',  '--border':'270 15% 9%',  '--muted':'270 15% 7%',  '--muted-foreground':'270 10% 40%'},
  void_nebula:    { label:'Void Nebula',    cat:'void',    '--primary':'195 100% 60%', '--background':'250 20% 4%',  '--card':'250 17% 7%',  '--border':'250 14% 11%', '--muted':'250 14% 8%',  '--muted-foreground':'250 10% 42%'},
  // ORGANIC
  forest_deep:    { label:'Forest Deep',    cat:'organic', '--primary':'130 60% 45%',  '--background':'140 20% 5%',  '--card':'140 17% 8%',  '--border':'140 14% 13%', '--muted':'140 14% 10%', '--muted-foreground':'140 10% 47%'},
  ocean_deep:     { label:'Ocean Deep',     cat:'organic', '--primary':'200 80% 50%',  '--background':'210 30% 5%',  '--card':'210 25% 8%',  '--border':'210 20% 13%', '--muted':'210 20% 10%', '--muted-foreground':'210 12% 47%'},
  earth_rust:     { label:'Earth Rust',     cat:'organic', '--primary':'25 70% 50%',   '--background':'20 20% 5%',   '--card':'20 17% 8%',   '--border':'20 14% 13%',  '--muted':'20 14% 10%',  '--muted-foreground':'20 10% 47%' },
  moonstone:      { label:'Moonstone',      cat:'organic', '--primary':'210 40% 70%',  '--background':'215 20% 6%',  '--card':'215 17% 9%',  '--border':'215 14% 14%', '--muted':'215 14% 11%', '--muted-foreground':'215 10% 48%'},
  // MINIMAL
  minimal_white:  { label:'Minimal Light',  cat:'minimal', '--primary':'230 80% 55%',  '--background':'220 20% 98%', '--card':'220 15% 96%', '--border':'220 12% 88%', '--muted':'220 12% 94%', '--muted-foreground':'220 10% 45%'},
  minimal_slate:  { label:'Minimal Slate',  cat:'minimal', '--primary':'220 60% 55%',  '--background':'220 15% 12%', '--card':'220 12% 15%', '--border':'220 10% 22%', '--muted':'220 10% 18%', '--muted-foreground':'220 8% 52%' },
  minimal_mono:   { label:'Minimal Mono',   cat:'minimal', '--primary':'0 0% 85%',     '--background':'0 0% 5%',     '--card':'0 0% 8%',     '--border':'0 0% 14%',    '--muted':'0 0% 11%',    '--muted-foreground':'0 0% 45%'   },
  // ENERGY / FIRE
  magma:          { label:'Magma',          cat:'energy',  '--primary':'15 100% 60%',  '--background':'10 30% 4%',   '--card':'10 25% 7%',   '--border':'10 20% 12%',  '--muted':'10 20% 9%',   '--muted-foreground':'10 12% 45%' },
  aurora:         { label:'Aurora',         cat:'energy',  '--primary':'170 100% 50%', '--background':'200 30% 4%',  '--card':'200 25% 7%',  '--border':'200 20% 12%', '--muted':'200 20% 9%',  '--muted-foreground':'200 12% 45%'},
  plasma:         { label:'Plasma',         cat:'energy',  '--primary':'290 100% 70%', '--background':'280 30% 4%',  '--card':'280 25% 7%',  '--border':'280 20% 12%', '--muted':'280 20% 9%',  '--muted-foreground':'280 12% 45%'},
  lightning:      { label:'Lightning',      cat:'energy',  '--primary':'55 100% 70%',  '--background':'230 25% 4%',  '--card':'230 22% 7%',  '--border':'230 18% 12%', '--muted':'230 18% 9%',  '--muted-foreground':'230 12% 45%'},
  // MYTHIC
  sacred:         { label:'Sacred Geometry',cat:'mythic',  '--primary':'50 100% 60%',  '--background':'220 20% 4%',  '--card':'220 17% 7%',  '--border':'220 14% 12%', '--muted':'220 14% 9%',  '--muted-foreground':'220 10% 45%'},
  crystal:        { label:'Crystal Vault',  cat:'mythic',  '--primary':'180 100% 65%', '--background':'200 25% 5%',  '--card':'200 22% 8%',  '--border':'200 18% 13%', '--muted':'200 18% 10%', '--muted-foreground':'200 12% 47%'},
  jade_void_m:    { label:'Jade Void Mythic',cat:'mythic', '--primary':'155 80% 45%',  '--background':'155 20% 3%',  '--card':'155 17% 5%',  '--border':'155 14% 9%',  '--muted':'155 14% 7%',  '--muted-foreground':'155 10% 40%'},
  cyber_cathedral:{ label:'Cyber Cathedral',cat:'mythic',  '--primary':'250 80% 70%',  '--background':'245 25% 4%',  '--card':'245 22% 7%',  '--border':'245 18% 12%', '--muted':'245 18% 9%',  '--muted-foreground':'245 12% 45%'},
  // ICE / COOL
  ice_blue:       { label:'Ice Blue',       cat:'cool',    '--primary':'200 100% 60%', '--background':'220 30% 6%',  '--card':'220 25% 9%',  '--border':'220 20% 15%', '--muted':'220 22% 12%', '--muted-foreground':'220 12% 48%'},
  arctic:         { label:'Arctic',         cat:'cool',    '--primary':'195 80% 65%',  '--background':'210 25% 5%',  '--card':'210 22% 8%',  '--border':'210 18% 14%', '--muted':'210 18% 11%', '--muted-foreground':'210 12% 48%'},
  midnight_blue:  { label:'Midnight Blue',  cat:'cool',    '--primary':'225 80% 60%',  '--background':'230 25% 5%',  '--card':'230 22% 8%',  '--border':'230 18% 14%', '--muted':'230 18% 11%', '--muted-foreground':'230 12% 47%'},
  // WARM
  ember_red:      { label:'Ember Red',      cat:'warm',    '--primary':'350 100% 60%', '--background':'10 25% 5%',   '--card':'10 20% 8%',   '--border':'10 15% 14%',  '--muted':'10 15% 11%',  '--muted-foreground':'0 10% 48%'  },
  sunset:         { label:'Sunset',         cat:'warm',    '--primary':'25 100% 60%',  '--background':'15 25% 5%',   '--card':'15 22% 8%',   '--border':'15 18% 13%',  '--muted':'15 18% 10%',  '--muted-foreground':'15 10% 47%' },
  rose:           { label:'Rose',           cat:'warm',    '--primary':'340 90% 65%',  '--background':'340 20% 5%',  '--card':'340 17% 8%',  '--border':'340 14% 13%', '--muted':'340 14% 10%', '--muted-foreground':'340 10% 47%'},
  // EXTRA
  emerald_city:   { label:'Emerald City',   cat:'jade',    '--primary':'145 70% 50%',  '--background':'150 25% 5%',  '--card':'150 22% 8%',  '--border':'150 18% 14%', '--muted':'150 18% 11%', '--muted-foreground':'150 12% 48%'},
  deep_space:     { label:'Deep Space',     cat:'void',    '--primary':'220 100% 65%', '--background':'230 30% 3%',  '--card':'230 25% 5%',  '--border':'230 20% 9%',  '--muted':'230 20% 7%',  '--muted-foreground':'230 12% 40%'},
  toxic_green:    { label:'Toxic Green',    cat:'neon',    '--primary':'90 100% 50%',  '--background':'100 20% 4%',  '--card':'100 17% 7%',  '--border':'100 14% 12%', '--muted':'100 14% 9%',  '--muted-foreground':'100 10% 45%'},
  royal_purple:   { label:'Royal Purple',   cat:'mythic',  '--primary':'265 80% 65%',  '--background':'260 25% 5%',  '--card':'260 22% 8%',  '--border':'260 18% 13%', '--muted':'260 18% 10%', '--muted-foreground':'260 12% 47%'},
};

// ─── BACKGROUND ENVIRONMENTS ─────────────────────────────────────────────────
export const BG_ENVS = {
  none:            { label: 'None',           cat: 'off'      },
  // Digital
  matrix:          { label: 'Matrix Rain',    cat: 'digital'  },
  neural_mesh:     { label: 'Neural Mesh',    cat: 'digital'  },
  // Space
  stars:           { label: 'Star Field',     cat: 'space'    },
  nebula:          { label: 'Nebula',         cat: 'space'    },
  aurora_sky:      { label: 'Aurora Sky',     cat: 'space'    },
  // Nature
  particles:       { label: 'Floating Dust',  cat: 'nature'   },
  // Energy
  fire:            { label: 'Embers',         cat: 'energy'   },
  // Mythic
  sacred_geometry: { label: 'Sacred Geometry',cat: 'mythic'   },
  crystal_lattice: { label: 'Crystal Lattice',cat: 'mythic'   },
  jade_void_bg:    { label: 'Jade Void',      cat: 'mythic'   },
};

// ─── MOTION PRESETS ──────────────────────────────────────────────────────────
export const MOTION_PRESETS = {
  none:    { label:'None',    speed:0,   scale:0   },
  subtle:  { label:'Subtle',  speed:0.5, scale:0.3 },
  default: { label:'Default', speed:1,   scale:1   },
  fluid:   { label:'Fluid',   speed:1.5, scale:1.2 },
  hyper:   { label:'Hyper',   speed:2.5, scale:2   },
};

// ─── TYPOGRAPHY PACKS ────────────────────────────────────────────────────────
export const TYPOGRAPHY_PACKS = {
  modern:  { label:'Modern',   font:'"Inter", sans-serif',       mono:'"JetBrains Mono", monospace' },
  cyber:   { label:'Cyber',    font:'"Share Tech Mono", monospace',mono:'"Share Tech Mono", monospace' },
  elegant: { label:'Elegant',  font:'"Playfair Display", serif',  mono:'"JetBrains Mono", monospace' },
  minimal: { label:'Minimal',  font:'"DM Sans", sans-serif',      mono:'"DM Mono", monospace' },
};

// ─── DEFAULTS ────────────────────────────────────────────────────────────────
const DEFAULTS = {
  theme: 'cyber_green',
  bg: 'none',
  bgOpacity: 0.4,
  motionPreset: 'default',
  motionIntensity: 1,
  glowIntensity: 1,
  blurLevel: 1,
  particleDensity: 1,
  animSpeed: 1,
  brightness: 1,
  contrast: 1,
  saturation: 1,
  typography: 'modern',
  lowPowerMode: false,
  lockedSettings: [],
};

function load(key) {
  try { const v = localStorage.getItem('vse_' + key); return v !== null ? JSON.parse(v) : DEFAULTS[key]; }
  catch { return DEFAULTS[key]; }
}
function save(key, val) { localStorage.setItem('vse_' + key, JSON.stringify(val)); }

const ThemeCtx = createContext(null);

export function ThemeProvider({ children }) {
  const [theme,          setThemeRaw]    = useState(() => load('theme'));
  const [bg,             setBgRaw]       = useState(() => load('bg'));
  const [bgOpacity,      setBgOpacity]   = useState(() => load('bgOpacity'));
  const [motionIntensity,setMotionInt]   = useState(() => load('motionIntensity'));
  const [glowIntensity,  setGlowInt]     = useState(() => load('glowIntensity'));
  const [blurLevel,      setBlurLevel]   = useState(() => load('blurLevel'));
  const [particleDensity,setParticleDen] = useState(() => load('particleDensity'));
  const [animSpeed,      setAnimSpeed]   = useState(() => load('animSpeed'));
  const [brightness,     setBrightness]  = useState(() => load('brightness'));
  const [contrast,       setContrast]    = useState(() => load('contrast'));
  const [saturation,     setSaturation]  = useState(() => load('saturation'));
  const [typography,     setTypography]  = useState(() => load('typography'));
  const [lowPowerMode,   setLowPower]    = useState(() => load('lowPowerMode'));
  const [lockedSettings, setLocked]      = useState(() => load('lockedSettings'));

  // Setters that check lock
  const isLocked = (key) => lockedSettings.includes(key);
  const setter = (key, stateSetter) => (val) => {
    if (isLocked(key)) return;
    stateSetter(val);
    save(key, val);
  };

  const setTheme    = setter('theme',    setThemeRaw);
  const setBg       = setter('bg',       setBgRaw);

  // Apply CSS variables on theme change
  useEffect(() => {
    const t = THEMES[theme] || THEMES.cyber_green;
    Object.entries(t).forEach(([k, v]) => {
      if (k.startsWith('--')) document.documentElement.style.setProperty(k, v);
    });
  }, [theme]);

  // Apply filter effects
  useEffect(() => {
    const filter = lowPowerMode
      ? 'none'
      : `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
    document.documentElement.style.setProperty('--vse-filter', filter);
    document.body.style.filter = filter === 'none' ? '' : filter;
  }, [brightness, contrast, saturation, lowPowerMode]);

  // Apply glow CSS var
  useEffect(() => {
    document.documentElement.style.setProperty('--glow-intensity', glowIntensity);
  }, [glowIntensity]);

  const resetAll = () => {
    Object.entries(DEFAULTS).forEach(([k, v]) => save(k, v));
    setThemeRaw(DEFAULTS.theme);
    setBgRaw(DEFAULTS.bg);
    setBgOpacity(DEFAULTS.bgOpacity);
    setMotionInt(DEFAULTS.motionIntensity);
    setGlowInt(DEFAULTS.glowIntensity);
    setBlurLevel(DEFAULTS.blurLevel);
    setParticleDen(DEFAULTS.particleDensity);
    setAnimSpeed(DEFAULTS.animSpeed);
    setBrightness(DEFAULTS.brightness);
    setContrast(DEFAULTS.contrast);
    setSaturation(DEFAULTS.saturation);
    setTypography(DEFAULTS.typography);
    setLowPower(DEFAULTS.lowPowerMode);
  };

  const value = {
    // theme
    theme, setTheme, themes: THEMES,
    // background
    bg, setBg, bgOpacity, setBgOpacity: setter('bgOpacity', setBgOpacity),
    // motion
    motionIntensity, setMotionIntensity: setter('motionIntensity', setMotionInt),
    // glow/blur
    glowIntensity, setGlowIntensity: setter('glowIntensity', setGlowInt),
    blurLevel, setBlurLevel: setter('blurLevel', setBlurLevel),
    // particles
    particleDensity, setParticleDensity: setter('particleDensity', setParticleDen),
    // animation
    animSpeed, setAnimSpeed: setter('animSpeed', setAnimSpeed),
    // display
    brightness, setBrightness: setter('brightness', setBrightness),
    contrast, setContrast: setter('contrast', setContrast),
    saturation, setSaturation: setter('saturation', setSaturation),
    // typography
    typography, setTypography: setter('typography', setTypography),
    // low power
    lowPowerMode, setLowPowerMode: setter('lowPowerMode', setLowPower),
    // lock system
    lockedSettings, setLockedSettings: setLocked,
    isLocked,
    // utils
    resetAll,
    // legacy compat
    uiScale: 1, setUiScale: () => {},
  };

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);