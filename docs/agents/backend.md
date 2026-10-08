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
