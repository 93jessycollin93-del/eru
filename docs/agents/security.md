# Security, privacy & compliance map

↑ [AGENTS.md](../../AGENTS.md) · all documents → [reference-docs.md](reference-docs.md) · gates in CI → [commands.md](commands.md#ci)

## Security guard (runs in CI and daily)

| Path | Role |
|---|---|
| `scripts/security-guard.mjs` | the 12 repo rules ([AGENTS.md](../../AGENTS.md#security-rules-enforced)) |
| `scripts/security-guard.config.json` | allow-lists: hosts, HTML-insertion files, CI actions, commit identities, required agent deny rules |
| `scripts/__tests__/security-guard.test.mjs` | proves each rule catches what it claims |
| `.github/workflows/security-guard.yml` | runs it on push, PR and daily; a failure emails the owner |
| `.claude/settings.json` | agent deny/ask rules, plugins off, bypass mode off |

## Compliance gate (runs in CI)

| Path | Role |
|---|---|
| `scripts/validate-security-compliance.mjs` | the gate (`npm run compliance:security`) |
| `src/security/PHASE1_CONTROL_MATRIX.json` | controls and required frameworks (NIST SP 800-171, FIPS 140-3, FedRAMP IL5, DoD SRG) |
| `src/security/ACCEPTANCE_TEST_GATES.json` | release-blocking acceptance gates |
| `src/security/FEATURE_COMPLIANCE_REGISTRY.json` | per-feature compliance registry |
| `scripts/__tests__/validate-security-compliance.test.mjs`, `scripts/__tests__/security-compliance-artifacts.test.mjs` | gate tests (`node --test scripts/__tests__/*.test.mjs`) |

If you add a feature that the registry should cover, update `FEATURE_COMPLIANCE_REGISTRY.json` and rerun the gate.

## Security documents

| Path | Topic |
|---|---|
| `src/security/CRYPTO_ARCHITECTURE_DECISIONS.md` | approved crypto profile |
| `src/security/SYSTEM_BOUNDARIES_AND_DATA_FLOWS.md` | security domains and data classes |
| `src/security/INCIDENT_RESPONSE_AND_DESTRUCTION_CONTROLS.md` | incident response and destruction controls |
| `src/CRYPTOGRAPHY_BASELINE.md` | AES-256-GCM, PBKDF2-SHA512, SHA-256 baseline |
| `src/TRUST_ZONE_ARCHITECTURE.md` | trust zones |
| `src/THREAT_MODEL_CONTROL_MATRIX.md` | threat model and controls |
| `src/SECURITY_BACKLOG_V1.md` | prioritized security backlog |
| `src/SECURITY_AUDIT_SUMMARY.md`, `src/SECURITY_AUDIT_COMMERCIAL_DEPLOYMENT.md` | audit (2026-04-10) and verdict |
| `src/SECURITY_IMPLEMENTATION_CHECKLIST.md` | fix checklist from the audit |
| `src/GOVERNMENT_V1_SCOPE.md`, `src/ACCREDITATION_EVIDENCE_PACKAGE.md` | accreditation scope and evidence |
| `src/PAYMENT_VERIFICATION_RULES.md`, `src/ECONOMY_VERIFICATION.md`, `src/ECONOMY_LOCKDOWN.md` | economy and payment rules |

## Pages

| Route | Page | Purpose |
|---|---|---|
| `/security-dashboard` | `src/pages/SecurityDashboard.jsx` | security audit log view |
| `/admin/security` | `src/pages/SecurityCommandCenter.jsx` | readiness checks (`src/lib/securityChecks.js`) |
| `/admin/security-test` | `src/pages/SecurityTestRunner.jsx` | simulated permission attacks (`src/lib/securityTestRunner.js`) |
| `/admin/secure-slice` | `src/pages/SecureSliceLab.jsx` | secure slice (`src/lib/secureSlice.js`) |
| `/compliance` | `src/pages/ComplianceCenter.jsx` | compliance + data deletion |
| `/audit` | `src/pages/ActivityAuditLog.jsx` | activity audit log |
| `/role-management` | `src/pages/RoleManagement.jsx` | custom roles and assignments |
| `/privacy-policy` | `src/pages/PrivacyPolicy.jsx` | policy text |
| `/data` | `src/pages/DataPortability.jsx` | data import/export |
| `/vault` | `src/pages/Vault.jsx` | nested PIN vault (`src/components/vault/VaultLogin.jsx`) |
| `/user-settings` | `src/pages/UserSettings.jsx` | secret area, roles, API keys, account deletion |
| `/eru-redteam-test` | `src/pages/EruRedteamTest.jsx` | simulated red-team run |

## Code

| Layer | Paths |
|---|---|
| Gates (UI) | `src/components/ProtectedRoute.jsx`, `RoleGate.jsx`, `PermissionGate.jsx`, `MFAVerification.jsx`, `BiometricAuth.jsx` |
| Lib | `src/lib/permissions.js`, `rbac.js`, `privacy.js`, `secretAreaPin.js`, `secureSlice.js`, `securityChecks.js`, `securityTestRunner.js`, `auditEvents.js`, `safeUrl.js`, `paymentGuards.js`, `eruRedteam.js`; disabled client stubs `encryption.js`, `webhookValidator.js` |
| Components | `src/components/privacy/`, `src/components/vault/`, `src/components/settings/DeleteAccountButton.jsx`, `src/components/SecurityAnalysis.jsx`; `src/components/security/` (security operations UI, **not imported anywhere**) |
| Server calls (not connected) | encryptUserPII, deleteMyData, validatePaymentWebhook, verifyTonPayment, detectWalletSuspiciousActivity |
| Records | CustomRole, RoleAssignment, ApiKey, AuditLog, SecurityAuditLog, SecurityAlert, EconomyAuditLog, PricingAuditLog |

## Rules

- Do not put secrets in client code or `VITE_*` vars. Secrets belong only in a server's environment.
- Grant nothing of value without a verified transaction (`src/PAYMENT_VERIFICATION_RULES.md`).
- Validate external URLs with `src/lib/safeUrl.js` before rendering them.
