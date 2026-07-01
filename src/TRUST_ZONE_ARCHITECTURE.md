# Trust-Zone Architecture Boundaries (v1)

## zones
1. **Client Runtime Zone (untrusted-by-default):** browser execution, UI gates, local encryption/decryption operations.
2. **Application Control Zone:** authentication context, role-based access checks, secure-slice orchestration logic.
3. **Audit Integrity Zone:** append-only hash chain persisted locally and exported for verification.
4. **Incident Response Zone:** lockout/wipe state machine and incident event emission.
5. **Backend Enforcement Zone (required for production):** authoritative RLS, webhook verification, identity controls.

## boundary principles
- UI authorization is advisory unless matched by backend enforcement.
- Audit records are append-only and hash-linked to make tampering detectable.
- Incident controls (lockout/wipe) are deterministic and always logged.
- Offline operation keeps secure-slice capability local without requiring network.

## data flows
- **Create document:** plaintext -> KDF -> AES-GCM encrypt -> signature -> vault storage -> audit append.
- **Unlock document:** passphrase -> KDF -> decrypt -> signature verify -> read access -> audit append.
- **Failure path:** invalid passphrase -> failed-attempt counter -> lockout/wipe decision -> audit append.
- **Expiry path:** TTL reached -> auto-destruction event -> audit append.
