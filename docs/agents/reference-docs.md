# Reference documents map

↑ [AGENTS.md](../../AGENTS.md)

Every Markdown document in the repo, one line each. The maps in `docs/agents/` and the code
are the current state of things. Plans and audits below can be out of date, so check the code
before acting on them.

## Agent navigation

| Path | What |
|---|---|
| `CLAUDE.md` | pointer only → `AGENTS.md` |
| `AGENTS.md` | global agent map (rules, task router, top-level tree) |
| `docs/agents/*.md` | area maps: commands, frontend, pages, components, lib, backend, features, security, services, reference-docs |

## Project & fleet

| Path | What |
|---|---|
| `README.md` | short human intro and local setup |
| `FLEET_PARITY_PLAN.md` | plan to bring PC, Eru, Jackie and Empath to feature parity |
| `PARITY_MATRIX.md` | living parity tracker per capability |
| `src/fleet-ui/README.md` | shared eYe design kit |
| `docs/SEED_v1_SPEC.md` | SEED v1 spec: micro-AI routers, reversible eYe compression, QPDB keys (spec only, no UI) |

## Product & feature plans

| Path | What |
|---|---|
| `src/SOCIAL_LAYER_PLAN.md` | social platform architecture and phases |
| `src/ENTITY_SETUP.md` | entities to create for Community and Bot Lab (fields + access) |
| `src/lib/TRANSLATIONS_README.md` | i18n workflow and Crowdin |

## Economy & payments

| Path | What |
|---|---|
| `src/PAYMENT_VERIFICATION_RULES.md` | no grant without a verified transaction id |
| `src/ECONOMY_VERIFICATION.md` | economy and transaction verification layer |
| `src/ECONOMY_LOCKDOWN.md` | server-side economy hardening status and remaining migration |
| `src/JADE_ECONOMY_DROP.md` | Jade drop system design |

## Security & compliance ([security.md](security.md))

| Path | What |
|---|---|
| `src/SECURITY_AUDIT_SUMMARY.md` | executive audit summary (2026-04-10) |
| `src/SECURITY_AUDIT_COMMERCIAL_DEPLOYMENT.md` | full audit for app stores and the Telegram Mini App |
| `src/SECURITY_IMPLEMENTATION_CHECKLIST.md` | step-by-step fixes from the audit |
| `src/SECURITY_BACKLOG_V1.md` | prioritized security backlog |
| `src/THREAT_MODEL_CONTROL_MATRIX.md` | threat model and controls |
| `src/TRUST_ZONE_ARCHITECTURE.md` | trust-zone boundaries |
| `src/CRYPTOGRAPHY_BASELINE.md` | crypto baseline |
| `src/GOVERNMENT_V1_SCOPE.md` | government v1 accreditation scope |
| `src/ACCREDITATION_EVIDENCE_PACKAGE.md` | accreditation evidence scaffold |
| `src/security/CRYPTO_ARCHITECTURE_DECISIONS.md` | phase 1 crypto decisions |
| `src/security/SYSTEM_BOUNDARIES_AND_DATA_FLOWS.md` | phase 1 boundaries and data flows |
| `src/security/INCIDENT_RESPONSE_AND_DESTRUCTION_CONTROLS.md` | phase 1 incident response controls |

## Side services ([services.md](services.md))

| Path | What |
|---|---|
| `router-console/README.md` | Router Console PWA overview |
| `router-console/QUICK_START.md` | phone quick start |
| `router-console/PHONE_DEPLOYMENT.md` | iPhone deployment guide |
| `media-converter/README.md` | media converter deploy and config |
