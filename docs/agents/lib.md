# Lib map

Folder: `src/lib/`.

↑ [AGENTS.md](../../AGENTS.md) · who uses these → [features.md](features.md) · UI → [components.md](components.md)

Shared logic, clients, engines and guards. Every module in `src/lib/` appears exactly once
below. Modules marked **unused** have no importer in app code; check before you rely on them
or delete them.

## App plumbing

| Module | Purpose |
|---|---|
| `src/lib/AuthContext.jsx` | `AuthProvider` / `useAuth`: session, user, public settings, login redirect |
| `src/lib/query-client.js` | shared React Query client |
| `src/lib/utils.js` | `cn()` class merge, `isIframe` |
| `src/lib/logger.js` | build-aware logger |
| `src/lib/metadataCache.js` | localStorage cache with max age (`getCachedOrFetch`) |
| `src/lib/safeUrl.js` | validates external or user URLs before rendering |
| `src/lib/PageNotFound.jsx` | 404 page |
| `src/lib/translations.json` | all i18n strings, all locales ([frontend.md](frontend.md#i18n)) |
| `src/lib/TRANSLATIONS_README.md` | i18n how-to |

## Access, privacy & security ([security.md](security.md))

| Module | Purpose |
|---|---|
| `src/lib/permissions.js` | role and permission helpers for UI gating |
| `src/lib/rbac.js` | permission definitions |
| `src/lib/privacy.js` | masking for emails and secrets (`maskEmail`, `maskSecret`, `displayEmail`) |
| `src/lib/secretAreaPin.js` | salted SHA-256 PIN for the secret area and vault |
| `src/lib/secureSlice.js` | secure-slice operational status (`/admin/secure-slice`) |
| `src/lib/securityChecks.js` | security readiness checks (`/admin/security`) |
| `src/lib/securityTestRunner.js` | simulated permission-attack suite (`/admin/security-test`) |
| `src/lib/auditEvents.js` | audit event helper |
| `src/lib/codeScanner.js` | on-device malware-pattern scanner used by App Review (`/review`); tests in `scripts/__tests__/code-scanner.test.mjs` |
| `src/lib/encryption.js` | client stub; **every export throws**. Encryption belongs on a server (the `encryptUserPII` server call, not connected) |
| `src/lib/webhookValidator.js` | client stub; **always invalid**. Validation belongs on a server (the `validatePaymentWebhook` server call, not connected) |

## Economy, payments & commerce

| Module | Purpose |
|---|---|
| `src/lib/economyApi.js` | central economy API used by cards, guilds and the arena |
| `src/lib/paymentGuards.js` | payment verification guards (imported for side effects in `src/App.jsx`) |
| `src/lib/assetGrant.js` | asset grant system (imported for side effects in `src/App.jsx`) |
| `src/lib/economyVerification.js` | "bulletproof" verification engine. **Unused** |
| `src/lib/orderStateMachine.js` | strict order state machine |
| `src/lib/escrowStateMachine.js` | escrow status metadata and steps |
| `src/lib/marketplaceValidation.js` | marketplace listing validation |
| `src/lib/tonConfig.js`, `src/lib/tonPayment.js` | TON mainnet payment config and helpers |
| `src/lib/collectorRewards.js` | collector reward profile sync |
| `src/lib/zeroFakeData.js` | truth policy layer for every price shown |
| `src/lib/jadeRefresh.js` | Jade refresh system (Jade Atelier) |
| `src/lib/jadeDropSystem.js`, `src/lib/jadeDropGuards.js`, `src/lib/jadeEconomyMonitor.js` | Jade drop system, guards and monitor. **Unused** (spec: `src/JADE_ECONOMY_DROP.md`) |

## Card game

| Module | Purpose |
|---|---|
| `src/lib/cardCatalog.js` | global card library data |
| `src/lib/cardLeveling.js` | card leveling |
| `src/lib/cardLore.js` | narrative layer for cards |
| `src/lib/dailyQuests.js` | daily quest engine |
| `src/lib/forgeRecipes.js` | forge recipes |
| `src/lib/transmutation.js` | transmutation |
| `src/lib/guildSystem.js` | guild / faction system |

## AI, bots & models

| Module | Purpose |
|---|---|
| `src/lib/localModelProviders.js` | one client for local LLM servers (Ollama, LM Studio, Bionic, Off-Grid-AI, PocketPal) |
| `src/lib/ollama.js` | HTTP client for a user-configured Ollama host |
| `src/lib/botStudioStore.js` | data layer for the Offline AI Studio (uses `offlineDb.js`) |
| `src/lib/offlineDb.js` | IndexedDB cache and write queue |
| `src/lib/connectivity.js` | device capability and online-state hooks |
| `src/lib/jackyClient.ts` | the fleet's link to the `jacky` Flask engine (shared across repos) |
| `src/lib/jackyBootstrap.js` | wires `jackyClient` to this app (calls the `jackyProxy` server function, not connected) |
| `src/lib/jackieMemoryRetrieval.js` | picks relevant memory facts for Jackie chat |
| `src/lib/devLab.js` | Jackie Dev Lab plan, task and patch templates |
| `src/lib/simEngine.js` | trading-bot simulation engine (no real money) |
| `src/lib/eruSwarm.js`, `src/lib/eruSwarmValidator.js` | ERU swarm orchestrator and event validator (`/eru-swarm-test`, `scripts/runEruSwarmTests.mjs`) |
| `src/lib/eruRedteam.js`, `src/lib/eruRedteamValidator.js` | simulated red-team swarm and validator (`/eru-redteam-test`) |

## Integrations & modules

| Module | Purpose |
|---|---|
| `src/lib/integrationRegistry.js` | single source of truth for external providers |
| `src/lib/integrationEnv.js` | environment detection for the registry |
| `src/lib/externalPortals.js` | owner-configurable external portal registry |
| `src/lib/telegramConnector.js` | Telegram connector |
| `src/lib/appStoreModules.js` | App Store optional module catalog |

## Media & sound

| Module | Purpose |
|---|---|
| `src/lib/mediaLibrary.js` | data layer for the media library (tracks, playlists) |
| `src/lib/mediaConverter.js` | client config for the media converter service ([services.md](services.md)) |
| `src/lib/playlistIO.js` | playlist import/export parsing (no backend calls) |
| `src/lib/audioEngine.js` | two-deck Howler wrapper (gapless, crossfade) |
| `src/lib/soundEngine.js` | synthesized UI sounds (Web Audio) |

## Portfolio, export, theme, compression

| Module | Purpose |
|---|---|
| `src/lib/portfolioRebalance.js` | combines wallet, Jade, cards and transactions into portfolio data |
| `src/lib/pdfExporter.js` | PDF export |
| `src/lib/themeEngine.js` | theme targets, default variables, background styles |
| `src/lib/compression/ecps-codec.js` | ECPS codec (Entropy-Compressed Pod Seed). **Unused** (related spec: `docs/SEED_v1_SPEC.md`) |
