import { createContext, useContext, useState, useEffect } from 'react';

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
  crystal_lattice: { label: 'Crystal Lattice',cat: 'mythic'   },
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
  bg: 'none',
  bgOpacity: 0.4,
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
  uiScale: 1,
  // Color wheel hues (0-360) + lightness overrides
  primaryHue: 160,
  bgHue: 230,
  cardHue: 230,
  borderHue: 230,
  primarySat: 100,
  primaryLight: 45,
};

function load(key) {
  try { const v = localStorage.getItem('vse_' + key); return v !== null ? JSON.parse(v) : DEFAULTS[key]; }
  catch { return DEFAULTS[key]; }
}
function save(key, val) { localStorage.setItem('vse_' + key, JSON.stringify(val)); }

const ThemeCtx = createContext(null);

export function ThemeProvider({ children }) {
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
  const [uiScale,        setUiScaleRaw]  = useState(() => load('uiScale'));
  const [primaryHue,     setPrimaryHue]  = useState(() => load('primaryHue'));
  const [bgHue,          setBgHue]       = useState(() => load('bgHue'));
  const [cardHue,        setCardHue]     = useState(() => load('cardHue'));
  const [borderHue,      setBorderHue]   = useState(() => load('borderHue'));
  const [primarySat,     setPrimarySat]  = useState(() => load('primarySat'));
  const [primaryLight,   setPrimaryLight]= useState(() => load('primaryLight'));

  // Setters that check lock
  const isLocked = (key) => lockedSettings.includes(key);
  const setter = (key, stateSetter) => (val) => {
    if (isLocked(key)) return;
    stateSetter(val);
    save(key, val);
  };

  const setBg = setter('bg', setBgRaw);

  // Color setters
  const updatePrimaryHue   = (v) => { setPrimaryHue(v);   save('primaryHue', v); };
  const updateBgHue        = (v) => { setBgHue(v);        save('bgHue', v); };
  const updateCardHue      = (v) => { setCardHue(v);      save('cardHue', v); };
  const updateBorderHue    = (v) => { setBorderHue(v);    save('borderHue', v); };
  const updatePrimarySat   = (v) => { setPrimarySat(v);   save('primarySat', v); };
  const updatePrimaryLight = (v) => { setPrimaryLight(v); save('primaryLight', v); };

  // Apply CSS variables from color wheel
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary',    `${primaryHue} ${primarySat}% ${primaryLight}%`);
    root.style.setProperty('--accent',     `${primaryHue} ${primarySat}% ${primaryLight}%`);
    root.style.setProperty('--ring',       `${primaryHue} ${primarySat}% ${primaryLight}%`);
    root.style.setProperty('--background', `${bgHue} 25% 6%`);
    root.style.setProperty('--card',       `${cardHue} 22% 9%`);
    root.style.setProperty('--border',     `${borderHue} 18% 16%`);
    root.style.setProperty('--muted',      `${bgHue} 18% 12%`);
    root.style.setProperty('--popover',    `${cardHue} 22% 9%`);
    root.style.setProperty('--sidebar-background', `${bgHue} 25% 6%`);
    root.style.setProperty('--sidebar-primary',     `${primaryHue} ${primarySat}% ${primaryLight}%`);
    root.style.setProperty('--sidebar-border',      `${borderHue} 18% 16%`);
  }, [primaryHue, bgHue, cardHue, borderHue, primarySat, primaryLight]);

  // Apply UI scale
  useEffect(() => {
    document.body.style.zoom = uiScale;
  }, [uiScale]);

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

  const setUiScale = (val) => { setUiScaleRaw(val); save('uiScale', val); };

  const resetAll = () => {
    Object.entries(DEFAULTS).forEach(([k, v]) => save(k, v));
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
    setUiScaleRaw(DEFAULTS.uiScale);
    setPrimaryHue(DEFAULTS.primaryHue);
    setBgHue(DEFAULTS.bgHue);
    setCardHue(DEFAULTS.cardHue);
    setBorderHue(DEFAULTS.borderHue);
    setPrimarySat(DEFAULTS.primarySat);
    setPrimaryLight(DEFAULTS.primaryLight);
  };

  const value = {
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
    // color wheel
    primaryHue, updatePrimaryHue,
    bgHue, updateBgHue,
    cardHue, updateCardHue,
    borderHue, updateBorderHue,
    primarySat, updatePrimarySat,
    primaryLight, updatePrimaryLight,
    // legacy compat
    uiScale, setUiScale,
    themes: {}, theme: 'custom', setTheme: () => {},
  };

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);