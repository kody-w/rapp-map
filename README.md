# rapp-map

`rapp-map` is a read-only repository map. It is not a protocol authority, a
runtime, an installer, or an authenticated registry.

## RAPP/1 authority and status

The sole protocol authority used here is `kody-w/rapp-1` at commit
`6723c7add2aed36bb68992fc71a56b0a4bd5ad81`, with `SPEC.md` pinned by exact
length and SHA-256 in [`RAPP1_AUTHORITY.json`](RAPP1_AUTHORITY.json).

**This repository is not yet fully RAPP/1 conformant.** The authenticated
registry evidence required by section 13 is absent. See
[`RAPP1_STATUS.md`](RAPP1_STATUS.md) and the
[`owner-action ledger`](RAPP1_OWNER_ACTIONS.md).

## Live artifacts

| Artifact | Disposition |
| --- | --- |
| `ecosystem-spec.json` | Fail-closed registry-path status; consumers must refuse it as an authenticated registry. |
| `graph.json` | Deterministic, offline structural map subordinate to the exact authority pin. |
| `estate-map.json` | Historical 92-repository observation; non-authoritative. |
| `neurons.json` | Historical 630-record observation; non-authoritative. |
| `neurons-manifest.json` | Historical index for the same observation; non-authoritative. |
| `conformance/` | Structural rev-5 identity vectors; never owner acceptance. |

Historical ecosystem prose and the former unsigned mirror remain available in
Git history at baseline commit
`baded0098d8b97c2876c0b8af4475cf3061b7ad0`. They are not current guidance.

## Local validation

```text
node conformance/run-conformance.mjs
node conformance/waiver-freshness.mjs
python3.11 build_graph.py --check
node .github/scripts/standing-guard.mjs local
node .github/scripts/standing-guard.mjs blocker
```

These commands are offline. Passing them establishes structural consistency
only; it does not resolve the owner blocker.
