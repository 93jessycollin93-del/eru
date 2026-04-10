import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AnimatedBackground from './AnimatedBackground';
import { useTheme } from '../context/ThemeContext';
import JackieFloat from './JackieFloat';
import CenteredBottomNav from './CenteredBottomNav';
import GlobalSearch from './GlobalSearch';
import BotWidget from './BotWidget';



export default function Layout() {
  const themeCtx = useTheme();
  const bg = themeCtx?.bg || 'none';
  const bgOpacity = themeCtx?.bgOpacity ?? 0.4;
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      {/* Full-screen background — rendered first, behind everything */}
      <AnimatedBackground type={bg} opacity={bgOpacity} />

      {/* App shell — transparent so background shows through */}
      <div className="max-w-md mx-auto flex flex-col relative z-10" style={{ minHeight: '100dvh' }}>
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