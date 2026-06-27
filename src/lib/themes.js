/**
 * Jackie animation themes — pre-built skins with colors, glow, and backgrounds.
 * Inspired by CS:GO weapon skins, gaming aesthetics, sci-fi interfaces.
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
 * Persist theme to localStorage.
 */
export function saveTheme(themeName) {
  try {
    localStorage.setItem('jackie_theme', themeName);
  } catch (e) {
    console.error('Failed to save theme:', e);
  }
}

/**
 * Load theme from localStorage, fallback to dark.
 */
export function loadTheme() {
  try {
    return localStorage.getItem('jackie_theme') || 'dark';
  } catch (e) {
    return 'dark';
  }
}

/**
 * Save custom theme (overrides).
 */
export function saveCustomTheme(overrides) {
  try {
    localStorage.setItem('jackie_theme_custom', JSON.stringify(overrides));
  } catch (e) {
    console.error('Failed to save custom theme:', e);
  }
}

/**
 * Load custom theme from localStorage.
 */
export function loadCustomTheme() {
  try {
    const custom = localStorage.getItem('jackie_theme_custom');
    return custom ? JSON.parse(custom) : null;
  } catch (e) {
    return null;
  }
}
