# Components map

↑ [AGENTS.md](../../AGENTS.md) · which page mounts what → [pages.md](pages.md) · shared logic → [lib.md](lib.md)

All UI lives under `src/components/`. Feature UI sits in a folder named after the feature.
Each row below gives the folder, its file count, the page(s) that import it, and the files to
open first. To list a whole folder, open the folder path.

## Feature folders

| Folder | Files | Imported by (page files in `src/pages/`) | Start with (inside that folder) |
|---|---|---|---|
| `src/components/ailab/` | 80 | AILab, AgentOperations, BotMarketplace, SquadPerformance, SquadKnowledgeTrends | `CommandCenterDashboard.jsx`, `MultiAgentOrchestrator.jsx`, `BotFactory.jsx`, `SquadBoard.jsx`, `MemoryBankPanel.jsx`, `BotMarketplaceShell.jsx`; helpers `modelRouting.jsx`, `taskGroupRouting.jsx`, `orchestrationDecisioning.jsx`, `squadCostEstimation.jsx`, `commandCenterData.jsx`, `starterSquadTemplates.jsx` |
| `src/components/analytics/` | 3 | AnalyticsHub | `AnalyticsHubOverview.jsx` |
| `src/components/appstore/` | 3 | AppStore, Dashboard | `InstalledModulesRenderer.jsx`, `ModuleCard.jsx` |
| `src/components/bazar/` | 5 | BazarStand | `BazarCheckoutDialog.jsx`, `TonPaymentPanel.jsx`, `BazarStandDock.jsx` (not mounted) |
| `src/components/bot-farm/` | 23 | BotFarm | `BotFarmEngine.jsx`, `BotFarmControlPanel.jsx`, `BotFarmUtils.jsx`, `BotFarmDemoData.jsx` |
| `src/components/bot-mini-app/` | 5 | BotMiniApp | `MiniAppHeader.jsx`, `MiniAppChatPanel.jsx` |
| `src/components/botstudio/` | 8 | BotStudio, `Layout.jsx` | `BotEditor.jsx`, `BotChatPanel.jsx`, `OllamaConfig.jsx`, `OfflineBanner.jsx` |
| `src/components/builder/` | 14 | SystemBuilder | `WebsiteGeneratorPanel.jsx`, `WebsiteGeneratorEditor.jsx`, `websiteExportUtils.jsx` |
| `src/components/cards/` | 15 | CardArena, CreatureLab, DeckBuilder | `BattleView.jsx`, `CardDisplay.jsx`, `deckModes.jsx`, `TradingPanel.jsx`, `ForgeRecipesPanel.jsx` |
| `src/components/commander/` | 3 | AppCommander | `AgentRow.jsx`, `FleetStatCard.jsx`, `MissionCard.jsx` |
| `src/components/dashboard/` | 31 | Dashboard, AnalyticsHub, AppCommander, `Layout.jsx` | `DashboardPanelManager.jsx`, `WidgetLibrary.jsx`, `EruHero.jsx`, `TickerBar.jsx` |
| `src/components/devlab/` | 12 | JackieDevLab | `DevLabHeader.jsx`, `DevLabPlanTab.jsx`, `DevLabPatchesTab.jsx` |
| `src/components/economy/` | 4 | Economy | `EconomyBalanceCard.jsx`, `EconomyTransferForm.jsx` |
| `src/components/escrow/` | 2 | EscrowDashboard, Settings, UserSettings | `EscrowStatusTimeline.jsx`, `EscrowProfilePanel.jsx` |
| `src/components/guilds/` | 5 | Guilds | `GuildDirectory.jsx`, `GuildBankPanel.jsx` |
| `src/components/home/` | 6 | Home | `HomeHero.jsx`, `HomeTour.jsx` |
| `src/components/insights/` | 2 | LoreInsights | `LorePopularityChart.jsx` |
| `src/components/integrations/` | 6 | IntegrationHub | `IntegrationCard.jsx`, `IntegrationDetailDrawer.jsx`, `WhatsAppPanel.jsx` |
| `src/components/jackie/` | 23 | JackieAI, AppCommander | `InputBar.jsx`, `MessageBubble.jsx`, `CodeWorkspace.jsx`, `LocalModelConnector.jsx` |
| `src/components/jta/` | 7 | JadeAtelier | `JTAWorkstation.jsx`, `JTAMonolith.jsx` |
| `src/components/library/` | 2 | Library | `LibraryCardTile.jsx` |
| `src/components/marketplace/` | 1 | Collectables, NFTs, Marketplace (unrouted) | `DemoDataBanner.jsx` |
| `src/components/markets/` | 2 | Markets | `AssetComparisonDashboard.jsx` |
| `src/components/media/` | 11 | MediaLibrary, PlaylistDetail, CollabPlaylistDetail, MediaConverter, `Layout.jsx` | `PersistentPlayer.jsx`, `QueuePanel.jsx`, `YouTubeImportSheet.jsx` |
| `src/components/messages/` | 8 | Messages | `ChatDirectory.jsx`, `ChatRoom.jsx`, `TradeNegotiationChatRoom.jsx` |
| `src/components/mobile/` | 4 | Dashboard, Markets, Portfolio, AILab, `Layout.jsx` | `MobileTabBar.jsx`, `BottomSheet.jsx` |
| `src/components/nav/` | 2 | via `CenteredBottomNav.jsx` | `QuickActionsPopover.jsx`, `NavWalkthrough.jsx` |
| `src/components/nfts/` | 1 | NFTs | `TelegramImportPanel.jsx` |
| `src/components/notes/` | 2 | via `Layout.jsx` | `NotesWidgetMount.jsx` |
| `src/components/notifications/` | 1 | Dashboard | `NotificationCenter.jsx` |
| `src/components/portfolio/` | 6 | Portfolio | `RebalancingPlanner.jsx`, `TargetAllocationPanel.jsx` |
| `src/components/preferences/` | 5 | Preferences | `TelegramConnectSection.jsx`, `IntegrationQuotaSection.jsx` |
| `src/components/pricing/` (+ `scanner/`) | 4 + 5 | CardScanner, IntegrationHub, Settings | `VerifiedPriceDisplay.jsx`, `scanner/ScanCapture.jsx` |
| `src/components/privacy/` | 2 | UserSettings | `SecretArea.jsx`, `MaskedEmail.jsx` |
| `src/components/profile/` | 2 | ProfilePreferences | `BadgeShowcase.jsx` |
| `src/components/progress/` | 4 | PlayerProgress | `StudyRecommendations.jsx` |
| `src/components/quests/` | 1 | CardArena | `DailyQuestPanel.jsx` |
| `src/components/referrals/` | 1 | ReferralDashboard | `ReferralLeaderboard.jsx` |
| `src/components/reputation/` | 2 | Reputation | `CollectorReputationPill.jsx` |
| `src/components/security/` | 7 | **none: not imported anywhere** | `SocOverview.jsx`, `useSecurityFeed.js` |
| `src/components/settings/` | 1 | Settings, UserSettings | `DeleteAccountButton.jsx` |
| `src/components/storefront/` | 14 | StorefrontHub, SellerDashboard, CreatorHub, Collectables, NFTs, PhoenixInvestor | `ListingManager.jsx`, `ListingEditor.jsx`, `SellerOrderTable.jsx` |
| `src/components/telegram/` | 23 | TelegramBotManagement, TelegramApps, Dashboard | `TelegramBotDashboard.jsx`, `BotFlowBuilder.jsx`, `TelegramBotDetail.jsx`, `telegramExperimentUtils.jsx` |
| `src/components/theme/` | 9 | VisualEngine, `Layout.jsx` | `ThemeEnginePanel.jsx`, `PageThemeLayer.jsx`, `AdvancedThemeStudio.jsx` |
| `src/components/ui/` | 49 | everywhere | shadcn primitives (generated; `components.json`) |
| `src/components/vault/` | 1 | Vault | `VaultLogin.jsx` (nested PIN layers, `src/lib/secretAreaPin.js`) |

## Root-level components (`src/components/*.jsx`)

| Group | Files |
|---|---|
| App shell & nav | `Layout.jsx`, `CenteredBottomNav.jsx`, `AnimatedBackground.jsx`, `GlobalSearch.jsx`, `BotWidget.jsx`, `ErrorBoundary.jsx`, `AuthLayout.jsx`, `UserNotRegisteredError.jsx` |
| Floating widgets (kept but not mounted, see the comment in `Layout.jsx`) | `JackieFloat.jsx`, `FloatingQuickActions.jsx` |
| Access gates & auth | `ProtectedRoute.jsx`, `RoleGate.jsx`, `PermissionGate.jsx`, `MFAVerification.jsx`, `BiometricAuth.jsx` |
| Dialogs & buttons | `ConfirmDialog.jsx`, `ActionButton.jsx` |
| i18n, theme, sound | `T.jsx`, `LanguageSwitcher.jsx`, `ThemeToggle.jsx`, `SoundSettings.jsx` |
| Wallet & blockchain | `WalletConnector.jsx`, `WalletConnectBar.jsx`, `BlockchainMetrics.jsx`, `TransactionHistory.jsx` |
| Marketplace & trading | `MarketplaceTrading.jsx`, `BiddingHistory.jsx` |
| Admin & analytics | `AdminMetricCard.jsx`, `AdminEconomyCharts.jsx`, `CreatorAnalytics.jsx`, `AlertManager.jsx`, `SecurityAnalysis.jsx` |
| Reputation, collaboration, misc. | `ReputationBadge.jsx`, `CollabScratchpad.jsx`, `TelegramSettings.jsx`, `TruthState.jsx` |
