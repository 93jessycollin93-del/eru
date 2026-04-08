# PAYMENT VERIFICATION RULES

## Core Rule
**NO ITEM, CURRENCY, JADE, NFT, OR ASSET CAN BE GRANTED WITHOUT A VERIFIED TRANSACTION ID**

## Correct Flow

```
1. User clicks "Buy" button
   ↓
2. Create pending Transaction (status: "pending_payment")
   - Order ID generated
   - Asset type/ID recorded
   - Price stored
   ↓
3. Process payment (wallet, card, etc)
   ↓
4. Payment confirmed by system
   - Update Transaction: status = "pending_verification"
   - Store payment proof (hash, receipt)
   ↓
5. Verify payment amount matches expected price
   - IF payment.amount < item.price → REJECT
   - IF payment.amount >= item.price → VERIFY
   ↓
6. Mark Transaction as verified
   - status = "verified"
   - verified_at = timestamp
   - verified_by = "system"
   ↓
7. ONLY NOW: Grant asset to user
   - Enforce payment gate before any transfer
   - Log transaction completion
```

## Invalid Flows (BLOCKED)

❌ **Bad Flow 1**: Direct asset grant without payment
```javascript
// WRONG - This will fail:
await grantJade(userId, jadeId, null, price); // No transaction = blocked
```

❌ **Bad Flow 2**: Item granted, then payment optional
```javascript
// WRONG - This will fail:
await grantNFT(userId, nftId, transactionId, price);
// if transaction.status !== "verified" → BLOCKED
```

❌ **Bad Flow 3**: Payment less than price
```javascript
// WRONG - This will fail:
if (paidAmount < expectedPrice) {
  // Reject order, do NOT grant asset
  await failTransaction(transactionId, "Insufficient payment");
}
```

❌ **Bad Flow 4**: Missing/unverified payment
```javascript
// WRONG - This will fail:
if (payment missing OR payment.status !== "verified") {
  // Set status = "pending_payment"
  // Block asset delivery
}
```

## Implementation Rules

### Rule 1: Payment Gate (Hard Enforce)
```javascript
// Before EVERY asset grant, enforce this:
const txn = await enforcePaymentGate(transactionId, expectedPrice);
// Throws if:
// - Transaction missing
// - status !== "verified"
// - amount < expectedPrice
```

### Rule 2: Amount Validation
```javascript
if (paidAmount < expectedPrice) {
  await failTransaction(txnId, "Insufficient payment");
  return { success: false, reason: "Payment too low" };
}
```

### Rule 3: Status Verification
```javascript
// Only allow delivery if:
if (transaction.status === "verified") {
  // NOW grant asset
  await grantAsset(...);
} else {
  // BLOCK delivery
  throw new Error(`Transaction status ${status} — must be "verified"`);
}
```

### Rule 4: Asset Matching
```javascript
// Verify transaction is for THIS asset:
if (txn.asset_id !== assetId || txn.asset_type !== expectedType) {
  throw new Error("ASSET MISMATCH");
}
```

## Usage Examples

### Example 1: Buying a Jade
```javascript
import { createPendingTransaction, verifyTransaction, grantJade } from '@/lib/paymentGuards';
import { grantJade } from '@/lib/assetGrant';

// Step 1: User clicks Buy
const txnId = await createPendingTransaction({
  orderId: uuid(),
  assetType: 'jade',
  assetId: jade.id,
  buyerEmail: user.email,
  expectedPrice: jade.price,
  currency: 'GOLD',
  paymentMethod: 'wallet_balance',
});

// Step 2: Process payment (deduct from wallet, etc)
// Step 3: Payment confirmed
await markPendingVerification(txnId, paidAmount);

// Step 4: Verify payment
await verifyTransaction(txnId, { proof: 'wallet_hash_123' });

// Step 5: NOW grant asset (this enforces payment gate)
const result = await grantJade(user.email, jade.id, txnId, jade.price);
```

### Example 2: Buying an NFT with validation
```javascript
import { verifyPaymentBeforeGrant } from '@/lib/paymentGuards';

// Check payment before grant (without throwing)
const check = await verifyPaymentBeforeGrant(orderId, paidAmount, nft.price);

if (!check.allowed) {
  // BLOCK delivery
  console.error(check.reason);
  return { success: false, reason: check.reason };
}

// ONLY if allowed:
await grantNFT(user.email, nft.id, check.transactionId, nft.price);
```

### Example 3: Bulk purchase with per-item validation
```javascript
for (const item of shoppingCart) {
  try {
    await enforcePaymentGate(item.transactionId, item.price);
    await grantCollectible(user.email, item.id, item.transactionId, item.price);
  } catch (err) {
    console.error(`Failed to grant ${item.id}:`, err.message);
    // Continue with next item or fail entire purchase
  }
}
```

## Database Fields (Transaction Entity)

- `order_id`: Unique order identifier
- `status`: "pending_payment" | "pending_verification" | "verified" | "failed"
- `amount`: Amount actually paid
- `expected_amount`: Listed price
- `asset_type`: "jade" | "nft" | "card" | "item" | "collectible" | "currency"
- `asset_id`: ID of the asset being purchased
- `buyer_email`: Who is buying
- `seller_email`: Who is selling (null for system sales)
- `verified_at`: ISO timestamp when verified
- `failure_reason`: Why transaction failed (if status = "failed")
- `metadata`: Payment proof (hash, receipt, etc)

## Integration Points

Add payment gate enforcement to:
- ✅ NFT marketplace (NFTs page)
- ✅ Item shop (Collectables/Shop pages)
- ✅ Jade market (JadeAtelier)
- ✅ Card purchases (CardArena)
- ✅ Storefront hub (external marketplaces)
- ✅ Creature breeding (if purchasable)
- ✅ Currency top-ups
- ✅ Any "Buy" or "Claim" button

## Testing

```javascript
// Test 1: Should block if no transaction
try {
  await grantJade(user, jade.id, null, 100); // Should throw
} catch (err) {
  console.assert(err.message.includes("PAYMENT GATE BLOCKED"));
}

// Test 2: Should block if payment too low
const txnId = await createPendingTransaction({...});
await markPendingVerification(txnId, 50); // Only paid 50
// Verify with expected price 100
const check = await verifyPaymentBeforeGrant(orderId, 50, 100);
console.assert(!check.allowed); // Should be false

// Test 3: Should allow if verified
await verifyTransaction(txnId, {proof: 'hash'});
const result = await grantJade(user, jade.id, txnId, 100);
console.assert(result.success);
``