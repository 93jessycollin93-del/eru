import { createContext, useContext, useState, useEffect } from 'react';

// ─── BACKGROUND ENVIRONMENTS ─────────────────────────────────────────────────
export const BG_ENVS = {
  none:            { label: 'None',           cat: 'off'      },
  // Digital (animated)
  neural_mesh:     { label: 'Neural Mesh',    cat: 'digital'  },
  // Space (animated)
  stars:           { label: 'Star Field',     cat: 'space'    },
  nebula:          { label: 'Nebula',         cat: 'space'    },
  aurora_sky:      { label: 'Aurora Sky',     cat: 'space'    },
  // Nature (animated)
  particles:       { label: 'Floating Dust',  cat: 'nature'   },
  // Energy (animated)
  fire:            { label: 'Embers',         cat: 'energy'   },
  // Mythic (animated)
  crystal_lattice: { label: 'Crystal Lattice',cat: 'mythic'   },
  // ── Astronomical Still Backdrops ──────────────────────────────────────────
  still_milkyway:   { label: 'Milky Way Core',    cat: 'still', url: 'https://images.unsplash.com/photo-1465101162946-4377e57745c3?w=1600&q=90&fit=crop' },
  still_nebula:     { label: 'Pillars of Cosmos', cat: 'still', url: 'https://images.unsplash.com/photo-1502134249126-9f3755a50d78?w=1600&q=90&fit=crop' },
  still_galaxy:     { label: 'Spiral Galaxy',     cat: 'still', url: 'https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?w=1600&q=90&fit=crop' },
  still_aurora:     { label: 'Aurora Borealis',   cat: 'still', url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1600&q=90&fit=crop' },
  still_earth:      { label: 'Earth From Orbit',  cat: 'still', url: 'https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?w=1600&q=90&fit=crop' },
  still_moon:       { label: 'Lunar Surface',     cat: 'still', url: 'https://images.unsplash.com/photo-1522030299830-16b8d3d049fe?w=1600&q=90&fit=crop' },
  still_startrail:  { label: 'Star Trails',       cat: 'still', url: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=1600&q=90&fit=crop' },
  still_cosmos:     { label: 'Deep Cosmos',       cat: 'still', url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1600&q=90&fit=crop' },
  still_saturn:     { label: 'Ringed Planet',     cat: 'still', url: 'https://images.unsplash.com/photo-1614726365952-510103b1bdb8?w=1600&q=90&fit=crop' },
  still_stardust:   { label: 'Cosmic Stardust',   cat: 'still', url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=1600&q=90&fit=crop' },
  still_eclipse:    { label: 'Solar Eclipse',     cat: 'still', url: 'https://images.unsplash.com/photo-1532798369041-b33eb576ef16?w=1600&q=90&fit=crop' },
  still_supernova:  { label: 'Supernova',         cat: 'still', url: 'https://images.unsplash.com/photo-1543722530-d2c3201371e7?w=1600&q=90&fit=crop' },
  still_telescope:  { label: 'Observatory Night', cat: 'still', url: 'https://images.unsplash.com/photo-1537420327992-d6e192287183?w=1600&q=90&fit=crop' },
  still_darksky:    { label: 'Dark Sky Desert',   cat: 'still', url: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1600&q=90&fit=crop' },
  still_plasma:     { label: 'Plasma Storm',      cat: 'still', url: 'https://images.unsplash.com/photo-1475274047050-1d0c0975c63e?w=1600&q=90&fit=crop' },
  // ── Wildlife & Nature Backdrops ──────────────────────────────────────────────
  wild_lion:        { label: 'Lion Portrait',       cat: 'wildlife', url: 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=1600&q=90&fit=crop' },
  wild_tiger:       { label: 'Bengal Tiger',        cat: 'wildlife', url: 'https://images.unsplash.com/photo-1561731216-c3a4d99437d5?w=1600&q=90&fit=crop' },
  wild_elephant:    { label: 'African Elephant',    cat: 'wildlife', url: 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?w=1600&q=90&fit=crop' },
  wild_eagle:       { label: 'Bald Eagle',          cat: 'wildlife', url: 'https://images.unsplash.com/photo-1611689342806-0863de65d784?w=1600&q=90&fit=crop' },
  wild_wolf:        { label: 'Arctic Wolf',         cat: 'wildlife', url: 'https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=1600&q=90&fit=crop' },
  wild_leopard:     { label: 'Snow Leopard',        cat: 'wildlife', url: 'https://images.unsplash.com/photo-1552410260-0fd9b577afa6?w=1600&q=90&fit=crop' },
  wild_orca:        { label: 'Orca Breach',         cat: 'wildlife', url: 'https://images.unsplash.com/photo-1568430462989-44163eb1752f?w=1600&q=90&fit=crop' },
  wild_flamingo:    { label: 'Pink Flamingos',      cat: 'wildlife', url: 'https://images.unsplash.com/photo-1559827291-72ee739d0d9a?w=1600&q=90&fit=crop' },
  wild_hummingbird: { label: 'Hummingbird',         cat: 'wildlife', url: 'https://images.unsplash.com/photo-1444464666168-49d633b86797?w=1600&q=90&fit=crop' },
  wild_jellyfish:   { label: 'Jellyfish Bloom',     cat: 'wildlife', url: 'https://images.unsplash.com/photo-1545671913-b89ac1b4ac10?w=1600&q=90&fit=crop' },
  wild_turtle:      { label: 'Sea Turtle',          cat: 'wildlife', url: 'https://images.unsplash.com/photo-1591025207163-942350e47db2?w=1600&q=90&fit=crop' },
  wild_parrot:      { label: 'Scarlet Macaw',       cat: 'wildlife', url: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=1600&q=90&fit=crop' },
  wild_cheetah:     { label: 'Cheetah Sprint',      cat: 'wildlife', url: 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=1600&q=90&fit=crop' },
  wild_gorilla:     { label: 'Mountain Gorilla',    cat: 'wildlife', url: 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?w=1600&q=90&fit=crop' },
  wild_bear:        { label: 'Grizzly Bear',        cat: 'wildlife', url: 'https://images.unsplash.com/photo-1589656966895-2f33e7653819?w=1600&q=90&fit=crop' },
  wild_peacock:     { label: 'Peacock Display',     cat: 'wildlife', url: 'https://images.unsplash.com/photo-1568564321927-7f44f2826b7c?w=1600&q=90&fit=crop' },
  wild_dolphin:     { label: 'Dolphins Leaping',    cat: 'wildlife', url: 'https://images.unsplash.com/photo-1607153333879-c174d265f1d2?w=1600&q=90&fit=crop' },
  wild_fox:         { label: 'Red Fox',             cat: 'wildlife', url: 'https://images.unsplash.com/photo-1516934024742-b461fba47600?w=1600&q=90&fit=crop' },
  wild_owl:         { label: 'Snowy Owl',           cat: 'wildlife', url: 'https://images.unsplash.com/photo-1579198268120-f9c77b4df4f8?w=1600&q=90&fit=crop' },
  wild_manta:       { label: 'Manta Ray',           cat: 'wildlife', url: 'https://images.unsplash.com/photo-1583118443787-5bc7bd614d54?w=1600&q=90&fit=crop' },
  wild_giraffe:     { label: 'Giraffe Savanna',     cat: 'wildlife', url: 'https://images.unsplash.com/photo-1547721064-da6cfb341d50?w=1600&q=90&fit=crop' },
  wild_panda:       { label: 'Giant Panda',         cat: 'wildlife', url: 'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=1600&q=90&fit=crop' },
  wild_horse:       { label: 'Wild Mustangs',       cat: 'wildlife', url: 'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=1600&q=90&fit=crop' },
  wild_coral:       { label: 'Coral Reef World',    cat: 'wildlife', url: 'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=1600&q=90&fit=crop' },
  wild_butterfly:   { label: 'Morpho Butterfly',    cat: 'wildlife', url: 'https://images.unsplash.com/photo-1590447943588-ac88e62e9a6d?w=1600&q=90&fit=crop' },
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