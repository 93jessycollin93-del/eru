import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TELEGRAM_API = 'https://api.telegram.org';
const STARS_CURRENCY = 'XTR';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { orderId, chatId } = body || {};
    if (!orderId || !chatId) {
      return Response.json({ error: 'Missing orderId or chatId' }, { status: 400 });
    }

    const order = await base44.asServiceRole.entities.IntegrationTopupOrder.get(orderId);
    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }
    if (order.user_email !== user.email) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!token) {
      return Response.json({ error: 'Missing TELEGRAM_BOT_TOKEN' }, { status: 500 });
    }

    const starsAmount = Math.max(1, Math.round(Number(order.price_usd || 0) * 100));
    const payload = `integration_topup:${order.id}:${user.id}`;

    const telegramRes = await fetch(`${TELEGRAM_API}/bot${token}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: order.pack_name || 'Extra uses',
        description: `Buy ${Number(order.extra_uses || 0)} extra integration uses`,
        payload,
        currency: STARS_CURRENCY,
        prices: [
          {
            label: order.pack_name || 'Extra uses',
            amount: starsAmount
          }
        ]
      })
    });

    const telegramData = await telegramRes.json();
    if (!telegramRes.ok || !telegramData.ok) {
      return Response.json({ error: telegramData.description || 'Telegram invoice creation failed' }, { status: 502 });
    }

    await base44.asServiceRole.entities.IntegrationTopupOrder.update(order.id, {
      payment_status: 'pending',
      external_payment_id: payload
    });

    return Response.json({ success: true, invoice_url: telegramData.result, stars_amount: starsAmount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});