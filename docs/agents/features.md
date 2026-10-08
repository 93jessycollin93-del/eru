# Features map — end-to-end trails

↑ [AGENTS.md](../../AGENTS.md) · routes → [pages.md](pages.md) · components → [components.md](components.md) · lib → [lib.md](lib.md) · data/functions → [backend.md](backend.md)

Each feature lists its trail from the URL down to the records and server calls it uses. Paths
are repo-relative. Pages are in `src/pages/`; component folders are in `src/components/`.
"Records" are `backend.entities.<Name>` and "Server calls" are `backend.functions.invoke('<name>')`.
No backend is connected, so both currently return nothing or fail ([backend.md](backend.md)).

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
| Records | TelegramAccount, TelegramBot, TelegramBotExperiment, TelegramBotExperimentRun, TelegramBotSession, TelegramKnowledgeGap, KnowledgeBaseDocument, UserBot |
| Server calls (not connected) | updateTelegramBot, listTelegramBotDashboard, manageTelegramWebhook, generateTelegramLinkCode, createTelegramStarsInvoice, ingestTelegramBotKnowledge, simulateTelegramSwarm |

## AI Lab, squads & Command Center

| Layer | Paths |
|---|---|
| Routes → pages | `/ailab` AILab · `/agent-operations` AgentOperations · `/squad-performance` SquadPerformance · `/squad-knowledge-trends` SquadKnowledgeTrends · `/bot-marketplace` BotMarketplace · `/bot-performance-history` BotPerformanceHistory · `/bot-automations` BotAutomations · `/team-builder` TeamBuilder · `/bot-forge` BotForge · `/builder` SystemBuilder · `/pipeline` Pipeline · `/apikeys` APIKeys |
| Components | `ailab/` (Command Center: `CommandCenter*.jsx`; orchestration: `MultiAgentOrchestrator.jsx`, `Orchestrator*.jsx`; squads: `Squad*.jsx`; memory: `MemoryBankPanel.jsx`, `TieredMemoryPanel.jsx`, `SemanticMemorySearchPanel.jsx`; marketplace: `BotMarketplace*.jsx`; testing: `BotTestingSuite.jsx`, `regressionTesting.jsx`) |
| Lib | `src/lib/localModelProviders.js` |
| Records | the Bots, Squads/agents/knowledge and Command Center rows in [backend.md](backend.md) |
| Server calls (not connected) | adaptBotStrategyFromPerformance, archiveBotMemory, summarizeInactiveBotMemory, searchBotSemanticMemory, retrieveKnowledgeBaseContext, generateBotTrainingInsights, deliverSquadOutput, syncTrainingToSquadMemory, invokeExternalModel, renderPromptTemplate, dispatchBotAutomationAlert |

## Bot Farm

| Layer | Paths |
|---|---|
| Route → page | `/bot-farm` BotFarm |
| Components | `bot-farm/` (`BotFarmEngine.jsx`, `BotFarmUtils.jsx`, `BotFarmDemoData.jsx`, panels) |
| Records | BotFarmActivityHistory, BotFarmBot, BotFarmMaintenanceLog, BotFarmMission, BotFarmOutputLog, BotFarmRiskFlag, BotFarmSquad, BotFarmTask, BotFarmUpgrade |
| Server calls (not connected) | indexBotSemanticMemory, searchBotSemanticMemory |

## Offline AI Studio & local models

| Layer | Paths |
|---|---|
| Route → page | `/bot-studio` BotStudio (offline banner shows in `Layout.jsx`) |
| Components | `botstudio/`, `jackie/LocalModelConnector.jsx`, `ailab/ModelProviderPanel.jsx`, `ailab/ExternalAISettingsPanel.jsx` |
| Lib | `src/lib/botStudioStore.js`, `src/lib/offlineDb.js`, `src/lib/ollama.js`, `src/lib/localModelProviders.js`, `src/lib/connectivity.js` |
| Records | accessed by computed name in `src/lib/botStudioStore.js` |
| Offline shell | `public/sw.js` |

## Jackie assistant, Dev Lab, Jacky Live, App Commander

| Layer | Paths |
|---|---|
| Routes → pages | `/jackie` JackieAI · `/dev-lab` JackieDevLab · `/jacky-live` JackyLive · `/command` AppCommander |
| Components | `jackie/`, `devlab/`, `commander/`, `src/components/JackieFloat.jsx` (not mounted) |
| Lib | `src/lib/jackieMemoryRetrieval.js`, `src/lib/devLab.js`, `src/lib/jackyClient.ts`, `src/lib/jackyBootstrap.js`, `src/lib/localModelProviders.js`, `src/lib/metadataCache.js` |
| Records | JackieSaved, ProgrammingLanguageMemory, BotMemory, BotMemoryChunk, BotMemoryProfile, DevAgentTask, DevAuditLog, DevFileReference, DevKnowledgeDoc, DevPatch, DevPlan, DevProject, DevSession, JackieFeedback |
| Server calls (not connected) | jackyProxy |
| Static | `public/app-commander.html` |
| Docs | `FLEET_PARITY_PLAN.md`, `PARITY_MATRIX.md` |

## Card game

| Layer | Paths |
|---|---|
| Routes → pages | `/arena` CardArena · `/deck-builder` DeckBuilder · `/creatures` CreatureLab · `/library` Library · `/card-scanner` CardScanner · `/lore-insights` LoreInsights · `/player-progress` PlayerProgress · `/collectables` Collectables |
| Components | `cards/`, `library/`, `insights/`, `progress/`, `quests/`, `pricing/` (+ `pricing/scanner/`) |
| Lib | `src/lib/cardCatalog.js`, `cardLeveling.js`, `cardLore.js`, `dailyQuests.js`, `forgeRecipes.js`, `transmutation.js`, `guildSystem.js`, `economyApi.js`, `zeroFakeData.js` |
| Records | Card, CardBattleHistory, CardListing, CardManualPrice, CardMatchmakingQueue, CardMatchmakingRoom, CardPlayerProfile, CardScanSession, CardTradeProposal, CardUsageHistory, Creature, DailyQuest, ExcavationEvent, PlayerDeck, RealityPressure, SocialStrategyPost |

## Economy, Jade & payments

| Layer | Paths |
|---|---|
| Routes → pages | `/economy` Economy · `/admin/economy` AdminEconomyDashboard · `/jta` JadeAtelier · `/bazar-stand` BazarStand · `/admin/bazar-products` AdminBazarProducts · `/escrow-dashboard` EscrowDashboard · `/transactions` TransactionHistory |
| Components | `economy/`, `jta/`, `bazar/`, `escrow/`, `src/components/AdminEconomyCharts.jsx` |
| Lib | `src/lib/economyApi.js`, `paymentGuards.js`, `assetGrant.js`, `orderStateMachine.js`, `escrowStateMachine.js`, `tonConfig.js`, `tonPayment.js`, `jadeRefresh.js` (unused: `economyVerification.js`, `jadeDropSystem.js`, `jadeDropGuards.js`, `jadeEconomyMonitor.js`) |
| Records | JadeAsset, JadeTransaction, EconomyAuditLog, Transaction, Order, Escrow, PricingAuditLog, BazarProduct |
| Server calls (not connected) | executeJadeDrop, mintMonolithJade, verifyTonPayment, validatePaymentWebhook |
| Rules & docs | `src/PAYMENT_VERIFICATION_RULES.md`, `src/ECONOMY_VERIFICATION.md`, `src/ECONOMY_LOCKDOWN.md`, `src/JADE_ECONOMY_DROP.md` |

## Storefront & marketplace

| Layer | Paths |
|---|---|
| Routes → pages | `/storefront` StorefrontHub · `/storefront-analytics` StorefrontAnalytics · `/seller-dashboard` SellerDashboard · `/creator` CreatorHub · `/nfts` NFTs · `/storefront/phoenix-investor` PhoenixInvestor · `/admin/review` AdminReviewCenter · `Marketplace.jsx` (unrouted) |
| Components | `storefront/`, `marketplace/`, `src/components/MarketplaceTrading.jsx`, `src/components/BiddingHistory.jsx`, `messages/TradeNegotiation*.jsx` |
| Lib | `src/lib/marketplaceValidation.js`, `externalPortals.js`, `safeUrl.js`, `auditEvents.js`, `permissions.js` |
| Records | StorefrontListing, StorefrontCustomization, MarketConnector, Order, Escrow, TradeNegotiationChat, TradeNegotiationPost, NFT |
| Server calls (not connected) | generateListingCopy, runMarketplaceSyndication |

## Markets, portfolio & wallets

| Layer | Paths |
|---|---|
| Routes → pages | `/markets` Markets · `/trade` Trade · `/portfolio` Portfolio · `/wallet-manager` WalletManager · `/blockchain-analytics` BlockchainAnalytics · `/admin/blockchain` AdminBlockchain · `/bot-lab` SimTradingLab |
| Components | `markets/`, `portfolio/`, `src/components/WalletConnector.jsx`, `WalletConnectBar.jsx`, `BlockchainMetrics.jsx`, `TransactionHistory.jsx` |
| Hooks | `src/hooks/useCryptoPrices.js`, `useRealPrices.js`, `useLiveSync.js`, `useWallet.js` |
| Lib | `src/lib/portfolioRebalance.js`, `src/lib/simEngine.js` |
| Records | ConnectedWallet, WalletHolding, PortfolioWeighting, RebalancingSuggestion, PriceAlert, SecurityAlert, InvestmentJournalEntry, SimBot |
| Server calls (not connected) | fetchWalletHoldings, detectWalletSuspiciousActivity, calculatePortfolioRebalance, checkPriceAlerts |

## Media & music

| Layer | Paths |
|---|---|
| Routes → pages | `/music` MediaLibrary · `/playlists` Playlists · `/playlists/:id` PlaylistDetail · `/collab/:id` CollabPlaylistDetail · `/p/:id` SharedPlaylist · `/discover` Discover · `/listening` Listening · `/media-converter` MediaConverter |
| Components | `media/` (`PersistentPlayer.jsx` is mounted in `Layout.jsx`) |
| State | `src/context/MediaPlayerContext.jsx` |
| Lib | `src/lib/mediaLibrary.js`, `mediaConverter.js`, `playlistIO.js`, `audioEngine.js` |
| External service | `media-converter/` ([services.md](services.md)) |

## Social

| Layer | Paths |
|---|---|
| Routes → pages | `/messages` Messages · `/community` Community · `/guilds` Guilds · `/referrals` ReferralDashboard · `/reputation` Reputation · `/profile-preferences` ProfilePreferences · `/thinkers` ThinkersClub · `/review` AppReview |
| Components | `messages/`, `guilds/`, `referrals/`, `reputation/`, `profile/`, `src/components/ReputationBadge.jsx`, `src/components/CollabScratchpad.jsx` |
| Lib | `src/lib/guildSystem.js`, `src/lib/collectorRewards.js` |
| Records | Guild, GuildMembership, GuildBankTransaction, Reputation, CollectorRewardProfile, SocialStrategyPost, CommunityPost, CommunityPostComment, CommunityPostReaction, ReferralEvent, ReferralProfile |
| Docs | `src/SOCIAL_LAYER_PLAN.md` |

## Learning & progress

| Layer | Paths |
|---|---|
| Routes → pages | `/player-progress` PlayerProgress · `/sheets-sync` SheetsSync |
| Components | `progress/` |
| Records | StudyModule, UserProgress |
| Server calls (not connected) | syncGoogleSheet |

## Integrations

| Layer | Paths |
|---|---|
| Routes → pages | `/integrations` IntegrationHub · `/sheets-sync` SheetsSync · `/apikeys` APIKeys · `/preferences` Preferences |
| Components | `integrations/` (`WhatsAppPanel.jsx`), `preferences/` |
| Lib | `src/lib/integrationRegistry.js`, `integrationEnv.js`, `externalPortals.js` |
| Records | IntegrationTopupOrder, ApiKey |
| Server calls (not connected) | whatsappSendMessage, syncGoogleSheet, getIntegrationQuotaStatus, checkEditorPackageUpdates, globalSearch |

## Home, dashboard, analytics, app store, theme, builders

| Layer | Paths |
|---|---|
| Routes → pages | `/` Home · `/dashboard` Dashboard · `/analytics` AnalyticsHub · `/performance` PerformanceDashboard · `/app-store` AppStore · `/visual` VisualEngine · `/builder` SystemBuilder · `/about` About · `/settings` Settings · `/user-settings` UserSettings |
| Components | `home/`, `dashboard/`, `analytics/`, `appstore/`, `theme/`, `builder/`, `notifications/`, `settings/` |
| Lib & hooks | `src/lib/appStoreModules.js`, `src/hooks/useInstalledModules.js`, `src/lib/themeEngine.js`, `src/lib/pdfExporter.js`, `src/hooks/useFeatureTracking.js` |
| Records | FeatureAnalytics, SharedDashboardSession, SharedDashboardState, SharedDashboardComment, AppNotification, CustomThemeSetting, WebsiteGeneratorProject, PerformanceMetric |
| Server calls (not connected) | generateSmartRecommendations |

## Tasks, projects & notes

| Layer | Paths |
|---|---|
| Components | `nav/QuickActionsPopover.jsx`, `notes/` (mounted in `Layout.jsx`) |
| Records | Task, Project, Note, JackieSaved |

## ERU swarm & red-team tests

| Layer | Paths |
|---|---|
| Routes → pages | `/eru-swarm-test` EruSwarmTest · `/eru-redteam-test` EruRedteamTest |
| Lib | `src/lib/eruSwarm.js`, `eruSwarmValidator.js`, `eruRedteam.js`, `eruRedteamValidator.js` |
| CLI | `node scripts/runEruSwarmTests.mjs` |

## Security, privacy & compliance

See [security.md](security.md).
