import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * sendPurchaseReceipt
 * ------------------------------------------------------------------
 * Sends a Gmail receipt to the buyer after a verified crypto purchase.
 * Called server-side from verifyTonPayment (and any future verifier).
 *
 * Payload:
 *   { transactionId: string }
 *
 * Everything in the email (recipient, order, item, amounts, hash) is read
 * from the stored Transaction, never from the request. The caller must be
 * the buyer (or an admin), the transaction must already be verified, and
 * only one receipt is sent per transaction. Without these checks any
 * signed-in user could make the app builder's Gmail send arbitrary HTML to
 * arbitrary addresses.
 *
 * Email is sent from the app builder's Gmail (shared connector) via the
 * gmail.send scope.
 */

const EMAIL_RE = /^[^\s@<>()",;:\\[\]]+@[^\s@<>()",;:\\[\]]+\.[^\s@<>()",;:\\[\]]+$/;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Strip anything that could break out of a single MIME header line. */
function headerSafe(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').slice(0, 200);
}

function utf8ToBase64(str) {
  // Properly encode UTF-8 → base64 (Deno-safe, no deprecated unescape).
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function toBase64Url(b64) {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildMime({ from, to, subject, html }) {
  // RFC 2047 encode the subject so non-ASCII chars survive.
  const encodedSubject = `=?UTF-8?B?${utf8ToBase64(headerSafe(subject))}?=`;
  // HTML body is base64-encoded so UTF-8 content is safe in transit.
  const encodedBody = utf8ToBase64(html);

  const message =
    `From: ${headerSafe(from)}\r\n` +
    `To: ${headerSafe(to)}\r\n` +
    `Subject: ${encodedSubject}\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: text/html; charset=UTF-8\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    encodedBody;

  return toBase64Url(utf8ToBase64(message));
}

function buildReceiptHtml({ orderNumber, productTitle, amountUsd, amountPaid, currency, txHash, paymentRef }) {
  const safeHash = /^[A-Za-z0-9+/=_-]{1,128}$/.test(String(txHash || '')) ? String(txHash) : '';
  const explorerUrl = safeHash ? `https://tonviewer.com/transaction/${encodeURIComponent(safeHash)}` : null;
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;">
    <div style="border-bottom:2px solid #00cc88;padding-bottom:12px;margin-bottom:20px;">
      <h1 style="margin:0;font-size:20px;color:#0a0a0a;">Payment confirmed ✓</h1>
      <p style="margin:6px 0 0;font-size:13px;color:#666;">Your crypto purchase has been verified on-chain.</p>
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:6px 0;color:#666;">Order</td><td style="padding:6px 0;text-align:right;font-family:ui-monospace,monospace;">${escapeHtml(orderNumber)}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Item</td><td style="padding:6px 0;text-align:right;font-weight:600;">${escapeHtml(productTitle)}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Amount</td><td style="padding:6px 0;text-align:right;">$${Number(amountUsd || 0).toFixed(2)} USD</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Paid</td><td style="padding:6px 0;text-align:right;font-family:ui-monospace,monospace;">${Number(amountPaid || 0).toFixed(4)} ${escapeHtml(currency || 'TON')}</td></tr>
      ${paymentRef ? `<tr><td style="padding:6px 0;color:#666;">Reference</td><td style="padding:6px 0;text-align:right;font-family:ui-monospace,monospace;font-size:12px;">${escapeHtml(paymentRef)}</td></tr>` : ''}
      ${safeHash ? `<tr><td style="padding:6px 0;color:#666;">Tx hash</td><td style="padding:6px 0;text-align:right;font-family:ui-monospace,monospace;font-size:11px;word-break:break-all;">${escapeHtml(safeHash)}</td></tr>` : ''}
    </table>

    ${explorerUrl ? `<p style="margin:20px 0 0;"><a href="${explorerUrl}" style="display:inline-block;padding:10px 16px;background:#00cc88;color:#0a0a0a;text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;">View on TON Explorer</a></p>` : ''}

    <p style="margin:24px 0 0;font-size:12px;color:#888;line-height:1.5;">Your rewards are credited to your account automatically. If you didn't make this purchase, please reply to this email immediately.</p>
  </div>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { transactionId } = (await req.json()) || {};
    if (!transactionId || typeof transactionId !== 'string') {
      return Response.json({ ok: false, error: 'Missing transactionId' }, { status: 400 });
    }

    const tx = await base44.asServiceRole.entities.Transaction.get(transactionId).catch(() => null);
    if (!tx) return Response.json({ ok: false, error: 'Transaction not found' }, { status: 404 });

    const isAdmin = user.role === 'admin';
    if (!isAdmin && String(tx.buyer_email || '').toLowerCase() !== String(user.email || '').toLowerCase()) {
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }
    if (tx.status !== 'verified') {
      return Response.json({ ok: false, error: 'Transaction is not verified' }, { status: 409 });
    }
    if (tx.metadata?.receipt_sent_at) {
      return Response.json({ ok: true, alreadySent: true });
    }

    const to = String(tx.buyer_email || '').trim();
    if (!EMAIL_RE.test(to)) {
      return Response.json({ ok: false, error: 'Buyer email is not a valid single address' }, { status: 400 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    // Look up the authorized Gmail account so we can put a valid From header
    // in the MIME message (Gmail API rejects messages without one).
    let fromAddress = 'me';
    try {
      const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        if (profile?.emailAddress) fromAddress = profile.emailAddress;
      }
    } catch (_) { /* fall back to "me" */ }

    const meta = tx.metadata || {};
    const orderNumber = tx.order_id || transactionId;
    const productTitle = tx.asset_id || 'Bazar Purchase';
    const html = buildReceiptHtml({
      orderNumber,
      productTitle,
      amountUsd: tx.expected_amount,
      amountPaid: tx.amount,
      currency: 'TON',
      txHash: meta.tx_hash,
      paymentRef: meta.payment_ref,
    });
    const raw = buildMime({
      from: fromAddress,
      to,
      subject: `Receipt — ${productTitle} (Order ${orderNumber})`,
      html,
    });

    const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!gmailRes.ok) {
      const errText = await gmailRes.text();
      return Response.json({ ok: false, error: `Gmail send failed: ${gmailRes.status} ${errText}` }, { status: 502 });
    }

    const result = await gmailRes.json();
    await base44.asServiceRole.entities.Transaction.update(transactionId, {
      metadata: { ...meta, receipt_sent_at: new Date().toISOString() },
    }).catch(() => null);
    return Response.json({ ok: true, messageId: result.id });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});
