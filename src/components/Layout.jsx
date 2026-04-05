import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, BarChart2, ArrowUpDown, ImageIcon, Wallet, Settings, ShoppingBag, Mail, Lightbulb, Brain, Shield, Cpu } from 'lucide-react';
import AnimatedBackground from './AnimatedBackground';
import { useTheme } from '../context/ThemeContext';

const NAV = [
  { icon: Home, label: 'Home', to: '/' },
  { icon: BarChart2, label: 'Markets', to: '/markets' },
  { icon: ArrowUpDown, label: 'Trade', to: '/trade' },
  { icon: ImageIcon, label: 'NFTs', to: '/nfts' },
  { icon: Wallet, label: 'Portfolio', to: '/portfolio' },
  { icon: ShoppingBag, label: 'Shop', to: '/collectables' },
  { icon: Mail, label: 'Inbox', to: '/messages' },
  { icon: Lightbulb, label: 'Creator', to: '/creator' },
  { icon: Brain, label: 'Thinkers', to: '/thinkers' },
  { icon: Shield, label: 'Review', to: '/review' },
  { icon: Cpu, label: 'Station', to: '/workstation' },
  { icon: Settings, label: 'Settings', to: '/settings' },
];

export default function Layout() {
  const { pathname } = useLocation();
  const themeCtx = useTheme();
  const bg = themeCtx?.bg || 'none';
  const bgOpacity = themeCtx?.bgOpacity || 0.4;
  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col relative">
      <AnimatedBackground type={bg} opacity={bgOpacity} />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border z-40 overflow-x-auto">
        <div className="max-w-md mx-auto flex min-w-max px-1">
          {NAV.map(({ icon: Icon, label, to }) => {
            const active = pathname === to || (to !== '/' && pathname.startsWith(to));
            return (
              <Link key={to} to={to} className={`flex flex-col items-center py-2 px-1 min-w-0 flex-1 transition-colors ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                <Icon className="w-5 h-5 flex-shrink-0"/>
                <span className="text-[9px] mt-0.5 truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}