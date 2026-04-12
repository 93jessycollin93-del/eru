import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import AnimatedBackground from './AnimatedBackground';
import { useTheme } from '../context/ThemeContext';
import JackieFloat from './JackieFloat';
import CenteredBottomNav from './CenteredBottomNav';
import GlobalSearch from './GlobalSearch';
import BotWidget from './BotWidget';
import { playSound, getSoundPrefs, VIBRATE } from '../lib/soundEngine';



function useFloatingWidgetPrefs() {
  const [prefs, setPrefs] = useState(() => {
    try {
      return {
        jackie: { visible: true, x: 16, y: 100 },
        botMarket: { visible: true, x: 16, y: 156 },
        botChat: { visible: true, x: null, y: null },
        promptLibrary: { visible: true, x: 16, y: 212 },
        conversations: { visible: true, x: 16, y: 268 },
        ...JSON.parse(localStorage.getItem('floating_widget_preferences') || '{}'),
      };
    } catch {
      return {
        jackie: { visible: true, x: 16, y: 100 },
        botMarket: { visible: true, x: 16, y: 156 },
        botChat: { visible: true, x: null, y: null },
        promptLibrary: { visible: true, x: 16, y: 212 },
        conversations: { visible: true, x: 16, y: 268 },
      };
    }
  });

  useEffect(() => {
    localStorage.setItem('floating_widget_preferences', JSON.stringify(prefs));
  }, [prefs]);

  const updateWidget = useCallback((id, next) => {
    setPrefs((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...next },
    }));
  }, []);

  return { prefs, updateWidget };
}

export default function Layout() {
  const themeCtx = useTheme();
  const bg = themeCtx?.bg || 'none';
  const bgOpacity = themeCtx?.bgOpacity ?? 0.4;
  const [searchOpen, setSearchOpen] = useState(false);
  const { prefs, updateWidget } = useFloatingWidgetPrefs();

  // Global sound + haptic handler
  const handleSearchOpen = useCallback(() => setSearchOpen(true), []);

  useEffect(() => {
    const handler = (e) => {
      const el = e.target.closest('button, a, [role="button"], input[type="range"], input[type="checkbox"]');
      if (!el) return;
      const soundPrefs = getSoundPrefs();
      if (!soundPrefs.enabled) return;
      if (el.tagName === 'INPUT') {
        playSound('toggle');
        VIBRATE.toggle?.();
      } else {
        playSound('click');
        VIBRATE.click?.();
      }
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  return (
    <>
      {/* Full-screen background — fixed, covers entire viewport */}
      <div className="fixed inset-0" style={{ zIndex: 0, background: 'hsl(var(--background))' }} />
      <AnimatedBackground type={bg} opacity={bgOpacity} />

      {/* App shell — transparent so background shows through */}
      <div className="max-w-md mx-auto flex flex-col relative z-10 w-full" style={{ minHeight: '100dvh' }}>

        <CenteredBottomNav onSearchOpen={handleSearchOpen} />
        <main className="flex-1">
          <Outlet />
        </main>
        <JackieFloat prefs={prefs} updateWidget={updateWidget} />
        <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
        <BotWidget prefs={prefs} updateWidget={updateWidget} />
      </div>
    </>
  );
}