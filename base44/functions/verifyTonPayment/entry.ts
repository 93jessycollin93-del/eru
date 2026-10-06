import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * verifyTonPayment
 * ------------------------------------------------------------------
 * Looks up recent inbound transactions on the receiving TON wallet
 * via toncenter, finds one matching the given payment reference
 * (embedded in the transfer comment) AND a sufficient TON amount,
 * then marks the matching Transaction record as `verified`.
 *
 * Payload:
 *   { transactionId: string, paymentRef: string }
 *   (expectedTon may still be sent but is ignored; the amount is derived
 *   from the stored Transaction.)
 *
 * The caller must be the buyer (or an admin), the transaction must not be
 * verified already, and an on-chain transfer can only ever verify one
 * Transaction.
 *
 * Returns:
 *   { ok: true, verified: true, txHash } on success
 *   { ok: true, verified: false, reason } if no matching tx found yet
 *   { ok: false, error } on hard error
 */

const TON_RECEIVING_ADDRESS = 'UQA9AY1w8JZ0RZSqz8vqptMDl0JjD6k0nTxsCcLfK-6heY2-';
const TONCENTER_API_BASE = 'https://toncenter.com/api/v2';
// Must match FALLBACK_TON_USD in src/lib/tonConfig.js (the price the checkout UI quotes).
const FALLBACK_TON_USD = 5.5;
// Format produced by generateTonPaymentRef() in src/lib/tonPayment.js.
const PAYMENT_REF_RE = /^BZ-[A-HJ-NP-Z2-9]{9}$/;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    // expectedTon is still accepted for compatibility but no longer trusted:
    // a caller-chosen amount let anyone "verify" a purchase with a dust transfer.
    const { transactionId, paymentRef } = await req.json();
    if (!transactionId || !paymentRef) {
      return Response.json({ ok: false, error: 'Missing transactionId or paymentRef' }, { status: 400 });
    }
    if (!PAYMENT_REF_RE.test(String(paymentRef).trim())) {
      return Response.json({ ok: false, error: 'Malformed paymentRef' }, { status: 400 });
    }

    const tx = await base44.asServiceRole.entities.Transaction.get(transactionId).catch(() => null);
    if (!tx) return Response.json({ ok: false, error: 'Transaction not found' }, { status: 404 });
    const isAdmin = user.role === 'admin';
    if (!isAdmin && String(tx.buyer_email || '').toLowerCase() !== String(user.email || '').toLowerCase()) {
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }
    if (tx.status === 'verified') {
      return Response.json({ ok: true, verified: true, txHash: tx.metadata?.tx_hash, alreadyVerified: true });
    }
    if (tx.status === 'failed' || tx.status === 'cancelled') {
      return Response.json({ ok: false, error: `Transaction is ${tx.status}` }, { status: 409 });
    }
    if (tx.metadata?.payment_ref && tx.metadata.payment_ref !== String(paymentRef).trim()) {
      return Response.json({ ok: false, error: 'paymentRef does not match this transaction' }, { status: 409 });
    }

    // Price the transfer from the stored record (same formula the checkout UI
    // uses), never from the request.
    const expectedTon = Number((Number(tx.expected_amount || 0) / FALLBACK_TON_USD).toFixed(4));
    if (!(expectedTon > 0)) {
      return Response.json({ ok: false, error: 'Transaction has no expected amount' }, { status: 409 });
    }

    // Fetch last ~30 inbound transactions on the receiving wallet.
    const url = `${TONCENTER_API_BASE}/getTransactions?address=${encodeURIComponent(TON_RECEIVING_ADDRESS)}&limit=30`;
    const tonRes = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!tonRes.ok) {
      return Response.json({ ok: false, error: `Toncenter responded ${tonRes.status}` }, { status: 502 });
    }
    const tonData = await tonRes.json();
    if (!tonData?.ok) {
      return Response.json({ ok: false, error: 'Toncenter returned error' }, { status: 502 });
    }

    const expectedNano = Math.round(Number(expectedTon) * 1e9);
    const txs = Array.isArray(tonData.result) ? tonData.result : [];
    const wantedRef = String(paymentRef).trim();

    // Find an inbound transfer whose comment EXACTLY equals our paymentRef and
    // whose value is at least the expected amount. The comment must match
    // exactly (not merely contain the ref): a substring match let an attacker
    // who controlled any wallet pay a tiny amount with a comment that happened
    // to embed a short/guessable ref. Only a hair of float-rounding slack
    // (0.1%) is allowed on the amount — no real underpayment is accepted.
    const minAcceptable = Math.floor(expectedNano * 0.999);
    let matched = null;
    for (const t of txs) {
      const inMsg = t?.in_msg;
      if (!inMsg) continue;
      const value = Number(inMsg.value || 0);
      const comment = String(inMsg.message || '').trim();
      if (value >= minAcceptable && comment === wantedRef) {
        matched = { hash: t.transaction_id?.hash, lt: t.transaction_id?.lt, value, comment };
        break;
      }
    }

    if (!matched) {
      return Response.json({ ok: true, verified: false, reason: 'No matching on-chain transfer found yet. Try again in ~10 seconds.' });
    }

    // The blockchain is public: never let one transfer verify two purchases.
    const priorVerified = await base44.asServiceRole.entities.Transaction.filter(
      { status: 'verified' }, '-verified_at', 1000,
    ).catch(() => null);
    if (!Array.isArray(priorVerified)) {
      return Response.json({ ok: false, error: 'Could not check for reused transfers; try again.' }, { status: 503 });
    }
    if (priorVerified.some((t) => t.id !== transactionId && t.metadata?.tx_hash && t.metadata.tx_hash === matched.hash)) {
      return Response.json({ ok: false, error: 'This transfer was already used for another purchase' }, { status: 409 });
    }

    // Mark the Transaction as verified. Service-role allowed since payment
    // verification is system-level (user already authenticated above).
    const tonAmount = matched.value / 1e9;
    await base44.asServiceRole.entities.Transaction.update(transactionId, {
      status: 'verified',
      amount: tonAmount,
      verified_at: new Date().toISOString(),
      verified_by: 'ton_chain_verifier',
      metadata: {
        ...(tx.metadata || {}),
        chain: 'ton',
        network: 'mainnet',
        tx_hash: matched.hash,
        tx_lt: matched.lt,
        payment_ref: paymentRef,
        comment: matched.comment,
      },
    });

    // Fire-and-forget Gmail receipt. We never let an email failure block
    // the verification response — the on-chain truth is already recorded.
    // The receipt function reads every field from the stored Transaction.
    try {
      if (tx.buyer_email) {
        await base44.functions.invoke('sendPurchaseReceipt', { transactionId });
      }
    } catch (mailErr) {
      console.warn('Receipt email failed (non-fatal):', mailErr?.message);
    }

    return Response.json({ ok: true, verified: true, txHash: matched.hash });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});