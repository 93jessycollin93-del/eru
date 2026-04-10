import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { Home, BarChart2, ArrowUpDown, ImageIcon, Wallet, Settings, ShoppingBag, Mail, Lightbulb, Brain, Shield, Cpu, Award, Send, Bot, FlaskConical, KeyRound, Wand2, Layers, Gem, Sparkles, Sword, Dna, Store } from 'lucide-react';

const getNav = (t) => [
  { icon: Home, label: t('nav.home'), to: '/' },
  { icon: BarChart2, label: t('nav.markets'), to: '/markets' },
  { icon: ArrowUpDown, label: t('nav.trade'), to: '/trade' },
  { icon: ImageIcon, label: t('nav.nfts'), to: '/nfts' },
  { icon: Wallet, label: t('nav.portfolio'), to: '/portfolio' },
  { icon: ShoppingBag, label: t('nav.shop'), to: '/collectables' },
  { icon: Mail, label: t('nav.inbox'), to: '/messages' },
  { icon: Lightbulb, label: t('nav.creator'), to: '/creator' },
  { icon: Brain, label: t('nav.thinkers'), to: '/thinkers' },
  { icon: Shield, label: t('nav.review'), to: '/review' },
  { icon: Award, label: t('nav.rank'), to: '/reputation' },
  { icon: Send, label: t('nav.tgapps'), to: '/tgapps' },
  { icon: Bot, label: t('nav.jackie'), to: '/jackie' },
  { icon: FlaskConical, label: t('nav.ailab'), to: '/ailab' },
  { icon: KeyRound, label: t('nav.apikeys'), to: '/apikeys' },
  { icon: Wand2, label: t('nav.builder'), to: '/builder' },
  { icon: Layers, label: t('nav.pipeline'), to: '/pipeline' },
  { icon: Gem, label: t('nav.jta'), to: '/jta' },
  { icon: Sword, label: t('nav.arena'), to: '/arena' },
  { icon: Dna, label: t('nav.lab'), to: '/creatures' },
  { icon: Store, label: t('nav.hub'), to: '/storefront' },
  { icon: Sparkles, label: t('nav.visual'), to: '/visual' },
  { icon: Cpu, label: t('nav.station'), to: '/workstation' },
  { icon: Settings, label: t('nav.settings'), to: '/settings' },
];

export default function CenteredBottomNav() {
  const { pathname } = useLocation();
  const { t } = useLanguage();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border z-40 overflow-x-auto" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-md mx-auto flex justify-around px-1">
        {getNav(t).map(({ icon: Icon, label, to }) => {
          const active = pathname === to || (to !== '/' && pathname.startsWith(to));
          return (
            <Link key={to} to={to} className={`flex flex-col items-center py-1.5 px-1 min-w-0 flex-1 transition-colors ${active ? 'text-primary' : 'text-muted-foreground'}`} title={label}>
              <Icon className="w-5 h-5 flex-shrink-0"/>
              <span className="text-[9px] mt-0.5 truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}