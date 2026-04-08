# BULLETPROOF ECONOMY & TRANSACTION VERIFICATION LAYER

## Core Principle

**NO ASSET, CURRENCY, JADE, NFT, ITEM, OR REWARD CAN BE GRANTED WITHOUT A VERIFIED PAYMENT OR SYSTEM-APPROVED TRANSACTION.**

---

## 1. Hard Transaction Gate (Mandatory)

### The Correct Flow

Every purchase must follow these exact steps:

#### STEP 1: Create Order
```javascript
const order = await createOrder(
  buyerEmail,
  assetType,      // "jade" | "nft" | "card" | "item" | "collectible" | "currency"
  assetId,
  price,
  paymentMethod,  // "stripe" | "crypto" | "wallet" | "bank_transfer"
  currency        // "GOLD" or other
);

// Status: "pending"
// Price locked at time of order
```

#### STEP 2: Submit Payment
```javascript
await submitPayment(
  orderId,
  externalPaymentId,  // From Stripe / wallet / provider
  paymentProvider
);

// Status: "pending_payment"
// Waiting for payment confirmation
```

#### STEP 3: Verify Payment
```javascript
await verifyPayment(orderId, {
  payment_id: stripePaymentId,
  amount: 1000,
  status: "succeeded",              // MUST be: succeeded|confirmed|completed
  signature_verified: true,         // Webhook signature validated
  webhook_timestamp: 1702000000,
});

// Status: "pending_verification"
// Verification checks:
// ✓ paymentId matches order
// ✓ amount matches base_price exactly
// ✓ payment status is confirmed
// ✓ webhook signature is valid
```

#### STEP 4: Mark as Paid
```javascript
await markOrderAsPaid(orderId);

// Status: "paid"
// All verifications passed
```

#### STEP 5: Grant Asset
```javascript
const result = await grantAssetSafely(orderId, async (order) => {
  // Enforce payment gate — throws if not paid+verified
  if (order.asset_type === "jade") {
    return await grantJade(order.buyer_email, order.asset_id, order.id);
  }
  // ... handle other asset types
});

// Asset is NOW delivered
// Status: "paid" + asset_granted_at set
```

---

## 2. Order State Machine (Strict)

Valid states and transitions:

```
pending
  ├→ pending_payment (user submitted payment)
  │  ├→ pending_verification (payment received from provider)
  │  │  ├→ paid (verification passed) → [ASSET DELIVERY]
  │  │  └→ failed (verification failed)
  │  └→ failed (payment rejected)
  └→ failed (validation error)

paid → refunded (only valid terminal transition)

failed, refunded = terminal states (no further transitions)
```

### Invalid States (Blocked)
❌ `completed_without_payment`
❌ `free_purchase`
❌ `instant_grant`
❌ `user_assumed_paid`

### Invalid Transitions (Blocked)
❌ `pending → paid` (skips verification)
❌ `pending_payment → paid` (skips verification)
❌ Any jump to a terminal state without proper preceding states

---

## 3. Zero Trust Economy Rule

**The frontend is display-only.**

### Frontend CAN:
- Show order status
- Display price
- Render purchase button
- Show payment form

### Frontend CANNOT:
- Modify user balance directly
- Grant items directly
- Trigger rewards
- Simulate purchases
- Update order status without backend

### Backend MUST:
- Verify ALL economy actions
- Process ALL asset grants
- Validate ALL payments
- Log ALL transactions
- Enforce ALL gates

---

## 4. Webhook Authentication Layer

### Requirements

All payment provider webhooks must pass:

1. **Signature Verification**
   ```javascript
   const signature = crypto
     .createHmac('sha256', webhookSecret)
     .update(rawBody)
     .digest('hex');
   
   if (signature !== providedSignature) {
     // Reject webhook
   }
   ```

2. **Timestamp Validation**
   ```javascript
   const diff = Math.abs(now - webhookTimestamp);
   if (diff > 300) { // 5 minutes
     // Reject (replay attack)
   }
   ```

3. **Idempotency Key Check**
   ```javascript
   if (processedWebhooks.has(idempotencyKey)) {
     // Duplicate webhook — reject
   }
   ```

4. **Provider Validation**
   - Webhook must originate from trusted provider domain
   - Signature must match provider's secret

### Webhook Rejection
If ANY validation fails:
- ❌ Ignore webhook completely
- ❌ Do NOT update order status
- ❌ Do NOT grant asset
- ✅ Log rejection for admin review

---

## 5. Payment Verification Checks

Before marking order as paid, verify:

| Check | Rule | Fail Action |
|-------|------|-------------|
| Payment ID | Must exist in provider | Reject order |
| Amount | Must match base_price exactly | Reject order |
| Status | Must be "succeeded"/"confirmed" | Reject order |
| Currency | Must match order currency | Reject order |
| Signature | Must be valid from provider | Reject order |
| Timestamp | Must be within 5 minutes | Reject order (replay) |

---

## 6. Fail-Safe: Block on Uncertainty

**If ANY inconsistency is detected:**
- ❌ Do NOT grant asset
- ✅ Freeze order for manual review
- ✅ Log inconsistency with details
- ✅ Alert admin

### Inconsistencies Detected:
- Paid without verification
- Asset granted without payment record
- Amount mismatch (paid < price)
- Duplicate idempotency keys
- Invalid state transitions
- Missing webhook signature

---

## 7. Economy Audit Log (Immutable)

Every action is logged:

```javascript
{
  action: "asset_granted" | "payment_verified" | "payment_rejected" | ...,
  order_id: "ORD-xxx",
  user_email: "user@example.com",
  asset_type: "jade",
  asset_id: "jade-123",
  amount: 1000,
  status: "success" | "failed" | "blocked",
  triggered_by: "webhook" | "user_action" | "admin" | "system",
  timestamp: ISO string,
  metadata: { ... }
}
```

Logs are:
- ✅ Append-only
- ✅ Immutable (no updates/deletes)
- ✅ Admin-viewable only
- ✅ Tamper-evident

---

## 8. Implementation: Asset Grant Functions

### Safe Grant Pattern

```javascript
async function grantAsset(orderId, assetType, assetId) {
  // Enforcement happens here — throws if any condition fails
  const result = await grantAssetSafely(orderId, async (order) => {
    // At this point:
    // ✓ Order exists
    // ✓ Order status === "paid"
    // ✓ Payment is verified
    // ✓ Amount matches
    
    // NOW safe to grant
    switch (assetType) {
      case "jade":
        return await grantJade(order.buyer_email, assetId, orderId);
      case "nft":
        return await grantNFT(order.buyer_email, assetId, orderId);
      case "card":
        return await grantCard(order.buyer_email, assetId, orderId);
      // ...
    }
  });

  return result; // Granted successfully
}
```

### What Happens If Payment Not Verified

```javascript
await grantAssetSafely(orderId, async (order) => {
  // If order.status !== "paid" or order.verification_status !== "verified"
  // This throws BEFORE grantFunction is called:
  // ❌ ASSET GATE: Cannot grant asset. Order status: pending_verification...
});
```

---

## 9. Admin Override (Logged)

For exceptional cases only:

```javascript
await adminOverride(orderId, "Manual review - customer dispute resolved");
```

- ✅ Requires admin role
- ✅ Reason is mandatory
- ✅ Logged in audit trail
- ✅ Triggers manual asset delivery

---

## 10. Testing Checklist

### Test 1: Normal Purchase Flow
```javascript
✓ Create order → pending
✓ Submit payment → pending_payment
✓ Verify payment → pending_verification → paid
✓ Grant asset → success
```

### Test 2: Insufficient Payment
```javascript
✓ Create order for 1000 GOLD
✓ Submit payment of 500 GOLD
✓ Verification fails (amount mismatch)
✓ Order status = failed
✓ Asset NOT granted
```

### Test 3: Skipped Verification
```javascript
✓ Try to grant asset with order status = pending_payment
✓ Fails: ❌ ASSET GATE: Cannot grant asset
```

### Test 4: Invalid State Transition
```javascript
✓ Try to transition: pending → paid (skip pending_payment)
✓ Fails: ❌ INVALID TRANSITION
```

### Test 5: Webhook Replay Attack
```javascript
✓ Send same webhook twice with same idempotencyKey
✓ First succeeds, order marked paid
✓ Second rejected: "Webhook already processed"
✓ Asset granted only once
```

### Test 6: Invalid Signature
```javascript
✓ Send webhook with tampered signature
✓ Fails: ❌ Webhook signature could not be verified
✓ Asset NOT granted
```

---

## 11. Integration Points

Add payment gate to ALL purchase flows:

- [ ] NFT Marketplace (NFTs page)
- [ ] Item Shop (Collectables/Shop)
- [ ] Jade Market (JadeAtelier)
- [ ] Card Purchases (CardArena)
- [ ] Storefront Hub (external markets)
- [ ] Creature Breeding (if purchasable)
- [ ] Currency Top-ups
- [ ] Reward Claims
- [ ] Battle Rewards
- [ ] Seasonal Passes

---

## 12. Security Best Practices

### DO:
✅ Always verify payment amount exactly
✅ Always check webhook signature
✅ Always log to immutable audit
✅ Always fail-safe (block on doubt)
✅ Always validate state transitions
✅ Always check order existence first

### DON'T:
❌ Trust frontend state
❌ Assume payment success without provider confirmation
❌ Grant assets client-side
❌ Skip verification steps
❌ Allow invalid state transitions
❌ Process webhooks without signature validation
❌ Ignore inconsistencies (fail-safe instead)

---

## 13. Error Messages (User-Facing)

| Scenario | User Message | Action |
|----------|--------------|--------|
| Payment failed | "Payment could not be processed. Please try again." | Show retry button |
| Verification timeout | "Payment is being verified. Check back in a few minutes." | Set reminder |
| Insufficient amount | "Payment amount is less than item price." | Show required amount |
| Order not found | "Order could not be found. Contact support." | Show support link |
| Asset grant failed | "Your payment was confirmed, but asset delivery failed. Support has been notified." | Create support ticket |

---

## Final Rule

> **The system must NEVER assume payment success, trust frontend state, auto-grant rewards, or simulate transactions.**
> 
> **The system must ALWAYS verify before granting, reject on uncertainty, log every financial action, and treat economy as real-value infrastructure.**