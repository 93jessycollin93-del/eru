import { createClientFromRequest } from 'npm:@base44/sdk@0.8.30';

/**
 * executeJadeDrop
 * ------------------------------------------------------------------
 * Authoritative, server-side jade drop tied to a verified paid Order.
 *
 * The drop logic previously lived in src/lib/jadeDropSystem.js whose header
 * claimed "Server-side only" — but it ran in the browser on the user's auth
 * token, so the payment check could be bypassed and JadeAsset.create() called
 * directly. This function performs the roll and the create with the service
 * role so JadeAsset's create RLS can block direct client writes.
 *
 * Payload: { orderId: string, dropContext?: object }
 * Returns: { ok: true, jadeAssetId, tier, tierLabel, amount_kg } | { ok: false, error }
 */

const TIERS = {
  BASE: { probability: 0.60, min: 3.5, max: 6.0, label: 'Base Drop' },
  MID: { probability: 0.35, min: 6.0, max: 25.0, label: 'Mid Tier' },
  HIGH_RARE: { probability: 0.045, min: 25.0, max: 30.0, label: 'High Rare' },
  LEGENDARY: { probability: 0.005, min: 30.0, max: 50.0, label: 'Legendary' },
};
const LEGENDARY_HARD_CAP = 50.0;

function weightedRandom(min, max, weight = 0.5) {
  const u1 = Math.random();
  const u2 = Math.random();
  const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const normalized = 0.5 + gaussian * 0.15;
  const clipped = Math.max(0, Math.min(1, normalized));
  const position = weight * 0.7 + clipped * 0.3;
  return min + position * (max - min);
}

function generateJadeDrop() {
  const roll = Math.random();
  let tier, amount;
  if (roll < TIERS.BASE.probability) {
    tier = 'BASE';
    amount = weightedRandom(TIERS.BASE.min, TIERS.BASE.max, 0.5);
  } else if (roll < TIERS.BASE.probability + TIERS.MID.probability) {
    tier = 'MID';
    amount = weightedRandom(TIERS.MID.min, TIERS.MID.max, 0.35);
  } else if (roll < TIERS.BASE.probability + TIERS.MID.probability + TIERS.HIGH_RARE.probability) {
    tier = 'HIGH_RARE';
    amount = weightedRandom(TIERS.HIGH_RARE.min, TIERS.HIGH_RARE.max, 0.4);
  } else {
    tier = 'LEGENDARY';
    amount = Math.min(LEGENDARY_HARD_CAP, weightedRandom(TIERS.LEGENDARY.min, TIERS.LEGENDARY.max, 0.3));
  }
  amount = Math.round(amount * 10) / 10;
  if (amount < TIERS.BASE.min) { amount = TIERS.BASE.min; tier = 'BASE'; }
  if (amount > LEGENDARY_HARD_CAP) amount = LEGENDARY_HARD_CAP;
  return { tier, amount_kg: amount, tierLabel: TIERS[tier].label };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.email) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { orderId, dropContext = {} } = await req.json().catch(() => ({}));
    if (!orderId) return Response.json({ ok: false, error: 'Missing orderId' }, { status: 400 });

    // STEP 1: Verify a paid Order owned by the caller exists and is unfulfilled.
    const orders = await base44.asServiceRole.entities.Order.filter(
      { id: orderId, buyer_email: user.email, status: 'paid' }, '-created_date', 1
    );
    if (!orders || orders.length === 0) {
      return Response.json({ ok: false, error: 'No verified payment found for this user' }, { status: 402 });
    }
    if (orders[0].asset_grant_reference) {
      return Response.json({ ok: false, error: 'Order already fulfilled' }, { status: 409 });
    }

    // STEP 2: Server-side roll.
    const drop = generateJadeDrop();

    try {
      // STEP 3: Create the jade asset (service role; created_by preserves ownership).
      const jadeAsset = await base44.asServiceRole.entities.JadeAsset.create({
        created_by: user.email,
        batch: 'batch_1_drops',
        origin_sector: 'drop_system',
        origin_depth: 0,
        extraction_date: new Date().toISOString(),
        volume_kg: drop.amount_kg,
        color_type: 'imperial_green',
        purity: 50 + Math.random() * 30,
        vividness: 50 + Math.random() * 30,
        size_grade: Math.round((drop.amount_kg / 10) * 100),
        texture: 50 + Math.random() * 30,
        composite_score: 60,
        lifecycle_state: 'raw',
        crafted_form: 'raw_block',
        ownership_timeline: [{ owner: user.email, acquired_at: new Date().toISOString() }],
        is_listed: false,
        resonance_history: [{
          event_type: 'drop_earned',
          description: `Jade drop: ${drop.tierLabel}`,
          timestamp: new Date().toISOString(),
          actor: 'system',
          metadata: { drop_tier: drop.tier, amount_kg: drop.amount_kg, order_id: orderId, context: dropContext },
        }],
      });

      // STEP 4: Link to order (also acts as the idempotency marker).
      await base44.asServiceRole.entities.Order.update(orderId, {
        asset_granted_at: new Date().toISOString(),
        asset_grant_reference: jadeAsset.id,
      });

      // STEP 5: Audit log.
      await base44.asServiceRole.entities.EconomyAuditLog.create({
        action: 'asset_granted', order_id: orderId, user_email: user.email,
        asset_type: 'jade', asset_id: jadeAsset.id, amount: drop.amount_kg,
        status: 'success', triggered_by: 'system',
        metadata: { drop_tier: drop.tier, tier_label: drop.tierLabel, context: dropContext },
      });

      return Response.json({ ok: true, jadeAssetId: jadeAsset.id, tier: drop.tier, tierLabel: drop.tierLabel, amount_kg: drop.amount_kg });
    } catch (err) {
      await base44.asServiceRole.entities.EconomyAuditLog.create({
        action: 'asset_failed', order_id: orderId, user_email: user.email,
        asset_type: 'jade', status: 'failed',
        reason: `Failed to create Jade asset: ${err.message}`, triggered_by: 'system',
      }).catch(() => null);
      return Response.json({ ok: false, error: `Jade drop failed: ${err.message}` }, { status: 500 });
    }
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});
