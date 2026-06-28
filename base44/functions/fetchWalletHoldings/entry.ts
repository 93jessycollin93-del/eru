import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Fetch holdings from a connected wallet using Moralis API
 * Called by wallet manager or scheduled automation
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { walletAddress, chainId = 1, walletId } = body;

    if (!walletAddress) {
      return Response.json({ error: 'Missing walletAddress' }, { status: 400 });
    }

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify caller owns the wallet before writing any holdings or updating totals.
    if (walletId) {
      const wallet = await base44.asServiceRole.entities.ConnectedWallet.filter(
        { id: walletId },
        null,
        1,
      );
      if (!wallet || wallet.length === 0) {
        return Response.json({ error: 'Wallet not found' }, { status: 404 });
      }
      if (wallet[0].user_email !== user.email && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Simulate fetching holdings (replace with actual API call)
    // In production: use Moralis, Alchemy, or similar
    const mockHoldings = [
      { symbol: 'ETH', balance: '2.5', price: 2850 },
      { symbol: 'USDC', balance: '5000', price: 1 },
      { symbol: 'DAI', balance: '3000', price: 1 },
    ];

    const holdings = [];
    for (const h of mockHoldings) {
      const balanceDecimal = parseFloat(h.balance);
      const valueUsd = balanceDecimal * h.price;

      const holding = await base44.asServiceRole.entities.WalletHolding.create({
        user_email: user.email,
        wallet_id: walletId,
        wallet_address: walletAddress,
        token_symbol: h.symbol,
        balance: h.balance,
        balance_decimal: balanceDecimal,
        price_usd: h.price,
        value_usd: valueUsd,
        chain_id: chainId,
        last_updated: new Date().toISOString(),
      });

      holdings.push(holding);
    }

    // Update wallet's total value
    const totalValue = holdings.reduce((sum, h) => sum + (h.value_usd || 0), 0);

    if (walletId) {
      await base44.asServiceRole.entities.ConnectedWallet.update(walletId, {
        total_value_usd: totalValue,
        last_synced: new Date().toISOString(),
      });
    }

    return Response.json({
      success: true,
      wallet_address: walletAddress,
      total_value_usd: totalValue,
      holdings: holdings.length,
      holdings_list: holdings,
    });
  } catch (error) {
    console.error('Fetch holdings error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});