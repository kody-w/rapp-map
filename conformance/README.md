# RAPP/1 rev-5 structural identity vectors

This dependency-free Node 20+ suite checks the exact case-sensitive identity
grammar and the rev-5 byte hash:

`Hb(space, bytes) = SHA-256(utf8(space) || 0x0A || bytes)`

For keyless identities, the bytes are the 16 raw UUIDv4 octets. For keyed
identities, the parser re-exports DER SubjectPublicKeyInfo and requires exact
byte equality before hashing. Negative vectors include one-byte and four-byte
trailing garbage, a malformed DER length, untagged SPKI hashing, printable UUID
hashing, owner/slug hashing, and exact mutations of a valid grammar control.
Format 3 binds every required ID to a code-owned verdict and normalized fixture
digest.

```sh
bash .github/scripts/run-offline-gates.sh
```

These checks are structural only. They do not verify an owner signature,
authenticated registry, provenance, succession, revocation, genesis, or
acceptance state.

`waivers.json` is an empty, non-authoritative retirement ledger; any live entry
fails. Every Node check requires the checked-in project-process guard. That
guard is not host sandbox enforcement. Historical waivers remain available
only in Git history.
