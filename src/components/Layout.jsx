import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, BarChart2, ArrowUpDown, ImageIcon, Wallet, Settings, ShoppingBag, Mail, Sparkles, Brain, ShoppingCart, Shield } from 'lucide-react';

const NAV = [
  { icon: Home, label: 'Home', to: '/' },
  { icon: BarChart2, label: 'Markets', to: '/markets' },
  { icon: ArrowUpDown, label: 'Trade', to: '/trade' },
  { icon: ShoppingCart, label: 'Market', to: '/marketplace' },
  { icon: Brain, label: 'Thinkers', to: '/thinkers' },
  { icon: Sparkles, label: 'Studio', to: '/studio' },
  { icon: Shield, label: 'Review', to: '/review' },
  { icon: Mail, label: 'Inbox', to: '/messages' },
  { icon: Settings, label: 'Settings', to: '/settings' },
];

export default function Layout() {
  const { pathname } = useLocation();
  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col relative">
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border z-40">
        <div className="max-w-md mx-auto flex justify-around">
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