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
 *   { transactionId: string, paymentRef: string, expectedTon: number }
 *
 * Returns:
 *   { ok: true, verified: true, txHash } on success
 *   { ok: true, verified: false, reason } if no matching tx found yet
 *   { ok: false, error } on hard error
 */

const TON_RECEIVING_ADDRESS = 'UQA9AY1w8JZ0RZSqz8vqptMDl0JjD6k0nTxsCcLfK-6heY2-';
const TONCENTER_API_BASE = 'https://toncenter.com/api/v2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { transactionId, paymentRef, expectedTon } = await req.json();
    if (!transactionId || !paymentRef || !expectedTon) {
      return Response.json({ ok: false, error: 'Missing transactionId, paymentRef, or expectedTon' }, { status: 400 });
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

    // Mark the Transaction as verified. Service-role allowed since payment
    // verification is system-level (user already authenticated above).
    const tonAmount = matched.value / 1e9;
    await base44.asServiceRole.entities.Transaction.update(transactionId, {
      status: 'verified',
      amount: tonAmount,
      verified_at: new Date().toISOString(),
      verified_by: 'ton_chain_verifier',
      metadata: {
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
    try {
      const tx = await base44.asServiceRole.entities.Transaction.get(transactionId);
      if (tx?.buyer_email) {
        await base44.functions.invoke('sendPurchaseReceipt', {
          to: tx.buyer_email,
          orderNumber: tx.order_id || transactionId,
          productTitle: tx.asset_id || 'Bazar Purchase',
          amountUsd: tx.expected_amount,
          amountPaid: tonAmount,
          currency: 'TON',
          txHash: matched.hash,
          paymentRef,
        });
      }
    } catch (mailErr) {
      console.warn('Receipt email failed (non-fatal):', mailErr?.message);
    }

    return Response.json({ ok: true, verified: true, txHash: matched.hash });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});