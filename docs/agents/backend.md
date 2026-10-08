# Backend map

↑ [AGENTS.md](../../AGENTS.md) · per-feature trails → [features.md](features.md) · security → [security.md](security.md)

**No backend service is connected.** Every data, sign-in, server-function and AI/file call in the app
goes through one file, `src/api/backend.js`, and that file talks to nothing outside the device.
To connect a backend later, change that file only; the call sites stay the same.

## What each call does today

| Call in app code | Result now |
|---|---|
| `import { backend } from '@/api/backend'` | the client (`src/api/backend.js`) |
| `backend.entities.<Name>.list()` / `.filter()` | resolves to `[]` (no records) |
| `backend.entities.<Name>.subscribe(cb)` | returns an unsubscribe function; never fires |
| `backend.entities.<Name>.create / update / delete / bulkCreate / get / …` | rejects with `BackendNotConnectedError` |
| `backend.functions.invoke('<name>', payload)` | rejects with `BackendNotConnectedError` |
| `backend.auth.me()` | rejects with status 401, so the app treats the visitor as signed out |
| `backend.auth.isAuthenticated()` | resolves to `false` |
| `backend.auth.login / register / loginViaEmailPassword / …` | rejects with `BackendNotConnectedError` |
| `backend.auth.logout(url)`, `backend.auth.redirectToLogin()` | local navigation only |
| `backend.integrations.Core.InvokeLLM / UploadFile` | rejects with `BackendNotConnectedError` |
| `backend.connectors.*` | rejects with `BackendNotConnectedError` |

Sign-in state for the whole app: `src/lib/AuthContext.jsx` (`useAuth()`).

## Record types the app uses (135)

Names used as `backend.entities.<Name>` in `src/`. They describe the app's data model; no schema
files exist in the repo.

| Domain | Record types |
|---|---|
| Bot farm | BotFarmActivityHistory, BotFarmBot, BotFarmMaintenanceLog, BotFarmMission, BotFarmOutputLog, BotFarmRiskFlag, BotFarmSquad, BotFarmTask, BotFarmUpgrade |
| Bots (AI Lab, memory, versions, tests) | BotAutomation, BotCollaborationSession, BotDeployment, BotGlobalPolicy, BotImprovement, BotMemory, BotMemoryChunk, BotMemoryProfile, BotPerformanceAlert, BotRating, BotResourceSnapshot, BotSemanticMemory, BotSquad, BotTestCase, BotTestRun, BotTradeProposal, BotVersion, BotVersionComparison, SharedBotWorkspace, UserBot |
| Squads, agents, knowledge | AgentTask, AgentTaskRun, IntegrityReport, KnowledgeBaseDocument, MissionKnowledge, PerformanceMetric, ProgrammingLanguageMemory, PromptTemplate, PromptTemplateComment, PromptTemplateVersion, RiskReport, SharedKnowledgeBase, SquadKnowledge, SquadTemplate |
| Command Center | CommandAlert, CommandBot, CommandCommunication, CommandMission, CommandMissionHistory, CommandRecommendation, CommandTask |
| Telegram | TelegramAccount, TelegramBot, TelegramBotExperiment, TelegramBotExperimentRun, TelegramBotSession, TelegramKnowledgeGap |
| Cards & game | Card, CardBattleHistory, CardListing, CardManualPrice, CardMatchmakingQueue, CardMatchmakingRoom, CardPlayerProfile, CardScanSession, CardTradeProposal, CardUsageHistory, CollectorRewardProfile, Creature, DailyQuest, ExcavationEvent, MasterCard, PinnedCard, PlayerDeck, RealityPressure, SimBot |
| Economy, payments, commerce | BazarProduct, EconomyAuditLog, Escrow, IntegrationTopupOrder, JadeAsset, JadeTransaction, MarketConnector, Order, PricingAuditLog, StorefrontCustomization, StorefrontListing, Transaction |
| Wallets, portfolio, markets | ConnectedWallet, InvestmentJournalEntry, NFT, PortfolioWeighting, PriceAlert, RebalancingSuggestion, WalletHolding |
| Social & collaboration | CommunityPost, CommunityPostComment, CommunityPostReaction, Guild, GuildBankTransaction, GuildMembership, Note, ReferralEvent, ReferralProfile, Reputation, SharedDashboardComment, SharedDashboardSession, SharedDashboardState, SocialStrategyPost, TradeNegotiationChat, TradeNegotiationPost |
| Jackie & Dev Lab | DevAgentTask, DevAuditLog, DevFileReference, DevKnowledgeDoc, DevPatch, DevPlan, DevProject, DevSession, JackieFeedback, JackieSaved |
| Users, roles, security, audit | ApiKey, AppNotification, AuditLog, CustomRole, FeatureAnalytics, RoleAssignment, SecurityAlert, SecurityAuditLog, User |
| Learning, projects, misc. | CustomThemeSetting, Project, StudyModule, Task, UserProgress, WebsiteGeneratorProject |

Also accessed by computed name: `src/lib/botStudioStore.js` (Offline AI Studio records) and
`src/pages/DataPortability.jsx` (export/import).

## Server functions the app calls (44)

Names passed to `backend.functions.invoke()`. None exist anymore; each call fails until a backend
provides it.

| Domain | Functions |
|---|---|
| Telegram | createTelegramStarsInvoice, generateTelegramLinkCode, importTelegramNfts, ingestTelegramBotKnowledge, listTelegramBotDashboard, manageTelegramWebhook, simulateTelegramSwarm, updateTelegramBot |
| Bots, memory, squads, models | adaptBotStrategyFromPerformance, archiveBotMemory, deliverSquadOutput, dispatchBotAutomationAlert, generateBotTrainingInsights, generateSmartRecommendations, indexBotSemanticMemory, invokeExternalModel, jackieCodeEdit, jackyProxy, renderPromptTemplate, retrieveKnowledgeBaseContext, searchBotSemanticMemory, summarizeInactiveBotMemory, syncTrainingToSquadMemory |
| Portfolio, wallets, markets | calculatePortfolioRebalance, checkPriceAlerts, detectWalletSuspiciousActivity, fetchWalletHoldings |
| Economy, payments, storefront | executeJadeDrop, generateListingCopy, mintMonolithJade, runMarketplaceSyndication, validatePaymentWebhook, verifyTonPayment |
| Media | collaborativePlaylist, getSharedPlaylist, listCollaborativePlaylists, listPublicPlaylists |
| Privacy & security | deleteMyData, encryptUserPII |
| Integrations & other | checkEditorPackageUpdates, getIntegrationQuotaStatus, globalSearch, syncGoogleSheet, whatsappSendMessage |

## Recovered definitions (lost from history, still needed)

These record types are used by app code but their definitions were deleted from the repo in June
2026 and never restored. Fields marked `*` are required. Rebuild them on whatever backend replaces
`src/api/backend.js`.

| Record | Fields | Access rule |
|---|---|---|
| RateLimitCounter | key* (`"<action>:<identifier>"`, e.g. `login:user@example.com`), action* (`login`, `signup`, `passwordReset`), count, reset_time | server only |
| CommunityPost | body* (max 2000), post_type (`text`, `jade`, `card`, `nft`, `note`, `prompt`, `portfolio`, `link`), ref_id, ref_label, guild_id, is_public | write: creator; read: creator or `is_public` |
| CommunityPostComment | post_id*, body* (max 1000), is_public | write: creator; read: creator or `is_public` |
| CommunityPostReaction | post_id*, reaction (`like`, `love`, `celebrate`, `insightful`), is_public | write: creator; read: creator or `is_public` |
| SimBot | name*, strategy* (`hodl`, `dca`, `sma_momentum`, `mean_reversion`, `rebalance`), asset_symbol*, start_balance, horizon_days, seed, config, equity_curve, final_value, return_pct, max_drawdown_pct, trade_count, is_public | write: creator; read: creator or `is_public` |
| TelegramConversation | bot_id*, telegram_chat_id*, telegram_user_id, telegram_username, last_user_message, last_bot_reply, message_count, status (`active`, `paused`, `blocked`), last_activity_at | bot owner |
| TelegramMessageLog | bot_id*, conversation_id, direction* (`incoming`, `outgoing`, `system`, `error`), message_text, telegram_message_id, command, error_message, latency_ms, metadata | bot owner |
| TelegramBot (field) | webhook_secret_token: per-bot secret Telegram echoes in `X-Telegram-Bot-Api-Secret-Token` | server only, never sent to the browser |

## Required server-side protections for any future backend

The removed backend had these protections, some of them broken at the end. A replacement must
enforce them on the server, not in the browser:

- **Login brute-force limit:** count attempts per `login:`/`signup:`/`passwordReset:` + identifier
  (RateLimitCounter) and refuse further attempts until `reset_time`.
- **Webhook authenticity:** reject any Telegram webhook call whose secret header doesn't match the
  bot's `webhook_secret_token`, including plain messages, not just payments. Verify WhatsApp,
  Stripe and wallet webhooks by signature.
- **Admin-only actions:** sending WhatsApp messages and templates, role assignment, and
  Telegram knowledge-gap analysis require `role === 'admin'`.
- **Ownership checks:** a user may only change their own bots, listings, orders and records.
- **Value grants:** nothing of value is granted without a verified transaction
  (`src/PAYMENT_VERIFICATION_RULES.md`).
- **Receipts and outgoing email:** build the message from the stored transaction only; never take
  the recipient or content from the request.

