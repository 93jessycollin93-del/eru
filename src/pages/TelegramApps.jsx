import { useState } from 'react';
import { Search, Plus, X, GripVertical, Star, ExternalLink, ChevronRight, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import TelegramSettings from '../components/TelegramSettings';
import TelegramBotDashboard from '../components/telegram/TelegramBotDashboard';
import SecurityAnalysis from '../components/SecurityAnalysis';

const ALL_APPS = [
  { id: 'hamster-kombat', name: 'Hamster Kombat', icon: '🐹', category: 'Games', stars: 4.8, users: '5.4M', desc: 'Tap-to-earn idle game inside Telegram', color: '#ff9800', pinned: true },
  { id: 'notcoin', name: 'Notcoin', icon: '🪙', category: 'Games', stars: 4.7, users: '3.2M', desc: 'Viral tap game with token rewards', color: '#ffeb3b', pinned: true },
  { id: 'catizen', name: 'Catizen', icon: '🐱', category: 'Games', stars: 4.8, users: '2.8M', desc: 'Cat-merging economy sim with daily missions', color: '#ff6b81', pinned: false },
  { id: 'yescoin', name: 'Yescoin', icon: '🫰', category: 'Games', stars: 4.6, users: '2.4M', desc: 'Swipe-to-earn arcade gameplay loop', color: '#fbc02d', pinned: false },
  { id: 'pixelverse', name: 'PixelTap', icon: '🤖', category: 'Games', stars: 4.5, users: '1.9M', desc: 'Fast tap battler with PvP energy', color: '#7c4dff', pinned: false },
  { id: 'memefi', name: 'MemeFi', icon: '🗡️', category: 'Games', stars: 4.6, users: '1.6M', desc: 'Boss-fight clicker with guild energy', color: '#ab47bc', pinned: false },
  { id: 'tomarket', name: 'Tomarket', icon: '🍅', category: 'Games', stars: 4.5, users: '1.5M', desc: 'Reward game hub with missions and drops', color: '#ef5350', pinned: false },
  { id: 'blum', name: 'Blum', icon: '🌸', category: 'Games', stars: 4.7, users: '2.1M', desc: 'Trading-style mini missions and farming', color: '#00c853', pinned: false },
  { id: 'major', name: 'Major', icon: '🎖️', category: 'Games', stars: 4.4, users: '980K', desc: 'XP ladder and daily quests for Telegram users', color: '#42a5f5', pinned: false },
  { id: 'pocketfi', name: 'PocketFi', icon: '💼', category: 'Games', stars: 4.3, users: '760K', desc: 'Wallet-based rewards and light gameplay', color: '#26c6da', pinned: false },
  { id: 'farm-frens', name: 'Farm Frens', icon: '🚜', category: 'Games', stars: 4.4, users: '640K', desc: 'Casual farming loop built for short sessions', color: '#66bb6a', pinned: false },
  { id: 'boinkers', name: 'Boinkers', icon: '🐷', category: 'Games', stars: 4.2, users: '520K', desc: 'Chaotic clicker humor game with upgrades', color: '#ec407a', pinned: false },
  { id: 'banana', name: 'Banana', icon: '🍌', category: 'Games', stars: 4.1, users: '410K', desc: 'Simple collection game with daily rewards', color: '#fdd835', pinned: false },
  { id: 'iceberg', name: 'Iceberg', icon: '🧊', category: 'Games', stars: 4.0, users: '390K', desc: 'Puzzle-style progression with streak bonuses', color: '#29b6f6', pinned: false },
  { id: 'rocket-run', name: 'Rocket Run', icon: '🚀', category: 'Arcade', stars: 4.4, users: '340K', desc: 'One-thumb endless runner for Telegram', color: '#5c6bc0', pinned: false },
  { id: 'neon-drift', name: 'Neon Drift', icon: '🛸', category: 'Arcade', stars: 4.3, users: '280K', desc: 'Arcade dodging and score chasing', color: '#26a69a', pinned: false },
  { id: 'chess-club', name: 'Chess Club', icon: '♟️', category: 'Strategy', stars: 4.7, users: '860K', desc: 'Play quick chess matches in Telegram', color: '#8d6e63', pinned: false },
  { id: 'battle-cards', name: 'Battle Cards', icon: '🃏', category: 'Strategy', stars: 4.4, users: '470K', desc: 'Deck battles and ranked mini duels', color: '#3949ab', pinned: false },
  { id: 'word-blast', name: 'Word Blast', icon: '🔤', category: 'Puzzle', stars: 4.5, users: '610K', desc: 'Daily word puzzles and challenge ladders', color: '#8e24aa', pinned: false },
  { id: 'sudoku-bot', name: 'Sudoku Bot', icon: '🔢', category: 'Puzzle', stars: 4.3, users: '430K', desc: 'Telegram-first sudoku challenge board', color: '#546e7a', pinned: false },
  { id: 'merge-monsters', name: 'Merge Monsters', icon: '👾', category: 'Casual', stars: 4.2, users: '300K', desc: 'Merge, evolve, and collect playful creatures', color: '#7e57c2', pinned: false },
  { id: 'tiny-tycoon', name: 'Tiny Tycoon', icon: '🏙️', category: 'Simulation', stars: 4.3, users: '250K', desc: 'Idle city builder for quick Telegram check-ins', color: '#26a69a', pinned: false },
  { id: 'pool-duel', name: 'Pool Duel', icon: '🎱', category: 'Sports', stars: 4.2, users: '220K', desc: 'Fast 1v1 table play in mini sessions', color: '#2e7d32', pinned: false },
  { id: 'penalty-hero', name: 'Penalty Hero', icon: '⚽', category: 'Sports', stars: 4.1, users: '210K', desc: 'Quick football penalty rounds and tournaments', color: '#43a047', pinned: false },
  { id: 'quiz-arena', name: 'Quiz Arena', icon: '❓', category: 'Trivia', stars: 4.4, users: '355K', desc: 'Head-to-head trivia with daily leaderboards', color: '#fb8c00', pinned: false },
  { id: 'geo-dash', name: 'Geo Dash', icon: '🗺️', category: 'Trivia', stars: 4.0, users: '180K', desc: 'Guess places and cities from visual clues', color: '#00897b', pinned: false },
  { id: 'music-guess', name: 'Music Guess', icon: '🎵', category: 'Trivia', stars: 4.1, users: '190K', desc: 'Short music clips and social score battles', color: '#d81b60', pinned: false },
  { id: 'stack-tower', name: 'Stack Tower', icon: '🏗️', category: 'Arcade', stars: 4.0, users: '160K', desc: 'Precision stacking challenge for short play', color: '#6d4c41', pinned: false },
  { id: 'color-rush', name: 'Color Rush', icon: '🌈', category: 'Casual', stars: 4.1, users: '170K', desc: 'Reaction-based color taps and streaks', color: '#ff7043', pinned: false },
  { id: '2048-clash', name: '2048 Clash', icon: '🔲', category: 'Puzzle', stars: 4.2, users: '205K', desc: 'Classic merge puzzle with versus rounds', color: '#ffa726', pinned: false },
  { id: 'space-miner', name: 'Space Miner', icon: '⛏️', category: 'Simulation', stars: 4.0, users: '145K', desc: 'Idle resource collection and ship upgrades', color: '#90caf9', pinned: false },
  { id: 'lucky-spin', name: 'Lucky Spin', icon: '🎡', category: 'Casual', stars: 4.0, users: '230K', desc: 'Spin, collect, and complete event boards', color: '#ffca28', pinned: false },
  { id: 'wallet', name: 'TON Wallet', icon: '💎', category: 'Finance', stars: 4.9, users: '2.1M', desc: 'Send & receive TON instantly', color: '#0088cc', pinned: true },
  { id: 'nft', name: 'NFT Marketplace', icon: '🖼️', category: 'Trading', stars: 4.7, users: '890K', desc: 'Buy, sell & discover NFTs', color: '#7c4dff', pinned: true },
  { id: 'dedust', name: 'DeDust Swap', icon: '🔄', category: 'Finance', stars: 4.6, users: '430K', desc: 'Decentralized token swaps', color: '#00e676', pinned: false },
  { id: 'staking', name: 'TON Staking', icon: '📈', category: 'Finance', stars: 4.5, users: '310K', desc: 'Stake TON & earn passive income', color: '#2196f3', pinned: false },
  { id: 'fragment', name: 'Fragment', icon: '🔤', category: 'Social', stars: 4.4, users: '720K', desc: 'Buy & sell Telegram usernames', color: '#e91e63', pinned: false },
  { id: 'news', name: 'CryptoPulse', icon: '📰', category: 'News', stars: 4.3, users: '180K', desc: 'Live crypto news & alerts', color: '#ff5252', pinned: false },
  { id: 'botfather-pro', name: 'BotFather Pro', icon: '🤖', category: 'Tools', stars: 4.6, users: '950K', desc: 'Build & manage Telegram bots', color: '#607d8b', pinned: false },
  { id: 'bridge', name: 'TON Bridge', icon: '🌉', category: 'Finance', stars: 4.4, users: '260K', desc: 'Cross-chain asset transfers', color: '#00bcd4', pinned: false },
  { id: 'vote', name: 'CoinVote', icon: '🗳️', category: 'Tools', stars: 4.2, users: '95K', desc: 'Community polls & governance', color: '#9c27b0', pinned: false },
  { id: 'getgems', name: 'Getgems', icon: '🎨', category: 'Trading', stars: 4.8, users: '1.1M', desc: 'Premium NFT gallery & trading', color: '#ff7043', pinned: false },
];

const CATEGORIES = ['All', 'Games', 'Arcade', 'Puzzle', 'Strategy', 'Casual', 'Simulation', 'Sports', 'Trivia', 'Finance', 'Trading', 'Social', 'News', 'Tools'];

export default function TelegramApps() {
  const [tab, setTab] = useState('integration');
  const [apps, setApps] = useState(ALL_APPS);
  const [openApp, setOpenApp] = useState(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const pinned = apps.filter(a => a.pinned);
  const unpinned = apps.filter(a => !a.pinned);

  const togglePin = (id) => {
    setApps(apps.map(a => a.id === id ? { ...a, pinned: !a.pinned } : a));
  };

  const onDragStart = (id) => setDragId(id);
  const onDragOver = (e, id) => { e.preventDefault(); setDragOverId(id); };
  const onDrop = (targetId) => {
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    setApps(prev => {
      const arr = [...prev];
      const fromIdx = arr.findIndex(a => a.id === dragId);
      const toIdx = arr.findIndex(a => a.id === targetId);
      const [item] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, item);
      return arr;
    });
    setDragId(null); setDragOverId(null);
  };

  const filtered = apps.filter(a => {
    const matchCat = category === 'All' || a.category === category;
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) || a.desc.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  if (openApp) return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <button onClick={() => setOpenApp(null)} className="text-muted-foreground text-sm">← Back</button>
        <p className="font-semibold flex-1">{openApp.icon} {openApp.name}</p>
      </div>
      <div className="px-4 py-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
            style={{ background: `${openApp.color}20`, border: `1px solid ${openApp.color}40` }}>
            {openApp.icon}
          </div>
          <div>
            <p className="font-bold text-base">{openApp.name}</p>
            <p className="text-xs text-muted-foreground">{openApp.category}</p>
            <div className="flex items-center gap-1 mt-1">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <span className="text-xs font-medium">{openApp.stars}</span>
              <span className="text-xs text-muted-foreground">· {openApp.users} users</span>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{openApp.desc}. Built for quick Telegram sessions, mobile-friendly launch flows, and mini app style interaction.</p>

        <div className="flex gap-3">
          <button className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2">
            <ExternalLink className="w-4 h-4" /> Open App
          </button>
          <button onClick={() => { togglePin(openApp.id); setOpenApp(prev => ({ ...prev, pinned: !prev.pinned })); }}
            className={`px-4 py-3 rounded-xl text-sm font-medium border transition-colors ${openApp.pinned ? 'bg-primary/10 text-primary border-primary/30' : 'bg-secondary border-border text-muted-foreground'}`}>
            {openApp.pinned ? '📌 Pinned' : '📌 Pin'}
          </button>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</p>
          {[['Category', openApp.category], ['Rating', `${openApp.stars} / 5`], ['Active Users', openApp.users], ['Platform', 'Telegram Mini App']].map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-medium">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span className="text-xl">✈️</span> Telegram Hub
        </h2>
        <p className="text-xs text-muted-foreground">Integration, Telegram game apps, and a large mini-game catalog for mobile-first discovery</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto">
        {[{ id: 'integration', label: 'Integration' }, { id: 'bots', label: 'AI Bots' }, { id: 'home', label: 'My Apps' }, { id: 'store', label: 'Discover' }, { id: 'arrange', label: 'Arrange' }, { id: 'security', label: '🛡️ Security' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-shrink-0 flex-1 py-2.5 text-xs font-medium whitespace-nowrap transition-colors px-2 ${tab === t.id ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* INTEGRATION TAB */}
      {tab === 'integration' && (
        <div className="px-4 py-4 space-y-4">
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <p className="text-sm font-semibold mb-1">Commercial deployment readiness</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Telegram-first mobile web app layout enabled</li>
              <li>• In-app notification center ready for tasks and projects</li>
              <li>• Email alerts supported for task and project events</li>
              <li>• Suitable baseline for iOS, Android, and Telegram environments</li>
            </ul>
          </div>
          <TelegramSettings />
        </div>
      )}

      {/* AI BOTS */}
      {tab === 'bots' && (
        <div className="px-4 py-4 space-y-4">
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold mb-1">Centralized AI Bot Management</p>
              <p className="text-xs text-muted-foreground">Create, configure, monitor, and compare multiple Telegram bots with interactive charts and one unified control center.</p>
            </div>
            <Link to="/telegram-bots" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium">
              Open full management page
            </Link>
          </div>
          <TelegramBotDashboard />
        </div>
      )}

      {/* MY APPS */}
      {tab === 'home' && (
        <div className="px-4 py-4 space-y-5">
          {pinned.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">Pinned Apps</p>
              <div className="grid grid-cols-3 gap-3">
                {pinned.map(app => (
                  <button key={app.id} onClick={() => setOpenApp(app)}
                    className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                      style={{ background: `${app.color}18`, border: `1px solid ${app.color}30` }}>
                      {app.icon}
                    </div>
                    <p className="text-[11px] font-medium text-center leading-tight line-clamp-2">{app.name}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Recent</p>
            <div className="space-y-2">
              {apps.slice(0, 5).map(app => (
                <button key={app.id} onClick={() => setOpenApp(app)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-card border border-border hover:border-primary/30 transition-all text-left">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: `${app.color}18`, border: `1px solid ${app.color}30` }}>
                    {app.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{app.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{app.desc}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DISCOVER / STORE */}
      {tab === 'store' && (
        <div className="px-4 py-4 space-y-3">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Telegram Games Catalog</p>
                <p className="mt-1 text-xs text-muted-foreground">Browse tap games, arcade titles, puzzles, trivia, sports, and strategy mini apps built for fast Telegram sessions.</p>
              </div>
              <div className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold text-primary">
                {apps.filter(app => ['Games', 'Arcade', 'Puzzle', 'Strategy', 'Casual', 'Simulation', 'Sports', 'Trivia'].includes(app.category)).length}+ games
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-secondary border border-border rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search mini apps..."
              className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${category === c ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                {c}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {filtered.map(app => (
              <div key={app.id} className="flex items-center gap-3 px-3 py-3 rounded-xl bg-card border border-border">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: `${app.color}18`, border: `1px solid ${app.color}30` }}>
                  {app.icon}
                </div>
                <div className="flex-1 min-w-0" onClick={() => setOpenApp(app)}>
                  <p className="text-sm font-medium truncate">{app.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{app.desc}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    <span className="text-xs text-muted-foreground">{app.stars} · {app.users}</span>
                  </div>
                </div>
                <button onClick={() => togglePin(app.id)}
                  className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${app.pinned ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-secondary text-muted-foreground border border-border'}`}>
                  {app.pinned ? 'Pinned' : '+ Add'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ARRANGE */}
      {tab === 'arrange' && (
        <div className="px-4 py-4 space-y-4">
          <div className="bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
            <p className="text-xs text-primary flex items-center gap-2">
              <GripVertical className="w-3.5 h-3.5" /> Drag apps to reorder · Tap <X className="w-3 h-3 inline" /> to unpin
            </p>
          </div>

          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Pinned ({pinned.length})</p>
          <div className="grid grid-cols-3 gap-3">
            {pinned.map(app => (
              <div key={app.id}
                draggable
                onDragStart={() => onDragStart(app.id)}
                onDragOver={e => onDragOver(e, app.id)}
                onDrop={() => onDrop(app.id)}
                className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border cursor-grab active:cursor-grabbing transition-all ${dragOverId === app.id ? 'border-primary bg-primary/10 scale-105' : 'bg-card border-border'}`}>
                <button onClick={() => togglePin(app.id)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive flex items-center justify-center z-10">
                  <X className="w-3 h-3 text-white" />
                </button>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                  style={{ background: `${app.color}18`, border: `1px solid ${app.color}30` }}>
                  {app.icon}
                </div>
                <p className="text-[10px] font-medium text-center leading-tight line-clamp-2">{app.name}</p>
              </div>
            ))}
            <button onClick={() => setTab('store')}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl border-2 border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-primary transition-all">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-secondary">
                <Plus className="w-5 h-5" />
              </div>
              <p className="text-[10px]">Add App</p>
            </button>
          </div>

          {unpinned.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Available to Add</p>
              <div className="space-y-2">
                {unpinned.slice(0, 6).map(app => (
                  <div key={app.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-card border border-border">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: `${app.color}18` }}>
                      {app.icon}
                    </div>
                    <p className="text-sm font-medium flex-1 truncate">{app.name}</p>
                    <button onClick={() => togglePin(app.id)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/30 font-medium hover:bg-primary/20 transition-colors">
                      <Plus className="w-3 h-3 inline mr-0.5" />Pin
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {/* SECURITY */}
      {tab === 'security' && <SecurityAnalysis />}
    </div>
  );
}