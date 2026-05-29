# Economy Lockdown — status & remaining migration

This documents the server-side economy hardening: what is now fixed, what to
verify on deploy, and the one remaining migration (currency) that must be done
deliberately because it changes the live data model.

## ✅ Done in this branch — Jade minting moved server-side

**Problem:** the entire jade economy ran in the browser. `JTAMonolith.jsx`
rolled stats client-side and called `JadeAsset.create()` directly, and
`src/lib/jadeDropSystem.js` (despite its "Server-side only" header) ran in the
browser too. Combined with permissive RLS (`create: created_by == user.email`),
any authenticated user could mint unlimited jade with arbitrary stats — for
free — straight from devtools.

**Fix:**
- New backend functions (run with the service role):
  - `base44/functions/mintMonolithJade/entry.ts` — authoritative Monolith roll +
    `JadeAsset`/`JadeTransaction` create + bonus card grant. Optional payment
    gate via `orderId`; make it mandatory with `MONOLITH_REQUIRE_PAYMENT=true`.
  - `base44/functions/executeJadeDrop/entry.ts` — paid-order-gated drop grant.
- `JTAMonolith.jsx` and `jadeDropSystem.js` now invoke those functions instead
  of writing entities directly.
- `JadeAsset` RLS `create` set to `created_by == "system@eru.internal"`, which
  no client create can satisfy (created_by is stamped to the caller). The
  service role bypasses RLS, so the backend functions still work. Read/update/
  delete remain owner-scoped so users keep access to their own jade.

### Verify on deploy (cannot be tested from the dev container)
1. Open the Monolith, roll, confirm → a jade asset is created and **owned by
   you** (appears in your inventory; `created_by` is your email).
2. Try `base44.entities.JadeAsset.create({...})` from the browser console →
   must be **rejected** by RLS.
3. Confirm a `JadeTransaction` row is written with `price_usd: 20` and the
   server-side stats.
4. If you turn on `MONOLITH_REQUIRE_PAYMENT`, confirm minting without a paid
   `orderId` returns HTTP 402.
5. Sanity-check that setting `created_by` on a service-role create is honored by
   your Base44 instance (ownership depends on it). If not, set ownership via a
   dedicated owner field and adjust the read RLS accordingly.

## ⚠️ Remaining — Currency (gold / jadeite / bonus_cards / balance)

**Why it's still open:** these balances live on the **user profile** and are
written with `base44.auth.updateMe({ gold: ... })` in `economyApi.js`,
`BazarStand.jsx`, and `assetGrant.js`. Base44 has **no field-level RLS on
`updateMe`** — a user can always set their own profile fields — so a user can
run `base44.auth.updateMe({ gold: 1e12 })` from the console regardless of UI
logic. This was left unchanged on purpose: a half-finished migration (some code
reading a new Wallet, other code still writing `user.gold`) would desync and
corrupt balances. It must be done in one deliberate, tested pass.

### Migration plan
1. **New `Wallet` entity** — fields: `user_email`, `gold`, `jadeite`,
   `bonus_cards`, `balance`, `updated_date`. RLS: `read` = owner; `create`/
   `update`/`delete` = service-role-only (same sentinel trick as `JadeAsset`,
   e.g. `update: { user_email: "system@eru.internal" }`).
2. **New backend function `walletLedger`** (service role) with operations
   `award` / `deduct` / `transfer`, each doing the balance read, validation
   (no negative balances, server-side amounts), the write, and an
   `EconomyAuditLog` entry. Spend operations should also accept and enforce a
   verified `transactionId` for purchases.
3. **Migrate writers** to call `walletLedger` instead of `updateMe`:
   - `src/lib/economyApi.js` (`awardGold`, `deductGold`, XP, escrow paths)
   - `src/pages/BazarStand.jsx:172,238` (purchase debit/credit)
   - `src/lib/assetGrant.js:101` (`balance` credit)
4. **Migrate readers** off `user.gold` (only ~3 files) to read from `Wallet`.
5. **Backfill**: one-time copy of existing `user.gold`/`jadeite`/`bonus_cards`
   into `Wallet`, then stop writing those fields on the user object.
6. **Test**: confirm `updateMe({ gold })` from the console no longer affects
   spendable balance, purchases debit correctly, and concurrent spends can't
   drive the balance negative.

Until step 6 is complete, treat currency balances as client-trusted (i.e. not
safe for real-money value).
