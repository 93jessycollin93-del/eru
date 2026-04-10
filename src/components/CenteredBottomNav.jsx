import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { Home, BarChart2, ArrowUpDown, ImageIcon, Wallet } from 'lucide-react';

const PRIMARY_NAV = (t) => [
  { icon: Home, label: t('nav.home'), to: '/' },
  { icon: BarChart2, label: t('nav.markets'), to: '/markets' },
  { icon: ArrowUpDown, label: t('nav.trade'), to: '/trade' },
  { icon: ImageIcon, label: t('nav.nfts'), to: '/nfts' },
  { icon: Wallet, label: t('nav.portfolio'), to: '/portfolio' },
];

export default function CenteredBottomNav() {
  const { pathname } = useLocation();
  const { t } = useLanguage();

  return (
    <nav className="flex items-center gap-1 bg-card/95 backdrop-blur-md border border-border rounded-2xl px-3 py-2 shadow-2xl">
      {PRIMARY_NAV(t).map(({ icon: Icon, label, to }) => {
        const active = pathname === to || (to !== '/' && pathname.startsWith(to));
        return (
          <Link
            key={to}
            to={to}
            title={label}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
              active ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="text-[9px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}