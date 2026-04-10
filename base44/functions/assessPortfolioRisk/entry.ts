import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Perform comprehensive risk assessment on user's portfolio
 * Uses historical data and AI analysis
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { walletId } = body;

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get wallet and holdings
    const wallet = await base44.asServiceRole.entities.ConnectedWallet.filter(
      { id: walletId },
      null,
      1
    );

    const holdings = await base44.asServiceRole.entities.WalletHolding.filter(
      { wallet_id: walletId },
      '-value_usd',
      100
    );

    if (!holdings || holdings.length === 0) {
      return Response.json({ error: 'No holdings found' }, { status: 404 });
    }

    // Calculate current metrics
    const totalValue = holdings.reduce((sum, h) => sum + (h.value_usd || 0), 0);
    const topAssets = holdings.slice(0, 5).map((h) => h.token_symbol).join(', ');
    const stablecoinValue = holdings
      .filter((h) => ['USDC', 'DAI', 'USDT'].includes(h.token_symbol))
      .reduce((sum, h) => sum + (h.value_usd || 0), 0);
    const stablecoinPercent = ((stablecoinValue / totalValue) * 100).toFixed(1);
    const concentration = Math.round((holdings[0]?.value_usd / totalValue) * 100);

    // Use AI for risk analysis
    const riskAssessment = await base44.integrations.Core.InvokeLLM({
      prompt: `Perform a comprehensive risk assessment for a cryptocurrency portfolio with these characteristics:

Portfolio Value: $${totalValue.toLocaleString()}
Top Assets: ${topAssets}
Stablecoin Allocation: ${stablecoinPercent}%
Concentration (largest asset): ${concentration}%
Number of Assets: ${holdings.length}
Primary Chains: Ethereum, Polygon, Arbitrum

Evaluate:
1. Concentration Risk: How exposed is the portfolio to single assets?
2. Volatility Risk: Expected price swings based on asset composition
3. Liquidity Risk: Ease of converting holdings to stable assets
4. Regulatory Risk: Exposure to regulated vs non-regulated assets
5. Smart Contract Risk: Exposure to newer/riskier protocols
6. Market Risk: Correlation with broader crypto market movements

Provide an overall risk score (1-10, where 10 is highest risk) and specific mitigation strategies.

Format as JSON: { overall_risk_score, risk_category, metrics: {...}, mitigation_strategies: [...], recommendation }`,
      response_json_schema: {
        type: 'object',
        properties: {
          overall_risk_score: { type: 'number' },
          risk_category: { type: 'string' },
          metrics: {
            type: 'object',
            properties: {
              concentration_risk: { type: 'number' },
              volatility_risk: { type: 'number' },
              liquidity_risk: { type: 'number' },
              regulatory_risk: { type: 'number' },
            },
          },
          mitigation_strategies: { type: 'array', items: { type: 'string' } },
          recommendation: { type: 'string' },
        },
      },
    });

    return Response.json({
      success: true,
      wallet_id: walletId,
      portfolio_value: totalValue.toFixed(2),
      risk_assessment: riskAssessment,
    });
  } catch (error) {
    console.error('Assess portfolio risk error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});