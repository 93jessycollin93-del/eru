import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SYMBOL_TO_COINGECKO_ID = {
  ETH: 'ethereum',
  WETH: 'weth',
  BTC: 'bitcoin',
  WBTC: 'wrapped-bitcoin',
  USDC: 'usd-coin',
  USDT: 'tether',
  DAI: 'dai',
  MATIC: 'matic-network',
  POL: 'matic-network',
  SOL: 'solana',
  LINK: 'chainlink',
  UNI: 'uniswap',
  AAVE: 'aave',
  ARB: 'arbitrum',
  OP: 'optimism',
  AVAX: 'avalanche-2'
};

function mapSymbolToId(symbol) {
  return SYMBOL_TO_COINGECKO_ID[String(symbol || '').toUpperCase()] || null;
}

async function sendTelegramMessage(chatId, text) {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!token || !chatId) return { success: false, reason: 'missing telegram configuration' };

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { success: false, reason: errorText };
  }

  return { success: true };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const alerts = await base44.entities.PriceAlert.filter({
      created_by: user.email,
      is_active: true,
    }, '-updated_date', 100);

    if (!alerts?.length) {
      return Response.json({ checked: 0, triggered: [] });
    }

    const symbolIds = [...new Set(alerts.map((alert) => mapSymbolToId(alert.asset_symbol)).filter(Boolean))];
    if (!symbolIds.length) {
      return Response.json({ checked: alerts.length, triggered: [], unsupported: alerts.map((alert) => alert.asset_symbol) });
    }

    const priceResponse = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${symbolIds.join(',')}&vs_currencies=usd&include_24hr_change=true`
    );
    const priceData = await priceResponse.json();

    const telegramAccounts = await base44.entities.TelegramAccount.filter({
      user_email: user.email,
      status: 'active',
      is_verified: true,
      notifications_enabled: true,
    }, '-updated_date', 5);
    const telegramAccount = telegramAccounts?.[0] || null;

    const triggered = [];

    for (const alert of alerts) {
      const coinId = mapSymbolToId(alert.asset_symbol);
      if (!coinId || !priceData[coinId]) continue;

      const currentPrice = Number(priceData[coinId].usd || 0);
      const currentChange = Number(priceData[coinId].usd_24h_change || 0);
      const triggerBasis = alert.trigger_basis || 'price';

      let shouldTrigger = false;
      if (triggerBasis === 'percent_change') {
        shouldTrigger = alert.alert_type === 'above'
          ? currentChange >= Number(alert.percent_change || 0)
          : currentChange <= Number(alert.percent_change || 0);
      } else {
        shouldTrigger = alert.alert_type === 'above'
          ? currentPrice >= Number(alert.threshold_price || 0)
          : currentPrice <= Number(alert.threshold_price || 0);
      }

      if (!shouldTrigger || alert.notification_sent) {
        await base44.entities.PriceAlert.update(alert.id, {
          last_price_usd: currentPrice,
          last_percent_change: currentChange,
        });
        continue;
      }

      const title = `${alert.asset_symbol} alert triggered`;
      const message = triggerBasis === 'percent_change'
        ? `${alert.asset_symbol} moved ${currentChange.toFixed(2)}% in 24h, crossing your ${alert.alert_type} ${Number(alert.percent_change || 0).toFixed(2)}% threshold.`
        : `${alert.asset_symbol} is at $${currentPrice.toLocaleString()}, crossing your ${alert.alert_type} $${Number(alert.threshold_price || 0).toLocaleString()} threshold.`;

      if (alert.push_notification_enabled !== false) {
        await base44.entities.AlertNotification.create({
          user_email: user.email,
          alert_type: 'transaction_alert',
          title,
          message,
          data: {
            alert_id: alert.id,
            asset_symbol: alert.asset_symbol,
            current_price: currentPrice,
            current_percent_change: currentChange,
            threshold_price: alert.threshold_price,
            threshold_percent_change: alert.percent_change,
            trigger_basis: triggerBasis,
          },
          is_read: false,
          sent_via: 'in_app',
          severity: 'info',
        });
      }

      let telegramDelivered = false;
      if (alert.telegram_notification_enabled && telegramAccount?.telegram_user_id) {
        const telegramResult = await sendTelegramMessage(
          telegramAccount.telegram_user_id,
          `🔔 <b>${title}</b>\n${message}`
        );
        telegramDelivered = telegramResult.success;

        if (telegramDelivered) {
          await base44.entities.TelegramAccount.update(telegramAccount.id, {
            last_notified_at: new Date().toISOString(),
          });
        }
      }

      await base44.entities.PriceAlert.update(alert.id, {
        notification_sent: true,
        triggered_at: new Date().toISOString(),
        push_notification_status: alert.push_notification_enabled === false ? 'disabled' : 'sent',
        last_price_usd: currentPrice,
        last_percent_change: currentChange,
      });

      triggered.push({
        alert_id: alert.id,
        asset_symbol: alert.asset_symbol,
        current_price: currentPrice,
        current_percent_change: currentChange,
        threshold_price: alert.threshold_price,
        threshold_percent_change: alert.percent_change,
        alert_type: alert.alert_type,
        trigger_basis: triggerBasis,
        telegram_sent: telegramDelivered,
      });
    }

    return Response.json({
      checked: alerts.length,
      triggered,
      message: `Checked ${alerts.length} alerts. ${triggered.length} triggered.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});