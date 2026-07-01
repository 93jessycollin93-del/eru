# Government v1 Accreditation Scope

## v1 accreditation target
- **Deployment profile:** NIPR on-premises first.
- **Connectivity profile:** internet-connected DoD network with explicit offline fallback for disconnected operations.
- **Out of v1:** cloud-hosted FedRAMP IL5 deployment, SIPR transfer workflow automation, and multi-agency cross-domain replication.

## data classification supported in v1
- **Controlled Unclassified Information (CUI):** fully in scope.
- **FOUO / Official Use Only:** in scope under the same CUI control set.
- **SECRET / TS/SCI:** explicitly out of scope for production claims until separate accreditation boundary and hardware controls are completed.

## v1 system boundary
- Web client running on government-managed endpoints.
- Secure-slice cryptography and local audit chain in the app boundary.
- Backend authorization/RLS and webhook verification required before production authority-to-operate.

## gating criteria before v1 ATO submission
1. Control implementation evidence mapped to NIST SP 800-171 control families.
2. FIPS-validated module usage for cryptographic operations in production deployment path.
3. Incident response playbooks and lockout/destruction procedures tested.
4. Audit log integrity validation and retention workflow documented.
