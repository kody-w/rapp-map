# RAPP/1 owner-action ledger

This ledger is **open and non-authoritative**. It records the one known external
decision; it does not perform that decision or grant acceptance.

## Open: authenticated section 13 registry

- **Why:** the registry is the signed root used for key discovery, namespace
  closure, revocation, succession, and current genesis selection. It cannot be
  replaced by an unsigned mirror or matching bytes.
- **What:** the estate owner must provide the trust anchor and publish a
  conforming, owner-signed registry.
- **Where:** the repository path is `ecosystem-spec.json`; the owner's
  publication location is **unknown**.
- **When:** the owner decision and publication times are **unknown**.
- **How:** follow the exact rev-5 authority pinned in
  [`RAPP1_AUTHORITY.json`](RAPP1_AUTHORITY.json), without repository
  maintainers creating owner material.

Unknown owner inputs remain `null` in
[`RAPP1_OWNER_ACTIONS.json`](RAPP1_OWNER_ACTIONS.json): the owner rappid, SPKI,
registry sequence, canonical source, publication URL and digest, signature, and
staleness policy.

## Acceptance gate

Acceptance requires all machine-ledger tests: the out-of-band anchor must bind
to the SPKI through the rev-5 `Hb` calculation; the exact section 13 document
shape and detached signature must verify; sequence rollback and stale evidence
must be refused; every used entry must validate; and all listed negative cases
must fail closed.

No signature, anchor, sequence, succession record, revocation record, genesis
record, or accepted registry state is supplied by this repository.
