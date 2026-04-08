# BALANCED JADE ECONOMY DROP SYSTEM

## Overview

A stable, scalable, and exploit-proof Jade reward system designed for smooth progression, rare excitement, and long-term economic balance.

---

## 1. Distribution Breakdown

### Base Tier (60%)
- **Range**: 3.5kg – 6kg
- **Weight**: Toward 4.5kg center
- **Purpose**: Stable progression + consistent user reward
- **Experience**: Reliable drops that feel good

### Mid Tier (35%)
- **Range**: 6kg – 25kg
- **Weight**: Curve toward lower values (~10kg more common)
- **Purpose**: Progression spikes + engagement variation
- **Experience**: Occasional boosts that feel earned

### Jackpot System (5% Total)

#### High Rare (4.5%)
- **Range**: 25kg – 30kg
- **Purpose**: Rare excitement events
- **Experience**: "Wow!" moments

#### Legendary (0.5%)
- **Range**: 30kg – 50kg (hard capped)
- **Purpose**: Ultra-rare high-value moments
- **Experience**: Life-changing rewards (maybe once per 200 pulls)

---

## 2. Core Economy Rules

### Mandatory
✅ All rewards generated **server-side only**
✅ No fixed reward values (ranges only)
✅ No UI-based or client-side reward calculation
✅ Every pull resolves into exactly one tier
✅ Every pull creates exactly one Jade asset
✅ Each asset tied to verified payment order

### Forbidden
❌ Client-side reward generation
❌ Rerolling failed jackpots
❌ Combining multiple pulls into higher tier
❌ Defaulting to maximum range values
❌ Inflating rewards due to missing data

---

## 3. Anti-Exploit Guards

### Guard 1: No Rerolling
Once a Jade asset is created for an order, that order can never grant a second Jade.

```javascript
// This will be rejected:
Order #123 → Jade asset #abc → [attempt to claim again]
❌ GUARD: Jade already granted for this order. Rerolling is not allowed.
```

### Guard 2: Rate Limiting
Maximum 1 Jade pull per user per 60 seconds. Prevents sequential burst exploitation.

```javascript
User pulls at T=0s
User pulls at T=10s
❌ GUARD: Too many Jade pulls in short time.
```

### Guard 3: No Default Inflation
If drop data is missing/invalid, **always default to BASE minimum** (3.5kg), never max.

```javascript
// If amount_kg is undefined:
if (!drop.amount_kg) {
  drop.amount_kg = 3.5; // Minimum safe value
}
```

### Guard 4: Hard Caps
No single Jade asset can exceed 50kg, ever.

```javascript
if (drop.amount_kg > 50) {
  drop.amount_kg = 50;
}
```

### Guard 5: Bonus Stacking Prevention
One-time bonuses (daily, seasonal) claimed only once per period per user.

```javascript
preventBonusStacking(userId, "daily")
// Same user claims again same day
❌ GUARD: Daily bonus already claimed today.
```

### Guard 6: Payment Verification
Every Jade pull must have:
- Verified Order (status = "paid")
- Verified Payment (verification_status = "verified")
- Valid webhook signature (if applicable)

### Guard 7: Anomaly Detection
System detects unusual patterns:
- User claiming 3+ legendary drops in 50 total drops
- Sudden 3x spike in reward amounts
- Sequential jackpot attempts

→ Flags for manual admin review instead of blocking

---

## 4. Economy Stability System

### Supply Monitoring
The system continuously tracks total Jade in circulation.

### Dynamic Probability Adjustment
If weekly Jade creation exceeds threshold (100,000kg):
- Shift ±1–2% from Jackpot tiers toward Base/Mid
- Slow down inflation naturally
- Revert when growth normalizes

```
Example:
Growth too high? BASE: 60% → 61.5%, MID: 35% → 36%, LEGENDARY: 0.5% → 0.3%
Growth normal? Reset to 60%, 35%, 0.5%
```

### Admin Override
Administrators can manually trigger economy reset if needed.

---

## 5. Drop Generation Algorithm

### Weighted Distribution
Uses Gaussian approximation to favor values near tier centers:

```javascript
function generateJadeDrop() {
  const roll = Math.random(); // 0.0–1.0
  
  if (roll < 0.60) {
    // BASE: weight toward 4.5kg
    amount = weightedRandom(3.5, 6.0, 0.5);
  } else if (roll < 0.95) {
    // MID: weight toward 10kg
    amount = weightedRandom(6.0, 25.0, 0.35);
  } else if (roll < 0.995) {
    // HIGH_RARE: weight toward 27kg
    amount = weightedRandom(25.0, 30.0, 0.4);
  } else {
    // LEGENDARY: weight toward 35kg, cap at 50kg
    amount = Math.min(50, weightedRandom(30.0, 50.0, 0.3));
  }
  
  return Math.round(amount * 10) / 10; // Round to 0.1kg
}
```

### Precision
Amounts rounded to 0.1kg precision to prevent floating-point exploitation.

---

## 6. Implementation: Safe Drop Execution

### Code Flow

```javascript
async function executeSafeJadeDrop(userId, orderId) {
  // Step 1: Verify payment
  const order = await verifyOrderBeforeGrant(orderId);
  
  // Step 2: Check no reroll
  await preventRerollExploit(orderId);
  
  // Step 3: Rate limit
  preventSequentialExploit(userId);
  
  // Step 4: Generate drop (server-side)
  const drop = generateJadeDrop();
  
  // Step 5: Validate drop data
  validateDropData(drop);
  
  // Step 6: Create Jade asset in database
  const jadeAsset = await base44.entities.JadeAsset.create({
    volume_kg: drop.amount_kg,
    ownership_timeline: [{ owner: userId, ... }],
    resonance_history: [{
      event_type: 'drop_earned',
      metadata: { tier: drop.tier, ... }
    }],
    ...
  });
  
  // Step 7: Verify asset matches drop
  await verifyJadeAssetMatchesDrop(jadeAsset.id, drop);
  
  // Step 8: Check for economic anomalies
  const anomalies = await detectEconomicAnomalies(userId, drop);
  
  // Step 9: Link order to asset
  await base44.entities.Order.update(orderId, {
    asset_granted_at: now,
    asset_grant_reference: jadeAsset.id,
  });
  
  // Step 10: Log to immutable audit
  await base44.entities.EconomyAuditLog.create({
    action: 'asset_granted',
    order_id: orderId,
    user_email: userId,
    asset_id: jadeAsset.id,
    amount: drop.amount_kg,
    metadata: { tier: drop.tier, ... }
  });
  
  return {
    success: true,
    jadeAssetId: jadeAsset.id,
    tier: drop.tier,
    amount_kg: drop.amount_kg,
  };
}
```

---

## 7. User Experience Goals

### What Players Feel
- **Consistent low-mid rewards** (60% of time) → Safe, steady progression
- **Occasional medium boosts** (35% of time) → Engagement spikes every few pulls
- **Rare jackpot events** (5% of time) → Excitement, sharing moments with community
  - Legendary (0.5%): "I can't believe this happened!" (avg 1 per 200 pulls)

### Economy Remains
- ✅ Balanced (no runaway inflation)
- ✅ Non-inflationary (supply growth monitored)
- ✅ Scalable (probabilities adjust with growth)
- ✅ Exploit-resistant (multi-layer guards)

---

## 8. Testing Checklist

### Test 1: Distribution Frequency
```javascript
✓ Run 1000 pulls
✓ Verify ~600 BASE, ~350 MID, ~45 HIGH_RARE, ~5 LEGENDARY
✓ Check all amounts within range
```

### Test 2: Weight Distribution
```javascript
✓ BASE pulls average ~4.3–4.7kg (should favor 4.5kg)
✓ MID pulls average ~9–12kg (should favor lower-mid)
✓ HIGH_RARE pulls average ~26–28kg (should favor lower)
```

### Test 3: Anti-Reroll
```javascript
✓ Create order, pull Jade, asset created
✓ Attempt second pull on same order
✓ Fails: ❌ GUARD: Jade already granted for this order
```

### Test 4: Rate Limit
```javascript
✓ User pulls at T=0s → Success
✓ Same user pulls at T=5s → Blocked
✓ Different user pulls at T=5s → Success
```

### Test 5: Hard Cap
```javascript
✓ Run 10,000 pulls
✓ Verify no Jade asset exceeds 50kg
```

### Test 6: Economy Stability
```javascript
✓ Track total supply over week
✓ If supply grows 100k+ kg, verify probabilities shift
✓ Verify shift favors BASE over LEGENDARY
```

---

## 9. Integration Points

Add safe drop execution to:
- [ ] Activity completion rewards
- [ ] Seasonal event claim buttons
- [ ] Daily bonus claims
- [ ] Marketplace purchase completion
- [ ] Battle/Arena victory rewards
- [ ] Milestone achievements

**Always use `executeSafeJadeDrop(userId, orderId)` — never directly call `generateJadeDrop()` from frontend.**

---

## 10. Admin Monitoring

View economy dashboard:
```javascript
const stats = await getEconomyStats();
// Returns:
// - total_supply_kg
// - total_assets
// - assets_by_tier breakdown
// - current probabilities
// - inflation_factor
```

Manual adjustments:
```javascript
await resetEconomyState(); // Reset to baseline
await checkEconomyHealth(); // Force check now
```

---

## Final Principle

> **The system generates exciting, fair, and balanced rewards without exploitation risk. Every Jade earned is tied to a verified payment, weighted toward player progression, and monitored for economic health.**