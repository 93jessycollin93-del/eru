import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function round(value) {
  return Number((value || 0).toFixed(2));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const holdings = Array.isArray(body.holdings) ? body.holdings : [];
    const targetAllocation = body.targetAllocation || {};

    if (holdings.length === 0) {
      return Response.json({ error: 'No holdings provided' }, { status: 400 });
    }

    const totals = {};
    let portfolioValue = 0;

    holdings.forEach((item) => {
      const symbol = String(item.symbol || '').toUpperCase();
      const value = Number(item.value_usd || 0);
      if (!symbol || value <= 0) return;
      totals[symbol] = (totals[symbol] || 0) + value;
      portfolioValue += value;
    });

    const recommendations = [];
    const buys = [];
    const sells = [];
    const allTokens = [...new Set([...Object.keys(totals), ...Object.keys(targetAllocation).map((key) => key.toUpperCase())])];

    allTokens.forEach((token) => {
      const currentValue = totals[token] || 0;
      const currentPercent = portfolioValue > 0 ? (currentValue / portfolioValue) * 100 : 0;
      const targetPercent = Number(targetAllocation[token] ?? targetAllocation[token.toUpperCase()] ?? 0);
      const targetValue = (portfolioValue * targetPercent) / 100;
      const difference = targetValue - currentValue;
      const action = difference > 0 ? 'buy' : difference < 0 ? 'sell' : 'hold';
      const recommendation = {
        token,
        current_percent: round(currentPercent),
        target_percent: round(targetPercent),
        current_value: round(currentValue),
        target_value: round(targetValue),
        amount_usd: round(Math.abs(difference)),
        action,
      };

      recommendations.push(recommendation);
      if (difference > 0.01) buys.push({ token, remaining: difference });
      if (difference < -0.01) sells.push({ token, remaining: Math.abs(difference) });
    });

    const tradePlan = [];
    sells.forEach((sell) => {
      buys.forEach((buy) => {
        if (sell.remaining <= 0 || buy.remaining <= 0) return;
        const amount = Math.min(sell.remaining, buy.remaining);
        sell.remaining -= amount;
        buy.remaining -= amount;
        tradePlan.push(`Sell about $${round(amount)} of ${sell.token} and move it into ${buy.token}`);
      });
    });

    const filteredRecommendations = recommendations.filter((item) => item.amount_usd > 0.01);
    const suggestion = await base44.entities.RebalancingSuggestion.create({
      user_email: user.email,
      status: 'pending',
      actions: filteredRecommendations.map((item) => ({
        asset: item.token,
        current_percentage: item.current_percent,
        target_percentage: item.target_percent,
        action: item.action,
        percentage_change: round(item.target_percent - item.current_percent),
      })),
      total_deviation: round(filteredRecommendations.reduce((sum, item) => sum + Math.abs(item.target_percent - item.current_percent), 0)),
      priority: filteredRecommendations.length > 4 ? 'high' : filteredRecommendations.length > 2 ? 'medium' : 'low',
      triggered_by_assets: filteredRecommendations.map((item) => item.token),
      notes: tradePlan.join(' | '),
    });

    return Response.json({
      success: true,
      suggestion_id: suggestion.id,
      portfolio_value: round(portfolioValue),
      recommendations: filteredRecommendations,
      total_buy_amount: round(filteredRecommendations.filter((item) => item.action === 'buy').reduce((sum, item) => sum + item.amount_usd, 0)),
      total_sell_amount: round(filteredRecommendations.filter((item) => item.action === 'sell').reduce((sum, item) => sum + item.amount_usd, 0)),
      trade_plan: tradePlan,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});