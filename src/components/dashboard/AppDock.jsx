import { useState } from 'react';
import { Plus, X, Bookmark, Search, Check } from 'lucide-react';

const ALL_APPS = [
  // Social
  { id: 'instagram', label: 'Instagram', emoji: '📸', url: 'https://instagram.com', category: 'Social' },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵', url: 'https://tiktok.com', category: 'Social' },
  { id: 'twitter', label: 'X / Twitter', emoji: '𝕏', url: 'https://x.com', category: 'Social' },
  { id: 'reddit', label: 'Reddit', emoji: '👽', url: 'https://reddit.com', category: 'Social' },
  { id: 'linkedin', label: 'LinkedIn', emoji: '💼', url: 'https://linkedin.com', category: 'Social' },
  { id: 'snapchat', label: 'Snapchat', emoji: '👻', url: 'https://snapchat.com', category: 'Social' },
  { id: 'pinterest', label: 'Pinterest', emoji: '📌', url: 'https://pinterest.com', category: 'Social' },
  // Messaging
  { id: 'discord', label: 'Discord', emoji: '🎮', url: 'https://discord.com/app', category: 'Messaging' },
  { id: 'whatsapp', label: 'WhatsApp', emoji: '💬', url: 'https://web.whatsapp.com', category: 'Messaging' },
  { id: 'telegram', label: 'Telegram', emoji: '✈️', url: 'https://web.telegram.org', category: 'Messaging' },
  { id: 'messenger', label: 'Messenger', emoji: '💙', url: 'https://messenger.com', category: 'Messaging' },
  { id: 'signal', label: 'Signal', emoji: '🔒', url: 'https://signal.org', category: 'Messaging' },
  { id: 'slack', label: 'Slack', emoji: '🟣', url: 'https://app.slack.com', category: 'Messaging' },
  // Calls / Video
  { id: 'zoom', label: 'Zoom', emoji: '📹', url: 'https://zoom.us/signin', category: 'Calls' },
  { id: 'meet', label: 'Google Meet', emoji: '🎥', url: 'https://meet.google.com', category: 'Calls' },
  { id: 'teams', label: 'MS Teams', emoji: '🟦', url: 'https://teams.microsoft.com', category: 'Calls' },
  { id: 'facetime', label: 'FaceTime', emoji: '📱', url: 'https://facetime.apple.com', category: 'Calls' },
  { id: 'skype', label: 'Skype', emoji: '☁️', url: 'https://web.skype.com', category: 'Calls' },
  // Streaming
  { id: 'youtube', label: 'YouTube', emoji: '▶️', url: 'https://youtube.com', category: 'Streaming' },
  { id: 'twitch', label: 'Twitch', emoji: '🟣', url: 'https://twitch.tv', category: 'Streaming' },
  { id: 'netflix', label: 'Netflix', emoji: '🎬', url: 'https://netflix.com', category: 'Streaming' },
  { id: 'spotify', label: 'Spotify', emoji: '🎧', url: 'https://open.spotify.com', category: 'Streaming' },
  { id: 'soundcloud', label: 'SoundCloud', emoji: '🔊', url: 'https://soundcloud.com', category: 'Streaming' },
  { id: 'primevideo', label: 'Prime Video', emoji: '📦', url: 'https://primevideo.com', category: 'Streaming' },
  // Telegram Mini Apps
  { id: 'tg_tonspace', label: 'TON Space', emoji: '💎', url: 'https://t.me/wallet', category: 'TG Mini Apps' },
  { id: 'tg_fragment', label: 'Fragment', emoji: '🔗', url: 'https://fragment.com', category: 'TG Mini Apps' },
  { id: 'tg_getgems', label: 'Getgems', emoji: '🖼️', url: 'https://getgems.io', category: 'TG Mini Apps' },
  { id: 'tg_blum', label: 'Blum', emoji: '🌸', url: 'https://t.me/BlumCryptoBot', category: 'TG Mini Apps' },
  { id: 'tg_notcoin', label: 'Notcoin', emoji: '🪙', url: 'https://t.me/notcoin_bot', category: 'TG Mini Apps' },
  // Bookmarks
  { id: 'github', label: 'GitHub', emoji: '🐙', url: 'https://github.com', category: 'Dev' },
  { id: 'codesandbox', label: 'CodeSandbox', emoji: '📦', url: 'https://codesandbox.io', category: 'Dev' },
  { id: 'tradingview', label: 'TradingView', emoji: '📈', url: 'https://tradingview.com', category: 'Finance' },
  { id: 'coinmarketcap', label: 'CoinMktCap', emoji: '🏆', url: 'https://coinmarketcap.com', category: 'Finance' },
];

const CATEGORIES = ['All', 'Social', 'Messaging', 'Calls', 'Streaming', 'TG Mini Apps', 'Dev', 'Finance'];
const DEFAULT_PINNED = ['discord', 'whatsapp', 'telegram', 'instagram', 'tiktok', 'youtube', 'spotify', 'tg_tonspace'];

export default function AppDock() {
  const [pinned, setPinned] = useState(DEFAULT_PINNED);
  const [editMode, setEditMode] = useState(false);
  const [showStore, setShowStore] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [openUrl, setOpenUrl] = useState(null);

  const pinnedApps = ALL_APPS.filter(a => pinned.includes(a.id));
  const filteredStore = ALL_APPS.filter(a =>
    (category === 'All' || a.category === category) &&
    (a.label.toLowerCase().includes(search.toLowerCase()))
  );

  const toggle = (id) => {
    setPinned(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const openApp = (app) => {
    if (editMode) return;
    window.open(app.url, '_blank');
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/60">
        <div className="flex items-center gap-2">
          <Bookmark className="w-3.5 h-3.5 text-primary" />
          <p className="text-xs font-semibold text-primary">My Apps</p>
          <span className="text-[9px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">{pinned.length} pinned</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setEditMode(e => !e)}
            className={`text-[10px] px-2 py-1 rounded-lg transition-colors font-medium ${editMode ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
            {editMode ? 'Done' : 'Edit'}
          </button>
          <button onClick={() => setShowStore(true)}
            className="bg-primary/10 text-primary border border-primary/20 rounded-lg p-1 hover:bg-primary/20 transition-colors">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Pinned apps grid */}
      <div className="px-3 py-3">
        {pinnedApps.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs text-muted-foreground">No apps pinned. Tap + to add apps.</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {pinnedApps.map(app => (
              <div key={app.id} className="relative flex flex-col items-center gap-1" onClick={() => openApp(app)}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl bg-secondary border cursor-pointer transition-all
                  ${editMode ? 'border-primary/40 animate-[wiggle_0.3s_ease-in-out_infinite]' : 'border-border hover:border-primary/40 hover:scale-105 active:scale-95'}`}>
                  {app.emoji}
                </div>
                <p className="text-[9px] text-muted-foreground text-center leading-tight truncate w-full text-center">{app.label}</p>
                {editMode && (
                  <button onClick={e => { e.stopPropagation(); toggle(app.id); }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-white rounded-full flex items-center justify-center z-10">
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* App Store modal overlay */}
      {showStore && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end" onClick={() => setShowStore(false)}>
          <div className="w-full max-w-md mx-auto bg-card rounded-t-2xl border-t border-border max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="font-semibold text-sm">App Store</p>
              <button onClick={() => setShowStore(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-4 py-2 border-b border-border">
              <div className="flex items-center gap-2 bg-secondary border border-border rounded-xl px-3 py-2">
                <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search apps..."
                  className="flex-1 bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground" />
              </div>
            </div>
            <div className="px-4 py-2 border-b border-border overflow-x-auto">
              <div className="flex gap-2 min-w-max">
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => setCategory(c)}
                    className={`px-3 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors ${category === c ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <div className="grid grid-cols-4 gap-3">
                {filteredStore.map(app => {
                  const isPinned = pinned.includes(app.id);
                  return (
                    <div key={app.id} className="flex flex-col items-center gap-1.5" onClick={() => toggle(app.id)}>
                      <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center text-2xl bg-secondary border cursor-pointer transition-all hover:scale-105 active:scale-95
                        ${isPinned ? 'border-primary ring-1 ring-primary/50' : 'border-border'}`}>
                        {app.emoji}
                        {isPinned && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      <p className="text-[9px] text-muted-foreground text-center leading-tight truncate w-full">{app.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-border">
              <button onClick={() => setShowStore(false)}
                className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold">
                Done · {pinned.length} apps pinned
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}