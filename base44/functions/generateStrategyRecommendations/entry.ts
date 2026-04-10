import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Generate personalized investment strategy recommendations
 * Based on user profile, portfolio, and market conditions
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { walletId, riskTolerance = 'moderate', investmentHorizon = '12-months' } = body;

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile and holdings
    const holdings = await base44.asServiceRole.entities.WalletHolding.filter(
      { wallet_id: walletId },
      '-value_usd',
      100
    );

    if (!holdings || holdings.length === 0) {
      return Response.json({ error: 'No holdings found' }, { status: 404 });
    }

    const totalValue = holdings.reduce((sum, h) => sum + (h.value_usd || 0), 0);
    const allocationSummary = holdings
      .map((h) => `${h.token_symbol}: ${((h.value_usd / totalValue) * 100).toFixed(1)}%`)
      .join(', ');

    // Generate personalized strategy using AI
    const strategy = await base44.integrations.Core.InvokeLLM({
      prompt: `Create a personalized investment strategy for a crypto investor with the following profile:

User Profile:
- Risk Tolerance: ${riskTolerance} (conservative/moderate/aggressive)
- Investment Horizon: ${investmentHorizon}
- Portfolio Value: $${totalValue.toLocaleString()}
- Current Allocation: ${allocationSummary}

Market Context (April 2026):
- Bitcoin dominance: ~45%
- Institutional adoption: Growing
- DeFi ecosystem: Mature
- Layer 2 solutions: Scaling rapidly
- Regulatory outlook: Stabilizing

Develop a comprehensive strategy including:
1. Target Asset Allocation (by risk category)
2. Rebalancing Frequency & Rules
3. Entry/Exit Criteria for trades
4. Risk Management Rules (stop losses, position limits)
5. Diversification Strategy
6. Action Plan (next 3 months)
7. KPIs to Monitor

Tailor recommendations specifically to the user's risk tolerance (${riskTolerance}) and time horizon (${investmentHorizon}).

Format as JSON: { strategy_name, target_allocation: {...}, rebalancing_rules: {...}, risk_management: {...}, action_plan: [...], kpis: [...] }`,
      response_json_schema: {
        type: 'object',
        properties: {
          strategy_name: { type: 'string' },
          strategy_description: { type: 'string' },
          target_allocation: {
            type: 'object',
            additionalProperties: { type: 'number' },
          },
          rebalancing_rules: {
            type: 'object',
            properties: {
              frequency: { type: 'string' },
              threshold: { type: 'number' },
              rules: { type: 'array', items: { type: 'string' } },
            },
          },
          risk_management: {
            type: 'object',
            properties: {
              position_limit_percent: { type: 'number' },
              stop_loss_percent: { type: 'number' },
              rules: { type: 'array', items: { type: 'string' } },
            },
          },
          action_plan: { type: 'array', items: { type: 'string' } },
          kpis: { type: 'array', items: { type: 'string' } },
        },
      },
    });

    return Response.json({
      success: true,
      wallet_id: walletId,
      risk_tolerance: riskTolerance,
      investment_horizon: investmentHorizon,
      strategy: strategy,
    });
  } catch (error) {
    console.error('Generate strategy recommendations error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});