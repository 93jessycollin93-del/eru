# Backend map (QUARANTINED)

Folder: `base44/`.

↑ [AGENTS.md](../../AGENTS.md) · per-feature trails → [features.md](features.md) · security functions → [security.md](security.md)

> **Read-only for agents.** This folder defines the hosted backend the app still runs on.
> Read it to understand data and server behavior. Do not edit it, do not add to it, and do
> not contact the service behind it unless the user explicitly asks ([AGENTS.md](../../AGENTS.md) rule 1).

## How the frontend reaches it

| Call in frontend code | Goes to |
|---|---|
| `import { base44 } from '@/api/base44Client'` | client created in `src/api/base44Client.js` with values from `src/lib/app-params.js` |
| `base44.entities.<Name>.list / filter / create / update / delete` | data model `base44/entities/<Name>.jsonc` |
| `base44.functions.invoke('<name>', payload)` | server function `base44/functions/<name>/entry.ts` (Deno) |
| `base44.auth.*` | login and session (`src/lib/AuthContext.jsx`) |
| `base44.integrations.Core.*` | hosted LLM, upload and email helpers (no file in repo) |
| `base44.asServiceRole.*` | privileged access inside server functions only |

Dev proxy: `/api` → `VITE_BASE44_APP_BASE_URL`, set up by the plugin in `vite.config.js`.

Turned off on purpose (quarantine): the SDK's automatic usage analytics (`src/api/base44Client.js`)
and the plugin's page-view tracker, visual-edit bridge and HMR/navigation notifiers (`vite.config.js`).

## Folder layout

| Path | Contents |
|---|---|
| `base44/config.jsonc` | app name and install/build/serve commands |
| `base44/entities/*.jsonc` | 143 data model schemas (fields + RLS) |
| `base44/functions/<name>/entry.ts` | 68 server functions (Deno, `npm:@base44/sdk`) |
| `base44/workflows/*.jsonc` | 19 scheduled or entity-triggered jobs that call a function |
| `base44/agents/*.jsonc` | 4 in-app AI agents |
| `base44/connectors/gmail.jsonc` | Gmail send connector |
| `base44/.app.jsonc` | gitignored, local only |

## Entities by domain (`base44/entities/<Name>.jsonc`)

| Domain | Entities |
|---|---|
| Bot farm | BotFarmActivityHistory, BotFarmBot, BotFarmMaintenanceLog, BotFarmMetric, BotFarmMission, BotFarmOutputLog, BotFarmRiskFlag, BotFarmSquad, BotFarmTask, BotFarmUpgrade |
| Bots (AI Lab, memory, versions, tests) | BotAutomation, BotChat, BotCollaborationSession, BotDeployment, BotGlobalPolicy, BotImprovement, BotMemory, BotMemoryChunk, BotMemoryProfile, BotMessage, BotPerformanceAlert, BotRating, BotResourceSnapshot, BotSemanticMemory, BotSquad, BotTestCase, BotTestRun, BotTradeProposal, BotVersion, BotVersionComparison, MemoryPod, OfflineBot, SharedBotWorkspace, UserBot |
| Squads, agents, knowledge | AgentTask, AgentTaskRun, IntegrityReport, KnowledgeBaseDocument, MissionKnowledge, PerformanceMetric, ProgrammingLanguageMemory, PromptTemplate, PromptTemplateComment, PromptTemplateVersion, RiskReport, SharedKnowledgeBase, SquadDeliveryLog, SquadKnowledge, SquadTemplate |
| Command Center | CommandAlert, CommandBot, CommandCommunication, CommandMission, CommandMissionHistory, CommandRecommendation, CommandTask |
| Telegram | TelegramAccount, TelegramBot, TelegramBotExperiment, TelegramBotExperimentRun, TelegramBotLog, TelegramBotMessage, TelegramBotSession, TelegramKnowledgeGap |
| Cards & game | Card, CardBattleHistory, CardListing, CardManualPrice, CardMatchmakingQueue, CardMatchmakingRoom, CardPlayerProfile, CardScanSession, CardTradeProposal, CardUsageHistory, CollectorRewardProfile, Creature, DailyQuest, ExcavationEvent, PinnedCard, PlayerDeck, RealityPressure |
| Economy, payments, commerce | BazarProduct, EconomyAuditLog, Escrow, IntegrationTopupOrder, JadeAsset, JadeTransaction, MarketConnector, Order, PaymentEvent, PricingAuditLog, StorefrontCustomization, StorefrontListing, Transaction |
| Wallets, portfolio, markets | ConnectedWallet, PortfolioThreshold, PortfolioWeighting, PriceAlert, RebalancingSuggestion, WalletHolding |
| Social & collaboration | Guild, GuildBankTransaction, GuildMembership, Note, Reputation, SharedDashboardComment, SharedDashboardSession, SharedDashboardState, SocialStrategyPost, TradeNegotiationChat, TradeNegotiationPost |
| Jackie & Dev Lab | JackieSaved, DevAgentTask, DevAuditLog, DevFileReference, DevKnowledgeDoc, DevPatch, DevPlan, DevProject, DevSession |
| Integrations | IntegrationAuditLog, IntegrationHealthCheck, IntegrationProvider, IntegrationSecretReference, IntegrationUsageEvent, IntegrationWebhookEvent |
| Users, roles, security, audit | User, ApiKey, CustomRole, RoleAssignment, SecurityAlert, SecurityAuditLog, AuditLog, AlertNotification, AppNotification, FeatureAnalytics |
| Learning, projects, misc. | StudyModule, UserProgress, Resource, Project, Task, WebsiteGeneratorProject, CustomThemeSetting |

**Used in code but not defined in `base44/entities/`.** Calls to these fail until the entity
exists: CommunityPost, CommunityPostComment, CommunityPostReaction, SimBot (field specs in
`src/ENTITY_SETUP.md`); RateLimitCounter (`base44/functions/rateLimitAuth/`); TelegramConversation,
TelegramMessageLog (`base44/functions/listTelegramBots/`); MasterCard (`src/lib/cardCatalog.js`);
NFT, InvestmentJournalEntry, JackieFeedback, ReferralEvent, ReferralProfile (these five only have
a copy in `src/entities/`).

## Functions by domain (`base44/functions/<name>/entry.ts`)

| Domain | Functions |
|---|---|
| Telegram | createTelegramBot, updateTelegramBot, listTelegramBots, listTelegramBotDashboard, manageTelegramWebhook, registerTelegramWebhook, telegramWebhook, generateTelegramLinkCode, createTelegramStarsInvoice, ingestTelegramBotKnowledge, analyzeTelegramKnowledgeGaps, simulateTelegramSwarm |
| Bots, memory, training | adaptBotStrategyFromPerformance, archiveBotMemory, archiveOldBotMemory, summarizeInactiveBotMemory, indexBotSemanticMemory, searchBotSemanticMemory, retrieveKnowledgeBaseContext, retrainBotsFromKnowledge, generateBotTrainingInsights, monitorBotRegression, botAutomationWebhook, dispatchBotAutomationAlert, botExternalDataAccess |
| Squads & bot farm | deliverSquadOutput, learnFromSuccessfulSquadRun, syncTrainingToSquadMemory, sendWeeklySquadReport, autoReassignBotFarmTasks, notifyCriticalBotFarmRisk |
| Models & AI | invokeExternalModel, invokeHuggingFaceUserModel, renderPromptTemplate, jackyProxy (bridge to the `jacky` engine), generateListingCopy, generateSmartRecommendations, generateStrategyRecommendations, predictAssetPerformance |
| Portfolio, wallets, markets | assessPortfolioRisk, calculatePortfolioRebalance, calculateRebalancing, monitorRebalancing, emailRebalanceSummary, fetchWalletHoldings, detectWalletSuspiciousActivity, checkPriceAlerts |
| Economy & payments | executeJadeDrop, mintMonolithJade, verifyTonPayment, validatePaymentWebhook, sendPurchaseReceipt, runMarketplaceSyndication |
| Security, privacy, roles | assignRole, rateLimitAuth, encryptUserPII, deleteMyData |
| Integrations | whatsappSendMessage, whatsappTemplateMessage, whatsappWebhookReceive, whatsappWebhookVerify, syncGoogleSheet, globalSearch, getIntegrationQuotaStatus, checkEditorPackageUpdates |
| Tasks & projects | checkTaskDueNotifications, handleTaskNotifications, handleProjectStatusNotifications |

## Workflows → function (`base44/workflows/<Name>.jsonc`)

| Workflow file | Trigger | Calls |
|---|---|---|
| `Bot Farm Auto Reassignment Scheduler.jsonc` | scheduled | autoReassignBotFarmTasks |
| `Bot Farm Critical Risk Alert.jsonc` | entity | notifyCriticalBotFarmRisk |
| `Bot Memory Hot Store Trimmer.jsonc` | scheduled | archiveOldBotMemory |
| `Bot Memory Retraining.jsonc` | scheduled, `0 3 * * *` | retrainBotsFromKnowledge |
| `Bot Regression Monitor.jsonc` | entity | monitorBotRegression |
| `Check Price Alerts Every Hour.jsonc` | scheduled | checkPriceAlerts |
| `Daily Editor Package Update Check.jsonc` | scheduled, `0 9 * * *` | checkEditorPackageUpdates |
| `Daily Inactive Bot Memory Cleanup.jsonc` | scheduled, `0 7 * * *` | summarizeInactiveBotMemory |
| `Daily Portfolio Rebalance Summary Email.jsonc` | scheduled, `0 13 * * *` | emailRebalanceSummary |
| `Learn From Successful Squad Runs.jsonc` | entity | learnFromSuccessfulSquadRun |
| `Marketplace Syndication Engine.jsonc` | scheduled | runMarketplaceSyndication |
| `Price Alert Monitor.jsonc` | scheduled | checkPriceAlerts |
| `Project Status Change Notifications.jsonc` | entity | handleProjectStatusNotifications |
| `Retrain On New Squad Knowledge.jsonc` | entity | retrainBotsFromKnowledge |
| `Task Assignment Notifications.jsonc` | entity | handleTaskNotifications |
| `Task Due Soon Notifications.jsonc` | scheduled | checkTaskDueNotifications |
| `Telegram Knowledge Gap Analysis.jsonc` | scheduled | analyzeTelegramKnowledgeGaps |
| `Training Results To Squad Memory.jsonc` | entity | syncTrainingToSquadMemory |
| `Weekly Bot Squad Report.jsonc` | scheduled, `0 13 * * 1` | sendWeeklySquadReport |

## Agents & connectors

| Path | What |
|---|---|
| `base44/agents/progress_tracker.jsonc` | tracks learning progress (UserProgress; reads StudyModule) |
| `base44/agents/reputation_manager.jsonc` | reviews and adjusts reputation (Reputation, User) |
| `base44/agents/resource_curator.jsonc` | recommends learning resources (Resource, StudyModule, UserProgress) |
| `base44/agents/study_guide_creator.jsonc` | builds personal study guides (StudyModule, UserProgress) |
| `base44/connectors/gmail.jsonc` | Gmail send scope |

## Legacy copies in `src/`

| Path | What |
|---|---|
| `src/entities/*.json` (43) | older schema copies. 13 have no `base44/entities/` match: InvestmentJournalEntry, JackieFeedback, JackieProgress, NFT, PlayHistory, Playlist, PlaylistCollaborator, PlaylistTrack, ReferralEvent, ReferralProfile, Tag, Track, TrackTag |
| `src/functions/*.js` (11) | older function copies. Duplicated in `base44/functions/`: generateTelegramLinkCode, listTelegramBotDashboard, manageTelegramWebhook, notifyCriticalBotFarmRisk, telegramWebhook. Only here: collaborativePlaylist, getSharedPlaylist, importTelegramNfts, jackieCodeEdit, listCollaborativePlaylists, listPublicPlaylists |
| `src/ENTITY_SETUP.md` | fields and access rules for entities that git-added definitions lost |
