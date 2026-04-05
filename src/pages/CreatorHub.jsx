import { useState } from 'react';
import { Plus, Lightbulb, Package, Megaphone, Star, TrendingUp, Lock, CheckCircle, Clock, ArrowRight } from 'lucide-react';

const SAMPLE_IDEAS = [
  { id: 1, title: 'Decentralized Art Gallery', desc: 'A community-owned NFT gallery with voting-based curation', price: 0.5, category: 'concept', status: 'authorized', likes: 142, author: 'Visionary_X' },
  { id: 2, title: 'Crypto Trading Bot Blueprint', desc: 'Full source code for a momentum-based trading strategy', price: 1.2, category: 'project', status: 'authorized', likes: 89, author: 'CodeWizard' },
  { id: 3, title: 'Web3 Social Network Concept', desc: 'Ownership-first social media where users earn from content', price: 0.3, category: 'idea', status: 'pending_review', likes: 67, author: 'FutureMind' },
];

const AD_SLOTS = [
  { id: 1, title: 'Boost your listing', desc: 'Featured placement for 7 days', price: 0.1, reach: '10K+' },
  { id: 2, title: 'Community Spotlight', desc: 'Featured in Thinkers Club for 3 days', price: 0.05, reach: '5K+' },
  { id: 3, title: 'Premium Banner', desc: 'Top-of-page banner for 30 days', price: 0.5, reach: '50K+' },
];

const STATUS_CONFIG = {
  authorized: { icon: CheckCircle, color: 'text-green-400', label: 'Authorized', bg: 'bg-green-400/10' },
  pending_review: { icon: Clock, color: 'text-yellow-400', label: 'Pending Review', bg: 'bg-yellow-400/10' },
  rejected: { icon: Lock, color: 'text-red-400', label: 'Rejected', bg: 'bg-red-400/10' },
};

export default function CreatorHub() {
  const [tab, setTab] = useState('browse');
  const [form, setForm] = useState({ title: '', desc: '', price: '', category: 'idea' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!form.title || !form.desc) return;
    setSubmitted(true);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-primary" /> Creator Hub
        </h2>
        <p className="text-xs text-muted-foreground">Trade ideas · Sell concepts · Advertise your passion</p>
      </div>

      <div className="flex border-b border-border overflow-x-auto">
        {[{id:'browse',label:'Marketplace'},{id:'sell',label:'List Idea'},{id:'advertise',label:'Advertise'},{id:'my',label:'My Listings'}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors ${tab===t.id?'text-primary border-b-2 border-primary':'text-muted-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 space-y-3">
        {tab === 'browse' && (
          <>
            <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-3 py-2 mb-4">
              <Star className="w-4 h-4 text-primary" />
              <p className="text-xs text-primary">Only <span className="font-bold">Authorized</span> listings can be traded. Submit your idea for review first.</p>
            </div>
            {SAMPLE_IDEAS.map(idea => {
              const s = STATUS_CONFIG[idea.status];
              return (
                <div key={idea.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{idea.title}</p>
                      <p className="text-xs text-muted-foreground">{idea.author}</p>
                    </div>
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${s.bg} ${s.color}`}>
                      <s.icon className="w-3 h-3" />{s.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{idea.desc}</p>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-3">
                      <span className="text-primary font-mono font-semibold text-sm">{idea.price} TON</span>
                      <span className="text-xs text-muted-foreground">♥ {idea.likes}</span>
                    </div>
                    {idea.status === 'authorized' ? (
                      <button className="bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-xs font-semibold">Buy / Trade</button>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Awaiting auth</span>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {tab === 'sell' && !submitted && (
          <div className="space-y-3">
            <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-xl p-3">
              <p className="text-xs text-yellow-400">Your listing will be submitted for review. Once approved, it receives the <span className="font-bold">Authorized</span> badge and becomes tradeable.</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Category</label>
              <select value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value}))}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none">
                <option value="idea">💡 Idea</option>
                <option value="concept">🎯 Concept</option>
                <option value="project">🚀 Passion Project</option>
                <option value="nft">🖼️ NFT / Collectable</option>
                <option value="code">💻 Code / Script</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Title</label>
              <input value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))}
                placeholder="Name your creation..." className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Description</label>
              <textarea value={form.desc} onChange={e => setForm(p => ({...p, desc: e.target.value}))}
                placeholder="Describe your idea, its value, and what buyers get..."
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm outline-none resize-none min-h-[100px]" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Price (TON)</label>
              <input type="number" value={form.price} onChange={e => setForm(p => ({...p, price: e.target.value}))}
                placeholder="0.00" className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm outline-none" />
            </div>
            <button onClick={handleSubmit}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2">
              <ArrowRight className="w-4 h-4" /> Submit for Review
            </button>
          </div>
        )}

        {tab === 'sell' && submitted && (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Clock className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold">Submitted for Review</h3>
            <p className="text-sm text-muted-foreground max-w-xs">Your listing is being reviewed for quality and safety. You'll be notified when it receives the Authorized badge.</p>
            <button onClick={() => { setSubmitted(false); setForm({ title:'', desc:'', price:'', category:'idea' }); }}
              className="text-primary text-sm underline">Submit another</button>
          </div>
        )}

        {tab === 'advertise' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Boost visibility for your listings, ideas, or NFTs across the platform.</p>
            {AD_SLOTS.map(ad => (
              <div key={ad.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-primary" />
                    <p className="font-medium text-sm">{ad.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{ad.desc}</p>
                  <p className="text-xs text-primary mt-1">Est. reach: {ad.reach}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-primary font-mono font-semibold text-sm">{ad.price} TON</p>
                  <button className="mt-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg px-3 py-1 text-xs font-medium hover:bg-primary/20 transition-colors">Boost</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'my' && (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
            <Package className="w-12 h-12 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No listings yet. Share your first idea!</p>
            <button onClick={() => setTab('sell')} className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium">Create Listing</button>
          </div>
        )}
      </div>
    </div>
  );
}