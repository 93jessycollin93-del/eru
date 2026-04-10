import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Calculate portfolio rebalancing suggestions
 * Triggered by scheduled automation or manual request
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { userEmail } = body;

    if (!userEmail) {
      return Response.json({ error: 'Missing userEmail' }, { status: 400 });
    }

    // Fetch user's weightings
    const weightings = await base44.asServiceRole.entities.PortfolioWeighting.filter(
      { user_email: userEmail, is_active: true },
      null,
      100
    );

    if (!weightings || weightings.length === 0) {
      return Response.json({ message: 'No active weightings for user' });
    }

    // Fetch user's orders to calculate current holdings
    const orders = await base44.asServiceRole.entities.Order.filter(
      { buyer_email: userEmail, status: 'paid' },
      '-created_date',
      1000
    );

    if (!orders || orders.length === 0) {
      return Response.json({ message: 'No orders for user' });
    }

    // Calculate current portfolio composition by asset
    const portfolio = {};
    let totalValue = 0;

    orders.forEach((order) => {
      const symbol = order.asset_type?.toUpperCase() || 'UNKNOWN';
      if (!portfolio[symbol]) {
        portfolio[symbol] = 0;
      }
      portfolio[symbol] += order.amount_paid || 0;
      totalValue += order.amount_paid || 0;
    });

    if (totalValue === 0) {
      return Response.json({ message: 'Portfolio value is zero' });
    }

    // Calculate current percentages
    const currentPercentages = {};
    Object.keys(portfolio).forEach((symbol) => {
      currentPercentages[symbol] = (portfolio[symbol] / totalValue) * 100;
    });

    // Compare against weightings and generate actions
    const actions = [];
    let totalDeviation = 0;
    const triggeredAssets = [];

    for (const weighting of weightings) {
      const current = currentPercentages[weighting.asset_symbol] || 0;
      const target = weighting.target_percentage;
      const minThresh = weighting.min_threshold || target * 0.9;
      const maxThresh = weighting.max_threshold || target * 1.1;

      // Update current percentage in weighting
      await base44.asServiceRole.entities.PortfolioWeighting.update(weighting.id, {
        current_percentage: current,
        last_calculated: new Date().toISOString(),
      });

      const deviation = Math.abs(current - target);
      totalDeviation += deviation;

      let action = 'hold';
      if (current < minThresh) {
        action = 'buy';
        triggeredAssets.push(weighting.asset_symbol);
      } else if (current > maxThresh) {
        action = 'sell';
        triggeredAssets.push(weighting.asset_symbol);
      }

      actions.push({
        asset: weighting.asset_symbol,
        current_percentage: parseFloat(current.toFixed(2)),
        target_percentage: target,
        action,
        percentage_change: parseFloat((current - target).toFixed(2)),
      });
    }

    // Determine priority
    let priority = 'low';
    if (totalDeviation > 15) priority = 'high';
    else if (totalDeviation > 8) priority = 'medium';

    // Only create suggestion if there are actions needed
    if (triggeredAssets.length > 0 || totalDeviation > 5) {
      const suggestion = await base44.asServiceRole.entities.RebalancingSuggestion.create({
        user_email: userEmail,
        status: 'pending',
        actions,
        total_deviation: parseFloat(totalDeviation.toFixed(2)),
        priority,
        triggered_by_assets: triggeredAssets,
      });

      // Log event
      await base44.asServiceRole.entities.AuditLog.create({
        user_email: userEmail,
        action_type: 'wallet',
        action: 'rebalancing_suggestion_generated',
        detail: `Generated rebalancing suggestion with priority ${priority}`,
        severity: priority === 'high' ? 'warning' : 'info',
        status: 'success',
      });

      return Response.json({
        success: true,
        suggestion_id: suggestion.id,
        actions,
        total_deviation: parseFloat(totalDeviation.toFixed(2)),
        priority,
      });
    }

    return Response.json({
      success: true,
      message: 'Portfolio is balanced',
      current_percentages: currentPercentages,
    });
  } catch (error) {
    console.error('Rebalancing calculation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});