import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import AnimatedBackground from './AnimatedBackground';
import { useTheme } from '../context/ThemeContext';
import JackieFloat from './JackieFloat';
import CenteredBottomNav from './CenteredBottomNav';
import GlobalSearch from './GlobalSearch';
import BotWidget from './BotWidget';
import { playSound, getSoundPrefs, VIBRATE } from '../lib/soundEngine';



export default function Layout() {
  const themeCtx = useTheme();
  const bg = themeCtx?.bg || 'none';
  const bgOpacity = themeCtx?.bgOpacity ?? 0.4;
  const [searchOpen, setSearchOpen] = useState(false);

  // Global sound + haptic handler
  useEffect(() => {
    const handler = (e) => {
      const el = e.target.closest('button, a, [role="button"], input[type="range"], input[type="checkbox"]');
      if (!el) return;
      const prefs = getSoundPrefs();
      if (!prefs.enabled) return;
      // Classify the interaction
      if (el.tagName === 'INPUT') {
        playSound('toggle'); VIBRATE.toggle?.();
      } else {
        playSound('click'); VIBRATE.click?.();
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
        <div className="sticky top-0 z-30 backdrop-blur-sm bg-background/80 border-b border-border px-4 py-2 text-[11px] text-muted-foreground text-center">
          Telegram-first commercial build • mobile-optimized shell
        </div>
        <CenteredBottomNav onSearchOpen={() => setSearchOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
        <JackieFloat />
        <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
        <BotWidget />
      </div>
    </>
  );
}