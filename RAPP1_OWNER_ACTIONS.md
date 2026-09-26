# RAPP/1 owner-action ledger

This ledger is **owner-published**. It records the one known external decision,
which the estate owner has made; it does not perform that decision. Acceptance
comes from the verified signature, not from this text.

## Closed: authenticated section 13 registry

- **Why:** the registry is the signed root used for key discovery, namespace
  closure, revocation, succession, and current genesis selection. It cannot be
  replaced by an unsigned mirror or matching bytes.
- **What:** the estate owner provided the trust anchor and published a
  conforming, owner-signed registry.
- **Where:** the repository path is `ecosystem-spec.json`; the owner's
  publication location is
  `https://github.com/kody-w/rapp-map/blob/main/ecosystem-spec.json`.
- **When:** the owner decided at `2026-09-02T01:14:10.000Z`, the instant
  registry_seq 1 was published, and published registry_seq 2 at
  `2026-09-02T12:41:49.000Z`.
- **How:** follow the exact rev-5 authority pinned in
  [`RAPP1_AUTHORITY.json`](RAPP1_AUTHORITY.json), without repository
  maintainers creating owner material.

The owner inputs' public halves are recorded in
[`RAPP1_OWNER_ACTIONS.json`](RAPP1_OWNER_ACTIONS.json): the owner rappid, SPKI,
registry sequence, canonical source, publication URL and digest, signature, and
staleness policy. The private key is held by the owner outside every
repository; the ledger records that pointer, never the value.

## Acceptance gate

Acceptance requires all machine-ledger tests: the out-of-band anchor must bind
to the SPKI through the rev-5 `Hb` calculation; the exact section 13 document
shape and detached signature must verify; sequence rollback and stale evidence
must be refused; every used entry must validate; and all listed negative cases
must fail closed.

Repository maintainers supply no signature, anchor, sequence, succession
record, revocation record, genesis record, or accepted registry state; those
come only from the owner-signed registry.
