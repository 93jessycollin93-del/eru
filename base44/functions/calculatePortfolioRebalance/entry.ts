import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Calculate portfolio rebalancing suggestions based on target allocation
 * Returns delta between current and target, with buy/sell recommendations
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { walletId, targetAllocation } = body;

    if (!walletId || !targetAllocation) {
      return Response.json({ error: 'Missing walletId or targetAllocation' }, { status: 400 });
    }

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch current holdings
    const holdings = await base44.asServiceRole.entities.WalletHolding.filter(
      { wallet_id: walletId },
      '-value_usd',
      100
    );

    if (!holdings || holdings.length === 0) {
      return Response.json({ error: 'No holdings found' }, { status: 404 });
    }

    // Calculate current allocation
    const totalValue = holdings.reduce((sum, h) => sum + (h.value_usd || 0), 0);
    const currentAllocation = {};

    holdings.forEach((h) => {
      const percent = totalValue > 0 ? (h.value_usd / totalValue) * 100 : 0;
      currentAllocation[h.token_symbol] = {
        value: h.value_usd,
        percent,
        balance: h.balance_decimal,
        symbol: h.token_symbol,
      };
    });

    // Calculate deltas
    const recommendations = [];
    const allTokens = new Set([
      ...Object.keys(currentAllocation),
      ...Object.keys(targetAllocation),
    ]);

    for (const token of allTokens) {
      const currentPercent = currentAllocation[token]?.percent || 0;
      const targetPercent = targetAllocation[token] || 0;
      const delta = targetPercent - currentPercent;

      if (Math.abs(delta) > 1) {
        // Only recommend if delta > 1%
        const targetValue = (totalValue * targetPercent) / 100;
        const currentValue = currentAllocation[token]?.value || 0;
        const netChange = targetValue - currentValue;

        recommendations.push({
          token,
          current_percent: currentPercent.toFixed(2),
          target_percent: targetPercent.toFixed(2),
          delta_percent: delta.toFixed(2),
          current_value: currentValue.toFixed(2),
          target_value: targetValue.toFixed(2),
          action: delta > 0 ? 'buy' : 'sell',
          amount_usd: Math.abs(netChange).toFixed(2),
          priority: Math.abs(delta) > 10 ? 'high' : 'medium',
        });
      }
    }

    // Sort by priority and delta
    recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const diff = priorityOrder[a.priority] - priorityOrder[b.priority];
      return diff !== 0 ? diff : Math.abs(parseFloat(b.delta_percent)) - Math.abs(parseFloat(a.delta_percent));
    });

    return Response.json({
      success: true,
      wallet_id: walletId,
      portfolio_value: totalValue.toFixed(2),
      current_allocation: currentAllocation,
      target_allocation: targetAllocation,
      recommendations,
      total_buy_amount: recommendations
        .filter((r) => r.action === 'buy')
        .reduce((sum, r) => sum + parseFloat(r.amount_usd), 0)
        .toFixed(2),
      total_sell_amount: recommendations
        .filter((r) => r.action === 'sell')
        .reduce((sum, r) => sum + parseFloat(r.amount_usd), 0)
        .toFixed(2),
    });
  } catch (error) {
    console.error('Calculate rebalance error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});