# RAPP/1 rev-5 structural identity vectors

This dependency-free Node 20+ suite checks the exact case-sensitive identity
grammar and the rev-5 byte hash:

`Hb(space, bytes) = SHA-256(utf8(space) || 0x0A || bytes)`

For keyless identities, the bytes are the 16 raw UUIDv4 octets. For keyed
identities, they are the DER SubjectPublicKeyInfo bytes. The negative vectors
cover untagged SPKI hashing, printable UUID hashing, owner/slug hashing, legacy
grammar, uppercase labels or tails, short tails, and invalid hyphen placement.

```text
node conformance/run-conformance.mjs
node conformance/waiver-freshness.mjs
```

These checks are structural only. They do not verify an owner signature,
authenticated registry, provenance, succession, revocation, genesis, or
acceptance state.

`waivers.json` is an empty, non-authoritative retirement ledger. The waiver
check is deterministic and offline; any live entry fails. Historical waivers
remain available only in Git history.
