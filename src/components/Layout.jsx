import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import AnimatedBackground from './AnimatedBackground';
import PageThemeLayer from '@/components/theme/PageThemeLayer';
import { useTheme } from '../context/ThemeContext';
import JackieFloat from './JackieFloat';
import CenteredBottomNav from './CenteredBottomNav';
import GlobalSearch from './GlobalSearch';
import BotWidget from './BotWidget';
import FloatingQuickActions from './FloatingQuickActions';
import ScreenVisualizer from './dashboard/ScreenVisualizer';
import BazarStandDock from './bazar/BazarStandDock';
import { playSound, getSoundPrefs, VIBRATE } from '../lib/soundEngine';

const NEUTRON_STAR_BG = 'neutron_star';



function useFloatingWidgetPrefs() {
  const [prefs, setPrefs] = useState(() => {
    try {
      return {
        jackie: { visible: true, x: 16, y: 100 },
        botMarket: { visible: true, x: 16, y: 156 },
        botChat: { visible: true, x: null, y: null },
        miniBrowser: { visible: false, x: null, y: null, floating: true },
        promptLibrary: { visible: true, x: 16, y: 212 },
        conversations: { visible: true, x: 16, y: 268 },
        ...JSON.parse(localStorage.getItem('floating_widget_preferences') || '{}'),
      };
    } catch {
      return {
        jackie: { visible: true, x: 16, y: 100 },
        botMarket: { visible: true, x: 16, y: 156 },
        botChat: { visible: true, x: null, y: null },
        miniBrowser: { visible: false, x: null, y: null, floating: true },
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
  const globalThemeStyles = themeCtx?.globalThemeStyles || {};
  const [searchOpen, setSearchOpen] = useState(false);
  const { prefs, updateWidget } = useFloatingWidgetPrefs();

  const handleSearchOpen = useCallback(() => setSearchOpen(true), []);

  // Global sound + haptic handler

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
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 0,
          background: 'radial-gradient(circle at 50% 26%, rgba(95,135,255,0.12) 0%, rgba(20,28,58,0.08) 24%, rgba(7,10,22,0.94) 66%, rgba(2,4,10,1) 100%)',
          ...globalThemeStyles,
        }}
      />
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.015) 0%, rgba(60,96,210,0.03) 18%, rgba(7,10,22,0.07) 44%, rgba(3,4,10,0.16) 100%)' }} />
      <AnimatedBackground type={NEUTRON_STAR_BG} opacity={0.78} />
      {bg !== 'none' && bg !== NEUTRON_STAR_BG ? <AnimatedBackground type={bg} opacity={Math.min(bgOpacity, 0.35)} /> : null}

      {/* App shell — transparent so background shows through */}
      <div className="w-full max-w-screen-xl mx-auto flex flex-col relative z-10" style={{ minHeight: '100dvh' }}>

        <CenteredBottomNav onSearchOpen={handleSearchOpen} prefs={prefs} updateWidget={updateWidget} />
        <main className="flex-1 min-w-0">
          <PageThemeLayer>
            <Outlet />
          </PageThemeLayer>
        </main>
        <JackieFloat prefs={prefs} updateWidget={updateWidget} />
        <BazarStandDock />
        <FloatingQuickActions />
        <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
        <BotWidget prefs={prefs} updateWidget={updateWidget} />
        <ScreenVisualizer prefs={prefs} updateWidget={updateWidget} />
      </div>
    </>
  );
}