# Phase 1 Cryptography Architecture Decisions

## 1. Approved Cryptographic Profile

## At Rest
- AES-256-GCM as default at-rest encryption primitive.
- ChaCha20-Poly1305 allowed as constrained-environment fallback profile.
- Hybrid readiness path defined for post-quantum transition with Kyber-based key encapsulation when approved.

## In Transit
- TLS 1.3 only, no fallback to older protocol versions.
- Perfect Forward Secrecy required for every session.
- Strong key agreement profiles only (high-strength DH/ECDHE as approved in deployment environment).

## Key Derivation and Expansion
- PBKDF2-SHA512 profile available for compatibility-bound flows.
- Argon2id profile preferred for password-derived key hardening.
- HKDF-SHA256 used for key expansion and context separation.

## Signatures and Integrity
- Ed25519 preferred for modern signing workflows.
- RSA-4096 retained for legacy interoperability requirements.
- Timestamp authority integration required for non-repudiation workflows.

## 2. Key Lifecycle Policy

1. **Generation**
   - Key material generated only in approved cryptographic boundary.
2. **Storage**
   - Key encryption keys and data encryption keys remain logically separated.
   - Root and intermediate keys are hardware-backed where available.
3. **Rotation**
   - Cryptoperiod policy enforced by key class and data sensitivity.
4. **Revocation**
   - Compromised or expired keys are revoked and blocked immediately.
5. **Destruction**
   - End-of-life key material follows cryptographic erasure protocol with signed evidence.

## 3. HSM / TEE Integration Points

- HSM integration for root key custody and signing authorities.
- TEE path for local sensitive cryptographic operations on endpoint devices.
- No plaintext key export from hardware trust boundary.
- Attestation evidence required before sensitive key use.

## 4. Side-Channel and Implementation Controls

- Constant-time verification for signature and MAC comparisons.
- Explicit nonce/IV uniqueness enforcement for AEAD modes.
- Strict entropy source requirements for key and nonce generation.
- Cryptographic module inventory tracked against approved deployment profile.
