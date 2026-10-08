# Frontend map

↑ [AGENTS.md](../../AGENTS.md) · route table → [pages.md](pages.md) · components → [components.md](components.md) · logic → [lib.md](lib.md)

## Boot chain

`index.html` → `src/main.jsx` (mounts React, registers `public/sw.js`) → `src/App.jsx`
(providers + every route, pages lazy-loaded) → `src/components/Layout.jsx` (app shell,
`<Outlet/>`) → `src/pages/<Page>.jsx`

## Providers (outer → inner, all wired in `src/App.jsx`)

| Provider | Path |
|---|---|
| `ThemeProvider` | `src/context/ThemeContext.jsx` |
| `LanguageProvider` | `src/context/LanguageContext.jsx` |
| `AuthProvider` / `useAuth` | `src/lib/AuthContext.jsx` |
| `QueryClientProvider` | `src/lib/query-client.js` |
| `MediaPlayerProvider` | `src/context/MediaPlayerContext.jsx` |
| `ErrorBoundary` | `src/components/ErrorBoundary.jsx` |
| Dashboard event bus (not global) | `src/context/DashboardEventsContext.jsx`, `src/components/dashboard/DashboardEventContext.jsx` |
| Side-effect imports at load | `src/lib/paymentGuards.js`, `src/lib/assetGrant.js` |

## Routing

| Task | Path |
|---|---|
| All routes (one `<Routes>` block) | `src/App.jsx` |
| Route → file table | [pages.md](pages.md) |
| 404 page | `src/lib/PageNotFound.jsx` |
| Not-registered screen | `src/components/UserNotRegisteredError.jsx` |
| `createPageUrl(name)` helper | `src/utils/index.ts` |

**Add a page:** create `src/pages/<Name>.jsx` (default export) → add a `lazy()` import and
a `<Route>` inside the `<Route element={<Layout />}>` block in `src/App.jsx` → add a nav
entry if needed (see Shell) → add i18n keys → add a row to [pages.md](pages.md).

## Shell & navigation

| Piece | Path |
|---|---|
| App shell (background, nav, global widgets) | `src/components/Layout.jsx` |
| Bottom nav (item list at top of file) | `src/components/CenteredBottomNav.jsx` |
| Mobile tab bar, bottom sheet, pull-to-refresh | `src/components/mobile/` |
| Nav walkthrough, quick-actions popover | `src/components/nav/` |
| Global search | `src/components/GlobalSearch.jsx` (calls the `globalSearch` server function; not connected) |
| Floating bot widget | `src/components/BotWidget.jsx` |
| Notes widget | `src/components/notes/` |
| Persistent media player | `src/components/media/PersistentPlayer.jsx` |
| Offline banner | `src/components/botstudio/OfflineBanner.jsx` |
| Ticker bar, screen visualizer | `src/components/dashboard/TickerBar.jsx`, `src/components/dashboard/ScreenVisualizer.jsx` |
| Animated background, page theme layer | `src/components/AnimatedBackground.jsx`, `src/components/theme/PageThemeLayer.jsx` |
| UI sounds / haptics | `src/lib/soundEngine.js`, `src/components/SoundSettings.jsx` |

## Auth & access control

| Piece | Path |
|---|---|
| Session, user, login redirect | `src/lib/AuthContext.jsx` (always signed out while no backend is connected) |
| Auth pages | `src/pages/Login.jsx`, `Register.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx`, `src/components/AuthLayout.jsx` |
| Route / role / permission gates | `src/components/ProtectedRoute.jsx`, `RoleGate.jsx`, `PermissionGate.jsx` |
| Role and permission helpers | `src/lib/permissions.js`, `src/lib/rbac.js` |
| MFA, biometric | `src/components/MFAVerification.jsx`, `src/components/BiometricAuth.jsx` |
| More | [security.md](security.md) |

## Data access

| Piece | Path |
|---|---|
| Backend client (connects to nothing, see [backend.md](backend.md)) | `src/api/backend.js` |
| React Query client | `src/lib/query-client.js` |
| Short-lived cache | `src/lib/metadataCache.js` |
| Offline cache + write queue | `src/lib/offlineDb.js`, `src/lib/botStudioStore.js` |

### Hooks (`src/hooks/`)

| Hook | For |
|---|---|
| `use-mobile.jsx` | mobile breakpoint |
| `useConfirmAction.js` | confirm-before-action dialogs (`src/components/ConfirmDialog.jsx`) |
| `useCryptoPrices.js`, `useRealPrices.js` | price feeds |
| `useFeatureTracking.js` | feature analytics |
| `useInstalledModules.js` | App Store modules (`src/lib/appStoreModules.js`) |
| `useLiveSync.js` | live market prices (Binance WebSocket) |
| `useSelection.js` | multi-select state |
| `useWallet.js` | wallet connection |

## Styling & design system

| Piece | Path |
|---|---|
| Tailwind config | `tailwind.config.js`, `postcss.config.js` |
| Global CSS and CSS variables | `src/index.css` |
| shadcn config (style, aliases) | `components.json` |
| shadcn primitives (generated) | `src/components/ui/` |
| `cn()` class merge | `src/lib/utils.js` |
| Fleet eYe theme (do not edit here) | `src/fleet-ui/` ([services.md](services.md#fleet-design-kit)) |
| Theme state / engine | `src/context/ThemeContext.jsx`, `src/lib/themeEngine.js`, `src/components/theme/` |
| Light/dark sync with OS | `App()` in `src/App.jsx` |
| Icons | `lucide-react` |
| Toasts | `sonner` (most files), `src/components/ui/toaster.jsx` (mounted in `src/App.jsx`) |

## i18n

| Piece | Path |
|---|---|
| All strings, all locales | `src/lib/translations.json` |
| Loader, `useLanguage()`, `t(key, vars, fallback)` | `src/context/LanguageContext.jsx` |
| `<T k=…/>` component | `src/components/T.jsx` |
| Language switcher | `src/components/LanguageSwitcher.jsx` |
| How-to (adding keys, Crowdin) | `src/lib/TRANSLATIONS_README.md` |
| Budget lint, audit, seed | `scripts/lint-i18n.mjs`, `scripts/i18n-budget.json`, `scripts/audit-strings.mjs`, `scripts/seed-i18n-budget.mjs` |
| Crowdin sync config | `crowdin.yml` |
| Diagnostics page | `src/pages/LanguageDiagnostics.jsx` (`/language-diagnostics`) |

Rule: add each key to every locale block, call `t('section.key', undefined, 'English fallback')`, and run `npm run lint:i18n`.

## Conventions

- Import from `src` with `@/…` (`jsconfig.json`; the Vite alias comes from the plugin in `vite.config.js`).
- JavaScript/JSX. The only TypeScript files are `src/utils/index.ts` and `src/lib/jackyClient.ts`.
- Pages: one default-exported component per file in `src/pages/`, lazy-loaded from `src/App.jsx`.
- Feature UI lives in `src/components/<feature>/`; shared logic lives in `src/lib/`.
- Lint (`eslint.config.js`): unused imports are errors; prefix intentionally unused variables with `_`; prop-types are off.
- Mobile-first: test at phone width (`src/components/mobile/`, `src/hooks/use-mobile.jsx`).
