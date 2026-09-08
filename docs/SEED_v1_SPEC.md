# SEED v1 — Canonical Spec

## Overview

**Purpose:** SEED v1 is a living, single-page system for managing contextual micro-AI routers, reversible knowledge-preserving compression (eYe), and QPDB symbol-pair keying. It supports nested (Russian-doll) compression, deterministic rehydration, and a truth-finding loop across nested routers.

**Scope:** Documentation and instructions only — no UI code included in this artifact. This file defines the canonical interfaces and behaviors that UIs, agents, and test harnesses will implement.

**Guarantees:** 100% reversible compression, topology preservation, router-scoped key sovereignty, atomic nested rehydration, and fail-safe Ash disintegration on corruption.

## Architecture (high level)

### Core components

- **Router (micro-AI):** stateful contextual agent with identity, inference graphs, and local keyset.
- **Compression Engine (eYe):** implements the 3-pass pipeline (Structural → Relational → Geometric) and spherical collapse → density scaling.
- **QPDB Key System:** symbol-pair binding, non-commutative composition, rotation/swap lifecycle, k-of-n recovery.
- **Seed Store:** persistent store of seeds (eYe dots) containing sphere_blob, topology_hash, seed_binding_fingerprint, metadata. No raw pairs stored.
- **Seedling DNA:** immutable ruleset for integrity checks, drift detection, quarantine, and Ash policy.
- **Ash Manager:** disintegration and safe residue handling; rehydration rules for Ash.
- **Terminal/Agent Interface (spec only):** chat/command interface for operator actions, key management, and audit viewing.

### Data model (canonical)

- **Pair:** `{ S1, S2, M }` where `M = { router_id, context_hash, direction, weight, timestamp, version }`
- **Binding Vector:** `V = bind_pair(Pair, topology_hash)` (deterministic, non-invertible)
- **Seed Binding Composition:** `SeedBinding = compose_non_linear(V1, V2, ..., Vn)` (order sensitive)

## Module contracts and APIs

### Compression Engine (public functions)

```
create_seed(router_state, local_pairs) -> seed_id
```
Runs Pass 1..3, spherical collapse, density scale, computes topology_hash, binds QPDB vectors, stores seed.

```
rehydrate_seed(seed_id, provided_pairs) -> router_state | FAIL
```
Validates DNA, recomposes binding, expands density, unfolds, reconstructs router. Atomic per layer.

### QPDB Key System

```
bind_pair(pair, topology_hash) -> vector
compose_non_linear(vectors[]) -> seed_binding
rotate_pair(pair, nonce, router_private_key) -> pair'
rotate_seed(seed_id, rotation_plan) -> success|fail
validate_binding(seed_binding, provided_pairs, topology_hash) -> bool
```

### Seedling DNA & Safety

```
validate_seedling_DNA(seed) -> bool
disintegrate_to_ash(seed_id, reason) -> ash_id
rehydrate_ash(ash_id, provided_pairs, k_threshold) -> seed_id | FAIL
```

### Audit & Monitoring

```
append_audit(entry) — immutable append only.
query_audit(filters) -> entries[] — for monitoring and forensic.
```

## Operational flows (deterministic sequences)

### Create and compress a router

1. Router prepares local pairs in secure enclave.
2. Call `create_seed(router_state, local_pairs)`.
3. Engine runs Pass 1..3 → eYe dot → compute topology_hash.
4. Bind QPDB vectors and compose seed_binding.
5. Store seed and append audit entry.

### Nested compression (Russian Doll)

1. Compress inner router first → produce inner seed.
2. Outer router includes inner seed as payload and runs `create_seed` on its own state (which contains inner seed).
3. Seeds nest; metadata records nesting depth and child seed fingerprints.

### Rehydration (outer→inner)

1. Provide outer router pairs to `rehydrate_seed(outer_seed_id, outer_pairs)`.
2. Validate DNA and binding; expand and reconstruct outer router.
3. Outer router requests inner rehydration; provide inner pairs; repeat.
4. Each layer resumes truth cycle and may re-compress results.

### Rotation and swap lifecycle

1. Rotation plan: indices, nonce, schedule.
2. `rotate_seed(seed_id, rotation_plan)` performs atomic rotation and appends signed rotation event.
3. Swap is reorder/replace; recompute binding and audit.

### Failure and Ash

1. On DNA validation failure or detected drift/malicious code: quarantine or `disintegrate_to_ash`.
2. Ash is symbolic residue; rehydration requires k-of-n keys + DNA validation.

## Tests, validation, and CI

### Core test suites

- **Unit tests:** each compression pass deterministic reversibility.
- **Round-trip tests:** compress → rehydrate 10k random router states; assert functional parity.
- **Nested tests:** 3-level nested compression repeated 1k times.
- **QPDB robustness:** single/multi pair perturbations; rotation replay tests.
- **Ash tests:** forced disintegration and rehydration with k-of-n.
- **Performance benchmarks:** measure latency on target Windows rig (RTX3090, 128GB).

### Test harness structure (suggested)

```
/tests
  rotation_tests.py
  roundtrip_tests.py
  nested_tests.py
  ash_tests.py
  perf_benchmarks.py
```

## File layout (repo)

```
/docs
  SEED_v1_SPEC.md
  SymbolPairRotation.md
  QPDB_KeySystem.md
  eYeCompression.spec
  NestedRouterCompression.md
  RouterRehydrationProtocol.md
  SeedlingDNA_FoundationRules.md
/tests
  ...
/src
  /compression
    engine.py
    geometry.py
  /qpdb
    binder.py
    rotation.py
  /seed_store
    store.py
    ash_manager.py
  /terminal_spec
    assistant_prompt.txt
    api_contracts.md
```

## Implementation checklist (practical priorities)

1. Commit `SEED_v1_SPEC.md` (this document) to `/docs`.
2. Generate `SymbolPairRotation.md` and `QPDB_KeySystem.md` next (core cryptographic/logic spec).
3. Implement `engine.create_seed` and `engine.rehydrate_seed` as reference pseudocode.
4. Build Python test harness and run round-trip tests.
5. Implement audit log and Seedling DNA checks.
6. Add rotation manager and Ash manager.
7. Produce terminal assistant prompt and minimal CLI for operator flows.
8. Run nested compression tests and performance benchmarks on your RTX3090 rig.