import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all active alerts for this user
    const alerts = await base44.entities.PriceAlert.filter({
      created_by: user.email,
      is_active: true,
    });

    if (!alerts || alerts.length === 0) {
      return Response.json({ checked: 0, triggered: [] });
    }

    // Fetch current prices from CoinGecko
    const symbols = [...new Set(alerts.map(a => a.asset_symbol))];
    const priceMap = {};

    for (const symbol of symbols) {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${symbol.toLowerCase()}&vs_currencies=usd`
      );
      const data = await response.json();
      const key = Object.keys(data)[0];
      if (key && data[key]?.usd) {
        priceMap[symbol] = data[key].usd;
      }
    }

    const triggered = [];

    // Check each alert against current prices
    for (const alert of alerts) {
      const currentPrice = priceMap[alert.asset_symbol];
      if (!currentPrice) continue;

      let shouldTrigger = false;
      if (alert.alert_type === 'above' && currentPrice >= alert.threshold_price) {
        shouldTrigger = true;
      } else if (alert.alert_type === 'below' && currentPrice <= alert.threshold_price) {
        shouldTrigger = true;
      }

      if (shouldTrigger && !alert.notification_sent) {
        triggered.push({
          alert_id: alert.id,
          asset_symbol: alert.asset_symbol,
          current_price: currentPrice,
          threshold_price: alert.threshold_price,
          alert_type: alert.alert_type,
        });

        // Mark notification as sent
        await base44.entities.PriceAlert.update(alert.id, {
          notification_sent: true,
          triggered_at: new Date().toISOString(),
        });
      }
    }

    return Response.json({
      checked: alerts.length,
      triggered: triggered,
      message: `Checked ${alerts.length} alerts. ${triggered.length} triggered.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});