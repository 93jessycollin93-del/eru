import { useState, useRef, useCallback, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, BarChart2, ArrowUpDown, ImageIcon, Wallet, ShoppingBag, Mail, Lightbulb, Brain, Shield, Award, Send, Bot, FlaskConical, KeyRound, Wand2, Layers, Gem, Sparkles, Sword, Dna, Store, Settings, Cpu, BarChart, GripHorizontal, Pencil, X, Check, Search, ArrowLeftRight, ArrowUpRightFromSquare, MessageSquare, BookText, Library, Eye, EyeOff, HelpCircle, Factory, Coins, FileSpreadsheet, UserCog } from 'lucide-react';
import NavWalkthrough from './nav/NavWalkthrough';
import { playSound, VIBRATE } from '../lib/soundEngine';

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
  { id: 'botmarket',  label: 'Bot Market',    icon: Cpu,           to: '/bot-marketplace' },
  { id: 'botfarm',    label: 'Bot Farm',      icon: Factory,       to: '/bot-farm' },
  { id: 'apikeys',    label: 'API Keys',      icon: KeyRound,      to: '/apikeys' },
  { id: 'builder',    label: 'ERU',           icon: Wand2,         to: '/builder' },
  { id: 'pipeline',   label: 'Pipeline',      icon: Layers,        to: '/pipeline' },
  { id: 'jta',        label: 'Jade Atelier',  icon: Gem,           to: '/jta' },
  { id: 'visual',     label: 'Visual',        icon: Sparkles,      to: '/visual' },
  { id: 'arena',      label: 'Card Arena',    icon: Sword,         to: '/arena' },
  { id: 'creatures',  label: 'Creatures',     icon: Dna,           to: '/creatures' },
  { id: 'storefront', label: 'Storefront',    icon: Store,         to: '/storefront' },
  { id: 'bazar',      label: 'Bazar Stand',   icon: Coins,         to: '/bazar-stand' },
  { id: 'sfanalytics',label: 'SF Analytics',  icon: BarChart,      to: '/storefront-analytics' },
  { id: 'economy',    label: 'Economy',       icon: Award,         to: '/admin/economy' },
  { id: 'sheets',     label: 'Sheets Sync',   icon: FileSpreadsheet, to: '/sheets-sync' },
  { id: 'profileprefs', label: 'Profile Prefs', icon: UserCog,     to: '/profile-preferences' },
  { id: 'settings',   label: 'Settings',      icon: Settings,      to: '/settings' },
];

const WIDGET_NAV_ITEMS = [
  { id: 'botMarket', label: 'Bot Market', icon: Cpu, to: '/bot-marketplace' },
  { id: 'botChat', label: 'Bot Chat', icon: MessageSquare, widgetId: 'botChat' },
  { id: 'promptLibrary', label: 'Prompt Library', icon: BookText, to: '/jackie?panel=promptLibrary' },
  { id: 'conversations', label: 'Conversations', icon: Library, to: '/jackie?panel=conversations' },
];

const DEFAULT_PINNED = ['home', 'markets', 'trade', 'bazar', 'portfolio'];
const STORAGE_KEY = 'floating_nav_pinned';
const POS_KEY = 'floating_nav_pos';
const ORIENTATION_KEY = 'floating_nav_orientation';
const EXPANDED_KEY = 'floating_nav_expanded';
const ROWS_KEY = 'floating_nav_rows';
const FLOATING_WIDGETS_KEY = 'floating_widget_preferences';
const NAV_WALKTHROUGH_SEEN_KEY = 'nav_walkthrough_seen';
const NAV_LOCKED_TO_TICKER_KEY = 'floating_nav_locked_to_ticker';
const TICKER_BAR_ID = 'app-ticker-bar';
// Offset between BotWidget clicker top and nav top when glued together.
const CLICKER_BLOCK = 56;

const FLOATING_WIDGETS = [
  { id: 'botMarket', label: 'Bot Market', icon: Cpu },
  { id: 'botChat', label: 'Bot Chat', icon: MessageSquare },
  { id: 'promptLibrary', label: 'Prompt Library', icon: BookText },
  { id: 'conversations', label: 'Conversations', icon: Library },
];

export default function FloatingNav({ onSearchOpen, prefs, updateWidget }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const clickerPos = prefs?.botChat;
  const isAttachedToClicker =
    !!clickerPos && clickerPos.x !== null && clickerPos.x !== undefined &&
    clickerPos.y !== null && clickerPos.y !== undefined;

  const [pinned, setPinned] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || DEFAULT_PINNED; } catch { return DEFAULT_PINNED; }
  });
  const [editMode, setEditMode] = useState(false);
  const [orientation, setOrientation] = useState(() => {
    try { return localStorage.getItem(ORIENTATION_KEY) || 'horizontal'; } catch { return 'horizontal'; }
  });
  const [isExpanded, setIsExpanded] = useState(() => {
    try { return JSON.parse(localStorage.getItem(EXPANDED_KEY)) || false; } catch { return false; }
  });
  const [rows, setRows] = useState(() => {
    try { return JSON.parse(localStorage.getItem(ROWS_KEY)) || 1; } catch { return 1; }
  });
  const [pos, setPos] = useState(() => {
    try { return JSON.parse(localStorage.getItem(POS_KEY)) || { x: null, y: 12 }; } catch { return { x: null, y: 12 }; }
  });
  const [floatingWidgets, setFloatingWidgets] = useState(() => {
    try {
      return {
        jackie: { visible: true, x: 16, y: 100 },
        botMarket: { visible: true, x: 16, y: 156 },
        botChat: { visible: true, x: null, y: null },
        promptLibrary: { visible: true, x: 16, y: 212 },
        conversations: { visible: true, x: 16, y: 268 },
        ...JSON.parse(localStorage.getItem(FLOATING_WIDGETS_KEY) || '{}')
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

  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const navRef = useRef(null);
  const didDrag = useRef(false);
  const holdTimer = useRef(null);
  const holdStart = useRef({ x: 0, y: 0, pointerId: null });
  const [isHoldReady, setIsHoldReady] = useState(false);
  const HOLD_MS = 500;
  const [unavailableWidget, setUnavailableWidget] = useState(null);
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(0);
  const [lockedToTicker, setLockedToTicker] = useState(() => {
    try { return JSON.parse(localStorage.getItem(NAV_LOCKED_TO_TICKER_KEY)) || false; } catch { return false; }
  });

  useEffect(() => {
    const handleUnavailable = () => {
      setUnavailableWidget('botChat');
      window.setTimeout(() => setUnavailableWidget(null), 1800);
    };

    window.addEventListener('bot-chat-unavailable', handleUnavailable);
    return () => window.removeEventListener('bot-chat-unavailable', handleUnavailable);
  }, []);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(NAV_WALKTHROUGH_SEEN_KEY);
      if (!seen) {
        setWalkthroughOpen(true);
        localStorage.setItem(NAV_WALKTHROUGH_SEEN_KEY, 'true');
      }
    } catch {}
  }, []);

  const pinnedPages = ALL_PAGES.filter(p => pinned.includes(p.id));
  const attachedWidgets = WIDGET_NAV_ITEMS.filter((item) => floatingWidgets?.[item.id]?.visible);
  const navItems = [...pinnedPages, ...attachedWidgets];

  const savePinned = (next) => {
    setPinned(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const togglePin = (id) => {
    playSound('toggle');
    VIBRATE.toggle();
    savePinned(pinned.includes(id) ? pinned.filter(p => p !== id) : [...pinned, id]);
  };

  const toggleFloatingWidget = (id) => {
    playSound('toggle');
    VIBRATE.toggle();
    const next = {
      ...floatingWidgets,
      [id]: { ...(floatingWidgets[id] || {}), visible: !floatingWidgets?.[id]?.visible }
    };
    setFloatingWidgets(next);
    localStorage.setItem(FLOATING_WIDGETS_KEY, JSON.stringify(next));
  };

  const toggleOrientation = () => {
    const newOrientation = orientation === 'horizontal' ? 'vertical' : 'horizontal';
    setOrientation(newOrientation);
    localStorage.setItem(ORIENTATION_KEY, newOrientation);
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    localStorage.setItem(EXPANDED_KEY, JSON.stringify(!isExpanded));
  };

  const cycleRows = () => {
    const newRows = rows === 1 ? 2 : rows === 2 ? 3 : 1;
    setRows(newRows);
    localStorage.setItem(ROWS_KEY, JSON.stringify(newRows));
  };

  // Distribute pinned pages across rows
  const getPagesByRow = () => {
    const pages = navItems.length;
    const perRow = Math.ceil(pages / rows);
    const rowArray = [];
    for (let i = 0; i < rows; i++) {
      rowArray.push(navItems.slice(i * perRow, (i + 1) * perRow));
    }
    return rowArray;
  };

  const clearHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  const onPointerDown = useCallback((e) => {
    if (lockedToTicker) return;
    // Hold anywhere on the bar (including buttons/links) to start dragging.
    const rect = navRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    holdStart.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    didDrag.current = false;
    clearHold();
    holdTimer.current = setTimeout(() => {
      dragging.current = true;
      setIsHoldReady(true);
      try { navRef.current?.setPointerCapture(holdStart.current.pointerId); } catch {}
      VIBRATE.toggle?.();
      playSound('toggle');
    }, HOLD_MS);
  }, [lockedToTicker, clearHold]);

  const onPointerMove = useCallback((e) => {
    // Cancel hold if the user moves too far before the timer fires (it's a scroll/tap, not a hold).
    if (!dragging.current && holdTimer.current) {
      const dx = e.clientX - holdStart.current.x;
      const dy = e.clientY - holdStart.current.y;
      if (Math.hypot(dx, dy) > 8) clearHold();
      return;
    }
    if (!dragging.current) return;
    if (!didDrag.current) {
      playSound('whoosh');
      VIBRATE.click();
    }
    didDrag.current = true;
    // Nav is sticky below the ticker — Y is pinned. Only X is user-adjustable.
    const x = e.clientX - dragOffset.current.x;
    const maxX = window.innerWidth - navRef.current.offsetWidth;
    const newPos = { x: Math.max(0, Math.min(x, maxX)), y: 0 };
    setPos(newPos);
    localStorage.setItem(POS_KEY, JSON.stringify(newPos));
  }, [clearHold]);

  const onPointerUp = useCallback(() => {
    clearHold();
    dragging.current = false;
    setIsHoldReady(false);
  }, [clearHold]);

  // If a drag happened, swallow the click so the link/button underneath doesn't fire.
  const onClickCapture = useCallback((e) => {
    if (didDrag.current) {
      e.preventDefault();
      e.stopPropagation();
      didDrag.current = false;
    }
  }, []);

  useEffect(() => {
    if (!lockedToTicker) return;

    let frameId;

    const syncToTicker = () => {
      const ticker = document.getElementById(TICKER_BAR_ID);
      if (!ticker) {
        frameId = window.requestAnimationFrame(syncToTicker);
        return;
      }

      const rect = ticker.getBoundingClientRect();
      const nextY = Math.max(8, rect.bottom + 8);
      setPos((prev) => (prev?.x === null && prev?.y === nextY ? prev : { x: null, y: nextY }));
      frameId = window.requestAnimationFrame(syncToTicker);
    };

    syncToTicker();
    window.addEventListener('resize', syncToTicker);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', syncToTicker);
    };
  }, [lockedToTicker]);

  const toggleTickerLock = () => {
    const next = !lockedToTicker;
    setLockedToTicker(next);
    localStorage.setItem(NAV_LOCKED_TO_TICKER_KEY, JSON.stringify(next));
    if (!next) {
      setPos((prev) => ({ ...prev, y: prev?.y ?? 12 }));
    }
  };

  // Nav is always sticky below the TickerBar (which is mounted globally in
  // Layout). Sticky is how the ticker already follows the user — using the
  // same mechanism here means the nav follows scroll on every page too.
  // The outer wrapper handles sticky + horizontal drag via marginLeft;
  // the inner nav keeps its own styling untouched.
  const TICKER_OFFSET = 44;
  const outerStyle = {
    position: 'sticky',
    top: TICKER_OFFSET,
    zIndex: 49,
    width: '100%',
    pointerEvents: 'none',
  };
  const innerStyle = {
    marginLeft: pos.x !== null ? pos.x : 'auto',
    marginRight: pos.x !== null ? 0 : 'auto',
    width: 'fit-content',
    pointerEvents: 'auto',
    touchAction: 'none',
    userSelect: 'none',
  };

  return (
    <>
      {/* Sticky outer wrapper: follows the user below the ticker on every
          page. Inner nav keeps its existing styling + drag handlers. */}
      <div style={outerStyle}>
      <div
        ref={navRef}
        style={innerStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
        title={lockedToTicker ? '' : 'Press and hold to move'}
        className={`bg-card/95 text-foreground backdrop-blur-md border border-border rounded-2xl px-2 py-1.5 shadow-2xl transition-shadow ${lockedToTicker ? 'cursor-default' : isHoldReady ? 'cursor-grabbing ring-2 ring-primary/60 shadow-primary/20' : 'cursor-pointer'} ${orientation === 'horizontal' ? 'flex items-center gap-0.5' : 'flex flex-col gap-0.5'}`}
      >
        {/* Drag handle + orientation toggle + rows toggle + edit */}
        <div className={`flex gap-1 ${orientation === 'vertical' ? 'flex-col pb-1' : 'flex-row items-center pr-1'} text-muted-foreground/40`}>
          <GripHorizontal className={`w-3.5 h-3.5 ${lockedToTicker ? 'opacity-40' : ''}`} />
          <button
            onClick={() => {
              playSound('toggle');
              VIBRATE.toggle();
              toggleOrientation();
            }}
            className="transition-colors hover:text-primary"
            title={orientation === 'horizontal' ? 'Switch to Vertical' : 'Switch to Horizontal'}
          >
            {orientation === 'horizontal' ? (
              <ArrowUpRightFromSquare className="w-3.5 h-3.5" />
            ) : (
              <ArrowLeftRight className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={() => {
              playSound('toggle');
              VIBRATE.toggle();
              cycleRows();
            }}
            className="transition-colors hover:text-primary text-[10px] font-bold w-3.5 h-3.5 flex items-center justify-center"
            title={`${rows} row${rows > 1 ? 's' : ''} (click to cycle)`}
          >
            {rows}
          </button>
          <button
            onClick={() => {
              playSound('toggle');
              VIBRATE.toggle();
              toggleTickerLock();
            }}
            className={`transition-colors hover:text-primary ${lockedToTicker ? 'text-primary' : ''}`}
            title={lockedToTicker ? 'Unlock from Ticker' : 'Lock to Ticker'}
          >
            <ArrowUpRightFromSquare className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              playSound('click');
              VIBRATE.click();
              setEditMode(true);
            }}
            className="transition-colors hover:text-primary"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>

        {orientation === 'horizontal' ? (
          // Horizontal with rows
          <div className="flex flex-col gap-0.5">
            {getPagesByRow().map((pageRow, rowIdx) => (
              <div key={rowIdx} className="flex gap-0.5">
                {pageRow.map(({ id, label, icon: Icon, to, widgetId }) => {
                  const active = to ? (to.startsWith('/jackie?panel=') ? pathname === '/jackie' : pathname === to || (to !== '/' && pathname.startsWith(to))) : false;
                  const isJackiePanelLink = to?.startsWith('/jackie?panel=');
                  const handleWidgetClick = () => {
                    if (!widgetId) return;
                    playSound('click');
                    VIBRATE.click();
                    if (widgetId === 'botChat') {
                      window.dispatchEvent(new CustomEvent('open-bot-chat'));
                    } else {
                      window.dispatchEvent(new CustomEvent('toggle-widget-visibility', { detail: { widgetId } }));
                    }
                  };
                  const handlePanelNavigation = () => {
                    if (!isJackiePanelLink) return;
                    playSound('click');
                    VIBRATE.click();
                    navigate(to);
                  };

                  if (to) {
                    if (isJackiePanelLink) {
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={handlePanelNavigation}
                          title={label}
                          className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-colors ${
                            active ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                          <span className="text-[8px] font-medium leading-none">{label}</span>
                        </button>
                      );
                    }

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
                  }

                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={handleWidgetClick}
                      title={label}
                      className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-colors ${unavailableWidget === id ? 'text-destructive bg-destructive/10' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                      <span className="text-[8px] font-medium leading-none">{label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          // Vertical (unchanged)
          navItems.map(({ id, label, icon: Icon, to, widgetId }) => {
            const active = to ? (to.startsWith('/jackie?panel=') ? pathname === '/jackie' : pathname === to || (to !== '/' && pathname.startsWith(to))) : false;
            const isJackiePanelLink = to?.startsWith('/jackie?panel=');
            const handleWidgetClick = () => {
              if (!widgetId) return;
              playSound('click');
              VIBRATE.click();
              if (widgetId === 'botChat') {
                window.dispatchEvent(new CustomEvent('open-bot-chat'));
              } else {
                window.dispatchEvent(new CustomEvent('toggle-widget-visibility', { detail: { widgetId } }));
              }
            };
            const handlePanelNavigation = () => {
              if (!isJackiePanelLink) return;
              playSound('click');
              VIBRATE.click();
              navigate(to);
            };

            if (to) {
              if (isJackiePanelLink) {
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={handlePanelNavigation}
                    title={label}
                    className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-colors ${
                      active ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                    <span className="text-[8px] font-medium leading-none">{label}</span>
                  </button>
                );
              }

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
            }

            return (
              <button
                key={id}
                type="button"
                onClick={handleWidgetClick}
                title={label}
                className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-colors ${unavailableWidget === id ? 'text-destructive bg-destructive/10' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                <span className="text-[8px] font-medium leading-none">{label}</span>
              </button>
            );
          })
        )}

        {/* Search button */}
        <button
          onClick={() => {
            playSound('click');
            VIBRATE.click();
            const result = onSearchOpen?.();
            if (result && typeof result.catch === 'function') {
              result.catch(() => {});
            }
          }}
          className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl text-muted-foreground hover:text-primary transition-colors"
          title="Search"
        >
          <Search style={{ width: 18, height: 18 }} />
          <span className="text-[8px] font-medium leading-none">Search</span>
        </button>
      </div>
      </div>

      <NavWalkthrough
        open={walkthroughOpen}
        step={walkthroughStep}
        setStep={setWalkthroughStep}
        onClose={() => {
          playSound('click');
          VIBRATE.click();
          setWalkthroughOpen(false);
          setWalkthroughStep(0);
        }}
      />

      {/* Edit modal */}
      {editMode && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setEditMode(false)}>
          <div className="w-full max-w-md md:max-w-2xl bg-card text-foreground border-t border-border rounded-t-2xl max-h-[75dvh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <p className="font-semibold text-sm">Customize Nav Bar</p>
              <button onClick={() => {
                playSound('click');
                VIBRATE.click();
                setEditMode(false);
              }} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground px-4 py-2 border-b border-border">Tap to add or remove pages and floating widgets.</p>
            <div className="overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch] flex-1 min-h-0 px-4 py-3 space-y-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Pages</p>
                <div className="grid grid-cols-4 gap-3">
                  {ALL_PAGES.map(({ id, label, icon: Icon }) => {
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
              <div>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Floating Widgets</p>
                  <button
                    onClick={() => {
                      playSound('click');
                      VIBRATE.click();
                      setWalkthroughStep(0);
                      setWalkthroughOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    <HelpCircle className="w-3 h-3" /> Guide
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {FLOATING_WIDGETS.map(({ id, label, icon: Icon }) => {
                    const isVisible = floatingWidgets?.[id]?.visible;
                    return (
                      <button
                        key={id}
                        onClick={() => toggleFloatingWidget(id)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                          isVisible ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <div className="relative">
                          <Icon style={{ width: 20, height: 20 }} />
                          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center bg-background border border-border">
                            {isVisible ? <Eye className="w-2 h-2 text-primary" /> : <EyeOff className="w-2 h-2 text-muted-foreground" />}
                          </div>
                        </div>
                        <span className="text-[9px] font-medium text-center leading-tight">{label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">These items attach directly to the nav bar when enabled here. Jackie stays as its own separate round widget.</p>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-border flex-shrink-0 space-y-2">
              <div className="flex gap-2">
                <button onClick={() => {
                  playSound('click');
                  VIBRATE.click();
                  setEditMode(false);
                }} className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold">
                  Done
                </button>
                <div className="flex gap-1 bg-secondary rounded-xl p-1">
                  {[1, 2, 3].map(r => (
                    <button
                      key={r}
                      onClick={() => {
                          playSound('toggle');
                          VIBRATE.toggle();
                          setRows(r);
                          localStorage.setItem(ROWS_KEY, JSON.stringify(r));
                        }}
                      className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                        rows === r ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">Pages: {pinned.length} · Widgets: {FLOATING_WIDGETS.filter(({ id }) => floatingWidgets?.[id]?.visible).length}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}