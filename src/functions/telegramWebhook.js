import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
/* global Deno */

function parseSyncPayload(text) {
  const raw = text.replace('/sync', '').trim();
  if (!raw) return [];
  return raw.split('\n').map((line, index) => {
    const parts = line.split('|').map((item) => item.trim());
    return {
      name: parts[0] || `Telegram NFT ${index + 1}`,
      collection: parts[1] || 'Telegram Import',
      token_id: parts[2] || '',
      image_url: parts[3] || '',
      network: parts[4] || 'TON',
      external_id: `${parts[1] || 'telegram'}-${parts[2] || parts[0] || index + 1}`,
      metadata: {
        raw_line: line
      }
    };
  }).filter((item) => item.name);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const message = body.message || body.edited_message;
    const text = message?.text || '';

    if (!text.startsWith('/link') && !text.startsWith('/sync')) {
      return Response.json({ ok: true, ignored: true });
    }

    const telegramUserId = String(message?.from?.id || '');
    const telegramUsername = message?.from?.username || '';
    const telegramDisplayName = [message?.from?.first_name, message?.from?.last_name].filter(Boolean).join(' ').trim();

    if (text.startsWith('/link')) {
      const code = text.replace('/link', '').trim().toUpperCase();
      if (!code) {
        return Response.json({ ok: true, message: 'Missing link code' });
      }

      const matches = await base44.asServiceRole.entities.TelegramAccount.filter({ link_code: code }, '-updated_date', 1);
      const account = matches?.[0];
      if (!account) {
        return Response.json({ ok: true, message: 'Invalid link code' });
      }

      await base44.asServiceRole.entities.TelegramAccount.update(account.id, {
        telegram_user_id: telegramUserId,
        telegram_username: telegramUsername,
        telegram_display_name: telegramDisplayName,
        link_status: 'linked',
        linked_at: new Date().toISOString()
      });

      return Response.json({ ok: true, linked: true });
    }

    if (text.startsWith('/sync')) {
      const accounts = await base44.asServiceRole.entities.TelegramAccount.filter({ telegram_user_id: telegramUserId }, '-updated_date', 1);
      const account = accounts?.[0];
      if (!account?.user_email) {
        return Response.json({ ok: true, message: 'Account not linked' });
      }

      const payload = parseSyncPayload(text);
      if (!payload.length) {
        return Response.json({ ok: true, message: 'No NFT payload found' });
      }

      const existing = await base44.asServiceRole.entities.NFT.filter({ owner_email: account.user_email }, '-updated_date', 500);
      const existingIds = new Set((existing || []).map((item) => item.external_id).filter(Boolean));
      const fresh = payload
        .filter((item) => !existingIds.has(item.external_id))
        .map((item) => ({
          owner_email: account.user_email,
          source: 'telegram',
          source_message_id: String(message?.message_id || ''),
          name: item.name,
          collection: item.collection,
          image_url: item.image_url,
          network: item.network,
          token_id: item.token_id,
          external_id: item.external_id,
          metadata: item.metadata,
          imported_at: new Date().toISOString()
        }));

      if (fresh.length) {
        await base44.asServiceRole.entities.NFT.bulkCreate(fresh);
      }

      await base44.asServiceRole.entities.TelegramAccount.update(account.id, {
        last_sync_at: new Date().toISOString(),
        last_sync_source: 'telegram_command'
      });

      return Response.json({ ok: true, imported: fresh.length });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});