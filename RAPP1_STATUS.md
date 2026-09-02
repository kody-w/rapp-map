# NOT YET FULLY RAPP/1 CONFORMANT

The repository is structurally aligned to the pinned rev-5 authority. The
RAPP/1 section 13 registry **was published and signed by the estate owner on
2026-09-01** (`ecosystem-spec.json`, registry_seq 1); the standing guard verifies
that signature with Node built-ins on every run. "Not yet fully conformant"
remains true for other reasons: the authority pin is rev-5 while the anchor head
is rev-14 (issue #14), and open drift issues remain.

## Exact authority

- Repository: `kody-w/rapp-1`
- Commit: `d2cd5abed48d3f52b86bbb975ac3558286d1db41`
- Path: `SPEC.md`
- Bytes: `41952`
- SHA-256: `cea7847f98f9751734995f46fd4e1bde211c8eb9d03dbbb477934213865bb91a`

The machine-readable pin is
[`RAPP1_AUTHORITY.json`](RAPP1_AUTHORITY.json).

## Current disposition

- This repository is a read-only map and observation surface.
- `ecosystem-spec.json` is the estate's signed `rapp/1-registry` (registry_seq 1,
  detached JWS EdDSA by the estate owner). Its signature is verified, never assumed.
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

## Owner action: recorded

The section 13 owner action is **closed**: the estate-owner key was minted (held
outside every repository), the registry was signed and published, and the public
halves (rappid, SPKI, sequence, source, digest, signature) are recorded in
[`RAPP1_OWNER_ACTIONS.json`](RAPP1_OWNER_ACTIONS.json). Consumers verify the
signature against the out-of-band estate-owner rappid published in
`kody-w/rapp-1`'s README; they do not take this file's word for it.
