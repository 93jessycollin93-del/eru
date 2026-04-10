import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import WalletConnector from '@/components/WalletConnector';
import { Wallet, Trash2, RefreshCw, TrendingUp } from 'lucide-react';

export default function WalletManager() {
  const { currentUser } = useAuth();
  const [wallets, setWallets] = useState([]);
  const [holdings, setHoldings] = useState({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(null);

  useEffect(() => {
    if (currentUser) {
      fetchWallets();
    }
  }, [currentUser]);

  const fetchWallets = async () => {
    try {
      setLoading(true);
      const w = await base44.entities.ConnectedWallet.filter(
        { user_email: currentUser.email },
        '-created_date',
        100
      );
      setWallets(w || []);

      // Fetch holdings for each wallet
      for (const wallet of w || []) {
        const h = await base44.entities.WalletHolding.filter(
          { wallet_id: wallet.id },
          '-value_usd',
          100
        );
        setHoldings((prev) => ({ ...prev, [wallet.id]: h || [] }));
      }
    } catch (err) {
      console.error('Error fetching wallets:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshHoldings = async (walletId, address, chainId) => {
    setSyncing(walletId);
    try {
      // Clear old holdings
      const oldHoldings = await base44.entities.WalletHolding.filter(
        { wallet_id: walletId },
        null,
        1000
      );
      for (const h of oldHoldings || []) {
        await base44.entities.WalletHolding.delete(h.id);
      }

      // Fetch new
      await base44.functions.invoke('fetchWalletHoldings', {
        walletAddress: address,
        chainId,
        walletId,
      });

      await fetchWallets();
    } catch (err) {
      alert('Sync failed: ' + err.message);
    } finally {
      setSyncing(null);
    }
  };

  const disconnectWallet = async (walletId) => {
    if (!confirm('Disconnect this wallet?')) return;
    try {
      await base44.entities.ConnectedWallet.delete(walletId);
      setWallets(wallets.filter((w) => w.id !== walletId));
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" /> Wallet Manager
        </h2>
        <p className="text-xs text-muted-foreground mt-1">Connect crypto wallets and track holdings</p>
      </div>

      <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
        {/* Connect Section */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3">Add Wallet</h3>
          <WalletConnector onConnected={fetchWallets} />
        </div>

        {/* Connected Wallets */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" /> Connected Wallets ({wallets.length})
          </h3>

          {loading ? (
            <div className="text-center py-6 text-muted-foreground">
              <div className="w-5 h-5 border-2 border-muted-foreground/20 border-t-primary rounded-full animate-spin mx-auto" />
            </div>
          ) : wallets.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-4 text-center text-sm text-muted-foreground">
              No wallets connected yet
            </div>
          ) : (
            <div className="space-y-3">
              {wallets.map((wallet) => (
                <div key={wallet.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                  {/* Wallet header */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{wallet.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{wallet.wallet_address}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">${(wallet.total_value_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                      <p className="text-xs text-muted-foreground">Chain {wallet.chain_id}</p>
                    </div>
                  </div>

                  {/* Holdings */}
                  {(holdings[wallet.id] || []).length > 0 && (
                    <div className="space-y-2 border-t border-border pt-3">
                      {(holdings[wallet.id] || []).map((h) => (
                        <div key={h.id} className="flex items-center justify-between text-sm">
                          <div>
                            <p className="font-medium">{h.token_symbol}</p>
                            <p className="text-xs text-muted-foreground">
                              {h.balance_decimal.toFixed(4)} @ ${h.price_usd}
                            </p>
                          </div>
                          <p className="font-bold text-green-500">${(h.value_usd || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <button
                      onClick={() => refreshHoldings(wallet.id, wallet.wallet_address, wallet.chain_id)}
                      disabled={syncing === wallet.id}
                      className="flex-1 flex items-center justify-center gap-1 py-2 bg-secondary rounded-lg text-xs font-medium hover:opacity-80 transition-opacity disabled:opacity-50">
                      {syncing === wallet.id ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" /> Syncing
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3 h-3" /> Sync
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => disconnectWallet(wallet.id)}
                      className="flex-1 flex items-center justify-center gap-1 py-2 bg-red-500/10 text-red-600 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity">
                      <Trash2 className="w-3 h-3" /> Disconnect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex gap-3">
          <TrendingUp className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Live Tracking</p>
            <p>Your wallet holdings are tracked in real-time. Click "Sync" to refresh prices and balances.</p>
          </div>
        </div>
      </div>
    </div>
  );
}