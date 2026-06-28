import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Predict asset performance using AI analysis
 * Analyzes historical data and market trends
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { walletId, tokens = ['BTC', 'ETH', 'USDC'] } = body;

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Get holdings for context
    const holdings = await base44.asServiceRole.entities.WalletHolding.filter(
      { wallet_id: walletId },
      '-value_usd',
      100
    );

    const holdingsSummary = holdings
      ?.map((h) => `${h.token_symbol}: ${h.balance_decimal.toFixed(4)} (${h.price_usd}/unit)`)
      .join('\n');

    // Use AI to analyze and predict
    const prediction = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze the following cryptocurrency portfolio and provide performance predictions:

Portfolio Holdings:
${holdingsSummary}

Current Market Context (as of April 2026):
- BTC trading around $50,000-$52,000
- ETH trading around $2,800-$2,950
- Market volatility: Moderate
- Regulatory environment: Stable

For each asset, provide:
1. 30-day price prediction (bullish/neutral/bearish with target)
2. Confidence level (0-100%)
3. Key catalysts/risks
4. Expected volatility
5. Recommended action (buy/hold/reduce)

Format as JSON with these fields for each token: symbol, prediction_direction, target_price, confidence, volatility_forecast, catalysts, recommendation.`,
      response_json_schema: {
        type: 'object',
        properties: {
          analysis_date: { type: 'string' },
          predictions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                symbol: { type: 'string' },
                prediction_direction: { type: 'string' },
                target_price: { type: 'number' },
                confidence: { type: 'number' },
                volatility_forecast: { type: 'string' },
                catalysts: { type: 'array', items: { type: 'string' } },
                recommendation: { type: 'string' },
              },
            },
          },
          market_outlook: { type: 'string' },
        },
      },
    });

    return Response.json({
      success: true,
      wallet_id: walletId,
      predictions: prediction,
    });
  } catch (error) {
    console.error('Predict asset performance error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});