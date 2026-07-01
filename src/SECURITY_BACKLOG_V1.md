# Compliance-First Security Backlog (v1)

## priority P0 (must complete before ATO packet)
- Implement backend authoritative authorization (RLS and service-side checks).
- Enforce TLS 1.3-only and certificate pinning policy in deployment edge.
- Wire immutable audit export with retention and chain verification checks.
- Validate lockout/wipe behavior through scripted test evidence.

## priority P1 (v1 hardening)
- Add incident routing integrations (security officer notifications).
- Add configurable M-of-N approval workflow for destructive operations.
- Add device posture and attestation hooks for managed endpoints.
- Extend secure-slice signature path to backend-managed key material.

## priority P2 (post-v1 roadmap)
- Introduce HSM-backed signing and key lifecycle controls.
- Add post-quantum hybrid KEM path behind controlled feature flag.
- Add formal FedRAMP IL5 cloud deployment profile package.
