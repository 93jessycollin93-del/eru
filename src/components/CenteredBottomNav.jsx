import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, BarChart2, ArrowUpDown, ImageIcon, Wallet, ShoppingBag, Mail, Lightbulb, Brain, Shield, Award, Send, Bot, FlaskConical, KeyRound, Wand2, Layers, Gem, Sparkles, Sword, Dna, Store, Settings, Cpu, BarChart, GripHorizontal, Pencil, X, Check, ChevronLeft, ChevronRight } from 'lucide-react';

const ALL_PAGES = [
  { id: 'home',       label: 'Home',         icon: Home,          to: '/' },
  { id: 'markets',    label: 'Markets',       icon: BarChart2,     to: '/markets' },
  { id: 'trade',      label: 'Trade',         icon: ArrowUpDown,   to: '/trade' },
  { id: 'nfts',       label: 'NFTs',          icon: ImageIcon,     to: '/nfts' },
  { id: 'portfolio',  label: 'Portfolio',     icon: Wallet,        to: '/portfolio' },
  { id: 'collect',    label: 'Collectables',  icon: ShoppingBag,   to: '/collectables' },
  { id: 'messages',   label: 'Messages',      icon: Mail,          to: '/messages' },
  { id: 'creator',    label: 'Creator Hub',   icon: Lightbulb,     to: '/creator' },
  { id: 'thinkers',   label: 'Thinkers',      icon: Brain,         to: '/thinkers' },
  { id: 'review',     label: 'App Review',    icon: Shield,        to: '/review' },
  { id: 'reputation', label: 'Reputation',    icon: Award,         to: '/reputation' },
  { id: 'tgapps',     label: 'TG Apps',       icon: Send,          to: '/tgapps' },
  { id: 'jackie',     label: 'Jackie AI',     icon: Bot,           to: '/jackie' },
  { id: 'ailab',      label: 'AI Lab',        icon: FlaskConical,  to: '/ailab' },
  { id: 'apikeys',    label: 'API Keys',      icon: KeyRound,      to: '/apikeys' },
  { id: 'builder',    label: 'Builder',       icon: Wand2,         to: '/builder' },
  { id: 'pipeline',   label: 'Pipeline',      icon: Layers,        to: '/pipeline' },
  { id: 'jta',        label: 'Jade Atelier',  icon: Gem,           to: '/jta' },
  { id: 'visual',     label: 'Visual',        icon: Sparkles,      to: '/visual' },
  { id: 'arena',      label: 'Card Arena',    icon: Sword,         to: '/arena' },
  { id: 'creatures',  label: 'Creatures',     icon: Dna,           to: '/creatures' },
  { id: 'storefront', label: 'Storefront',    icon: Store,         to: '/storefront' },
  { id: 'sfanalytics',label: 'SF Analytics',  icon: BarChart,      to: '/storefront-analytics' },
  { id: 'economy',    label: 'Economy',       icon: Award,         to: '/admin/economy' },
  { id: 'workstation',label: 'Workstation',   icon: Cpu,           to: '/workstation' },
  { id: 'settings',   label: 'Settings',      icon: Settings,      to: '/settings' },
];

const DEFAULT_PINNED = ['home', 'markets', 'trade', 'nfts', 'portfolio'];
const STORAGE_KEY = 'floating_nav_pinned';
const POS_KEY = 'floating_nav_pos';

export default function FloatingNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const [pinned, setPinned] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || DEFAULT_PINNED; } catch { return DEFAULT_PINNED; }
  });
  const [editMode, setEditMode] = useState(false);
  const [pos, setPos] = useState(() => {
    try { return JSON.parse(localStorage.getItem(POS_KEY)) || { x: null, y: 12 }; } catch { return { x: null, y: 12 }; }
  });

  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const navRef = useRef(null);
  const didDrag = useRef(false);

  const pinnedPages = ALL_PAGES.filter(p => pinned.includes(p.id));

  const savePinned = (next) => {
    setPinned(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const togglePin = (id) => {
    savePinned(pinned.includes(id) ? pinned.filter(p => p !== id) : [...pinned, id]);
  };

  const onPointerDown = useCallback((e) => {
    if (e.target.closest('a, button')) return;
    dragging.current = true;
    didDrag.current = false;
    const rect = navRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    navRef.current.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    didDrag.current = true;
    const x = e.clientX - dragOffset.current.x;
    const y = e.clientY - dragOffset.current.y;
    const maxX = window.innerWidth - navRef.current.offsetWidth;
    const maxY = window.innerHeight - navRef.current.offsetHeight;
    const newPos = { x: Math.max(0, Math.min(x, maxX)), y: Math.max(0, Math.min(y, maxY)) };
    setPos(newPos);
    localStorage.setItem(POS_KEY, JSON.stringify(newPos));
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const style = pos.x !== null
    ? { position: 'fixed', left: pos.x, top: pos.y, transform: 'none' }
    : { position: 'fixed', top: pos.y, left: '50%', transform: 'translateX(-50%)' };

  return (
    <>
      {/* Floating nav */}
      <div
        ref={navRef}
        style={{ ...style, zIndex: 50, touchAction: 'none', userSelect: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="flex items-center gap-0.5 bg-card/95 backdrop-blur-md border border-border rounded-2xl px-2 py-1.5 shadow-2xl cursor-grab active:cursor-grabbing"
      >
        {/* Drag handle */}
        <div className="flex items-center pr-1 text-muted-foreground/40">
          <GripHorizontal className="w-3.5 h-3.5" />
        </div>

        {pinnedPages.map(({ id, label, icon: Icon, to }) => {
          const active = pathname === to || (to !== '/' && pathname.startsWith(to));
          return (
            <Link
              key={id}
              to={to}
              title={label}
              className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-colors ${
                active ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
              <span className="text-[8px] font-medium leading-none">{label}</span>
            </Link>
          );
        })}

        {/* Edit button */}
        <button
          onClick={() => setEditMode(true)}
          className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl text-muted-foreground hover:text-primary transition-colors"
          title="Customize"
        >
          <Pencil style={{ width: 18, height: 18 }} />
          <span className="text-[8px] font-medium leading-none">Edit</span>
        </button>
      </div>

      {/* Edit modal */}
      {editMode && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setEditMode(false)}>
          <div className="w-full max-w-md bg-card border-t border-border rounded-t-2xl max-h-[75vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <p className="font-semibold text-sm">Customize Nav Bar</p>
              <button onClick={() => setEditMode(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground px-4 py-2 border-b border-border">Tap to add or remove pages from your floating nav.</p>
            <div className="overflow-y-auto flex-1 px-4 py-3">
              <div className="grid grid-cols-4 gap-3">
                {ALL_PAGES.map(({ id, label, icon: Icon, to }) => {
                  const isPinned = pinned.includes(id);
                  return (
                    <button
                      key={id}
                      onClick={() => togglePin(id)}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                        isPinned ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className="relative">
                        <Icon style={{ width: 20, height: 20 }} />
                        {isPinned && (
                          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary rounded-full flex items-center justify-center">
                            <Check className="w-2 h-2 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] font-medium text-center leading-tight">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-border flex-shrink-0">
              <button onClick={() => setEditMode(false)} className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold">
                Done · {pinned.length} pages
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}