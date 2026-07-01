# Cryptography Baseline (v1 Implementable)

## approved v1 baseline
- **Data encryption at rest (app secure slice):** AES-256-GCM.
- **Passphrase derivation:** PBKDF2 with SHA-512, 500,000 iterations minimum.
- **Integrity hashing:** SHA-256 for audit chain linkage.
- **Document signature (v1 software baseline):** HMAC-SHA256 over canonical payload.

## non-v1 or conditional controls
- **Argon2id:** deferred unless production runtime includes vetted implementation path.
- **Post-quantum KEM (Kyber/NTRU):** roadmap only; not claimed in v1 ATO package.
- **Ed25519/RSA-4096 production signatures:** target for backend/HSM phase where key lifecycle and compliance can be enforced.
- **HSM/TEE integration:** out of v1 software-only secure slice boundary.

## claims removed from v1 acceptance language
- No claim that browser-only implementation is NSA/CNSA certified.
- No claim that frontend-only controls satisfy full FIPS module validation.
- No claim that v1 supports SECRET/TS data handling authority.

## implementation notes
- Cryptographic keys must never be hard-coded or shipped as static bundle secrets.
- Security posture messaging must distinguish implemented controls from backend-required controls.
