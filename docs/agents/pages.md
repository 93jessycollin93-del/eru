# Pages map — route → file

↑ [AGENTS.md](../../AGENTS.md) · how routing works → [frontend.md](frontend.md#routing) · component folders → [components.md](components.md) · per-feature trails → [features.md](features.md)

Source of truth: the `<Routes>` block in `src/App.jsx`. Each page is `lazy()`-imported there.
The first four routes render outside the shell. Every other route renders inside
`src/components/Layout.jsx`. Unknown paths (`*`) render `src/lib/PageNotFound.jsx`.

"Component folders" lists the `src/components/<folder>/` directories the page file
imports directly (shadcn `ui/` is left out). An empty cell means the page is self-contained
or only uses root-level components.

| Route | Page file | Component folders it imports |
|---|---|---|
| `/login` | `src/pages/Login.jsx` | — |
| `/register` | `src/pages/Register.jsx` | — |
| `/forgot-password` | `src/pages/ForgotPassword.jsx` | — |
| `/reset-password` | `src/pages/ResetPassword.jsx` | — |
| `/` | `src/pages/Home.jsx` | `home/` |
| `/dashboard` | `src/pages/Dashboard.jsx` | `appstore/`, `dashboard/`, `mobile/`, `notifications/`, `telegram/` |
| `/jacky-live` | `src/pages/JackyLive.jsx` | — |
| `/markets` | `src/pages/Markets.jsx` | `markets/`, `mobile/` |
| `/trade` | `src/pages/Trade.jsx` | — |
| `/nfts` | `src/pages/NFTs.jsx` | `marketplace/`, `nfts/`, `storefront/` |
| `/portfolio` | `src/pages/Portfolio.jsx` | `mobile/`, `portfolio/` |
| `/collectables` | `src/pages/Collectables.jsx` | `marketplace/`, `storefront/` |
| `/messages` | `src/pages/Messages.jsx` | `messages/` |
| `/settings` | `src/pages/Settings.jsx` | `escrow/`, `pricing/`, `settings/` |
| `/user-settings` | `src/pages/UserSettings.jsx` | `escrow/`, `privacy/`, `settings/` |
| `/profile-preferences` | `src/pages/ProfilePreferences.jsx` | `profile/` |
| `/creator` | `src/pages/CreatorHub.jsx` | `storefront/` |
| `/thinkers` | `src/pages/ThinkersClub.jsx` | — |
| `/review` | `src/pages/AppReview.jsx` | — |
| `/reputation` | `src/pages/Reputation.jsx` | `reputation/` |
| `/tgapps` | `src/pages/TelegramApps.jsx` | `telegram/` |
| `/telegram-bots` | `src/pages/TelegramBotManagement.jsx` | `telegram/` |
| `/jackie` | `src/pages/JackieAI.jsx` | `jackie/` |
| `/ailab` | `src/pages/AILab.jsx` | `ailab/`, `mobile/` |
| `/apikeys` | `src/pages/APIKeys.jsx` | — |
| `/builder` | `src/pages/SystemBuilder.jsx` | `builder/` |
| `/pipeline` | `src/pages/Pipeline.jsx` | — |
| `/admin/blockchain` | `src/pages/AdminBlockchain.jsx` | — |
| `/jta` | `src/pages/JadeAtelier.jsx` | `jta/` |
| `/visual` | `src/pages/VisualEngine.jsx` | `theme/` |
| `/arena` | `src/pages/CardArena.jsx` | `cards/`, `quests/` |
| `/creatures` | `src/pages/CreatureLab.jsx` | `cards/` |
| `/storefront` | `src/pages/StorefrontHub.jsx` | `storefront/` |
| `/storefront-analytics` | `src/pages/StorefrontAnalytics.jsx` | — |
| `/seller-dashboard` | `src/pages/SellerDashboard.jsx` | `storefront/` |
| `/admin/economy` | `src/pages/AdminEconomyDashboard.jsx` | — |
| `/economy` | `src/pages/Economy.jsx` | `economy/` |
| `/performance` | `src/pages/PerformanceDashboard.jsx` | — |
| `/bot-performance-history` | `src/pages/BotPerformanceHistory.jsx` | — |
| `/audit` | `src/pages/ActivityAuditLog.jsx` | — |
| `/bot-automations` | `src/pages/BotAutomations.jsx` | — |
| `/compliance` | `src/pages/ComplianceCenter.jsx` | — |
| `/security-dashboard` | `src/pages/SecurityDashboard.jsx` | — |
| `/privacy-policy` | `src/pages/PrivacyPolicy.jsx` | — |
| `/role-management` | `src/pages/RoleManagement.jsx` | — |
| `/blockchain-analytics` | `src/pages/BlockchainAnalytics.jsx` | — |
| `/wallet-manager` | `src/pages/WalletManager.jsx` | — |
| `/transactions` | `src/pages/TransactionHistory.jsx` | — |
| `/bot-marketplace` | `src/pages/BotMarketplace.jsx` | `ailab/` |
| `/bot-mini-app` | `src/pages/BotMiniApp.jsx` | `bot-mini-app/` |
| `/squad-performance` | `src/pages/SquadPerformance.jsx` | `ailab/` |
| `/squad-knowledge-trends` | `src/pages/SquadKnowledgeTrends.jsx` | `ailab/` |
| `/bot-farm` | `src/pages/BotFarm.jsx` | `bot-farm/` |
| `/agent-operations` | `src/pages/AgentOperations.jsx` | `ailab/` |
| `/analytics` | `src/pages/AnalyticsHub.jsx` | `analytics/`, `dashboard/` |
| `/bazar-stand` | `src/pages/BazarStand.jsx` | `bazar/` |
| `/escrow-dashboard` | `src/pages/EscrowDashboard.jsx` | `escrow/` |
| `/referrals` | `src/pages/ReferralDashboard.jsx` | `referrals/` |
| `/eru-swarm-test` | `src/pages/EruSwarmTest.jsx` | — |
| `/eru-redteam-test` | `src/pages/EruRedteamTest.jsx` | — |
| `/admin/bazar-products` | `src/pages/AdminBazarProducts.jsx` | — |
| `/sheets-sync` | `src/pages/SheetsSync.jsx` | — |
| `/storefront/phoenix-investor` | `src/pages/PhoenixInvestor.jsx` | `storefront/` |
| `/admin/review` | `src/pages/AdminReviewCenter.jsx` | — |
| `/admin/security` | `src/pages/SecurityCommandCenter.jsx` | — |
| `/admin/security-test` | `src/pages/SecurityTestRunner.jsx` | — |
| `/admin/secure-slice` | `src/pages/SecureSliceLab.jsx` | — |
| `/language-diagnostics` | `src/pages/LanguageDiagnostics.jsx` | — |
| `/player-progress` | `src/pages/PlayerProgress.jsx` | `progress/` |
| `/lore-insights` | `src/pages/LoreInsights.jsx` | `insights/` |
| `/preferences` | `src/pages/Preferences.jsx` | `preferences/` |
| `/library` | `src/pages/Library.jsx` | `library/` |
| `/deck-builder` | `src/pages/DeckBuilder.jsx` | `cards/` |
| `/guilds` | `src/pages/Guilds.jsx` | `guilds/` |
| `/about` | `src/pages/About.jsx` | — |
| `/app-store` | `src/pages/AppStore.jsx` | `appstore/` |
| `/dev-lab` | `src/pages/JackieDevLab.jsx` | `devlab/` |
| `/card-scanner` | `src/pages/CardScanner.jsx` | `pricing/` |
| `/integrations` | `src/pages/IntegrationHub.jsx` | `integrations/`, `pricing/` |
| `/community` | `src/pages/Community.jsx` | — |
| `/bot-lab` | `src/pages/SimTradingLab.jsx` | — |
| `/bot-forge` | `src/pages/BotForge.jsx` | — |
| `/bot-studio` | `src/pages/BotStudio.jsx` | `botstudio/` |
| `/media-converter` | `src/pages/MediaConverter.jsx` | `media/` |
| `/music` | `src/pages/MediaLibrary.jsx` | `media/` |
| `/playlists` | `src/pages/Playlists.jsx` | — |
| `/playlists/:id` | `src/pages/PlaylistDetail.jsx` | `media/` |
| `/collab/:id` | `src/pages/CollabPlaylistDetail.jsx` | `media/` |
| `/p/:id` | `src/pages/SharedPlaylist.jsx` | — |
| `/discover` | `src/pages/Discover.jsx` | — |
| `/listening` | `src/pages/Listening.jsx` | — |
| `/team-builder` | `src/pages/TeamBuilder.jsx` | — |
| `/command` | `src/pages/AppCommander.jsx` | `commander/`, `dashboard/`, `jackie/` |
| `/data` | `src/pages/DataPortability.jsx` | — |
| `/vault` | `src/pages/Vault.jsx` | `vault/` |

## Page files with no route

These exist in `src/pages/` but `src/App.jsx` does not mount them. Check before deleting or wiring them up.

| File | Note |
|---|---|
| `src/pages/Marketplace.jsx` | uses `src/components/BiddingHistory.jsx`, `src/components/marketplace/` |
| `src/pages/OAuthConsent.jsx` | OAuth consent screen (uses `src/lib/app-params.js`) |
| `src/pages/Studio.jsx` | theme, background and layout picker (older; theming now lives in `/visual`) |
| `src/pages/Workstation.jsx` | stub that redirects to `/visual` (merged into Visual Engine) |
