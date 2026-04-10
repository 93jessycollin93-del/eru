import { useState, useEffect, useMemo } from 'react';
import { Star, Download, MessageSquare, Search, Send, X, Sparkles, Briefcase, Blocks, Globe2, Bot } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const ROLE_EMOJI = { assistant: '🤖', trader: '📈', game_helper: '🎮', social: '💬', custom: '⚙️' };
const CATEGORY_OPTIONS = ['All', 'Assistant', 'Trading', 'Gaming', 'Social', 'Custom'];
const INDUSTRY_OPTIONS = ['All', 'General', 'Finance', 'Ecommerce', 'Support', 'Education', 'Marketing', 'Gaming'];

const getCategory = (bot) => ({
  assistant: 'Assistant',
  trader: 'Trading',
  game_helper: 'Gaming',
  social: 'Social',
  custom: 'Custom',
}[bot.role] || 'Assistant');

const getIndustry = (bot) => {
  const text = `${bot.name || ''} ${bot.description || ''} ${bot.instructions || ''}`.toLowerCase();
  if (text.includes('trade') || text.includes('market') || text.includes('portfolio') || text.includes('crypto') || text.includes('finance')) return 'Finance';
  if (text.includes('shop') || text.includes('store') || text.includes('ecommerce') || text.includes('sales')) return 'Ecommerce';
  if (text.includes('support') || text.includes('help desk') || text.includes('customer')) return 'Support';
  if (text.includes('learn') || text.includes('education') || text.includes('teach') || text.includes('course')) return 'Education';
  if (text.includes('marketing') || text.includes('growth') || text.includes('seo') || text.includes('campaign')) return 'Marketing';
  if (text.includes('game') || text.includes('guild') || text.includes('player')) return 'Gaming';
  return 'General';
};

function StarRow({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(s => (
        <button key={s} onClick={() => onChange?.(s)}>
          <Star className={`w-4 h-4 ${s <= value ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
        </button>
      ))}
    </div>
  );
}

function BotCard({ bot, ratings, onInstall, onRate }) {
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState('');
  const [myRating, setMyRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const botRatings = ratings.filter(r => r.bot_id === bot.id);
  const avg = botRatings.length ? (botRatings.reduce((s, r) => s + r.rating, 0) / botRatings.length).toFixed(1) : '—';
  const category = getCategory(bot);
  const industry = getIndustry(bot);

  const submitRating = async () => {
    if (!myRating) return;
    setSubmitting(true);
    await onRate(bot, myRating, comment);
    setComment(''); setMyRating(0); setSubmitting(false);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{ROLE_EMOJI[bot.role] || '🤖'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">{bot.name}</p>
          <p className="text-[10px] text-muted-foreground capitalize">{bot.role} · by {bot.created_by?.split('@')[0]}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span className="text-xs font-medium text-yellow-400">{avg}</span>
            <span className="text-[9px] text-muted-foreground">({botRatings.length})</span>
          </div>
        </div>
        <button onClick={() => onInstall(bot)}
          className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold flex-shrink-0">
          <Download className="w-3 h-3" /> Install
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">{category}</span>
        <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[10px] font-medium text-muted-foreground">{industry}</span>
      </div>
      {bot.description && <p className="text-[10px] text-muted-foreground leading-relaxed">{bot.description}</p>}
      {bot.personality && <p className="text-[10px] text-foreground/60 italic">"{bot.personality}"</p>}

      <div className="flex items-center gap-2 pt-1 border-t border-border/50">
        <span className="text-[9px] text-muted-foreground">⚡ {bot.usage_count || 0} uses · Lv{bot.level || 1}</span>
        <button onClick={() => setShowComments(c => !c)}
          className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
          <MessageSquare className="w-3 h-3" /> {botRatings.length} reviews
        </button>
      </div>

      {showComments && (
        <div className="space-y-2 border-t border-border/50 pt-2">
          {botRatings.slice(0, 5).map(r => (
            <div key={r.id} className="bg-secondary rounded-lg px-2.5 py-2">
              <div className="flex items-center gap-1.5 mb-1">
                <StarRow value={r.rating} />
                <span className="text-[9px] text-muted-foreground">{r.created_by?.split('@')[0]}</span>
              </div>
              {r.comment && <p className="text-[10px] text-foreground/80">{r.comment}</p>}
            </div>
          ))}

          <div className="bg-secondary rounded-xl p-2.5 space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground">Leave a review</p>
            <StarRow value={myRating} onChange={setMyRating} />
            <div className="flex gap-2">
              <input value={comment} onChange={e => setComment(e.target.value)}
                placeholder="Optional comment…"
                className="flex-1 bg-background border border-border rounded-lg px-2 py-1.5 text-[10px] outline-none" />
              <button onClick={submitRating} disabled={!myRating || submitting}
                className="p-1.5 bg-primary text-primary-foreground rounded-lg disabled:opacity-40">
                <Send className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DiscoverMarketplace({ onInstalled, embedded = false }) {
  const { currentUser } = useAuth();
  const [bots, setBots] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [industry, setIndustry] = useState('All');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const load = async () => {
    setLoading(true);
    const [b, r] = await Promise.all([
      base44.entities.UserBot.filter({ is_public: true }, '-usage_count', 50),
      base44.entities.BotRating.list('-created_date', 200),
    ]);
    setBots(b);
    setRatings(r);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const install = async (bot) => {
    await base44.entities.UserBot.create({
      name: `${bot.name} (Clone)`,
      description: bot.description,
      role: bot.role,
      personality: bot.personality,
      instructions: bot.instructions,
      response_style: bot.response_style,
      handoff_instructions: bot.handoff_instructions,
      memory_enabled: bot.memory_enabled,
      status: 'active',
      is_public: false,
      usage_count: 0,
      xp: 0,
      level: 1,
    });
    setToast(`✅ "${bot.name}" cloned to your AI Lab!`);
    setTimeout(() => setToast(''), 3000);
    onInstalled?.();
  };

  const rate = async (bot, rating, comment) => {
    await base44.entities.BotRating.create({ bot_id: bot.id, bot_name: bot.name, rating, comment, user_email: currentUser?.email });
    load();
  };

  const featured = useMemo(() => bots.slice(0, embedded ? 3 : 4), [bots, embedded]);

  const marketplaceStats = useMemo(() => {
    const totalReviews = ratings.length;
    const avgRating = totalReviews ? (ratings.reduce((sum, item) => sum + item.rating, 0) / totalReviews).toFixed(1) : '—';
    return { totalReviews, avgRating };
  }, [ratings]);

  const filtered = bots.filter((b) => {
    const matchesSearch = !search || b.name.toLowerCase().includes(search.toLowerCase()) || (b.description || '').toLowerCase().includes(search.toLowerCase()) || (b.role || '').includes(search.toLowerCase());
    const matchesCategory = category === 'All' || getCategory(b) === category;
    const matchesIndustry = industry === 'All' || getIndustry(b) === industry;
    return matchesSearch && matchesCategory && matchesIndustry;
  });

  return (
    <div className="px-4 py-4 space-y-4">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded-xl shadow-lg flex items-center gap-2">
          {toast} <button onClick={() => setToast('')}><X className="w-3 h-3" /></button>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground"><Bot className="h-4 w-4" /><span className="text-xs uppercase">Templates</span></div>
          <p className="mt-2 text-2xl font-semibold">{bots.length}</p>
          <p className="text-xs text-muted-foreground">Public bots available to install</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground"><Star className="h-4 w-4" /><span className="text-xs uppercase">Avg rating</span></div>
          <p className="mt-2 text-2xl font-semibold">{marketplaceStats.avgRating}</p>
          <p className="text-xs text-muted-foreground">Based on all user reviews</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground"><MessageSquare className="h-4 w-4" /><span className="text-xs uppercase">Reviews</span></div>
          <p className="mt-2 text-2xl font-semibold">{marketplaceStats.totalReviews}</p>
          <p className="text-xs text-muted-foreground">Community feedback across bots</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4 text-primary" /> Featured bots</div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {featured.map((bot) => {
            const botRatings = ratings.filter((r) => r.bot_id === bot.id);
            const avg = botRatings.length ? (botRatings.reduce((sum, item) => sum + item.rating, 0) / botRatings.length).toFixed(1) : 'New';
            return (
              <div key={bot.id} className="rounded-xl border border-border bg-secondary/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{bot.name}</p>
                    <p className="text-[11px] text-muted-foreground">{getIndustry(bot)}</p>
                  </div>
                  <span className="text-xl">{ROLE_EMOJI[bot.role] || '🤖'}</span>
                </div>
                <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-yellow-400 text-yellow-400" /> {avg}</span>
                  <span>{getCategory(bot)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr),180px,180px]">
          <div className="flex items-center gap-2 bg-secondary border border-border rounded-xl px-3 py-2">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bots, use cases, or roles…"
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground" />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2">
            <Blocks className="h-3.5 w-3.5 text-muted-foreground" />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-transparent text-xs outline-none">
              {CATEGORY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2">
            <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
            <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="w-full bg-transparent text-xs outline-none">
              {INDUSTRY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{filtered.length} bots matched</p>
          <p className="text-[10px] text-muted-foreground/60">Install copies the bot into your workspace so you can customize it.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No public bots yet</p>
          <p className="text-xs mt-1">Mark your bots as public in the Build tab to share them</p>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {filtered.map(bot => <BotCard key={bot.id} bot={bot} ratings={ratings} onInstall={install} onRate={rate} />)}
        </div>
      )}
    </div>
  );
}