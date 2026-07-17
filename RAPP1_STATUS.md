# NOT YET FULLY RAPP/1 CONFORMANT

The repository is structurally aligned to the pinned rev-5 authority, but
RAPP/1 section 13 authenticated-registry evidence is absent. Structural checks
cannot establish owner acceptance.

## Exact authority

- Repository: `kody-w/rapp-1`
- Commit: `6723c7add2aed36bb68992fc71a56b0a4bd5ad81`
- Path: `SPEC.md`
- Bytes: `41880`
- SHA-256: `6d06daba65d7c045716f3d6e95db8401ab58e727820e4114466d847f62cae49b`

The machine-readable pin is
[`RAPP1_AUTHORITY.json`](RAPP1_AUTHORITY.json).

## Current disposition

- This repository is a read-only map and observation surface.
- `ecosystem-spec.json` is a fail-closed registry-path status document, not an
  accepted registry.
- `estate-map.json`, `neurons.json`, and `neurons-manifest.json` are retained
  byte-for-byte as baseline historical evidence. Their non-authoritative
  disposition and exact hashes are separate in `HISTORICAL_OBSERVATIONS.json`.
- `graph.json` format 2 separates technical conformance to the pinned protocol
  authority from section 11 Router/Mirror subordination to `kody-w/RAPP`; it
  carries no section 13 registry provenance.
- Conformance format 3 hard-binds every required vector and validates exact DER
  SPKI bytes before hashing. It does not authenticate an owner or registry.
- Live waivers cannot suppress a RAPP/1 failure.
- Local Node checks require the checked-in `rapp-map-offline-guard/1.0`
  project-process guard in a credential-empty environment. This is not host
  sandbox enforcement.

## Remaining blocker

The owner action and its acceptance tests are recorded in
[`RAPP1_OWNER_ACTIONS.md`](RAPP1_OWNER_ACTIONS.md) and
[`RAPP1_OWNER_ACTIONS.json`](RAPP1_OWNER_ACTIONS.json). Until that action is
completed and independently verified, consumers must report the repository as
structurally checked but **not accepted as fully RAPP/1 conformant**.
