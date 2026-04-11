# Test Coverage Analysis

## Current State: Zero Automated Tests

A full sweep of the repository reveals that **there is currently no automated test coverage of any kind**:

- No `*.test.*`, `*.spec.*`, or `__tests__` files anywhere in the tree
- No test runner in `package.json` dependencies (no Vitest, Jest, Mocha, Playwright, Cypress, or Testing Library)
- No `test` script in `package.json` (`scripts` contains only `dev`, `build`, `lint`, `lint:fix`, `typecheck`, `preview`)
- No `vitest.config.*`, `jest.config.*`, or similar runner configuration files
- No `.github/workflows` — nothing enforces tests on CI
- The only guardrails today are ESLint (`lint`) and the TypeScript checker (`typecheck`)

This is particularly concerning because the codebase contains a substantial amount of security-critical and money-handling logic that currently ships with **zero verification** beyond manual QA.

## Risk-Ranked Modules That Need Tests Most Urgently

The priorities below are driven by blast radius: what happens if these modules silently regress? For anything touching payments, entitlements, auth, or state machines, the answer is "users get free assets," "attackers bypass guards," or "real money moves to the wrong account."

### Priority 0 — Money, Entitlements, Anti-Exploit (critical)

These are the modules where a single regression can cause direct financial loss or economy inflation. They contain pure logic that is easy to unit-test.

| Module | File | Why it is critical |
|---|---|---|
| Order state machine | `src/lib/orderStateMachine.js` | Enforces which state transitions are legal (`pending → paid` etc). An unchecked edit could allow a `pending → paid` jump that skips verification. |
| Payment guards | `src/lib/paymentGuards.js` | `enforcePaymentGate` is the last line of defense before asset delivery. Needs tests for every reject branch. |
| Asset grant system | `src/lib/assetGrant.js` | Grants Jade/NFT/Card/Currency. Must be tested for asset/txn mismatch, wrong asset_type, price under-payment. |
| Economy verification | `src/lib/economyVerification.js` | The full 5-step verify→pay→grant pipeline. Needs tests for amount mismatch, invalid statuses, `detectInconsistencies` flagging. |
| Jade drop system | `src/lib/jadeDropSystem.js` | Server-side RNG and hard cap (50kg). Needs statistical tests that tier probabilities stay inside bounds and that no drop exceeds the legendary cap. |
| Jade drop guards | `src/lib/jadeDropGuards.js` | Anti-reroll, anti-bonus-stacking, rate-limit window, anomaly detection. All contain in-memory maps that must be exercised. |
| Jade economy monitor | `src/lib/jadeEconomyMonitor.js` | Adjusts drop probabilities if supply grows. Needs tests that probabilities sum to ~1.0 and never go negative after adjustment. |
| Webhook validator | `src/lib/webhookValidator.js` | HMAC signature checking, replay protection, timestamp window. This is security-critical and has a small, deterministic surface. |

### Priority 1 — Auth, RBAC, PII (high)

| Module | File | Why |
|---|---|---|
| RBAC permissions | `src/lib/rbac.js` | `hasPermission`, `hasAllPermissions`, `hasAnyPermission`, role-expiration check, fallback to default role. Every branch needs coverage — a wrong `||`/`&&` here opens admin endpoints. |
| Encryption | `src/lib/encryption.js` | AES-256-GCM round-trip for PII. Needs tests for encrypt→decrypt equivalence, tamper detection (bad auth tag), null/empty handling. |
| Auth context | `src/lib/AuthContext.jsx` | Gate for the whole app. Needs tests around loading → authenticated → signed-out transitions. |
| Rate-limited auth function | `base44/functions/rateLimitAuth/entry.ts` | Currently uses an in-memory `Map` with login/signup/reset windows. Off-by-one errors here mean either lockouts for legit users or wide-open brute-forcing. |

### Priority 2 — Backend business logic (medium/high)

The `base44/functions/**/entry.ts` files are Deno request handlers. They are pure-ish (most logic is synchronous arithmetic over SDK results) and well-suited to integration tests with a mocked `base44` client.

| Function | Focus of tests |
|---|---|
| `calculatePortfolioRebalance/entry.ts` | Delta math, buy/sell classification, priority bucketing, zero-value edge case, unknown tokens. |
| `calculateRebalancing/entry.ts` | Target-vs-current deviation, threshold fallback (`target * 0.9 / 1.1`), suppression when portfolio is balanced. |
| `assessPortfolioRisk/entry.ts` | Concentration/stablecoin percentage math, auth short-circuit, empty-holdings branch. (Mock the LLM call.) |
| `detectWalletSuspiciousActivity/entry.ts` | 50% balance change in <1h trigger, multi-chain detection, stablecoin heuristic. These are pure heuristics and trivially testable. |
| `deleteMyData/entry.ts` | Must cascade orders → transactions → assets → audit logs → user. Needs tests that each step is attempted and a failure in one step doesn't leave orphan data. |
| `checkPriceAlerts/entry.ts` | Threshold crossing logic. |
| `globalSearch/entry.ts` | Per-connector failure isolation (one broken connector must not poison the aggregate result). SOQL/query-string injection via the `query` parameter is a real risk that should be tested. |

### Priority 3 — Hooks and client utilities (medium)

| Module | File | Why |
|---|---|---|
| `useWallet` | `src/hooks/useWallet.js` | `accountsChanged` / `chainChanged` event wiring, status transitions, `shortAddress` formatting, `networkName` mapping. Needs a mocked `window.ethereum`. |
| `useRealPrices`, `useCryptoPrices`, `useFeatureTracking` | `src/hooks/*.js` | Polling intervals, error paths, cleanup on unmount. |
| `app-params` | `src/lib/app-params.js` | URL→storage→default precedence is easy to regress; also handles `clear_access_token`. Pure function, easy to test. |
| `economyApi` | `src/lib/economyApi.js` | `deductGold` insufficient-balance branch, `awardXP` level calculation (`floor(xp/100)+1`), escrow refund on cancel. |
| `telegramConnector` | `src/lib/telegramConnector.js` | Linking-token generation and verification state transitions. |

### Priority 4 — UI components (lower urgency, higher effort)

Pages are large (`src/pages/*.jsx` totals ~9700 lines) and mostly call into the modules above. A smart-test strategy here is:

1. Test the critical **UI gates** (not every page): `RoleGate`, `MFAVerification`, `BiometricAuth`, `UserNotRegisteredError`, `PageNotFound`, `AlertManager`.
2. Write a few **integration/smoke tests** with React Testing Library that render `Layout` + a protected page and assert the RBAC fallback behaves correctly.
3. Defer per-page coverage until the business-logic suite above is in place.

## Cross-Cutting Gaps

- **No contract tests for the Base44 SDK boundary.** Every module imports `base44` from `@/api/base44Client` and assumes a particular entity API shape. A thin mock factory (`createMockBase44({ entities: {...} })`) is a prerequisite for testing most of the Priority-0/1/2 work and would pay for itself many times over.
- **No property-based tests for the Jade RNG.** `generateJadeDrop` is a stochastic function and deserves a fast-check / jsverify style test asserting invariants over thousands of draws: `amount_kg ∈ [3.5, 50]`, tier⇔amount consistency, total-probability sanity.
- **No replay/idempotency tests.** `webhookValidator.PROCESSED_WEBHOOKS` is an in-memory `Set` — tests should lock down the exact semantics so that a future swap to Redis doesn't silently regress replay protection.
- **No audit-log assertions.** Most critical operations write to `EconomyAuditLog` / `SecurityAuditLog`. Tests should assert the log write happens on both success and failure paths; today nothing verifies the audit trail can't be bypassed.
- **No negative tests for state transitions.** `validateStateTransition` has a clear matrix — it should have an exhaustive table test that enumerates every `(from, to)` pair and asserts allow/deny.
- **No fuzzing of external-input surfaces.** `globalSearch` interpolates the user-supplied `query` into SOQL and GraphQL strings (see `searchSalesforce`, `searchLinear`). Even if the connectors sanitize their side, the client should have tests covering quote-escaping and query shape.

## Recommended Tooling

Minimal, Vite-native setup that fits the existing stack:

1. **Vitest** as the runner (zero-config with Vite, JSX out of the box).
2. **@testing-library/react** + **@testing-library/jest-dom** for the handful of component tests.
3. **fast-check** for property-based tests of `jadeDropSystem` and `orderStateMachine`.
4. **happy-dom** or **jsdom** as the DOM environment (happy-dom is faster).
5. A `src/test/mocks/base44.js` factory that stubs `base44.entities.*`, `base44.auth.*`, and `base44.asServiceRole.*` so Priority-0/1/2 modules can be tested without a live backend.
6. A `test` + `test:coverage` script in `package.json` and a `.github/workflows/test.yml` that runs `npm run lint && npm run typecheck && npm run test` on every PR.

## Suggested Coverage Targets (Phase 1)

Phase 1 is narrowly scoped and concrete — it is deliverable without touching any UI code:

| Target | File(s) | Minimum coverage goal |
|---|---|---|
| Order state machine | `src/lib/orderStateMachine.js` | 100% branch coverage (small file, exhaustive matrix). |
| Payment guards | `src/lib/paymentGuards.js` | 100% of reject branches. |
| Asset grant | `src/lib/assetGrant.js` | 100% of mismatch paths per asset type. |
| Economy verification | `src/lib/economyVerification.js` | ≥90% — every `logEconomyAction` failure branch. |
| Webhook validator | `src/lib/webhookValidator.js` | 100% — signature, timestamp, replay, provider. |
| Jade drop system + guards | `src/lib/jadeDropSystem.js`, `src/lib/jadeDropGuards.js` | ≥95%, plus property-based invariants. |
| Jade economy monitor | `src/lib/jadeEconomyMonitor.js` | ≥90% (probability-sum invariants). |
| RBAC | `src/lib/rbac.js` | 100% of permission-check branches. |
| Encryption | `src/lib/encryption.js` | 100% (round-trip + tamper detection). |
| App params | `src/lib/app-params.js` | ≥90%. |

Phase 2 expands into the `base44/functions/**/entry.ts` handlers (Priority 2) using the `base44` mock factory.

Phase 3 layers in component/integration tests for the Priority-1 UI gates and a handful of smoke tests for the highest-traffic pages.

## Bottom Line

The codebase ships real money and entitlement logic with **no automated safety net**. Before adding any new features in the Jade / payment / RBAC surfaces, the team should stand up Vitest, wire a CI check, and land the Phase 1 unit suite above. That is a few days of focused work and closes the single largest source of regression risk in the repo.
