# Phase 1 System Boundaries and Data Classification Flows

## 1. Security Domains

| Domain | Network Context | Connectivity Profile | Allowed Data Classes |
|---|---|---|---|
| SIPR | Air-gapped classified network | No direct internet | SECRET, TS/SCI (as authorized) |
| NIPR | Government unclassified network | Controlled internet connectivity | CUI, mission metadata, sanitized operational logs |
| Offline Field Mode | Air-gapped tactical operation | No external network until controlled sync | Mission-local encrypted working set |

## 2. Trust Boundaries

1. **Device Boundary**
   - Government-managed endpoint only.
   - Hardware attestation and MDM policy enforcement required.
2. **Execution Boundary**
   - Sensitive cryptographic operations execute in trusted boundary (HSM/TEE path).
3. **Network Boundary**
   - SIPR and offline paths have no dependency on public services.
   - NIPR paths use pinned certificates and approved transport profile.
4. **Storage Boundary**
   - Classified payloads remain encrypted at rest with key-material separation.

## 3. Data Classes and Handling Rules

| Data Class | Examples | Storage Rule | Transit Rule | Destruction Rule |
|---|---|---|---|---|
| Public | Non-sensitive UI assets, release metadata | Standard storage | TLS required | Standard retention policy |
| CUI | Access logs, compliance metadata, user operational profile | AES-256-GCM at rest | TLS 1.3+ | NIST SP 800-88-compliant destruction |
| SECRET | Mission docs, classified records | AES-256-GCM + segmented key custody | Approved encrypted channels only | Cryptographic erasure + signed destruction evidence |
| TS/SCI | Compartmented intelligence artifacts | Hardware-backed key custody + strict isolation | Dedicated classified transport only | Immediate cryptographic shredding under policy triggers |

## 4. Data Flow Map (Phase 1)

### A. SIPR Path (Classified)
1. User authenticates on attested government endpoint.
2. Vault decrypt operations occur in trusted execution boundary.
3. Classified artifacts remain in encrypted storage domain.
4. Audit events are written to immutable signed log channel.
5. Synchronization occurs only via approved secure transfer process.

### B. NIPR Path (Controlled Unclassified)
1. User authenticates with strong identity proofing.
2. CUI and policy-approved metadata are processed.
3. In-transit protection uses TLS 1.3 and certificate pinning.
4. Audit and compliance telemetry streams to approved monitoring stack.

### C. Offline Field Path (Air-Gapped)
1. System enters explicit offline mode indicator state.
2. Operations run from pre-authorized encrypted working set.
3. Battery optimization mode is enabled for mission continuity.
4. Signed local audit buffer accumulates evidence until controlled sync.

## 5. Boundary Enforcement Requirements

- Cross-domain data movement requires explicit policy decision and audit record.
- No direct downgrade from classified to unclassified channels without sanitization controls.
- Offline cache cannot bypass classification labels or retention controls.
- All boundary transitions must emit immutable evidence events.
