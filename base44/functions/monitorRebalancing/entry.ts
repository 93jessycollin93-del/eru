import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Monitor all users' portfolios for rebalancing needs
 * Runs as scheduled automation (daily)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all unique users with active weightings
    const weightings = await base44.asServiceRole.entities.PortfolioWeighting.filter(
      { is_active: true },
      null,
      10000
    );

    if (!weightings || weightings.length === 0) {
      return Response.json({ message: 'No active weightings to monitor' });
    }

    const uniqueUsers = [...new Set(weightings.map((w) => w.user_email))];
    const results = [];

    for (const userEmail of uniqueUsers) {
      try {
        // Call calculateRebalancing for each user
        const response = await base44.asServiceRole.functions.invoke('calculateRebalancing', {
          userEmail,
        });

        if (response.success && response.suggestion_id) {
          results.push({
            user_email: userEmail,
            suggestion_created: response.suggestion_id,
            priority: response.priority,
          });

          // Send notification to user for high priority
          if (response.priority === 'high') {
            try {
              await base44.asServiceRole.entities.AlertNotification.create({
                user_email: userEmail,
                alert_type: 'portfolio_threshold',
                title: 'Portfolio Rebalancing Recommended',
                message: `Your portfolio has drifted ${response.total_deviation.toFixed(1)}% from targets. Review rebalancing suggestions.`,
                severity: 'warning',
                sent_via: 'in_app',
                data: {
                  total_deviation: response.total_deviation,
                  triggered_assets: response.actions
                    .filter((a) => a.action !== 'hold')
                    .map((a) => a.asset),
                },
              });
            } catch (err) {
              console.log('Failed to create alert:', err.message);
            }
          }
        }
      } catch (err) {
        console.log(`Error calculating rebalancing for ${userEmail}:`, err.message);
      }
    }

    return Response.json({
      success: true,
      users_checked: uniqueUsers.length,
      suggestions_created: results.length,
      results,
    });
  } catch (error) {
    console.error('Rebalancing monitoring error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});