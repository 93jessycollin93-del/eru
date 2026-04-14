import { useEffect, useState } from 'react';
import { Store, Coins, Gem, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import BazarBalanceCard from '@/components/bazar/BazarBalanceCard';
import BazarProductCard from '@/components/bazar/BazarProductCard';

const DEFAULT_PRODUCTS = [
  {
    title: 'Starter Pulse',
    description: '+ 1 GOLD · + 1 JADEITE · + 1 Random Micro Bonus',
    resource_code: 'BUNDLE',
    tier_label: '$1 Pack',
    amount: 1,
    display_unit: 'Starter Pack',
    price_usd: 1,
    sort_order: 1,
    badge: 'Entry',
    rewards: { gold: 1, jadeite: 1, bonuses: ['1 Random Micro Bonus'] },
  },
  {
    title: 'Initiate Bundle',
    description: '+ 6 GOLD · + 6 JADEITE · + 2 Random Bonuses',
    resource_code: 'BUNDLE',
    tier_label: '$5 Pack',
    amount: 1,
    display_unit: 'Initiate Pack',
    price_usd: 5,
    sort_order: 2,
    rewards: { gold: 6, jadeite: 6, bonuses: ['2 Random Bonuses'] },
  },
  {
    title: 'Builder Pack',
    description: '+ 13 GOLD · + 13 JADEITE · + Small Rare Chance Drop',
    resource_code: 'BUNDLE',
    tier_label: '$10 Pack',
    amount: 1,
    display_unit: 'Builder Pack',
    price_usd: 10,
    sort_order: 3,
    badge: 'Popular',
    rewards: { gold: 13, jadeite: 13, bonuses: ['Small Rare Chance Drop'] },
  },
  {
    title: 'Growth Surge',
    description: '+ 28 GOLD · + 28 JADEITE · + Guaranteed Rare Material',
    resource_code: 'BUNDLE',
    tier_label: '$20 Pack',
    amount: 1,
    display_unit: 'Growth Pack',
    price_usd: 20,
    sort_order: 4,
    rewards: { gold: 28, jadeite: 28, bonuses: ['Guaranteed Rare Material'] },
  },
  {
    title: 'Expansion Crate',
    description: '+ 80 GOLD · + 80 JADEITE · + Epic Drop Chance · + Resource Multiplier (limited time)',
    resource_code: 'BUNDLE',
    tier_label: '$50 Pack',
    amount: 1,
    display_unit: 'Expansion Crate',
    price_usd: 50,
    sort_order: 5,
    rewards: { gold: 80, jadeite: 80, bonuses: ['Epic Drop Chance', 'Resource Multiplier (limited time)'] },
  },
  {
    title: 'Dominator Cache',
    description: '+ 180 GOLD · + 180 JADEITE · + Guaranteed Epic Drop · + Bonus Refinement Materials · + Temporary Boost Buff',
    resource_code: 'BUNDLE',
    tier_label: '$100 Pack',
    amount: 1,
    display_unit: 'Dominator Cache',
    price_usd: 100,
    sort_order: 6,
    badge: 'Elite',
    rewards: { gold: 180, jadeite: 180, bonuses: ['Guaranteed Epic Drop', 'Bonus Refinement Materials', 'Temporary Boost Buff'] },
  },
  {
    title: 'Warlord Reserve',
    description: '+ 300 GOLD · + 300 JADEITE · + Legendary Drop Chance · + Exclusive Asset Unlock',
    resource_code: 'BUNDLE',
    tier_label: '$150 Pack',
    amount: 1,
    display_unit: 'Warlord Reserve',
    price_usd: 150,
    sort_order: 7,
    rewards: { gold: 300, jadeite: 300, bonuses: ['Legendary Drop Chance', 'Exclusive Asset Unlock'] },
  },
  {
    title: 'Sovereign Vault',
    description: '+ 600 GOLD · + 600 JADEITE · + Guaranteed Legendary Asset · + Exclusive Visual Skin · + Permanent Efficiency Boost · + Priority Processing · + Ultra Rare Drop Chance',
    resource_code: 'BUNDLE',
    tier_label: '$250 Pack',
    amount: 1,
    display_unit: 'Sovereign Vault',
    price_usd: 250,
    sort_order: 8,
    badge: 'Mythic',
    rewards: { gold: 600, jadeite: 600, bonuses: ['Guaranteed Legendary Asset', 'Exclusive Visual Skin', 'Permanent Efficiency Boost (minor but meaningful)', 'Priority Processing (faster crafting/refinement)', 'Ultra Rare Drop Chance'] },
  },
];

export default function BazarStand() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState(null);
  const [userState, setUserState] = useState({ gold: 0, jadeite: 0 });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [me, rows] = await Promise.all([
        base44.auth.me(),
        base44.entities.BazarProduct.list('sort_order', 100).catch(() => []),
      ]);
      setUserState({ gold: me?.gold || 0, jadeite: me?.jadeite || 0 });
      setProducts(rows?.length ? rows.filter((item) => item.is_active !== false) : DEFAULT_PRODUCTS);
      setLoading(false);
    };

    load();
  }, []);

  const sortedProducts = [...products].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const handleBuy = async (product) => {
    setBuyingId(product.title);
    const me = await base44.auth.me();
    const rewardGold = Number(product.rewards?.gold || product.gold_amount || 0);
    const rewardJadeite = Number(product.rewards?.jadeite || product.jadeite_amount || 0);
    const nextGold = (me?.gold || 0) + rewardGold;
    const nextJadeite = (me?.jadeite || 0) + rewardJadeite;

    await base44.auth.updateMe({ gold: nextGold, jadeite: nextJadeite });
    await base44.entities.EconomyAuditLog.create({
      action: 'bazar_purchase',
      user_email: me?.email,
      amount: Number(product.price_usd || 0),
      reason: `Purchased ${product.title}`,
      metadata: {
        resource_code: product.resource_code,
        tier_label: product.tier_label,
        price_usd: product.price_usd,
        rewards: product.rewards || null,
      },
      status: 'success',
    }).catch(() => null);

    setUserState({ gold: nextGold, jadeite: nextJadeite });
    setBuyingId(null);
  };

  return (
    <div className="min-h-screen bg-background px-4 py-4 pb-24 space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
            <Store className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Bazar Stand</h1>
            <p className="mt-1 text-sm text-muted-foreground">Internal store for app users to purchase in-game currency, credits, and reserve resources.</p>
          </div>
        </div>
      </div>

      <BazarBalanceCard gold={userState.gold} jadeite={userState.jadeite} />

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
          <div className="space-y-1 text-xs text-muted-foreground">
            <p><span className="font-semibold text-foreground">Economy Structure</span></p>
            <p><span className="text-yellow-400">GOLD</span> is the main transactional currency. Reference rate: 1 USD = 1 GOLD.</p>
            <p><span className="text-emerald-400">JADEITE</span> is the secondary asset resource. Reference rate: 1 USD = 1 JADEITE.</p>
            <p>Balances use padded numeric formatting for a premium digital asset look and can scale cleanly later.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading Bazar Stand…</div>
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-yellow-400" />
              <Gem className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-foreground">Bazar packs</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sortedProducts.map((product) => (
                <BazarProductCard key={product.title} product={product} onBuy={handleBuy} buying={buyingId === product.title} />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}