import { useEffect, useMemo, useState } from 'react';
import { Store, Coins, Gem, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import BazarBalanceCard from '@/components/bazar/BazarBalanceCard';
import BazarProductCard from '@/components/bazar/BazarProductCard';

const DEFAULT_PRODUCTS = [
  {
    title: 'Gold Nugget',
    description: 'Starter GOLD for purchases, upgrades, and platform activity.',
    resource_code: 'GOLD',
    tier_label: '1 Nugget',
    amount: 1,
    display_unit: 'Base Unit',
    price_usd: 1,
    sort_order: 1,
  },
  {
    title: 'Gold Bar',
    description: 'Mid-tier GOLD bundle for regular app users.',
    resource_code: 'GOLD',
    tier_label: '1 Bar',
    amount: 100,
    display_unit: '100 GOLD',
    price_usd: 100,
    sort_order: 2,
    badge: 'Popular',
  },
  {
    title: 'Gold Chest',
    description: 'High-capacity GOLD reserve for premium activity.',
    resource_code: 'GOLD',
    tier_label: '1 Chest',
    amount: 1000,
    display_unit: '1000 GOLD',
    price_usd: 1000,
    sort_order: 3,
  },
  {
    title: 'Jadeite Chunk',
    description: 'Base JADEITE material unit for crafting and reserve storage.',
    resource_code: 'JADEITE',
    tier_label: '1 Chunk',
    amount: 1,
    display_unit: '1 JADEITE',
    price_usd: 1,
    sort_order: 4,
  },
  {
    title: 'Jadeite Slab',
    description: 'Expanded JADEITE reserve for refinement and appraisal.',
    resource_code: 'JADEITE',
    tier_label: '1 Slab',
    amount: 10,
    display_unit: '10 JADEITE',
    price_usd: 10,
    sort_order: 5,
    badge: 'Builder Pick',
  },
  {
    title: 'Core Reserve',
    description: 'Premium JADEITE reserve for storage, trading, and future expansion.',
    resource_code: 'JADEITE',
    tier_label: '1 Core Reserve',
    amount: 100,
    display_unit: '100 JADEITE',
    price_usd: 100,
    sort_order: 6,
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

  const groupedProducts = useMemo(() => ({
    GOLD: products.filter((item) => item.resource_code === 'GOLD').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    JADEITE: products.filter((item) => item.resource_code === 'JADEITE').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
  }), [products]);

  const handleBuy = async (product) => {
    setBuyingId(product.title);
    const me = await base44.auth.me();
    const nextGold = product.resource_code === 'GOLD' ? (me?.gold || 0) + Number(product.amount || 0) : (me?.gold || 0);
    const nextJadeite = product.resource_code === 'JADEITE' ? (me?.jadeite || 0) + Number(product.amount || 0) : (me?.jadeite || 0);

    await base44.auth.updateMe({ gold: nextGold, jadeite: nextJadeite });
    await base44.entities.EconomyAuditLog.create({
      action: 'bazar_purchase',
      user_email: me?.email,
      amount: Number(product.amount || 0),
      reason: `Purchased ${product.title}`,
      metadata: {
        resource_code: product.resource_code,
        tier_label: product.tier_label,
        price_usd: product.price_usd,
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
              <h2 className="text-sm font-semibold text-foreground">GOLD tiers</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {groupedProducts.GOLD.map((product) => (
                <BazarProductCard key={product.title} product={product} onBuy={handleBuy} buying={buyingId === product.title} />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Gem className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-foreground">JADEITE tiers</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {groupedProducts.JADEITE.map((product) => (
                <BazarProductCard key={product.title} product={product} onBuy={handleBuy} buying={buyingId === product.title} />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}