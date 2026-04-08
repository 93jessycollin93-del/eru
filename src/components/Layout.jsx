import { Outlet } from 'react-router-dom';
import AnimatedBackground from './AnimatedBackground';
import { useTheme } from '../context/ThemeContext';
import JackieFloat from './JackieFloat';
import CenteredBottomNav from './CenteredBottomNav';



export default function Layout() {
  const themeCtx = useTheme();
  const bg = themeCtx?.bg || 'none';
  const bgOpacity = themeCtx?.bgOpacity || 0.4;
  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col relative">
      <AnimatedBackground type={bg} opacity={bgOpacity} />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <JackieFloat />
      <CenteredBottomNav />
    </div>
  );
}