import { createClientFromRequest } from 'npm:@base44/sdk@0.8.30';

/**
 * mintMonolithJade
 * ------------------------------------------------------------------
 * Authoritative, server-side Monolith jade extraction.
 *
 * This replaces the previous client-side flow in JTAMonolith.jsx, where the
 * browser rolled the jade stats AND called JadeAsset.create() directly — which
 * let any user mint arbitrary jade (with attacker-chosen stats) for free via
 * devtools. The roll now happens here, the asset is created with the service
 * role (so JadeAsset's create RLS can block direct client writes), and the
 * JadeTransaction ledger row is written by the server with the fixed price.
 *
 * Payment gate: when an `orderId` is supplied it must be a `paid` Order owned
 * by the caller before any jade is minted. Enforcement can additionally be made
 * mandatory by setting MONOLITH_REQUIRE_PAYMENT=true once a charge flow is wired
 * into the UI.
 *
 * Payload: { orderId?: string }
 * Returns: { ok: true, jade } | { ok: false, error }
 */

const CHUNK_PRICE_USD = 20.0;
const SECTORS = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Theta', 'Omega'];
const COLORS = ['imperial_green', 'lavender', 'ice', 'russet', 'black'];

const snap5 = (val) => Math.round(val / 5) * 5;

function rollJade() {
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const sector = SECTORS[Math.floor(Math.random() * SECTORS.length)];
  const depth = Math.floor(Math.random() * 100);
  const volume = parseFloat((Math.random() * 199 + 1).toFixed(2)); // 1–200 kg
  return {
    batch: 'batch_1',
    origin_sector: sector,
    origin_depth: depth,
    extraction_date: new Date().toISOString(),
    volume_kg: volume,
    color_type: color,
    purity: snap5(Math.max(5, Math.floor(Math.random() * 100))),
    vividness: snap5(Math.max(5, Math.floor(Math.random() * 100))),
    size_grade: snap5(Math.max(5, Math.min(100, Math.floor(volume / 2)))),
    texture: snap5(Math.max(5, Math.floor(Math.random() * 100))),
    composite_score: 0,
    lifecycle_state: 'raw',
    crafted_form: 'raw_block',
    resonance_history: [],
    ownership_timeline: [],
    jade_coins_minted: 0,
    fracture_count: 0,
    is_listed: false,
    is_masterwork: false,
    card_attachments: [],
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.email) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { orderId } = await req.json().catch(() => ({}));

    // Payment gate. Mandatory when MONOLITH_REQUIRE_PAYMENT is truthy; otherwise
    // only enforced when the caller passes an orderId.
    const requirePayment = String(Deno.env.get('MONOLITH_REQUIRE_PAYMENT') || '').toLowerCase() === 'true';
    if (requirePayment && !orderId) {
      return Response.json({ ok: false, error: 'Payment required: missing orderId' }, { status: 402 });
    }
    if (orderId) {
      const orders = await base44.asServiceRole.entities.Order.filter(
        { id: orderId, buyer_email: user.email, status: 'paid' }, '-created_date', 1
      );
      if (!orders || orders.length === 0) {
        return Response.json({ ok: false, error: 'No verified payment found for this order' }, { status: 402 });
      }
      // Prevent reusing one paid order for multiple mints.
      if (orders[0].asset_grant_reference) {
        return Response.json({ ok: false, error: 'Order already fulfilled' }, { status: 409 });
      }
    }

    const preview = rollJade();
    const composite = Math.round((preview.purity + preview.vividness + preview.size_grade + preview.texture) / 4);

    const jade = await base44.asServiceRole.entities.JadeAsset.create({
      ...preview,
      created_by: user.email, // preserve ownership for read RLS
      composite_score: composite,
      ownership_timeline: [{ owner: user.email, acquired_at: new Date().toISOString() }],
      resonance_history: [{
        event_type: 'extraction',
        description: `Extracted from Monolith Sector ${preview.origin_sector} at depth ${preview.origin_depth}`,
        timestamp: new Date().toISOString(),
        actor: 'system',
        metadata: { volume_kg: preview.volume_kg, color_type: preview.color_type },
      }],
    });

    await base44.asServiceRole.entities.JadeTransaction.create({
      jade_asset_id: jade.id,
      transaction_type: 'extraction',
      price_usd: CHUNK_PRICE_USD,
      buyer_email: user.email,
      order_id: orderId || null,
      notes: `Monolith extraction — ${preview.color_type} from Sector ${preview.origin_sector}`,
    });

    // Grant the one bonus card, authoritatively, server-side.
    await base44.asServiceRole.entities.User.update(user.id, {
      bonus_cards: (user.bonus_cards || 0) + 1,
    });

    if (orderId) {
      await base44.asServiceRole.entities.Order.update(orderId, {
        asset_granted_at: new Date().toISOString(),
        asset_grant_reference: jade.id,
      });
    }

    return Response.json({ ok: true, jade });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});
