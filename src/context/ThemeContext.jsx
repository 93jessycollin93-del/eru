import { createContext, useContext, useState, useEffect } from 'react';

const THEMES = {
  cyber: { '--primary': '160 100% 45%', '--background': '230 25% 6%', '--card': '230 22% 9%', '--border': '230 18% 16%', label: 'Cyber Green' },
  neon_purple: { '--primary': '280 100% 65%', '--background': '260 30% 5%', '--card': '260 25% 8%', '--border': '260 20% 14%', label: 'Neon Purple' },
  solar: { '--primary': '45 100% 55%', '--background': '20 20% 5%', '--card': '20 18% 8%', '--border': '20 15% 14%', label: 'Solar Gold' },
  ice: { '--primary': '200 100% 60%', '--background': '220 30% 6%', '--card': '220 25% 9%', '--border': '220 20% 15%', label: 'Ice Blue' },
  ember: { '--primary': '350 100% 60%', '--background': '10 25% 5%', '--card': '10 20% 8%', '--border': '10 15% 14%', label: 'Ember Red' },
};

const ThemeCtx = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('app-theme') || 'cyber');
  const [bg, setBg] = useState(() => localStorage.getItem('app-bg') || 'none');
  const [bgOpacity, setBgOpacity] = useState(() => parseFloat(localStorage.getItem('app-bg-opacity') || '0.4'));
  const [uiScale, setUiScale] = useState(() => parseFloat(localStorage.getItem('app-ui-scale') || '1'));

  useEffect(() => {
    const t = THEMES[theme] || THEMES.cyber;
    Object.entries(t).forEach(([k, v]) => {
      if (k.startsWith('--')) document.documentElement.style.setProperty(k, v);
    });
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  useEffect(() => { localStorage.setItem('app-bg', bg); }, [bg]);
  useEffect(() => { localStorage.setItem('app-bg-opacity', bgOpacity); }, [bgOpacity]);
  useEffect(() => {
    document.documentElement.style.setProperty('font-size', `${uiScale * 100}%`);
    localStorage.setItem('app-ui-scale', uiScale);
  }, [uiScale]);

  return (
    <ThemeCtx.Provider value={{ theme, setTheme, bg, setBg, bgOpacity, setBgOpacity, uiScale, setUiScale, themes: THEMES }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);