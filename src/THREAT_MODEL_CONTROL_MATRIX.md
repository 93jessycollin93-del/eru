# Threat Model and Control Matrix (v1)

## threat model summary

### assets
- Encrypted vault documents
- User authentication and authorization state
- Audit chain and incident telemetry
- Encryption/signing material

### adversaries
- Unauthorized external attacker
- Malicious insider with valid account
- Endpoint compromise/tamper attempts
- Network MITM and replay attacker

### key attack surfaces
- Authentication and session flows
- Vault decryption attempts (brute-force / credential stuffing)
- Audit log tampering
- Data exfiltration over network channels
- Compromised client runtime state

## control matrix

| Requirement | Threat addressed | Control implementation direction | Framework mapping |
|---|---|---|---|
| Offline mode indicator | Misinterpretation of trust boundary in disconnected operation | Explicit online/offline posture state in UI and audit events | NIST 800-171 3.1, 3.3 |
| Battery optimization mode | Operational degradation in field use | Low-power polling and reduced background activity option | NIST 800-171 3.4 |
| AES-256-GCM at rest | Data disclosure from stolen storage | AEAD encryption for vault payloads | FIPS 140-2/140-3, NIST SP 800-38D |
| TLS 1.3 in transit | MITM / downgrade attacks | TLS 1.3-only enforcement at ingress | NIST 800-171 3.13, CNSA transport baseline |
| PBKDF2-SHA512 (500k+) | Offline brute-force against passphrases | Strong KDF settings for vault key derivation | NIST SP 800-132, FIPS-approved primitive |
| Document signatures | Undetected tampering/non-repudiation gaps | Per-document signature and verify path | NIST 800-171 3.3, 3.8 |
| Immutable audit chain | Audit manipulation | Hash-chain linked append-only audit entries | NIST 800-171 3.3 |
| Failed-attempt lockout | Online password guessing | Progressive lockout policy (3 failures => timed lockout) | NIST 800-171 3.1 |
| Cryptographic wipe control | Data compromise after repeated abuse | Wipe trigger removes vault material and records incident | NIST 800-171 3.8, 3.13 |
| Incident escalation workflow | Delayed response to compromise | Structured incident events and handoff artifacts | NIST 800-171 3.6 |

## residual risks requiring backend/ops controls
- Server-side authorization and row-level security are outside frontend verification.
- Device attestation and hardware-backed key custody are not yet implemented in v1 secure slice.
- Federal compliance claims require independent assessor evidence and cannot be inferred from UI checks.
