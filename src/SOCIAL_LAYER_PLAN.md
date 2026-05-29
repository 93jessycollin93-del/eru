# Social Layer — Architecture & Phasing Plan

This is the durable plan for Eru's social platform. It exists so every piece we
add plugs into the same foundation, stays isolated, and never slows the core app.
Build order is strict: finish and validate each phase before starting the next.

## Guiding principles

1. **One phase at a time.** Ship and test a phase before opening the next. This
   is what prevents the half-finished, reverted sprawl we cleaned up.
2. **Isolation = no slowdown.** Every platform is its own lazy-loaded route + its
   own entities. Nothing is bundled into the initial load (route code-splitting
   is already in place). Heavy media (images, video) NEVER lives in app code —
   it lives in storage / CDN / a streaming provider.
3. **Security by default.** Owner-scoped writes (`created_by == user`), public
   reads via an explicit `is_public`/`is_listed` flag, and any value/count/þmoney
   mutation goes through a service-role backend function — never a client-trusted
   counter. (Same discipline as the economy fix and `mintMonolithJade`.)
4. **Reuse before building.** Eru already ships Escrow, Reputation, Messages,
   Marketplace, Storefront, Guilds, and profiles. New features wire these
   together rather than reinventing them.

---

## Phase 1 — Social feed  *(in progress — PR #6)*

The engagement surface and connective tissue for everything else. Cheap, no new
infra.

**Done (PR #6):** `CommunityPost` / `CommunityPostComment` / `CommunityPostReaction`
entities (owner write, public read), `/community` page (composer, feed, like,
comments), counts derived from rows, lazy route + nav entry.

**Remaining to "finish" Phase 1:**
- Harden reaction/comment de-dup + counting behind a `togglePostReaction`
  backend function (service role) so tallies can't be inflated by duplicate rows.
- "Share" post types: let a post reference a jade / card / portfolio / note /
  prompt (`post_type` + `ref_id` + `ref_label` already in the schema) with a rich
  preview card.
- Optional guild-scoped feeds (`guild_id` already in the schema) reusing Guilds.
- Profile view: a user's posts + reputation + collections in one place.

**No new infrastructure or cost.**

---

## Phase 2 — Advertiser Connector  *(the differentiator)*

A two-sided marketplace connecting creators with social-media / influencer
advertising firms — solving the "I can't find advertisers or figure out how it
works" problem. This is the most original and monetizable piece, and it reuses
the most existing plumbing.

**Reuses:** Escrow (safe paid deals), Reputation (trust), Messages (negotiation),
Marketplace/Storefront patterns (listings), profiles.

**New entities (proposed):**
- `AdvertiserProfile` — firm/brand: niche, budget range, platforms, regions,
  verification status.
- `CreatorProfile` — audience size, niches, platforms, rate card, portfolio refs.
- `Campaign` / `Brief` — an advertiser's open opportunity (goal, budget, deliverables, deadline).
- `Proposal` / `Application` — a creator applying to a brief (or an advertiser inviting a creator).
- `Deal` — accepted engagement, with milestones; **payments run through existing Escrow**.

**Core flows:** searchable directory + matching (by niche/budget/audience/platform)
→ brief posting → proposals → messaging → escrow-backed deal → reputation review.

**No major new infra/cost** — this stays within Base44 + existing integrations.

> **Decided:** primary user is **brands/advertisers seeking creators**. First
> screen = post a brief + search creators by niche / audience / platform. Creator
> profiles are the indexed, searchable side; brands drive demand. (Creators can
> still apply to briefs — we just optimize the brand's flow first.)

---

## Phase 3 — Live streaming  *(later; gated on audience + budget)*

YouTube/Twitch/Kick-style live video. The honest reality: real-time video
ingest → transcode → low-latency CDN delivery is **specialized infrastructure**,
not app code. We integrate a provider; we do not build it.

**Candidate providers:** Mux, Cloudflare Stream, AWS IVS, LiveKit, Agora
(evaluate on price, latency, and SDK fit when we get here).

**Split of responsibilities:**
- *Provider-side (paid, usage-based):* ingest, transcoding, recording, CDN
  playback. This is the **only part of the whole vision with unavoidable ongoing
  cost** (per minute streamed / per GB delivered).
- *App-side (cheap, we build):* `StreamChannel` entity, stream metadata,
  scheduling, an embedded player, live **chat + presence** (reuse Messages/feed
  patterns), discovery/browse, and follow/notify.

**Why it's last:** it carries the cost and complexity, and it only makes sense
once Phases 1–2 have an audience worth streaming to. Defer the spend until then.

---

## Cost & infrastructure summary

| Phase | New infra | Ongoing cost |
|------|-----------|--------------|
| 1 — Social feed | none | $0 |
| 2 — Advertiser connector | none | $0 |
| 3 — Live streaming | streaming provider | usage-based (only when live) |

You commit no infra money through Phases 1–2. Real spend begins only at Phase 3,
once the product has proven itself — matching the "I'll pay when it's real" stance.

## Performance guardrails (apply to every phase)

- Each platform = a separate `React.lazy` route; never merged into one mega-page.
- Each platform = its own entities; no overloading shared tables.
- Media via storage/CDN/streaming provider, never imported into the bundle.
- Lists are paginated/capped; counts derived from rows or maintained server-side.
- Re-check the build's chunk sizes after each phase so the initial load stays small.
