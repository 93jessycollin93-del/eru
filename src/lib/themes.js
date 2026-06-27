/**
 * Jackie animation themes — pre-built skins with colors, glow, and backgrounds.
 * Inspired by CS:GO weapon skins, gaming aesthetics, sci-fi interfaces.
 * Includes robust localStorage, export/import, and validation.
 */

export const JACKIE_THEMES = {
  dark: {
    name: 'Dark',
    description: 'Classic dark interface with subtle glow',
    triangleColor: '#00ff88',
    backgroundColor: '#0a0e27',
    glowIntensity: 0.8,
    brightness: 1,
    rotationSpeed: 1,
  },
  neon: {
    name: 'Neon Dreams',
    description: 'Bright cyan + pink cyberpunk aesthetic',
    triangleColor: '#ff006e',
    backgroundColor: '#0d0221',
    glowIntensity: 1.2,
    brightness: 1.1,
    rotationSpeed: 1.2,
  },
  deepspace: {
    name: 'Deep Space',
    description: 'Black void with purple stars',
    triangleColor: '#8338ec',
    backgroundColor: '#0a0a14',
    glowIntensity: 1,
    brightness: 0.95,
    rotationSpeed: 0.8,
  },
  circuit: {
    name: 'Circuit Board',
    description: 'Tech lines and green matrix',
    triangleColor: '#00ff00',
    backgroundColor: '#001a00',
    glowIntensity: 1.1,
    brightness: 1,
    rotationSpeed: 1.3,
  },
  sunset: {
    name: 'Sunset',
    description: 'Orange to purple gradient warmth',
    triangleColor: '#ff6b35',
    backgroundColor: '#1a0f2e',
    glowIntensity: 0.9,
    brightness: 1.05,
    rotationSpeed: 0.9,
  },
  minimal: {
    name: 'Minimal',
    description: 'Clean white on dark, zero glow',
    triangleColor: '#ffffff',
    backgroundColor: '#1a1a1a',
    glowIntensity: 0.3,
    brightness: 1,
    rotationSpeed: 0.7,
  },
  cyberpunk: {
    name: 'Cyberpunk',
    description: 'High contrast neon on dark',
    triangleColor: '#00ffff',
    backgroundColor: '#0d0d1f',
    glowIntensity: 1.3,
    brightness: 1.15,
    rotationSpeed: 1.1,
  },
};

/**
 * Default theme data (used if localStorage is corrupted).
 */
const DEFAULT_CUSTOM_THEME = {
  brightness: 1,
  glowIntensity: 1,
  rotationSpeed: 1,
  elementColors: {},
  backgroundPattern: null,
};

/**
 * Validate theme data structure.
 */
function isValidTheme(data) {
  if (!data || typeof data !== 'object') return false;
  const hasRequiredFields = 'brightness' in data && 'glowIntensity' in data;
  const isNumeric = typeof data.brightness === 'number' && typeof data.glowIntensity === 'number';
  return hasRequiredFields && isNumeric;
}

/**
 * Validate hex color.
 */
function isValidColor(color) {
  return typeof color === 'string' && /^#[0-9A-F]{6}$/i.test(color);
}

/**
 * Sanitize theme data (remove invalid fields, clamp values).
 */
function sanitizeTheme(data) {
  if (!isValidTheme(data)) return DEFAULT_CUSTOM_THEME;
  return {
    brightness: Math.max(0.5, Math.min(1.5, data.brightness || 1)),
    glowIntensity: Math.max(0.3, Math.min(1.5, data.glowIntensity || 1)),
    rotationSpeed: Math.max(0.5, Math.min(1.5, data.rotationSpeed || 1)),
    elementColors: data.elementColors && typeof data.elementColors === 'object' ? data.elementColors : {},
    backgroundPattern: data.backgroundPattern || null,
  };
}

/**
 * Get a theme by name, fallback to dark.
 */
export function getTheme(themeName) {
  return JACKIE_THEMES[themeName] || JACKIE_THEMES.dark;
}

/**
 * Get all theme names for selector.
 */
export function getThemeNames() {
  return Object.keys(JACKIE_THEMES);
}

/**
 * Persist theme to localStorage with error handling.
 */
export function saveTheme(themeName) {
  try {
    if (!getTheme(themeName)) themeName = 'dark';
    localStorage.setItem('jackie_theme', themeName);
  } catch (e) {
    console.warn('localStorage unavailable, theme not saved');
  }
}

/**
 * Load theme from localStorage, fallback to dark with retry.
 */
export function loadTheme() {
  try {
    const saved = localStorage.getItem('jackie_theme');
    if (saved && getTheme(saved)) return saved;
  } catch (e) {
    console.warn('localStorage unavailable');
  }
  return 'dark';
}

/**
 * Save custom theme with validation.
 */
export function saveCustomTheme(overrides) {
  try {
    const sanitized = sanitizeTheme(overrides);
    localStorage.setItem('jackie_theme_custom', JSON.stringify(sanitized));
  } catch (e) {
    console.warn('Failed to save custom theme');
  }
}

/**
 * Load custom theme with fallback to defaults if corrupted.
 */
export function loadCustomTheme() {
  try {
    const custom = localStorage.getItem('jackie_theme_custom');
    if (!custom) return DEFAULT_CUSTOM_THEME;
    const parsed = JSON.parse(custom);
    return sanitizeTheme(parsed);
  } catch (e) {
    console.warn('Custom theme corrupted, using defaults');
    return DEFAULT_CUSTOM_THEME;
  }
}

/**
 * Export theme as JSON string.
 */
export function exportTheme(themeName, customOverrides) {
  const base = getTheme(themeName);
  const merged = { ...base, ...customOverrides, themeName, exportedAt: new Date().toISOString() };
  return JSON.stringify(merged, null, 2);
}

/**
 * Import theme from JSON string with validation.
 */
export function importTheme(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!isValidTheme(data)) throw new Error('Invalid theme structure');
    const sanitized = sanitizeTheme(data);
    return { success: true, data: sanitized, error: null };
  } catch (e) {
    return {
      success: false,
      data: null,
      error: `Failed to import theme: ${e.message}`,
    };
  }
}

/**
 * Reset custom theme to defaults.
 */
export function resetCustomTheme() {
  try {
    localStorage.removeItem('jackie_theme_custom');
  } catch (e) {
    console.warn('Failed to reset theme');
  }
  return DEFAULT_CUSTOM_THEME;
}
