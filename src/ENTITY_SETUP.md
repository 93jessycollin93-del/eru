# Base44 Entity Setup — required for Community & Bot Lab

Base44's sync deleted the entity definitions that were added via git (it owns the
entity registry). The **pages are live but show a "being set up" placeholder**
until these entities exist. Create each one in the **Base44 Builder → Data /
Entities → New entity**, with the fields and access (RLS) below. Field names must
match exactly (the code depends on them).

For every entity below, set access to: **create/update/delete = creator only**,
**read = creator OR records where `is_public` is true** (this makes a public feed
that only the author can edit). In Base44's RLS this is the same `$or` pattern
`JadeAsset` uses with `is_listed`.

---

## 1. CommunityPost
| Field | Type | Notes |
|---|---|---|
| `body` | text | required, max 2000 |
| `post_type` | text/enum | one of: text, jade, card, nft, note, prompt, portfolio, link (default `text`) |
| `ref_id` | text | optional — id of a shared asset |
| `ref_label` | text | optional — display snapshot |
| `guild_id` | text | optional |
| `is_public` | boolean | default `true` |

## 2. CommunityPostComment
| Field | Type | Notes |
|---|---|---|
| `post_id` | text | required |
| `body` | text | required, max 1000 |
| `is_public` | boolean | default `true` |

## 3. CommunityPostReaction
| Field | Type | Notes |
|---|---|---|
| `post_id` | text | required |
| `reaction` | text/enum | one of: like, love, celebrate, insightful (default `like`) |
| `is_public` | boolean | default `true` |

## 4. SimBot  (Bot Lab — simulation only)
| Field | Type | Notes |
|---|---|---|
| `name` | text | required |
| `strategy` | text/enum | hodl, dca, sma_momentum, mean_reversion, rebalance |
| `asset_symbol` | text | required (BTC/ETH/SOL/TON) |
| `start_balance` | number | default 5 |
| `horizon_days` | number | default 90 |
| `seed` | number | |
| `config` | object | strategy params |
| `equity_curve` | array of number | |
| `final_value` | number | |
| `return_pct` | number | |
| `max_drawdown_pct` | number | |
| `trade_count` | number | default 0 |
| `is_public` | boolean | default `false` |

## 5. RateLimitCounter  (auth throttling — optional but recommended)
| Field | Type | Notes |
|---|---|---|
| `key` | text | `<action>:<identifier>` |
| `action` | text/enum | login, signup, passwordReset |
| `count` | number | default 0 |
| `reset_time` | number | epoch ms |

Access: this one is written only by the `rateLimitAuth` backend function
(service role), so creator-only RLS is fine.

---

## Also: re-lock the JadeAsset economy (security)

Base44's sync reverted the `JadeAsset` **create** rule back to "creator only,"
which re-opens direct minting from the browser. The UI is safe (it goes through
the `mintMonolithJade` backend function), but to close the loophole at the data
layer, in the Builder set **`JadeAsset` → create** to a rule no normal user can
satisfy (e.g. require `created_by` to equal a system value like
`system@eru.internal`). The backend function uses the service role, so it still
works; direct client `JadeAsset.create()` calls get rejected. Leave read/update/
delete as creator-scoped.

---

Once each entity exists, its page lights up automatically — no code change
needed (the guards detect the entity and switch from "being set up" to live).
