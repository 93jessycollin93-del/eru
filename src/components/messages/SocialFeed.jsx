import { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import CollectorReputationPill from '@/components/reputation/CollectorReputationPill';
import CollectorBadgeStrip from '@/components/reputation/CollectorBadgeStrip';
import { ImagePlus, Send, Repeat2, Package, BadgeDollarSign } from 'lucide-react';
import { useRealtimeEntityList } from '@/hooks/useLiveSync';

export default function SocialFeed() {
  const { user } = useAuth();
  const { data: listings } = useRealtimeEntityList('StorefrontListing', { sort: '-updated_date', limit: 8 });
  const { data: jadeAssets } = useRealtimeEntityList('JadeAsset', { sort: '-updated_date', limit: 8 });
  const { data: rewardProfiles } = useRealtimeEntityList('CollectorRewardProfile', { sort: '-updated_date', limit: 100 });
  const [posts, setPosts] = useState([
    { id: '1', author: 'Collector Circle', type: 'discussion', text: 'What are you rotating into this week and why?', likes: 12, email: 'collector-circle@platform' },
    { id: '2', author: 'Trade Desk', type: 'offer', text: 'Looking to swap premium jade pieces for rare cards or TON offers.', likes: 7, email: 'trade-desk@platform' },
  ]);
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState('discussion');

  const assetHighlights = useMemo(() => jadeAssets.slice(0, 3).map((item) => ({
    title: item.name || 'Jade Asset',
    subtitle: item.category || 'Collection item',
  })), [jadeAssets]);

  const handlePost = () => {
    if (!draft.trim()) return;
    setPosts((prev) => [{ id: String(Date.now()), author: user?.full_name || 'You', email: user?.email, type: mode, text: draft.trim(), likes: 0 }, ...prev]);
    setDraft('');
  };

  const getRewardProfile = (email) => rewardProfiles.find((profile) => profile.user_email === email);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Community Feed</h3>
          <div className="flex gap-2">
            {['discussion', 'offer', 'portfolio'].map((item) => (
              <button key={item} onClick={() => setMode(item)} className={`rounded-full px-2.5 py-1 text-[10px] border capitalize ${mode === item ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground'}`}>
                {item}
              </button>
            ))}
          </div>
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Share an asset update, trade idea, or portfolio thought..."
          className="w-full min-h-[96px] rounded-xl border border-border bg-secondary/50 px-3 py-3 text-sm text-foreground outline-none resize-none"
        />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><ImagePlus className="w-3.5 h-3.5" /> Assets</span>
            <span className="inline-flex items-center gap-1"><BadgeDollarSign className="w-3.5 h-3.5" /> Offers</span>
          </div>
          <button onClick={handlePost} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
            <Send className="w-3.5 h-3.5" /> Post
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-primary" />
            <h4 className="text-xs font-semibold">Collector assets spotlight</h4>
          </div>
          <div className="space-y-2">
            {assetHighlights.map((item, index) => (
              <div key={index} className="rounded-xl border border-border bg-secondary/40 px-3 py-2">
                <p className="text-xs font-semibold">{item.title}</p>
                <p className="text-[11px] text-muted-foreground">{item.subtitle}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Repeat2 className="w-4 h-4 text-primary" />
            <h4 className="text-xs font-semibold">Active trade listings</h4>
          </div>
          <div className="space-y-2">
            {listings.slice(0, 3).map((listing) => (
              <div key={listing.id} className="rounded-xl border border-border bg-secondary/40 px-3 py-2">
                <p className="text-xs font-semibold">{listing.title}</p>
                <p className="text-[11px] text-muted-foreground">{listing.sale_mode} · ${Number(listing.base_price || 0).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {posts.map((post) => {
          const rewardProfile = getRewardProfile(post.email);
          return (
            <div key={post.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div>
                  <p className="text-sm font-semibold">{post.author}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="text-[11px] text-muted-foreground capitalize">{post.type}</p>
                    <CollectorReputationPill statusIcon={rewardProfile?.status_icon || 'seed'} size="sm" />
                  </div>
                  <CollectorBadgeStrip badgeIds={rewardProfile?.badge_ids || []} limit={3} />
                </div>
                <button className="text-[11px] text-muted-foreground">{post.likes} likes</button>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{post.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}