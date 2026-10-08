# Features map — end-to-end trails

↑ [AGENTS.md](../../AGENTS.md) · routes → [pages.md](pages.md) · components → [components.md](components.md) · lib → [lib.md](lib.md) · data/functions → [backend.md](backend.md)

Each feature lists its trail from the URL down to stored data and background jobs. Paths
are repo-relative. Entity names refer to `base44/entities/<Name>.jsonc`, function names to
`base44/functions/<name>/entry.ts`, and both are quarantined ([backend.md](backend.md)).
Pages are in `src/pages/`; component folders are in `src/components/`.

**Index:** [Telegram](#telegram-bots--mini-apps) · [AI Lab](#ai-lab-squads--command-center) ·
[Bot Farm](#bot-farm) · [Offline AI Studio](#offline-ai-studio--local-models) ·
[Jackie](#jackie-assistant-dev-lab-jacky-live-app-commander) · [Cards](#card-game) ·
[Economy](#economy-jade--payments) · [Storefront](#storefront--marketplace) ·
[Markets](#markets-portfolio--wallets) · [Media](#media--music) · [Social](#social) ·
[Learning](#learning--progress) · [Integrations](#integrations) ·
[Dashboard & shell](#home-dashboard-analytics-app-store-theme-builders) ·
[Tasks & notes](#tasks-projects--notes) · [Swarm tests](#eru-swarm--red-team-tests) ·
[Security](#security-privacy--compliance)

---

## Telegram bots & mini apps

| Layer | Paths |
|---|---|
| Routes → pages | `/telegram-bots` TelegramBotManagement · `/tgapps` TelegramApps · `/bot-mini-app` BotMiniApp · Telegram panels on `/dashboard` |
| Components | `telegram/`, `bot-mini-app/`, `nfts/TelegramImportPanel.jsx`, `preferences/TelegramConnectSection.jsx`, `jackie/TelegramBotSetupPanel.jsx`, `dashboard/TelegramKnowledgeGapPanel.jsx`, `dashboard/TelegramRevenuePanel.jsx`, `src/components/TelegramSettings.jsx` |
| Lib | `src/lib/telegramConnector.js` |
| Data | TelegramAccount, TelegramBot, TelegramBotExperiment, TelegramBotExperimentRun, TelegramBotLog, TelegramBotMessage, TelegramBotSession, TelegramKnowledgeGap, KnowledgeBaseDocument, UserBot |
| Server | createTelegramBot, updateTelegramBot, listTelegramBots, listTelegramBotDashboard, manageTelegramWebhook, registerTelegramWebhook, telegramWebhook, generateTelegramLinkCode, createTelegramStarsInvoice, ingestTelegramBotKnowledge, analyzeTelegramKnowledgeGaps, simulateTelegramSwarm |
| Jobs | `base44/workflows/Telegram Knowledge Gap Analysis.jsonc` |
| Legacy | `src/functions/telegramWebhook.js`, `manageTelegramWebhook.js`, `listTelegramBotDashboard.js`, `generateTelegramLinkCode.js`, `importTelegramNfts.js` |

## AI Lab, squads & Command Center

| Layer | Paths |
|---|---|
| Routes → pages | `/ailab` AILab · `/agent-operations` AgentOperations · `/squad-performance` SquadPerformance · `/squad-knowledge-trends` SquadKnowledgeTrends · `/bot-marketplace` BotMarketplace · `/bot-performance-history` BotPerformanceHistory · `/bot-automations` BotAutomations · `/team-builder` TeamBuilder · `/bot-forge` BotForge · `/builder` SystemBuilder · `/pipeline` Pipeline · `/apikeys` APIKeys |
| Components | `ailab/` (Command Center: `CommandCenter*.jsx`; orchestration: `MultiAgentOrchestrator.jsx`, `Orchestrator*.jsx`; squads: `Squad*.jsx`; memory: `MemoryBankPanel.jsx`, `TieredMemoryPanel.jsx`, `SemanticMemorySearchPanel.jsx`; marketplace: `BotMarketplace*.jsx`; testing: `BotTestingSuite.jsx`, `regressionTesting.jsx`) |
| Lib | `src/lib/localModelProviders.js` |
| Data | the Bots, Squads/agents/knowledge and Command Center groups in [backend.md](backend.md) |
| Server | adaptBotStrategyFromPerformance, archiveBotMemory, summarizeInactiveBotMemory, searchBotSemanticMemory, retrieveKnowledgeBaseContext, generateBotTrainingInsights, deliverSquadOutput, syncTrainingToSquadMemory, learnFromSuccessfulSquadRun, sendWeeklySquadReport, invokeExternalModel, invokeHuggingFaceUserModel, renderPromptTemplate, dispatchBotAutomationAlert, botAutomationWebhook, monitorBotRegression, retrainBotsFromKnowledge |
| Jobs | `Bot Memory Retraining`, `Bot Regression Monitor`, `Daily Inactive Bot Memory Cleanup`, `Bot Memory Hot Store Trimmer`, `Learn From Successful Squad Runs`, `Retrain On New Squad Knowledge`, `Training Results To Squad Memory`, `Weekly Bot Squad Report` (`base44/workflows/`) |

## Bot Farm

| Layer | Paths |
|---|---|
| Route → page | `/bot-farm` BotFarm |
| Components | `bot-farm/` (`BotFarmEngine.jsx`, `BotFarmUtils.jsx`, `BotFarmDemoData.jsx`, panels) |
| Data | BotFarmActivityHistory, BotFarmBot, BotFarmMaintenanceLog, BotFarmMetric, BotFarmMission, BotFarmOutputLog, BotFarmRiskFlag, BotFarmSquad, BotFarmTask, BotFarmUpgrade |
| Server | autoReassignBotFarmTasks, notifyCriticalBotFarmRisk, indexBotSemanticMemory, searchBotSemanticMemory |
| Jobs | `Bot Farm Auto Reassignment Scheduler`, `Bot Farm Critical Risk Alert` |
| Legacy | `src/functions/notifyCriticalBotFarmRisk.js` |

## Offline AI Studio & local models

| Layer | Paths |
|---|---|
| Route → page | `/bot-studio` BotStudio (offline banner shows in `Layout.jsx`) |
| Components | `botstudio/`, `jackie/LocalModelConnector.jsx`, `ailab/ModelProviderPanel.jsx`, `ailab/ExternalAISettingsPanel.jsx` |
| Lib | `src/lib/botStudioStore.js`, `src/lib/offlineDb.js`, `src/lib/ollama.js`, `src/lib/localModelProviders.js`, `src/lib/connectivity.js` |
| Data | OfflineBot, MemoryPod |
| Offline shell | `public/sw.js` |

## Jackie assistant, Dev Lab, Jacky Live, App Commander

| Layer | Paths |
|---|---|
| Routes → pages | `/jackie` JackieAI · `/dev-lab` JackieDevLab · `/jacky-live` JackyLive · `/command` AppCommander |
| Components | `jackie/`, `devlab/`, `commander/`, `src/components/JackieFloat.jsx` (not mounted) |
| Lib | `src/lib/jackieMemoryRetrieval.js`, `src/lib/devLab.js`, `src/lib/jackyClient.ts`, `src/lib/jackyBootstrap.js`, `src/lib/localModelProviders.js`, `src/lib/metadataCache.js` |
| Data | JackieSaved, ProgrammingLanguageMemory, BotMemory, BotMemoryChunk, BotMemoryProfile, DevAgentTask, DevAuditLog, DevFileReference, DevKnowledgeDoc, DevPatch, DevPlan, DevProject, DevSession, JackieFeedback (undefined, see [backend.md](backend.md)) |
| Server | jackyProxy (bridge to the `jacky` engine) |
| Legacy | `src/functions/jackieCodeEdit.js` |
| Static | `public/app-commander.html` |
| Docs | `FLEET_PARITY_PLAN.md`, `PARITY_MATRIX.md` |

## Card game

| Layer | Paths |
|---|---|
| Routes → pages | `/arena` CardArena · `/deck-builder` DeckBuilder · `/creatures` CreatureLab · `/library` Library · `/card-scanner` CardScanner · `/lore-insights` LoreInsights · `/player-progress` PlayerProgress · `/collectables` Collectables |
| Components | `cards/`, `library/`, `insights/`, `progress/`, `quests/`, `pricing/` (+ `pricing/scanner/`) |
| Lib | `src/lib/cardCatalog.js`, `cardLeveling.js`, `cardLore.js`, `dailyQuests.js`, `forgeRecipes.js`, `transmutation.js`, `guildSystem.js`, `economyApi.js`, `zeroFakeData.js` |
| Data | Card, CardBattleHistory, CardListing, CardManualPrice, CardMatchmakingQueue, CardMatchmakingRoom, CardPlayerProfile, CardScanSession, CardTradeProposal, CardUsageHistory, Creature, DailyQuest, ExcavationEvent, PlayerDeck, RealityPressure, SocialStrategyPost |

## Economy, Jade & payments

| Layer | Paths |
|---|---|
| Routes → pages | `/economy` Economy · `/admin/economy` AdminEconomyDashboard · `/jta` JadeAtelier · `/bazar-stand` BazarStand · `/admin/bazar-products` AdminBazarProducts · `/escrow-dashboard` EscrowDashboard · `/transactions` TransactionHistory |
| Components | `economy/`, `jta/`, `bazar/`, `escrow/`, `src/components/AdminEconomyCharts.jsx` |
| Lib | `src/lib/economyApi.js`, `paymentGuards.js`, `assetGrant.js`, `orderStateMachine.js`, `escrowStateMachine.js`, `tonConfig.js`, `tonPayment.js`, `jadeRefresh.js` (unused: `economyVerification.js`, `jadeDropSystem.js`, `jadeDropGuards.js`, `jadeEconomyMonitor.js`) |
| Data | JadeAsset, JadeTransaction, EconomyAuditLog, Transaction, Order, Escrow, PaymentEvent, PricingAuditLog, BazarProduct |
| Server | executeJadeDrop, mintMonolithJade, verifyTonPayment, validatePaymentWebhook, sendPurchaseReceipt |
| Rules & docs | `src/PAYMENT_VERIFICATION_RULES.md`, `src/ECONOMY_VERIFICATION.md`, `src/ECONOMY_LOCKDOWN.md`, `src/JADE_ECONOMY_DROP.md` |

## Storefront & marketplace

| Layer | Paths |
|---|---|
| Routes → pages | `/storefront` StorefrontHub · `/storefront-analytics` StorefrontAnalytics · `/seller-dashboard` SellerDashboard · `/creator` CreatorHub · `/nfts` NFTs · `/storefront/phoenix-investor` PhoenixInvestor · `/admin/review` AdminReviewCenter · `Marketplace.jsx` (unrouted) |
| Components | `storefront/`, `marketplace/`, `src/components/MarketplaceTrading.jsx`, `src/components/BiddingHistory.jsx`, `messages/TradeNegotiation*.jsx` |
| Lib | `src/lib/marketplaceValidation.js`, `externalPortals.js`, `safeUrl.js`, `auditEvents.js`, `permissions.js` |
| Data | StorefrontListing, StorefrontCustomization, MarketConnector, Order, Escrow, TradeNegotiationChat, TradeNegotiationPost, NFT (undefined) |
| Server | generateListingCopy, runMarketplaceSyndication |
| Jobs | `Marketplace Syndication Engine` |

## Markets, portfolio & wallets

| Layer | Paths |
|---|---|
| Routes → pages | `/markets` Markets · `/trade` Trade · `/portfolio` Portfolio · `/wallet-manager` WalletManager · `/blockchain-analytics` BlockchainAnalytics · `/admin/blockchain` AdminBlockchain · `/bot-lab` SimTradingLab |
| Components | `markets/`, `portfolio/`, `src/components/WalletConnector.jsx`, `WalletConnectBar.jsx`, `BlockchainMetrics.jsx`, `TransactionHistory.jsx` |
| Hooks | `src/hooks/useCryptoPrices.js`, `useRealPrices.js`, `useLiveSync.js`, `useWallet.js` |
| Lib | `src/lib/portfolioRebalance.js`, `src/lib/simEngine.js` |
| Data | ConnectedWallet, WalletHolding, PortfolioThreshold, PortfolioWeighting, RebalancingSuggestion, PriceAlert, SecurityAlert, InvestmentJournalEntry (undefined), SimBot (undefined) |
| Server | fetchWalletHoldings, detectWalletSuspiciousActivity, assessPortfolioRisk, calculatePortfolioRebalance, calculateRebalancing, monitorRebalancing, emailRebalanceSummary, checkPriceAlerts, predictAssetPerformance, generateStrategyRecommendations |
| Jobs | `Check Price Alerts Every Hour`, `Price Alert Monitor`, `Daily Portfolio Rebalance Summary Email` |

## Media & music

| Layer | Paths |
|---|---|
| Routes → pages | `/music` MediaLibrary · `/playlists` Playlists · `/playlists/:id` PlaylistDetail · `/collab/:id` CollabPlaylistDetail · `/p/:id` SharedPlaylist · `/discover` Discover · `/listening` Listening · `/media-converter` MediaConverter |
| Components | `media/` (`PersistentPlayer.jsx` is mounted in `Layout.jsx`) |
| State | `src/context/MediaPlayerContext.jsx` |
| Lib | `src/lib/mediaLibrary.js`, `mediaConverter.js`, `playlistIO.js`, `audioEngine.js` |
| Data (legacy only) | `src/entities/Playlist.json`, `PlaylistTrack.json`, `PlaylistCollaborator.json`, `Track.json`, `TrackTag.json`, `Tag.json`, `PlayHistory.json` |
| Server (legacy only) | `src/functions/collaborativePlaylist.js`, `getSharedPlaylist.js`, `listCollaborativePlaylists.js`, `listPublicPlaylists.js` |
| External service | `media-converter/` ([services.md](services.md)) |

## Social

| Layer | Paths |
|---|---|
| Routes → pages | `/messages` Messages · `/community` Community · `/guilds` Guilds · `/referrals` ReferralDashboard · `/reputation` Reputation · `/profile-preferences` ProfilePreferences · `/thinkers` ThinkersClub · `/review` AppReview |
| Components | `messages/`, `guilds/`, `referrals/`, `reputation/`, `profile/`, `src/components/ReputationBadge.jsx`, `src/components/CollabScratchpad.jsx` |
| Lib | `src/lib/guildSystem.js`, `src/lib/collectorRewards.js` |
| Data | Guild, GuildMembership, GuildBankTransaction, Reputation, CollectorRewardProfile, SocialStrategyPost, CommunityPost* and ReferralEvent/ReferralProfile (undefined, see [backend.md](backend.md)) |
| Agent | `base44/agents/reputation_manager.jsonc` |
| Docs | `src/SOCIAL_LAYER_PLAN.md`, `src/ENTITY_SETUP.md` |

## Learning & progress

| Layer | Paths |
|---|---|
| Routes → pages | `/player-progress` PlayerProgress · `/sheets-sync` SheetsSync |
| Components | `progress/` |
| Data | StudyModule, UserProgress, Resource |
| Server | syncGoogleSheet |
| Agents | `base44/agents/progress_tracker.jsonc`, `resource_curator.jsonc`, `study_guide_creator.jsonc` |

## Integrations

| Layer | Paths |
|---|---|
| Routes → pages | `/integrations` IntegrationHub · `/sheets-sync` SheetsSync · `/apikeys` APIKeys · `/preferences` Preferences |
| Components | `integrations/` (`WhatsAppPanel.jsx`), `preferences/` |
| Lib | `src/lib/integrationRegistry.js`, `integrationEnv.js`, `externalPortals.js` |
| Data | IntegrationProvider, IntegrationHealthCheck, IntegrationAuditLog, IntegrationSecretReference, IntegrationUsageEvent, IntegrationWebhookEvent, IntegrationTopupOrder, ApiKey |
| Server | whatsappSendMessage, whatsappTemplateMessage, whatsappWebhookReceive, whatsappWebhookVerify, syncGoogleSheet, getIntegrationQuotaStatus, checkEditorPackageUpdates, botExternalDataAccess, globalSearch |
| Jobs | `Daily Editor Package Update Check` |
| Connector | `base44/connectors/gmail.jsonc` |

## Home, dashboard, analytics, app store, theme, builders

| Layer | Paths |
|---|---|
| Routes → pages | `/` Home · `/dashboard` Dashboard · `/analytics` AnalyticsHub · `/performance` PerformanceDashboard · `/app-store` AppStore · `/visual` VisualEngine · `/builder` SystemBuilder · `/about` About · `/settings` Settings · `/user-settings` UserSettings |
| Components | `home/`, `dashboard/`, `analytics/`, `appstore/`, `theme/`, `builder/`, `notifications/`, `settings/` |
| Lib & hooks | `src/lib/appStoreModules.js`, `src/hooks/useInstalledModules.js`, `src/lib/themeEngine.js`, `src/lib/pdfExporter.js`, `src/hooks/useFeatureTracking.js` |
| Data | FeatureAnalytics, SharedDashboardSession, SharedDashboardState, SharedDashboardComment, AppNotification, AlertNotification, CustomThemeSetting, WebsiteGeneratorProject, PerformanceMetric |
| Server | generateSmartRecommendations |

## Tasks, projects & notes

| Layer | Paths |
|---|---|
| Components | `nav/QuickActionsPopover.jsx`, `notes/` (mounted in `Layout.jsx`) |
| Data | Task, Project, Note, JackieSaved |
| Server | handleTaskNotifications, checkTaskDueNotifications, handleProjectStatusNotifications |
| Jobs | `Task Assignment Notifications`, `Task Due Soon Notifications`, `Project Status Change Notifications` |

## ERU swarm & red-team tests

| Layer | Paths |
|---|---|
| Routes → pages | `/eru-swarm-test` EruSwarmTest · `/eru-redteam-test` EruRedteamTest |
| Lib | `src/lib/eruSwarm.js`, `eruSwarmValidator.js`, `eruRedteam.js`, `eruRedteamValidator.js` |
| CLI | `node scripts/runEruSwarmTests.mjs` |

## Security, privacy & compliance

See [security.md](security.md).
